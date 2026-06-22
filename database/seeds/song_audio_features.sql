CREATE TABLE song_audio_features (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  song_id INT UNSIGNED NOT NULL UNIQUE,

  bpm FLOAT NULL,
  tempo_level ENUM('slow','medium','fast') DEFAULT 'medium',

  energy_score FLOAT NULL,
  energy ENUM('low','medium','high') DEFAULT 'medium',

  danceability FLOAT NULL,
  acoustic_score FLOAT NULL,
  brightness FLOAT NULL,

  mood VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  vibe VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_song_audio_features_song
    FOREIGN KEY (song_id) REFERENCES songs(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
COMMENT='Đặc trưng âm thanh trích xuất từ file audio phục vụ AI Playlist';

SHOW CREATE TABLE songs;

SELECT s.id, s.title, s.market, saf.bpm, saf.energy, saf.tempo_level, saf.mood, saf.vibe
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
ORDER BY saf.analyzed_at DESC
LIMIT 20;

DESCRIBE song_audio_features;

SELECT 
  s.id,
  s.title,
  s.market,
  saf.bpm,
  saf.tempo_level,
  saf.energy,
  saf.energy_score,
  saf.mood,
  saf.vibe,
  saf.analyzed_at
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
WHERE s.market = 'KPOP'
ORDER BY saf.analyzed_at DESC
LIMIT 10;

SELECT COUNT(*) AS total_analyzed
FROM song_audio_features;

SELECT s.market, COUNT(*) AS analyzed_count
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
GROUP BY s.market;

SELECT mood, COUNT(*) AS total
FROM song_audio_features
GROUP BY mood
ORDER BY total DESC;

SELECT 
  s.id,
  s.title,
  s.market,
  saf.bpm,
  saf.tempo_level,
  saf.energy_score,
  saf.energy,
  saf.danceability,
  saf.acoustic_score,
  saf.brightness,
  saf.mood,
  saf.vibe
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
WHERE s.market = 'KPOP'
ORDER BY saf.analyzed_at DESC
LIMIT 20;

#Kiểm tra phân bố:
SELECT s.market, saf.mood, COUNT(*) AS total
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
GROUP BY s.market, saf.mood
ORDER BY s.market, total DESC;

#Kiểm tra VPOP đã phân tích
SELECT s.market, COUNT(*) AS analyzed_count
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
WHERE s.market = 'VPOP'
GROUP BY s.market;

SELECT COUNT(*) AS vpop_not_analyzed
FROM songs s
LEFT JOIN song_audio_features saf ON saf.song_id = s.id
WHERE s.market = 'VPOP'
  AND s.is_active = 1
  AND s.audio_url IS NOT NULL
  AND saf.song_id IS NULL;

SELECT id, title, market, audio_url
FROM songs
WHERE market = 'VPOP'
  AND is_active = 1
  AND audio_url IS NOT NULL
LIMIT 20;

SELECT s.market, COUNT(*) AS analyzed_count
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
WHERE s.market = 'VPOP'
GROUP BY s.market;

SELECT COUNT(*) AS total_vpop_with_audio
FROM songs
WHERE market = 'VPOP'
  AND is_active = 1
  AND audio_url IS NOT NULL;

SELECT market, COUNT(*) AS total
FROM songs
GROUP BY market;

SELECT g.name AS genre_name, s.market, COUNT(*) AS total
FROM songs s
LEFT JOIN genres g ON g.id = s.genre_id
GROUP BY g.name, s.market
ORDER BY total DESC;

UPDATE songs s
JOIN genres g ON g.id = s.genre_id
SET s.market = 'KPOP'
WHERE g.name LIKE 'KPOP%';

UPDATE songs s
JOIN genres g ON g.id = s.genre_id
SET s.market = 'VPOP'
WHERE g.name LIKE 'VPOP%'
   OR g.name = 'V-pop';
   
UPDATE songs s
JOIN genres g ON g.id = s.genre_id
SET s.market = 'USUK'
WHERE g.name LIKE 'USUK%';

SELECT s.market, COUNT(*) AS total
FROM songs s
GROUP BY s.market;

SELECT g.name AS genre_name, s.market, COUNT(*) AS total
FROM songs s
LEFT JOIN genres g ON g.id = s.genre_id
GROUP BY g.name, s.market
ORDER BY total DESC;

SELECT market,
       COUNT(*) AS total,
       SUM(audio_url IS NOT NULL AND audio_url <> '') AS has_audio
FROM songs
GROUP BY market;

SELECT market, COUNT(*) AS total
FROM songs
GROUP BY market;

SELECT s.market, COUNT(*) AS not_analyzed
FROM songs s
LEFT JOIN song_audio_features saf ON saf.song_id = s.id
WHERE s.is_active = 1
  AND s.audio_url IS NOT NULL
  AND s.audio_url <> ''
  AND saf.song_id IS NULL
GROUP BY s.market;


SELECT s.market, saf.mood, COUNT(*) AS total
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
GROUP BY s.market, saf.mood
ORDER BY s.market, total DESC;

SELECT 
  COUNT(*) AS invalid_party_recent
FROM song_audio_features
WHERE mood = 'party'
  AND analyzed_at >= NOW() - INTERVAL 30 MINUTE
  AND (
    tempo_level <> 'fast'
    OR bpm < 120
    OR energy <> 'high'
    OR danceability < 0.78
  );
  
  SELECT 
  s.id,
  s.title,
  s.market,
  saf.bpm,
  saf.tempo_level,
  saf.energy,
  saf.energy_score,
  saf.danceability,
  saf.mood,
  saf.vibe,
  saf.analyzed_at,
  CASE
    WHEN saf.tempo_level <> 'fast' THEN 'tempo_not_fast'
    WHEN saf.bpm < 120 THEN 'bpm_under_120'
    WHEN saf.energy <> 'high' THEN 'energy_not_high'
    WHEN saf.danceability < 0.78 THEN 'danceability_under_078'
    ELSE 'unknown'
  END AS invalid_reason
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
WHERE saf.mood = 'party'
  AND saf.analyzed_at >= NOW() - INTERVAL 30 MINUTE
  AND (
    saf.tempo_level <> 'fast'
    OR saf.bpm < 120
    OR saf.energy <> 'high'
    OR saf.danceability < 0.78
  )
ORDER BY saf.analyzed_at DESC;

SELECT COUNT(*) AS invalid_party_recent
FROM song_audio_features
WHERE mood = 'party'
  AND analyzed_at >= NOW() - INTERVAL 10 MINUTE
  AND (
    tempo_level <> 'fast'
    OR bpm < 120
    OR energy <> 'high'
    OR ROUND(danceability, 2) < 0.78
  );
  
SELECT s.market, saf.mood, COUNT(*) AS total
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
GROUP BY s.market, saf.mood
ORDER BY s.market, total DESC;