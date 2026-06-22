const fs = require('fs');
const { pool } = require('../config/database');
const { uploadsRoot } = require('../utils/uploadPathResolver');
const { tableExists, columnExists } = require('../utils/dbIntrospection');

function emptySummary() {
  return {
    totals: {
      totalSongs: 0,
      totalArtists: 0,
      totalAlbums: 0,
      totalGenres: 0,
      totalUsers: 0,
      totalListens: null,
    },
    top: {
      topSong: null,
      topArtist: null,
      topAlbum: null,
    },
    latestSongs: [],
    quality: {
      missingAudioCount: 0,
      missingCoverCount: 0,
      missingLyricsCount: 0,
      missingFeaturesCount: 0,
    },
    marketDistribution: {
      KPOP: 0,
      VPOP: 0,
      USUK: 0,
      OTHER: 0,
    },
    systemStatus: {
      mysql: 'unknown',
      redis: 'unknown',
      backend: 'ok',
      aiService: 'not_configured',
      uploadsPath: {
        status: 'unknown',
        publicPath: '/uploads',
      },
    },
    warnings: [],
  };
}

async function safeQuery(warnings, label, sql, params = [], fallback = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    warnings.push(`${label}: ${error.message}`);
    return fallback;
  }
}

async function safeCount(warnings, tableName) {
  if (!(await tableExists(tableName))) {
    warnings.push(`Missing table: ${tableName}`);
    return 0;
  }
  const rows = await safeQuery(warnings, `Count ${tableName}`, `SELECT COUNT(*) AS total FROM \`${tableName}\``);
  return Number(rows?.[0]?.total || 0);
}

async function getTotalListens(warnings) {
  if ((await tableExists('songs')) && (await columnExists('songs', 'play_count'))) {
    const rows = await safeQuery(warnings, 'Sum songs.play_count', 'SELECT COALESCE(SUM(play_count), 0) AS total FROM songs');
    return Number(rows?.[0]?.total || 0);
  }

  if (await tableExists('listening_history')) {
    const rows = await safeQuery(warnings, 'Count listening_history fallback', 'SELECT COUNT(*) AS total FROM listening_history');
    return Number(rows?.[0]?.total || 0);
  }

  warnings.push('Missing listening_history table and songs.play_count column');
  return null;
}

async function getTopSong(warnings) {
  if (!(await tableExists('songs'))) return null;
  const hasPlayCount = await columnExists('songs', 'play_count');
  const orderExpr = hasPlayCount ? 'COALESCE(s.play_count, 0)' : 's.id';
  const selectListens = hasPlayCount
    ? 'COALESCE(s.play_count, 0) AS play_count, COALESCE(s.play_count, 0) AS total_plays, COALESCE(s.play_count, 0) AS listens'
    : 'NULL AS play_count, NULL AS total_plays, NULL AS listens';

  const rows = await safeQuery(warnings, 'Top song', `
    SELECT s.id, s.title, s.cover_url, s.audio_url, a.name AS artist, ${selectListens}
    FROM songs s
    LEFT JOIN artists a ON a.id = s.artist_id
    GROUP BY s.id, s.title, s.cover_url, s.audio_url, a.name${hasPlayCount ? ', s.play_count' : ''}
    ORDER BY ${orderExpr} DESC
    LIMIT 1
  `);
  return rows?.[0] || null;
}

async function getTopArtist(warnings) {
  if (!(await tableExists('artists'))) return null;
  const hasSongs = await tableExists('songs');
  const hasPlayCount = await columnExists('songs', 'play_count');

  if (!hasSongs) {
    const rows = await safeQuery(warnings, 'Top artist fallback', 'SELECT id, name, avatar_url, NULL AS listens FROM artists ORDER BY id DESC LIMIT 1');
    return rows?.[0] || null;
  }

  const selectListens = hasPlayCount
    ? 'COALESCE(SUM(s.play_count), 0) AS total_plays, COALESCE(SUM(s.play_count), 0) AS listens'
    : 'COUNT(s.id) AS total_plays, COUNT(s.id) AS listens';
  const orderExpr = hasPlayCount ? 'COALESCE(SUM(s.play_count), 0)' : 'COUNT(s.id)';

  const rows = await safeQuery(warnings, 'Top artist', `
    SELECT a.id, a.name, a.avatar_url, ${selectListens}
    FROM artists a
    LEFT JOIN songs s ON s.artist_id = a.id
    GROUP BY a.id, a.name, a.avatar_url
    ORDER BY ${orderExpr} DESC
    LIMIT 1
  `);
  return rows?.[0] || null;
}

