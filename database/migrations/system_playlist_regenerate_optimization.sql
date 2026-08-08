-- Optimize admin system playlist regenerate target selection and progress.

SET @db_name = DATABASE();

DROP PROCEDURE IF EXISTS AddColumnIfMissing;
DROP PROCEDURE IF EXISTS AddIndexIfMissing;

DELIMITER //

CREATE PROCEDURE AddColumnIfMissing(
  IN p_table_name VARCHAR(128),
  IN p_column_name VARCHAR(128),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

CREATE PROCEDURE AddIndexIfMissing(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @sql = CONCAT('CREATE INDEX `', p_index_name, '` ON `', p_table_name, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DELIMITER ;

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

CALL AddColumnIfMissing('playlists', 'status', "`status` ENUM('active','empty','failed','stale','need_update') NOT NULL DEFAULT 'active' AFTER system_key");
CALL AddColumnIfMissing('playlists', 'last_generated_at', '`last_generated_at` DATETIME NULL AFTER next_refresh_at');
CALL AddColumnIfMissing('playlists', 'song_count', '`song_count` INT DEFAULT 0 AFTER last_generated_at');
CALL AddColumnIfMissing('playlists', 'first_song_cover_url', '`first_song_cover_url` VARCHAR(500) NULL AFTER song_count');
CALL AddColumnIfMissing('playlists', 'playlist_input_hash', '`playlist_input_hash` VARCHAR(128) NULL AFTER first_song_cover_url');
CALL AddColumnIfMissing('system_playlist_generation_runs', 'total_count', '`total_count` INT DEFAULT 0 AFTER total_users');
SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    'UPDATE system_playlist_generation_runs SET total_count = COALESCE(NULLIF(total_count, 0), total_playlists, 0) WHERE total_count IS NULL OR total_count = 0',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'system_playlist_generation_runs'
    AND COLUMN_NAME = 'total_playlists'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
CALL AddColumnIfMissing('system_playlist_generation_runs', 'processed_count', '`processed_count` INT DEFAULT 0 AFTER total_count');
CALL AddColumnIfMissing('system_playlist_generation_runs', 'cancel_requested', '`cancel_requested` TINYINT(1) DEFAULT 0 AFTER error_message');
CALL AddColumnIfMissing('system_playlist_generation_runs', 'cancelled_at', '`cancelled_at` DATETIME NULL AFTER cancel_requested');
CALL AddColumnIfMissing('system_playlist_generation_runs', 'trigger_source', "`trigger_source` VARCHAR(30) NOT NULL DEFAULT 'admin' AFTER cancelled_at");
CALL AddColumnIfMissing('system_playlist_generation_runs', 'scheduler_name', '`scheduler_name` VARCHAR(100) NULL AFTER trigger_source');
CALL AddColumnIfMissing('system_playlist_generation_runs', 'scheduled_for', '`scheduled_for` DATETIME NULL AFTER scheduler_name');
CALL AddColumnIfMissing('system_playlist_generation_runs', 'mode', '`mode` VARCHAR(50) NULL AFTER scheduled_for');

ALTER TABLE system_playlist_generation_runs
  MODIFY status ENUM('queued','running','cancelling','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL,
  MODIFY trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin',
  MODIFY scheduler_name VARCHAR(100) NULL,
  MODIFY mode VARCHAR(50) NULL;

CALL AddIndexIfMissing('playlists', 'idx_playlists_type_status_key_updated', '(type, status, system_key, updated_at)');
CALL AddIndexIfMissing('playlists', 'idx_playlists_user_type_key', '(user_id, type, system_key)');
CALL AddIndexIfMissing('playlist_songs', 'idx_playlist_songs_playlist_position', '(playlist_id, position)');
CALL AddIndexIfMissing('listening_history', 'idx_listening_history_user_played', '(user_id, listened_at)');
CALL AddIndexIfMissing('user_genre_preferences', 'idx_user_genre_preferences_user', '(user_id)');
CALL AddIndexIfMissing('user_artist_preferences', 'idx_user_artist_preferences_user', '(user_id)');

DROP PROCEDURE AddIndexIfMissing;
DROP PROCEDURE AddColumnIfMissing;
