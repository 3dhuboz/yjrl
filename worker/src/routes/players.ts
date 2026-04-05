import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin, requireCoachOrAdmin } from '../middleware/auth';

const players = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatPlayer(p: Record<string, unknown>, stats?: Record<string, unknown>[], achievements?: Record<string, unknown>[], attendance?: Record<string, unknown>[]) {
  const season = new Date().getFullYear().toString();
  const currentStats = stats?.find(s => s.season === season) || { season, gamesPlayed: 0, tries: 0, goals: 0, fieldGoals: 0, tackles: 0, runMetres: 0, manOfMatch: 0 };
  const total = attendance?.length || 0;
  const attended = attendance?.filter(a => a.attended)?.length || 0;
  return {
    ...p, _id: p.id,
    firstName: p.first_name, lastName: p.last_name, dateOfBirth: p.date_of_birth,
    ageGroup: p.age_group, teamId: p.team_id, jerseyNumber: p.jersey_number,
    guardianName: p.guardian_name, guardianPhone: p.guardian_phone, guardianEmail: p.guardian_email,
    emergencyContact: { name: p.emergency_name, phone: p.emergency_phone, relationship: p.emergency_relationship },
    medicalNotes: p.medical_notes, registrationStatus: p.registration_status,
    registrationYear: p.registration_year, playHQId: p.playhq_id, coachNotes: p.coach_notes,
    pathwayProgress: { level: p.pathway_level, notes: p.pathway_notes },
    isActive: !!p.is_active,
    stats: stats?.map(s => ({ ...s, gamesPlayed: s.games_played, fieldGoals: s.field_goals, runMetres: s.run_metres, manOfMatch: s.man_of_match })) || [],
    currentStats: { ...(currentStats as Record<string, unknown>), gamesPlayed: (currentStats as Record<string, unknown>).games_played || (currentStats as Record<string, unknown>).gamesPlayed || 0, fieldGoals: (currentStats as Record<string, unknown>).field_goals || (currentStats as Record<string, unknown>).fieldGoals || 0, runMetres: (currentStats as Record<string, unknown>).run_metres || (currentStats as Record<string, unknown>).runMetres || 0, manOfMatch: (currentStats as Record<string, unknown>).man_of_match || (currentStats as Record<string, unknown>).manOfMatch || 0 },
    achievements: achievements || [],
    attendanceRecords: attendance?.map(a => ({ date: a.date, type: a.type, attended: !!a.attended, notes: a.notes })) || [],
    attendanceRate: total > 0 ? Math.round((attended / total) * 100) : 100,
    fullName: `${p.first_name} ${p.last_name}`,
  };
}

// GET /yjrl/players
players.get('/', authMiddleware, async (c) => {
  let sql = 'SELECT p.*, t.name AS team_name, t.age_group AS team_age_group FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.is_active = 1';
  const params: unknown[] = [];
  const teamId = c.req.query('teamId');
  const ageGroup = c.req.query('ageGroup');
  const status = c.req.query('status');
  if (teamId) { sql += ' AND p.team_id = ?'; params.push(teamId); }
  if (ageGroup) { sql += ' AND p.age_group = ?'; params.push(ageGroup); }
  if (status) { sql += ' AND p.registration_status = ?'; params.push(status); }
  sql += ' ORDER BY p.last_name ASC, p.first_name ASC';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(p => ({
    ...p, _id: p.id, firstName: p.first_name, lastName: p.last_name,
    ageGroup: p.age_group, teamId: p.team_id, jerseyNumber: p.jersey_number,
    registrationStatus: p.registration_status,
    team: p.team_name ? { _id: p.team_id, name: p.team_name, ageGroup: p.team_age_group } : null,
  })));
});

// GET /yjrl/players/:id
players.get('/:id', authMiddleware, async (c) => {
  const p = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(c.req.param('id')).first();
  if (!p) return c.json({ error: 'Player not found' }, 404);
  const [statsR, achR, attR] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ?').bind(p.id).all(),
    c.env.DB.prepare('SELECT a.* FROM achievements a JOIN player_achievements pa ON a.id = pa.achievement_id WHERE pa.player_id = ?').bind(p.id).all(),
    c.env.DB.prepare('SELECT * FROM attendance_records WHERE player_id = ? ORDER BY date DESC').bind(p.id).all(),
  ]);
  return c.json(formatPlayer(p, statsR.results || [], (achR.results || []).map(a => ({ ...a, _id: a.id })), attR.results || []));
});

