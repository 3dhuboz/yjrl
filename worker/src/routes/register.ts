import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { hashPassword } from '../lib/password';
import { createOrder, captureOrder } from '../lib/paypal';
import { sendEmail, registrationConfirmationEmail, adminRegistrationNotification } from '../lib/email';
import * as jose from 'jose';

const register = new Hono<{ Bindings: Env; Variables: Variables }>();

// Fee schedule
const FEES: Record<string, number> = {
  U6: 80, U7: 80, U8: 120, U9: 120, U10: 150, U11: 150,
  U12: 180, U13: 180, U14: 200, U15: 200, U16: 220,
  U17: 220, U18: 220, Womens: 200, Mens: 250,
};
const EARLY_BIRD_DISCOUNT = 20;
const EARLY_BIRD_CUTOFF = '2026-02-28';

// GET /api/registration-fees
register.get('/registration-fees', async (c) => {
  const now = new Date().toISOString().split('T')[0];
  const earlyBirdActive = now <= EARLY_BIRD_CUTOFF;
  return c.json({ fees: FEES, earlyBirdDiscount: EARLY_BIRD_DISCOUNT, earlyBirdCutoff: EARLY_BIRD_CUTOFF, earlyBirdActive });
});

// POST /api/register-player — create user, player, registration, and PayPal order
register.post('/register-player', async (c) => {
  const body = await c.req.json();
  const { firstName, lastName, email, password, dateOfBirth, ageGroup, position,
    guardianName, guardianPhone, guardianEmail, emergencyContact, medicalNotes,
    paymentMethod } = body;

  if (!firstName || !lastName || !email || !password || !ageGroup) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const emailNorm = email.toLowerCase().trim();
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailNorm).first();
  if (existing) return c.json({ error: 'Email already registered' }, 400);

  // Calculate fee
  const baseFee = FEES[ageGroup] || 150;
  const now = new Date().toISOString().split('T')[0];
  const discount = now <= EARLY_BIRD_CUTOFF ? EARLY_BIRD_DISCOUNT : 0;
  const totalFee = baseFee - discount;

  // Create user
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    'INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, firstName, lastName, emailNorm, passwordHash, 'player', guardianPhone || '').run();

  // Create player
  const playerId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO players (id, user_id, first_name, last_name, date_of_birth, age_group, position,
      guardian_name, guardian_phone, guardian_email, emergency_name, emergency_phone, emergency_relationship,
      medical_notes, registration_status, registration_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    playerId, userId, firstName, lastName, dateOfBirth || null, ageGroup, position || '',
    guardianName || '', guardianPhone || '', guardianEmail || emailNorm,
    emergencyContact?.name || '', emergencyContact?.phone || '', emergencyContact?.relationship || '',
    medicalNotes || '', 'pending', new Date().getFullYear().toString()
  ).run();

  // Create registration record
  const regId = crypto.randomUUID();
  const formData = JSON.stringify(body);

  if (paymentMethod === 'offline') {
    // Bank transfer / pay at canteen — skip PayPal
    await c.env.DB.prepare(
      `INSERT INTO registrations (id, player_id, user_id, season, age_group, fee_amount, discount_amount, payment_status, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(regId, playerId, userId, new Date().getFullYear().toString(), ageGroup, totalFee, discount, 'offline', formData).run();

    // Issue JWT so user is logged in
    const key = new TextEncoder().encode(c.env.JWT_SECRET);
    const token = await new jose.SignJWT({ sub: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').setIssuedAt().sign(key);

    // Notify admin
    if (c.env.RESEND_API_KEY && c.env.ADMIN_EMAIL) {
      const adminEmail = adminRegistrationNotification(`${firstName} ${lastName}`, ageGroup, guardianName || 'N/A');
      await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, { to: c.env.ADMIN_EMAIL, ...adminEmail });
    }

    return c.json({ registrationId: regId, paymentMethod: 'offline', token, user: { _id: userId, firstName, lastName, email: emailNorm, role: 'player' } }, 201);
  }

  // PayPal flow
  await c.env.DB.prepare(
    `INSERT INTO registrations (id, player_id, user_id, season, age_group, fee_amount, discount_amount, payment_status, form_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(regId, playerId, userId, new Date().getFullYear().toString(), ageGroup, totalFee, discount, 'pending', formData).run();

  const frontendUrl = c.req.header('Origin') || c.req.header('Referer')?.replace(/\/[^/]*$/, '') || 'https://yjrl.pages.dev';
  const { orderId, approvalUrl } = await createOrder(
    c.env, totalFee, 'AUD',
    `YJRL ${ageGroup} Registration — ${firstName} ${lastName}`,
    `${frontendUrl}/register?success=true&reg=${regId}`,
    `${frontendUrl}/register?cancelled=true&reg=${regId}`
  );

  await c.env.DB.prepare('UPDATE registrations SET paypal_order_id = ? WHERE id = ?').bind(orderId, regId).run();

  return c.json({ registrationId: regId, approvalUrl, orderId }, 201);
});

// POST /api/register-player/:id/capture — capture PayPal payment
register.post('/register-player/:id/capture', async (c) => {
  const regId = c.req.param('id');
  const reg = await c.env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(regId).first();
  if (!reg) return c.json({ error: 'Registration not found' }, 404);
  if (reg.payment_status === 'paid') return c.json({ error: 'Already paid' }, 400);
  if (!reg.paypal_order_id) return c.json({ error: 'No PayPal order' }, 400);

  const { status, captureId } = await captureOrder(c.env, reg.paypal_order_id as string);
  if (status !== 'COMPLETED') return c.json({ error: `Payment not completed: ${status}` }, 400);

  // Update registration and player status
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE registrations SET payment_status = ?, paypal_capture_id = ?, paid_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?').bind('paid', captureId, regId),
    c.env.DB.prepare('UPDATE players SET registration_status = ? WHERE id = ?').bind('active', reg.player_id),
  ]);

  // Issue JWT
  const key = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new jose.SignJWT({ sub: reg.user_id as string }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').setIssuedAt().sign(key);

  // Get user and player for response
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(reg.user_id).first();
  const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(reg.player_id).first();

  // Send confirmation email
  if (c.env.RESEND_API_KEY && player) {
    const guardianEmail = (player.guardian_email || user?.email) as string;
    const confirmEmail = registrationConfirmationEmail(
      `${player.first_name} ${player.last_name}`, player.age_group as string, reg.fee_amount as number
    );
    await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, { to: guardianEmail, ...confirmEmail });

    // Notify admin
    if (c.env.ADMIN_EMAIL) {
      const adminEmail = adminRegistrationNotification(
        `${player.first_name} ${player.last_name}`, player.age_group as string, player.guardian_name as string
      );
      await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, { to: c.env.ADMIN_EMAIL, ...adminEmail });
    }
  }

  return c.json({
    status: 'paid', token,
    user: user ? { _id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, role: user.role } : null,
  });
});

export default register;
