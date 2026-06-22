const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'musicflow',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

async function runMigration() {
  console.log('🚀 Bắt đầu chạy Migration thêm các cột avatar nghệ sĩ...');
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log(`✅ Kết nối thành công đến database: ${dbConfig.database}`);

    const queries = [
      {
        name: 'avatar_url',
        sql: "ALTER TABLE artists ADD COLUMN avatar_url VARCHAR(500) NULL"
      },
      {
        name: 'avatar_source',
        sql: "ALTER TABLE artists ADD COLUMN avatar_source VARCHAR(50) NULL"
      },
      {
        name: 'spotify_artist_id',
        sql: "ALTER TABLE artists ADD COLUMN spotify_artist_id VARCHAR(100) NULL"
      },
      {
        name: 'external_url',
        sql: "ALTER TABLE artists ADD COLUMN external_url VARCHAR(500) NULL"
      },
      {
        name: 'avatar_fetched_at',
        sql: "ALTER TABLE artists ADD COLUMN avatar_fetched_at DATETIME NULL"
      }
    ];

    for (const q of queries) {
      try {
        await connection.query(q.sql);
        console.log(`✅ Đã thêm cột ${q.name} thành công.`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️ Cột ${q.name} đã tồn tại trong bảng artists.`);
        } else {
          throw err;
        }
      }
    }

    console.log('🎉 Migration hoàn thành thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi chạy Migration:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
