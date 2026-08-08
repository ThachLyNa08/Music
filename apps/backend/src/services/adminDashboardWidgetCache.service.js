const { pool } = require('../config/database');

const DEBUG_DASHBOARD = process.env.DEBUG_DASHBOARD === 'true';
const cacheJobs = new Map();
let tableReady = false;

function debugLog(...args) {
  if (DEBUG_DASHBOARD) console.log(...args);
}

async function ensureCacheTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_dashboard_widget_cache (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      cache_key VARCHAR(128) NOT NULL,
      range_key VARCHAR(64) NOT NULL DEFAULT 'default',
      payload JSON NOT NULL,
      refreshed_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_admin_dashboard_widget_cache (cache_key, range_key),
      KEY idx_admin_dashboard_widget_cache_expires (expires_at)
    )
  `);
  tableReady = true;
}

function parsePayload(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getWidgetCache(cacheKey, rangeKey = 'default') {
  await ensureCacheTable();
  const [rows] = await pool.query(
    `SELECT cache_key, range_key, payload, refreshed_at, expires_at, expires_at > NOW() AS is_fresh
     FROM admin_dashboard_widget_cache
     WHERE cache_key = ? AND range_key = ?
     LIMIT 1`,
    [cacheKey, rangeKey]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    cacheKey: row.cache_key,
    rangeKey: row.range_key,
    payload: parsePayload(row.payload),
    refreshedAt: row.refreshed_at,
    expiresAt: row.expires_at,
    isFresh: Boolean(row.is_fresh)
  };
}

async function setWidgetCache(cacheKey, rangeKey, payload, ttlSeconds = 900) {
  await ensureCacheTable();
  await pool.query(
    `INSERT INTO admin_dashboard_widget_cache
     (cache_key, range_key, payload, refreshed_at, expires_at)
     VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE
       payload = VALUES(payload),
       refreshed_at = VALUES(refreshed_at),
       expires_at = VALUES(expires_at),
       updated_at = NOW()`,
    [cacheKey, rangeKey, JSON.stringify(payload), Number(ttlSeconds || 900)]
  );
}

function refreshWidgetCache(cacheKey, rangeKey, refreshFn, ttlSeconds = 900) {
  const jobKey = `${cacheKey}:${rangeKey}`;
  if (cacheJobs.has(jobKey)) return true;

  const job = Promise.resolve()
    .then(refreshFn)
    .then(payload => setWidgetCache(cacheKey, rangeKey, payload, ttlSeconds))
    .catch(error => debugLog(`[DashboardWidgetCache] refresh failed ${jobKey}:`, error.message))
    .finally(() => cacheJobs.delete(jobKey));

  cacheJobs.set(jobKey, job);
  return true;
}

async function getWidgetSnapshot({ cacheKey, rangeKey = 'default', ttlSeconds = 900, refreshFn, forceRefresh = false }) {
  if (forceRefresh && refreshFn) {
    const payload = await refreshFn();
    await setWidgetCache(cacheKey, rangeKey, payload, ttlSeconds);

    return {
      data: payload,
      meta: {
        cacheKey,
        rangeKey,
        cacheStatus: 'refresh',
        refreshing: false,
        refreshedAt: new Date(),
        expiresAt: null,
        message: null
      }
    };
  }

  const cached = forceRefresh ? null : await getWidgetCache(cacheKey, rangeKey);
  const shouldRefresh = forceRefresh || !cached || !cached.isFresh;

  if (shouldRefresh && refreshFn) {
    refreshWidgetCache(cacheKey, rangeKey, refreshFn, ttlSeconds);
  }

  return {
    data: cached?.payload || null,
    meta: {
      cacheKey,
      rangeKey,
      cacheStatus: cached ? (cached.isFresh ? 'hit' : 'stale') : 'miss',
      refreshing: shouldRefresh,
      refreshedAt: cached?.refreshedAt || null,
      expiresAt: cached?.expiresAt || null,
      message: cached
        ? (shouldRefresh ? 'Đang cập nhật số liệu...' : null)
        : 'Đang cập nhật số liệu...'
    }
  };
}

let dbOffsetCache = {
  value: 420,
  expiresAt: 0
};

async function getDatabaseUtcOffsetMinutes() {
  if (dbOffsetCache.expiresAt > Date.now()) return dbOffsetCache.value;

  try {
    const [[row]] = await pool.query(`
      SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offset_minutes
    `);
    const offset = Number(row?.offset_minutes);
    if (Number.isFinite(offset)) {
      dbOffsetCache = {
        value: offset,
        expiresAt: Date.now() + 10 * 60 * 1000
      };
      return offset;
    }
  } catch (error) {
    debugLog('[DashboardWidgetCache] Cannot detect DB timezone offset:', error.message);
  }

  return dbOffsetCache.value;
}

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day)
  };
}

function vietnamLocalMidnightUtcMs(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day) - 420 * 60 * 1000;
}

function formatMysqlDateTimeFromUtcMs(utcMs, dbOffsetMinutes) {
  const dbDate = new Date(utcMs + dbOffsetMinutes * 60 * 1000);
  return `${dbDate.getUTCFullYear()}-${pad(dbDate.getUTCMonth() + 1)}-${pad(dbDate.getUTCDate())} ${pad(dbDate.getUTCHours())}:${pad(dbDate.getUTCMinutes())}:${pad(dbDate.getUTCSeconds())}`;
}

function formatVietnamIsoFromUtcMs(utcMs) {
  const vnDate = new Date(utcMs + 420 * 60 * 1000);
  return `${vnDate.getUTCFullYear()}-${pad(vnDate.getUTCMonth() + 1)}-${pad(vnDate.getUTCDate())}T${pad(vnDate.getUTCHours())}:${pad(vnDate.getUTCMinutes())}:${pad(vnDate.getUTCSeconds())}+07:00`;
}

function vietnamDateKeyFromOffset(dayOffset) {
  const todayParts = getVietnamDateParts();
  const utcMs = vietnamLocalMidnightUtcMs(todayParts) + dayOffset * 24 * 60 * 60 * 1000;
  const date = new Date(utcMs + 420 * 60 * 1000);
  return {
    key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    label: `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`
  };
}

async function buildDateConfig(range, dataset) {
  const safeRange = ['today', '7d', '30d', 'all'].includes(range) ? range : '7d';
  const dbOffsetMinutes = await getDatabaseUtcOffsetMinutes();
  const vietnamShiftMinutes = 420 - dbOffsetMinutes;
  const bucketExpr = vietnamShiftMinutes === 0
    ? 'lh.listened_at'
    : `DATE_ADD(lh.listened_at, INTERVAL ${vietnamShiftMinutes} MINUTE)`;
  const base = {
    dataset: 'system',
    range: safeRange,
    rangeKey: safeRange,
    dateColumn: 'listened_at',
    bucketExpr,
    params: [],
    start: null,
    end: null
  };

  if (safeRange === 'all') {
    return {
      ...base,
      whereSql: '1 = 1',
      bucketFormat: '%Y-%m-%d',
      bucketOrder: '%Y-%m-%d',
      bucketCount: 30,
      bucketType: 'day'
    };
  }

  const ranges = {
    today: { startOffset: 0, bucketCount: 24, bucketType: 'hour' },
    '7d': { startOffset: -6, bucketCount: 7, bucketType: 'day' },
    '30d': { startOffset: -29, bucketCount: 30, bucketType: 'day' }
  };
  const rangeConfig = ranges[safeRange];
  const todayStartUtc = vietnamLocalMidnightUtcMs(getVietnamDateParts());
  const startUtc = todayStartUtc + rangeConfig.startOffset * 24 * 60 * 60 * 1000;
  const endUtc = todayStartUtc + 24 * 60 * 60 * 1000;

  return {
    ...base,
    whereSql: 'lh.listened_at >= ? AND lh.listened_at < ?',
    bucketFormat: rangeConfig.bucketType === 'hour' ? '%H:00' : '%Y-%m-%d',
    bucketOrder: rangeConfig.bucketType === 'hour' ? '%H' : '%Y-%m-%d',
    bucketCount: rangeConfig.bucketCount,
    bucketType: rangeConfig.bucketType,
    params: [
      formatMysqlDateTimeFromUtcMs(startUtc, dbOffsetMinutes),
      formatMysqlDateTimeFromUtcMs(endUtc, dbOffsetMinutes)
    ],
    start: formatVietnamIsoFromUtcMs(startUtc),
    end: formatVietnamIsoFromUtcMs(endUtc)
  };
}

function formatLocalDateKey(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildBuckets(config) {
  if (config.bucketType === 'hour') {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: pad(hour),
      label: `${pad(hour)}:00`
    }));
  }

  return Array.from({ length: config.bucketCount }, (_, i) => {
    return vietnamDateKeyFromOffset(-(config.bucketCount - 1 - i));
  });
}

async function buildListeningTrendsPayload(range = '7d', dataset = 'system') {
  const config = await buildDateConfig(range, dataset);
  const validListenExpr = 'CASE WHEN lh.is_completed = 1 OR lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END';

  const [seriesRows] = await pool.query(`
    SELECT DATE_FORMAT(${config.bucketExpr}, ?) AS label,
           DATE_FORMAT(${config.bucketExpr}, ?) AS sort_key,
           SUM(${validListenExpr}) AS recent_plays,
           COUNT(*) AS raw_listen_events
    FROM listening_history lh
    WHERE ${config.whereSql}
    GROUP BY label, sort_key
    ORDER BY sort_key ASC
  `, [config.bucketFormat, config.bucketOrder, ...config.params]);

  const [topRows] = await pool.query(`
    SELECT lh.song_id,
           SUM(${validListenExpr}) AS recent_plays,
           COUNT(*) AS raw_listen_events
    FROM listening_history lh
    WHERE ${config.whereSql}
    GROUP BY lh.song_id
    HAVING recent_plays > 0
    ORDER BY recent_plays DESC
    LIMIT 10
  `, config.params);

  const buckets = buildBuckets(config);
  const seriesMap = new Map(seriesRows.map(row => [String(row.sort_key), row]));
  const series = buckets.map(bucket => {
    const row = seriesMap.get(bucket.key);
    return {
      label: bucket.label,
      sort_key: bucket.key,
      listens: Number(row?.recent_plays || 0),
      recent_plays: Number(row?.recent_plays || 0),
      raw_listen_events: Number(row?.raw_listen_events || 0)
    };
  });

  let topSongs = [];
  if (topRows.length) {
    const songIds = topRows.map(row => row.song_id);
    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.cover_url, s.play_count, a.name AS artist, al.title AS album
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.id IN (?)
    `, [songIds]);
    const songMap = new Map(songs.map(song => [song.id, song]));
    topSongs = topRows.map(row => {
      const song = songMap.get(row.song_id) || {};
      return {
        id: row.song_id,
        title: song.title,
        cover_url: song.cover_url,
        artist: song.artist,
        album: song.album,
        play_count: song.play_count,
        listens: Number(row.recent_plays || 0),
        recent_plays: Number(row.recent_plays || 0),
        raw_listen_events: Number(row.raw_listen_events || 0),
        previous_recent_plays: null,
        previous_listens: null
      };
    });
  }

  const hasData = series.some(item => item.listens > 0) || topSongs.length > 0;
  const payload = {
    range: config.range,
    dataset: config.dataset,
    start: config.start,
    end: config.end,
    series,
    topSongs,
    emptyReason: hasData ? null : 'Không có lượt nghe trong khoảng thời gian này.'
  };
  await setWidgetCache('dashboard_top_songs_cache', config.rangeKey, {
    range: config.range,
    dataset: config.dataset,
    topSongs,
    emptyReason: payload.emptyReason
  }, 900);
  return payload;
}

