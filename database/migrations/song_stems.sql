CREATE TABLE IF NOT EXISTS song_stems (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  song_id INT UNSIGNED NOT NULL,
  vocals_url VARCHAR(500) NULL,
  instrumental_url VARCHAR(500) NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
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
