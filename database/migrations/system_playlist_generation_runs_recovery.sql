CREATE TABLE IF NOT EXISTS system_playlist_generation_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operation_type VARCHAR(80) NOT NULL,
  status ENUM('queued','running','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  heartbeat_at DATETIME NULL,
  duration_ms BIGINT NULL,
  total_users INT DEFAULT 0,
  total_playlists INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  error_message TEXT NULL,
  triggered_by_user_id BIGINT NULL,
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_operation_type (operation_type),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_playlist_generation_runs
  MODIFY status ENUM('queued','running','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL;

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

UPDATE system_playlist_generation_runs
SET status = 'stale',
    finished_at = NOW(),
    duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
    error_message = COALESCE(error_message, 'System playlist regenerate job timed out or backend stopped before completion.')
WHERE status IN ('queued', 'running')
  AND COALESCE(heartbeat_at, started_at, created_at) < DATE_SUB(NOW(), INTERVAL 15 MINUTE);
