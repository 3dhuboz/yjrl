-- Child safety and safeguarding controls

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
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

CREATE TABLE IF NOT EXISTS player_consents (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  media_consent INTEGER NOT NULL DEFAULT 0,
  public_profile_consent INTEGER NOT NULL DEFAULT 0,
  stats_public_consent INTEGER NOT NULL DEFAULT 0,
  consent_source TEXT NOT NULL DEFAULT '',
  consent_by_user_id TEXT REFERENCES users(id),
  consent_by_name TEXT NOT NULL DEFAULT '',
  consent_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parent_child_links (
  id TEXT PRIMARY KEY,
  parent_user_id TEXT NOT NULL REFERENCES users(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  relationship TEXT NOT NULL DEFAULT 'guardian',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected', 'revoked')),
  source TEXT NOT NULL DEFAULT '',
  verified_by_user_id TEXT REFERENCES users(id),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(parent_user_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_parent_child_parent ON parent_child_links(parent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_parent_child_player ON parent_child_links(player_id, status);

CREATE TABLE IF NOT EXISTS adult_role_approvals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  requested_role TEXT NOT NULL CHECK(requested_role IN ('coach', 'admin', 'dev')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'suspended', 'expired')),
  blue_card_reference TEXT NOT NULL DEFAULT '',
  blue_card_status TEXT NOT NULL DEFAULT 'not-provided',
  blue_card_expiry TEXT,
  identity_checked INTEGER NOT NULL DEFAULT 0,
  safeguarding_training_completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  approved_by_user_id TEXT REFERENCES users(id),
  approved_at TEXT,
  suspended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, requested_role)
);
CREATE INDEX IF NOT EXISTS idx_adult_role_user ON adult_role_approvals(user_id, requested_role);
CREATE INDEX IF NOT EXISTS idx_adult_role_status ON adult_role_approvals(status);

CREATE TABLE IF NOT EXISTS safety_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id),
  reporter_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT,
  reason TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'triaged', 'actioned', 'closed')),
  assigned_to_user_id TEXT REFERENCES users(id),
  action_taken TEXT NOT NULL DEFAULT '',
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON safety_reports(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_reports_entity ON safety_reports(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS upload_records (
  key TEXT PRIMARY KEY,
  url TEXT,
  uploader_user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL DEFAULT 'general',
  player_id TEXT REFERENCES players(id),
  consent_required INTEGER NOT NULL DEFAULT 0,
  consent_granted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'rejected')),
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_upload_records_player ON upload_records(player_id);
CREATE INDEX IF NOT EXISTS idx_upload_records_status ON upload_records(status, created_at DESC);
