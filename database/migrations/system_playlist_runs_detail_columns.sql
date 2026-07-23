CREATE TABLE IF NOT EXISTS system_playlist_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  system_key VARCHAR(100) NOT NULL,
  run_type ENUM('scheduled', 'manual', 'admin_all', 'script') NOT NULL DEFAULT 'scheduled',
  source_start_date DATE NULL,
  source_end_date DATE NULL,
  scheduled_for DATETIME NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  status ENUM('success', 'failed', 'skipped') NOT NULL DEFAULT 'success',
  playlist_count INT DEFAULT 0,
  song_count INT DEFAULT 0,
  overlap_ratio DECIMAL(5,2) NULL,
  message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_system_key_created_at (system_key, created_at),
  INDEX idx_scheduled_for (scheduled_for)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_playlist_runs
  MODIFY status ENUM('success', 'failed', 'partial', 'skipped') NOT NULL DEFAULT 'success';

ALTER TABLE system_playlist_runs
  ADD COLUMN playlist_id INT UNSIGNED NULL AFTER system_key,
  ADD COLUMN user_id INT UNSIGNED NULL AFTER playlist_id,
  ADD COLUMN songs_added INT DEFAULT 0 AFTER song_count,
  ADD COLUMN songs_removed INT DEFAULT 0 AFTER songs_added,
  ADD COLUMN total_songs INT DEFAULT 0 AFTER songs_removed,
  ADD COLUMN error_message TEXT NULL AFTER overlap_ratio;
