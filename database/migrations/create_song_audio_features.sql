CREATE TABLE IF NOT EXISTS song_audio_features (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  song_id INT UNSIGNED NOT NULL,
  raw_bpm FLOAT NULL,
  normalized_bpm FLOAT NULL,
  tempo_bucket ENUM('slow','medium','fast','unknown') DEFAULT 'unknown',
  tempo_confidence FLOAT NULL,
  beat_count INT NULL,
  beat_positions_json JSON NULL,
  beat_intervals_json JSON NULL,
  energy_score FLOAT NULL,
  danceability_score FLOAT NULL,
  brightness_score FLOAT NULL,
  tempo_stability FLOAT NULL,
  extractor VARCHAR(50) DEFAULT 'librosa',
  status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  error_message TEXT NULL,
  extracted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  bpm FLOAT NULL,
  tempo_level ENUM('slow','medium','fast') DEFAULT NULL,
  energy ENUM('low','medium','high') DEFAULT NULL,
  danceability FLOAT NULL,
  acoustic_score FLOAT NULL,
  brightness FLOAT NULL,
  mood VARCHAR(50) NULL,
  vibe VARCHAR(100) NULL,
  analyzed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_song_audio_features_song_id(song_id),
  INDEX idx_audio_features_tempo_bucket(tempo_bucket),
  INDEX idx_audio_features_bpm(normalized_bpm),
  INDEX idx_audio_features_energy(energy_score),
  INDEX idx_audio_features_status(status),
  CONSTRAINT fk_song_audio_features_song_new
    FOREIGN KEY (song_id) REFERENCES songs(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_song_audio_feature_column $$
CREATE PROCEDURE add_song_audio_feature_column(
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'song_audio_features'
      AND column_name = p_column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE song_audio_features ADD COLUMN ', p_column_name, ' ', p_column_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_song_audio_feature_index $$
CREATE PROCEDURE add_song_audio_feature_index(
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'song_audio_features'
      AND index_name = p_index_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE song_audio_features ADD ', p_index_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_song_audio_feature_column('raw_bpm', 'FLOAT NULL');
CALL add_song_audio_feature_column('normalized_bpm', 'FLOAT NULL');
CALL add_song_audio_feature_column('tempo_bucket', "ENUM('slow','medium','fast','unknown') DEFAULT 'unknown'");
CALL add_song_audio_feature_column('tempo_confidence', 'FLOAT NULL');
CALL add_song_audio_feature_column('beat_count', 'INT NULL');
CALL add_song_audio_feature_column('beat_positions_json', 'JSON NULL');
CALL add_song_audio_feature_column('beat_intervals_json', 'JSON NULL');
CALL add_song_audio_feature_column('danceability_score', 'FLOAT NULL');
CALL add_song_audio_feature_column('brightness_score', 'FLOAT NULL');
CALL add_song_audio_feature_column('tempo_stability', 'FLOAT NULL');
CALL add_song_audio_feature_column('extractor', "VARCHAR(50) DEFAULT 'librosa'");
CALL add_song_audio_feature_column('status', "ENUM('pending','processing','completed','failed') DEFAULT 'pending'");
CALL add_song_audio_feature_column('error_message', 'TEXT NULL');
CALL add_song_audio_feature_column('extracted_at', 'DATETIME NULL');
CALL add_song_audio_feature_column('bpm', 'FLOAT NULL');
CALL add_song_audio_feature_column('tempo_level', "ENUM('slow','medium','fast') DEFAULT NULL");
CALL add_song_audio_feature_column('energy', "ENUM('low','medium','high') DEFAULT NULL");
CALL add_song_audio_feature_column('danceability', 'FLOAT NULL');
CALL add_song_audio_feature_column('acoustic_score', 'FLOAT NULL');
CALL add_song_audio_feature_column('brightness', 'FLOAT NULL');
CALL add_song_audio_feature_column('mood', 'VARCHAR(50) NULL');
CALL add_song_audio_feature_column('vibe', 'VARCHAR(100) NULL');
CALL add_song_audio_feature_column('analyzed_at', 'DATETIME NULL');

CALL add_song_audio_feature_index('idx_audio_features_tempo_bucket', 'INDEX idx_audio_features_tempo_bucket(tempo_bucket)');
CALL add_song_audio_feature_index('idx_audio_features_bpm', 'INDEX idx_audio_features_bpm(normalized_bpm)');
CALL add_song_audio_feature_index('idx_audio_features_energy', 'INDEX idx_audio_features_energy(energy_score)');
CALL add_song_audio_feature_index('idx_audio_features_status', 'INDEX idx_audio_features_status(status)');

DROP PROCEDURE IF EXISTS add_song_audio_feature_column;
DROP PROCEDURE IF EXISTS add_song_audio_feature_index;
