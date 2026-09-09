CREATE TABLE checklist_links (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY, notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'gathering' CHECK(status IN ('gathering','submitted','complete')),
  version INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE checklist_photos (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE,
  caption TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL,
  supplied_by TEXT NOT NULL, permission_confirmed INTEGER NOT NULL CHECK(permission_confirmed = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), removed_at TEXT,
  library_key TEXT REFERENCES upload_records(key)
);
CREATE INDEX checklist_photos_item ON checklist_photos(item_id, removed_at);
CREATE TRIGGER checklist_photo_limit BEFORE INSERT ON checklist_photos
WHEN (SELECT COUNT(*) FROM checklist_photos WHERE item_id = NEW.item_id AND removed_at IS NULL) >= 20
BEGIN SELECT RAISE(ABORT, 'checklist_photo_limit'); END;
CREATE TABLE checklist_history (
  id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, item_id TEXT,
  photo_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
