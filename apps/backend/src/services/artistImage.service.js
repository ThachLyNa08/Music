const axios = require('axios');
const fs = require('fs');
const path = require('path');
const spotifyService = require('./spotify.service');
const { pool } = require('../config/database');

// Helper chuẩn hóa chuỗi để so khớp tên nghệ sĩ
function toAlphaNum(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Helper slugify tên nghệ sĩ để đặt tên file
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Tải và đồng bộ ảnh đại diện của một nghệ sĩ từ Spotify Web API
 * @param {number} artistId - ID của nghệ sĩ trong database
 */
async function ensureArtistAvatar(artistId) {
  try {
    // 1. Lấy thông tin nghệ sĩ hiện tại
    const [artists] = await pool.query(
      'SELECT id, name, avatar_url FROM artists WHERE id = ?',
      [artistId]
    );

    if (artists.length === 0) {
      console.log(`[ArtistImage] Nghệ sĩ với ID ${artistId} không tồn tại.`);
      return null;
    }

    const artist = artists[0];

    // Nếu đã có ảnh đại diện cục bộ hoặc ảnh online khác, bỏ qua
    if (artist.avatar_url && artist.avatar_url.trim() !== '') {
      console.log(`[ArtistImage] Nghệ sĩ "${artist.name}" đã có avatar_url: ${artist.avatar_url}. Bỏ qua.`);
      return artist.avatar_url;
    }

    // 1.5 Tìm ảnh có sẵn trong hệ thống trước (hỗ trợ nhiều định dạng)
    const uploadDir = path.join(process.cwd(), 'uploads', 'img', 'artists');
    if (fs.existsSync(uploadDir)) {
      const artistSlug = slugify(artist.name) || 'artist';
      const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'];
      let localFileFound = null;

      // Các mẫu tên file có thể tồn tại trong thư mục
      const possibleNames = [];
      for (const ext of extensions) {
        possibleNames.push(`${artistSlug}-${artist.id}${ext}`);
        possibleNames.push(`${artistSlug}${ext}`);
        possibleNames.push(`${artist.id}${ext}`);
      }

      for (const pName of possibleNames) {
        if (fs.existsSync(path.join(uploadDir, pName))) {
          localFileFound = pName;
          break;
        }
      }

      if (localFileFound) {
        const dbAvatarPath = `/uploads/img/artists/${localFileFound}`;
        await pool.query(
          `UPDATE artists SET avatar_url = ?, avatar_source = 'local' WHERE id = ?`,
          [dbAvatarPath, artist.id]
        );
        console.log(`[ArtistImage] Đã dò thấy ảnh cục bộ có sẵn cho "${artist.name}": ${dbAvatarPath}`);
        return dbAvatarPath;
      }
    }

    console.log(`[ArtistImage] Bắt đầu tìm ảnh đại diện trên Spotify cho nghệ sĩ "${artist.name}" (ID: ${artist.id})...`);

    // 2. Lấy Access Token từ Spotify
    const token = await spotifyService.getAccessToken();
    if (!token) {
      console.error('[ArtistImage] Không lấy được Spotify access token.');
      return null;
    }

    // 3. Gọi Spotify Search API
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: artist.name,
        type: 'artist',
        limit: 5
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const searchItems = response.data?.artists?.items || [];
    if (searchItems.length === 0) {
      console.log(`[ArtistImage] Không tìm thấy kết quả nào trên Spotify cho "${artist.name}".`);
      return null;
    }

    // 4. Chọn kết quả phù hợp nhất
    const cleanSystemName = toAlphaNum(artist.name);
    let bestMatch = null;

    for (const item of searchItems) {
      const cleanSpotifyName = toAlphaNum(item.name);
      if (cleanSystemName === cleanSpotifyName) {
        bestMatch = item;
        break;
      }
    }

    // Fallback về phần tử đầu tiên nếu không có kết quả khớp chính xác tên
    if (!bestMatch) {
      bestMatch = searchItems[0];
    }

    // Kiểm tra xem đối tượng nghệ sĩ có chứa ảnh không
    const images = bestMatch.images || [];
    if (images.length === 0) {
      console.log(`[ArtistImage] Nghệ sĩ "${bestMatch.name}" trên Spotify không có ảnh.`);
      return null;
    }

    // Ưu tiên lấy ảnh cỡ trung bình (thường là index 1, khoảng 300x300px), hoặc lớn nhất (index 0)
    const imageUrl = images[1]?.url || images[0]?.url;
    if (!imageUrl) {
      return null;
    }

    // 5. Tải ảnh thật về thư mục uploads/img/artists/
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const artistSlug = slugify(artist.name) || 'artist';
    const filename = `${artistSlug}-${artist.id}.jpg`;
    const localFilePath = path.join(uploadDir, filename);

    console.log(`[ArtistImage] Đang tải ảnh từ ${imageUrl} về ${localFilePath}...`);
    const imageResponse = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(localFilePath);
    imageResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 6. Cập nhật cơ sở dữ liệu
    const dbAvatarPath = `/uploads/img/artists/${filename}`;
    const spotifyArtistId = bestMatch.id;
    const externalUrl = bestMatch.external_urls?.spotify || null;

    await pool.query(
      `UPDATE artists 
       SET avatar_url = ?, 
           avatar_source = ?, 
           spotify_artist_id = ?, 
           external_url = ?, 
           avatar_fetched_at = NOW() 
       WHERE id = ?`,
      [dbAvatarPath, 'spotify', spotifyArtistId, externalUrl, artist.id]
    );

    console.log(`[ArtistImage] Đã tải ảnh thành công cho nghệ sĩ "${artist.name}": ${dbAvatarPath}`);
    return dbAvatarPath;

  } catch (error) {
    console.error(`[ArtistImage] Lỗi khi xử lý ảnh đại diện nghệ sĩ ID ${artistId}:`, error.message);
    return null;
  }
}

/**
 * Quét cơ sở dữ liệu và tải bổ sung ảnh đại diện cho các nghệ sĩ còn thiếu (Tối đa 50 nghệ sĩ)
 */
async function scanAndFetchMissingAvatars() {
  try {
    console.log('[ArtistImage] Bắt đầu quét các nghệ sĩ chưa có ảnh đại diện...');
    const [artists] = await pool.query(
      "SELECT id, name FROM artists WHERE avatar_url IS NULL OR avatar_url = '' LIMIT 50"
    );

    console.log(`[ArtistImage] Tìm thấy ${artists.length} nghệ sĩ cần bổ sung ảnh.`);

    for (const artist of artists) {
      await ensureArtistAvatar(artist.id);
      // Tránh spam request Spotify API quá nhanh
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[ArtistImage] Hoàn tất quá trình quét tải ảnh.');
  } catch (error) {
    console.error('[ArtistImage] Lỗi khi quét các nghệ sĩ chưa có ảnh:', error.message);
  }
}

module.exports = {
  ensureArtistAvatar,
  scanAndFetchMissingAvatars
};
