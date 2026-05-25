import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { hashPassword } from '../lib/password';
import { createOrder, captureOrder } from '../lib/paypal';
import { sendEmail, registrationConfirmationEmail, adminRegistrationNotification } from '../lib/email';
import { writeAudit } from '../lib/audit';
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

function paypalAvailable(env: Env): env is Env & { PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string; PAYPAL_MODE?: string } {
  return !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

async function signCheckoutState(secret: string, registrationId: string, userId: string, amount: number) {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({ registrationId, userId, amount })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('4h')
    .setIssuedAt()
    .sign(key);
}

async function verifyCheckoutState(secret: string, state: string | undefined, registrationId: string) {
  if (!state) return false;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(state, key);
    return payload.registrationId === registrationId;
  } catch {
    return false;
  }
}

function registrationSnapshot(body: Record<string, unknown>) {
  const emergencyContact = (body.emergencyContact || {
    name: body.emergencyName,
    phone: body.emergencyPhone,
    relationship: body.emergencyRelationship,
  }) as Record<string, unknown>;

  return {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    dateOfBirth: body.dateOfBirth,
    ageGroup: body.ageGroup,
    position: body.position,
    guardianName: body.guardianName,
    guardianPhone: body.guardianPhone,
    guardianEmail: body.guardianEmail,
    emergencyContact,
    medicalNotes: body.medicalNotes,
    agreeToTerms: body.agreeToTerms,
    agreeToPhotoPolicy: body.agreeToPhotoPolicy,
    paymentMethod: body.paymentMethod,
  };
}

// GET /api/registration-fees
register.get('/registration-fees', async (c) => {
  const now = new Date().toISOString().split('T')[0];
  const earlyBirdActive = now <= EARLY_BIRD_CUTOFF;
  return c.json({
    fees: FEES,
    earlyBirdDiscount: EARLY_BIRD_DISCOUNT,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    earlyBirdActive,
    paymentOptions: {
      paypal: paypalAvailable(c.env),
      offline: true,
    },
  });
});

