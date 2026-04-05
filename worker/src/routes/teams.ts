import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const teams = new Hono<{ Bindings: Env; Variables: Variables }>();

function addVirtuals(team: Record<string, unknown>) {
  const wins = (team.wins as number) || 0;
  const losses = (team.losses as number) || 0;
  const draws = (team.draws as number) || 0;
  return {
    ...team,
    _id: team.id,
    played: wins + losses + draws,
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
  };
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
  return c.json((result.results || []).map(addVirtuals));
});

// GET /yjrl/teams/:id
teams.get('/:id', async (c) => {
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(c.req.param('id')).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);
  const players = await c.env.DB.prepare(
    'SELECT id, first_name, last_name, jersey_number, position, photo FROM players WHERE team_id = ? AND is_active = 1'
  ).bind(team.id).all();
  const t = addVirtuals(team);
  return c.json({ ...t, players: (players.results || []).map(p => ({ ...p, _id: p.id, firstName: p.first_name, lastName: p.last_name, jerseyNumber: p.jersey_number })) });
});

// POST /yjrl/teams
teams.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO teams (id, name, age_group, division, season, coach_id, coach_name, assistant_id, assistant_name, manager_id, manager_name, training_day, training_time, training_venue, color_primary, color_secondary, photo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.name, body.ageGroup || body.age_group || '', body.division || '', body.season || new Date().getFullYear().toString(),
    body.coach || body.coach_id || null, body.coachName || body.coach_name || '',
    body.assistant || body.assistant_id || null, body.assistantName || body.assistant_name || '',
    body.manager || body.manager_id || null, body.managerName || body.manager_name || '',
    body.trainingDay || body.training_day || '', body.trainingTime || body.training_time || '',
    body.trainingVenue || body.training_venue || 'Nev Skuse Oval, Yeppoon',
    body.colors?.primary || body.color_primary || '#0c1d35',
    body.colors?.secondary || body.color_secondary || '#f0a500',
    body.photo || ''
  ).run();
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
  return c.json(addVirtuals(team!), 201);
});

// PUT /yjrl/teams/:id
teams.put('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    name: 'name', ageGroup: 'age_group', age_group: 'age_group', division: 'division', season: 'season',
    coachName: 'coach_name', coach_name: 'coach_name', coach_id: 'coach_id',
    assistantName: 'assistant_name', assistant_name: 'assistant_name', assistant_id: 'assistant_id',
    managerName: 'manager_name', manager_name: 'manager_name', manager_id: 'manager_id',
    trainingDay: 'training_day', training_day: 'training_day',
    trainingTime: 'training_time', training_time: 'training_time',
    trainingVenue: 'training_venue', training_venue: 'training_venue',
    photo: 'photo', is_active: 'is_active', isActive: 'is_active',
    wins: 'wins', losses: 'losses', draws: 'draws', byes: 'byes',
    pointsFor: 'points_for', points_for: 'points_for',
    pointsAgainst: 'points_against', points_against: 'points_against',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (body.colors) {
    if (body.colors.primary) { fields.push('color_primary = ?'); vals.push(body.colors.primary); }
    if (body.colors.secondary) { fields.push('color_secondary = ?'); vals.push(body.colors.secondary); }
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE teams SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);
  return c.json(addVirtuals(team));
});

// DELETE /yjrl/teams/:id (soft delete)
teams.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE teams SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Team deactivated' });
});

export default teams;
