import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

const fixtures = new Hono<{ Bindings: Env; Variables: Variables }>();

function isAdmin(c: any) {
  const user = c.get('user');
  return user.role === 'admin' || user.role === 'dev';
}

async function canManageFixture(c: any, fixture: Record<string, unknown>) {
  if (isAdmin(c)) return true;
  const user = c.get('user');
  if (user.role !== 'coach' || !fixture.team_id) return false;
  const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND coach_id = ? AND is_active = 1').bind(fixture.team_id, user.id).first();
  return !!team;
}

function formatFixture(f: Record<string, unknown>, options: { includePrivate?: boolean } = {}) {
  const isHome = !!f.is_home_game;
  const status = f.status as string;
  let result: string | null = null;
  if (status === 'completed') {
    const yjrlScore = isHome ? (f.home_score as number) : (f.away_score as number);
    const oppScore = isHome ? (f.away_score as number) : (f.home_score as number);
    if (yjrlScore > oppScore) result = 'win';
    else if (yjrlScore < oppScore) result = 'loss';
    else result = 'draw';
  }
  const dto: Record<string, unknown> = {
    _id: f.id,
    id: f.id,
    teamId: f.team_id, ageGroup: f.age_group,
    season: f.season,
    round: f.round,
    homeTeamName: f.home_team_name, awayTeamName: f.away_team_name,
    isHomeGame: isHome, homeScore: f.home_score, awayScore: f.away_score,
    date: f.date,
    time: f.time,
    venue: f.venue,
    status: f.status,
    notes: f.notes,
    isActive: !!f.is_active,
    opponent: isHome ? f.away_team_name : f.home_team_name,
    result,
  };
  if (options.includePrivate) {
    dto.manOfMatch = f.man_of_match_id;
    dto.manOfMatchName = f.man_of_match_name;
    dto.matchReport = f.match_report;
    dto.createdAt = f.created_at;
    dto.updatedAt = f.updated_at;
  }
  return dto;
}

// GET /yjrl/fixtures
fixtures.get('/', async (c) => {
  let sql = 'SELECT * FROM fixtures WHERE is_active = 1';
  const params: unknown[] = [];
  const ageGroup = c.req.query('ageGroup');
  const season = c.req.query('season');
  const status = c.req.query('status');
  const teamId = c.req.query('teamId');
  const upcoming = c.req.query('upcoming');
  const limit = c.req.query('limit');
  if (ageGroup) { sql += ' AND age_group = ?'; params.push(ageGroup); }
  if (season) { sql += ' AND season = ?'; params.push(season); }
  if (teamId) { sql += ' AND team_id = ?'; params.push(teamId); }
  if (upcoming === 'true') {
    sql += ' AND date >= ? AND status = ?';
    params.push(new Date().toISOString().split('T')[0]);
    params.push('scheduled');
  } else if (status) {
    sql += ' AND status = ?'; params.push(status);
  }
  sql += upcoming === 'true' ? ' ORDER BY date ASC' : ' ORDER BY date DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map((fixture) => formatFixture(fixture)));
});

// GET /yjrl/ladder
fixtures.get('/ladder', async (c) => {
  const season = c.req.query('season') || new Date().getFullYear().toString();
  const ageGroup = c.req.query('ageGroup');
  let sql = `SELECT *, (wins * 2 + draws) AS points, (wins + losses + draws) AS played,
             (points_for - points_against) AS points_diff
             FROM teams WHERE is_active = 1 AND season = ?`;
  const params: unknown[] = [season];
  if (ageGroup) { sql += ' AND age_group = ?'; params.push(ageGroup); }
  sql += ' ORDER BY (wins * 2 + draws) DESC, (points_for - points_against) DESC, wins DESC';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(t => ({
    _id: t.id, id: t.id, name: t.name, ageGroup: t.age_group, season: t.season,
    wins: t.wins, losses: t.losses, draws: t.draws, points: t.points,
    pointsFor: t.points_for, pointsAgainst: t.points_against,
    pointsDiff: t.points_diff, coachName: t.coach_name,
    colors: { primary: t.color_primary, secondary: t.color_secondary },
  })));
});

// GET /yjrl/fixtures/:id
fixtures.get('/:id', async (c) => {
  const f = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ?').bind(c.req.param('id')).first();
  if (!f) return c.json({ error: 'Fixture not found' }, 404);
  const formatted = formatFixture(f);
  return c.json({
    ...formatted,
    playerStats: [],
    playerStatsHidden: true,
  });
});

// POST /yjrl/fixtures
fixtures.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO fixtures (id, team_id, age_group, season, round, home_team_name, away_team_name, is_home_game, date, time, venue, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.teamId || body.team_id || null, body.ageGroup || body.age_group,
    body.season || new Date().getFullYear().toString(), body.round,
    body.homeTeamName || body.home_team_name, body.awayTeamName || body.away_team_name,
    body.isHomeGame !== false ? 1 : 0, body.date, body.time || '',
    body.venue || 'Nev Skuse Oval, Yeppoon', body.status || 'scheduled', body.notes || ''
  ).run();
  await writeAudit(c.env, c.get('user'), 'fixture_created', 'fixture', id, {
    teamId: body.teamId || body.team_id || null,
    ageGroup: body.ageGroup || body.age_group || '',
    status: body.status || 'scheduled',
  });
  const fixture = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ?').bind(id).first();
  return c.json(formatFixture(fixture!, { includePrivate: true }), 201);
});

