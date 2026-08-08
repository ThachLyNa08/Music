SET @schema_name = DATABASE();

SET @songs_audio_hash_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'songs'
    AND COLUMN_NAME = 'audio_hash'
);

SET @sql = IF(
  @songs_audio_hash_exists = 0,
  'ALTER TABLE songs ADD COLUMN audio_hash VARCHAR(64) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @songs_audio_hash_index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'songs'
    AND INDEX_NAME = 'idx_songs_audio_hash'
);

SET @sql = IF(
  @songs_audio_hash_index_exists = 0,
  'CREATE INDEX idx_songs_audio_hash ON songs(audio_hash)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
