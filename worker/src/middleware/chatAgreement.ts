import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types';
import agreement from '../../../shared/chatAgreement.json';
export async function requireChatAgreement(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const accepted = await c.env.DB.prepare('SELECT accepted_at FROM chat_agreements WHERE user_id = ? AND version = ?').bind(c.get('user').id, agreement.version).first();
  if (!accepted) return c.json({ error: 'Please read and accept the adult communication agreement before participating.', code: 'chat_agreement_required' }, 403);
  await next();
}