// GET /yjrl/my-player
players.get('/my-player', authMiddleware, async (c) => {
  // This route must be registered BEFORE /:id to avoid conflict — handled in index.ts by mounting order
  const user = c.get('user');
  const p = await c.env.DB.prepare('SELECT * FROM players WHERE user_id = ? AND is_active = 1').bind(user.id).first();
  if (!p) return c.json({ error: 'No player profile linked to this account' }, 404);
  const [statsR, achR, attR, teamR] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ?').bind(p.id).all(),
    c.env.DB.prepare('SELECT a.*, pa.awarded_at, pa.season AS award_season, pa.notes AS award_notes FROM achievements a JOIN player_achievements pa ON a.id = pa.achievement_id WHERE pa.player_id = ?').bind(p.id).all(),
    c.env.DB.prepare('SELECT * FROM attendance_records WHERE player_id = ? ORDER BY date DESC LIMIT 30').bind(p.id).all(),
    p.team_id ? c.env.DB.prepare('SELECT id, name, age_group, training_day, training_time, training_venue, coach_name FROM teams WHERE id = ?').bind(p.team_id).first() : null,
  ]);
  const formatted = formatPlayer(p, statsR.results || [], (achR.results || []).map(a => ({ ...a, _id: a.id })), attR.results || []);
  if (teamR) {
    formatted.teamId = { _id: teamR.id, name: teamR.name, ageGroup: teamR.age_group, trainingDay: teamR.training_day, trainingTime: teamR.training_time, trainingVenue: teamR.training_venue, coachName: teamR.coach_name } as unknown as string;
  }
  return c.json(formatted);
});

// GET /yjrl/my-children (parent portal)
players.get('/my-children', authMiddleware, async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT p.*, t.name AS team_name, t.age_group AS team_age_group FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.guardian_email = ? AND p.is_active = 1'
  ).bind(user.email).all();
  const children = [];
  for (const p of (result.results || [])) {
    const [statsR, attR] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ?').bind(p.id).all(),
      c.env.DB.prepare('SELECT * FROM attendance_records WHERE player_id = ? ORDER BY date DESC LIMIT 20').bind(p.id).all(),
    ]);
    children.push(formatPlayer(p, statsR.results || [], [], attR.results || []));
  }
  return c.json(children);
});

// GET /yjrl/my-team (coach portal)
players.get('/my-team', authMiddleware, async (c) => {
  const user = c.get('user');
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE coach_id = ? AND is_active = 1').bind(user.id).first();
  if (!team) return c.json({ error: 'No team assigned' }, 404);
  const playersR = await c.env.DB.prepare(
    'SELECT * FROM players WHERE team_id = ? AND is_active = 1 ORDER BY last_name ASC'
  ).bind(team.id).all();
  const teamFormatted = {
    ...team, _id: team.id, ageGroup: team.age_group, coachName: team.coach_name,
    trainingDay: team.training_day, trainingTime: team.training_time, trainingVenue: team.training_venue,
    pointsFor: team.points_for, pointsAgainst: team.points_against,
    colors: { primary: team.color_primary, secondary: team.color_secondary },
  };
  const playersFormatted = [];
  for (const p of (playersR.results || [])) {
    const [statsR, attR] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ?').bind(p.id).all(),
      c.env.DB.prepare('SELECT * FROM attendance_records WHERE player_id = ? ORDER BY date DESC LIMIT 20').bind(p.id).all(),
    ]);
    playersFormatted.push(formatPlayer(p, statsR.results || [], [], attR.results || []));
  }
  return c.json({ team: teamFormatted, players: playersFormatted });
});

