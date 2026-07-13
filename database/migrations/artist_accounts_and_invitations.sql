-- Artist account invitation support for MusicFlow.
-- Review before applying to a real database.

ALTER TABLE users
  MODIFY COLUMN role ENUM('user','artist','admin') NOT NULL DEFAULT 'user';

ALTER TABLE artists
  ADD COLUMN user_id INT UNSIGNED NULL;

ALTER TABLE artists
  ADD UNIQUE KEY unique_artists_user_id (user_id);

ALTER TABLE artists
  ADD CONSTRAINT fk_artists_user_id
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS artist_account_invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  artist_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('pending','activated','expired','revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  activated_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_by_admin_id INT UNSIGNED NULL,
  delivery_method ENUM('email','manual') NOT NULL DEFAULT 'email',
  delivery_status ENUM('pending','sent','manual_required','failed') NOT NULL DEFAULT 'pending',
  delivery_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_artist_inv_artist_id (artist_id),
  INDEX idx_artist_inv_email (email),
  UNIQUE KEY unique_artist_inv_token_hash (token_hash),
  INDEX idx_artist_inv_status (status),
  INDEX idx_artist_inv_expires_at (expires_at),
  CONSTRAINT fk_artist_inv_artist
    FOREIGN KEY (artist_id) REFERENCES artists(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_artist_inv_created_by
    FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
