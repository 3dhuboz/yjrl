-- Explicit admin-selected destinations; legacy venue names are not geocoded.
ALTER TABLE teams ADD COLUMN training_maps_url TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN training_maps_embed_url TEXT NOT NULL DEFAULT '';
ALTER TABLE fixtures ADD COLUMN maps_url TEXT NOT NULL DEFAULT '';
ALTER TABLE fixtures ADD COLUMN maps_embed_url TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN maps_url TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN maps_embed_url TEXT NOT NULL DEFAULT '';
