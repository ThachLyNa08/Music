const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function urlToFilePath(audioUrl) {
  if (!audioUrl) return null;

  let clean = audioUrl;
  // Remove domain if absolute URL
  clean = clean.replace(/^https?:\/\/[^/]+/i, '');

  if (clean.startsWith('/uploads/')) {
    return path.join(__dirname, '..', clean.replace('/uploads/', 'uploads/'));
  }

  // fallback logic
  return path.join(__dirname, '..', 'uploads', clean.replace(/^\/+/, ''));
}

async function run() {
  console.log('🔄 Đang kiểm tra file âm thanh trong database...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '261999',
      database: process.env.DB_NAME || 'musicflow',
      port: process.env.DB_PORT || 3306,
    });

    const [songs] = await connection.query(`
      SELECT s.id, s.title, a.name as artist_name, s.audio_url 
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      ORDER BY s.id DESC
    `);

    const results = [];
    let missingCount = 0;

    for (const song of songs) {
      const raw = song.audio_url;
      const filePath = urlToFilePath(raw);
      const exists = filePath ? fs.existsSync(filePath) : false;

      if (!exists) missingCount++;

      results.push({
        id: song.id,
        title: song.title,
        artist: song.artist_name,
        audio_url: raw,
        resolved_path: filePath,
        status: exists ? 'OK' : 'MISSING'
      });
    }

    const missingOnly = results.filter(r => r.status === 'MISSING');

    if (missingOnly.length > 0) {
      console.log(`\n❌ Đã tìm thấy ${missingOnly.length} bài hát bị missing audio path:`);
      console.table(missingOnly);
    } else {
      console.log('\n✅ Tất cả file âm thanh đều tồn tại!');
    }
    
    console.log(`\nTổng kết: Missing ${missingCount}/${songs.length} bài hát.`);

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run().catch(console.error);
