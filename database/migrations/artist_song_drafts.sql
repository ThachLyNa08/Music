-- Add Artist Studio song drafts. Idempotent enough for local MySQL/MariaDB use.

ALTER TABLE songs
  MODIFY review_status ENUM('draft','approved','pending_review','rejected','changes_required') NOT NULL DEFAULT 'approved';

ALTER TABLE songs
  MODIFY audio_url VARCHAR(500) NULL;

DROP PROCEDURE IF EXISTS AddSongDraftColumnIfMissing;

DELIMITER //
CREATE PROCEDURE AddSongDraftColumnIfMissing(
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'songs'
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE songs ADD COLUMN ', p_column, ' ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL AddSongDraftColumnIfMissing('last_saved_at', 'DATETIME NULL AFTER submitted_at');

DROP PROCEDURE IF EXISTS AddSongDraftIndexIfMissing;

DELIMITER //
CREATE PROCEDURE AddSongDraftIndexIfMissing(
  IN p_index VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'songs'
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('CREATE INDEX ', p_index, ' ON songs(', p_definition, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL AddSongDraftIndexIfMissing('idx_song_last_saved_at', 'last_saved_at');

DROP PROCEDURE IF EXISTS AddSongDraftColumnIfMissing;
DROP PROCEDURE IF EXISTS AddSongDraftIndexIfMissing;
