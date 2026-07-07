ALTER TABLE messages
  MODIFY COLUMN message_type ENUM('text','song_share') NOT NULL DEFAULT 'text';

SET @has_shared_song_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'shared_song_id'
);
SET @sql := IF(
  @has_shared_song_id = 0,
  'ALTER TABLE messages ADD COLUMN shared_song_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_shared_song_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND INDEX_NAME = 'idx_messages_shared_song_id'
);
SET @sql := IF(
  @has_shared_song_index = 0,
  'CREATE INDEX idx_messages_shared_song_id ON messages (shared_song_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
