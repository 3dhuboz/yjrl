import { Context, Next } from 'hono';
import * as jose from 'jose';
import type { Env, Variables } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header) return c.json({ error: 'No auth token' }, 401);

  const token = header.replace('Bearer ', '');
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    const userId = (payload.sub || payload.userId) as string;
    if (!userId) return c.json({ error: 'Invalid token' }, 401);

    const user = await c.env.DB.prepare(
      'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user || !user.is_active) return c.json({ error: 'Invalid token' }, 401);

    c.set('user', {
      id: user.id as string,
      role: user.role as string,
      firstName: user.first_name as string,
      lastName: user.last_name as string,
      email: user.email as string,
    });

    await next();
  } catch {
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

export function requireAdmin(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  const user = c.get('user');
  return user.role === 'admin' || user.role === 'dev';
}

export function requireCoachOrAdmin(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  const user = c.get('user');
  return user.role === 'admin' || user.role === 'dev' || user.role === 'coach';
}
