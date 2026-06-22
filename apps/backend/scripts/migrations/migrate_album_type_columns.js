require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { pool } = require('../../src/config/database');

async function migrate() {
  console.log('--- Bắt đầu migration: Thêm cột album_type và total_tracks vào bảng albums ---');
  let connection;
  try {
    connection = await pool.getConnection();
    const dbName = process.env.DB_NAME || 'musicflow_db';

    // Kiểm tra cột album_type
    const [rowsType] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'album_type'
    `, [dbName]);

    if (rowsType.length === 0) {
      console.log('Thêm cột album_type...');
      await connection.query(`ALTER TABLE albums ADD COLUMN album_type VARCHAR(50) DEFAULT 'unknown'`);
      console.log('Đã thêm cột album_type thành công.');
    } else {
      console.log('Cột album_type đã tồn tại, bỏ qua.');
    }

    // Kiểm tra cột total_tracks
    const [rowsTracks] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'total_tracks'
    `, [dbName]);

    if (rowsTracks.length === 0) {
      console.log('Thêm cột total_tracks...');
      await connection.query(`ALTER TABLE albums ADD COLUMN total_tracks INT DEFAULT 0`);
      console.log('Đã thêm cột total_tracks thành công.');
    } else {
      console.log('Cột total_tracks đã tồn tại, bỏ qua.');
    }

    console.log('--- Migration hoàn tất thành công ---');
  } catch (error) {
    console.error('Lỗi khi chạy migration:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

migrate();
