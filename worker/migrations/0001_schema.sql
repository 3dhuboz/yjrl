-- YJRL D1 Database Schema
-- Migrated from MongoDB/Mongoose models to SQLite

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player', 'parent', 'coach', 'admin', 'dev')),
  phone TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ─── TEAMS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age_group TEXT NOT NULL,
  division TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '2026',
  coach_id TEXT REFERENCES users(id),
  coach_name TEXT NOT NULL DEFAULT '',
  assistant_id TEXT REFERENCES users(id),
  assistant_name TEXT NOT NULL DEFAULT '',
  manager_id TEXT REFERENCES users(id),
  manager_name TEXT NOT NULL DEFAULT '',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  byes INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  training_day TEXT NOT NULL DEFAULT '',
  training_time TEXT NOT NULL DEFAULT '',
  training_venue TEXT NOT NULL DEFAULT 'Nev Skuse Oval, Yeppoon',
  color_primary TEXT NOT NULL DEFAULT '#0c1d35',
  color_secondary TEXT NOT NULL DEFAULT '#f0a500',
  photo TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_teams_season ON teams(season);
CREATE INDEX IF NOT EXISTS idx_teams_age_group ON teams(age_group);
CREATE INDEX IF NOT EXISTS idx_teams_coach ON teams(coach_id);

-- ─── PLAYERS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  age_group TEXT NOT NULL DEFAULT '',
  team_id TEXT REFERENCES teams(id),
  position TEXT NOT NULL DEFAULT '',
  jersey_number INTEGER,
  guardian_name TEXT NOT NULL DEFAULT '',
  guardian_phone TEXT NOT NULL DEFAULT '',
  guardian_email TEXT NOT NULL DEFAULT '',
  emergency_name TEXT NOT NULL DEFAULT '',
  emergency_phone TEXT NOT NULL DEFAULT '',
  emergency_relationship TEXT NOT NULL DEFAULT '',
  medical_notes TEXT NOT NULL DEFAULT '',
  registration_status TEXT NOT NULL DEFAULT 'pending' CHECK(registration_status IN ('pending', 'active', 'inactive', 'transferred')),
  registration_year TEXT NOT NULL DEFAULT '2026',
  playhq_id TEXT NOT NULL DEFAULT '',
  coach_notes TEXT NOT NULL DEFAULT '',
  pathway_level TEXT NOT NULL DEFAULT 'grassroots' CHECK(pathway_level IN ('grassroots', 'development', 'rep', 'pathways', 'elite')),
  pathway_notes TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_age_group ON players(age_group);
CREATE INDEX IF NOT EXISTS idx_players_guardian_email ON players(guardian_email);

-- ─── PLAYER STATS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  season TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  field_goals INTEGER NOT NULL DEFAULT 0,
  tackles INTEGER NOT NULL DEFAULT 0,
  run_metres INTEGER NOT NULL DEFAULT 0,
  man_of_match INTEGER NOT NULL DEFAULT 0,
  UNIQUE(player_id, season)
);
CREATE INDEX IF NOT EXISTS idx_player_stats_season ON player_stats(season);

-- ─── ATTENDANCE RECORDS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('training', 'game')),
  attended INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_attendance_player ON attendance_records(player_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

-- ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🏆',
  category TEXT NOT NULL DEFAULT 'milestone' CHECK(category IN ('milestone', 'performance', 'attendance', 'spirit', 'special', 'season')),
  criteria TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common' CHECK(rarity IN ('common', 'rare', 'epic', 'legendary')),
  color TEXT NOT NULL DEFAULT '#f0a500',
  xp_value INTEGER NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── PLAYER ACHIEVEMENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  season TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(player_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);

-- ─── FIXTURES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id),
  age_group TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2026',
  round INTEGER NOT NULL,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  is_home_game INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT 'Nev Skuse Oval, Yeppoon',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'postponed', 'forfeit')),
  home_score INTEGER,
  away_score INTEGER,
  man_of_match_id TEXT REFERENCES players(id),
  man_of_match_name TEXT NOT NULL DEFAULT '',
  match_report TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fixtures_season ON fixtures(season);
CREATE INDEX IF NOT EXISTS idx_fixtures_age_group ON fixtures(age_group);
CREATE INDEX IF NOT EXISTS idx_fixtures_date ON fixtures(date);
CREATE INDEX IF NOT EXISTS idx_fixtures_team ON fixtures(team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);

-- ─── FIXTURE PLAYER STATS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixture_player_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  player_name TEXT NOT NULL DEFAULT '',
  tries INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  field_goals INTEGER NOT NULL DEFAULT 0,
  tackles INTEGER NOT NULL DEFAULT 0,
  run_metres INTEGER NOT NULL DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_fps_fixture ON fixture_player_stats(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fps_player ON fixture_player_stats(player_id);

-- ─── NEWS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'news' CHECK(category IN ('news', 'results', 'events', 'club', 'pathways', 'community', 'sponsors')),
  author_id TEXT REFERENCES users(id),
  author_name TEXT NOT NULL DEFAULT 'Yeppoon JRL',
  image TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  publish_date TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published, is_active);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

-- ─── EVENTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('training', 'game', 'fundraiser', 'social', 'presentation', 'registration', 'photo-day', 'gala-day', 'other')),
  date TEXT NOT NULL,
  end_date TEXT,
  time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  age_groups TEXT NOT NULL DEFAULT '[]',
  is_public INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER,
  image TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#f0a500',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- ─── EVENT RSVPS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'attending' CHECK(status IN ('attending', 'not-attending', 'maybe')),
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  rsvp_date TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON event_rsvps(event_id);

-- ─── CHAT MESSAGES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT DEFAULT '🦅',
  message TEXT NOT NULL,
  reactions TEXT DEFAULT '{}',
  flagged INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_room_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_flagged ON chat_messages(flagged) WHERE flagged = 1;

-- ─── CHAT ROOMS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('player', 'parent', 'coach')),
  team_id TEXT,
  age_group TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── REGISTRATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id),
  user_id TEXT REFERENCES users(id),
  season TEXT NOT NULL DEFAULT '2026',
  age_group TEXT NOT NULL DEFAULT '',
  fee_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded', 'offline')),
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  paid_at TEXT,
  form_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_season ON registrations(season);
