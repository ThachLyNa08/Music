-- ============================================================
-- Migration: Artist Song Review Workflow
-- Thêm các cột quản lý duyệt bài hát cho nghệ sĩ
-- ============================================================

-- Bảng `songs` hiện tại đang có:
--   release_status ENUM('draft','scheduled','published','hidden') NOT NULL DEFAULT 'published',
--   release_at DATETIME NULL,
--   published_at DATETIME NULL,
-- Ta sẽ không thêm `published_at` nếu nó đã có. Ta kiểm tra bằng cách tạo cột an toàn.
-- Vì MySQL <= 8.0.28 (hoặc MariaDB) có thể không hỗ trợ ADD COLUMN IF NOT EXISTS trong mọi phiên bản,
-- script migration ở dự án này nếu chạy fail do trùng cột cũng không sao.
-- Tuy nhiên, ta dùng cách chuẩn để hạn chế lỗi.

SET @dbname = DATABASE();

-- 1. Thêm review_status
SET @tablename = 'songs';
SET @columnname = 'review_status';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN review_status ENUM('approved', 'pending_review', 'rejected') NOT NULL DEFAULT 'approved' AFTER release_status;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 2. Thêm submitted_by_artist_id
SET @columnname = 'submitted_by_artist_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN submitted_by_artist_id INT UNSIGNED NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 3. Thêm submitted_by_user_id
SET @columnname = 'submitted_by_user_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN submitted_by_user_id INT UNSIGNED NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 4. Thêm reviewed_by_admin_id
SET @columnname = 'reviewed_by_admin_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN reviewed_by_admin_id INT UNSIGNED NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 5. Thêm reviewed_at
SET @columnname = 'reviewed_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN reviewed_at DATETIME NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 6. Thêm rejection_reason
SET @columnname = 'rejection_reason';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN rejection_reason TEXT NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 7. Thêm submitted_at
SET @columnname = 'submitted_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN submitted_at DATETIME NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- Lưu ý: Cột published_at đã có sẵn trong musicflow_schema.sql (ở dòng 126).
-- Không cần thêm nữa để tránh duplicate column.

-- Add indexes (Ignore errors if indexes exist, but MySQL doesn't support CREATE INDEX IF NOT EXISTS directly. We use a stored procedure trick or just simple create since we'll run this manually)

SET @idxName = 'idx_song_review_status';
SET @tableName = 'songs';
SET @idxColumns = 'review_status';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tableName AND INDEX_NAME = @idxName
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @idxName, " ON ", @tableName, "(", @idxColumns, ");")
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idxName = 'idx_song_submitted_by_artist';
SET @tableName = 'songs';
SET @idxColumns = 'submitted_by_artist_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tableName AND INDEX_NAME = @idxName
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @idxName, " ON ", @tableName, "(", @idxColumns, ");")
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idxName = 'idx_song_submitted_at';
SET @tableName = 'songs';
SET @idxColumns = 'submitted_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tableName AND INDEX_NAME = @idxName
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @idxName, " ON ", @tableName, "(", @idxColumns, ");")
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
