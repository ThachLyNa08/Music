const { pool } = require('../../src/config/database');

async function test() {
  try {
    const q1 = 'SELECT id, username, display_name, email, avatar_url, role, premium_expires_at, provider FROM users LIMIT 1';
    await pool.query(q1);
    console.log('Query 1 (users) OK');
  } catch(e) { console.error('Error 1:', e.message); }

  try {
    const q2 = `
      SELECT 
        COALESCE(SUM(listen_duration), 0) AS total_listening_seconds,
        COUNT(*) AS total_songs_played,
        COUNT(DISTINCT DATE(listened_at)) AS active_days,
        COUNT(DISTINCT s.artist_id) AS unique_artists,
        COUNT(DISTINCT s.genre_id) AS unique_genres
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      LIMIT 1
    `;
    await pool.query(q2);
    console.log('Query 2 (stats) OK');
  } catch(e) { console.error('Error 2:', e.message); }

  try {
    const q3 = `
      SELECT g.id, g.name, COUNT(*) AS listen_count, SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN genres g ON s.genre_id = g.id
      GROUP BY g.id, g.name LIMIT 1
    `;
    await pool.query(q3);
    console.log('Query 3 (genres) OK');
  } catch(e) { console.error('Error 3:', e.message); }

  try {
    const q4 = `
      SELECT a.id, a.name, a.avatar_url, COUNT(*) AS listen_count, SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      GROUP BY a.id, a.name, a.avatar_url LIMIT 1
    `;
    await pool.query(q4);
    console.log('Query 4 (artists) OK');
  } catch(e) { console.error('Error 4:', e.message); }

  try {
    const q5 = `
      SELECT s.id, s.title, s.cover_url, s.audio_url, s.duration_sec,
      a.id AS artist_id, a.name AS artist_name,
      al.id AS album_id, al.title AS album_title,
      COUNT(*) AS listen_count, SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      GROUP BY s.id, s.title, s.cover_url, s.audio_url, s.duration_sec, a.id, a.name, al.id, al.title
      LIMIT 1
    `;
    await pool.query(q5);
    console.log('Query 5 (tracks) OK');
  } catch(e) { console.error('Error 5:', e.message); }

  try {
    const q6 = `
      SELECT lh.id AS history_id, lh.listened_at, lh.source,
      s.id, s.title, s.cover_url, s.audio_url, s.duration_sec,
      a.id AS artist_id, a.name AS artist_name,
      al.id AS album_id, al.title AS album_title
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LIMIT 1
    `;
    await pool.query(q6);
    console.log('Query 6 (history) OK');
  } catch(e) { console.error('Error 6:', e.message); }

  try {
    const q7 = `
      SELECT p.id, p.title as name, p.cover_url, COUNT(ps.song_id) AS song_count
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      GROUP BY p.id, p.title, p.cover_url LIMIT 1
    `;
    await pool.query(q7);
    console.log('Query 7 (playlists) OK');
  } catch(e) { console.error('Error 7:', e.message); }

  process.exit(0);
}
test();
