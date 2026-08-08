const fs = require('fs');
const path = require('path');
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
    artistStats: {
      totalArtists: 0,
      newArtistsThisWeek: 0
    },
    playlistStats: {
      totalPlaylists: 0,
      publicPlaylists: 0,
      systemPlaylists: 0,
      userPlaylists: 0
    },
    hotSong: {
      songId: null,
      title: null,
      artistName: null,
      listenCount: 0,
      period: '7d'
    },
    userGrowth: {
      newUsersThisMonth: 0,
      newUsersLastMonth: 0,
      delta: 0
    },
    warnings: [],
  };
}

const projectRoot = path.resolve(__dirname, '../../../..');
const DEBUG_DASHBOARD = process.env.DEBUG_DASHBOARD === 'true';

function dashboardDebugLog(...args) {
  if (DEBUG_DASHBOARD) console.log(...args);
}

function safeReadJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (DEBUG_DASHBOARD) {
      console.warn(`[Dashboard] Failed to read ${filePath}: ${error.message}`);
    }
    return null;
  }
}

function pickMetric(raw, ...keys) {
  for (const key of keys) {
    if (raw && raw[key] !== undefined && raw[key] !== null) return Number(raw[key]);
  }
  return null;
}

function getDashboardRecommendationSummary() {
  const v4ModelPath = path.join(projectRoot, 'storage', 'recommendation', 'models', 'v4', 'best_model_v4.json');
  const v4MetricsPath = path.join(projectRoot, 'storage', 'recommendation', 'evaluation', 'v4', 'metrics_v4.json');
  const v4ImportLogPath = path.join(projectRoot, 'storage', 'recommendation', 'evaluation', 'v4', 'import_v4_to_db_log.json');

  const bestModel = safeReadJsonFile(v4ModelPath);
  const allMetrics = safeReadJsonFile(v4MetricsPath);
  const importLog = safeReadJsonFile(v4ImportLogPath);
  const modelMetrics = bestModel?.metrics || allMetrics?.['LightGCN Hybrid'] || {};

  return {
    status: fs.existsSync(v4ModelPath) ? 'active' : 'offline',
    strategy: 'lightgcn_hybrid_v4',
    strategyLabel: 'LightGCN Hybrid V4',
    benchmarkLabel: 'LightGCN Hybrid V4',
    coreModel: 'LightGCN Hybrid V4',
    version: 'V4',
    hasArtifact: fs.existsSync(v4ModelPath),
    artifactPath: 'storage/recommendation/models/v4/best_model_v4.json',
    updatedAt: fs.existsSync(v4ModelPath) ? fs.statSync(v4ModelPath).mtime : null,
    training: {
      trainedUsers: Number(importLog?.imported_users || 2000),
      users: Number(importLog?.imported_users || 2000),
      interactions: Number(importLog?.imported_interactions || 603435)
    },
    metrics: {
      precisionAt10: pickMetric(modelMetrics, 'Precision@10', 'precisionAt10'),
      recallAt10: pickMetric(modelMetrics, 'Recall@10', 'recallAt10'),
      ndcgAt10: pickMetric(modelMetrics, 'NDCG@10', 'ndcgAt10'),
      hitRateAt10: pickMetric(modelMetrics, 'HitRate@10', 'hitRateAt10'),
      coverageAt20: pickMetric(modelMetrics, 'Coverage@20', 'coverageAt20')
    }
  };
}

function normalizeSystemPlaylistKey(key) {
  return String(key || '').trim().toLowerCase();
}

function getSystemPlaylistScheduleGroup(key) {
  const normalized = normalizeSystemPlaylistKey(key);
  if (/^dailymix_0[1-6]$/.test(normalized) || /^daily_mix_0[1-6]$/.test(normalized)) return 'dailyMix';
  if (['weekly_mix', 'weeklymix'].includes(normalized)) return 'weekly';
  if (['favorite_songs', 'recently_played'].includes(normalized)) return 'behaviorBased';
  if (['moodmix', 'mood_mix', 'morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes', 'trending_now'].includes(normalized)) return 'daily';
  return 'other';
}

