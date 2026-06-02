-- Migration: Create artist_follows table
-- Run this script to add the artist_follows table to the database

CREATE TABLE IF NOT EXISTS artist_follows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  artist_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_user_artist_follow (user_id, artist_id),
  INDEX idx_artist_follows_user_id (user_id),
  INDEX idx_artist_follows_artist_id (artist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
