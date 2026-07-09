CREATE TABLE IF NOT EXISTS listen_together_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  host_user_id INT UNSIGNED NOT NULL,
  current_song_id INT UNSIGNED NULL,
  is_playing TINYINT(1) NOT NULL DEFAULT 0,
  position_seconds DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('active','ended') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_listen_sessions_conversation (conversation_id, status),
  INDEX idx_listen_sessions_host (host_user_id),
  CONSTRAINT fk_listen_sessions_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_listen_sessions_host
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_listen_sessions_song
    FOREIGN KEY (current_song_id) REFERENCES songs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
