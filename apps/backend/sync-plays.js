const { pool } = require('./src/config/database');

async function syncPlays() {
  try {
    console.log('Starting sync...');
    const [songs] = await pool.query('SELECT id, play_count FROM songs');
    
    let updatedCount = 0;
    for (const song of songs) {
      const [[{ count }]] = await pool.query('SELECT COUNT(*) as count FROM listening_history WHERE song_id = ?', [song.id]);
      
      // We take the max of existing play_count and history count, in case play_count had anonymous listens.
      // Or we can just set it to the max of both, or just add them?
      // If listening_history has 232, and play_count is 94, they should at least be 232.
      const realPlays = Math.max(song.play_count || 0, count);
      
      if (realPlays !== song.play_count) {
        await pool.query('UPDATE songs SET play_count = ? WHERE id = ?', [realPlays, song.id]);
        updatedCount++;
      }
    }
    console.log(`Sync completed. Updated ${updatedCount} songs.`);
  } catch (err) {
    console.error('Error during sync:', err);
  } finally {
    process.exit(0);
  }
}

syncPlays();