function emptySystemPlaylistGroups() {
  return {
    daily: { total: 0, lastRunAt: null, status: 'scheduled', label: 'Hằng ngày' },
    weekly: { total: 0, lastRunAt: null, status: 'scheduled', label: 'Theo tuần' },
    behaviorBased: { total: 0, lastRunAt: null, status: 'behavior_based', label: 'Theo hành vi' },
    dailyMix: { total: 0, lastRunAt: null, status: 'scheduled', label: 'Daily Mix' }
  };
}

async function getDashboardSystemPlaylistSummary() {
  const groups = emptySystemPlaylistGroups();
  const empty = {
    totalSystemPlaylists: 0,
    emptySystemPlaylists: 0,
    missingCover: 0,
    lastUpdatedAt: null,
    lastRunStatus: null,
    lastRegeneratedAt: null,
    hasRecentRunLog: false,
    schedulerEnabled: process.env.ENABLE_SYSTEM_PLAYLIST_SCHEDULER !== 'false',
    groups,
    latestRunLogAt: null,
    items: [],
    error: null
  };

  try {
    if (!(await tableExists('playlists'))) return empty;

    const systemWhere = "(p.type = 'system' OR p.is_system = 1 OR p.system_key IS NOT NULL)";
    const [[summary]] = await pool.query(`
      SELECT COUNT(*) AS totalSystemPlaylists,
             SUM(CASE WHEN p.cover_url IS NULL OR TRIM(p.cover_url) = '' THEN 1 ELSE 0 END) AS missingCover,
             MAX(COALESCE(p.updated_at, p.created_at)) AS lastUpdatedAt
      FROM playlists p
      WHERE ${systemWhere}
    `);

    const [[emptyRow]] = await pool.query(`
      SELECT COUNT(*) AS emptySystemPlaylists
      FROM (
        SELECT p.id
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        WHERE ${systemWhere}
        GROUP BY p.id
        HAVING COUNT(ps.song_id) = 0
      ) x
    `);

    const [items] = await pool.query(`
      SELECT COALESCE(p.system_key, CONCAT('playlist_', p.id)) AS systemKey,
             MAX(p.name) AS name,
             COUNT(DISTINCT p.id) AS totalInstances,
             COUNT(ps.song_id) AS songCount,
             MAX(COALESCE(p.updated_at, p.created_at)) AS lastGeneratedAt,
             SUM(CASE WHEN p.cover_url IS NULL OR TRIM(p.cover_url) = '' THEN 1 ELSE 0 END) AS missingCover
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      WHERE ${systemWhere}
      GROUP BY COALESCE(p.system_key, CONCAT('playlist_', p.id))
      ORDER BY lastGeneratedAt DESC
      LIMIT 12
    `);

    let operationSummary = null;
    const groupRunMap = emptySystemPlaylistGroups();
    let latestRunLogAt = null;
    try {
      const runLogService = require('./systemPlaylistRunLog.service');
      operationSummary = await runLogService.getOperationSummary();
    } catch (error) {
      operationSummary = null;
    }

    if (await tableExists('system_playlist_runs')) {
      const [runRows] = await pool.query(`
        SELECT system_key, MAX(finished_at) AS lastRunAt
        FROM system_playlist_runs
        WHERE finished_at IS NOT NULL
        GROUP BY system_key
      `);
      for (const row of runRows) {
        const groupKey = getSystemPlaylistScheduleGroup(row.system_key);
        if (!groupRunMap[groupKey] || !row.lastRunAt) continue;
        if (!groupRunMap[groupKey].lastRunAt || new Date(row.lastRunAt) > new Date(groupRunMap[groupKey].lastRunAt)) {
          groupRunMap[groupKey].lastRunAt = row.lastRunAt;
        }
        if (!latestRunLogAt || new Date(row.lastRunAt) > new Date(latestRunLogAt)) {
          latestRunLogAt = row.lastRunAt;
        }
      }
    }

    if (operationSummary?.lastRegeneratedAt && (!latestRunLogAt || new Date(operationSummary.lastRegeneratedAt) > new Date(latestRunLogAt))) {
      latestRunLogAt = operationSummary.lastRegeneratedAt;
    }

    const normalizedItems = items.map(row => {
      const groupKey = getSystemPlaylistScheduleGroup(row.systemKey);
      return {
        systemKey: row.systemKey,
        system_key: row.systemKey,
        scheduleGroup: groupKey,
        name: row.name || row.systemKey,
        totalInstances: Number(row.totalInstances || 0),
        songCount: Number(row.songCount || 0),
        lastGeneratedAt: row.lastGeneratedAt || null,
        missingCover: Number(row.missingCover || 0),
        isEmpty: Number(row.songCount || 0) === 0,
        statusLabel: row.lastGeneratedAt ? `Cập nhật ${new Date(row.lastGeneratedAt).toLocaleDateString('vi-VN')}` : 'Chưa có log tạo gần đây'
      };
    });

    for (const item of normalizedItems) {
      if (!groups[item.scheduleGroup]) continue;
      groups[item.scheduleGroup].total += Number(item.totalInstances || 0);
      if (groupRunMap[item.scheduleGroup]?.lastRunAt) {
        groups[item.scheduleGroup].lastRunAt = groupRunMap[item.scheduleGroup].lastRunAt;
      }
      groups[item.scheduleGroup].status = groups[item.scheduleGroup].lastRunAt ? 'has_log' : groups[item.scheduleGroup].status;
    }

    return {
      totalSystemPlaylists: Number(summary?.totalSystemPlaylists || 0),
      emptySystemPlaylists: Number(emptyRow?.emptySystemPlaylists || 0),
      missingCover: Number(summary?.missingCover || 0),
      lastUpdatedAt: summary?.lastUpdatedAt || null,
      lastRegeneratedAt: operationSummary?.lastRegeneratedAt || null,
      lastRunStatus: operationSummary?.lastRunStatus || null,
      hasRecentRunLog: Boolean(latestRunLogAt),
      schedulerEnabled: process.env.ENABLE_SYSTEM_PLAYLIST_SCHEDULER !== 'false',
      groups,
      latestRunLogAt,
      items: normalizedItems,
      error: null
    };
  } catch (error) {
    return { ...empty, error: error.message || 'Không tải được trạng thái playlist tự động' };
  }
}

