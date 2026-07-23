const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');

function getUserId(req) {
  return req.user ? req.user.id : null;
}

const REGION_CONFIG = {
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

async function getRegionChart(region, limit, userId) {
  const config = REGION_CONFIG[region];
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 50);

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
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
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

  const [previousRows] = await pool.query(`
    SELECT s.id, pwc.previous_plays
    FROM (
      SELECT song_id, COUNT(id) AS previous_plays
      FROM listening_history
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
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

  const mappedRows = currentRows.map((row, index) => {
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
  try {
    const userId = getUserId(req);
    const region = String(req.query.region || '').toUpperCase();
    const limit = parseInt(req.query.limit || '5', 10);
    const cacheKey = `weekly:${region || 'all'}:${limit}`;

    // Memory cache
    const cached = weeklyChartCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) { // 15 mins TTL
      // Cache hit, hydrate user likes for fast return
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
      return res.json({ success: true, data, cached: true });
    }

    try {
      let dataToCache;
      if (region && REGION_CONFIG[region]) {
        const rawData = await getRegionChart(region, limit, null);
        dataToCache = rawData;
        weeklyChartCache.set(cacheKey, { timestamp: Date.now(), data: dataToCache });
        const finalData = await hydrateLikedState(rawData, userId);
        return res.json({ success: true, data: finalData });
      }

      const [vn, usuk, kpop] = await Promise.all([
        getRegionChart('VN', limit, null),
        getRegionChart('USUK', limit, null),
        getRegionChart('KPOP', limit, null)
      ]);

      dataToCache = { vn, usuk, kpop };
      weeklyChartCache.set(cacheKey, { timestamp: Date.now(), data: dataToCache });

      res.json({
        success: true,
        data: {
          vn: await hydrateLikedState(vn, userId),
          usuk: await hydrateLikedState(usuk, userId),
          kpop: await hydrateLikedState(kpop, userId)
        }
      });
    } catch (e) {
      if (cached) {
        // Return stale cache if error occurs
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
        return res.json({ success: true, data, stale: true });
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
};
