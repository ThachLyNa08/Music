const axios = require('axios');
const fs = require('fs');
const path = require('path');
const spotifyService = require('./spotify.service');
const { pool } = require('../config/database');

// Helpers
function normalizeText(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function slugify(text) {
  return normalizeText(text)
    .replace(/\s+/g, '-')
    .replace(/\-\-+/g, '-');
}

function inferAlbumType({ dbAlbumTitle, spotifyAlbumType, spotifyTotalTracks, dbSongCount }) {
  // 1. Ưu tiên metadata từ Spotify
  if (spotifyAlbumType === 'single') return 'single';
  if (spotifyTotalTracks <= 1) return 'single';
  if (spotifyAlbumType === 'album' && spotifyTotalTracks > 1) return 'album';
  if (spotifyAlbumType === 'compilation') return 'compilation';

  // 2. Suy luận từ Database nếu thiếu thông tin Spotify
  const lowerTitle = normalizeText(dbAlbumTitle || '');
  const singleKeywords = ['single', 'singles', 'unknown', 'na', 'none', 'khong ro'];
  if (singleKeywords.includes(lowerTitle)) return 'single';

  // 3. Dựa trên số lượng bài hát trong DB
  if (dbSongCount <= 1) return 'single';
  if (dbSongCount > 1) return 'album';

  return 'unknown';
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImageToLocal(imageUrl, folder, slug, id) {
  try {
    const uploadDir = path.join(process.cwd(), 'uploads', 'img', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${slug}-${id}.jpg`;
    const localFilePath = path.join(uploadDir, filename);

    const imageResponse = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      timeout: 15000
    });

    const writer = fs.createWriteStream(localFilePath);
    imageResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return `/uploads/img/${folder}/${filename}`;
  } catch (error) {
    console.error(`[ImageDownload] Lỗi khi tải ảnh ${imageUrl} về ${folder}:`, error.message);
    return null;
  }
}

/**
 * Tải cover bài hát
 */
async function ensureSongCover(songId) {
  try {
    // 1. Query thông tin
    const [songs] = await pool.query(`
      SELECT 
        s.id, s.title, s.cover_url, s.audio_url, s.album_id, s.artist_id,
        a.name AS artist_name,
        al.title AS album_title, al.cover_url AS album_cover_url
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.id = ?
    `, [songId]);

    if (songs.length === 0) return null;
    const song = songs[0];

    // Nếu đã có cover rồi thì bỏ qua
    if (song.cover_url && song.cover_url.trim() !== '') {
      return song.cover_url;
    }

    let trackItem = null;
    let spotifyTrackId = null;
    const token = await spotifyService.getAccessToken();

    // 2. Lấy info Spotify
    if (song.audio_url && song.audio_url.startsWith('spotify:track:')) {
      spotifyTrackId = song.audio_url.replace('spotify:track:', '');
      try {
        const response = await axios.get(`https://api.spotify.com/v1/tracks/${spotifyTrackId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });
        trackItem = response.data;
      } catch (err) {
        console.error(`[SongImage] Lỗi khi get Spotify track ${spotifyTrackId}:`, err.message);
      }
    } else {
      // Search
      const queryStr = `track:${song.title} artist:${song.artist_name}`;
      try {
        const response = await axios.get('https://api.spotify.com/v1/search', {
          params: { q: queryStr, type: 'track', limit: 5 },
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });
        const items = response.data?.tracks?.items || [];
        if (items.length > 0) {
          // Normalize matching
          const cleanSystemTitle = normalizeText(song.title);
          trackItem = items.find(item => normalizeText(item.name) === cleanSystemTitle);
          if (!trackItem) trackItem = items[0];
          spotifyTrackId = trackItem.id;
        }
      } catch (err) {
         console.error(`[SongImage] Lỗi khi search Spotify track cho "${song.title}":`, err.message);
      }
    }

    if (!trackItem || !trackItem.album || !trackItem.album.images || trackItem.album.images.length === 0) {
      console.log(`[SongImage] Không tìm thấy cover cho bài hát: ${song.title} - ${song.artist_name}`);
      return null;
    }

    // 3. Tải cover bài hát
    const images = trackItem.album.images;
    let imageUrl = images[0].url; // Uu tien anh lon nhat
    
    let dbCoverPath = await downloadImageToLocal(imageUrl, 'songs', slugify(song.title) || 'song', song.id);
    if (!dbCoverPath && images.length > 1) {
      // Thu anh khac neu anh 0 bi loi
      dbCoverPath = await downloadImageToLocal(images[1].url, 'songs', slugify(song.title) || 'song', song.id);
    }

    if (dbCoverPath) {
      await pool.query(`
        UPDATE songs
        SET cover_url = ?, spotify_track_id = ?, cover_source = 'spotify', cover_fetched_at = NOW()
        WHERE id = ?
      `, [dbCoverPath, spotifyTrackId, song.id]);
      console.log(`[SongImage] Cập nhật thành công cover cho bài hát: ${song.title}`);

      // 4. Nếu có album_id và album chưa có ảnh, thì lấy ảnh này làm album cover luôn
      if (song.album_id && (!song.album_cover_url || song.album_cover_url.trim() === '')) {
        const albumSlug = slugify(song.album_title) || 'album';
        const dbAlbumCoverPath = await downloadImageToLocal(imageUrl, 'albums', albumSlug, song.album_id);
        
        // Đếm số lượng bài hát hiện có trong album này
        const [albumSongs] = await pool.query('SELECT COUNT(id) as count FROM songs WHERE album_id = ?', [song.album_id]);
        const dbSongCount = albumSongs[0]?.count || 0;
        
        const inferredType = inferAlbumType({
          dbAlbumTitle: song.album_title,
          spotifyAlbumType: trackItem.album.album_type,
          spotifyTotalTracks: trackItem.album.total_tracks,
          dbSongCount: dbSongCount
        });
        
        const totalTracks = trackItem.album.total_tracks || dbSongCount;

        if (dbAlbumCoverPath) {
          await pool.query(`
            UPDATE albums
            SET cover_url = ?, spotify_album_id = ?, external_url = ?, cover_source = 'spotify', cover_fetched_at = NOW(),
                album_type = ?, total_tracks = ?
            WHERE id = ?
          `, [dbAlbumCoverPath, trackItem.album.id, trackItem.album.external_urls?.spotify || null, inferredType, totalTracks, song.album_id]);
          console.log(`[AlbumImage] Cập nhật thành công cover và phân loại (${inferredType}) cho album: ${song.album_title}`);
        }
      }
      return dbCoverPath;
    }
    return null;
  } catch (error) {
    console.error(`[SongImage] Exception in ensureSongCover(ID=${songId}):`, error.message);
    return null;
  }
}

/**
 * Tải cover album
 */
async function ensureAlbumCover(albumId) {
  try {
    const [albums] = await pool.query(`
      SELECT al.id, al.title, al.cover_url, al.artist_id, a.name AS artist_name
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      WHERE al.id = ?
    `, [albumId]);

    if (albums.length === 0) return null;
    const album = albums[0];

    if (album.cover_url && album.cover_url.trim() !== '') {
      return album.cover_url;
    }

    const token = await spotifyService.getAccessToken();
    const queryStr = `album:${album.title} artist:${album.artist_name || ''}`;
    
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: { q: queryStr, type: 'album', limit: 5 },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });

    const items = response.data?.albums?.items || [];
    if (items.length === 0) {
      console.log(`[AlbumImage] Không tìm thấy cover cho album: ${album.title}`);
      return null;
    }

    const cleanTitle = normalizeText(album.title);
    let bestMatch = items.find(item => normalizeText(item.name) === cleanTitle);
    if (!bestMatch) bestMatch = items[0];

    if (!bestMatch.images || bestMatch.images.length === 0) return null;

    let imageUrl = bestMatch.images[0].url;
    let dbCoverPath = await downloadImageToLocal(imageUrl, 'albums', slugify(album.title) || 'album', album.id);

    // Đếm số bài hát
    const [albumSongs] = await pool.query('SELECT COUNT(id) as count FROM songs WHERE album_id = ?', [album.id]);
    const dbSongCount = albumSongs[0]?.count || 0;
    
    const inferredType = inferAlbumType({
      dbAlbumTitle: album.title,
      spotifyAlbumType: bestMatch.album_type,
      spotifyTotalTracks: bestMatch.total_tracks,
      dbSongCount: dbSongCount
    });
    
    const totalTracks = bestMatch.total_tracks || dbSongCount;

    if (dbCoverPath) {
      await pool.query(`
        UPDATE albums
        SET cover_url = ?, spotify_album_id = ?, external_url = ?, cover_source = 'spotify', cover_fetched_at = NOW(),
            album_type = ?, total_tracks = ?
        WHERE id = ?
      `, [dbCoverPath, bestMatch.id, bestMatch.external_urls?.spotify || null, inferredType, totalTracks, album.id]);
      console.log(`[AlbumImage] Cập nhật thành công cover và phân loại (${inferredType}) cho album: ${album.title}`);
      return dbCoverPath;
    }
    return null;
  } catch (error) {
    console.error(`[AlbumImage] Exception in ensureAlbumCover(ID=${albumId}):`, error.message);
    return null;
  }
}

