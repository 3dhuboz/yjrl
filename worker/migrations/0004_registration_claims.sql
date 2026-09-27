-- Atomic duplicate protection for new submissions, without altering historical players.
CREATE TABLE IF NOT EXISTS registration_claims (
  identity_key TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
