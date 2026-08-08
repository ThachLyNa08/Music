CREATE TABLE IF NOT EXISTS song_stems (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  song_id INT UNSIGNED NOT NULL,
  vocals_url VARCHAR(500) NULL,
  instrumental_url VARCHAR(500) NULL,
  job_id VARCHAR(64) NULL,
  locked_by VARCHAR(128) NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'stale', 'cancelled') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  started_at DATETIME NULL,
  heartbeat_at DATETIME NULL,
  completed_at DATETIME NULL,
  failed_at DATETIME NULL,
  retry_count INT NOT NULL DEFAULT 0,
  processed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_song_stems_song
    FOREIGN KEY (song_id) REFERENCES songs(id)
    ON DELETE CASCADE,

  UNIQUE KEY unique_song_stem_active (song_id),
  INDEX idx_song_stems_status (status),
  INDEX idx_song_stems_processed_at (processed_at)
);
