import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin, requireCoachOrAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { hasVerifiedParentLink } from '../lib/safeguarding';

const players = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatPlayer(p: Record<string, unknown>, stats?: Record<string, unknown>[], achievements?: Record<string, unknown>[], attendance?: Record<string, unknown>[], options: { includeCoachNotes?: boolean } = {}) {
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
    registrationYear: p.registration_year, playHQId: p.playhq_id,
    ...(options.includeCoachNotes ? { coachNotes: p.coach_notes } : {}),
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

function isAdmin(c: any) {
  const user = c.get('user');
  return user.role === 'admin' || user.role === 'dev';
}

async function coachOwnsTeam(c: any, teamId: unknown) {
  const user = c.get('user');
  if (isAdmin(c)) return true;
  if (user.role !== 'coach' || !teamId) return false;
  const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND coach_id = ? AND is_active = 1').bind(teamId, user.id).first();
  return !!team;
}

async function canReadPlayer(c: any, player: Record<string, unknown>) {
  const user = c.get('user');
  if (isAdmin(c)) return true;
  if (player.user_id === user.id) return true;
  if (await hasVerifiedParentLink(c.env.DB, user, player)) return true;
  return coachOwnsTeam(c, player.team_id);
}

async function canManagePlayer(c: any, player: Record<string, unknown>) {
  if (isAdmin(c)) return true;
  return coachOwnsTeam(c, player.team_id);
}

async function isApprovedPlayerMedia(env: Env, playerId: string, value: string) {
  if (!value) return true;
  const row = await env.DB.prepare(
    `SELECT key FROM upload_records
     WHERE player_id = ?
       AND status = 'approved'
       AND (key = ? OR url = ?)`
  ).bind(playerId, value, value).first();
  return !!row;
}

// GET /yjrl/players
players.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!isAdmin(c) && user.role !== 'coach') return c.json({ error: 'Coach or admin only' }, 403);
  let sql = 'SELECT p.*, t.name AS team_name, t.age_group AS team_age_group FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.is_active = 1';
  const params: unknown[] = [];
  const teamId = c.req.query('teamId');
  const ageGroup = c.req.query('ageGroup');
  const status = c.req.query('status');
  if (teamId) { sql += ' AND p.team_id = ?'; params.push(teamId); }
  if (ageGroup) { sql += ' AND p.age_group = ?'; params.push(ageGroup); }
  if (status) { sql += ' AND p.registration_status = ?'; params.push(status); }
  if (user.role === 'coach' && !isAdmin(c)) { sql += ' AND t.coach_id = ?'; params.push(user.id); }
  sql += ' ORDER BY p.last_name ASC, p.first_name ASC';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(p => ({
    ...p, _id: p.id, firstName: p.first_name, lastName: p.last_name,
    ageGroup: p.age_group, teamId: p.team_id, jerseyNumber: p.jersey_number,
    registrationStatus: p.registration_status,
    team: p.team_name ? { _id: p.team_id, name: p.team_name, ageGroup: p.team_age_group } : null,
  })));
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
    `SELECT p.*, t.name AS team_name, t.age_group AS team_age_group,
            t.training_day AS team_training_day, t.training_time AS team_training_time,
            t.training_venue AS team_training_venue, t.coach_name AS team_coach_name
     FROM players p
     LEFT JOIN teams t ON p.team_id = t.id
     WHERE p.is_active = 1
       AND (
        p.user_id = ?
        OR EXISTS (
          SELECT 1 FROM parent_child_links pcl
          WHERE pcl.player_id = p.id AND pcl.parent_user_id = ? AND pcl.status = 'verified'
        )
       )`
  ).bind(user.id, user.id).all();
  const children = [];
  for (const p of (result.results || [])) {
    const [statsR, attR] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ?').bind(p.id).all(),
      c.env.DB.prepare('SELECT * FROM attendance_records WHERE player_id = ? ORDER BY date DESC LIMIT 20').bind(p.id).all(),
    ]);
    const formatted = formatPlayer(p, statsR.results || [], [], attR.results || []);
    if (p.team_id) {
      formatted.teamId = {
        _id: p.team_id,
        name: p.team_name,
        ageGroup: p.team_age_group,
        trainingDay: p.team_training_day,
        trainingTime: p.team_training_time,
        trainingVenue: p.team_training_venue,
        coachName: p.team_coach_name,
      } as unknown as string;
    }
    children.push(formatted);
  }
  return c.json(children);
});

