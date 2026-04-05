import { Hono } from 'hono';
import * as jose from 'jose';
import type { Env, Variables } from '../types';
import { hashPassword, verifyPassword } from '../lib/password';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

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
  const body = await c.req.json();
  const { firstName, lastName, email, password, role, phone } = body;

  if (!firstName || !email || !password) {
    return c.json({ error: 'First name, email, and password are required' }, 400);
  }

  const emailNorm = email.toLowerCase().trim();
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailNorm).first();
  if (existing) return c.json({ error: 'Email already registered' }, 400);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const validRole = ['player', 'parent', 'coach'].includes(role) ? role : 'player';

  await c.env.DB.prepare(
    'INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, firstName, lastName || '', emailNorm, passwordHash, validRole, phone || '').run();

  const token = await makeToken(id, c.env.JWT_SECRET);
  return c.json({
    token,
    user: { _id: id, firstName, lastName: lastName || '', email: emailNorm, role: validRole },
  }, 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

  const emailNorm = email.toLowerCase().trim();
  const user = await c.env.DB.prepare(
    'SELECT id, first_name, last_name, email, password_hash, role, is_active FROM users WHERE email = ? AND is_active = 1'
  ).bind(emailNorm).first();

  if (!user) return c.json({ error: 'Invalid email or password' }, 401);

  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) return c.json({ error: 'Invalid email or password' }, 401);

  const token = await makeToken(user.id as string, c.env.JWT_SECRET);
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