// POST /api/register-player — create user, player, registration, and PayPal order
register.post('/register-player', async (c) => {
  let body: Record<string, any>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { firstName, lastName, email, password, dateOfBirth, ageGroup, position,
    guardianName, guardianPhone, guardianEmail, emergencyContact, emergencyName, emergencyPhone, emergencyRelationship, medicalNotes,
    paymentMethod } = body;

  if (!firstName || !lastName || !email || !password || !ageGroup) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  if (String(password).length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
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
  ).bind(userId, firstName, lastName, emailNorm, passwordHash, 'parent', guardianPhone || '').run();

  // Create player
  const playerId = crypto.randomUUID();
  const emergency = emergencyContact || { name: emergencyName, phone: emergencyPhone, relationship: emergencyRelationship };
  await c.env.DB.prepare(
    `INSERT INTO players (id, user_id, first_name, last_name, date_of_birth, age_group, position,
      guardian_name, guardian_phone, guardian_email, emergency_name, emergency_phone, emergency_relationship,
      medical_notes, registration_status, registration_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    playerId, userId, firstName, lastName, dateOfBirth || null, ageGroup, position || '',
    guardianName || '', guardianPhone || '', guardianEmail || emailNorm,
    emergency?.name || '', emergency?.phone || '', emergency?.relationship || '',
    medicalNotes || '', 'pending', new Date().getFullYear().toString()
  ).run();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR REPLACE INTO player_consents
       (player_id, media_consent, public_profile_consent, stats_public_consent, consent_source, consent_by_user_id, consent_by_name, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      playerId,
      body.agreeToPhotoPolicy ? 1 : 0,
      body.agreeToPhotoPolicy ? 1 : 0,
      0,
      'registration',
      userId,
      guardianName || `${firstName} ${lastName}`.trim(),
    ),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO parent_child_links
       (id, parent_user_id, player_id, relationship, status, source, verified_by_user_id, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), userId, playerId, 'guardian', 'verified', 'registration', userId),
  ]);

  // Create registration record
  const regId = crypto.randomUUID();
  const effectivePaymentMethod = paymentMethod === 'paypal' && paypalAvailable(c.env) ? 'paypal' : 'offline';
  const formData = JSON.stringify({ ...registrationSnapshot(body), paymentMethod: effectivePaymentMethod });

  if (effectivePaymentMethod === 'offline') {
    // Bank transfer / pay at canteen — skip PayPal
    await c.env.DB.prepare(
      `INSERT INTO registrations (id, player_id, user_id, season, age_group, fee_amount, discount_amount, payment_status, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(regId, playerId, userId, new Date().getFullYear().toString(), ageGroup, totalFee, discount, 'offline', formData).run();

    // Issue JWT so user is logged in
    const key = new TextEncoder().encode(c.env.JWT_SECRET);
    const token = await new jose.SignJWT({ sub: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').setIssuedAt().sign(key);

    const playerName = `${firstName} ${lastName}`;
    if (c.env.RESEND_API_KEY) {
      const confirmEmail = registrationConfirmationEmail(playerName, ageGroup, totalFee);
      await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, { to: guardianEmail || emailNorm, ...confirmEmail });
    }

    // Notify admin
    if (c.env.RESEND_API_KEY && c.env.ADMIN_EMAIL) {
      const adminEmail = adminRegistrationNotification(playerName, ageGroup, guardianName || 'N/A');
      await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, { to: c.env.ADMIN_EMAIL, ...adminEmail });
    }

    await writeAudit(c.env, { id: userId, role: 'parent', firstName, lastName, email: emailNorm }, 'registration_created', 'registration', regId, {
      playerId,
      ageGroup,
      paymentMethod: 'offline',
      mediaConsent: !!body.agreeToPhotoPolicy,
    });

    return c.json({ registrationId: regId, paymentMethod: 'offline', token, user: { _id: userId, firstName, lastName, email: emailNorm, role: 'parent' } }, 201);
  }

  // PayPal flow
  const paypalEnv = c.env;
  if (!paypalAvailable(paypalEnv)) {
    return c.json({ error: 'PayPal is not currently available. Please choose offline payment.' }, 503);
  }
  await c.env.DB.prepare(
    `INSERT INTO registrations (id, player_id, user_id, season, age_group, fee_amount, discount_amount, payment_status, form_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(regId, playerId, userId, new Date().getFullYear().toString(), ageGroup, totalFee, discount, 'pending', formData).run();

  const frontendUrl = c.req.header('Origin') || c.req.header('Referer')?.replace(/\/[^/]*$/, '') || 'https://yjrl.pages.dev';
  const checkoutState = await signCheckoutState(c.env.JWT_SECRET, regId, userId, totalFee);
  const { orderId, approvalUrl } = await createOrder(
    paypalEnv, totalFee, 'AUD',
    `YJRL ${ageGroup} Registration — ${firstName} ${lastName}`,
    `${frontendUrl}/register?success=true&reg=${regId}&state=${encodeURIComponent(checkoutState)}`,
    `${frontendUrl}/register?cancelled=true&reg=${regId}`
  );

  await c.env.DB.prepare('UPDATE registrations SET paypal_order_id = ? WHERE id = ?').bind(orderId, regId).run();
  await writeAudit(c.env, { id: userId, role: 'parent', firstName, lastName, email: emailNorm }, 'registration_created', 'registration', regId, {
    playerId,
    ageGroup,
    paymentMethod: 'paypal',
    mediaConsent: !!body.agreeToPhotoPolicy,
  });

  return c.json({ registrationId: regId, approvalUrl, orderId }, 201);
});

// POST /api/register-player/:id/capture — capture PayPal payment
register.post('/register-player/:id/capture', async (c) => {
  const regId = c.req.param('id');
  let body: { state?: string } = {};
  try { body = await c.req.json(); } catch {}
  const reg = await c.env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(regId).first();
  if (!reg) return c.json({ error: 'Registration not found' }, 404);
  if (reg.payment_status === 'paid') return c.json({ error: 'Already paid' }, 400);
  if (!reg.paypal_order_id) return c.json({ error: 'No PayPal order' }, 400);
  if (!(await verifyCheckoutState(c.env.JWT_SECRET, body.state, regId))) {
    return c.json({ error: 'Invalid or expired checkout state' }, 403);
  }

  const paypalEnv = c.env;
  if (!paypalAvailable(paypalEnv)) {
    return c.json({ error: 'PayPal is not currently available. Please contact the club.' }, 503);
  }
  const { status, captureId } = await captureOrder(paypalEnv, reg.paypal_order_id as string);
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
