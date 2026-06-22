function normalizeCoverUrl(url, req) {
  if (!url) return null

  const clean = String(url).trim()

  if (!clean || clean === 'null' || clean === 'undefined' || clean === '[object Object]') {
    return null
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean
  }

  // If req is not provided, we can't accurately append the host, so just return the clean path
  if (!req || !req.protocol || !req.get) {
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`

  if (clean.startsWith('/uploads')) {
    return `${baseUrl}${clean}`
  }

  if (clean.startsWith('uploads')) {
    return `${baseUrl}/${clean}`
  }

  if (clean.startsWith('/images')) {
    return `${baseUrl}${clean}`
  }

  if (clean.startsWith('images')) {
    return `${baseUrl}/${clean}`
  }

  if (clean.startsWith('/')) {
    return `${baseUrl}${clean}`
  }

  return `${baseUrl}/uploads/${clean}`
}

const fs = require('fs');
const path = require('path');

function slugify(text) {
  if (!text) return '';
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

function resolveArtistAvatar(artist, req) {
  // Ưu tiên dùng avatar_url trong database
  if (artist.avatar_url && artist.avatar_url.trim() !== '' && artist.avatar_url.trim() !== 'null') {
    const normalized = normalizeCoverUrl(artist.avatar_url, req);
    if (normalized && normalized.includes('/uploads/')) {
      const localPathSuffix = normalized.split('/uploads/')[1];
      // Xóa query params nếu có (ví dụ ?v=123)
      const cleanPathSuffix = localPathSuffix.split('?')[0];
      const absolutePath = path.join(__dirname, '..', '..', 'uploads', cleanPathSuffix);
      if (fs.existsSync(absolutePath)) {
        return normalized;
      }
      // Bỏ qua giá trị DB nếu file local thực tế không tồn tại, để tự dò lại
    } else if (normalized) {
      return normalized;
    }
  }

  // Nếu rỗng hoặc không hợp lệ, tự dò file local
  const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'img', 'artists');
  if (fs.existsSync(uploadDir)) {
    const artistSlug = slugify(artist.name || artist.artist_name);
    const artistId = artist.id || artist.artist_id;
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'];
    
    const possibleNames = [];
    if (artistSlug && artistId) {
      for (const ext of extensions) possibleNames.push(`${artistSlug}-${artistId}${ext}`);
    }
    if (artistSlug) {
      for (const ext of extensions) possibleNames.push(`${artistSlug}${ext}`);
    }
    if (artistId) {
      for (const ext of extensions) possibleNames.push(`${artistId}${ext}`);
    }

    for (const pName of possibleNames) {
      if (fs.existsSync(path.join(uploadDir, pName))) {
        return normalizeCoverUrl(`/uploads/img/artists/${pName}`, req);
      }
    }
  }

  // Không tìm thấy thì trả về null (frontend sẽ dùng fallback mặc định)
  return null;
}

module.exports = {
  normalizeCoverUrl,
  resolveArtistAvatar
}
