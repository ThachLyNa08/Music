CREATE TABLE IF NOT EXISTS ai_playlist_daily_usage (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  usage_date DATE NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ai_playlist_daily_usage_user_date (user_id, usage_date),
  INDEX idx_ai_playlist_daily_usage_user_date (user_id, usage_date),
  CONSTRAINT fk_ai_playlist_daily_usage_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
