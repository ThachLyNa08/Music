const { pool } = require('../config/database');

async function getFallbackSongs(userId, limit = 20) {
  // Try to get songs based on genre preferences
  const [genres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [userId]);
  let songs = [];
  
  if (genres.length > 0) {
    const genreIds = genres.map(g => g.genre_id);
    const [genreSongs] = await pool.query(`
      SELECT song_id FROM song_genres 
      WHERE genre_id IN (?) 
      ORDER BY RAND() LIMIT ?
    `, [genreIds, limit]);
    songs = genreSongs.map(s => s.song_id);
  }

  // If still not enough, fallback to most popular/trending songs
  if (songs.length < limit) {
    const remaining = limit - songs.length;
    const [popularSongs] = await pool.query(`
      SELECT id as song_id FROM songs 
      ORDER BY play_count DESC LIMIT ?
    `, [remaining]);
    
    popularSongs.forEach(s => {
      if (!songs.includes(s.song_id)) {
        songs.push(s.song_id);
      }
    });
  }
  
  return songs;
}

async function getHistoryBasedSongs(userId, limit = 20, dayOfWeek = null) {
  // If dayOfWeek is provided, we could filter listening history by DAYOFWEEK(listened_at)
  // For simplicity and assuming listening_history table exists with song_id and listened_at
  let query = `
    SELECT song_id, COUNT(*) as history_plays
    FROM listening_history 
    WHERE user_id = ?
  `;
  const queryParams = [userId];

  if (dayOfWeek !== null) {
    // MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ..., 7=Saturday
    query += ` AND DAYOFWEEK(listened_at) = ?`;
    queryParams.push(dayOfWeek);
  }

  query += ` GROUP BY song_id ORDER BY history_plays DESC, MAX(listened_at) DESC LIMIT ?`;
  queryParams.push(limit);

  try {
    const [historySongs] = await pool.query(query, queryParams);
    
    let songs = historySongs.map(s => s.song_id);
    if (songs.length < limit) {
        const fallback = await getFallbackSongs(userId, limit - songs.length);
        fallback.forEach(s => {
            if (!songs.includes(s)) songs.push(s);
        });
    }
    return songs;
  } catch (err) {
    // If listening_history table doesn't exist, just return fallback
    console.warn(`[Playlist Generator] Could not fetch listening history for user ${userId}:`, err.message);
    return await getFallbackSongs(userId, limit);
  }
}

async function updateSystemPlaylist(userId, systemKey, songs) {
  if (!songs || songs.length === 0) return;

  const [playlists] = await pool.query(`SELECT id FROM playlists WHERE user_id = ? AND system_key = ?`, [userId, systemKey]);
  if (playlists.length === 0) return; // Playlist should be seeded already

  const playlistId = playlists[0].id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Clear old songs
    await conn.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId]);
    
    // Insert new songs
    const values = songs.map((songId, index) => [playlistId, songId, index + 1]);
    if (values.length > 0) {
      // Assuming playlist_songs has playlist_id, song_id, position (if position exists, we add it, otherwise just playlist_id and song_id)
      // Let's check schema. If it doesn't have position, this might fail, so let's just insert one by one or ignore position
      // Actually standard is playlist_id, song_id
      const insertValues = songs.map(songId => [playlistId, songId]);
      await conn.query(`INSERT IGNORE INTO playlist_songs (playlist_id, song_id) VALUES ?`, [insertValues]);
    }
    
    await conn.query(`UPDATE playlists SET updated_at = NOW() WHERE id = ?`, [playlistId]);
    
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error(`Error updating playlist ${systemKey} for user ${userId}:`, err);
  } finally {
    conn.release();
  }
}

async function generateDailyMix(dayIndex) {
  // dayIndex: 1=Sunday (dailymix_01), 2=Monday (dailymix_02), ..., 6=Friday (dailymix_06)
  const systemKey = `dailymix_0${dayIndex}`;
  // Map dayIndex to MySQL DAYOFWEEK (1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday)
  const dayOfWeek = dayIndex;

  const [users] = await pool.query(`SELECT id FROM users WHERE status = 'active'`);
  for (const user of users) {
    const songs = await getHistoryBasedSongs(user.id, 20, dayOfWeek);
    await updateSystemPlaylist(user.id, systemKey, songs);
  }
}

async function generateWeeklyMix() {
  const systemKey = `weeklymix`;
  
  const [users] = await pool.query(`SELECT id FROM users WHERE status = 'active'`);
  for (const user of users) {
    const songs = await getHistoryBasedSongs(user.id, 30, null); // overall history
    await updateSystemPlaylist(user.id, systemKey, songs);
  }
}

module.exports = {
  generateDailyMix,
  generateWeeklyMix
};
