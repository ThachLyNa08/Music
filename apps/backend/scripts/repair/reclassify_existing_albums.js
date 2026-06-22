require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { pool } = require('../../src/config/database');
const { inferAlbumType } = require('../../src/services/songImage.service');

async function reclassify() {
  console.log('--- Bắt đầu Reclassify Albums ---');
  let connection;
  try {
    connection = await pool.getConnection();

    const [albums] = await connection.query(`
      SELECT al.id, al.title, al.album_type, al.total_tracks,
             COUNT(s.id) AS song_count
      FROM albums al
      LEFT JOIN songs s ON s.album_id = al.id
      GROUP BY al.id
    `);

    console.log(`Tìm thấy ${albums.length} albums cần kiểm tra.`);

    let updatedCount = 0;

    for (const album of albums) {
      // Dùng logic suy luận
      // Nếu đã có thông tin Spotify trong bảng albums thì ta có thể không có ở đây
      // vì ta không có spotifyAlbumType hay spotifyTotalTracks lưu ở DB (ngoại trừ total_tracks đã lưu)
      // Do đó, ta sẽ check nếu total_tracks > 1 -> album
      
      let spotifyType = undefined;
      let spotifyTotal = undefined;
      
      // Nếu total_tracks trong db > 1 thì có thể ngầm định là album thật
      if (album.total_tracks > 1) {
        spotifyTotal = album.total_tracks;
        if (album.album_type && album.album_type !== 'unknown') {
          spotifyType = album.album_type;
        } else {
          spotifyType = 'album';
        }
      }

      const inferredType = inferAlbumType({
        dbAlbumTitle: album.title,
        spotifyAlbumType: spotifyType,
        spotifyTotalTracks: spotifyTotal,
        dbSongCount: album.song_count
      });

      let finalTotalTracks = album.total_tracks > 0 ? album.total_tracks : album.song_count;

      if (inferredType !== album.album_type || finalTotalTracks !== album.total_tracks) {
        await connection.query(`
          UPDATE albums
          SET album_type = ?, total_tracks = ?
          WHERE id = ?
        `, [inferredType, finalTotalTracks, album.id]);
        updatedCount++;
      }
    }

    console.log(`Đã cập nhật lại phân loại cho ${updatedCount} albums.`);
    console.log('--- Hoàn tất Reclassify ---');
  } catch (err) {
    console.error('Lỗi khi reclassify:', err);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

reclassify();
