import { Hono } from 'hono';
import * as jose from 'jose';
import type { Env, Variables } from '../types';
import { hashPassword, verifyPassword } from '../lib/password';
import { authMiddleware } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { canBeGuardian } from '../lib/safeguarding';
import adultAccount from '../../../shared/adultAccount.json';
import { registrationOpen, registrationClosedMessage, memberAccessOpen, memberClosedMessage } from '../lib/launch';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();
auth.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });

async function makeToken(userId: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(key);
}

// POST /auth/register
auth.post('/register', async (c) => {
  if (!registrationOpen(c.env)) return c.json({ error: registrationClosedMessage, code: 'registration_closed' }, 503);
  let body: Record<string, any>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'Invalid account details' }, 400);
  const { firstName, lastName, email, password, role, phone } = body;

  if (typeof firstName !== 'string' || !firstName.trim() || firstName.trim().length > 100
    || (lastName !== undefined && (typeof lastName !== 'string' || lastName.trim().length > 100))
    || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || (phone !== undefined && (typeof phone !== 'string' || phone.length > 40))) {
    return c.json({ error: 'First name, email, and password are required' }, 400);
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return c.json({ error: 'Password must be between 8 and 128 characters' }, 400);
  }

  if (role !== undefined && role !== 'parent') {
    return c.json({ error: 'Self-registration is for adult parent or guardian accounts only. Staff access is managed by the club.' }, 403);
  }
  if (body.adultConfirmed !== true) return c.json({ error: 'Please confirm the adult account declaration.' }, 400);

  const emailNorm = email.toLowerCase().trim();
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailNorm).first();
  if (existing) return c.json({ error: 'Email already registered' }, 400);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const validRole = 'parent';

  await c.env.DB.prepare(
    "INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone, adult_attested_at, adult_attestation_version) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)"
  ).bind(id, firstName.trim(), (lastName || '').trim(), emailNorm, passwordHash, validRole, phone || '', adultAccount.version).run();

  const token = await makeToken(id, c.env.JWT_SECRET);
  await writeAudit(c.env, { id, role: validRole, firstName, lastName: lastName || '', email: emailNorm }, 'auth_register', 'user', id, { role: validRole, adultAttestationVersion: adultAccount.version });
  return c.json({
    token,
    user: { _id: id, firstName, lastName: lastName || '', email: emailNorm, role: validRole },
  }, 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  let body: Record<string, any>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'Invalid login details' }, 400);
  const { email, password } = body;
  if (typeof email !== 'string' || !email.trim() || email.length > 254
    || typeof password !== 'string' || !password || password.length > 128) return c.json({ error: 'Valid email and password required' }, 400);

  const emailNorm = email.toLowerCase().trim();
  const user = await c.env.DB.prepare(
    'SELECT id, first_name, last_name, email, password_hash, role, is_active FROM users WHERE email = ? AND is_active = 1'
  ).bind(emailNorm).first();

  if (!user) return c.json({ error: 'Invalid email or password' }, 401);

  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) return c.json({ error: 'Invalid email or password' }, 401);
  if (!canBeGuardian(user.role as string)) return c.json({ error: 'Accounts are for adults only. Please ask a parent or guardian to use their own account.', code: 'adult_account_required' }, 403);
  if (!memberAccessOpen(c.env) && user.role !== 'admin' && user.role !== 'dev') return c.json({ error: memberClosedMessage, code: 'member_access_closed' }, 503);
  if (body.adultConfirmed !== true) return c.json({ error: 'Please confirm the adult account declaration.', code: 'adult_confirmation_required' }, 400);
  await c.env.DB.prepare("UPDATE users SET adult_attested_at = datetime('now'), adult_attestation_version = ? WHERE id = ?")
    .bind(adultAccount.version, user.id).run();

  const token = await makeToken(user.id as string, c.env.JWT_SECRET);
  await writeAudit(c.env, {
    id: user.id as string,
    role: user.role as string,
    firstName: user.first_name as string,
    lastName: user.last_name as string,
    email: user.email as string,
  }, 'auth_login', 'user', user.id as string, { adultAttestationVersion: adultAccount.version });
  return c.json({
    token,
    user: { _id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, role: user.role },
  });
});

// GET /auth/me
auth.get('/me', authMiddleware, async (c) => {
  const u = c.get('user');
  const user = await c.env.DB.prepare(
    'SELECT id, first_name, last_name, email, role, phone, is_active, created_at FROM users WHERE id = ?'
  ).bind(u.id).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({
    _id: user.id, firstName: user.first_name, lastName: user.last_name,
    email: user.email, role: user.role, phone: user.phone,
    name: `${user.first_name} ${user.last_name}`.trim(),
  });
});

export default auth;
