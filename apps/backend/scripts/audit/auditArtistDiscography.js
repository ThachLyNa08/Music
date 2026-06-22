const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function urlToFilePath(audioUrl) {
  if (!audioUrl) return null;
  let clean = audioUrl.replace(/^https?:\/\/[^/]+/i, '');
  if (clean.startsWith('/uploads/')) {
    return path.join(__dirname, '..', '..', clean.replace('/uploads/', 'uploads/'));
  }
  return path.join(__dirname, '..', '..', 'uploads', clean.replace(/^\/+/, ''));
}

async function run() {
  const args = process.argv.slice(2);
  let artistName = null;
  let artistId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artist' && args[i + 1]) artistName = args[i + 1];
    if (args[i] === '--artistId' && args[i + 1]) artistId = Number(args[i + 1]);
  }

  if (!artistName && !artistId) {
    console.error('❌ Vui lòng cung cấp --artist "Tên Nghệ Sĩ" hoặc --artistId 123');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '261999',
      database: process.env.DB_NAME || 'musicflow',
      port: process.env.DB_PORT || 3306,
    });

    // Tìm nghệ sĩ
    let artistRow = null;
    if (artistId) {
      const [rows] = await connection.query('SELECT * FROM artists WHERE id = ?', [artistId]);
      artistRow = rows[0];
    } else {
      const [rows] = await connection.query('SELECT * FROM artists WHERE name LIKE ?', [`%${artistName}%`]);
      artistRow = rows[0];
    }

    if (!artistRow) {
      console.error('❌ Không tìm thấy nghệ sĩ.');
      process.exit(1);
    }

    console.log(`\n🔍 Đang Audit Discography cho nghệ sĩ: ${artistRow.name} (ID: ${artistRow.id})\n`);

    // Lấy bài hát
    const [songs] = await connection.query(`
      SELECT s.id, s.title, s.album_id, s.audio_url, al.title as album_title, al.album_type
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ?
      ORDER BY s.title ASC
    `, [artistRow.id]);

    // Lấy album
    const [albums] = await connection.query(`
      SELECT al.id, al.title, al.album_type, al.total_tracks,
             (SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) as real_track_count
      FROM albums al
      WHERE al.artist_id = ?
    `, [artistRow.id]);

    console.log(`📊 Tổng số bài hát: ${songs.length}`);
    console.log(`💿 Tổng số album/single: ${albums.length}`);

    // Phân tích Missing Album
    const missingAlbumSongs = songs.filter(s => !s.album_id);
    console.log(`\n⚠️ Bài hát thiếu Album: ${missingAlbumSongs.length}`);
    if (missingAlbumSongs.length > 0) {
      missingAlbumSongs.slice(0, 5).forEach(s => console.log(`   - ID: ${s.id} | ${s.title}`));
      if (missingAlbumSongs.length > 5) console.log('   ...');
    }

    // Phân tích Trùng tên
    const titleCounts = {};
    songs.forEach(s => {
      const lower = s.title.trim().toLowerCase();
      titleCounts[lower] = (titleCounts[lower] || 0) + 1;
    });
    const duplicates = Object.entries(titleCounts).filter(([_, count]) => count > 1);
    console.log(`\n⚠️ Bài hát bị trùng tên: ${duplicates.length}`);
    if (duplicates.length > 0) {
      duplicates.forEach(([title, count]) => console.log(`   - "${title}" (Xuất hiện ${count} lần)`));
    }

    // Phân tích Audio Missing
    let missingAudioCount = 0;
    songs.forEach(s => {
      const p = urlToFilePath(s.audio_url);
      if (!p || !fs.existsSync(p)) missingAudioCount++;
    });
    console.log(`\n⚠️ Bài hát bị mất file audio thật (không phát được): ${missingAudioCount}`);

    // Phân tích Suspicious Album Mapping
    console.log(`\n⚠️ Album/Single có dấu hiệu bất thường:`);
    let suspiciousCount = 0;
    for (const al of albums) {
      // Ví dụ: Album type là 'album' nhưng chỉ có 1 bài (có thể là Single)
      if (al.album_type === 'album' && al.real_track_count <= 2) {
        console.log(`   - [Loại sai?] "${al.title}" đang là 'album' nhưng chỉ có ${al.real_track_count} bài.`);
        suspiciousCount++;
      }
      // Ví dụ: Album type là 'single' nhưng có nhiều bài
      if (al.album_type === 'single' && al.real_track_count > 3) {
        console.log(`   - [Loại sai?] "${al.title}" đang là 'single' nhưng có tận ${al.real_track_count} bài.`);
        suspiciousCount++;
      }
      // Ví dụ: Tên chung chung
      if (al.title.toLowerCase() === 'single' || al.title.toLowerCase() === 'album') {
        console.log(`   - [Tên chung chung] ID: ${al.id} có tên là "${al.title}" thay vì tên thật.`);
        suspiciousCount++;
      }
    }
    if (suspiciousCount === 0) console.log('   - Không có bất thường.');

    console.log('\n✅ Audit hoàn tất.\n');

  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    if (connection) await connection.end();
  }
}

run();
