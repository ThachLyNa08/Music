CREATE TABLE IF NOT EXISTS stem_separation_jobs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  user_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,

  job_id VARCHAR(64) NULL,
  locked_by VARCHAR(128) NULL,

  status ENUM('pending', 'processing', 'completed', 'failed', 'stale', 'cancelled')
    NOT NULL DEFAULT 'pending',

  progress INT UNSIGNED NOT NULL DEFAULT 0,

  input_audio_url VARCHAR(500) NULL,
  vocals_url VARCHAR(500) NULL,
  instrumental_url VARCHAR(500) NULL,

  error_message TEXT NULL,
  started_at DATETIME NULL,
  heartbeat_at DATETIME NULL,
  completed_at DATETIME NULL,
  failed_at DATETIME NULL,
  retry_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_stem_user_song (user_id, song_id),
  INDEX idx_stem_status (status),
  INDEX idx_stem_created_at (created_at),

  CONSTRAINT fk_stem_jobs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_stem_jobs_song
    FOREIGN KEY (song_id) REFERENCES songs(id)
    ON DELETE CASCADE
);

SELECT 
  ss.song_id,
  s.title,
  ss.status,
  LEFT(ss.error_message, 1000) AS error_message,
  ss.updated_at
FROM song_stems ss
LEFT JOIN songs s ON s.id = ss.song_id
WHERE ss.status = 'failed'
ORDER BY ss.updated_at DESC
LIMIT 10;

SELECT 
  ss.song_id,
  s.title,
  ss.status,
  LEFT(ss.error_message, 1500) AS error_message,
  ss.updated_at
FROM song_stems ss
LEFT JOIN songs s ON s.id = ss.song_id
WHERE ss.status = 'failed'
ORDER BY ss.updated_at DESC
LIMIT 10;

SELECT 
  LEFT(error_message, 500) AS error_message,
  COUNT(*) AS total
FROM song_stems
WHERE status = 'failed'
GROUP BY LEFT(error_message, 500)
ORDER BY total DESC
LIMIT 10;

SELECT song_id, status, vocals_url, instrumental_url, error_message, processed_at
FROM song_stems
WHERE song_id = 3658;

DELETE FROM song_stems
WHERE song_id = 3860;
