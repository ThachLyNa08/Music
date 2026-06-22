const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool } = require('../../src/config/database');

const dbPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
if (!dbPassword) {
  console.warn("WARNING: DB_PASSWORD is empty. Please check apps/backend/.env");
}

async function normalizeSongPlayCounts(options = { dryRun: true, limit: 0 }) {
  console.log(`Starting play count normalization... ${options.dryRun ? '(DRY RUN)' : '(APPLYING)'}`);
  
  const conn = await pool.getConnection();
  try {
    // Lấy tất cả bài hát cùng với like_count và history_count
    let query = `
      SELECT 
        s.id, 
        s.title, 
        s.play_count as current_play_count,
        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) as like_count,
        (SELECT COUNT(*) FROM listening_history lh WHERE lh.song_id = s.id) as history_count
      FROM songs s
    `;
    if (options.limit > 0) {
      query += ` LIMIT ${options.limit}`;
    }

    const [songs] = await conn.query(query);
    console.log(`Found ${songs.length} songs to process.`);

    let updatedCount = 0;

    for (const song of songs) {
      const currentPlayCount = Number(song.current_play_count) || 0;
      const likeCount = Number(song.like_count) || 0;
      const historyCount = Number(song.history_count) || 0;

      let minimumReasonablePlayCount = currentPlayCount;

      if (likeCount > 0) {
        const multiplier = 3 + (song.id % 6);
        const offset = song.id % Math.max(5, likeCount);
        minimumReasonablePlayCount = likeCount * multiplier + offset;
      }

      const newPlayCount = Math.max(currentPlayCount, historyCount, minimumReasonablePlayCount);

      if (newPlayCount > currentPlayCount) {
        if (options.dryRun) {
          console.log(`[DRY RUN] Song ${song.id} "${song.title}":`);
          console.log(`  - current_play_count: ${currentPlayCount}`);
          console.log(`  - like_count: ${likeCount}`);
          console.log(`  - history_count: ${historyCount}`);
          console.log(`  -> new_play_count: ${newPlayCount}`);
        } else {
          await conn.query('UPDATE songs SET play_count = ? WHERE id = ?', [newPlayCount, song.id]);
          console.log(`[UPDATED] Song ${song.id} "${song.title}": play_count set to ${newPlayCount}`);
        }
        updatedCount++;
      }
    }

    console.log(`\nFinished normalization. ${updatedCount} songs ${options.dryRun ? 'would be' : 'were'} updated.`);
  } catch (error) {
    console.error('Error normalizing play counts:', error);
  } finally {
    conn.release();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: true,
  limit: 0
};

if (args.includes('--apply')) {
  options.dryRun = false;
}

const limitArg = args.find(arg => arg.startsWith('--limit='));
if (limitArg) {
  options.limit = parseInt(limitArg.split('=')[1], 10);
}

normalizeSongPlayCounts(options).then(() => process.exit(0));
