require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');

async function run() {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.id,
        a.name,
        COALESCE(SUM(s.play_count), 0) AS total_from_songs,
        (
          SELECT COUNT(*)
          FROM listening_history lh
          JOIN songs s2 ON s2.id = lh.song_id
          WHERE s2.artist_id = a.id
            AND (
              COALESCE(lh.listen_duration, 0) >= 30
              OR COALESCE(lh.completion_rate, 0) >= 0.5
            )
        ) AS total_from_history,
        (
          SELECT COUNT(*)
          FROM listening_history lh
          JOIN songs s3 ON s3.id = lh.song_id
          WHERE s3.artist_id = a.id
            AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND (
              COALESCE(lh.listen_duration, 0) >= 30
              OR COALESCE(lh.completion_rate, 0) >= 0.5
            )
        ) AS weekly_from_history
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      WHERE a.id = 15
      GROUP BY a.id, a.name;
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
