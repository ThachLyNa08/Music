-- ============================================================
-- Migration: Artist Album Review Workflow
-- Thêm các cột quản lý duyệt album cho nghệ sĩ
-- ============================================================

SET @dbname = DATABASE();

-- 1. Thêm review_status
SET @tablename = 'albums';
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
  "ALTER TABLE albums ADD COLUMN review_status ENUM('approved', 'pending_review', 'rejected') NOT NULL DEFAULT 'approved' AFTER release_status;"
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
  "ALTER TABLE albums ADD COLUMN submitted_by_artist_id INT UNSIGNED NULL;"
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
  "ALTER TABLE albums ADD COLUMN submitted_by_user_id INT UNSIGNED NULL;"
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
  "ALTER TABLE albums ADD COLUMN reviewed_by_admin_id INT UNSIGNED NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 5. Thêm submitted_at
SET @columnname = 'submitted_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE albums ADD COLUMN submitted_at DATETIME NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 6. Thêm reviewed_at
SET @columnname = 'reviewed_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE albums ADD COLUMN reviewed_at DATETIME NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 7. Thêm rejection_reason
SET @columnname = 'rejection_reason';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE albums ADD COLUMN rejection_reason TEXT NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;

-- 8. Thêm submission_note
SET @columnname = 'submission_note';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE albums ADD COLUMN submission_note TEXT NULL;"
));
PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;


-- Thêm index nếu chưa có
SET @indexname = 'idx_album_review_status';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema = @dbname AND table_name = 'albums' AND index_name = @indexname
  ) > 0,
  "SELECT 1",
  "CREATE INDEX idx_album_review_status ON albums (review_status);"
));
PREPARE addIndex FROM @preparedStatement;
EXECUTE addIndex;
DEALLOCATE PREPARE addIndex;

SET @indexname = 'idx_album_submitted_by_artist';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema = @dbname AND table_name = 'albums' AND index_name = @indexname
  ) > 0,
  "SELECT 1",
  "CREATE INDEX idx_album_submitted_by_artist ON albums (submitted_by_artist_id);"
));
PREPARE addIndex FROM @preparedStatement;
EXECUTE addIndex;
DEALLOCATE PREPARE addIndex;

SET @indexname = 'idx_album_submitted_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema = @dbname AND table_name = 'albums' AND index_name = @indexname
  ) > 0,
  "SELECT 1",
  "CREATE INDEX idx_album_submitted_at ON albums (submitted_at);"
));
PREPARE addIndex FROM @preparedStatement;
EXECUTE addIndex;
DEALLOCATE PREPARE addIndex;
