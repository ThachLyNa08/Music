CREATE TABLE IF NOT EXISTS system_playlist_generation_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operation_type VARCHAR(80) NOT NULL,
  status ENUM('queued','running','cancelling','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  heartbeat_at DATETIME NULL,
  duration_ms BIGINT NULL,
  total_users INT DEFAULT 0,
  total_count INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  error_message TEXT NULL,
  cancel_requested TINYINT(1) DEFAULT 0,
  cancelled_at DATETIME NULL,
  trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin',
  scheduler_name VARCHAR(100) NULL,
  scheduled_for DATETIME NULL,
  mode VARCHAR(50) NULL,
  triggered_by_user_id BIGINT NULL,
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_operation_type (operation_type),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_playlist_generation_runs
  MODIFY status ENUM('queued','running','cancelling','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL;

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN heartbeat_at DATETIME NULL AFTER finished_at',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'heartbeat_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN cancel_requested TINYINT(1) DEFAULT 0 AFTER error_message',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'cancel_requested'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN cancelled_at DATETIME NULL AFTER cancel_requested',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'cancelled_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    "ALTER TABLE system_playlist_generation_runs ADD COLUMN trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin' AFTER cancelled_at",
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'trigger_source'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN scheduler_name VARCHAR(100) NULL AFTER trigger_source',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'scheduler_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN scheduled_for DATETIME NULL AFTER scheduler_name',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'scheduled_for'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN mode VARCHAR(50) NULL AFTER scheduled_for',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'mode'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN total_count INT DEFAULT 0 AFTER total_users',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'total_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    'UPDATE system_playlist_generation_runs SET total_count = COALESCE(NULLIF(total_count, 0), total_playlists, 0) WHERE total_count IS NULL OR total_count = 0',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'total_playlists'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE system_playlist_generation_runs ADD COLUMN processed_count INT DEFAULT 0 AFTER total_count',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'processed_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE system_playlist_generation_runs
  MODIFY trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin',
  MODIFY scheduler_name VARCHAR(100) NULL,
  MODIFY mode VARCHAR(50) NULL;

UPDATE system_playlist_generation_runs
SET status = 'stale',
    finished_at = NOW(),
    duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
    error_message = COALESCE(error_message, 'System playlist regenerate job timed out or backend stopped before completion.')
WHERE status IN ('queued', 'running', 'cancelling')
  AND COALESCE(cancel_requested, 0) = 0
  AND COALESCE(heartbeat_at, started_at, created_at) < DATE_SUB(NOW(), INTERVAL 15 MINUTE);

UPDATE system_playlist_generation_runs
SET status = 'cancelled',
    cancelled_at = COALESCE(cancelled_at, NOW()),
    finished_at = COALESCE(finished_at, NOW()),
    duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
    error_message = COALESCE(error_message, 'System playlist regenerate job was cancelled by admin.')
WHERE status IN ('queued', 'running', 'cancelling')
  AND COALESCE(cancel_requested, 0) = 1
  AND COALESCE(heartbeat_at, started_at, created_at) < DATE_SUB(NOW(), INTERVAL 15 MINUTE);
