CREATE TABLE IF NOT EXISTS conversation_pins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  message_id INT UNSIGNED NOT NULL,
  pinned_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_conversation_pin (conversation_id),
  INDEX idx_conversation_pins_message_id (message_id),
  INDEX idx_conversation_pins_pinned_by (pinned_by),
  CONSTRAINT fk_conversation_pins_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_pins_message
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_pins_user
    FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
