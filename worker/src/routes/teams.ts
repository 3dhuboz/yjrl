import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

const teams = new Hono<{ Bindings: Env; Variables: Variables }>();

function publicTeamDto(team: Record<string, unknown>, options: { includePrivateIds?: boolean } = {}) {
  const wins = (team.wins as number) || 0;
  const losses = (team.losses as number) || 0;
  const draws = (team.draws as number) || 0;
  return {
    _id: team.id,
    id: team.id,
    name: team.name,
    division: team.division,
    season: team.season,
    played: wins + losses + draws,
    wins,
    losses,
    draws,
    byes: team.byes,
    points: wins * 2 + draws,
    pointsDiff: ((team.points_for as number) || 0) - ((team.points_against as number) || 0),
    ageGroup: team.age_group,
    coachName: team.coach_name,
    assistantName: team.assistant_name,
    managerName: team.manager_name,
    pointsFor: team.points_for,
    pointsAgainst: team.points_against,
    trainingDay: team.training_day,
    trainingTime: team.training_time,
    trainingVenue: team.training_venue,
    isActive: !!team.is_active,
    colors: { primary: team.color_primary, secondary: team.color_secondary },
    ...(options.includePrivateIds ? {
      coachId: team.coach_id,
      assistantId: team.assistant_id,
      managerId: team.manager_id,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
    } : {}),
  };
}

async function hasCurrentAdultApproval(env: Env, userId: string, role: 'coach' | 'admin' | 'dev') {
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

// GET /yjrl/teams
teams.get('/', async (c) => {
  const season = c.req.query('season');
  const active = c.req.query('active');
  let sql = 'SELECT * FROM teams WHERE 1=1';
  const params: unknown[] = [];
  if (season) { sql += ' AND season = ?'; params.push(season); }
  if (active !== 'false') { sql += ' AND is_active = 1'; }
  sql += ' ORDER BY age_group ASC';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(team => publicTeamDto(team)));
});

// GET /yjrl/teams/:id
teams.get('/:id', async (c) => {
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(c.req.param('id')).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);
  const players = await c.env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM players WHERE team_id = ? AND is_active = 1'
  ).bind(team.id).all();
  const t = publicTeamDto(team);
  return c.json({ ...t, playerCount: players.results?.[0]?.cnt || 0, players: [] });
});

// POST /yjrl/teams
teams.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  const coachId = body.coachId || body.coach || body.coach_id || null;
  if (coachId && !(await hasCurrentAdultApproval(c.env, coachId, 'coach'))) {
    return c.json({ error: 'Coach account must have a current approved adult role before team assignment' }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO teams (id, name, age_group, division, season, coach_id, coach_name, assistant_id, assistant_name, manager_id, manager_name, training_day, training_time, training_venue, color_primary, color_secondary, photo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.name, body.ageGroup || body.age_group || '', body.division || '', body.season || new Date().getFullYear().toString(),
    coachId, body.coachName || body.coach_name || '',
    body.assistantId || body.assistant || body.assistant_id || null, body.assistantName || body.assistant_name || '',
    body.managerId || body.manager || body.manager_id || null, body.managerName || body.manager_name || '',
    body.trainingDay || body.training_day || '', body.trainingTime || body.training_time || '',
    body.trainingVenue || body.training_venue || 'Nev Skuse Oval, Yeppoon',
    body.colors?.primary || body.color_primary || '#0c1d35',
    body.colors?.secondary || body.color_secondary || '#f0a500',
    body.photo || ''
  ).run();
  await writeAudit(c.env, c.get('user'), 'team_created', 'team', id, {
    ageGroup: body.ageGroup || body.age_group || '',
    season: body.season || new Date().getFullYear().toString(),
    coachAssigned: !!coachId,
  });
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
  return c.json(publicTeamDto(team!, { includePrivateIds: true }), 201);
});

// PUT /yjrl/teams/:id
teams.put('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const existingTeam = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
  if (!existingTeam) return c.json({ error: 'Team not found' }, 404);
  const fields: string[] = [];
  const vals: unknown[] = [];
  const coachCandidate = body.coachId ?? body.coach_id ?? body.coach;
  if (coachCandidate && !(await hasCurrentAdultApproval(c.env, coachCandidate, 'coach'))) {
    return c.json({ error: 'Coach account must have a current approved adult role before team assignment' }, 400);
  }
  const map: Record<string, string> = {
    name: 'name', ageGroup: 'age_group', age_group: 'age_group', division: 'division', season: 'season',
    coachName: 'coach_name', coach_name: 'coach_name', coachId: 'coach_id', coach_id: 'coach_id',
    assistantName: 'assistant_name', assistant_name: 'assistant_name', assistantId: 'assistant_id', assistant_id: 'assistant_id',
    managerName: 'manager_name', manager_name: 'manager_name', managerId: 'manager_id', manager_id: 'manager_id',
    trainingDay: 'training_day', training_day: 'training_day',
    trainingTime: 'training_time', training_time: 'training_time',
    trainingVenue: 'training_venue', training_venue: 'training_venue',
    photo: 'photo', is_active: 'is_active', isActive: 'is_active',
    wins: 'wins', losses: 'losses', draws: 'draws', byes: 'byes',
    pointsFor: 'points_for', points_for: 'points_for',
    pointsAgainst: 'points_against', points_against: 'points_against',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) {
      fields.push(`${map[k]} = ?`);
      vals.push(map[k].endsWith('_id') ? (v || null) : v);
    }
  }
  if (body.colors) {
    if (body.colors.primary) { fields.push('color_primary = ?'); vals.push(body.colors.primary); }
    if (body.colors.secondary) { fields.push('color_secondary = ?'); vals.push(body.colors.secondary); }
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE teams SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  await writeAudit(c.env, c.get('user'), 'team_updated', 'team', id, {
    name: existingTeam.name,
    fields: Object.keys(body),
    coachChanged: Object.prototype.hasOwnProperty.call(body, 'coachId') || Object.prototype.hasOwnProperty.call(body, 'coach_id') || Object.prototype.hasOwnProperty.call(body, 'coach'),
    previousCoachId: existingTeam.coach_id || null,
    newCoachId: body.coachId ?? body.coach_id ?? body.coach ?? existingTeam.coach_id ?? null,
    previousActive: !!existingTeam.is_active,
    newActive: body.isActive ?? body.is_active ?? !!existingTeam.is_active,
  });
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);
  return c.json(publicTeamDto(team, { includePrivateIds: true }));
});

// DELETE /yjrl/teams/:id (soft delete)
teams.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE teams SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
  await writeAudit(c.env, c.get('user'), 'team_deactivated', 'team', id);
  return c.json({ message: 'Team deactivated' });
});

export default teams;
