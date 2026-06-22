require('dotenv').config();
const { pool } = require('../../src/config/database');

async function migrateListeningHistory() {
  console.log('--- Kiểm tra và cập nhật bảng listening_history ---');
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Kiểm tra bảng listening_history đã tồn tại chưa
    const [tables] = await conn.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listening_history'
    `);

    if (tables.length === 0) {
      console.log('Bảng listening_history chưa tồn tại. Đang tạo mới...');
      await conn.query(`
        CREATE TABLE listening_history (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          song_id BIGINT UNSIGNED NOT NULL,
          listen_duration INT DEFAULT 0,
          song_duration INT DEFAULT 0,
          completion_rate DECIMAL(5,2) DEFAULT 0,
          is_completed BOOLEAN DEFAULT FALSE,
          is_skipped BOOLEAN DEFAULT FALSE,
          source VARCHAR(50) DEFAULT 'unknown',
          implicit_rating DECIMAL(3,2) DEFAULT 0,
          listened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_listened_at (user_id, listened_at),
          INDEX idx_song_id (song_id),
          INDEX idx_user_song (user_id, song_id)
        )
      `);
      console.log('✅ Đã tạo bảng listening_history thành công!');
    } else {
      console.log('Bảng listening_history đã tồn tại. Kiểm tra các cột...');
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listening_history'
      `);

      const colNames = columns.map(c => c.COLUMN_NAME);

      const alterQueries = [];

      if (!colNames.includes('listen_duration')) {
        alterQueries.push('ADD COLUMN listen_duration INT DEFAULT 0 AFTER song_id');
      }
      if (!colNames.includes('song_duration')) {
        alterQueries.push('ADD COLUMN song_duration INT DEFAULT 0 AFTER listen_duration');
      }
      if (!colNames.includes('is_completed')) {
        alterQueries.push('ADD COLUMN is_completed BOOLEAN DEFAULT FALSE AFTER completion_rate');
      }
      if (!colNames.includes('is_skipped')) {
        alterQueries.push('ADD COLUMN is_skipped BOOLEAN DEFAULT FALSE AFTER is_completed');
      }
      if (!colNames.includes('listened_at')) {
        // Có thể bảng cũ xài created_at thay cho listened_at. Mình cứ add thêm.
        alterQueries.push('ADD COLUMN listened_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      }
      if (!colNames.includes('created_at')) {
        alterQueries.push('ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      }

      if (alterQueries.length > 0) {
        const alterSql = `ALTER TABLE listening_history ${alterQueries.join(', ')}`;
        console.log(`Đang thêm các cột còn thiếu: ${alterQueries.join(', ')}`);
        await conn.query(alterSql);
        console.log('✅ Đã cập nhật cấu trúc bảng listening_history!');
      } else {
        console.log('✅ Bảng listening_history đã có đầy đủ cấu trúc.');
      }
    }

  } catch (error) {
    console.error('Lỗi khi migrate listening_history:', error);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

migrateListeningHistory();
