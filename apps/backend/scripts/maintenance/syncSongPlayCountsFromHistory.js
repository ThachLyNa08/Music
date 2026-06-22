require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');

async function syncPlayCounts(dryRun = true) {
  console.log('--- SYNC SONG PLAY COUNTS FROM HISTORY ---');
  console.log(`Chế độ: ${dryRun ? 'DRY-RUN (Không cập nhật thật)' : 'THỰC THI (Cập nhật database)'}`);

  try {
    // 1. Kiểm tra thống kê hiện tại (Dry run)
    const [stats] = await pool.query(`
      SELECT 
        s.id, s.title, s.play_count as old_play_count,
        COALESCE(lh.real_play_count, 0) as new_play_count,
        CAST(COALESCE(lh.real_play_count, 0) AS SIGNED) - CAST(s.play_count AS SIGNED) as diff
      FROM songs s
      LEFT JOIN (
        SELECT song_id, COUNT(*) AS real_play_count
        FROM listening_history
        WHERE song_id IS NOT NULL
          AND (listen_duration >= 30 OR completion_rate >= 0.5)
        GROUP BY song_id
      ) lh ON lh.song_id = s.id
      WHERE CAST(COALESCE(lh.real_play_count, 0) AS SIGNED) != CAST(s.play_count AS SIGNED)
    `);

    console.log(`\nCó ${stats.length} bài hát cần được đồng bộ lượt nghe.`);
    
    if (stats.length > 0) {
      console.log('Top 10 bài hát bị lệch nhiều nhất:');
      stats.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
           .slice(0, 10)
           .forEach(s => {
             console.log(`- Bài hát ID ${s.id} (${s.title}): Cũ = ${s.old_play_count}, Mới = ${s.new_play_count}, Lệch = ${s.diff}`);
           });
    }

    if (!dryRun && stats.length > 0) {
      console.log('\nĐang tiến hành cập nhật...');
      const [updateRes] = await pool.query(`
        UPDATE songs s
        LEFT JOIN (
          SELECT song_id, COUNT(*) AS real_play_count
          FROM listening_history
          WHERE song_id IS NOT NULL
            AND (listen_duration >= 30 OR completion_rate >= 0.5)
          GROUP BY song_id
        ) lh ON lh.song_id = s.id
        SET s.play_count = COALESCE(lh.real_play_count, 0)
      `);
      console.log(`Cập nhật thành công. Đã thay đổi ${updateRes.changedRows} dòng.`);
    }

    // Kiểm tra nghệ sĩ mẫu (Ví dụ ID 15)
    console.log('\n--- Kiểm tra nghệ sĩ ID = 15 (BLACKPINK) ---');
    const [artistCheck] = await pool.query(`
      SELECT 
        a.id, 
        a.name,
        COALESCE(SUM(s.play_count), 0) AS total_from_songs,
        (
          SELECT COUNT(*)
          FROM listening_history lh
          JOIN songs s2 ON s2.id = lh.song_id
          WHERE s2.artist_id = a.id
            AND (lh.listen_duration >= 30 OR lh.completion_rate >= 0.5)
        ) AS total_from_history,
        (
          SELECT COUNT(*)
          FROM listening_history lh
          JOIN songs s3 ON s3.id = lh.song_id
          WHERE s3.artist_id = a.id
            AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND (lh.listen_duration >= 30 OR lh.completion_rate >= 0.5)
        ) AS weekly_from_history
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      WHERE a.id = 15
      GROUP BY a.id, a.name
    `);

    if (artistCheck.length > 0) {
      console.log(`Nghệ sĩ: ${artistCheck[0].name}`);
      console.log(`Tổng từ songs.play_count: ${artistCheck[0].total_from_songs}`);
      console.log(`Tổng từ listening_history (All-time): ${artistCheck[0].total_from_history}`);
      console.log(`Lượt nghe từ listening_history (7 ngày): ${artistCheck[0].weekly_from_history}`);
    } else {
      console.log('Không tìm thấy nghệ sĩ ID 15.');
    }

  } catch (error) {
    console.error('Lỗi khi đồng bộ:', error);
  } finally {
    process.exit(0);
  }
}

// Lấy tham số dry-run từ command line (mặc định là true nếu không truyền --execute)
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');

syncPlayCounts(!isExecute);
