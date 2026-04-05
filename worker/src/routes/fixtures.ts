import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const fixtures = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatFixture(f: Record<string, unknown>) {
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
  return {
    ...f, _id: f.id,
    teamId: f.team_id, ageGroup: f.age_group,
    homeTeamName: f.home_team_name, awayTeamName: f.away_team_name,
    isHomeGame: isHome, homeScore: f.home_score, awayScore: f.away_score,
    manOfMatch: f.man_of_match_id, manOfMatchName: f.man_of_match_name,
    matchReport: f.match_report, isActive: !!f.is_active,
    opponent: isHome ? f.away_team_name : f.home_team_name,
    result,
  };
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
  return c.json((result.results || []).map(formatFixture));
});

// GET /yjrl/fixtures/:id
fixtures.get('/:id', async (c) => {
  const f = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ?').bind(c.req.param('id')).first();
  if (!f) return c.json({ error: 'Fixture not found' }, 404);
  const statsR = await c.env.DB.prepare('SELECT * FROM fixture_player_stats WHERE fixture_id = ?').bind(f.id).all();
  const formatted = formatFixture(f);
  return c.json({
    ...formatted,
    playerStats: (statsR.results || []).map(s => ({
      player: s.player_id, playerName: s.player_name,
      tries: s.tries, goals: s.goals, fieldGoals: s.field_goals,
      tackles: s.tackles, runMetres: s.run_metres, played: !!s.played,
    })),
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
  const fixture = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ?').bind(id).first();
  return c.json(formatFixture(fixture!), 201);
});

// PUT /yjrl/fixtures/:id — update or enter result
fixtures.put('/:id', authMiddleware, async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');

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
  }

  const fixture = await c.env.DB.prepare('SELECT * FROM fixtures WHERE id = ?').bind(id).first();
  if (!fixture) return c.json({ error: 'Fixture not found' }, 404);

  // If completing a fixture, update team record and player stats
  if (body.status === 'completed' && fixture.team_id) {
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
    for (const stat of playerStats) {
      const playerId = stat.player || stat.playerId || stat.player_id;
      if (!playerId) continue;

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
  }

  return c.json(formatFixture(fixture));
});

// DELETE /yjrl/fixtures/:id
fixtures.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE fixtures SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Fixture removed' });
});

// GET /yjrl/ladder — FIXED: real standings computation
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
    ...t, _id: t.id, ageGroup: t.age_group, pointsFor: t.points_for, pointsAgainst: t.points_against,
    pointsDiff: t.points_diff, coachName: t.coach_name,
    colors: { primary: t.color_primary, secondary: t.color_secondary },
  })));
});

export default fixtures;