async function buildTotalListensPayload(range = 'all', dataset = 'system') {
  const config = await buildDateConfig(range, dataset);
  const [[row]] = await pool.query(`
    SELECT COUNT(*) AS total_listens
    FROM listening_history lh
    WHERE ${config.whereSql}
  `, config.params);

  return {
    range: config.range,
    dataset: config.dataset,
    totalListens: Number(row?.total_listens || 0)
  };
}

async function buildTopArtistsPayload(range = '7d', dataset = 'system') {
  const config = await buildDateConfig(range, dataset);
  const validListenExpr = 'CASE WHEN lh.is_completed = 1 OR lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END';

  const [topArtists] = await pool.query(`
    SELECT ranked.id, ranked.name, ranked.avatar_url, ranked.avatar_url AS image,
           COALESCE(song_counts.song_count, 0) AS song_count,
           ranked.recent_plays,
           ranked.recent_plays AS listens,
           ranked.raw_listen_events
    FROM (
      SELECT s.artist_id AS id, a.name, a.avatar_url,
             SUM(t.recent_plays) AS recent_plays,
             SUM(t.raw_listen_events) AS raw_listen_events
      FROM (
        SELECT lh.song_id, SUM(${validListenExpr}) AS recent_plays, COUNT(lh.id) AS raw_listen_events
        FROM listening_history lh
        WHERE ${config.whereSql}
        GROUP BY lh.song_id
        HAVING recent_plays > 0
      ) t
      JOIN songs s ON t.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      GROUP BY s.artist_id, a.name, a.avatar_url
      ORDER BY recent_plays DESC
      LIMIT 5
    ) ranked
    LEFT JOIN (
      SELECT artist_id, COUNT(*) AS song_count
      FROM songs
      WHERE is_active = TRUE
      GROUP BY artist_id
    ) song_counts ON song_counts.artist_id = ranked.id
    ORDER BY ranked.recent_plays DESC
  `, config.params);

  const buckets = buildBuckets(config);
  const artistIds = topArtists.map(artist => artist.id);
  let trendRows = [];

  if (artistIds.length) {
    const [artistSongs] = await pool.query('SELECT id, artist_id FROM songs WHERE artist_id IN (?)', [artistIds]);
    if (artistSongs.length) {
      const songToArtist = new Map(artistSongs.map(song => [song.id, song.artist_id]));
      const [rows] = await pool.query(`
        SELECT lh.song_id,
               DATE_FORMAT(${config.bucketExpr}, ?) AS bucket_key,
               DATE_FORMAT(${config.bucketExpr}, ?) AS label,
               SUM(${validListenExpr}) AS recent_plays,
               COUNT(lh.id) AS raw_listen_events
        FROM listening_history lh
        WHERE ${config.whereSql} AND lh.song_id IN (?)
        GROUP BY lh.song_id, bucket_key, label
      `, [config.bucketOrder, config.bucketFormat, ...config.params, Array.from(songToArtist.keys())]);

      const artistBucketMap = new Map();
      for (const row of rows) {
        const artistId = songToArtist.get(row.song_id);
        const key = `${artistId}:${row.bucket_key}`;
        if (!artistBucketMap.has(key)) {
          artistBucketMap.set(key, {
            artist_id: artistId,
            bucket_key: row.bucket_key,
            label: row.label,
            recent_plays: 0,
            raw_listen_events: 0
          });
        }
        const entry = artistBucketMap.get(key);
        entry.recent_plays += Number(row.recent_plays || 0);
        entry.raw_listen_events += Number(row.raw_listen_events || 0);
      }
      trendRows = Array.from(artistBucketMap.values());
    }
  }

  const trendMap = new Map(trendRows.map(row => [`${row.artist_id}:${row.bucket_key}`, row]));
  const normalizedArtists = topArtists.map(artist => ({
    ...artist,
    recent_plays: Number(artist.recent_plays || 0),
    listens: Number(artist.listens || 0),
    raw_listen_events: Number(artist.raw_listen_events || 0),
    song_count: Number(artist.song_count || 0)
  }));

  const series = buckets.map(bucket => {
    const artists = normalizedArtists.map(artist => {
      const row = trendMap.get(`${artist.id}:${bucket.key}`);
      return {
        artist_id: artist.id,
        artist_name: artist.name,
        listens: Number(row?.recent_plays || 0),
        recent_plays: Number(row?.recent_plays || 0),
        raw_listen_events: Number(row?.raw_listen_events || 0)
      };
    });
    return artists.reduce((result, artist) => {
      result[artist.artist_name] = artist.listens;
      return result;
    }, { label: bucket.label, sort_key: bucket.key, artists });
  });

  const hasData = normalizedArtists.length > 0 || series.some(row => row.artists.some(artist => artist.listens > 0));
  return {
    range: config.range,
    dataset: config.dataset,
    topArtists: normalizedArtists,
    series,
    topArtistTrend: series,
    emptyReason: hasData ? null : 'Không có lượt nghe trong khoảng thời gian này.'
  };
}

