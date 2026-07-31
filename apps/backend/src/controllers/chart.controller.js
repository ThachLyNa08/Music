const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');

function getUserId(req) {
  return req.user ? req.user.id : null;
}

const REGION_CONFIG = {
  ALL: {
    key: 'all',
    condition: '1=1'
  },
  VN: {
    key: 'vn',
    condition: `
      (
        UPPER(COALESCE(s.market, '')) = 'VPOP'
        OR LOWER(COALESCE(s.language, '')) = 'vi'
        OR LOWER(COALESCE(g.slug, '')) LIKE 'vpop%'
        OR LOWER(COALESCE(g.slug, '')) LIKE 'v-pop%'
        OR LOWER(COALESCE(g.name, '')) LIKE 'vpop%'
        OR LOWER(COALESCE(g.name, '')) LIKE 'v-pop%'
      )
    `
  },
  USUK: {
    key: 'usuk',
    condition: `
      (
        UPPER(COALESCE(s.market, '')) = 'USUK'
        OR LOWER(COALESCE(s.language, '')) = 'en'
        OR LOWER(COALESCE(g.slug, '')) LIKE 'usuk%'
        OR LOWER(COALESCE(g.slug, '')) LIKE 'us-uk%'
        OR LOWER(COALESCE(g.name, '')) LIKE 'usuk%'
        OR LOWER(COALESCE(g.name, '')) LIKE 'us-uk%'
      )
    `
  },
  KPOP: {
    key: 'kpop',
    condition: `
      (
        UPPER(COALESCE(s.market, '')) = 'KPOP'
        OR LOWER(COALESCE(s.language, '')) = 'ko'
        OR LOWER(COALESCE(g.slug, '')) LIKE 'kpop%'
        OR LOWER(COALESCE(g.slug, '')) LIKE 'k-pop%'
        OR LOWER(COALESCE(g.name, '')) LIKE 'kpop%'
        OR LOWER(COALESCE(g.name, '')) LIKE 'k-pop%'
      )
    `
  }
};

async function hydrateLikedState(rows, userId) {
  if (!userId || !Array.isArray(rows) || rows.length === 0) return rows || [];

  const songIds = rows
    .map(row => Number(row.id))
    .filter(id => Number.isInteger(id) && id > 0);

  if (!songIds.length) return rows;

  const [likes] = await pool.query(
    'SELECT song_id FROM song_likes WHERE user_id = ? AND song_id IN (?)',
    [userId, songIds]
  );
  const likedIds = new Set(likes.map(row => String(row.song_id)));

  return rows.map(row => ({
    ...row,
    is_liked: likedIds.has(String(row.id)) ? 1 : 0,
    isLiked: likedIds.has(String(row.id)),
    liked: likedIds.has(String(row.id))
  }));
}

const weeklyChartCache = new Map();
const chartInFlight = new Map();
const CHART_RESPONSE_TIMEOUT_MS = 15000;

function startResponseTimeout(res, message) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      res.status(504).json({ success: false, message });
    }
  }, CHART_RESPONSE_TIMEOUT_MS);

  return {
    isDone: () => timedOut || res.headersSent,
    clear: () => clearTimeout(timer)
  };
}

function sendGuardedJson(responseGuard, res, statusCode, payload) {
  if (responseGuard.isDone()) return null;
  return res.status(statusCode).json(payload);
}

function getOrCreateInFlight(key, factory) {
  if (chartInFlight.has(key)) return chartInFlight.get(key);

  const promise = factory().finally(() => {
    chartInFlight.delete(key);
  });
  chartInFlight.set(key, promise);
  return promise;
}