// PUT /yjrl/fixtures/:id — update or enter result
fixtures.put('/:id', authMiddleware, async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ? AND is_active = 1').bind(id).first();
  if (!existing) return c.json({ error: 'Fixture not found' }, 404);
  if (!(await canManageFixture(c, existing))) return c.json({ error: 'Not allowed to update this fixture' }, 403);

  // Build dynamic update
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    ageGroup: 'age_group', age_group: 'age_group', season: 'season', round: 'round',
    homeTeamName: 'home_team_name', home_team_name: 'home_team_name',
    awayTeamName: 'away_team_name', away_team_name: 'away_team_name',
    isHomeGame: 'is_home_game', is_home_game: 'is_home_game',
    date: 'date', time: 'time', venue: 'venue', status: 'status',
    homeScore: 'home_score', home_score: 'home_score',
    awayScore: 'away_score', away_score: 'away_score',
    manOfMatchName: 'man_of_match_name', man_of_match_name: 'man_of_match_name',
    manOfMatch: 'man_of_match_id', man_of_match_id: 'man_of_match_id',
    matchReport: 'match_report', match_report: 'match_report', notes: 'notes',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (fields.length > 0) {
    fields.push('updated_at = datetime(\'now\')');
    vals.push(id);
    await c.env.DB.prepare(`UPDATE fixtures SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
    await writeAudit(c.env, c.get('user'), 'fixture_updated', 'fixture', id, {
      fields: Object.keys(body),
      wasCompleted: existing.status === 'completed',
      status: body.status || existing.status,
    });
  }

  const fixture = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ?').bind(id).first();
  if (!fixture) return c.json({ error: 'Fixture not found' }, 404);

  // If completing a fixture, update team record and player stats
  if (body.status === 'completed' && fixture.team_id && existing.status !== 'completed') {
    const isHome = !!fixture.is_home_game;
    const homeScore = (body.homeScore ?? body.home_score ?? fixture.home_score ?? 0) as number;
    const awayScore = (body.awayScore ?? body.away_score ?? fixture.away_score ?? 0) as number;
    const yjrlScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const result = yjrlScore > oppScore ? 'win' : yjrlScore < oppScore ? 'loss' : 'draw';

    await c.env.DB.prepare(
      `UPDATE teams SET
        points_for = points_for + ?, points_against = points_against + ?,
        wins = wins + ?, losses = losses + ?, draws = draws + ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      isHome ? homeScore : awayScore, isHome ? awayScore : homeScore,
      result === 'win' ? 1 : 0, result === 'loss' ? 1 : 0, result === 'draw' ? 1 : 0,
      fixture.team_id
    ).run();

    // Update player stats from fixture
    const season = (fixture.season || new Date().getFullYear().toString()) as string;
    const playerStats = body.playerStats || [];
    const affectedPlayerIds: string[] = [];
    const skippedPlayerIds: string[] = [];
    for (const stat of playerStats) {
      const playerId = stat.player || stat.playerId || stat.player_id;
      if (!playerId) {
        skippedPlayerIds.push('missing-player-id');
        continue;
      }
      const teamPlayer = await c.env.DB.prepare(
        'SELECT id FROM players WHERE id = ? AND team_id = ? AND is_active = 1'
      ).bind(playerId, fixture.team_id).first();
      if (!teamPlayer) {
        skippedPlayerIds.push(String(playerId));
        continue;
      }
      affectedPlayerIds.push(String(playerId));

      // Save fixture player stats
      await c.env.DB.prepare(
        'INSERT INTO fixture_player_stats (fixture_id, player_id, player_name, tries, goals, field_goals, tackles, run_metres, played) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, playerId, stat.playerName || stat.player_name || '', stat.tries || 0, stat.goals || 0, stat.fieldGoals || stat.field_goals || 0, stat.tackles || 0, stat.runMetres || stat.run_metres || 0, stat.played !== false ? 1 : 0).run();

      // Upsert season stats
      const existing = await c.env.DB.prepare('SELECT * FROM player_stats WHERE player_id = ? AND season = ?').bind(playerId, season).first();
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE player_stats SET games_played = games_played + ?, tries = tries + ?, goals = goals + ?, field_goals = field_goals + ?, tackles = tackles + ?, run_metres = run_metres + ? WHERE player_id = ? AND season = ?`
        ).bind(stat.played !== false ? 1 : 0, stat.tries || 0, stat.goals || 0, stat.fieldGoals || stat.field_goals || 0, stat.tackles || 0, stat.runMetres || stat.run_metres || 0, playerId, season).run();
      } else {
        await c.env.DB.prepare(
          'INSERT INTO player_stats (player_id, season, games_played, tries, goals, field_goals, tackles, run_metres) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(playerId, season, stat.played !== false ? 1 : 0, stat.tries || 0, stat.goals || 0, stat.fieldGoals || stat.field_goals || 0, stat.tackles || 0, stat.runMetres || stat.run_metres || 0).run();
      }
    }
    await writeAudit(c.env, c.get('user'), 'fixture_completed', 'fixture', id, {
      teamId: fixture.team_id,
      result,
      homeScore,
      awayScore,
      playerStatsCount: playerStats.length,
      affectedPlayerIds,
      skippedPlayerIds,
    });
  }

  return c.json(formatFixture(fixture, { includePrivate: true }));
});

// DELETE /yjrl/fixtures/:id
fixtures.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE fixtures SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
  await writeAudit(c.env, c.get('user'), 'fixture_removed', 'fixture', id);
  return c.json({ message: 'Fixture removed' });
});

export default fixtures;
