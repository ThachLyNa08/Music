require('dotenv').config();
const { pool } = require('./src/config/database');

async function fixNotifications() {
  console.log('Connecting to database...');
  try {
    // 1. Fix 'Karaoke da san sang' -> 'Karaoke đã sẵn sàng'
    const [res1] = await pool.query(`
      UPDATE notifications 
      SET title = 'Karaoke đã sẵn sàng', 
          message = REPLACE(message, 'Bai hat', 'Bài hát'),
          message = REPLACE(message, 'da tach vocal xong va co the hat Karaoke.', 'đã tách vocal xong và có thể hát Karaoke.')
      WHERE type = 'karaoke_ready' AND title = 'Karaoke da san sang'
    `);
    console.log(`Fixed ${res1.affectedRows} 'karaoke_ready' notifications.`);

    // 2. Fix 'Tach Karaoke that bai' -> 'Tách Karaoke thất bại'
    const [res2] = await pool.query(`
      UPDATE notifications 
      SET title = 'Tách Karaoke thất bại', 
          message = REPLACE(message, 'Khong the tach vocal cho bai', 'Không thể tách vocal cho bài hát'),
          message = REPLACE(message, 'Vui long thu lai sau.', 'Vui lòng thử lại sau.')
      WHERE type = 'karaoke_failed' AND title = 'Tach Karaoke that bai'
    `);
    console.log(`Fixed ${res2.affectedRows} 'karaoke_failed' notifications.`);

    console.log('✅ Done fixing notifications!');
  } catch (err) {
    console.error('❌ Error fixing notifications:', err);
  } finally {
    process.exit(0);
  }
}

fixNotifications();
