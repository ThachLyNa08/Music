const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  try {
    const pool = mysql.createPool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME     || 'musicflow',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    const conn = await pool.getConnection();
    
    for (const table of ['songs', 'genres', 'listening_history', 'song_genres']) {
        try {
            const [desc] = await conn.query(`DESCRIBE ${table}`);
            console.log(`\nTable ${table}:`);
            console.table(desc);
        } catch (e) {
            console.log(`Table ${table} not found or error:`, e.message);
        }
    }
    
    conn.release();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
run();
