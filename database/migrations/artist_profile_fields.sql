-- Add Artist Studio profile fields. This migration is idempotent for MySQL.

DROP PROCEDURE IF EXISTS AddArtistProfileColumnIfMissing;

DELIMITER //
CREATE PROCEDURE AddArtistProfileColumnIfMissing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL AddArtistProfileColumnIfMissing('artists', 'tagline', 'VARCHAR(150) NULL AFTER bio');
CALL AddArtistProfileColumnIfMissing('artists', 'primary_genre_id', 'INT UNSIGNED NULL AFTER avatar_url');
CALL AddArtistProfileColumnIfMissing('artists', 'debut_year', 'INT NULL AFTER primary_genre_id');
CALL AddArtistProfileColumnIfMissing('artists', 'contact_email', 'VARCHAR(255) NULL AFTER debut_year');
CALL AddArtistProfileColumnIfMissing('artists', 'website_url', 'VARCHAR(500) NULL AFTER contact_email');
CALL AddArtistProfileColumnIfMissing('artists', 'facebook_url', 'VARCHAR(500) NULL AFTER website_url');
CALL AddArtistProfileColumnIfMissing('artists', 'instagram_url', 'VARCHAR(500) NULL AFTER facebook_url');
CALL AddArtistProfileColumnIfMissing('artists', 'youtube_url', 'VARCHAR(500) NULL AFTER instagram_url');
CALL AddArtistProfileColumnIfMissing('artists', 'tiktok_url', 'VARCHAR(500) NULL AFTER youtube_url');

DROP PROCEDURE IF EXISTS AddArtistProfileIndexIfMissing;

DELIMITER //
CREATE PROCEDURE AddArtistProfileIndexIfMissing(
  IN p_index VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'artists'
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('CREATE INDEX ', p_index, ' ON artists(', p_definition, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL AddArtistProfileIndexIfMissing('idx_artists_primary_genre_id', 'primary_genre_id');

DROP PROCEDURE IF EXISTS AddArtistProfileColumnIfMissing;
DROP PROCEDURE IF EXISTS AddArtistProfileIndexIfMissing;
