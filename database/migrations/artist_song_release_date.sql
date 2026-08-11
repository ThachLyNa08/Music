-- ============================================================
-- Migration: Artist Song Release Date
-- Add artist-provided release date for song drafts/submissions.
-- Idempotent for MySQL/MariaDB versions without ADD COLUMN IF NOT EXISTS.
-- ============================================================

SET @schema_name = DATABASE();

SET @preparedStatement = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'songs'
        AND COLUMN_NAME = 'release_date'
    ),
    'SELECT 1',
    'ALTER TABLE songs ADD COLUMN release_date DATE NULL AFTER lyrics'
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'songs'
        AND COLUMN_NAME = 'release_at'
    ),
    'SELECT 1',
    'ALTER TABLE songs ADD COLUMN release_at DATETIME NULL AFTER release_date'
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE songs
SET release_at = TIMESTAMP(release_date, '00:00:00')
WHERE release_at IS NULL
  AND release_date IS NOT NULL;

SET @preparedStatement = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'artist_song_submissions'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'artist_song_submissions'
        AND COLUMN_NAME = 'release_date'
    ),
    'ALTER TABLE artist_song_submissions ADD COLUMN release_date DATE NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'artist_song_submissions'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'artist_song_submissions'
        AND COLUMN_NAME = 'release_at'
    ),
    'ALTER TABLE artist_song_submissions ADD COLUMN release_at DATETIME NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'artist_song_submissions'
    ),
    "UPDATE artist_song_submissions SET release_at = TIMESTAMP(release_date, '00:00:00') WHERE release_at IS NULL AND release_date IS NOT NULL",
    'SELECT 1'
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
