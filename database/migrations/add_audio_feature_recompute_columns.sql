SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'bpm_confidence'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN bpm_confidence FLOAT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'bpm_source'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN bpm_source VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'loudness'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN loudness FLOAT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'dynamic_complexity'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN dynamic_complexity FLOAT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'study_suitability_score'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN study_suitability_score FLOAT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'calm_fit_score'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN calm_fit_score FLOAT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'analysis_version'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN analysis_version VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'song_audio_features'
    AND column_name = 'analysis_updated_at'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE song_audio_features ADD COLUMN analysis_updated_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
