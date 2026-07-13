-- Direct Artist Studio account provisioning.
-- Safe to run more than once; no business data is deleted.

ALTER TABLE users
  MODIFY COLUMN role ENUM('user','artist','admin') NOT NULL DEFAULT 'user';

SET @add_must_change_password = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT ''users.must_change_password already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'must_change_password'
);
PREPARE stmt FROM @add_must_change_password;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_account_source = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN account_source VARCHAR(50) NOT NULL DEFAULT ''self_registered''',
    'SELECT ''users.account_source already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'account_source'
);
PREPARE stmt FROM @add_account_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
