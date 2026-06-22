require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'musicflow',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Bắt đầu kiểm tra và thêm các cột cần thiết cho bảng songs và albums...');

    // Migration cho bảng songs
    console.log('--- Kiểm tra bảng songs ---');
    const [songCols] = await connection.query(`SHOW COLUMNS FROM songs`);
    const songColNames = songCols.map(c => c.Field);

    if (!songColNames.includes('spotify_track_id')) {
      await connection.query(`ALTER TABLE songs ADD COLUMN spotify_track_id VARCHAR(100) NULL`);
      console.log('Đã thêm cột spotify_track_id vào bảng songs');
    }
    if (!songColNames.includes('cover_source')) {
      await connection.query(`ALTER TABLE songs ADD COLUMN cover_source VARCHAR(50) NULL`);
      console.log('Đã thêm cột cover_source vào bảng songs');
    }
    if (!songColNames.includes('cover_fetched_at')) {
      await connection.query(`ALTER TABLE songs ADD COLUMN cover_fetched_at DATETIME NULL`);
      console.log('Đã thêm cột cover_fetched_at vào bảng songs');
    }

    // Migration cho bảng albums
    console.log('--- Kiểm tra bảng albums ---');
    const [albumCols] = await connection.query(`SHOW COLUMNS FROM albums`);
    const albumColNames = albumCols.map(c => c.Field);

    if (!albumColNames.includes('cover_url')) {
      await connection.query(`ALTER TABLE albums ADD COLUMN cover_url VARCHAR(500) NULL`);
      console.log('Đã thêm cột cover_url vào bảng albums');
    }
    if (!albumColNames.includes('spotify_album_id')) {
      await connection.query(`ALTER TABLE albums ADD COLUMN spotify_album_id VARCHAR(100) NULL`);
      console.log('Đã thêm cột spotify_album_id vào bảng albums');
    }
    if (!albumColNames.includes('external_url')) {
      await connection.query(`ALTER TABLE albums ADD COLUMN external_url VARCHAR(500) NULL`);
      console.log('Đã thêm cột external_url vào bảng albums');
    }
    if (!albumColNames.includes('cover_source')) {
      await connection.query(`ALTER TABLE albums ADD COLUMN cover_source VARCHAR(50) NULL`);
      console.log('Đã thêm cột cover_source vào bảng albums');
    }
    if (!albumColNames.includes('cover_fetched_at')) {
      await connection.query(`ALTER TABLE albums ADD COLUMN cover_fetched_at DATETIME NULL`);
      console.log('Đã thêm cột cover_fetched_at vào bảng albums');
    }

    console.log('Hoàn tất migration.');
  } catch (err) {
    console.error('Lỗi khi chạy migration:', err);
  } finally {
    await connection.end();
  }
}

migrate();
