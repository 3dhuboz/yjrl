ALTER TABLE chat_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'announcement'));
ALTER TABLE chat_messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX chat_message_request ON chat_messages(user_id, room_id, request_id) WHERE request_id IS NOT NULL;
CREATE INDEX chat_message_room_id ON chat_messages(room_id, id);
CREATE TABLE chat_reads (
  room_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  message_id INTEGER NOT NULL REFERENCES chat_messages(id),
  PRIMARY KEY(room_id, user_id)
);
CREATE TABLE chat_reactions (
  message_id INTEGER NOT NULL REFERENCES chat_messages(id), user_id TEXT NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL CHECK(emoji IN ('👍', '❤️', '👏', '✅')),
  PRIMARY KEY(message_id, user_id, emoji)
);
CREATE TABLE committee_members (
  user_id TEXT PRIMARY KEY REFERENCES users(id), added_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE chat_activities (
  id TEXT PRIMARY KEY, room_id TEXT NOT NULL, title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('training', 'game', 'meeting', 'event')),
  starts_at TEXT NOT NULL, venue TEXT NOT NULL DEFAULT '', maps_url TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '', cancelled INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX chat_activity_room ON chat_activities(room_id, starts_at);
CREATE TABLE chat_attendance (
  activity_id TEXT NOT NULL REFERENCES chat_activities(id), user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('going', 'maybe', 'unavailable')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(activity_id, user_id)
);
CREATE TABLE chat_agreements (
  user_id TEXT NOT NULL REFERENCES users(id), version TEXT NOT NULL,
  agreement_json TEXT NOT NULL, accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, version)
);
CREATE TRIGGER chat_agreement_no_update BEFORE UPDATE ON chat_agreements BEGIN SELECT RAISE(ABORT, 'Agreement acceptance is immutable'); END;
CREATE TRIGGER chat_agreement_no_delete BEFORE DELETE ON chat_agreements BEGIN SELECT RAISE(ABORT, 'Agreement acceptance is immutable'); END;