// GET /yjrl/my-team (coach portal)
players.get('/my-team', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role !== 'coach' && !isAdmin(c)) return c.json({ error: 'Coach only' }, 403);
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
    playersFormatted.push(formatPlayer(p, statsR.results || [], [], attR.results || [], { includeCoachNotes: true }));
  }
  return c.json({ team: teamFormatted, players: playersFormatted });
});

// GET /yjrl/players/:id
players.get('/:id', authMiddleware, async (c) => {
  const p = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(c.req.param('id')).first();
  if (!p) return c.json({ error: 'Player not found' }, 404);
  if (!(await canReadPlayer(c, p))) return c.json({ error: 'Not allowed to view this player' }, 403);
  const [statsR, achR, attR] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ?').bind(p.id).all(),
    c.env.DB.prepare('SELECT a.* FROM achievements a JOIN player_achievements pa ON a.id = pa.achievement_id WHERE pa.player_id = ?').bind(p.id).all(),
    c.env.DB.prepare('SELECT * FROM attendance_records WHERE player_id = ? ORDER BY date DESC').bind(p.id).all(),
  ]);
  return c.json(formatPlayer(
    p,
    statsR.results || [],
    (achR.results || []).map(a => ({ ...a, _id: a.id })),
    attR.results || [],
    { includeCoachNotes: isAdmin(c) || await coachOwnsTeam(c, p.team_id) },
  ));
});

// POST /yjrl/players
players.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  if (body.photo) return c.json({ error: 'Player photos must be uploaded, reviewed, and approved before use' }, 400);
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
  const user = c.get('user');
  if (body.mediaConsent !== undefined || body.agreeToPhotoPolicy !== undefined) {
    const mediaConsent = body.mediaConsent ?? body.agreeToPhotoPolicy;
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO player_consents
       (player_id, media_consent, public_profile_consent, stats_public_consent, consent_source, consent_by_user_id, consent_by_name, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(id, mediaConsent ? 1 : 0, mediaConsent ? 1 : 0, 0, 'admin-player-create', user.id, `${user.firstName} ${user.lastName}`.trim()).run();
  }
  const parentId = body.parentUserId || body.parent_user_id || body.userId || body.user_id;
  if (parentId) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO parent_child_links
       (id, parent_user_id, player_id, relationship, status, source, verified_by_user_id, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), parentId, id, 'guardian', 'verified', 'admin-player-create', user.id).run();
  }
  await writeAudit(c.env, user, 'player_created', 'player', id, { ageGroup: body.ageGroup || body.age_group || '' });
  return c.json({ _id: id, id }, 201);
});

// PUT /yjrl/players/:id (admin or coach only — security fix)
players.put('/:id', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id') || '';
  const existing = await c.env.DB.prepare('SELECT * FROM players WHERE id = ? AND is_active = 1').bind(id).first();
  if (!existing) return c.json({ error: 'Player not found' }, 404);
  if (!(await canManagePlayer(c, existing))) return c.json({ error: 'Not allowed to update this player' }, 403);
  const adminUpdate = isAdmin(c);
  const fields: string[] = [];
  const vals: unknown[] = [];
  const adminMap: Record<string, string> = {
    firstName: 'first_name', first_name: 'first_name', lastName: 'last_name', last_name: 'last_name',
    dateOfBirth: 'date_of_birth', date_of_birth: 'date_of_birth',
    ageGroup: 'age_group', age_group: 'age_group', teamId: 'team_id', team_id: 'team_id',
    position: 'position', jerseyNumber: 'jersey_number', jersey_number: 'jersey_number',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone', guardianEmail: 'guardian_email',
    medicalNotes: 'medical_notes', medical_notes: 'medical_notes',
    registrationStatus: 'registration_status', registration_status: 'registration_status',
    coachNotes: 'coach_notes', coach_notes: 'coach_notes', photo: 'photo',
  };
  const coachMap: Record<string, string> = {
    coachNotes: 'coach_notes',
    coach_notes: 'coach_notes',
    photo: 'photo',
  };
  const map = adminUpdate ? adminMap : coachMap;
  const requestedPhoto = body.photo;
  if (requestedPhoto && !(await isApprovedPlayerMedia(c.env, id, String(requestedPhoto)))) {
    return c.json({ error: 'Player photo must reference an approved reviewed upload for this player' }, 400);
  }
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (body.pathwayProgress && adminUpdate) {
    if (body.pathwayProgress.level) { fields.push('pathway_level = ?'); vals.push(body.pathwayProgress.level); }
    if (body.pathwayProgress.notes !== undefined) { fields.push('pathway_notes = ?'); vals.push(body.pathwayProgress.notes); }
  }
  if (body.emergencyContact && adminUpdate) {
    if (body.emergencyContact.name !== undefined) { fields.push('emergency_name = ?'); vals.push(body.emergencyContact.name); }
    if (body.emergencyContact.phone !== undefined) { fields.push('emergency_phone = ?'); vals.push(body.emergencyContact.phone); }
    if (body.emergencyContact.relationship !== undefined) { fields.push('emergency_relationship = ?'); vals.push(body.emergencyContact.relationship); }
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  if (adminUpdate && (body.mediaConsent !== undefined || body.publicProfileConsent !== undefined || body.statsPublicConsent !== undefined)) {
    const user = c.get('user');
    await c.env.DB.prepare(
      `INSERT INTO player_consents
       (player_id, media_consent, public_profile_consent, stats_public_consent, consent_source, consent_by_user_id, consent_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET
        media_consent = excluded.media_consent,
        public_profile_consent = excluded.public_profile_consent,
        stats_public_consent = excluded.stats_public_consent,
        consent_source = excluded.consent_source,
        consent_by_user_id = excluded.consent_by_user_id,
        consent_by_name = excluded.consent_by_name,
        updated_at = datetime('now')`
    ).bind(
      id,
      body.mediaConsent ? 1 : 0,
      body.publicProfileConsent ? 1 : 0,
      body.statsPublicConsent ? 1 : 0,
      'admin-player-update',
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
    ).run();
  }
  await writeAudit(c.env, c.get('user'), 'player_updated', 'player', id, { adminUpdate, fields: Object.keys(body) });
  const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (!player) return c.json({ error: 'Player not found' }, 404);
  return c.json({ ...player, _id: player.id });
});

