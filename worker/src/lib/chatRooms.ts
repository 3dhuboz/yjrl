import type { Context } from 'hono';
import type { Env, Variables } from '../types';
import { hasVerifiedParentForTeam, isApprovedCoach, isAdminRole } from './safeguarding';

type ChatContext = Context<{ Bindings: Env; Variables: Variables }>;
export async function roomAccess(c: ChatContext, roomId: string) {
  const user = c.get('user');
  const admin = isAdminRole(user.role);
  if (roomId === 'coach-all') return { allowed: admin || isApprovedCoach(user), manage: admin || isApprovedCoach(user), name: 'All coaches', type: 'coach' };
  if (roomId === 'committee-all') {
    const member = admin || !!await c.env.DB.prepare('SELECT user_id FROM committee_members WHERE user_id = ?').bind(user.id).first();
    return { allowed: member, manage: member, name: 'Committee', type: 'committee' };
  }
  const match = /^(parent|coaches|player):([^:]+)$/.exec(roomId);
  if (!match) return { allowed: false, manage: false, name: '', type: '' };
  const [, type, teamId] = match;
  const team = await c.env.DB.prepare('SELECT id, name, coach_id, assistant_id, manager_id FROM teams WHERE id = ? AND is_active = 1').bind(teamId).first();
  if (!team) return { allowed: false, manage: false, name: '', type };
  const staff = isApprovedCoach(user) && [team.coach_id, team.assistant_id, team.manager_id].includes(user.id);
  // Historic junior messages remain readable to admins/verified guardians; no new junior messages.
  const guardian = type !== 'coaches' && await hasVerifiedParentForTeam(c.env.DB, user, teamId);
  return { allowed: admin || staff && type !== 'player' || guardian, manage: type !== 'player' && (admin || staff),
    name: `${team.name} · ${type === 'coaches' ? 'Coaching staff' : 'Team families'}`, type };
}
