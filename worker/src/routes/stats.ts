import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const stats = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /yjrl/stats/overview
stats.get('/overview', async (c) => {
  const season = c.req.query('season') || new Date().getFullYear().toString();
  const [teamCount, playerCount, fixtureCount, upcomingCount] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM teams WHERE is_active = 1 AND season = ?').bind(season).first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM players WHERE is_active = 1 AND registration_status = ? AND registration_year = ?').bind('active', season).first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM fixtures WHERE is_active = 1 AND season = ? AND status = ?').bind(season, 'completed').first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM fixtures WHERE is_active = 1 AND season = ? AND status = ? AND date >= ?').bind(season, 'scheduled', new Date().toISOString().split('T')[0]).first(),
  ]);

  // Top try scorers
  const topScorers = await c.env.DB.prepare(
    `SELECT ps.tries, ps.season, p.id, p.first_name, p.last_name, p.age_group, p.photo, p.team_id,
            t.name AS team_name, t.age_group AS team_age_group
     FROM player_stats ps
     JOIN players p ON ps.player_id = p.id
     LEFT JOIN teams t ON p.team_id = t.id
     WHERE ps.season = ? AND ps.tries > 0 AND p.is_active = 1
     ORDER BY ps.tries DESC LIMIT 5`
  ).bind(season).all();

  return c.json({
    teamCount: (teamCount as Record<string, unknown>)?.cnt || 0,
    playerCount: (playerCount as Record<string, unknown>)?.cnt || 0,
    fixtureCount: (fixtureCount as Record<string, unknown>)?.cnt || 0,
    upcomingCount: (upcomingCount as Record<string, unknown>)?.cnt || 0,
    topScorers: (topScorers.results || []).map(s => ({
      _id: s.id, firstName: s.first_name, lastName: s.last_name,
      ageGroup: s.age_group, photo: s.photo, tries: s.tries,
      teamId: s.team_id ? { _id: s.team_id, name: s.team_name, ageGroup: s.team_age_group } : null,
    })),
  });
});

// GET /yjrl/stats/leaderboard
stats.get('/leaderboard', async (c) => {
  const season = c.req.query('season') || new Date().getFullYear().toString();
  const ageGroup = c.req.query('ageGroup');
  const stat = c.req.query('stat') || 'tries';
  const validStats = ['tries', 'goals', 'tackles', 'run_metres', 'games_played'];
  const statCol = validStats.includes(stat) ? stat : stat === 'runMetres' ? 'run_metres' : stat === 'gamesPlayed' ? 'games_played' : 'tries';

  let sql = `SELECT ps.*, p.id AS pid, p.first_name, p.last_name, p.age_group, p.photo, p.jersey_number, p.team_id,
             t.name AS team_name
             FROM player_stats ps
             JOIN players p ON ps.player_id = p.id
             LEFT JOIN teams t ON p.team_id = t.id
             WHERE ps.season = ? AND p.is_active = 1 AND ps.${statCol} > 0`;
  const params: unknown[] = [season];
  if (ageGroup) { sql += ' AND p.age_group = ?'; params.push(ageGroup); }
  sql += ` ORDER BY ps.${statCol} DESC LIMIT 20`;

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(r => ({
    _id: r.pid, firstName: r.first_name, lastName: r.last_name,
    ageGroup: r.age_group, photo: r.photo, jerseyNumber: r.jersey_number,
    value: r[statCol], teamId: r.team_id ? { _id: r.team_id, name: r.team_name } : null,
  })));
});

export default stats;
