import { Context, Next } from 'hono';
import * as jose from 'jose';
import type { Env, Variables } from '../types';
import { hasCurrentAdultApproval, isApprovedCoach, canBeGuardian } from '../lib/safeguarding';
import adultAccount from '../../../shared/adultAccount.json';
import { memberAccessOpen, memberClosedMessage } from '../lib/launch';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  c.header('Cache-Control', 'no-store');
  const header = c.req.header('Authorization');
  if (!header) return c.json({ error: 'No auth token' }, 401);

  const token = header.replace('Bearer ', '');
  let userId: string;
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, { algorithms: ['HS256'] });
    userId = (payload.sub || payload.userId) as string;
    if (!userId) return c.json({ error: 'Invalid token' }, 401);
  } catch {
    return c.json({ error: 'Authentication failed' }, 401);
  }
  // Database and route failures are not invalid sessions.
  const user = await c.env.DB.prepare(
    'SELECT id, first_name, last_name, email, role, is_active, adult_attestation_version FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user || !user.is_active) return c.json({ error: 'Invalid token' }, 401);
  if (!canBeGuardian(user.role as string)) {
    return c.json({ error: 'Accounts are for adults only. A parent or guardian must manage the player’s information.', code: 'adult_account_required' }, 403);
  }
  if (!memberAccessOpen(c.env) && user.role !== 'admin' && user.role !== 'dev') {
    return c.json({ error: memberClosedMessage, code: 'member_access_closed' }, 503);
  }
  if (user.adult_attestation_version !== adultAccount.version) {
    return c.json({ error: 'Please sign in again and confirm the adult account declaration.', code: 'adult_confirmation_required' }, 401);
  }

  c.set('user', {
    id: user.id as string,
    role: user.role as string,
    firstName: user.first_name as string,
    lastName: user.last_name as string,
    email: user.email as string,
    coachApproved: user.role === 'coach' && await hasCurrentAdultApproval(c.env, user.id as string, 'coach'),
  });

  await next();
}

export function requireAdmin(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  const user = c.get('user');
  return user.role === 'admin' || user.role === 'dev';
}

export function requireCoachOrAdmin(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  const user = c.get('user');
  return user.role === 'admin' || user.role === 'dev' || isApprovedCoach(user);
}
