-- Add controlled artist metadata fields for MusicFlow.
-- Safe to apply manually; apps/backend/scripts/migrate.js also applies these columns idempotently.

ALTER TABLE artists
  ADD COLUMN short_bio TEXT NULL,
  ADD COLUMN genres_json JSON NULL,
  ADD COLUMN country VARCHAR(100) NULL,
  ADD COLUMN popularity INT NULL,
  ADD COLUMN followers INT NULL,
  ADD COLUMN spotify_artist_id VARCHAR(100) NULL,
  ADD COLUMN external_url VARCHAR(500) NULL,
  ADD COLUMN avatar_source VARCHAR(50) NULL,
  ADD COLUMN metadata_source VARCHAR(50) NULL,
  ADD COLUMN metadata_source_url VARCHAR(500) NULL,
  ADD COLUMN metadata_fetched_at DATETIME NULL;

