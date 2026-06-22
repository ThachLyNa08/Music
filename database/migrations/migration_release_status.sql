-- Release status for albums and songs.
-- Safe to run multiple times. Existing data is kept.

SET @schema_name = DATABASE();

SET @albums_release_status_existed = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'release_status'
);

SET @songs_release_status_existed = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'songs' AND COLUMN_NAME = 'release_status'
);

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE albums ADD COLUMN release_status ENUM(''draft'',''scheduled'',''published'',''hidden'') NOT NULL DEFAULT ''draft''',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'release_status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE albums ADD COLUMN release_at DATETIME NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'release_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE albums ADD COLUMN published_at DATETIME NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'published_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE songs ADD COLUMN release_status ENUM(''draft'',''scheduled'',''published'',''hidden'') NOT NULL DEFAULT ''published''',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'songs' AND COLUMN_NAME = 'release_status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE songs ADD COLUMN release_at DATETIME NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'songs' AND COLUMN_NAME = 'release_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE songs ADD COLUMN published_at DATETIME NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'songs' AND COLUMN_NAME = 'published_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE albums
SET
  release_status = 'published',
  release_at = COALESCE(release_at, created_at, NOW()),
  published_at = COALESCE(published_at, created_at, NOW())
WHERE @albums_release_status_existed = 0
   OR release_status IS NULL
   OR release_status = '';

UPDATE songs
SET
  release_status = 'published',
  release_at = COALESCE(release_at, created_at, NOW()),
  published_at = COALESCE(published_at, created_at, NOW())
WHERE @songs_release_status_existed = 0
   OR release_status IS NULL
   OR release_status = '';
