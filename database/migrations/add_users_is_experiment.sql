-- Add an experimental-user marker for controlled recommendation datasets.
-- Safe to run repeatedly; it does not modify or delete existing users.

SET @has_is_experiment := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_experiment'
);

SET @add_is_experiment_sql := IF(
  @has_is_experiment = 0,
  'ALTER TABLE users ADD COLUMN is_experiment TINYINT(1) DEFAULT 0',
  'SELECT ''users.is_experiment already exists'' AS message'
);

PREPARE add_is_experiment_stmt FROM @add_is_experiment_sql;
EXECUTE add_is_experiment_stmt;
DEALLOCATE PREPARE add_is_experiment_stmt;
