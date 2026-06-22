-- Seed Artists
INSERT IGNORE INTO artists (id, name) VALUES 
(7, 'SoundHelix'),
(8, 'Pixabay Free Music');

-- Seed Albums
INSERT IGNORE INTO albums (id, artist_id, title) VALUES 
(1, 7, 'Free Music Collection'),
(2, 8, 'Vlog & Chill');

-- Seed Songs
INSERT IGNORE INTO songs (id, album_id, artist_id, genre_id, title, duration_sec, audio_url, cover_url, play_count) VALUES 
(1, 1, 7, 3, 'SoundHelix Song 1 (EDM)', 372, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80', 100),
(2, 1, 7, 1, 'SoundHelix Song 2 (Lofi)', 425, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80', 250),
(3, 1, 7, 4, 'SoundHelix Song 3 (Pop)', 344, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80', 80),
(4, 1, 7, 8, 'SoundHelix Song 4 (Hip-hop)', 302, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&q=80', 15),
(5, 2, 8, 2, 'Acoustic Breeze', 157, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&q=80', 500),
(6, 2, 8, 1, 'Lofi Chill Vibes', 200, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80', 1200);

-- Thêm vài lượt nghe để có data thống kê (Tài khoản Test User của bạn id=7)
INSERT IGNORE INTO listening_history (user_id, song_id, completion_rate, source, implicit_rating) VALUES
(7, 1, 1.0, 'search', 3.5),
(7, 2, 0.8, 'playlist', 2.4),
(7, 5, 1.0, 'recommend', 3.0),
(7, 6, 0.5, 'search', 1.5);
