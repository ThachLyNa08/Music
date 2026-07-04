const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  database: process.env.DB_NAME || 'musicflow',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    if (process.argv.includes('--debug')) {
      console.log('MySQL connected successfully');
    }
    conn.release();
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    console.error('Run `npm run migrate` after configuring the database if schema objects are missing.');
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
