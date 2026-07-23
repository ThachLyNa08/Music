-- Tối ưu hoá index cho tính năng tìm kiếm (Popular Artists)
-- Tạo index (listened_at, song_id) hoặc (created_at, song_id) tuỳ theo cấu trúc bảng hiện tại

DROP PROCEDURE IF EXISTS CreateIndexIfNotExists;
DELIMITER //
CREATE PROCEDURE CreateIndexIfNotExists(
    IN tableName VARCHAR(128),
    IN indexName VARCHAR(128),
    IN indexColumns VARCHAR(255)
)
BEGIN
    DECLARE index_count INT;
    SELECT COUNT(1) INTO index_count
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name = tableName
      AND index_name = indexName;

    IF index_count = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', indexName, ' ON ', tableName, '(', indexColumns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS OptimizeSearchIndexesDynamic;
DELIMITER //
CREATE PROCEDURE OptimizeSearchIndexesDynamic()
BEGIN
    DECLARE has_listened_at INT DEFAULT 0;
    DECLARE has_created_at INT DEFAULT 0;

    SELECT COUNT(1) INTO has_listened_at
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name = 'listening_history'
      AND column_name = 'listened_at';

    SELECT COUNT(1) INTO has_created_at
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name = 'listening_history'
      AND column_name = 'created_at';

    IF has_listened_at > 0 THEN
        CALL CreateIndexIfNotExists('listening_history', 'idx_lh_listened_song', 'listened_at, song_id');
    END IF;

    IF has_created_at > 0 THEN
        CALL CreateIndexIfNotExists('listening_history', 'idx_lh_created_song', 'created_at, song_id');
    END IF;

    CALL CreateIndexIfNotExists('songs', 'idx_song_artist_id', 'artist_id');
END //
DELIMITER ;

CALL OptimizeSearchIndexesDynamic();

DROP PROCEDURE IF EXISTS OptimizeSearchIndexesDynamic;
DROP PROCEDURE IF EXISTS CreateIndexIfNotExists;