async function getTopAlbum(warnings) {
  if (!(await tableExists('albums'))) return null;
  const hasSongs = await tableExists('songs');
  const hasPlayCount = await columnExists('songs', 'play_count');

  if (!hasSongs) {
    const rows = await safeQuery(warnings, 'Top album fallback', 'SELECT id, title, cover_url, NULL AS listens FROM albums ORDER BY id DESC LIMIT 1');
    return rows?.[0] || null;
  }

  const selectListens = hasPlayCount
    ? 'COALESCE(SUM(s.play_count), 0) AS total_plays, COALESCE(SUM(s.play_count), 0) AS listens'
    : 'COUNT(s.id) AS total_plays, COUNT(s.id) AS listens';
  const orderExpr = hasPlayCount ? 'COALESCE(SUM(s.play_count), 0)' : 'COUNT(s.id)';

  const rows = await safeQuery(warnings, 'Top album', `
    SELECT al.id, al.title, al.cover_url, a.name AS artist, ${selectListens}
    FROM albums al
    LEFT JOIN artists a ON a.id = al.artist_id
    LEFT JOIN songs s ON s.album_id = al.id
    GROUP BY al.id, al.title, al.cover_url, a.name
    ORDER BY ${orderExpr} DESC
    LIMIT 1
  `);
  return rows?.[0] || null;
}

async function getLatestSongs(warnings) {
  if (!(await tableExists('songs'))) return [];
  const hasCreatedAt = await columnExists('songs', 'created_at');
  const rows = await safeQuery(warnings, 'Latest songs', `
    SELECT s.id, s.title, s.cover_url, s.audio_url, s.created_at, a.name AS artist, al.title AS album
    FROM songs s
    LEFT JOIN artists a ON a.id = s.artist_id
    LEFT JOIN albums al ON al.id = s.album_id
    ORDER BY ${hasCreatedAt ? 's.created_at' : 's.id'} DESC
    LIMIT 8
  `);
  return rows || [];
}

async function getMissingLyricsCount(warnings) {
  if (!(await tableExists('songs'))) return 0;
  const hasSongLyricsColumn = await columnExists('songs', 'lyrics');
  const hasSongLyricsTable = await tableExists('song_lyrics');

  if (hasSongLyricsTable) {
    const rows = await safeQuery(warnings, 'Missing lyrics', `
      SELECT COUNT(*) AS total
      FROM songs s
      LEFT JOIN song_lyrics sl ON sl.song_id = s.id
      WHERE ${hasSongLyricsColumn ? '(s.lyrics IS NULL OR TRIM(s.lyrics) = "") AND' : ''}
            (sl.plain_lyrics IS NULL OR TRIM(sl.plain_lyrics) = '')
    `);
    return Number(rows?.[0]?.total || 0);
  }

  if (hasSongLyricsColumn) {
    const rows = await safeQuery(warnings, 'Missing lyrics', 'SELECT COUNT(*) AS total FROM songs WHERE lyrics IS NULL OR TRIM(lyrics) = ""');
    return Number(rows?.[0]?.total || 0);
  }

  warnings.push('Missing lyrics source: songs.lyrics and song_lyrics');
  return 0;
}

async function getMissingFeaturesCount(warnings) {
  if (!(await tableExists('songs'))) return 0;
  if (await tableExists('song_audio_features')) {
    const rows = await safeQuery(warnings, 'Missing audio features', `
      SELECT COUNT(*) AS total
      FROM songs s
      LEFT JOIN song_audio_features saf ON saf.song_id = s.id
      WHERE saf.song_id IS NULL
         OR saf.bpm IS NULL
         OR saf.energy IS NULL OR TRIM(saf.energy) = ''
         OR saf.danceability IS NULL
         OR saf.mood IS NULL OR TRIM(saf.mood) = ''
         OR saf.vibe IS NULL OR TRIM(saf.vibe) = ''
    `);
    return Number(rows?.[0]?.total || 0);
  }

  if (await columnExists('songs', 'tempo')) {
    warnings.push('Missing table: song_audio_features; fallback to songs.tempo only');
    const rows = await safeQuery(warnings, 'Missing tempo fallback', 'SELECT COUNT(*) AS total FROM songs WHERE tempo IS NULL');
    return Number(rows?.[0]?.total || 0);
  }

  warnings.push('Missing audio feature source: song_audio_features and songs.tempo');
  return 0;
}

