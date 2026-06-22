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
    console.log('Connected');
    
    const [desc] = await conn.query('DESCRIBE playlists');
    console.log('Playlists schema:', desc);

    const [desc2] = await conn.query('DESCRIBE user_saved_playlists');
    console.log('Saved schema:', desc2);
    
    conn.release();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
run();
