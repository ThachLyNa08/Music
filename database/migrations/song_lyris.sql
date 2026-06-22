USE musicflow;

CREATE TABLE IF NOT EXISTS song_lyrics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  song_id INT UNSIGNED NOT NULL,
  provider VARCHAR(50) DEFAULT 'lrclib',
  provider_lyric_id VARCHAR(100) NULL,
  sync_type ENUM('LINE_SYNCED', 'PLAIN_TEXT', 'INSTRUMENTAL', 'NONE') DEFAULT 'NONE',
  plain_lyrics LONGTEXT NULL,
  synced_lyrics LONGTEXT NULL,
  lyrics_json JSON NULL,
  source_url TEXT NULL,
  confidence_score DECIMAL(5,2) DEFAULT 0,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_song_lyrics (song_id),
  CONSTRAINT fk_song_lyrics_song
    FOREIGN KEY (song_id) REFERENCES songs(id)
    ON DELETE CASCADE
);

SHOW TABLES LIKE 'song_lyrics';

SELECT song_id, provider, sync_type, provider_lyric_id
FROM song_lyrics
LIMIT 100;

#Thống kê theo loại lyrics
SELECT 
  sync_type,
  COUNT(*) AS total
FROM song_lyrics
GROUP BY sync_type
ORDER BY total DESC;

#xem còn thiếu theo từng nhóm nhạc
SELECT 
  g.name AS genre,
  COUNT(*) AS total_missing
FROM songs s
LEFT JOIN song_lyrics sl ON sl.song_id = s.id
LEFT JOIN genres g ON g.id = s.genre_id
WHERE sl.song_id IS NULL
GROUP BY g.name
ORDER BY total_missing DESC;

#Đếm tổng bài có Lyrics
SELECT COUNT(*) AS total_songs_with_lyrics
FROM song_lyrics
WHERE sync_type IN ('LINE_SYNCED', 'PLAIN_TEXT', 'INSTRUMENTAL');

#Thống kê theo provider:
SELECT 
  provider,
  sync_type,
  COUNT(*) AS total
FROM song_lyrics
GROUP BY provider, sync_type
ORDER BY provider, sync_type;

#còn bao nhiêu bài chưa có lyrics
SELECT 
  COUNT(*) AS songs_without_lyrics
FROM songs s
LEFT JOIN song_lyrics sl ON sl.song_id = s.id
WHERE sl.song_id IS NULL;

#tỷ lệ đã có lyrics trên tổng bài
SELECT
  (SELECT COUNT(*) FROM songs) AS total_songs,
  (SELECT COUNT(*) FROM song_lyrics WHERE sync_type IN ('LINE_SYNCED', 'PLAIN_TEXT', 'INSTRUMENTAL')) AS songs_with_lyrics,
  ROUND(
    (SELECT COUNT(*) FROM song_lyrics WHERE sync_type IN ('LINE_SYNCED', 'PLAIN_TEXT', 'INSTRUMENTAL')) 
    / (SELECT COUNT(*) FROM songs) * 100,
    2
  ) AS coverage_percent;
  
  SELECT 
  id,
  title,
  artist,
  LEFT(lyrics, 200) AS lyrics_preview,
  LEFT(synced_lyrics, 200) AS synced_preview,
  lyrics IS NOT NULL AS has_lyrics,
  synced_lyrics IS NOT NULL AS has_synced
FROM songs
WHERE title LIKE '%BOOMBAYAH%'
   OR title LIKE '%붐바야%';
SHOW COLUMNS FROM songs;

ALTER TABLE songs
ADD COLUMN synced_lyrics LONGTEXT NULL AFTER lyrics,
ADD COLUMN lyrics_sync_type VARCHAR(50) NULL AFTER synced_lyrics,
ADD COLUMN lyrics_provider VARCHAR(50) NULL AFTER lyrics_sync_type,
ADD COLUMN lyrics_provider_id VARCHAR(100) NULL AFTER lyrics_provider,
ADD COLUMN lyrics_updated_at TIMESTAMP NULL AFTER lyrics_provider_id;

SHOW COLUMNS FROM songs LIKE '%lyric%';

SELECT
  id,
  title,
  LEFT(lyrics, 100) AS plain_preview,
  LEFT(synced_lyrics, 120) AS synced_preview,
  lyrics_sync_type,
  lyrics_provider,
  lyrics_provider_id
FROM songs
WHERE id IN (1, 3166, 5296);

SELECT id, title, audio_url, duration
FROM songs
WHERE title LIKE '%Bóng Phù Hoa%'
   OR title LIKE '%Bong Phu Hoa%';
   
SELECT id, title, audio_url
FROM songs
WHERE id = 3860;

UPDATE songs
SET audio_url = '/uploads/music/final_songs/Vpop/Phương Mỹ Chi/Vũ Trụ Cò Bay/Bóng Phù Hoa.mp3'
WHERE id = 3860;