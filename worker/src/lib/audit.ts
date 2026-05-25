import type { Env, AuthUser } from '../types';

export async function writeAudit(
  env: Env,
  user: AuthUser | null,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details: Record<string, unknown> = {},
) {
  try {
    const userName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
    await env.DB.prepare(
      'INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      user?.id || 'system',
      userName,
      action,
      entityType,
      entityId ? String(entityId) : null,
      JSON.stringify(details),
    ).run();
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

export function parseJson(value: unknown) {
  if (!value || typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
