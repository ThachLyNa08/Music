const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\b(m\/v|mv|official mv|official music video|music video|audio|lyrics|lyric video|remastered)\b/g, '')
    .replace(/[\[\]\(\)\{\}]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  const args = process.argv.slice(2);
  let filePath = null;
  let isApply = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) filePath = args[i + 1];
    if (args[i] === '--apply') isApply = true;
  }

  if (!filePath || !fs.existsSync(filePath)) {
    console.error('❌ Vui lòng cung cấp file JSON hợp lệ: --file backend/data/discography/ten-nghe-si.json');
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  let discography;
  try {
    discography = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ Lỗi parse JSON:', err.message);
    process.exit(1);
  }

  const artistName = discography.artist?.name;
  if (!artistName) {
    console.error('❌ File JSON thiếu thông tin artist.name');
    process.exit(1);
  }

  console.log(`🚀 Bắt đầu IMPORT/REPAIR DISCOGRAPHY: ${isApply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`🎤 Nghệ sĩ: ${artistName}`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '261999',
      database: process.env.DB_NAME || 'musicflow',
      port: process.env.DB_PORT || 3306,
    });

    const [artists] = await connection.query('SELECT * FROM artists WHERE name = ?', [artistName]);
    if (artists.length === 0) {
      console.error(`❌ Không tìm thấy nghệ sĩ "${artistName}" trong DB. Vui lòng tạo nghệ sĩ trước.`);
      process.exit(1);
    }
    const artistRow = artists[0];

    // Kiểm tra xem schema DB có hỗ trợ track_number không
    const [songColumns] = await connection.query('SHOW COLUMNS FROM songs');
    const hasTrackNumber = songColumns.some(c => c.Field === 'track_number');
    if (!hasTrackNumber) {
      console.log('⚠️ Bảng songs không có cột track_number (songs.track_number does not exist, skipping track number update).');
    }

    // Lấy bài hát hiện tại
    const [dbSongs] = await connection.query('SELECT * FROM songs WHERE artist_id = ?', [artistRow.id]);
    
    // Lấy albums hiện tại
    const [dbAlbums] = await connection.query('SELECT * FROM albums WHERE artist_id = ?', [artistRow.id]);

    const missingSongsLog = [];
    const manualReview = [];
    const albumsToCreate = [];
    const albumsToUpdate = [];
    const songsToRelink = [];
    const backupData = { albums: [], songs: [] };

    // Process từng album trong metadata
    for (const albumMeta of discography.albums || []) {
      const albumTitleNorm = normalizeTitle(albumMeta.title);
      
      // Tìm album trong DB
      let matchedAlbum = null;
      for (const al of dbAlbums) {
        if (normalizeTitle(al.title) === albumTitleNorm || al.title.toLowerCase() === albumMeta.title.toLowerCase()) {
          matchedAlbum = al;
          break;
        }
      }

      let targetAlbumId = null;
      if (matchedAlbum) {
        targetAlbumId = matchedAlbum.id;
        // Kiểm tra xem cần update type hay release_date không
        const needsUpdate = (albumMeta.type && matchedAlbum.album_type !== albumMeta.type) || 
                            (albumMeta.release_date && matchedAlbum.release_date !== albumMeta.release_date);
        if (needsUpdate) {
          albumsToUpdate.push({
            id: matchedAlbum.id,
            old_type: matchedAlbum.album_type,
            new_type: albumMeta.type || matchedAlbum.album_type,
            old_date: matchedAlbum.release_date,
            new_date: albumMeta.release_date || matchedAlbum.release_date,
            title: matchedAlbum.title
          });
          backupData.albums.push(matchedAlbum);
        }
      } else {
        // Tạo album ảo (để log)
        const fakeId = `NEW_ALBUM_${albumsToCreate.length + 1}`;
        albumsToCreate.push({
          tempId: fakeId,
          title: albumMeta.title,
          type: albumMeta.type || 'album',
          release_date: albumMeta.release_date || null
        });
        targetAlbumId = fakeId;
      }

      // Process tracks
      for (const trackMeta of albumMeta.tracks || []) {
        const trackTitleNorm = normalizeTitle(trackMeta.title);
        
        let bestMatches = [];
        let highestScore = 0;

        for (const dbS of dbSongs) {
          const dbTitleNorm = normalizeTitle(dbS.title);
          let score = 0;
          if (dbTitleNorm === trackTitleNorm) score += 50;
          else if (dbTitleNorm.includes(trackTitleNorm) || trackTitleNorm.includes(dbTitleNorm)) score += 30;

          if (score > highestScore) {
            highestScore = score;
            bestMatches = [dbS];
          } else if (score === highestScore && score > 0) {
            bestMatches.push(dbS);
          }
        }

        if (highestScore >= 30 && bestMatches.length === 1) {
          const matchedSong = bestMatches[0];
          // Check if it needs relinking or track_number update
          let needsRelink = String(matchedSong.album_id) !== String(targetAlbumId);
          let needsTrackNumber = hasTrackNumber && trackMeta.track_number !== undefined && matchedSong.track_number !== trackMeta.track_number;

          if (needsRelink || needsTrackNumber) {
            songsToRelink.push({
              id: matchedSong.id,
              title: matchedSong.title,
              old_album_id: matchedSong.album_id,
              new_album_id: targetAlbumId,
              target_album_title: albumMeta.title,
              new_track_number: hasTrackNumber ? trackMeta.track_number : undefined
            });
            backupData.songs.push(matchedSong);
          }
        } else if (highestScore > 0 && bestMatches.length > 1) {
          manualReview.push({
            type: 'song_multiple_matches',
            track_meta: trackMeta.title,
            matches: bestMatches.map(m => `ID ${m.id}: ${m.title}`)
          });
        } else {
          missingSongsLog.push({
            album: albumMeta.title,
            track: trackMeta.title,
            track_number: trackMeta.track_number
          });
        }
      }
    }

    // Extra songs in DB (not matched by metadata)
    const extraSongs = [];
    const matchedSongIds = new Set(songsToRelink.map(s => s.id));
    for (const dbS of dbSongs) {
      // Logic kiểm tra extra có thể phức tạp vì một số bài đã khớp nhưng ko cần relink 
      // Tạm thời bỏ qua extra_songs chi tiết để giữ script nhẹ và an toàn.
    }

    console.log(`\n📋 BÁO CÁO KẾT QUẢ ĐỐI CHIẾU:`);
    console.log(`- Albums cần tạo mới: ${albumsToCreate.length}`);
    if (albumsToCreate.length > 0) console.table(albumsToCreate);

    console.log(`- Albums cần cập nhật thông tin: ${albumsToUpdate.length}`);
    if (albumsToUpdate.length > 0) console.table(albumsToUpdate);

    console.log(`- Bài hát cần Relink Album/TrackNumber: ${songsToRelink.length}`);
    if (songsToRelink.length > 0) console.table(songsToRelink);

    console.log(`- Bài hát có trong JSON nhưng CHƯA TỒN TẠI trong DB (Missing Songs): ${missingSongsLog.length}`);
    if (missingSongsLog.length > 0) {
      missingSongsLog.slice(0, 5).forEach(m => console.log(`   - [${m.album}] ${m.track}`));
      if (missingSongsLog.length > 5) console.log(`     ... và ${missingSongsLog.length - 5} bài khác.`);
      console.log(`   (Ghi chú: Sẽ không tự động tạo record rỗng để tránh rác DB. Admin hãy upload thủ công).`);
    }

    console.log(`- Bài hát cần Manual Review (nhiều kết quả): ${manualReview.length}`);
    if (manualReview.length > 0) console.dir(manualReview, { depth: null });

    if (isApply) {
      const ts = Date.now();
      const backupPath = path.join(__dirname, `backup_discography_${artistRow.id}_${ts}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
      console.log(`\n💾 Đã tạo backup JSON: ${backupPath}`);

      console.log('🔄 Đang tiến hành APPLY...');
      
      // 1. Tạo albums
      const tempToRealIdMap = {};
      for (const al of albumsToCreate) {
        const [res] = await connection.query(
          'INSERT INTO albums (artist_id, title, album_type, release_date) VALUES (?, ?, ?, ?)',
          [artistRow.id, al.title, al.type, al.release_date]
        );
        tempToRealIdMap[al.tempId] = res.insertId;
        console.log(`   + Đã tạo album "${al.title}" (ID: ${res.insertId})`);
      }

      // 2. Update albums
      for (const al of albumsToUpdate) {
        await connection.query(
          'UPDATE albums SET album_type = ?, release_date = ? WHERE id = ?',
          [al.new_type, al.new_date, al.id]
        );
      }

      // 3. Relink songs
      for (const song of songsToRelink) {
        let finalAlbumId = song.new_album_id;
        if (typeof finalAlbumId === 'string' && finalAlbumId.startsWith('NEW_ALBUM_')) {
          finalAlbumId = tempToRealIdMap[finalAlbumId];
        }

        if (hasTrackNumber && song.new_track_number !== undefined) {
          await connection.query('UPDATE songs SET album_id = ?, track_number = ? WHERE id = ?', [finalAlbumId, song.new_track_number, song.id]);
        } else {
          await connection.query('UPDATE songs SET album_id = ? WHERE id = ?', [finalAlbumId, song.id]);
        }
      }

      console.log('\n🎉 Hoàn tất APPLY dữ liệu!');
    } else {
      console.log('\n💡 Chạy với cờ --apply để ghi thay đổi vào Database.');
    }

  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    if (connection) await connection.end();
  }
}

run();