// POST /yjrl/players
players.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO players (id, user_id, first_name, last_name, date_of_birth, age_group, team_id, position, jersey_number, guardian_name, guardian_phone, guardian_email, emergency_name, emergency_phone, emergency_relationship, medical_notes, registration_status, registration_year, playhq_id, coach_notes, pathway_level, pathway_notes, photo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.userId || body.user_id || null, body.firstName || body.first_name,
    body.lastName || body.last_name, body.dateOfBirth || body.date_of_birth || null,
    body.ageGroup || body.age_group || '', body.teamId || body.team_id || null,
    body.position || '', body.jerseyNumber || body.jersey_number || null,
    body.guardianName || body.guardian_name || '', body.guardianPhone || body.guardian_phone || '',
    body.guardianEmail || body.guardian_email || '',
    body.emergencyContact?.name || body.emergency_name || '',
    body.emergencyContact?.phone || body.emergency_phone || '',
    body.emergencyContact?.relationship || body.emergency_relationship || '',
    body.medicalNotes || body.medical_notes || '',
    body.registrationStatus || body.registration_status || 'pending',
    body.registrationYear || body.registration_year || new Date().getFullYear().toString(),
    body.playHQId || body.playhq_id || '', body.coachNotes || body.coach_notes || '',
    body.pathwayProgress?.level || body.pathway_level || 'grassroots',
    body.pathwayProgress?.notes || body.pathway_notes || '', body.photo || ''
  ).run();
  return c.json({ _id: id, id }, 201);
});

// PUT /yjrl/players/:id (admin or coach only — security fix)
players.put('/:id', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    firstName: 'first_name', first_name: 'first_name', lastName: 'last_name', last_name: 'last_name',
    dateOfBirth: 'date_of_birth', date_of_birth: 'date_of_birth',
    ageGroup: 'age_group', age_group: 'age_group', teamId: 'team_id', team_id: 'team_id',
    position: 'position', jerseyNumber: 'jersey_number', jersey_number: 'jersey_number',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone', guardianEmail: 'guardian_email',
    medicalNotes: 'medical_notes', medical_notes: 'medical_notes',
    registrationStatus: 'registration_status', registration_status: 'registration_status',
    coachNotes: 'coach_notes', coach_notes: 'coach_notes', photo: 'photo',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (body.pathwayProgress) {
    if (body.pathwayProgress.level) { fields.push('pathway_level = ?'); vals.push(body.pathwayProgress.level); }
    if (body.pathwayProgress.notes !== undefined) { fields.push('pathway_notes = ?'); vals.push(body.pathwayProgress.notes); }
  }
  if (body.emergencyContact) {
    if (body.emergencyContact.name !== undefined) { fields.push('emergency_name = ?'); vals.push(body.emergencyContact.name); }
    if (body.emergencyContact.phone !== undefined) { fields.push('emergency_phone = ?'); vals.push(body.emergencyContact.phone); }
    if (body.emergencyContact.relationship !== undefined) { fields.push('emergency_relationship = ?'); vals.push(body.emergencyContact.relationship); }
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (!player) return c.json({ error: 'Player not found' }, 404);
  return c.json({ ...player, _id: player.id });
});

// POST /yjrl/players/:id/attendance
players.post('/:id/attendance', authMiddleware, async (c) => {
  const body = await c.req.json();
  const playerId = c.req.param('id');
  await c.env.DB.prepare(
    'INSERT INTO attendance_records (player_id, date, type, attended, notes) VALUES (?, ?, ?, ?, ?)'
  ).bind(playerId, body.date, body.type, body.attended ? 1 : 0, body.notes || '').run();
  return c.json({ message: 'Attendance recorded' });
});

// POST /yjrl/teams/:teamId/attendance (bulk)
players.post('/teams/:teamId/attendance', authMiddleware, async (c) => {
  const body = await c.req.json();
  const { date, type, records } = body;
  const stmt = c.env.DB.prepare(
    'INSERT INTO attendance_records (player_id, date, type, attended, notes) VALUES (?, ?, ?, ?, ?)'
  );
  const batch = (records as { playerId: string; attended: boolean; notes?: string }[]).map(r =>
    stmt.bind(r.playerId, date, type, r.attended ? 1 : 0, r.notes || '')
  );
  await c.env.DB.batch(batch);
  return c.json({ message: `Attendance recorded for ${records.length} players` });
});

// POST /yjrl/players/:id/achievements
players.post('/:id/achievements', authMiddleware, async (c) => {
  const body = await c.req.json();
  const playerId = c.req.param('id');
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO player_achievements (player_id, achievement_id, season, notes) VALUES (?, ?, ?, ?)'
  ).bind(playerId, body.achievementId, body.season || '', body.notes || '').run();
  // Return updated achievements
  const achR = await c.env.DB.prepare(
    'SELECT a.* FROM achievements a JOIN player_achievements pa ON a.id = pa.achievement_id WHERE pa.player_id = ?'
  ).bind(playerId).all();
  return c.json({ achievements: (achR.results || []).map(a => ({ ...a, _id: a.id })) });
});

export default players;
