-- Separate from the best-effort activity feed: player reads require a saved event.
-- Keep opaque identifiers only; never copy child details into this log.
CREATE TABLE child_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  player_ids TEXT NOT NULL CHECK (json_valid(player_ids)),
  data_scope TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_child_access_actor_time ON child_access_log(actor_user_id, created_at);

-- Protect against ordinary UPDATE/DELETE, including INSERT OR REPLACE.
-- A database owner can still change the schema; this is not external tamper proofing.
CREATE TRIGGER child_access_log_no_update BEFORE UPDATE ON child_access_log
BEGIN SELECT RAISE(ABORT, 'Child access records are append-only'); END;

CREATE TRIGGER child_access_log_no_delete BEFORE DELETE ON child_access_log
BEGIN SELECT RAISE(ABORT, 'Child access records are append-only'); END;

CREATE TRIGGER child_access_log_no_replace BEFORE INSERT ON child_access_log
WHEN EXISTS (SELECT 1 FROM child_access_log WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Child access records are append-only'); END;
