-- Admin tables: audit log and settings

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('current_season', '2026'),
  ('registration_open', 'true'),
  ('early_bird_cutoff', '2026-02-28'),
  ('early_bird_discount', '20'),
  ('chat_hours_start', '7'),
  ('chat_hours_end', '20'),
  ('profanity_filter', 'true'),
  ('fees_U6', '80'), ('fees_U7', '80'), ('fees_U8', '120'), ('fees_U9', '120'),
  ('fees_U10', '150'), ('fees_U11', '150'), ('fees_U12', '180'), ('fees_U13', '180'),
  ('fees_U14', '200'), ('fees_U15', '200'), ('fees_U16', '220'), ('fees_U17', '220'),
  ('fees_U18', '220'), ('fees_Womens', '200'), ('fees_Mens', '250');
