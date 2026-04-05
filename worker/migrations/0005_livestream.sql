-- Livestream feature (single-row table — one active stream at a time)
CREATE TABLE IF NOT EXISTS livestream (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_live INTEGER DEFAULT 0,
  title TEXT DEFAULT 'Live from Yeppoon Seagulls',
  message TEXT DEFAULT '',
  session_id TEXT,
  sponsor_text TEXT DEFAULT '',
  sponsor_logo TEXT DEFAULT '',
  started_at TEXT,
  ended_at TEXT
);

-- Insert default row
INSERT OR IGNORE INTO livestream (id) VALUES (1);

-- Live chat messages (separate from team chat — public, moderated)
CREATE TABLE IF NOT EXISTS live_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_mod INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_live_chat_created ON live_chat(created_at DESC);
