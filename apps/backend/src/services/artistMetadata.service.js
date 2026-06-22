const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const spotifyService = require('./spotify.service');
const { fetchWikipediaArtistBio } = require('./wikipedia.service');
const { fetchLastfmArtistBio } = require('./lastfm.service');

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function slugify(value) {
  return String(value || 'artist')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artist';
}

function hasUsableAvatar(artist) {
  return Boolean(String(artist?.avatar_url || '').trim());
}

function pickSpotifyImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find(image => image.width && image.width <= 640)?.url || images[0]?.url || null;
}

function getExtensionFromResponse(response, fallbackUrl) {
  const type = response.headers?.['content-type'] || '';
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';

  const ext = path.extname(new URL(fallbackUrl).pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
}

async function findSpotifyArtist(artist, token) {
  if (artist.spotify_artist_id) {
    const response = await axios.get(`${SPOTIFY_API_URL}/artists/${artist.spotify_artist_id}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return response.data;
  }

  const response = await axios.get(`${SPOTIFY_API_URL}/search`, {
    params: {
      q: artist.name,
      type: 'artist',
      limit: 5,
    },
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });

  const items = response.data?.artists?.items || [];
  if (!items.length) return null;

  const normalizedLocalName = normalizeName(artist.name);
  return items.find(item => normalizeName(item.name) === normalizedLocalName) || items[0];
}

async function downloadArtistAvatar({ artist, spotifyArtist, force = false }) {
  if (!force && hasUsableAvatar(artist)) {
    return {
      avatarUrl: artist.avatar_url,
      avatarSource: artist.avatar_source || null,
      downloaded: false,
    };
  }

  const imageUrl = pickSpotifyImage(spotifyArtist.images);
  if (!imageUrl) {
    return {
      avatarUrl: artist.avatar_url || null,
      avatarSource: artist.avatar_source || null,
      downloaded: false,
    };
  }

  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });

  const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'img', 'artists');
  fs.mkdirSync(uploadDir, { recursive: true });

  const extension = getExtensionFromResponse(response, imageUrl);
  const filename = `${slugify(artist.name)}-${artist.id}-${spotifyArtist.id}${extension}`;
  const localPath = path.join(uploadDir, filename);
  fs.writeFileSync(localPath, response.data);

  return {
    avatarUrl: `/uploads/img/artists/${filename}`,
    avatarSource: 'spotify',
    downloaded: true,
  };
}

function buildUpdatePayload({ artist, spotifyArtist, avatarResult }) {
  const genres = Array.isArray(spotifyArtist.genres) ? spotifyArtist.genres.filter(Boolean) : [];
  const externalUrl = spotifyArtist.external_urls?.spotify || null;
  const followers = Number.isFinite(Number(spotifyArtist.followers?.total))
    ? Number(spotifyArtist.followers.total)
    : null;
  const popularity = Number.isFinite(Number(spotifyArtist.popularity))
    ? Number(spotifyArtist.popularity)
    : null;

  return {
    bio: artist.bio || null,
    shortBio: artist.short_bio || null,
    genresJson: genres.length ? JSON.stringify(genres) : null,
    popularity,
    followers,
    spotifyArtistId: spotifyArtist.id || artist.spotify_artist_id || null,
    externalUrl,
    avatarUrl: avatarResult.avatarUrl || artist.avatar_url || null,
    avatarSource: avatarResult.avatarSource || artist.avatar_source || null,
    metadataSource: 'spotify',
    metadataSourceUrl: externalUrl,
  };
}

async function syncArtistMetadata(artistId, options = {}) {
  const force = options.force === true || options.force === 'true';

  try {
    const [artists] = await pool.query(
      `SELECT id, name, bio, short_bio, avatar_url, avatar_source, spotify_artist_id
       FROM artists
       WHERE id = ?
       LIMIT 1`,
      [artistId]
    );

    if (!artists.length) {
      return {
        success: false,
        code: 'ARTIST_NOT_FOUND',
        message: 'Artist not found',
      };
    }

    const artist = artists[0];
    const token = await spotifyService.getAccessToken();
    const spotifyArtist = await findSpotifyArtist(artist, token);

    if (!spotifyArtist) {
      await pool.query(
        `UPDATE artists
         SET metadata_source = ?, metadata_fetched_at = NOW()
         WHERE id = ?`,
        ['spotify_not_found', artist.id]
      );

      return {
        success: false,
        code: 'SPOTIFY_ARTIST_NOT_FOUND',
        message: `No Spotify artist match found for "${artist.name}"`,
        artist_id: artist.id,
      };
    }

    const avatarResult = await downloadArtistAvatar({ artist, spotifyArtist, force });
    const payload = buildUpdatePayload({ artist, spotifyArtist, avatarResult });

    await pool.query(
      `UPDATE artists
       SET bio = COALESCE(?, bio),
           short_bio = COALESCE(?, short_bio),
           genres_json = COALESCE(?, genres_json),
           popularity = COALESCE(?, popularity),
           followers = COALESCE(?, followers),
           spotify_artist_id = ?,
           external_url = ?,
           avatar_url = ?,
           avatar_source = ?,
           metadata_source = ?,
           metadata_source_url = ?,
           metadata_fetched_at = NOW()
       WHERE id = ?`,
      [
        payload.bio,
        payload.shortBio,
        payload.genresJson,
        payload.popularity,
        payload.followers,
        payload.spotifyArtistId,
        payload.externalUrl,
        payload.avatarUrl,
        payload.avatarSource,
        payload.metadataSource,
        payload.metadataSourceUrl,
        artist.id,
      ]
    );

    // Bổ sung bio fallback nếu bio vẫn đang trống
    if (!payload.bio && !payload.shortBio) {
      await syncArtistBio(artist.id, { force });
    }

    const [[updatedArtist]] = await pool.query('SELECT * FROM artists WHERE id = ?', [artist.id]);

    return {
      success: true,
      message: 'Artist metadata synced',
      artist: updatedArtist,
      avatar_downloaded: avatarResult.downloaded,
      source: 'spotify',
    };
  } catch (error) {
    return {
      success: false,
      code: 'ARTIST_METADATA_SYNC_FAILED',
      message: error.message || 'Cannot sync artist metadata',
    };
  }
}

async function syncMissingArtistMetadata(limit = 10, options = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const [artists] = await pool.query(
    `SELECT id
     FROM artists
     WHERE avatar_url IS NULL OR avatar_url = ''
        OR bio IS NULL OR bio = ''
        OR genres_json IS NULL
        OR spotify_artist_id IS NULL OR spotify_artist_id = ''
     ORDER BY metadata_fetched_at IS NULL DESC, metadata_fetched_at ASC, id ASC
     LIMIT ?`,
    [safeLimit]
  );

  const results = [];
  for (const artist of artists) {
    const result = await syncArtistMetadata(artist.id, options);
    results.push({
      artist_id: artist.id,
      success: result.success,
      code: result.code || null,
      message: result.message,
      avatar_downloaded: result.avatar_downloaded || false,
    });
  }

  return {
    success: true,
    requested_limit: safeLimit,
    processed: results.length,
    succeeded: results.filter(result => result.success).length,
    failed: results.filter(result => !result.success).length,
    results,
  };
}

async function getArtistMetadataIssues(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const [issues] = await pool.query(
    `SELECT id, name, avatar_url, bio, short_bio, genres_json, spotify_artist_id,
            metadata_source, metadata_fetched_at,
            CASE WHEN avatar_url IS NULL OR avatar_url = '' THEN 1 ELSE 0 END AS missing_avatar,
            CASE WHEN (bio IS NULL OR bio = '') AND (short_bio IS NULL OR short_bio = '') THEN 1 ELSE 0 END AS missing_bio,
            CASE WHEN spotify_artist_id IS NULL OR spotify_artist_id = '' THEN 1 ELSE 0 END AS missing_spotify_id
     FROM artists
     WHERE avatar_url IS NULL OR avatar_url = ''
        OR ((bio IS NULL OR bio = '') AND (short_bio IS NULL OR short_bio = ''))
        OR spotify_artist_id IS NULL OR spotify_artist_id = ''
     ORDER BY metadata_fetched_at IS NULL DESC, metadata_fetched_at ASC, id ASC
     LIMIT ?`,
    [safeLimit]
  );

  return issues;
}

async function syncArtistBio(artistId, options = {}) {
  try {
    const [artists] = await pool.query(
      `SELECT id, name, bio, short_bio, bio_source FROM artists WHERE id = ? LIMIT 1`,
      [artistId]
    );

    if (!artists.length) {
      return { success: false, code: 'ARTIST_NOT_FOUND', message: 'Artist not found' };
    }
    const artist = artists[0];

    if (!options.force && artist.bio && artist.bio_source) {
      return { success: true, message: 'Artist bio already exists', skipped: true };
    }

    let bioData = await fetchWikipediaArtistBio(artist.name);
    if (!bioData) {
      bioData = await fetchLastfmArtistBio(artist.name);
    }

    if (!bioData) {
      return { success: false, code: 'BIO_NOT_FOUND', message: 'Không tìm thấy thông tin tiểu sử trên Wikipedia hay Last.fm' };
    }

    await pool.query(
      `UPDATE artists 
       SET bio = ?, short_bio = ?, bio_source = ?, bio_source_url = ?, bio_fetched_at = NOW() 
       WHERE id = ?`,
      [bioData.bio, bioData.shortBio, bioData.source, bioData.sourceUrl, artist.id]
    );

    const [[updatedArtist]] = await pool.query('SELECT * FROM artists WHERE id = ?', [artist.id]);
    return { success: true, message: 'Artist bio synced', artist: updatedArtist, source: bioData.source };
  } catch (error) {
    return { success: false, code: 'BIO_SYNC_FAILED', message: error.message };
  }
}

async function syncMissingArtistBio(limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [artists] = await pool.query(
    `SELECT id FROM artists
     WHERE (bio IS NULL OR bio = '') AND (short_bio IS NULL OR short_bio = '')
     ORDER BY bio_fetched_at IS NULL DESC, bio_fetched_at ASC, id ASC
     LIMIT ?`,
    [safeLimit]
  );

  const results = [];
  for (const artist of artists) {
    const result = await syncArtistBio(artist.id);
    results.push({
      artist_id: artist.id,
      success: result.success,
      skipped: result.skipped || false,
      code: result.code || null,
      message: result.message
    });
  }

  return {
    success: true,
    synced: results.filter(r => r.success && !r.skipped).length,
    failed: results.filter(r => !r.success).length,
    skipped: results.filter(r => r.skipped).length,
    results
  };
}

module.exports = {
  syncArtistMetadata,
  syncMissingArtistMetadata,
  getArtistMetadataIssues,
  syncArtistBio,
  syncMissingArtistBio
};