/**
 * Scan hàng loạt bài hát thiếu cover
 */
async function scanAndFetchMissingSongCovers(limit = 50) {
  try {
    const [songs] = await pool.query(
      "SELECT id FROM songs WHERE cover_url IS NULL OR cover_url = '' LIMIT ?",
      [limit]
    );

    console.log(`[SongImage] Tìm thấy ${songs.length} bài hát cần xử lý cover.`);
    let success = 0, failed = 0;

    for (const song of songs) {
      const res = await ensureSongCover(song.id);
      if (res) success++; else failed++;
      await sleep(500); // Delay
    }

    return { total: songs.length, success, failed };
  } catch (error) {
    console.error('[SongImage] scanAndFetchMissingSongCovers Error:', error.message);
    return { error: error.message };
  }
}

/**
 * Scan hàng loạt album thiếu cover
 */
async function scanAndFetchMissingAlbumCovers(limit = 50) {
  try {
    const [albums] = await pool.query(
      "SELECT id FROM albums WHERE cover_url IS NULL OR cover_url = '' LIMIT ?",
      [limit]
    );

    console.log(`[AlbumImage] Tìm thấy ${albums.length} album cần xử lý cover.`);
    let success = 0, failed = 0;

    for (const album of albums) {
      const res = await ensureAlbumCover(album.id);
      if (res) success++; else failed++;
      await sleep(500);
    }

    return { total: albums.length, success, failed };
  } catch (error) {
    console.error('[AlbumImage] scanAndFetchMissingAlbumCovers Error:', error.message);
    return { error: error.message };
  }
}

module.exports = {
  ensureSongCover,
  ensureAlbumCover,
  scanAndFetchMissingSongCovers,
  scanAndFetchMissingAlbumCovers,
  inferAlbumType,
  normalizeText
};
