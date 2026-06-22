-- =====================================================================
-- Migration: Upgrade Genres Schema
-- Thêm các trường cho taxonomy thể loại và hỗ trợ recommendation.
-- Script này được thiết kế an toàn (idempotent), không xoá dữ liệu cũ.
-- =====================================================================

-- 1. Thêm các cột mới vào bảng genres nếu chưa tồn tại
SET @dbname = DATABASE();

-- Bảng genres có thể chưa có các cột mới, ta dùng PROCEDURE để kiểm tra và thêm an toàn
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

CALL AddColumnIfNotExists(@dbname, 'genres', 'description', 'TEXT NULL AFTER slug');
CALL AddColumnIfNotExists(@dbname, 'genres', 'color', 'VARCHAR(20) NULL AFTER description');
CALL AddColumnIfNotExists(@dbname, 'genres', 'icon', 'VARCHAR(50) NULL AFTER color');
CALL AddColumnIfNotExists(@dbname, 'genres', 'cover_url', 'VARCHAR(500) NULL AFTER icon');
CALL AddColumnIfNotExists(@dbname, 'genres', 'is_featured', 'BOOLEAN NOT NULL DEFAULT FALSE AFTER cover_url');
CALL AddColumnIfNotExists(@dbname, 'genres', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER is_featured');
CALL AddColumnIfNotExists(@dbname, 'genres', 'status', 'ENUM(''active'',''hidden'') NOT NULL DEFAULT ''active'' AFTER sort_order');
CALL AddColumnIfNotExists(@dbname, 'genres', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status');
CALL AddColumnIfNotExists(@dbname, 'genres', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

DROP PROCEDURE AddColumnIfNotExists;

-- 2. Tạo bảng song_genres cho tuỳ chọn multi-genre sau này
CREATE TABLE IF NOT EXISTS song_genres (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    song_id     INT UNSIGNED    NOT NULL,
    genre_id    INT UNSIGNED    NOT NULL,
    role        ENUM('primary','secondary') NOT NULL DEFAULT 'secondary',
    weight      FLOAT           NOT NULL DEFAULT 1.0,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_song_genre (song_id, genre_id),
    CONSTRAINT fk_sg_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
    CONSTRAINT fk_sg_genre FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE
) COMMENT='Bảng liên kết bài hát và thể loại hỗ trợ multi-genre';

-- 3. Tạo index cho bảng genres để hỗ trợ tìm kiếm và sắp xếp
-- Chỉ tạo nếu chưa tồn tại
SET @exist_idx_status = (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'genres' AND INDEX_NAME = 'idx_genres_status');
SET @sql_idx_status = IF(@exist_idx_status = 0, 'CREATE INDEX idx_genres_status ON genres(status, sort_order)', 'DO 0');
PREPARE stmt FROM @sql_idx_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist_idx_featured = (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'genres' AND INDEX_NAME = 'idx_genres_featured');
SET @sql_idx_featured = IF(@exist_idx_featured = 0, 'CREATE INDEX idx_genres_featured ON genres(is_featured)', 'DO 0');
PREPARE stmt FROM @sql_idx_featured;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Hoàn tất!
