DROP PROCEDURE IF EXISTS CreateAdminGenresIndexIfMissing;
DROP PROCEDURE IF EXISTS CreateAdminGenresIndexIfColumnExists;

DELIMITER //
CREATE PROCEDURE CreateAdminGenresIndexIfMissing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @sql = CONCAT('CREATE INDEX ', p_index_name, ' ON ', p_table_name, ' (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

CREATE PROCEDURE CreateAdminGenresIndexIfColumnExists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT,
  IN p_required_column VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_required_column
  ) THEN
    CALL CreateAdminGenresIndexIfMissing(p_table_name, p_index_name, p_columns);
  END IF;
END //
DELIMITER ;

CALL CreateAdminGenresIndexIfMissing('genres', 'idx_admin_genres_parent_id', 'parent_id');
CALL CreateAdminGenresIndexIfMissing('genres', 'idx_admin_genres_status', 'status');
CALL CreateAdminGenresIndexIfMissing('genres', 'idx_admin_genres_featured', 'is_featured');
CALL CreateAdminGenresIndexIfMissing('genres', 'idx_admin_genres_market', 'market');
CALL CreateAdminGenresIndexIfMissing('genres', 'idx_admin_genres_flags', 'use_in_recommendation, use_in_cold_start, use_in_ai_playlist');

CALL CreateAdminGenresIndexIfMissing('songs', 'idx_admin_songs_genre_id', 'genre_id');
CALL CreateAdminGenresIndexIfMissing('songs', 'idx_admin_songs_artist_id', 'artist_id');

CALL CreateAdminGenresIndexIfMissing('listening_history', 'idx_admin_lh_song_id', 'song_id');
CALL CreateAdminGenresIndexIfMissing('listening_history', 'idx_admin_lh_listened_at', 'listened_at');
CALL CreateAdminGenresIndexIfMissing('listening_history', 'idx_admin_lh_listened_song', 'listened_at, song_id');
CALL CreateAdminGenresIndexIfMissing('listening_history', 'idx_admin_lh_song_listened', 'song_id, listened_at');
CALL CreateAdminGenresIndexIfColumnExists('listening_history', 'idx_admin_lh_created_at', 'created_at', 'created_at');
CALL CreateAdminGenresIndexIfColumnExists('listening_history', 'idx_admin_lh_created_song', 'created_at, song_id', 'created_at');

DROP PROCEDURE IF EXISTS CreateAdminGenresIndexIfMissing;
DROP PROCEDURE IF EXISTS CreateAdminGenresIndexIfColumnExists;