async function getRegionChart(region, limit, userId) {
  const config = REGION_CONFIG[region] || REGION_CONFIG.ALL;
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 50);

  // 1. Top 7 days
  const [currentRows] = await pool.query(`
    SELECT
      s.id,
      s.title,
      s.duration_sec,
      s.audio_url,
      COALESCE(NULLIF(s.cover_url, ''), NULLIF(al.cover_url, '')) AS cover_url,
      s.play_count,
      s.artist_id,
      a.name AS artist_name,
      a.name AS artist,
      s.album_id,
      al.title AS album_title,
      al.title AS album,
      g.name AS genre_name,
      wc.weekly_plays
    FROM (
      SELECT song_id, COUNT(id) AS weekly_plays
      FROM listening_history
      WHERE listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY song_id
    ) wc
    JOIN songs s ON s.id = wc.song_id
    JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    LEFT JOIN genres g ON s.genre_id = g.id
    WHERE ${publicSongCondition('s')}
      AND ${config.condition}
    ORDER BY wc.weekly_plays DESC, s.play_count DESC, s.created_at DESC
    LIMIT ?
  `, [safeLimit]);

  let songs = [...currentRows];

  // 2. Fallback to 30 days if fewer than safeLimit
  if (songs.length < safeLimit) {
    const existingIds = new Set(songs.map(r => Number(r.id)));
    const remaining = safeLimit - songs.length;
    const [monthlyRows] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        COALESCE(NULLIF(s.cover_url, ''), NULLIF(al.cover_url, '')) AS cover_url,
        s.play_count,
        s.artist_id,
        a.name AS artist_name,
        a.name AS artist,
        s.album_id,
        al.title AS album_title,
        al.title AS album,
        g.name AS genre_name,
        mc.monthly_plays AS weekly_plays
      FROM (
        SELECT song_id, COUNT(id) AS monthly_plays
        FROM listening_history
        WHERE listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY song_id
      ) mc
      JOIN songs s ON s.id = mc.song_id
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE ${publicSongCondition('s')}
        AND ${config.condition}
        ${existingIds.size > 0 ? 'AND s.id NOT IN (?)' : ''}
      ORDER BY mc.monthly_plays DESC, s.play_count DESC, s.created_at DESC
      LIMIT ?
    `, existingIds.size > 0 ? [Array.from(existingIds), remaining] : [remaining]);

    songs = [...songs, ...monthlyRows];
  }

  // 3. Fallback to overall play_count if still fewer than safeLimit
  if (songs.length < safeLimit) {
    const existingIds = new Set(songs.map(r => Number(r.id)));
    const remaining = safeLimit - songs.length;
    const [popularRows] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        COALESCE(NULLIF(s.cover_url, ''), NULLIF(al.cover_url, '')) AS cover_url,
        s.play_count,
        s.artist_id,
        a.name AS artist_name,
        a.name AS artist,
        s.album_id,
        al.title AS album_title,
        al.title AS album,
        g.name AS genre_name,
        0 AS weekly_plays
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE ${publicSongCondition('s')}
        AND ${config.condition}
        ${existingIds.size > 0 ? 'AND s.id NOT IN (?)' : ''}
      ORDER BY s.play_count DESC, s.created_at DESC
      LIMIT ?
    `, existingIds.size > 0 ? [Array.from(existingIds), remaining] : [remaining]);

    songs = [...songs, ...popularRows];
  }

  const [previousRows] = await pool.query(`
    SELECT s.id, pwc.previous_plays
    FROM (
      SELECT song_id, COUNT(id) AS previous_plays
      FROM listening_history
      WHERE listened_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        AND listened_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY song_id
    ) pwc
    JOIN songs s ON pwc.song_id = s.id
    LEFT JOIN genres g ON s.genre_id = g.id
    WHERE ${publicSongCondition('s')}
      AND ${config.condition}
    ORDER BY pwc.previous_plays DESC, s.play_count DESC
    LIMIT 50
  `);

  const previousRankById = new Map(previousRows.map((row, index) => [String(row.id), index + 1]));

  const mappedRows = songs.map((row, index) => {
    const rank = index + 1;
    const previousRank = previousRankById.get(String(row.id)) || null;
    return {
      ...row,
      duration: row.duration_sec,
      is_premium: Boolean(row.is_premium),
      weekly_plays: Number(row.weekly_plays || 0),
      region,
      rank,
      previous_rank: previousRank,
      rank_change: previousRank ? previousRank - rank : null
    };
  });

  return hydrateLikedState(mappedRows, userId);
}

