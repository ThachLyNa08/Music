const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '261999',
    database: process.env.DB_NAME || 'musicflow',
    port: process.env.DB_PORT || 3306,
  });

  const [rows] = await connection.query("SELECT id, title, audio_url FROM songs WHERE audio_url LIKE '%M/V%' OR audio_url LIKE '%/%' LIMIT 20");
  console.log('Songs with / in audio_url:');
  console.table(rows);
  
  const [columns] = await connection.query("DESCRIBE songs");
  console.log('Columns in songs table:');
  console.table(columns.map(c => ({ Field: c.Field, Type: c.Type })));

  await connection.end();
}

run().catch(console.error);