function getDashboardQuickOperationsLite({ pendingTransactions = 0, systemPlaylistSummary = null } = {}) {
  const playlistSummary = systemPlaylistSummary || {
    totalSystemPlaylists: 0,
    emptySystemPlaylists: 0,
    missingCover: 0,
    lastUpdatedAt: null,
    lastRegeneratedAt: null,
    lastRunStatus: null,
    hasRecentRunLog: false,
    schedulerEnabled: process.env.ENABLE_SYSTEM_PLAYLIST_SCHEDULER !== 'false',
    groups: emptySystemPlaylistGroups(),
    latestRunLogAt: null,
    items: [],
    error: null
  };

  return {
    aiRecommendation: getDashboardRecommendationSummary(),
    systemPlaylists: playlistSummary.items || [],
    systemPlaylistsSummary: playlistSummary,
    playlistAutomation: {
      schedulerEnabled: playlistSummary.schedulerEnabled,
      statusLabel: playlistSummary.schedulerEnabled ? 'Đang bật' : 'Chưa bật',
      hasRecentRunLog: playlistSummary.hasRecentRunLog,
      lastRegeneratedAt: playlistSummary.lastRegeneratedAt,
      lastUpdatedAt: playlistSummary.lastUpdatedAt,
      latestRunLogAt: playlistSummary.latestRunLogAt,
      lastRunStatus: playlistSummary.lastRunStatus,
      message: playlistSummary.hasRecentRunLog
        ? 'Có log tạo/cập nhật gần đây.'
        : 'Chưa có log tạo gần đây. Có thể chạy "Tạo lại tất cả" để cập nhật playlist.'
    },
    contentAlerts: [],
    paymentAttention: {
      failed24h: null,
      pending: Number(pendingTransactions || 0),
      successToday: null,
      recentIssues: []
    }
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

  // 1. artistStats
  data.artistStats.totalArtists = data.totals.totalArtists;
  if (await tableExists('artists')) {
    const [newArtists] = await safeQuery(warnings, 'new artists', 'SELECT COUNT(*) as cnt FROM artists WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    data.artistStats.newArtistsThisWeek = newArtists?.cnt || 0;
  }

  // 2. playlistStats
  if (await tableExists('playlists')) {
    const [playlists] = await safeQuery(warnings, 'playlists', 'SELECT COUNT(*) as total, SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as publicPlaylists, SUM(CASE WHEN is_system = 1 THEN 1 ELSE 0 END) as systemPlaylists, SUM(CASE WHEN is_system = 0 THEN 1 ELSE 0 END) as userPlaylists FROM playlists');
    data.playlistStats.totalPlaylists = playlists?.total || 0;
    data.playlistStats.publicPlaylists = playlists?.publicPlaylists || 0;
    data.playlistStats.systemPlaylists = playlists?.systemPlaylists || 0;
    data.playlistStats.userPlaylists = playlists?.userPlaylists || 0;
  }

  // 3. hotSong
  if (await tableExists('listening_history')) {
    const hot = await safeQuery(warnings, 'hot song', `
      SELECT lh.song_id, COUNT(*) as cnt, s.title, s.artist
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      WHERE lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY lh.song_id, s.title, s.artist
      ORDER BY cnt DESC
      LIMIT 1
    `);
    if (hot && hot.length > 0) {
      data.hotSong.songId = hot[0].song_id;
      data.hotSong.title = hot[0].title;
      data.hotSong.artistName = hot[0].artist;
      data.hotSong.listenCount = hot[0].cnt;
      data.hotSong.period = '7d';
    } else {
      const fallbackHot = await safeQuery(warnings, 'hot song fallback', 'SELECT id, title, artist, play_count FROM songs ORDER BY play_count DESC LIMIT 1');
      if (fallbackHot && fallbackHot.length > 0) {
        data.hotSong.songId = fallbackHot[0].id;
        data.hotSong.title = fallbackHot[0].title;
        data.hotSong.artistName = fallbackHot[0].artist;
        data.hotSong.listenCount = fallbackHot[0].play_count;
        data.hotSong.period = 'all';
      }
    }
  }

  // 4. userGrowth
  if (await tableExists('users')) {
    const [usersGrowth] = await safeQuery(warnings, 'user growth', `
      SELECT
        SUM(CASE WHEN created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01') THEN 1 ELSE 0 END) as thisMonth,
        SUM(CASE WHEN created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH ,'%Y-%m-01') AND created_at < DATE_FORMAT(NOW() ,'%Y-%m-01') THEN 1 ELSE 0 END) as lastMonth
      FROM users
    `);
    data.userGrowth.newUsersThisMonth = Number(usersGrowth?.thisMonth || 0);
    data.userGrowth.newUsersLastMonth = Number(usersGrowth?.lastMonth || 0);
    data.userGrowth.delta = data.userGrowth.newUsersThisMonth - data.userGrowth.newUsersLastMonth;
  }

  return data;
}

let quickOpsCache = { data: null, expiresAt: 0 };

async function getQuickOperations(forceRefresh = false) {
  if (!forceRefresh && quickOpsCache.data && Date.now() < quickOpsCache.expiresAt) {
    return quickOpsCache.data;
  }

  const result = {
    aiStatus: { status: 'Chưa có dữ liệu mô hình' },
    systemPlaylists: [],
    contentAlerts: [],
    paymentAttention: { failed24h: 0, pending: 0, successToday: 0, recentIssues: [] }
  };

  const warnings = [];

  // 1. AI Recommendation Status
  try {
    const adminRecommendationController = require('../controllers/admin_recommendation.controller');
    const summaryData = adminRecommendationController.getSummaryData();

    let label = summaryData.strategyLabel;
    if (!label) {
        label = summaryData.strategy === 'bpr_mf_rerank' ? 'BPR-MF cá nhân hóa' : 'Content-based';
    }

    result.aiRecommendation = {
      status: summaryData.serving?.hasArtifact || summaryData.hasArtifact ? 'active' : 'offline',
      strategy: summaryData.serving?.strategy || summaryData.strategy,
      strategyLabel: summaryData.serving?.strategyLabel || label,
      benchmarkLabel: summaryData.benchmark?.strategyLabel || null,
      hasArtifact: summaryData.serving?.hasArtifact || summaryData.hasArtifact,
      artifactPath: summaryData.serving?.path || summaryData.artifactPath,
      updatedAt: summaryData.updatedAt,
      metrics: summaryData.benchmark?.metrics || summaryData.metrics,
      training: summaryData.benchmark?.training || summaryData.training
    };

    dashboardDebugLog('[Dashboard QuickOps] aiRecommendation:', result.aiRecommendation);
  } catch (e) {
    warnings.push(`AI Recommendation Error: ${e.message}`);
    result.aiRecommendation = { hasArtifact: false };
  }

  // 2. Playlist tự động
  try {
    if (await tableExists('playlists')) {
      const keys = [
        'dailymix_01', 'dailymix_02', 'dailymix_03', 'dailymix_04', 'dailymix_05', 'dailymix_06',
        'weekly_mix', 'weeklymix', 'moodmix', 'mood_mix', 'trending_now', 'morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes'
      ];

      const {
        SYSTEM_PLAYLIST_SCHEDULES,
        getLatestScheduledOccurrence,
        getLastGeneratedAtForKey,
        normalizeSystemKey
      } = require('../schedulers/systemPlaylistScheduler');
      const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

      const [rows] = await pool.query(
        `SELECT
           system_key,
           MAX(name) AS name,
           COUNT(*) AS total_instances,
           MAX(updated_at) AS updated_at
         FROM playlists
         WHERE system_key IN (?) AND is_system = 1
         GROUP BY system_key`,
        [keys]
      );

      const lastGenMap = rows.reduce((acc, row) => {
        const keysToSet = [row.system_key, normalizeSystemKey(row.system_key)];
        for (const key of keysToSet) {
          if (!acc[key] || new Date(row.updated_at) > new Date(acc[key])) {
            acc[key] = row.updated_at;
          }
        }
        return acc;
      }, {});

      let logMap = new Map();
      const lastSuccessMap = {};
      if (await tableExists('system_playlist_runs')) {
        const [runLogs] = await pool.query(`
           SELECT r1.id, r1.system_key, r1.run_type, r1.source_start_date, r1.scheduled_for, r1.finished_at, r1.status
           FROM system_playlist_runs r1
           INNER JOIN (
             SELECT system_key, MAX(id) as max_id
             FROM system_playlist_runs
             GROUP BY system_key
           ) r2 ON r1.id = r2.max_id
        `);
        const [successLogs] = await pool.query(`
           SELECT system_key, MAX(finished_at) AS lastSuccessAt
           FROM system_playlist_runs
           WHERE status = 'success'
           GROUP BY system_key
        `);
        const setLatestLog = (key, log) => {
          const existing = logMap.get(key);
          if (!existing || Number(log.id || 0) > Number(existing.id || 0)) {
            logMap.set(key, log);
          }
        };
        for (const log of runLogs) {
           setLatestLog(log.system_key, log);
           setLatestLog(normalizeSystemKey(log.system_key), log);
        }
        for (const log of successLogs) {
          if (!log.lastSuccessAt) continue;
          const key = normalizeSystemKey(log.system_key);
          const current = lastSuccessMap[key];
          if (!current || new Date(log.lastSuccessAt) > new Date(current)) {
            lastSuccessMap[key] = log.lastSuccessAt;
          }
          lastSuccessMap[log.system_key] = log.lastSuccessAt;
        }
      }

      const now = new Date();
      result.systemPlaylists = rows.map(row => {
        const lastGeneratedDate = row.updated_at;
        const updatedAt = lastGeneratedDate ? new Date(lastGeneratedDate) : null;

        let isStale = false;
        let diffDays = 0;
        let diffHours = 0;
        let statusLabel = 'Cần kiểm tra';

        const schedule = SYSTEM_PLAYLIST_SCHEDULES.find(s =>
          s.keys.some(k =>
            k === row.system_key ||
            normalizeSystemKey(k) === normalizeSystemKey(row.system_key) ||
            k.replace('mix', '_mix') === row.system_key ||
            k.replace('_mix', 'mix') === row.system_key
          )
        );

        if (updatedAt) {
          const diffMs = now - updatedAt;
          diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          diffHours = diffMs / (1000 * 60 * 60);

          if (schedule) {
            const scheduleLastGeneratedAt =
              getLastGeneratedAtForKey(lastSuccessMap, row.system_key) ||
              getLastGeneratedAtForKey(lastGenMap, row.system_key) ||
              updatedAt;
            const latestScheduledFor = getLatestScheduledOccurrence(schedule, now);
            const isDueForLatestSchedule = Boolean(latestScheduledFor) && latestScheduledFor <= now && new Date(scheduleLastGeneratedAt) < latestScheduledFor;
            const delayedMs = latestScheduledFor ? Math.max(0, now - latestScheduledFor) : 0;
            const delayedDays = Math.floor(delayedMs / (1000 * 60 * 60 * 24));

            if (schedule.runDayOfWeek !== undefined) {
              // Weekly or specific day schedule
              const targetDay = schedule.runDayOfWeek;
              isStale = isDueForLatestSchedule;

              const hh = schedule.hour.toString().padStart(2, '0');
              const mm = schedule.minute.toString().padStart(2, '0');
              const nextRunText = `Lịch: ${weekdays[targetDay]} ${hh}:${mm}`;

              if (isStale) {
                statusLabel = delayedDays > 0
                  ? `Chưa ghi nhận ${delayedDays} ngày`
                  : `Đến hạn cập nhật · ${nextRunText}`;
              } else if (logMap.has(row.system_key) || logMap.has(normalizeSystemKey(row.system_key))) {
                const runLog = logMap.get(row.system_key) || logMap.get(normalizeSystemKey(row.system_key));
                const runTypeMap = { 'scheduled': 'Đã chạy theo lịch', 'manual': 'Đã cập nhật thủ công', 'admin_all': 'Đã cập nhật thủ công (All)', 'script': 'Đã chạy bằng script' };
                const prefix = runTypeMap[runLog.run_type] || 'Đã cập nhật';
                let sourceText = '';
                if (runLog.source_start_date && runLog.source_end_date) {
                   const sd1 = new Date(runLog.source_start_date);
                   const sd2 = new Date(runLog.source_end_date);
                   if (sd1.getTime() === sd2.getTime()) {
                     sourceText = ` · Nguồn phân tích: ${weekdays[sd1.getDay()]}`;
                   } else {
                     sourceText = ` · Nguồn phân tích: ${weekdays[sd1.getDay()]} → ${weekdays[sd2.getDay()]}`;
                   }
                }
                statusLabel = `${prefix}${sourceText} · ${nextRunText}`;
              } else if (diffDays === 0 && updatedAt.getDate() === now.getDate()) {
                statusLabel = `Đã cập nhật hôm nay · ${nextRunText}`;
              } else {
                statusLabel = nextRunText;
              }
            } else {
              // Daily schedule
              isStale = isDueForLatestSchedule;
              const hh = schedule.hour !== undefined ? schedule.hour.toString().padStart(2, '0') : '00';
              const mm = schedule.minute !== undefined ? schedule.minute.toString().padStart(2, '0') : '00';
              const nextRunText = `Lịch: Mỗi ngày ${hh}:${mm}`;

              if (isStale) {
                statusLabel = delayedDays > 0
                  ? `Chưa ghi nhận ${delayedDays} ngày`
                  : `Đến hạn cập nhật · ${nextRunText}`;
              } else if (logMap.has(row.system_key) || logMap.has(normalizeSystemKey(row.system_key))) {
                const runLog = logMap.get(row.system_key) || logMap.get(normalizeSystemKey(row.system_key));
                const runTypeMap = { 'scheduled': 'Đã chạy theo lịch', 'manual': 'Đã cập nhật thủ công', 'admin_all': 'Đã cập nhật thủ công', 'script': 'Đã chạy bằng script' };
                const prefix = runTypeMap[runLog.run_type] || 'Đã cập nhật';
                let sourceText = '';
                if (runLog.source_start_date && runLog.source_end_date) {
                   const sd1 = new Date(runLog.source_start_date);
                   const sd2 = new Date(runLog.source_end_date);
                   if (sd1.getTime() === sd2.getTime()) {
                     sourceText = ` · Nguồn phân tích: ${weekdays[sd1.getDay()]}`;
                   } else {
                     sourceText = ` · Nguồn phân tích: ${weekdays[sd1.getDay()]} → ${weekdays[sd2.getDay()]}`;
                   }
                }
                statusLabel = `${prefix}${sourceText} · ${nextRunText}`;
              } else if (diffDays === 0 && updatedAt.getDate() === now.getDate()) {
                statusLabel = `Đã cập nhật hôm nay · ${nextRunText}`;
              } else {
                statusLabel = nextRunText;
              }
            }
          } else {
            // No schedule defined
            isStale = false;
            statusLabel = updatedAt.toLocaleDateString('vi-VN') === now.toLocaleDateString('vi-VN') ? 'Hôm nay' : `Cập nhật ${updatedAt.toLocaleDateString('vi-VN')}`;
          }
        }

        return {
          name: row.name,
          systemKey: row.system_key,
          totalInstances: row.total_instances,
          lastGeneratedAt: lastGeneratedDate,
          displayDate: updatedAt ? updatedAt.toLocaleDateString('vi-VN') : 'Chưa rõ lần cập nhật',
          expectedFrequencyDays: schedule ? (schedule.runDayOfWeek !== undefined ? 7 : 1) : null,
          isStale: updatedAt ? isStale : true,
          staleDays: diffDays,
          statusLabel
        };
      });

      // Deduplicate by normalized system_key if aliases exist (e.g., both weekly_mix and weeklymix)
      const itemMap = new Map();
      for (const item of result.systemPlaylists) {
        const normKey = item.systemKey.replace('_mix', 'mix');
        const existing = itemMap.get(normKey);
        if (!existing || new Date(item.lastGeneratedAt) > new Date(existing.lastGeneratedAt)) {
          itemMap.set(normKey, item);
        }
      }
      result.systemPlaylists = Array.from(itemMap.values());

      const enabled = process.env.ENABLE_SYSTEM_PLAYLIST_SCHEDULER !== 'false';
      result.playlistAutomation = {
        schedulerEnabled: enabled,
        scheduleDescription: 'Daily Mix: Tue-Sat/Mon 00:10; Weekly: Sun 07:00; Trending: daily 00:30; Mood: daily 01:00; Vibes: daily 01:15.',
        nextRunHint: 'Backend kiểm tra mỗi 60 phút và catch-up job đã quá mốc nếu chưa chạy thành công.'
      };

      if (DEBUG_DASHBOARD) {
        console.log('[Dashboard QuickOps] playlistAutomation summary:', {
          count: result.systemPlaylists.length,
          keys: result.systemPlaylists.map(item => item.systemKey)
        });
      }
    }
  } catch (e) {
    warnings.push(`Playlist Error: ${e.message}`);
  }

  // 3. Cảnh báo nội dung
  try {
    if (await tableExists('songs')) {
      const [noAudio] = await pool.query('SELECT COUNT(*) as c FROM songs WHERE audio_url IS NULL OR TRIM(audio_url) = ""');
      result.contentAlerts.push({ id: 'no_audio', title: 'Bài hát thiếu audio', desc: 'Không thể phát nhạc', count: noAudio[0].c, type: 'error', icon: 'error' });

      const missingLyricsCount = await getMissingLyricsCount(warnings);
      result.contentAlerts.push({ id: 'no_lyrics', title: 'Bài hát thiếu lyrics', desc: 'Cần bổ sung lời bài hát', count: missingLyricsCount, type: 'warning', icon: 'article' });
      const [noCover] = await pool.query('SELECT COUNT(*) as c FROM songs WHERE cover_url IS NULL OR TRIM(cover_url) = ""');
      result.contentAlerts.push({ id: 'no_cover', title: 'Bài hát thiếu ảnh bìa', desc: 'Chưa có artwork', count: noCover[0].c, type: 'info', icon: 'image' });
    }
    if (await tableExists('albums')) {
      const [emptyAlbums] = await pool.query("SELECT COUNT(al.id) as c FROM albums al LEFT JOIN songs s ON s.album_id = al.id WHERE s.id IS NULL AND al.release_status NOT IN ('draft', 'hidden')");
      result.contentAlerts.push({ id: 'empty_album', title: 'Album không có bài hát', desc: 'Album rỗng, cần kiểm tra', count: emptyAlbums[0].c, type: 'error', icon: 'album' });
    }
    if (await tableExists('playlists')) {
      const [emptyPlaylists] = await pool.query("SELECT COUNT(p.id) as c FROM playlists p LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id WHERE ps.song_id IS NULL");
      result.contentAlerts.push({ id: 'empty_playlist', title: 'Playlist rỗng', desc: 'Không có bài hát nào', count: emptyPlaylists[0].c, type: 'info', icon: 'playlist' });
    }

    // Sort so errors come first, then warnings, then info, but keep 0 counts at the bottom
    result.contentAlerts.sort((a, b) => {
      if (a.count === 0 && b.count > 0) return 1;
      if (a.count > 0 && b.count === 0) return -1;
      const typeWeight = { error: 3, warning: 2, info: 1 };
      if (typeWeight[a.type] !== typeWeight[b.type]) return typeWeight[b.type] - typeWeight[a.type];
      return b.count - a.count;
    });

  } catch (e) {
    warnings.push(`Content Alert Error: ${e.message}`);
  }

  // 4. Thanh toán cần chú ý
  try {
    if (await tableExists('payment_transactions')) {
      const [[{ failed24h }]] = await pool.query("SELECT COUNT(*) as failed24h FROM payment_transactions WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)");
      const [[{ pending }]] = await pool.query("SELECT COUNT(*) as pending FROM payment_transactions WHERE status = 'pending'");
      const [[{ successToday }]] = await pool.query("SELECT COUNT(*) as successToday FROM payment_transactions WHERE status = 'paid' AND DATE(paid_at) = CURDATE()");

      const [recentIssues] = await pool.query(`
        SELECT t.id, t.amount, t.status, t.created_at, u.email, u.display_name
        FROM payment_transactions t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE t.status IN ('failed', 'pending')
        ORDER BY t.created_at DESC
        LIMIT 3
      `);

      result.paymentAttention = {
        failed24h: failed24h || 0,
        pending: pending || 0,
        successToday: successToday || 0,
        recentIssues: recentIssues || []
      };
    }
  } catch (e) {
    warnings.push(`Payment Alert Error: ${e.message}`);
  }

  const finalResult = { ...result, warnings };
  quickOpsCache = { data: finalResult, expiresAt: Date.now() + 300000 }; // 5 minutes TTL
  return finalResult;
}

module.exports = {
  getDashboardSummary,
  getQuickOperations,
  getDashboardQuickOperationsLite,
  getDashboardSystemPlaylistSummary
};