exports.getWeeklyCharts = async (req, res, next) => {
  const responseGuard = startResponseTimeout(
    res,
    'Weekly chart request timed out. Please try again.'
  );

  try {
    const userId = getUserId(req);
    const region = String(req.query.region || '').toUpperCase();
    const limit = parseInt(req.query.limit || '5', 10);
    const cacheKey = `weekly:${region || 'all'}:${limit}`;

    // Memory cache
    const cached = weeklyChartCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) { // 5 mins TTL
      let data;
      if (region && REGION_CONFIG[region]) {
        data = await hydrateLikedState(cached.data, userId);
      } else {
        data = {
          vn: await hydrateLikedState(cached.data.vn, userId),
          usuk: await hydrateLikedState(cached.data.usuk, userId),
          kpop: await hydrateLikedState(cached.data.kpop, userId)
        };
      }
      return sendGuardedJson(responseGuard, res, 200, { success: true, data, cached: true });
    }

    try {
      let dataToCache;
      if (region && REGION_CONFIG[region]) {
        const rawData = await getRegionChart(region, limit, null);
        dataToCache = rawData;
        weeklyChartCache.set(cacheKey, { timestamp: Date.now(), data: dataToCache });
        const finalData = await hydrateLikedState(rawData, userId);
        return sendGuardedJson(responseGuard, res, 200, { success: true, data: finalData });
      }

      const [vn, usuk, kpop] = await getOrCreateInFlight(cacheKey, () => Promise.all([
        getRegionChart('VN', limit, null),
        getRegionChart('USUK', limit, null),
        getRegionChart('KPOP', limit, null)
      ]));

      dataToCache = { vn, usuk, kpop };
      weeklyChartCache.set(cacheKey, { timestamp: Date.now(), data: dataToCache });

      return sendGuardedJson(responseGuard, res, 200, {
        success: true,
        data: {
          vn: await hydrateLikedState(vn, userId),
          usuk: await hydrateLikedState(usuk, userId),
          kpop: await hydrateLikedState(kpop, userId)
        }
      });
    } catch (e) {
      if (cached) {
        let data;
        if (region && REGION_CONFIG[region]) {
          data = await hydrateLikedState(cached.data, userId);
        } else {
          data = {
            vn: await hydrateLikedState(cached.data.vn, userId),
            usuk: await hydrateLikedState(cached.data.usuk, userId),
            kpop: await hydrateLikedState(cached.data.kpop, userId)
          };
        }
        return sendGuardedJson(responseGuard, res, 200, { success: true, data, stale: true });
      }
      throw e;
    }
  } catch (err) {
    if (responseGuard.isDone()) return;
    next(err);
  } finally {
    responseGuard.clear();
  }
};

exports.getGlobalCharts = async (req, res, next) => {
  const responseGuard = startResponseTimeout(
    res,
    'Global chart request timed out. Please try again.'
  );

  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const cacheKey = `global:${limit}`;
    const cached = weeklyChartCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      return sendGuardedJson(responseGuard, res, 200, {
        success: true,
        data: { all: cached.data },
        cached: true
      });
    }

    const data = await getOrCreateInFlight(cacheKey, async () => {
      const rows = await getRegionChart('ALL', limit, null);
      weeklyChartCache.set(cacheKey, { timestamp: Date.now(), data: rows });
      return rows;
    });

    return sendGuardedJson(responseGuard, res, 200, {
      success: true,
      data: { all: data }
    });
  } catch (err) {
    if (responseGuard.isDone()) return;
    next(err);
  } finally {
    responseGuard.clear();
  }
};
