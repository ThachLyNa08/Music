-- =====================================================================
-- Migration: Upgrade Genres Taxonomy
-- Nâng cấp bảng genres thêm các trường taxonomy phục vụ:
-- Cold Start, Recommendation, AI Playlist, Market, Subgenre.
-- =====================================================================

SET @dbname = DATABASE();

DELIMITER $$

CREATE PROCEDURE AddColumnIfNotExists(
    IN dbName VARCHAR(255),
    IN tableName VARCHAR(255),
    IN colName VARCHAR(255),
    IN colDef VARCHAR(255)
)
BEGIN
    DECLARE col_count INT;
    SELECT COUNT(*) INTO col_count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = dbName
      AND TABLE_NAME = tableName
      AND COLUMN_NAME = colName;
      
    IF col_count = 0 THEN
        SET @ddl = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', colName, ' ', colDef);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

CALL AddColumnIfNotExists(@dbname, 'genres', 'market', 'VARCHAR(50) NULL AFTER slug');
CALL AddColumnIfNotExists(@dbname, 'genres', 'parent_id', 'INT UNSIGNED NULL AFTER market');
CALL AddColumnIfNotExists(@dbname, 'genres', 'use_in_recommendation', 'BOOLEAN NOT NULL DEFAULT TRUE AFTER status');
CALL AddColumnIfNotExists(@dbname, 'genres', 'use_in_cold_start', 'BOOLEAN NOT NULL DEFAULT TRUE AFTER use_in_recommendation');
CALL AddColumnIfNotExists(@dbname, 'genres', 'use_in_ai_playlist', 'BOOLEAN NOT NULL DEFAULT TRUE AFTER use_in_cold_start');

DROP PROCEDURE AddColumnIfNotExists;

-- Thêm Foreign Key cho parent_id nếu chưa có
DELIMITER $$
CREATE PROCEDURE AddForeignKeyIfNotExists()
BEGIN
    DECLARE fk_count INT;
    SELECT COUNT(*) INTO fk_count
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'genres'
      AND COLUMN_NAME = 'parent_id'
      AND REFERENCED_TABLE_NAME = 'genres'
      AND REFERENCED_COLUMN_NAME = 'id';
      
    IF fk_count = 0 THEN
        ALTER TABLE genres ADD CONSTRAINT fk_genres_parent FOREIGN KEY (parent_id) REFERENCES genres(id) ON DELETE SET NULL;
    END IF;
END$$
DELIMITER ;

CALL AddForeignKeyIfNotExists();
DROP PROCEDURE AddForeignKeyIfNotExists;

-- Thêm Index nếu chưa có
DELIMITER $$
CREATE PROCEDURE AddIndexIfNotExists(
    IN idxName VARCHAR(255),
    IN tableName VARCHAR(255),
    IN columns VARCHAR(255)
)
BEGIN
    DECLARE idx_count INT;
    SELECT COUNT(*) INTO idx_count
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = tableName
      AND INDEX_NAME = idxName;
      
    IF idx_count = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', idxName, ' ON ', tableName, ' (', columns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL AddIndexIfNotExists('idx_genres_market', 'genres', 'market');
CALL AddIndexIfNotExists('idx_genres_parent', 'genres', 'parent_id');
CALL AddIndexIfNotExists('idx_genres_taxonomy_flags', 'genres', 'use_in_recommendation, use_in_cold_start, use_in_ai_playlist');

DROP PROCEDURE AddIndexIfNotExists;
