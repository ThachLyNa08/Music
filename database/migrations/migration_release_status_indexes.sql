DELIMITER $$

DROP PROCEDURE IF EXISTS CreateIndexIfNotExists $$

CREATE PROCEDURE CreateIndexIfNotExists(
    IN p_idx_name VARCHAR(128),
    IN p_table_name VARCHAR(128),
    IN p_index_columns VARCHAR(255)
)
BEGIN
    DECLARE index_exists INT;
    SELECT COUNT(1) INTO index_exists
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_idx_name;

    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', p_idx_name, ' ON ', p_table_name, '(', p_index_columns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DELIMITER ;

CALL CreateIndexIfNotExists('idx_albums_artist_release', 'albums', 'artist_id, release_status, release_at');
CALL CreateIndexIfNotExists('idx_albums_genre_release_date', 'albums', 'genre_id, release_status, release_date');
CALL CreateIndexIfNotExists('idx_songs_album_public', 'songs', 'album_id, is_active, release_status, release_at');
CALL CreateIndexIfNotExists('idx_songs_genre_public', 'songs', 'genre_id, is_active, release_status, release_at');

DROP PROCEDURE IF EXISTS CreateIndexIfNotExists;
