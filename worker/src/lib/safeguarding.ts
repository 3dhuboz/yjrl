import type { D1Database } from '@cloudflare/workers-types';
import type { AuthUser, Env } from '../types';

export function isApprovedCoach(user: AuthUser) {
  return user.role === 'coach' && user.coachApproved === true;
}

export async function hasCurrentAdultApproval(env: Env, userId: string, role: 'coach' | 'admin' | 'dev') {
  const today = new Date().toISOString().split('T')[0];
  const row = await env.DB.prepare(
    `SELECT ara.user_id
     FROM adult_role_approvals ara
     JOIN users u ON ara.user_id = u.id
     WHERE ara.user_id = ?
       AND ara.requested_role = ?
       AND ara.status = 'approved'
       AND ara.blue_card_status = 'verified'
       AND ara.blue_card_expiry IS NOT NULL
       AND ara.blue_card_expiry >= ?
       AND ara.identity_checked = 1
       AND ara.safeguarding_training_completed = 1
       AND u.is_active = 1
       AND u.role = ?`
  ).bind(userId, role, today, role).first();
  return !!row;
}

export function isAdultRole(role: string) {
  return role === 'coach' || role === 'admin' || role === 'dev';
}

export function isAdminRole(role: string) {
  return role === 'admin' || role === 'dev';
}

export function canBeGuardian(role: string) {
  return role === 'parent' || isAdultRole(role);
}

export async function hasVerifiedParentLink(
  db: D1Database,
  user: AuthUser,
  player: Record<string, unknown>,
) {
  if (!canBeGuardian(user.role)) return false;
  if (player.user_id === user.id) return true;
  const link = await db.prepare(
    'SELECT id FROM parent_child_links WHERE parent_user_id = ? AND player_id = ? AND status = ?'
  ).bind(user.id, player.id, 'verified').first();
  return !!link;
}

export async function hasVerifiedParentForTeam(
  db: D1Database,
  user: AuthUser,
  teamId: string,
) {
  if (!canBeGuardian(user.role)) return false;
  const direct = await db.prepare(
    'SELECT id FROM players WHERE user_id = ? AND team_id = ? AND is_active = 1'
  ).bind(user.id, teamId).first();
  if (direct) return true;

  const linked = await db.prepare(
    `SELECT p.id
     FROM parent_child_links pcl
     JOIN players p ON p.id = pcl.player_id
     WHERE pcl.parent_user_id = ? AND pcl.status = ? AND p.team_id = ? AND p.is_active = 1`
  ).bind(user.id, 'verified', teamId).first();
  return !!linked;
}

export async function coachOwnsPlayer(db: D1Database, user: AuthUser, playerId: string) {
  if (isAdminRole(user.role)) return true;
  if (!isApprovedCoach(user)) return false;
  const player = await db.prepare(
    `SELECT p.id
     FROM players p
     JOIN teams t ON p.team_id = t.id
     WHERE p.id = ? AND p.is_active = 1 AND t.coach_id = ? AND t.is_active = 1`
  ).bind(playerId, user.id).first();
  return !!player;
}
