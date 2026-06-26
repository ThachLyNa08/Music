-- Thêm bảng song_semantic_profiles
CREATE TABLE IF NOT EXISTS song_semantic_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  song_id INT UNSIGNED NOT NULL UNIQUE,

  summary_vi TEXT,
  main_theme VARCHAR(100),
  sub_themes JSON,
  mood_tags JSON,
  situation_tags JSON,
  lyrical_keywords JSON,

  emotion_intensity TINYINT,
  meaning_confidence DECIMAL(4,2),
  semantic_text TEXT,

  source ENUM('manual','rule_based','llm','lyrics','metadata','hybrid') DEFAULT 'rule_based',
  generated_by VARCHAR(100) DEFAULT 'local_semantic_pipeline',

  evidence_level ENUM('metadata_only','lyrics_based','audio_features_only','hybrid','external_grounded','manual_reviewed') DEFAULT 'metadata_only',
  review_status ENUM('auto','needs_review','approved') DEFAULT 'auto',

  external_refs JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_song_semantic_profiles_song
    FOREIGN KEY (song_id) REFERENCES songs(id)
    ON DELETE CASCADE
);

-- CREATE INDEX IF NOT EXISTS is not standard MySQL, so we use a stored procedure trick or just normal CREATE INDEX.
-- Since MySQL does not support CREATE INDEX IF NOT EXISTS directly until very recent versions,
-- the safest approach without a stored procedure is to provide the standard CREATE INDEX
-- and instruct the user to ignore "Duplicate key name" errors, or add them via ALTER TABLE if needed.

-- Chạy các lệnh tạo Index dưới đây (Nếu báo lỗi "Duplicate key name" thì cứ bỏ qua vì index đã tồn tại)
CREATE INDEX idx_song_semantic_profiles_theme ON song_semantic_profiles(main_theme);
CREATE INDEX idx_song_semantic_profiles_confidence ON song_semantic_profiles(meaning_confidence);
CREATE INDEX idx_song_semantic_profiles_review_status ON song_semantic_profiles(review_status);
CREATE INDEX idx_song_semantic_profiles_evidence_level ON song_semantic_profiles(evidence_level);

/* 
-- HƯỚNG DẪN DÀNH CHO CÁC MÁY ĐÃ LỠ TẠO BẢNG TỪ TRƯỚC:
-- Nếu bạn gặp lỗi "Table 'song_semantic_profiles' already exists" nhưng bị thiếu cột,
-- vui lòng bỏ comment và chạy riêng các lệnh ALTER TABLE sau:

ALTER TABLE song_semantic_profiles
  ADD COLUMN evidence_level ENUM('metadata_only','lyrics_based','audio_features_only','hybrid','external_grounded','manual_reviewed') DEFAULT 'metadata_only';

ALTER TABLE song_semantic_profiles
  ADD COLUMN review_status ENUM('auto','needs_review','approved') DEFAULT 'auto';

ALTER TABLE song_semantic_profiles
  ADD COLUMN external_refs JSON;
*/