async function getQuality(warnings) {
  if (!(await tableExists('songs'))) {
    warnings.push('Missing table: songs');
    return emptySummary().quality;
  }

  const [missingAudioRows, missingSongCoverRows] = await Promise.all([
    safeQuery(warnings, 'Missing audio', 'SELECT COUNT(*) AS total FROM songs WHERE audio_url IS NULL OR TRIM(audio_url) = ""'),
    safeQuery(warnings, 'Missing song cover', 'SELECT COUNT(*) AS total FROM songs WHERE cover_url IS NULL OR TRIM(cover_url) = ""'),
  ]);

  let missingAlbumCoverCount = 0;
  if (await tableExists('albums')) {
    const missingAlbumCoverRows = await safeQuery(
      warnings,
      'Missing album cover',
      'SELECT COUNT(*) AS total FROM albums WHERE cover_url IS NULL OR TRIM(cover_url) = ""'
    );
    missingAlbumCoverCount = Number(missingAlbumCoverRows?.[0]?.total || 0);
  }

  const [missingLyricsCount, missingFeaturesCount] = await Promise.all([
    getMissingLyricsCount(warnings),
    getMissingFeaturesCount(warnings),
  ]);

  return {
    missingAudioCount: Number(missingAudioRows?.[0]?.total || 0),
    missingCoverCount: Number(missingSongCoverRows?.[0]?.total || 0) + missingAlbumCoverCount,
    missingLyricsCount,
    missingFeaturesCount,
  };
}

async function getMarketDistribution(warnings) {
  const result = { KPOP: 0, VPOP: 0, USUK: 0, OTHER: 0 };
  if (!(await tableExists('songs'))) return result;
  if (!(await columnExists('songs', 'market'))) {
    warnings.push('Missing column: songs.market');
    return result;
  }

  const rows = await safeQuery(warnings, 'Market distribution', `
    SELECT COALESCE(NULLIF(market, ''), 'OTHER') AS market, COUNT(*) AS total
    FROM songs
    GROUP BY COALESCE(NULLIF(market, ''), 'OTHER')
  `);

  for (const row of rows || []) {
    const key = ['KPOP', 'VPOP', 'USUK'].includes(row.market) ? row.market : 'OTHER';
    result[key] += Number(row.total || 0);
  }
  return result;
}

async function getSystemStatus(warnings) {
  const systemStatus = emptySummary().systemStatus;

  try {
    await pool.query('SELECT 1');
    systemStatus.mysql = 'ok';
  } catch (error) {
    systemStatus.mysql = 'error';
    warnings.push(`MySQL status: ${error.message}`);
  }

  try {
    const redis = require('../config/redis');
    systemStatus.redis = redis.redisClient?.isReady ? 'ok' : 'unavailable';
  } catch {
    systemStatus.redis = 'unavailable';
  }

  systemStatus.aiService = process.env.AI_SERVICE_URL ? 'configured' : 'not_configured';
  systemStatus.uploadsPath.status = fs.existsSync(uploadsRoot) ? 'ok' : 'missing';

  return systemStatus;
}

async function getDashboardSummary() {
  const data = emptySummary();
  const warnings = data.warnings;

  data.totals.totalSongs = await safeCount(warnings, 'songs');
  data.totals.totalArtists = await safeCount(warnings, 'artists');
  data.totals.totalAlbums = await safeCount(warnings, 'albums');
  data.totals.totalGenres = await safeCount(warnings, 'genres');
  data.totals.totalUsers = await safeCount(warnings, 'users');
  data.totals.totalListens = await getTotalListens(warnings);

  data.top.topSong = await getTopSong(warnings);
  data.top.topArtist = await getTopArtist(warnings);
  data.top.topAlbum = await getTopAlbum(warnings);
  data.latestSongs = await getLatestSongs(warnings);
  data.quality = await getQuality(warnings);
  data.marketDistribution = await getMarketDistribution(warnings);
  data.systemStatus = await getSystemStatus(warnings);

  return data;
}

module.exports = {
  getDashboardSummary,
};
