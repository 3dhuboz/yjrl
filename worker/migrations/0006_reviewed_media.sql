-- Existing originals remain private until re-uploaded through the image processor.
ALTER TABLE upload_records ADD COLUMN processing_version TEXT NOT NULL DEFAULT '';
ALTER TABLE upload_records ADD COLUMN contains_children INTEGER;
ALTER TABLE upload_records ADD COLUMN reviewed_by_user_id TEXT;
ALTER TABLE upload_records ADD COLUMN reviewed_at TEXT;
ALTER TABLE upload_records ADD COLUMN reviewed_sha256 TEXT;
ALTER TABLE upload_records ADD COLUMN review_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE upload_records ADD COLUMN player_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(player_ids));
ALTER TABLE upload_records ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE upload_records ADD COLUMN storage_cleanup_pending INTEGER NOT NULL DEFAULT 0;
UPDATE upload_records SET player_ids = json_array(player_id) WHERE player_id IS NOT NULL;

ALTER TABLE child_access_log ADD COLUMN media_key TEXT;
ALTER TABLE child_access_log ADD COLUMN media_sha256 TEXT;
CREATE INDEX idx_child_access_media ON child_access_log(actor_user_id, media_key, media_sha256);
