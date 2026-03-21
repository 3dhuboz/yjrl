const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const YJRLTeam = require('../models/YJRLTeam');
const YJRLPlayer = require('../models/YJRLPlayer');
const YJRLFixture = require('../models/YJRLFixture');
const YJRLNews = require('../models/YJRLNews');
const YJRLEvent = require('../models/YJRLEvent');
const YJRLAchievement = require('../models/YJRLAchievement');

// ─── TEAMS ────────────────────────────────────────────────────────────────────

// GET all teams (public)
router.get('/teams', async (req, res) => {
  try {
    const { season, active } = req.query;
    const filter = {};
    if (season) filter.season = season;
    if (active !== 'false') filter.isActive = true;
    const teams = await YJRLTeam.find(filter).sort({ ageGroup: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single team with players (public)
router.get('/teams/:id', async (req, res) => {
  try {
    const team = await YJRLTeam.findById(req.params.id)
      .populate('players', 'firstName lastName jerseyNumber position photo stats');
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create team (admin)
router.post('/teams', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const team = new YJRLTeam(req.body);
    await team.save();
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update team (admin)
router.put('/teams/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const team = await YJRLTeam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE team (admin)
router.delete('/teams/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    await YJRLTeam.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Team deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PLAYERS ──────────────────────────────────────────────────────────────────

// GET all players (admin/coach)
router.get('/players', auth, async (req, res) => {
  try {
    const { teamId, ageGroup, season, status } = req.query;
    const filter = { isActive: true };
    if (teamId) filter.teamId = teamId;
    if (ageGroup) filter.ageGroup = ageGroup;
    if (status) filter.registrationStatus = status;
    const players = await YJRLPlayer.find(filter)
      .populate('teamId', 'name ageGroup')
      .sort({ lastName: 1, firstName: 1 });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET player by ID (auth — player sees own, coach sees team, admin sees all)
router.get('/players/:id', auth, async (req, res) => {
  try {
    const player = await YJRLPlayer.findById(req.params.id)
      .populate('teamId', 'name ageGroup trainingDay trainingTime trainingVenue')
      .populate('achievements');
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET player by userId (for portal — player finds their own record)
router.get('/my-player', auth, async (req, res) => {
  try {
    const player = await YJRLPlayer.findOne({ userId: req.user._id, isActive: true })
      .populate('teamId', 'name ageGroup trainingDay trainingTime trainingVenue coach coachName')
      .populate('achievements');
    if (!player) return res.status(404).json({ error: 'No player profile linked to this account' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create player (admin)
router.post('/players', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const player = new YJRLPlayer(req.body);
    await player.save();
    // Add to team if teamId provided
    if (req.body.teamId) {
      await YJRLTeam.findByIdAndUpdate(req.body.teamId, { $addToSet: { players: player._id } });
    }
    res.status(201).json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update player (admin or coach)
router.put('/players/:id', auth, async (req, res) => {
  try {
    const player = await YJRLPlayer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST record attendance
router.post('/players/:id/attendance', auth, async (req, res) => {
  try {
    const { date, type, attended, notes } = req.body;
    const player = await YJRLPlayer.findByIdAndUpdate(
      req.params.id,
      { $push: { attendanceRecords: { date: new Date(date), type, attended, notes } } },
      { new: true }
    );
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST bulk attendance for a team on a given date
router.post('/teams/:teamId/attendance', auth, async (req, res) => {
  try {
    const { date, type, records } = req.body; // records: [{playerId, attended, notes}]
    const updates = records.map(r =>
      YJRLPlayer.findByIdAndUpdate(r.playerId, {
        $push: { attendanceRecords: { date: new Date(date), type, attended: r.attended, notes: r.notes || '' } }
      })
    );
    await Promise.all(updates);
    res.json({ message: `Attendance recorded for ${records.length} players` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST award achievement to player (admin/coach)
router.post('/players/:id/achievements', auth, async (req, res) => {
  try {
    const { achievementId, season, notes } = req.body;
    const player = await YJRLPlayer.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { achievements: achievementId },
        $push: { achievementDates: { achievement: achievementId, season, notes, date: new Date() } }
      },
      { new: true }
    ).populate('achievements');
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── FIXTURES ─────────────────────────────────────────────────────────────────

// GET fixtures (public)
router.get('/fixtures', async (req, res) => {
  try {
    const { ageGroup, season, status, teamId, upcoming, limit } = req.query;
    const filter = { isActive: true };
    if (ageGroup) filter.ageGroup = ageGroup;
    if (season) filter.season = season;
    if (status) filter.status = status;
    if (teamId) filter.teamId = teamId;
    if (upcoming === 'true') {
      filter.date = { $gte: new Date() };
      filter.status = 'scheduled';
    }
    let query = YJRLFixture.find(filter)
      .populate('teamId', 'name ageGroup')
      .populate('manOfMatch', 'firstName lastName')
      .sort({ date: upcoming === 'true' ? 1 : -1 });
    if (limit) query = query.limit(parseInt(limit));
    const fixtures = await query;
    res.json(fixtures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single fixture
router.get('/fixtures/:id', async (req, res) => {
  try {
    const fixture = await YJRLFixture.findById(req.params.id)
      .populate('teamId', 'name ageGroup')
      .populate('manOfMatch', 'firstName lastName photo')
      .populate('playerStats.player', 'firstName lastName jerseyNumber photo');
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
    res.json(fixture);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create fixture (admin)
router.post('/fixtures', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const fixture = new YJRLFixture(req.body);
    await fixture.save();
    res.status(201).json(fixture);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update fixture / enter result (admin/coach)
router.put('/fixtures/:id', auth, async (req, res) => {
  try {
    const fixture = await YJRLFixture.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    // If completing a fixture, update player stats & team record
    if (req.body.status === 'completed' && fixture.teamId) {
      const result = fixture.result;
      const teamUpdate = {
        $inc: {
          pointsFor: fixture.isHomeGame ? (fixture.homeScore || 0) : (fixture.awayScore || 0),
          pointsAgainst: fixture.isHomeGame ? (fixture.awayScore || 0) : (fixture.homeScore || 0),
          wins: result === 'win' ? 1 : 0,
          losses: result === 'loss' ? 1 : 0,
          draws: result === 'draw' ? 1 : 0
        }
      };
      await YJRLTeam.findByIdAndUpdate(fixture.teamId, teamUpdate);

      // Update player stats
      const season = fixture.season || new Date().getFullYear().toString();
      for (const stat of (req.body.playerStats || [])) {
        if (!stat.player) continue;
        await YJRLPlayer.findOneAndUpdate(
          { _id: stat.player, 'stats.season': season },
          {
            $inc: {
              'stats.$.gamesPlayed': stat.played ? 1 : 0,
              'stats.$.tries': stat.tries || 0,
              'stats.$.goals': stat.goals || 0,
              'stats.$.fieldGoals': stat.fieldGoals || 0,
              'stats.$.tackles': stat.tackles || 0,
              'stats.$.runMetres': stat.runMetres || 0
            }
          },
          { upsert: false }
        );
        // If no season entry yet, create one
        await YJRLPlayer.findOneAndUpdate(
          { _id: stat.player, 'stats.season': { $ne: season } },
          {
            $push: {
              stats: {
                season,
                gamesPlayed: stat.played ? 1 : 0,
                tries: stat.tries || 0,
                goals: stat.goals || 0,
                fieldGoals: stat.fieldGoals || 0,
                tackles: stat.tackles || 0,
                runMetres: stat.runMetres || 0,
                manOfMatch: 0
              }
            }
          }
        );
      }
    }

    res.json(fixture);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE fixture (admin)
router.delete('/fixtures/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    await YJRLFixture.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Fixture removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ladder — compute standings from fixtures
router.get('/ladder', async (req, res) => {
  try {
    const { season, ageGroup } = req.query;
    const filter = { isActive: true };
    if (season) filter.season = season;
    if (ageGroup) filter.ageGroup = ageGroup;
    const teams = await YJRLTeam.find(filter).sort({ ageGroup: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NEWS ─────────────────────────────────────────────────────────────────────

// GET published news (public)
router.get('/news', async (req, res) => {
  try {
    const { category, limit, featured } = req.query;
    const filter = { isActive: true, published: true };
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    let query = YJRLNews.find(filter).sort({ publishDate: -1, createdAt: -1 });
    if (limit) query = query.limit(parseInt(limit));
    const news = await query;
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all news including drafts (admin)
router.get('/news/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const news = await YJRLNews.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single news article (public)
router.get('/news/:id', async (req, res) => {
  try {
    const article = await YJRLNews.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create news article (admin)
router.post('/news', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const article = new YJRLNews({
      ...req.body,
      author: req.user._id,
      authorName: req.user.name || 'Yeppoon JRL'
    });
    await article.save();
    res.status(201).json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update news article (admin)
router.put('/news/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const article = await YJRLNews.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE news article (admin)
router.delete('/news/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    await YJRLNews.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Article removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────

// GET upcoming events (public)
router.get('/events', async (req, res) => {
  try {
    const { upcoming, type, ageGroup, limit } = req.query;
    const filter = { isActive: true };
    if (upcoming === 'true') filter.date = { $gte: new Date() };
    if (type) filter.type = type;
    if (ageGroup) filter.ageGroups = ageGroup;
    let query = YJRLEvent.find(filter).sort({ date: 1 });
    if (limit) query = query.limit(parseInt(limit));
    const events = await query;
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single event
router.get('/events/:id', async (req, res) => {
  try {
    const event = await YJRLEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create event (admin)
router.post('/events', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const event = new YJRLEvent(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update event (admin)
router.put('/events/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const event = await YJRLEvent.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST RSVP to event (auth)
router.post('/events/:id/rsvp', auth, async (req, res) => {
  try {
    const { status, adults, children, notes } = req.body;
    const event = await YJRLEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const existingIdx = event.rsvps.findIndex(r => String(r.userId) === String(req.user._id));
    if (existingIdx >= 0) {
      event.rsvps[existingIdx] = { userId: req.user._id, name: req.user.name, status, adults, children, notes };
    } else {
      event.rsvps.push({ userId: req.user._id, name: req.user.name, status, adults, children, notes });
    }
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE event (admin)
router.delete('/events/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    await YJRLEvent.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Event removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

// GET all achievement types (public)
router.get('/achievements', async (req, res) => {
  try {
    const achievements = await YJRLAchievement.find({ isActive: true }).sort({ rarity: 1, name: 1 });
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create achievement type (admin)
router.post('/achievements', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const achievement = new YJRLAchievement(req.body);
    await achievement.save();
    res.status(201).json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update achievement type (admin)
router.put('/achievements/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const achievement = await YJRLAchievement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!achievement) return res.status(404).json({ error: 'Achievement not found' });
    res.json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── STATS / OVERVIEW ─────────────────────────────────────────────────────────

// GET club overview stats (public)
router.get('/stats/overview', async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear().toString();
    const [teamCount, playerCount, fixtureCount, upcomingCount] = await Promise.all([
      YJRLTeam.countDocuments({ isActive: true, season }),
      YJRLPlayer.countDocuments({ isActive: true, registrationStatus: 'active', registrationYear: season }),
      YJRLFixture.countDocuments({ isActive: true, season, status: 'completed' }),
      YJRLFixture.countDocuments({ isActive: true, season, status: 'scheduled', date: { $gte: new Date() } })
    ]);

    // Top try scorers
    const topScorers = await YJRLPlayer.find({
      isActive: true,
      registrationYear: season,
      'stats.season': season
    })
      .select('firstName lastName stats ageGroup teamId photo')
      .populate('teamId', 'name ageGroup')
      .lean();

    const scorersWithTries = topScorers
      .map(p => ({ ...p, tries: (p.stats.find(s => s.season === season) || {}).tries || 0 }))
      .filter(p => p.tries > 0)
      .sort((a, b) => b.tries - a.tries)
      .slice(0, 5);

    res.json({ teamCount, playerCount, fixtureCount, upcomingCount, topScorers: scorersWithTries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET top scorers leaderboard
router.get('/stats/leaderboard', async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear().toString();
    const { ageGroup, stat } = req.query; // stat: tries, tackles, runMetres
    const filter = { isActive: true, 'stats.season': season };
    if (ageGroup) filter.ageGroup = ageGroup;

    const players = await YJRLPlayer.find(filter)
      .select('firstName lastName stats ageGroup photo jerseyNumber teamId')
      .populate('teamId', 'name')
      .lean();

    const statKey = ['tries', 'goals', 'tackles', 'runMetres', 'gamesPlayed'].includes(stat) ? stat : 'tries';

    const ranked = players
      .map(p => ({ ...p, value: (p.stats.find(s => s.season === season) || {})[statKey] || 0 }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