async function buildTopGenresPayload(range = 'all', dataset = 'system') {
  const config = await buildDateConfig(range, dataset);
  const [rows] = await pool.query(`
    SELECT g.id,
           g.name,
           COUNT(*) AS listen_count
    FROM listening_history lh
    JOIN songs s ON s.id = lh.song_id
    JOIN genres g ON g.id = s.genre_id
    WHERE s.genre_id IS NOT NULL
      AND ${config.whereSql}
    GROUP BY g.id, g.name
    ORDER BY listen_count DESC
    LIMIT 5
  `, config.params);

  return {
    range: config.range,
    dataset: config.dataset,
    genres: rows.map(row => ({
      id: row.id,
      name: row.name || 'Khác',
      listen_count: Number(row.listen_count || 0),
      listens: Number(row.listen_count || 0),
      total_plays: Number(row.listen_count || 0)
    })),
    emptyReason: rows.length ? null : 'Không có lượt nghe trong khoảng thời gian này.'
  };
}

module.exports = {
  ensureCacheTable,
  getWidgetCache,
  setWidgetCache,
  getWidgetSnapshot,
  buildListeningTrendsPayload,
  buildTotalListensPayload,
  buildTopArtistsPayload,
  buildTopGenresPayload,
  buildDateConfig
};
