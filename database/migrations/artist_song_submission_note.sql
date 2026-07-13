-- Add artist submission note for Admin song review.
SET @dbname = DATABASE();
SET @tablename = 'songs';
SET @columnname = 'submission_note';

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = @tablename
      AND table_schema = @dbname
      AND column_name = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE songs ADD COLUMN submission_note TEXT NULL AFTER lyrics;"
));

PREPARE addColumn FROM @preparedStatement;
EXECUTE addColumn;
DEALLOCATE PREPARE addColumn;