// POST /yjrl/players/:id/attendance
players.post('/:id/attendance', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);
  const body = await c.req.json();
  const playerId = c.req.param('id');
  const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ? AND is_active = 1').bind(playerId).first();
  if (!player) return c.json({ error: 'Player not found' }, 404);
  if (!(await canManagePlayer(c, player))) return c.json({ error: 'Not allowed to record attendance for this player' }, 403);
  await c.env.DB.prepare(
    'INSERT INTO attendance_records (player_id, date, type, attended, notes) VALUES (?, ?, ?, ?, ?)'
  ).bind(playerId, body.date, body.type, body.attended ? 1 : 0, body.notes || '').run();
  return c.json({ message: 'Attendance recorded' });
});

// POST /yjrl/teams/:teamId/attendance (bulk)
players.post('/teams/:teamId/attendance', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);
  const body = await c.req.json();
  const { date, type, records } = body;
  const teamId = c.req.param('teamId');
  if (!(await coachOwnsTeam(c, teamId))) return c.json({ error: 'Not allowed to record attendance for this team' }, 403);
  if (!Array.isArray(records) || records.length === 0) return c.json({ error: 'No attendance records provided' }, 400);
  const playerIds = (records as { playerId: string }[]).map(r => r.playerId).filter(Boolean);
  if (playerIds.length !== records.length) return c.json({ error: 'Every attendance record must include a playerId' }, 400);
  const placeholders = playerIds.map(() => '?').join(',');
  const validPlayers = await c.env.DB.prepare(
    `SELECT id FROM players WHERE team_id = ? AND is_active = 1 AND id IN (${placeholders})`
  ).bind(teamId, ...playerIds).all();
  const validIds = new Set((validPlayers.results || []).map(row => row.id));
  if (validIds.size !== playerIds.length) return c.json({ error: 'Attendance includes players outside this team' }, 400);
  const stmt = c.env.DB.prepare(
    'INSERT INTO attendance_records (player_id, date, type, attended, notes) VALUES (?, ?, ?, ?, ?)'
  );
  const batch = (records as { playerId: string; attended: boolean; notes?: string }[]).map(r =>
    stmt.bind(r.playerId, date, type, r.attended ? 1 : 0, r.notes || '')
  );
  await c.env.DB.batch(batch);
  await writeAudit(c.env, c.get('user'), 'attendance_bulk_recorded', 'team', teamId, { date, type, count: records.length });
  return c.json({ message: `Attendance recorded for ${records.length} players` });
});

// POST /yjrl/players/:id/achievements
players.post('/:id/achievements', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);
  const body = await c.req.json();
  const playerId = c.req.param('id');
  const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ? AND is_active = 1').bind(playerId).first();
  if (!player) return c.json({ error: 'Player not found' }, 404);
  if (!(await canManagePlayer(c, player))) return c.json({ error: 'Not allowed to award achievements for this player' }, 403);
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
