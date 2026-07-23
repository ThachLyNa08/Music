-- Non-breaking schema extension for Smart Content Moderation MVP & Audio Duplicate Tracking

-- 1. Add moderation & audio duplicate reference columns to songs table if missing
SET @dbname = DATABASE();

SET @tablename = "songs";
SET @columnname = "metadata_score";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN metadata_score INT NOT NULL DEFAULT 0, ADD COLUMN risk_score INT NOT NULL DEFAULT 0, ADD COLUMN moderation_level VARCHAR(20) NOT NULL DEFAULT 'normal', ADD COLUMN moderation_flags JSON NULL, ADD COLUMN resubmission_count INT NOT NULL DEFAULT 0, ADD COLUMN can_resubmit TINYINT(1) NOT NULL DEFAULT 1, ADD COLUMN resubmit_locked_reason TEXT NULL, ADD COLUMN audio_hash VARCHAR(64) NULL, ADD COLUMN audio_file_size BIGINT NULL, ADD COLUMN audio_mime_type VARCHAR(100) NULL, ADD COLUMN duplicate_reference_song_id INT NULL, ADD COLUMN duplicate_reference_status VARCHAR(30) NULL, ADD COLUMN duplicate_reference_artist_id INT NULL, ADD INDEX idx_songs_audio_hash (audio_hash), ADD INDEX idx_songs_duplicate_reference_song_id (duplicate_reference_song_id);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ensure duplicate reference columns exist if table already had moderation_score
SET @columnname = "duplicate_reference_song_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN duplicate_reference_song_id INT NULL, ADD COLUMN duplicate_reference_status VARCHAR(30) NULL, ADD COLUMN duplicate_reference_artist_id INT NULL, ADD INDEX idx_songs_duplicate_reference_song_id (duplicate_reference_song_id);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Add moderation columns to albums table if missing
SET @tablename = "albums";
SET @columnname = "metadata_score";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE albums ADD COLUMN metadata_score INT NOT NULL DEFAULT 0, ADD COLUMN risk_score INT NOT NULL DEFAULT 0, ADD COLUMN moderation_level VARCHAR(20) NOT NULL DEFAULT 'normal', ADD COLUMN moderation_flags JSON NULL, ADD COLUMN resubmission_count INT NOT NULL DEFAULT 0, ADD COLUMN can_resubmit TINYINT(1) NOT NULL DEFAULT 1, ADD COLUMN resubmit_locked_reason TEXT NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Create artist_content_review_logs table if not exists
CREATE TABLE IF NOT EXISTS artist_content_review_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_type ENUM('song', 'album') NOT NULL,
  content_id INT NOT NULL,
  artist_id INT NULL,
  admin_id INT NULL,
  action ENUM('submitted', 'approved', 'rejected', 'resubmitted') NOT NULL,
  reason TEXT NULL,
  score_snapshot JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content (content_type, content_id),
  INDEX idx_artist (artist_id),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
