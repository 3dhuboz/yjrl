import type { Env, AuthUser } from '../types';

export type ChildDataScope = 'admin_roster' | 'admin' | 'parent' | 'player' | 'coach';
export type ChildReadAction = 'player_list' | 'player_self' | 'guardian_children' | 'coach_team' | 'player_detail';

// Unlike the activity feed, a failed write must prevent the private response.
export async function recordChildAccess(
  env: Env,
  user: AuthUser,
  action: ChildReadAction,
  playerIds: string[],
  scope: ChildDataScope,
) {
  const result = await env.DB.prepare(
    'INSERT INTO child_access_log (actor_user_id, actor_role, action, player_ids, data_scope) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, user.role, action, JSON.stringify(playerIds), scope).run();
  if (!result.success) throw new Error('Child access event was not saved');
}
