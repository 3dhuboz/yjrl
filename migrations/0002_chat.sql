-- Chat messages table
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

CREATE INDEX idx_chat_room_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_flagged ON chat_messages(flagged) WHERE flagged = 1;

-- Chat rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('player', 'parent', 'coach')),
  team_id TEXT,
  age_group TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default rooms
INSERT INTO chat_rooms (id, name, type, age_group) VALUES
  ('player-u6', 'U6 Team Chat', 'player', 'U6'),
  ('player-u7', 'U7 Team Chat', 'player', 'U7'),
  ('player-u8', 'U8 Team Chat', 'player', 'U8'),
  ('player-u9', 'U9 Team Chat', 'player', 'U9'),
  ('player-u10', 'U10 Team Chat', 'player', 'U10'),
  ('player-u11', 'U11 Team Chat', 'player', 'U11'),
  ('player-u12', 'U12 Team Chat', 'player', 'U12'),
  ('player-u13', 'U13 Team Chat', 'player', 'U13'),
  ('player-u14', 'U14 Team Chat', 'player', 'U14'),
  ('player-u15', 'U15 Team Chat', 'player', 'U15'),
  ('player-u16', 'U16 Team Chat', 'player', 'U16'),
  ('parent-u6', 'U6 Parents', 'parent', 'U6'),
  ('parent-u7', 'U7 Parents', 'parent', 'U7'),
  ('parent-u8', 'U8 Parents', 'parent', 'U8'),
  ('parent-u9', 'U9 Parents', 'parent', 'U9'),
  ('parent-u10', 'U10 Parents', 'parent', 'U10'),
  ('parent-u11', 'U11 Parents', 'parent', 'U11'),
  ('parent-u12', 'U12 Parents', 'parent', 'U12'),
  ('parent-u13', 'U13 Parents', 'parent', 'U13'),
  ('parent-u14', 'U14 Parents', 'parent', 'U14'),
  ('parent-u15', 'U15 Parents', 'parent', 'U15'),
  ('parent-u16', 'U16 Parents', 'parent', 'U16'),
  ('coaches', 'Coaches Room', 'coach', NULL);
