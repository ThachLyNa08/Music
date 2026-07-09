-- Idempotent Migration: Add support for sharing playlists, albums, and artists in Chat

-- 1. Modify message_type ENUM safely
ALTER TABLE messages
  MODIFY COLUMN message_type ENUM('text', 'song_share', 'playlist_share', 'album_share', 'artist_share', 'recalled') NOT NULL DEFAULT 'text';

-- 2. Add shared_playlist_id
SET @has_shared_playlist_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'shared_playlist_id'
);
SET @sql := IF(
  @has_shared_playlist_id = 0,
  'ALTER TABLE messages ADD COLUMN shared_playlist_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add shared_album_id
SET @has_shared_album_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'shared_album_id'
);
SET @sql := IF(
  @has_shared_album_id = 0,
  'ALTER TABLE messages ADD COLUMN shared_album_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add shared_artist_id
SET @has_shared_artist_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'shared_artist_id'
);
SET @sql := IF(
  @has_shared_artist_id = 0,
  'ALTER TABLE messages ADD COLUMN shared_artist_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Add Indexes
SET @has_idx_playlist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND INDEX_NAME = 'idx_messages_shared_playlist_id'
);
SET @sql := IF(
  @has_idx_playlist = 0,
  'CREATE INDEX idx_messages_shared_playlist_id ON messages (shared_playlist_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_album := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND INDEX_NAME = 'idx_messages_shared_album_id'
);
SET @sql := IF(
  @has_idx_album = 0,
  'CREATE INDEX idx_messages_shared_album_id ON messages (shared_album_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_artist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND INDEX_NAME = 'idx_messages_shared_artist_id'
);
SET @sql := IF(
  @has_idx_artist = 0,
  'CREATE INDEX idx_messages_shared_artist_id ON messages (shared_artist_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Add Foreign Keys
SET @has_fk_playlist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND CONSTRAINT_NAME = 'fk_messages_shared_playlist'
);
SET @sql := IF(
  @has_fk_playlist = 0,
  'ALTER TABLE messages ADD CONSTRAINT fk_messages_shared_playlist FOREIGN KEY (shared_playlist_id) REFERENCES playlists (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_album := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND CONSTRAINT_NAME = 'fk_messages_shared_album'
);
SET @sql := IF(
  @has_fk_album = 0,
  'ALTER TABLE messages ADD CONSTRAINT fk_messages_shared_album FOREIGN KEY (shared_album_id) REFERENCES albums (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_artist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND CONSTRAINT_NAME = 'fk_messages_shared_artist'
);
SET @sql := IF(
  @has_fk_artist = 0,
  'ALTER TABLE messages ADD CONSTRAINT fk_messages_shared_artist FOREIGN KEY (shared_artist_id) REFERENCES artists (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
