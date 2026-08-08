CREATE TABLE IF NOT EXISTS email_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  email_type VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status ENUM('sent', 'failed', 'skipped') DEFAULT 'sent',
  error_message TEXT NULL,
  metadata_json JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_logs_user_created (user_id, created_at),
  INDEX idx_email_logs_type_created (email_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @add_locked_at = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN locked_at DATETIME NULL', 'SELECT ''users.locked_at exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'locked_at'
);
PREPARE stmt FROM @add_locked_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_locked_reason = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN locked_reason TEXT NULL', 'SELECT ''users.locked_reason exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'locked_reason'
);
PREPARE stmt FROM @add_locked_reason;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_locked_by = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN locked_by BIGINT NULL', 'SELECT ''users.locked_by exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'locked_by'
);
PREPARE stmt FROM @add_locked_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_lock_appeal_allowed = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN lock_appeal_allowed TINYINT(1) DEFAULT 1', 'SELECT ''users.lock_appeal_allowed exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lock_appeal_allowed'
);
PREPARE stmt FROM @add_lock_appeal_allowed;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_lock_appeal_token = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN lock_appeal_token VARCHAR(128) NULL', 'SELECT ''users.lock_appeal_token exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lock_appeal_token'
);
PREPARE stmt FROM @add_lock_appeal_token;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_lock_appeal_token_hash = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN lock_appeal_token_hash CHAR(64) NULL', 'SELECT ''users.lock_appeal_token_hash exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lock_appeal_token_hash'
);
PREPARE stmt FROM @add_lock_appeal_token_hash;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_lock_appeal_token_expires_at = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN lock_appeal_token_expires_at DATETIME NULL', 'SELECT ''users.lock_appeal_token_expires_at exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lock_appeal_token_expires_at'
);
PREPARE stmt FROM @add_lock_appeal_token_expires_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS account_lock_appeals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  evidence_image_url VARCHAR(500) NULL,
  status ENUM('pending', 'reviewing', 'accepted', 'rejected') DEFAULT 'pending',
  admin_note TEXT NULL,
  resolved_by BIGINT NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lock_appeals_user_created (user_id, created_at),
  INDEX idx_lock_appeals_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @add_appeal_evidence = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE account_lock_appeals ADD COLUMN evidence_image_url VARCHAR(500) NULL', 'SELECT ''account_lock_appeals.evidence_image_url exists''')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_lock_appeals' AND COLUMN_NAME = 'evidence_image_url'
);
PREPARE stmt FROM @add_appeal_evidence;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
