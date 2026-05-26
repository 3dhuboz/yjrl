import { Hono } from 'hono';
import type { Env, Variables, AuthUser } from '../types';
import { hashPassword, verifyPassword } from '../lib/password';
import { createOrder, captureOrder } from '../lib/paypal';
import { sendEmail, registrationOfflineEmail, registrationPaidEmail, adminRegistrationNotification } from '../lib/email';
import { writeAudit } from '../lib/audit';
import * as jose from 'jose';

const register = new Hono<{ Bindings: Env; Variables: Variables }>();

const FEES: Record<string, number> = {
  U6: 80, U7: 80, U8: 120, U9: 120, U10: 150, U11: 150,
  U12: 180, U13: 180, U14: 200, U15: 200, U16: 220,
  U17: 220, U18: 220, Womens: 200, Mens: 250,
};
const EARLY_BIRD_DISCOUNT = 20;
const EARLY_BIRD_CUTOFF = '2026-02-28';

type ExistingUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: number | boolean;
};

function paypalAvailable(env: Env): env is Env & { PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string; PAYPAL_MODE?: string } {
  return !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

function paypalReadyForCustomers(env: Env): env is Env & { PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string; PAYPAL_MODE?: string } {
  if (!paypalAvailable(env)) return false;
  if ((env.ENVIRONMENT || '').toLowerCase() === 'production') {
    return env.PAYPAL_MODE === 'live' && String(env.CHILD_SAFETY_SIGNOFF || '').toLowerCase() === 'approved';
  }
  return true;
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

async function issueToken(env: Env, userId: string) {
  const key = new TextEncoder().encode(env.JWT_SECRET);
  return new jose.SignJWT({ sub: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').setIssuedAt().sign(key);
}

function userResponse(user: Pick<ExistingUser, 'id' | 'first_name' | 'last_name' | 'email' | 'role'>) {
  return {
    _id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
  };
}

function authUserFrom(user: Pick<ExistingUser, 'id' | 'first_name' | 'last_name' | 'email' | 'role'>): AuthUser {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
  };
}

function registrationSnapshot(body: Record<string, unknown>, paymentMethod: string) {
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
    paymentMethod,
  };
}

function normalise(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function checkoutFrontendUrl(env: Env, request: Request) {
  const configured = (env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const candidates = [
    request.headers.get('Origin') || '',
    request.headers.get('Referer') || '',
  ];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const host = url.hostname;
      if (
        host === 'localhost'
        || host === '127.0.0.1'
        || host === 'yjrl.pages.dev'
        || host.endsWith('.yjrl.pages.dev')
        || host === 'yeppoonjrl.com.au'
        || host === 'www.yeppoonjrl.com.au'
      ) {
        return url.origin;
      }
    } catch {
      // Ignore malformed client-supplied origins.
    }
  }
  return 'https://yjrl.pages.dev';
}

async function findExistingSeasonRegistration(env: Env, userId: string, firstName: string, lastName: string, dateOfBirth: string, season: string) {
  return env.DB.prepare(
    `SELECT r.id, r.payment_status, r.paypal_order_id, p.id AS player_id
     FROM players p
     JOIN registrations r ON r.player_id = p.id
     WHERE p.user_id = ?
       AND lower(trim(p.first_name)) = ?
       AND lower(trim(p.last_name)) = ?
       AND ifnull(p.date_of_birth, '') = ?
       AND r.season = ?
       AND p.is_active = 1
     ORDER BY r.created_at DESC
     LIMIT 1`
  ).bind(userId, normalise(firstName), normalise(lastName), dateOfBirth || '', season).first();
}

async function sendRegistrationEmails(
  env: Env,
  registrationId: string,
  guardianEmail: string,
  adminEmail: string | undefined,
  playerName: string,
  ageGroup: string,
  guardianName: string,
  amount: number,
  paymentStatus: 'paid' | 'offline',
) {
  if (!env.RESEND_API_KEY) {
    await writeAudit(env, null, 'email_skipped', 'registration', registrationId, { reason: 'RESEND_API_KEY missing', paymentStatus });
    return;
  }

  const parentEmail = paymentStatus === 'paid'
    ? registrationPaidEmail(playerName, ageGroup, amount)
    : registrationOfflineEmail(playerName, ageGroup, amount);
  const sentParent = await sendEmail(env.RESEND_API_KEY, env.FROM_EMAIL, { to: guardianEmail, ...parentEmail });
  if (!sentParent) {
    await writeAudit(env, null, 'email_failed', 'registration', registrationId, { to: guardianEmail, paymentStatus });
  }

  if (adminEmail) {
    const adminNotice = adminRegistrationNotification(
      playerName,
      ageGroup,
      guardianName || 'N/A',
      paymentStatus === 'paid' ? 'Paid online' : 'Awaiting offline payment',
    );
    const sentAdmin = await sendEmail(env.RESEND_API_KEY, env.FROM_EMAIL, { to: adminEmail, ...adminNotice });
    if (!sentAdmin) {
      await writeAudit(env, null, 'email_failed', 'registration', registrationId, { to: adminEmail, paymentStatus, recipient: 'admin' });
    }
  }
}

register.get('/registration-fees', async (c) => {
  const now = new Date().toISOString().split('T')[0];
  const earlyBirdActive = now <= EARLY_BIRD_CUTOFF;
  return c.json({
    fees: FEES,
    earlyBirdDiscount: EARLY_BIRD_DISCOUNT,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    earlyBirdActive,
    paymentOptions: {
      paypal: paypalReadyForCustomers(c.env),
      offline: true,
    },
  });
});

register.post('/register-player', async (c) => {
  let body: Record<string, any>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    firstName, lastName, email, password, dateOfBirth, ageGroup, position,
    guardianName, guardianPhone, guardianEmail, emergencyContact, emergencyName, emergencyPhone, emergencyRelationship, medicalNotes,
    paymentMethod,
  } = body;

  if (!firstName || !lastName || !email || !password || !ageGroup) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  if (String(password).length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const requestedPaymentMethod = paymentMethod === 'paypal' ? 'paypal' : 'offline';
  if (requestedPaymentMethod === 'paypal' && !paypalReadyForCustomers(c.env)) {
    return c.json({ error: 'Online payment is not available until live PayPal and child-safety launch sign-off are complete. Please choose offline payment or contact the club.' }, 503);
  }

  const emailNorm = normalise(email);
  const guardianEmailNorm = normalise(guardianEmail || emailNorm);
  const season = new Date().getFullYear().toString();
  const existing = await c.env.DB.prepare(
    'SELECT id, first_name, last_name, email, password_hash, role, is_active FROM users WHERE email = ?'
  ).bind(emailNorm).first<ExistingUser>();

  let user: ExistingUser;
  let isNewUser = false;
  let newUserPasswordHash = '';

  if (existing) {
    if (!existing.is_active) return c.json({ error: 'This account is not active. Please contact the club.' }, 403);
    const validPassword = await verifyPassword(String(password), existing.password_hash);
    if (!validPassword) return c.json({ error: 'Email already registered. Sign in with the existing account password to add another child.' }, 401);
    if (existing.role === 'player') {
      return c.json({ error: 'This email belongs to a player account. Please use a parent or guardian account.' }, 400);
    }
    user = existing;

    const duplicate = await findExistingSeasonRegistration(c.env, user.id, firstName, lastName, dateOfBirth || '', season);
    if (duplicate) {
      return c.json({
        error: 'This player already has a registration for this season. Please use the parent portal or contact the club before submitting again.',
        registrationId: duplicate.id,
        paymentStatus: duplicate.payment_status,
      }, 409);
    }
  } else {
    const userId = crypto.randomUUID();
    newUserPasswordHash = await hashPassword(password);
    user = {
      id: userId,
      first_name: guardianName || firstName,
      last_name: lastName,
      email: emailNorm,
      password_hash: newUserPasswordHash,
      role: 'parent',
      is_active: 1,
    };
    isNewUser = true;
  }

  const baseFee = FEES[ageGroup] || 150;
  const now = new Date().toISOString().split('T')[0];
  const discount = now <= EARLY_BIRD_CUTOFF ? EARLY_BIRD_DISCOUNT : 0;
  const totalFee = baseFee - discount;
  const playerId = crypto.randomUUID();
  const regId = crypto.randomUUID();
  const emergency = emergencyContact || { name: emergencyName, phone: emergencyPhone, relationship: emergencyRelationship };
  const playerName = `${firstName} ${lastName}`.trim();
  const formData = JSON.stringify({ ...registrationSnapshot(body, requestedPaymentMethod), amount: totalFee });

  let paypalOrder: { orderId: string; approvalUrl: string } | null = null;
  if (requestedPaymentMethod === 'paypal') {
    const paypalEnv = c.env as Env & { PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string; PAYPAL_MODE?: string };
    const frontendUrl = checkoutFrontendUrl(c.env, c.req.raw);
    const checkoutState = await signCheckoutState(c.env.JWT_SECRET, regId, user.id, totalFee);
    try {
      paypalOrder = await createOrder(
        paypalEnv,
        totalFee,
        'AUD',
        `YJRL ${ageGroup} Registration - ${playerName}`,
        `${frontendUrl}/register?success=true&reg=${regId}&state=${encodeURIComponent(checkoutState)}`,
        `${frontendUrl}/register?cancelled=true&reg=${regId}`,
        regId,
      );
    } catch (error) {
      await writeAudit(c.env, authUserFrom(user), 'paypal_order_failed', 'registration', regId, {
        playerName,
        ageGroup,
        message: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: 'Online payment could not be started. No registration was created; please try again or choose offline payment.' }, 502);
    }
  }

  const writes: D1PreparedStatement[] = [];
  if (isNewUser) {
    writes.push(c.env.DB.prepare(
      'INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(user.id, user.first_name, user.last_name, user.email, newUserPasswordHash, 'parent', guardianPhone || ''));
  }
  writes.push(
    c.env.DB.prepare(
      `INSERT INTO players (id, user_id, first_name, last_name, date_of_birth, age_group, position,
        guardian_name, guardian_phone, guardian_email, emergency_name, emergency_phone, emergency_relationship,
        medical_notes, registration_status, registration_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      playerId, user.id, firstName, lastName, dateOfBirth || null, ageGroup, position || '',
      guardianName || '', guardianPhone || '', guardianEmailNorm,
      emergency?.name || '', emergency?.phone || '', emergency?.relationship || '',
      medicalNotes || '', 'pending', season,
    ),
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
      user.id,
      guardianName || `${user.first_name} ${user.last_name}`.trim(),
    ),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO parent_child_links
       (id, parent_user_id, player_id, relationship, status, source, verified_by_user_id, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), user.id, playerId, 'guardian', 'verified', 'registration', user.id),
  );

  if (requestedPaymentMethod === 'offline') {
    writes.push(c.env.DB.prepare(
      `INSERT INTO registrations (id, player_id, user_id, season, age_group, fee_amount, discount_amount, payment_status, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(regId, playerId, user.id, season, ageGroup, totalFee, discount, 'offline', formData));
  } else {
    writes.push(c.env.DB.prepare(
      `INSERT INTO registrations (id, player_id, user_id, season, age_group, fee_amount, discount_amount, payment_status, paypal_order_id, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(regId, playerId, user.id, season, ageGroup, totalFee, discount, 'pending', paypalOrder!.orderId, formData));
  }

  await c.env.DB.batch(writes);

  await writeAudit(c.env, authUserFrom(user), 'registration_created', 'registration', regId, {
    playerId,
    ageGroup,
    paymentMethod: requestedPaymentMethod,
    paymentStatus: requestedPaymentMethod === 'offline' ? 'offline' : 'pending',
    mediaConsent: !!body.agreeToPhotoPolicy,
    existingParentAccount: !!existing,
  });

  if (requestedPaymentMethod === 'offline') {
    const token = await issueToken(c.env, user.id);
    await sendRegistrationEmails(c.env, regId, guardianEmailNorm, c.env.ADMIN_EMAIL, playerName, ageGroup, guardianName || 'N/A', totalFee, 'offline');
    return c.json({
      registrationId: regId,
      paymentMethod: 'offline',
      paymentStatus: 'offline',
      amount: totalFee,
      ageGroup,
      playerName,
      token,
      user: userResponse(user),
    }, 201);
  }

  return c.json({
    registrationId: regId,
    approvalUrl: paypalOrder!.approvalUrl,
    orderId: paypalOrder!.orderId,
    paymentMethod: 'paypal',
    paymentStatus: 'pending',
    amount: totalFee,
    ageGroup,
    playerName,
  }, 201);
});

register.post('/register-player/:id/capture', async (c) => {
  const regId = c.req.param('id');
  let body: { state?: string } = {};
  try { body = await c.req.json(); } catch {}

  const reg = await c.env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(regId).first();
  if (!reg) return c.json({ error: 'Registration not found' }, 404);
  if (!reg.paypal_order_id) return c.json({ error: 'No PayPal order' }, 400);
  if (!(await verifyCheckoutState(c.env.JWT_SECRET, body.state, regId))) {
    return c.json({ error: 'Invalid or expired checkout state' }, 403);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(reg.user_id).first<ExistingUser>();
  if (!user) return c.json({ error: 'Registration account not found' }, 404);

  if (reg.payment_status !== 'paid') {
    if (!paypalReadyForCustomers(c.env)) {
      return c.json({ error: 'Online payment is not currently available. Please contact the club.' }, 503);
    }
    const paypalEnv = c.env as Env & { PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string; PAYPAL_MODE?: string };
    const { status, captureId } = await captureOrder(paypalEnv, reg.paypal_order_id as string, regId);
    if (status !== 'COMPLETED') return c.json({ error: `Payment not completed: ${status}` }, 400);

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE registrations SET payment_status = ?, paypal_capture_id = ?, paid_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ? AND payment_status <> ?').bind('paid', captureId || '', regId, 'paid'),
      c.env.DB.prepare('UPDATE players SET registration_status = ? WHERE id = ?').bind('active', reg.player_id),
    ]);
    await writeAudit(c.env, authUserFrom(user), 'registration_paid', 'registration', regId, {
      playerId: reg.player_id,
      captureId: captureId || '',
    });
  }

  const token = await issueToken(c.env, reg.user_id as string);
  let capturedPlayerName = '';
  const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(reg.player_id).first();
  if (player) {
    capturedPlayerName = `${player.first_name} ${player.last_name}`.trim();
    const guardianEmail = (player.guardian_email || user.email) as string;
    await sendRegistrationEmails(
      c.env,
      regId,
      guardianEmail,
      c.env.ADMIN_EMAIL,
      capturedPlayerName,
      player.age_group as string,
      player.guardian_name as string,
      Number(reg.fee_amount || 0),
      'paid',
    );
  }

  return c.json({
    status: 'paid',
    paymentStatus: 'paid',
    paymentMethod: 'paypal',
    amount: Number(reg.fee_amount || 0),
    ageGroup: reg.age_group,
    playerName: capturedPlayerName,
    token,
    user: userResponse(user),
  });
});

export default register;
