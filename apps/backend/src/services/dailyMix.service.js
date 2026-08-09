// apps/backend/src/services/dailyMix.service.js
// Daily Mix 01..06 auto-generation based on the recommendation service.
//
// Concept:
//   Daily Mix của một ngày D được tạo từ hành vi nghe nhạc của ngày D
//   (hoặc cả Thứ Bảy + Chủ nhật đối với dailymix_06). Playlist gồm 2 phần:
//     - anchor songs: 25-35% tổng số bài, là các bài user đã nghe nổi bật
//       trong target range (ưu tiên completion_rate cao, không skip, nghe
//       lặp, đã like, có audio public).
//     - discovery songs: 65-75% còn lại, là các bài tương tự / mở rộng
//       dựa trên top genres + top artists + top markets của target range,
//       fallback sang recommendation.service nếu dữ liệu ngày đó quá ít.
//
//   Daily Mix KHÔNG phải Recently Played thứ hai: anchor chỉ là một phần
//   nhỏ và đã được chọn lọc. Nó cũng không loại bỏ hoàn toàn bài đã nghe:
//   anchor giúp playlist vẫn có cảm giác quen thuộc.
//
// Idempotency: matches weeklyMix.service pattern. findExistingPlaylist giữ
// nguyên playlist id; replacePlaylistSongs refresh playlist_songs.

const { pool } = require('../config/database');
const recommendationService = require('./recommendation.service');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const { publicSongCondition } = require('../utils/public.utils');
const { SYSTEM_PLAYLIST_BY_KEY } = require('./systemPlaylist.service');
const {
  computeOverlapStats,
  selectSongsWithOverlapCheck,
  getPlaylistSongIds,
  getRecentSystemPlaylistSongs,
  evaluateRegenerateQuality,
  calculatePlaylistDiversity
} = require('../utils/playlistRegenerate.util');

const SYSTEM_KEYS = [
  'dailymix_01',
  'dailymix_02',
  'dailymix_03',
  'dailymix_04',
  'dailymix_05',
  'dailymix_06',
];

// Mô tả playlist theo spec. Khi scheduler / CLI chạy, mô tả này được ghi
// vào DB, dù controller Home có thể ghi đè lại sau (xem docs).
const PLAYLIST_DESCRIPTIONS = {
  dailymix_01: 'Dựa trên gu nghe ngày Thứ Hai',
  dailymix_02: 'Dựa trên gu nghe ngày Thứ Ba',
  dailymix_03: 'Dựa trên gu nghe ngày Thứ Tư',
  dailymix_04: 'Dựa trên gu nghe ngày Thứ Năm',
  dailymix_05: 'Dựa trên gu nghe ngày Thứ Sáu',
  dailymix_06: 'Dựa trên gu nghe cuối tuần',
};

const WEEKDAY_LABELS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_VI_FULL = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const DEFAULT_PER_MIX = 25;
const MIN_PER_MIX = 10;
const MAX_PER_MIX = 30;

// Tỉ lệ anchor: 25-35% (ở giữa 30%).
const ANCHOR_RATIO = 0.30;
const ANCHOR_RATIO_FALLBACK = 0.18; // khi ít dữ liệu, giảm anchor
const MAX_PER_ARTIST = 2;
const ARTIST_CAP_HARD = 3;
const HISTORY_LOOKBACK_DAYS = 3; // mở rộng profile nếu target range trống
const RECOMMEND_PULL = 120;
const FALLBACK_LISTENED_COUNT_FOR_ANCHOR = 8; // < 8 rows target range => fallback history
const RECENTLY_PLAYED_RATIO_WARN = 0.5; // > 50% anchor/total => cảnh báo

const DAILYMIX_LIMITS = {
  targetSize: DEFAULT_PER_MIX,
  maxSameArtistRatio: 0.30,
  maxSameGenreRatio: 0.75,
  minAddedSongs: 8,
  crossPlaylistOverlapWarning: 0.70,
  crossPlaylistOverlapBad: 0.90,
  minCandidateCountMultiplier: 2
};

// ---------------------------------------------------------------------------
// Helpers về playlist persistence (giữ nguyên từ version trước, đã pass test)
// ---------------------------------------------------------------------------

function clampPerMix(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PER_MIX;
  return Math.min(MAX_PER_MIX, Math.floor(n));
}

async function findExistingPlaylist(conn, userId, systemKey) {
  const [rows] = await conn.query(
    `SELECT id, user_id, type, is_system, system_key
     FROM playlists
     WHERE user_id = ? AND system_key = ? AND is_system = 1
     LIMIT 1`,
    [userId, systemKey]
  );
  return rows[0] || null;
}

async function ensurePlaylist(conn, userId, systemKey, name, description) {
  const existing = await findExistingPlaylist(conn, userId, systemKey);
  const coverUrl = resolvePlaylistCoverUrl(systemKey);

  if (existing) {
    await conn.query(
      `UPDATE playlists
       SET name = ?, description = ?, cover_url = ?, type = 'system', is_system = 1, updated_at = NOW()
       WHERE id = ?`,
      [name, description, coverUrl, existing.id]
    );
    return { playlistId: existing.id, created: false };
  }

  const [result] = await conn.query(
    `INSERT INTO playlists (user_id, name, description, cover_url, type, is_public, is_system, system_key)
     VALUES (?, ?, ?, ?, 'system', 0, 1, ?)`,
    [userId, name, description, coverUrl, systemKey]
  );
  return { playlistId: result.insertId, created: true };
}

async function replacePlaylistSongs(conn, playlistId, songIds, nextRefreshAt = null) {
  await conn.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId]);
  if (!songIds.length) return 0;
  const values = songIds.map((songId, idx) => [playlistId, songId, idx]);
  await conn.query(
    `INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ?`,
    [values]
  );
  if (nextRefreshAt) {
    await conn.query(
      `UPDATE playlists 
       SET last_refreshed_at = NOW(), 
           next_refresh_at = ? 
       WHERE id = ?`, 
      [nextRefreshAt, playlistId]
    );
  } else {
    await conn.query(
      `UPDATE playlists 
       SET last_refreshed_at = NOW(), 
           next_refresh_at = DATE_ADD(NOW(), INTERVAL 7 DAY) 
       WHERE id = ?`, 
      [playlistId]
    );
  }
  return songIds.length;
}

function getNextRefreshDateForDailyMix(systemKey) {
  const now = new Date();
  const day = now.getDay(); 
  const targetDayMap = {
    'dailymix_01': 2,
    'dailymix_02': 3,
    'dailymix_03': 4,
    'dailymix_04': 5,
    'dailymix_05': 6,
    'dailymix_06': 1
  };
  const targetDay = targetDayMap[systemKey];
  if (targetDay === undefined) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return nextWeek;
  }
  
  let daysUntil = targetDay - day;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, 0, 10, 0);
}

// ---------------------------------------------------------------------------
// Helpers về date / weekday mapping
// ---------------------------------------------------------------------------

function weekdayToSystemKey(date) {
  const w = date.getDay();
  switch (w) {
    case 1: return 'dailymix_01';
    case 2: return 'dailymix_02';
    case 3: return 'dailymix_03';
    case 4: return 'dailymix_04';
    case 5: return 'dailymix_05';
    case 0: // CN
    case 6: return 'dailymix_06';
    default: return null;
  }
}

function weekdayLabel(date) {
  return WEEKDAY_LABELS_VI[date.getDay()];
}

function weekdayFull(date) {
  return WEEKDAY_LABELS_VI_FULL[date.getDay()];
}

function computeTargetRange(dateObj) {
  const wd = dateObj.getDay();
  let start, end;
  if (wd === 0) {
    const sat = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() - 1);
    const mon = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1);
    start = sat;
    end = mon;
  } else if (wd === 6) {
    const mon = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 2);
    start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    end = mon;
  } else {
    start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    end = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1);
  }
  return { start, end, isWeekend: wd === 0 || wd === 6 };
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// DAYOFWEEK mapping for MySQL (1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat)
// ---------------------------------------------------------------------------

const DAILY_MIX_MYSQL_DAYS = {
  dailymix_01: [2],    // Thứ Hai
  dailymix_02: [3],    // Thứ Ba
  dailymix_03: [4],    // Thứ Tư
  dailymix_04: [5],    // Thứ Năm
  dailymix_05: [6],    // Thứ Sáu
  dailymix_06: [7, 1]  // Thứ Bảy + Chủ Nhật
};

function normalizeAnalysisWindow(options = {}) {
  if (!options.analysisWindow) return null;
  const startAt = options.analysisWindow.analysisStart || options.analysisWindow.startAt;
  const endAt = options.analysisWindow.analysisEnd || options.analysisWindow.endAt;
  if (!startAt || !endAt) return null;
  return { startAt, endAt };
}

// ---------------------------------------------------------------------------
// Helpers về target range + listened rows (DAYOFWEEK-based tiered fetch)
// ---------------------------------------------------------------------------

async function fetchListeningRowsByDayOfWeek(conn, userId, systemKey, options = {}) {
  const mysqlDays = DAILY_MIX_MYSQL_DAYS[systemKey];
  if (!mysqlDays) throw new Error(`No DAYOFWEEK mapping for ${systemKey}`);

  const dayPlaceholders = mysqlDays.map(() => '?').join(',');

  const tierResults = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
  const analysisWindow = normalizeAnalysisWindow(options);

  if (analysisWindow) {
    const [closedRows] = await conn.query(
      `SELECT lh.id, lh.song_id, lh.completion_rate, lh.is_skipped, lh.implicit_rating,
              s.id AS s_id, s.title, s.genre_id, s.artist_id, s.market,
              s.audio_url, s.is_active, s.release_status, s.play_count
       FROM listening_history lh
       JOIN songs s ON s.id = lh.song_id
       WHERE lh.user_id = ?
         AND lh.listened_at >= ?
         AND lh.listened_at < ?
         AND ${publicSongCondition('s')}
         AND s.audio_url IS NOT NULL
         AND s.audio_url <> ''
       ORDER BY lh.listened_at DESC`,
      [userId, analysisWindow.startAt, analysisWindow.endAt]
    );
    tierResults.tier1 = closedRows.length;
    if (closedRows.length >= FALLBACK_LISTENED_COUNT_FOR_ANCHOR) {
      return { rows: closedRows, tierUsed: 'tier_1_closed_window', tierResults };
    }
  }

  // Tier 1: same weekday within 4 weeks
  const [tier1Rows] = await conn.query(
    `SELECT lh.id, lh.song_id, lh.completion_rate, lh.is_skipped, lh.implicit_rating,
            s.id AS s_id, s.title, s.genre_id, s.artist_id, s.market,
            s.audio_url, s.is_active, s.release_status, s.play_count
     FROM listening_history lh
     JOIN songs s ON s.id = lh.song_id
     WHERE lh.user_id = ?
       AND DAYOFWEEK(lh.listened_at) IN (${dayPlaceholders})
       AND lh.listened_at >= DATE_SUB(?, INTERVAL 28 DAY)
       AND lh.listened_at < ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY lh.listened_at DESC`,
    [userId, ...mysqlDays, analysisWindow?.endAt || new Date(), analysisWindow?.endAt || new Date()]
  );
  tierResults.tier1 = tier1Rows.length;

  if (tier1Rows.length >= FALLBACK_LISTENED_COUNT_FOR_ANCHOR) {
    return { rows: tier1Rows, tierUsed: 'tier_1_same_weekday_4_weeks', tierResults };
  }

  // Tier 2: same weekday within 8 weeks
  const [tier2Rows] = await conn.query(
    `SELECT lh.id, lh.song_id, lh.completion_rate, lh.is_skipped, lh.implicit_rating,
            s.id AS s_id, s.title, s.genre_id, s.artist_id, s.market,
            s.audio_url, s.is_active, s.release_status, s.play_count
     FROM listening_history lh
     JOIN songs s ON s.id = lh.song_id
     WHERE lh.user_id = ?
       AND DAYOFWEEK(lh.listened_at) IN (${dayPlaceholders})
       AND lh.listened_at >= DATE_SUB(?, INTERVAL 56 DAY)
       AND lh.listened_at < ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY lh.listened_at DESC`,
    [userId, ...mysqlDays, analysisWindow?.endAt || new Date(), analysisWindow?.endAt || new Date()]
  );
  tierResults.tier2 = tier2Rows.length;

  if (tier2Rows.length >= FALLBACK_LISTENED_COUNT_FOR_ANCHOR) {
    return { rows: tier2Rows, tierUsed: 'tier_2_same_weekday_8_weeks', tierResults };
  }

  return {
    rows: tier2Rows,
    tierUsed: tier2Rows.length > 0 ? 'tier_2_same_weekday_8_weeks_partial' : 'tier_3_genre_artist_fallback',
    tierResults
  };
}

async function getSongsInOtherDailyMixes(conn, systemKey) {
  const [rows] = await conn.query(
    `SELECT DISTINCT ps.song_id
     FROM playlist_songs ps
     JOIN playlists p ON p.id = ps.playlist_id
     WHERE p.is_system = 1
       AND p.system_key LIKE 'dailymix_%'
       AND p.system_key <> ?`,
    [systemKey]
  );
  return new Set(rows.map(r => Number(r.song_id)));
}

function calculateCrossOverlapRatio(finalIds, otherDailyMixSongs) {
  if (!finalIds.length || !otherDailyMixSongs.size) return 0;
  let overlap = 0;
  for (const id of finalIds) {
    if (otherDailyMixSongs.has(Number(id))) overlap++;
  }
  return overlap / finalIds.length;
}

// Legacy helpers kept for backward compat
async function fetchListeningRowsInRange(conn, userId, start, end) {
  const startStr = fmtDate(start) + ' 00:00:00';
  const endStr = fmtDate(end) + ' 00:00:00';
  const [rows] = await conn.query(
    `SELECT lh.id, lh.song_id, lh.completion_rate, lh.is_skipped, lh.implicit_rating,
            s.id AS s_id, s.title, s.genre_id, s.artist_id, s.market,
            s.audio_url, s.is_active, s.release_status, s.play_count
     FROM listening_history lh
     JOIN songs s ON s.id = lh.song_id
     WHERE lh.user_id = ?
       AND lh.listened_at >= ?
       AND lh.listened_at < ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY lh.listened_at DESC`,
    [userId, startStr, endStr]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Helpers về daily profile
// ---------------------------------------------------------------------------

function buildDailyProfile(rows) {
  const profile = {
    totalRows: rows.length,
    genreCounts: new Map(),
    artistCounts: new Map(),
    marketCounts: new Map(),
    songStats: new Map(),
    distinctSongIds: new Set(),
  };
  for (const r of rows) {
    const sid = Number(r.song_id);
    profile.distinctSongIds.add(sid);
    if (r.genre_id !== null && r.genre_id !== undefined) {
      const g = Number(r.genre_id);
      profile.genreCounts.set(g, (profile.genreCounts.get(g) || 0) + 1);
    }
    if (r.artist_id !== null && r.artist_id !== undefined) {
      const a = Number(r.artist_id);
      profile.artistCounts.set(a, (profile.artistCounts.get(a) || 0) + 1);
    }
    if (r.market) {
      profile.marketCounts.set(String(r.market), (profile.marketCounts.get(String(r.market)) || 0) + 1);
    }
    const cur = profile.songStats.get(sid) || {
      count: 0,
      totalCompletion: 0,
      skipCount: 0,
      implicitSum: 0,
      title: r.title,
      genre_id: r.genre_id,
      artist_id: r.artist_id,
      market: r.market,
    };
    cur.count += 1;
    cur.totalCompletion += Number(r.completion_rate || 0);
    cur.skipCount += r.is_skipped ? 1 : 0;
    cur.implicitSum += Number(r.implicit_rating || 0);
    profile.songStats.set(sid, cur);
  }
  return profile;
}

function topNFromMap(map, n = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, c]) => ({ id, c }));
}

async function fetchLikedSongIdsInRange(conn, userId, start, end) {
  const startStr = fmtDate(new Date(
    start.getFullYear(), start.getMonth(), start.getDate() - 30,
  )) + ' 00:00:00';
  const endStr = fmtDate(end) + ' 00:00:00';
  const [rows] = await conn.query(
    `SELECT DISTINCT song_id FROM song_likes
     WHERE user_id = ? AND liked_at >= ? AND liked_at < ?`,
    [userId, startStr, endStr]
  );
  return new Set(rows.map((r) => Number(r.song_id)));
}

// ---------------------------------------------------------------------------
// Anchor + Discovery logic
// ---------------------------------------------------------------------------

function selectAnchorSongs(profile, likedSet, anchorTarget) {
  const candidates = [];
  for (const [sid, stat] of profile.songStats.entries()) {
    const completionAvg = stat.totalCompletion / Math.max(1, stat.count);
    const skipRatio = stat.skipCount / Math.max(1, stat.count);
    const likedBonus = likedSet.has(sid) ? 5 : 0;
    const score =
      completionAvg * 2 +
      stat.count * 1.5 +
      stat.implicitSum * 0.5 -
      skipRatio * 3 +
      likedBonus;
    candidates.push({ song_id: sid, score, stat });
  }
  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const artistCount = new Map();
  for (const c of candidates) {
    if (selected.length >= anchorTarget) break;
    const a = c.stat.artist_id !== null && c.stat.artist_id !== undefined
      ? Number(c.stat.artist_id) : null;
    if (a !== null) {
      const cur = artistCount.get(a) || 0;
      if (cur >= MAX_PER_ARTIST) continue;
      artistCount.set(a, cur + 1);
    }
    selected.push(Number(c.song_id));
  }
  return selected;
}

async function fetchDiscoveryCandidates(conn, profile, excludeSet, limit) {
  const topGenres = topNFromMap(profile.genreCounts, 5).map((x) => x.id);
  const topArtists = topNFromMap(profile.artistCounts, 8).map((x) => x.id);
  const topMarkets = topNFromMap(profile.marketCounts, 3).map((x) => String(x.id));

  const parts = [
    `${publicSongCondition('s')}`,
    `s.audio_url IS NOT NULL`,
    `s.audio_url <> ''`,
  ];
  const params = [];

  const orParts = [];
  if (topGenres.length) {
    const ph = topGenres.map(() => '?').join(',');
    orParts.push(`s.genre_id IN (${ph})`);
    params.push(...topGenres);
  }
  if (topArtists.length) {
    const ph = topArtists.map(() => '?').join(',');
    orParts.push(`s.artist_id IN (${ph})`);
    params.push(...topArtists);
  }
  if (topMarkets.length) {
    const ph = topMarkets.map(() => '?').join(',');
    orParts.push(`s.market IN (${ph})`);
    params.push(...topMarkets);
  }
  if (orParts.length === 0) {
    orParts.push('1=1');
  }
  parts.push(`(${orParts.join(' OR ')})`);

  if (excludeSet.size) {
    const arr = [...excludeSet];
    const ph = arr.map(() => '?').join(',');
    parts.push(`s.id NOT IN (${ph})`);
    params.push(...arr);
  }

  const sql = `
    SELECT s.id, s.artist_id, s.genre_id, s.market, s.play_count,
           (CASE
             WHEN s.artist_id IN (${topArtists.length ? topArtists.map(() => '?').join(',') : 'NULL'}) THEN 3
             WHEN s.genre_id IN (${topGenres.length ? topGenres.map(() => '?').join(',') : 'NULL'}) THEN 2
             WHEN s.market IN (${topMarkets.length ? topMarkets.map(() => '?').join(',') : 'NULL'}) THEN 1
             ELSE 0
           END) AS theme_score
    FROM songs s
    WHERE ${parts.join(' AND ')}
    ORDER BY theme_score DESC, s.play_count DESC, s.id DESC
    LIMIT ?
  `;
  const fixed = sql
    .replace('IN (NULL)', 'IN (0)')
    .replace('IN (NULL)', 'IN (0)')
    .replace('IN (NULL)', 'IN (0)');
  const finalParams = [
    ...topArtists, ...topGenres, ...topMarkets,
    ...params,
    limit,
  ];
  const [rows] = await conn.query(fixed, finalParams);
  return rows;
}

async function fetchPopularCandidates(conn, excludeSet, limit) {
  const parts = [
    `${publicSongCondition('s')}`,
    `s.audio_url IS NOT NULL`,
    `s.audio_url <> ''`,
  ];
  const params = [];
  if (excludeSet.size) {
    const arr = [...excludeSet];
    const ph = arr.map(() => '?').join(',');
    parts.push(`s.id NOT IN (${ph})`);
    params.push(...arr);
  }
  const sql = `
    SELECT s.id, s.artist_id, s.genre_id, s.market, s.play_count, 0 AS theme_score
    FROM songs s
    WHERE ${parts.join(' AND ')}
    ORDER BY s.play_count DESC, s.id DESC
    LIMIT ?
  `;
  const [rows] = await conn.query(sql, [...params, limit]);
  return rows;
}

function buildDiscoveryFromRecommendations(recItems) {
  // recItems đã là array of { id, ... } từ recommendation.service
  return recItems.map((r) => ({
    id: Number(r.id),
    artist_id: r.artist_id !== undefined ? r.artist_id : null,
    genre_id: r.genre_id !== undefined ? r.genre_id : null,
    market: r.market || null,
    play_count: r.play_count || 0,
    theme_score: 0,
  }));
}

function interleaveAnchorDiscovery(anchorIds, discoveryIds) {
  const out = [];
  const a = [...anchorIds];
  const d = [...discoveryIds];
  let ai = 0;
  let di = 0;
  while (ai < a.length || di < d.length) {
    if (ai < a.length) {
      out.push(a[ai]);
      ai += 1;
    }
    for (let i = 0; i < 3 && di < d.length; i += 1) {
      out.push(d[di]);
      di += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core API: generateDailyMixForDate
// ---------------------------------------------------------------------------

async function generateDailyMixForDate(userId, date, options = {}) {
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error('userId must be a positive integer');
  }
  const uid = Number(userId);
  const perMix = clampPerMix(options.perMix);
  const dryRun = Boolean(options.dryRun);

  const dateObj = parseDateInput(date);
  const systemKey = options.systemKey || options.system_key || weekdayToSystemKey(dateObj);
  if (!systemKey) {
    throw new Error(`Cannot map date to system_key (weekday=${dateObj.getDay()})`);
  }
  const { start, end, isWeekend } = computeTargetRange(dateObj);

  const conn = await pool.getConnection();
  try {
    // 0) Initialize overlap tracking variables
    const existingPlaylist = await findExistingPlaylist(conn, uid, systemKey);
    const oldSongIds = existingPlaylist
      ? await getPlaylistSongIds(conn, existingPlaylist.id)
      : [];
    const otherDailyMixSongs = await getSongsInOtherDailyMixes(conn, systemKey);
    const recentSystemSongs = await getRecentSystemPlaylistSongs(conn, systemKey);

    // Calculate cross-overlap BEFORE regenerate
    const crossOverlapBefore = calculateCrossOverlapRatio(oldSongIds, otherDailyMixSongs);

    // 1) Fetch listening rows using DAYOFWEEK-based tiered approach
    const tieredResult = await fetchListeningRowsByDayOfWeek(conn, uid, systemKey, options);
    let rows = tieredResult.rows;
    const tierUsed = tieredResult.tierUsed;
    const tierResults = tieredResult.tierResults;
    let fallbackUsed = false;
    let fallbackReason = null;

    if (rows.length === 0) {
      fallbackUsed = true;
      fallbackReason = 'No listening data for this weekday in 8 weeks';
    }

    // 2) Build daily profile
    const profile = buildDailyProfile(rows);
    const targetRangeSongIds = new Set(rows.map(r => Number(r.song_id)));
    const likedSet = await fetchLikedSongIdsInRange(conn, uid, start, end);

    // 3) Chọn anchor
    const anchorRatio = rows.length < FALLBACK_LISTENED_COUNT_FOR_ANCHOR
      ? ANCHOR_RATIO_FALLBACK
      : ANCHOR_RATIO;
    const anchorTarget = Math.max(2, Math.round(perMix * anchorRatio));
    const anchorIdsUnfiltered = selectAnchorSongs(profile, likedSet, anchorTarget * 3);
    const anchorIds = selectSongsWithOverlapCheck(anchorIdsUnfiltered, oldSongIds, anchorTarget, 0.7);
    const anchorSet = new Set(anchorIds);
    const discoveryTarget = perMix - anchorIds.length;

    // 4) Lấy discovery candidates
    let recStrategy = 'popular_fallback';
    let recReason = 'ok';
    let recCount = 0;
    let usedRecService = false;
    let discoveryCandidates = [];
    try {
      const rec = await recommendationService.getRecommendationsForUser(uid, {
        limit: RECOMMEND_PULL,
        context: 'daily_mix',
        listeningWindow: normalizeAnalysisWindow(options) || undefined
      });
      recStrategy = rec.strategy;
      recReason = rec.reason;
      recCount = (rec.items || []).length;
      discoveryCandidates = buildDiscoveryFromRecommendations(rec.items || []);
      usedRecService = true;
    } catch (err) {
      console.warn(`[dailyMix] recommendation.service failed for user ${uid}: ${err.message}`);
    }

    const dbDiscovery = await fetchDiscoveryCandidates(
      conn, profile,
      new Set([...anchorSet, ...targetRangeSongIds, ...otherDailyMixSongs]),
      discoveryTarget * 4,
    );

    // Merge candidates (dedup)
    const seenCand = new Set();
    const mergedCandidates = [];
    for (const c of discoveryCandidates) {
      if (seenCand.has(c.id)) continue;
      seenCand.add(c.id);
      mergedCandidates.push(c);
    }
    for (const c of dbDiscovery) {
      if (seenCand.has(Number(c.id))) continue;
      seenCand.add(Number(c.id));
      mergedCandidates.push({
        id: Number(c.id),
        artist_id: c.artist_id,
        genre_id: c.genre_id || null,
        play_count: c.play_count || 0,
        theme_score: c.theme_score || 0,
      });
    }

    // 5) Build large discovery pool with popular fallback (tier 4)
    let largeDiscoveryPool = [];
    const _aSet = new Set(anchorIds);
    for (const c of mergedCandidates) {
      if (!_aSet.has(Number(c.id))) largeDiscoveryPool.push(c);
    }
    tierResults.tier3 = largeDiscoveryPool.length;

    const pop = await fetchPopularCandidates(
      conn,
      new Set([...anchorIds, ...largeDiscoveryPool.map(c => c.id)]),
      Math.max(discoveryTarget * 20, perMix * 15)
    );
    const popularItems = pop.map(p => ({
      id: Number(p.id), artist_id: p.artist_id, genre_id: p.genre_id || null, market: p.market || null,
      play_count: p.play_count || 0, theme_score: 0,
    }));
    tierResults.tier4 = popularItems.length;
    largeDiscoveryPool = [...largeDiscoveryPool, ...popularItems];

    // 6) Apply cross-playlist penalty scoring (score normalized to ~0..4 range)
    const maxPlayCount = Math.max(1, ...largeDiscoveryPool.map(c => c.play_count || 0));
    const oldIdSet = new Set(oldSongIds.map(Number));
    const candidateObjs = largeDiscoveryPool.map(c => {
      const normalizedPlay = (c.play_count || 0) / maxPlayCount;
      let score = (c.theme_score || 0) + normalizedPlay;

      // Mạnh tay penalty nếu bài đã nằm trong Daily Mix khác
      if (otherDailyMixSongs.has(c.id)) {
        score -= 0.6;
        score *= 0.35;
      }
      
      if (recentSystemSongs.has(c.id)) score -= 0.3;
      if (oldIdSet.has(c.id)) score -= 0.4;

      return { id: c.id, artist_id: c.artist_id, genre_id: c.genre_id, score };
    }).sort((a, b) => b.score - a.score);

    // Track candidates cho metrics
    let freshCandidateCount = 0;
    let oldCandidateCount = 0;
    let otherDailyCandidateCount = 0;
    for (const c of candidateObjs) {
      if (otherDailyMixSongs.has(c.id)) otherDailyCandidateCount++;
      else if (oldIdSet.has(c.id)) oldCandidateCount++;
      else freshCandidateCount++;
    }

    // 7) Select discovery with diversity quotas (Phase A & Phase B)
    const maxArtistCount = Math.floor(perMix * DAILYMIX_LIMITS.maxSameArtistRatio);
    const maxGenreCount = Math.floor(perMix * DAILYMIX_LIMITS.maxSameGenreRatio);
    const artistCount = new Map();
    const genreCount = new Map();
    const selectedDiscoverySet = new Set();
    
    // Base quota từ anchor
    for (const sid of anchorIds) {
      const stat = profile.songStats.get(sid);
      if (stat && stat.artist_id != null) {
        artistCount.set(Number(stat.artist_id), (artistCount.get(Number(stat.artist_id)) || 0) + 1);
      }
      if (stat && stat.genre_id != null) {
        genreCount.set(Number(stat.genre_id), (genreCount.get(Number(stat.genre_id)) || 0) + 1);
      }
    }

    const discoveryIds = [];
    
    const freshCandidates = candidateObjs.filter(c => !oldIdSet.has(c.id) && !otherDailyMixSongs.has(c.id));
    let freshAdded = 0;
    // Bắt buộc lấy ít nhất một phần tư đến một nửa là bài hoàn toàn mới
    const maxFreshInPhaseA = Math.ceil(discoveryTarget * 0.7);

    function tryAddCandidate(c) {
      const songId = Number(c.id);
      if (anchorSet.has(songId) || selectedDiscoverySet.has(songId)) return false;
      const a = c.artist_id != null ? Number(c.artist_id) : null;
      if (a !== null && (artistCount.get(a) || 0) >= maxArtistCount) return false;
      const g = c.genre_id != null ? Number(c.genre_id) : null;
      if (g !== null && (genreCount.get(g) || 0) >= maxGenreCount) return false;
      
      if (a !== null) artistCount.set(a, (artistCount.get(a) || 0) + 1);
      if (g !== null) genreCount.set(g, (genreCount.get(g) || 0) + 1);
      
      selectedDiscoverySet.add(songId);
      discoveryIds.push(songId);
      return true;
    }

    function pickBestCandidate(pool) {
      let best = null;
      let bestScore = -Infinity;
      for (const c of pool) {
        const songId = Number(c.id);
        if (anchorSet.has(songId) || selectedDiscoverySet.has(songId)) continue;
        const a = c.artist_id != null ? Number(c.artist_id) : null;
        if (a !== null && (artistCount.get(a) || 0) >= maxArtistCount) continue;
        const g = c.genre_id != null ? Number(c.genre_id) : null;
        if (g !== null && (genreCount.get(g) || 0) >= maxGenreCount) continue;

        const genreCurrentCount = g !== null ? (genreCount.get(g) || 0) : 0;
        let adjustedScore = c.score || 0;
        adjustedScore -= (genreCurrentCount / perMix) * 1.0;
        if (oldIdSet.has(songId)) adjustedScore -= 0.8;
        if (otherDailyMixSongs.has(songId)) adjustedScore -= 1.0;
        if (g !== null && !genreCount.has(g)) adjustedScore += 0.35;

        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          best = c;
        }
      }
      return best;
    }
    
    // Phase A: Ưu tiên chọn bài fresh trước
    while (discoveryIds.length < discoveryTarget && freshAdded < maxFreshInPhaseA) {
      const c = pickBestCandidate(freshCandidates);
      if (!c) break;
      if (tryAddCandidate(c)) {
        freshAdded++;
      } else {
        break;
      }
    }
    
    // Phase B: Bổ sung bằng bài quen thuộc / bài đã nghe để giữ gu
    while (discoveryIds.length < discoveryTarget) {
      const c = pickBestCandidate(candidateObjs);
      if (!c) break;
      if (!tryAddCandidate(c)) break;
    }

    let relaxedDiversityUsed = false;
    if (discoveryIds.length < discoveryTarget && candidateObjs.length < perMix * 3) {
      relaxedDiversityUsed = true;
      const relaxedArtistLimit = maxArtistCount + 1;
      const relaxedGenreLimit = maxGenreCount + 1;
      for (const c of candidateObjs) {
        if (discoveryIds.length >= discoveryTarget) break;
        const songId = Number(c.id);
        if (anchorSet.has(songId) || selectedDiscoverySet.has(songId)) continue;
        const a = c.artist_id != null ? Number(c.artist_id) : null;
        if (a !== null && (artistCount.get(a) || 0) >= relaxedArtistLimit) continue;
        const g = c.genre_id != null ? Number(c.genre_id) : null;
        if (g !== null && (genreCount.get(g) || 0) >= relaxedGenreLimit) continue;
        if (a !== null) artistCount.set(a, (artistCount.get(a) || 0) + 1);
        if (g !== null) genreCount.set(g, (genreCount.get(g) || 0) + 1);
        selectedDiscoverySet.add(songId);
        discoveryIds.push(songId);
      }
    }

    // 8) Trộn thứ tự + tính chỉ số
    const finalIds = interleaveAnchorDiscovery(anchorIds, discoveryIds);
    const finalSet = new Set(finalIds);
    const duplicateCount = finalIds.length - finalSet.size;
    const listenedFromTargetDateCount = finalIds.filter(id => targetRangeSongIds.has(id)).length;
    const actualAnchorRatio = finalIds.length ? listenedFromTargetDateCount / finalIds.length : 0;
    const tooMuchLikeRecentlyPlayed = actualAnchorRatio > RECENTLY_PLAYED_RATIO_WARN;
    if (tooMuchLikeRecentlyPlayed) {
      console.warn(
        `[dailyMix] WARN user=${uid} systemKey=${systemKey} anchorRatio=${actualAnchorRatio.toFixed(2)} (>${RECENTLY_PLAYED_RATIO_WARN}) - playlist giống Recently Played`,
      );
    }

    // 9) Compute quality metrics
    const config = SYSTEM_PLAYLIST_BY_KEY[systemKey] || { name: `Daily Mix 0${Number(systemKey.slice(-2))}` };
    const name = config.name || systemKey;
    const description = PLAYLIST_DESCRIPTIONS[systemKey] || config.description || '';

    const overlapStats = computeOverlapStats(oldSongIds, finalIds);
    const crossOverlapAfter = calculateCrossOverlapRatio(finalIds, otherDailyMixSongs);
    
    const LIMITS = {
      ...DAILYMIX_LIMITS,
      overlapBad: DAILYMIX_LIMITS.crossPlaylistOverlapBad,
      minCandidateCount: perMix * DAILYMIX_LIMITS.minCandidateCountMultiplier
    };
    
    // Map finalObjs for calculatePlaylistDiversity
    // Since finalIds are just numbers, we need full objects. We map them from anchor/discovery pool
    const poolMap = new Map();
    const allCands = [...rows.map(r => ({ ...r, id: r.song_id })), ...candidateObjs];
    for (const c of allCands) {
      if (!poolMap.has(Number(c.id || c.song_id))) {
        poolMap.set(Number(c.id || c.song_id), c);
      }
    }
    const finalObjsForDiv = finalIds.map(id => poolMap.get(id)).filter(Boolean);
    const finalDiversity = calculatePlaylistDiversity(finalObjsForDiv);
    const candidateGenreCount = new Set(candidateObjs.map(c => c.genre_id).filter(g => g !== null && g !== undefined)).size;
    const finalGenreCount = new Set(finalObjsForDiv.map(c => c.genre_id).filter(g => g !== null && g !== undefined)).size;
    const exactArtistPassed = finalDiversity.maxSameArtistCount <= maxArtistCount;
    const exactGenrePassed = finalDiversity.maxSameGenreCount <= maxGenreCount;
    const finalDiversityPassed = exactArtistPassed && exactGenrePassed;

    const evalResult = evaluateRegenerateQuality(
      { ...overlapStats, candidateCount: largeDiscoveryPool.length, finalDiversity, relaxedDiversityUsed }, perMix, LIMITS
    );

    // Hard gate: Không apply nếu quá giống playlist cũ hoặc quá trùng Daily Mix khác
    const MIN_ADDED_SONGS = 8;
    const MIN_FRESH_CANDIDATES = Math.ceil(perMix * 0.35);
    let crossOverlapGateStatus = 'ok';
    let gateReason = '';
    
    if (finalIds.length < perMix) {
      evalResult.canApply = false;
      gateReason = `finalSongCount < targetSize (${finalIds.length} < ${perMix})`;
    } else if (!finalDiversityPassed) {
      evalResult.canApply = false;
      gateReason = `Final exact diversity quota failed (artist ${finalDiversity.maxSameArtistCount}/${maxArtistCount}, genre ${finalDiversity.maxSameGenreCount}/${maxGenreCount})`;
    } else if (finalDiversity.maxSameGenreRatio >= 0.90) {
      evalResult.canApply = false;
      gateReason = 'maxSameGenreRatio >= 90%';
    } else if (candidateGenreCount >= 2 && finalGenreCount < 2) {
      evalResult.canApply = false;
      gateReason = `finalGenreCount < 2 while candidateGenreCount=${candidateGenreCount}`;
    } else if (candidateGenreCount >= 3 && finalGenreCount < 3) {
      gateReason = `finalGenreCount < 3 while candidateGenreCount=${candidateGenreCount}`;
      evalResult.status = 'warning';
      evalResult.message = (evalResult.message || '') + `; ${gateReason}`;
    } else if (overlapStats.overlapRatio >= 0.9) {
      evalResult.canApply = false;
      gateReason = 'overlapRatio >= 90%';
    } else if (crossOverlapAfter > LIMITS.overlapBad) {
      evalResult.canApply = false;
      gateReason = `crossPlaylistOverlapRatioAfter >= ${LIMITS.overlapBad*100}%`;
    } else if (freshCandidateCount < MIN_FRESH_CANDIDATES) {
      gateReason = `freshCandidateCount < ${MIN_FRESH_CANDIDATES}`;
      evalResult.status = 'warning';
      evalResult.message = (evalResult.message || '') + `; ${gateReason}`;
    } else if (overlapStats.addedSongs < MIN_ADDED_SONGS) {
      if (freshCandidateCount > 50) {
        evalResult.canApply = false;
        gateReason = `addedSongs < ${MIN_ADDED_SONGS} despite large fresh pool`;
      }
    }

    if (!evalResult.canApply) {
      evalResult.status = 'skipped';
      evalResult.message = `Playlist too similar or lacking fresh content: ${gateReason} ` + (evalResult.message || '');
      crossOverlapGateStatus = 'blocked';
    } else if (crossOverlapAfter > DAILYMIX_LIMITS.crossPlaylistOverlapWarning) {
      crossOverlapGateStatus = 'warning';
      evalResult.status = evalResult.status === 'success' ? 'warning' : evalResult.status;
      evalResult.message = (evalResult.message || '') + `; crossDailyOverlapRatio > ${Math.round(DAILYMIX_LIMITS.crossPlaylistOverlapWarning * 100)}% (${Math.round(crossOverlapAfter * 100)}%)`;
    }

    const summary = {
      userId: uid,
      systemKey,
      targetDate: fmtDate(dateObj),
      weekday: `${weekdayLabel(dateObj)} (${weekdayFull(dateObj)})`,
      targetRangeStart: fmtDate(start),
      targetRangeEnd: fmtDate(end),
      isWeekendRange: isWeekend,
      tierUsed,
      tierResults,
      fallbackUsed,
      fallbackReason,
      strategy: recStrategy,
      reason: recReason,
      historyCount: rows.length,
      profileCount: rows.length,
      distinctListenedSongCount: profile.distinctSongIds.size,
      distinctTargetRangeSongCount: targetRangeSongIds.size,
      perMix,
      anchorTarget,
      anchorSelected: anchorIds.length,
      discoveryTarget,
      discoverySelected: discoveryIds.length,
      candidateCount: largeDiscoveryPool.length,
      freshCandidateCount,
      oldCandidateCount,
      otherDailyCandidateCount,
      ...overlapStats,
      addedSongs: overlapStats.addedSongs,
      removedSongs: overlapStats.removedSongs,
      crossPlaylistOverlapRatioBefore: Number(crossOverlapBefore.toFixed(2)),
      crossPlaylistOverlapRatioAfter: Number(crossOverlapAfter.toFixed(2)),
      crossOverlapGateStatus,
      actualMaxSameArtistRatio: finalDiversity.maxSameArtistRatio,
      actualMaxSameGenreRatio: finalDiversity.maxSameGenreRatio,
      actualMaxSameArtistCount: finalDiversity.maxSameArtistCount,
      actualMaxSameGenreCount: finalDiversity.maxSameGenreCount,
      maxArtistSongs: maxArtistCount,
      maxGenreSongs: maxGenreCount,
      finalDiversityPassed,
      candidateGenreCount,
      finalGenreCount,
      maxSameArtistLimit: LIMITS.maxSameArtistRatio,
      maxSameGenreLimit: LIMITS.maxSameGenreRatio,
      relaxedDiversityUsed,
      sampleSkipReasons: evalResult.sampleSkipReasons || [],
      canApply: evalResult.canApply,
      status: evalResult.status,
      message: evalResult.message,
      finalSongCount: finalIds.length,
      duplicateCount,
      listenedFromTargetDateCount,
      anchorRatio: Number(actualAnchorRatio.toFixed(2)),
      recentlyPlayedWarning: tooMuchLikeRecentlyPlayed,
      topGenres: topNFromMap(profile.genreCounts, 5).map(x => x.id),
      topArtists: topNFromMap(profile.artistCounts, 5).map(x => x.id),
      topMarkets: topNFromMap(profile.marketCounts, 5).map(x => String(x.id)),
      topSongIds: finalIds.slice(0, 10),
      recItemsCount: recCount,
      usedRecService,
      playlistId: existingPlaylist ? existingPlaylist.id : null,
      created: !existingPlaylist,
      insertedSongs: 0,
      dryRun,
    };

    if (!dryRun && (evalResult.canApply || options.forceApply === true)) {
      await conn.beginTransaction();
      try {
        const { playlistId, created } = await ensurePlaylist(conn, uid, systemKey, name, description);
        const nextRefresh = getNextRefreshDateForDailyMix(systemKey);
        const inserted = await replacePlaylistSongs(conn, playlistId, finalIds, nextRefresh);
        await conn.commit();
        summary.playlistId = playlistId;
        summary.created = created;
        summary.insertedSongs = inserted;
        summary.forceApplied = options.forceApply === true && !evalResult.canApply;
        if (summary.forceApplied && inserted > 0) {
          summary.status = 'warning';
          summary.canApply = true;
        }
      } catch (err) {
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        throw err;
      }
    }
    return summary;
  } finally {
    conn.release();
  }
}

function parseDateInput(date) {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error(`Invalid date string: ${date} (expected YYYY-MM-DD)`);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  throw new Error('date must be a Date or YYYY-MM-DD string');
}

// ---------------------------------------------------------------------------
// Backward-compat wrappers
// ---------------------------------------------------------------------------

async function generateDailyMixesForUser(userId, options = {}) {
  const perMix = clampPerMix(options.perMix);
  const dryRun = Boolean(options.dryRun);
  const today = new Date();
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dayOfWeek = today0.getDay();
  const offsetToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(
    today0.getFullYear(),
    today0.getMonth(),
    today0.getDate() - offsetToThisMonday - 7,
  );
  const dates = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + i);
    dates.push(d);
  }
  dates[5] = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + 6);

  const seen = new Set();
  const results = [];
  for (const d of dates) {
    const sk = weekdayToSystemKey(d);
    if (sk && seen.has(sk)) continue;
    seen.add(sk);
    const r = await generateDailyMixForDate(userId, d, { perMix, dryRun });
    results.push(r);
  }
  return {
    userId,
    perMix,
    dryRun,
    mixes: results,
  };
}

async function generateDailyMixesForAllUsers(options = {}) {
  const perMix = clampPerMix(options.perMix);
  const dryRun = Boolean(options.dryRun);
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE status = 'active' AND role = 'user' ORDER BY id`
  );
  const stats = {
    usersProcessed: 0,
    playlistsCreated: 0,
    playlistsUpdated: 0,
    songsInserted: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };
  for (const row of rows) {
    try {
      const r = await generateDailyMixesForUser(row.id, { perMix, dryRun });
      stats.usersProcessed += 1;
      if (!dryRun) {
        for (const m of r.mixes) {
          if (m.created) stats.playlistsCreated += 1;
          else stats.playlistsUpdated += 1;
          stats.songsInserted += m.insertedSongs || 0;
        }
      }
      stats.details.push({ userId: row.id, ok: true });
    } catch (err) {
      stats.errors += 1;
      stats.skipped += 1;
      stats.details.push({ userId: row.id, ok: false, error: err.message });
    }
  }
  return stats;
}

async function generateDailyMixByKeyForAllUsers(systemKey, options = {}) {
  if (!SYSTEM_KEYS.includes(systemKey)) throw new Error('Invalid daily mix key');

  const perMix = clampPerMix(options.perMix);
  const dryRun = Boolean(options.dryRun);
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE status = 'active' AND role = 'user' ORDER BY id`
  );
  const stats = {
    usersProcessed: 0,
    playlistsCreated: 0,
    playlistsUpdated: 0,
    songsInserted: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  let targetDate;
  if (options.scheduledFor) {
    const scheduledFor = new Date(options.scheduledFor);
    targetDate = new Date(scheduledFor.getFullYear(), scheduledFor.getMonth(), scheduledFor.getDate() - 1);
  } else {
    const today = new Date();
    const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOfWeek = today0.getDay();
    const offsetToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - offsetToThisMonday);
    
    if (systemKey === 'dailymix_01') targetDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate());
    else if (systemKey === 'dailymix_02') targetDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 1);
    else if (systemKey === 'dailymix_03') targetDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 2);
    else if (systemKey === 'dailymix_04') targetDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 3);
    else if (systemKey === 'dailymix_05') targetDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 4);
    else if (systemKey === 'dailymix_06') targetDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 1);
  }
  if (!targetDate) throw new Error('Invalid daily mix key');

  let totalCandidateCount = 0;
  let totalFreshCandidateCount = 0;
  let totalOldCandidateCount = 0;
  let totalOtherDailyCandidateCount = 0;
  let totalOverlapRatio = 0;
  let totalAddedSongs = 0;
  let totalRemovedSongs = 0;
  let totalCrossBefore = 0;
  let totalCrossAfter = 0;
  let totalArtistRatio = 0;
  let totalGenreRatio = 0;
  let worstArtistRatio = 0;
  let worstGenreRatio = 0;
  let failedDiversityPlaylists = 0;
  let allCanApply = true;
  let canApplyRuns = 0;
  let lastStatus = 'success';
  let successRuns = 0;

  for (const row of rows) {
    try {
      const m = await generateDailyMixForDate(row.id, targetDate, {
        perMix,
        dryRun,
        systemKey,
        scheduledFor: options.scheduledFor || null,
        analysisWindow: options.analysisWindow || null
      });
      stats.usersProcessed += 1;
      if (!dryRun) {
        if (m.created) stats.playlistsCreated += 1;
        else stats.playlistsUpdated += 1;
        stats.songsInserted += m.insertedSongs || 0;
      }
      
      if (m.candidateCount !== undefined) {
        totalCandidateCount += m.candidateCount;
        totalFreshCandidateCount += (m.freshCandidateCount || 0);
        totalOldCandidateCount += (m.oldCandidateCount || 0);
        totalOtherDailyCandidateCount += (m.otherDailyCandidateCount || 0);
        totalOverlapRatio += (m.overlapRatio !== undefined ? m.overlapRatio : 0);
        totalAddedSongs += (m.addedSongs !== undefined ? m.addedSongs : 0);
        totalRemovedSongs += (m.removedSongs !== undefined ? m.removedSongs : 0);
        totalCrossBefore += (m.crossPlaylistOverlapRatioBefore || 0);
        totalCrossAfter += (m.crossPlaylistOverlapRatioAfter || 0);
        totalArtistRatio += (m.actualMaxSameArtistRatio || 0);
        totalGenreRatio += (m.actualMaxSameGenreRatio || 0);
        worstArtistRatio = Math.max(worstArtistRatio, m.actualMaxSameArtistRatio || 0);
        worstGenreRatio = Math.max(worstGenreRatio, m.actualMaxSameGenreRatio || 0);
        if (!m.finalDiversityPassed) failedDiversityPlaylists++;
        if (m.canApply) canApplyRuns++;
        else allCanApply = false;
        lastStatus = m.status;
        successRuns += 1;
      }
      
      stats.details.push({ userId: row.id, ok: true });
    } catch (err) {
      stats.errors += 1;
      stats.skipped += 1;
      stats.details.push({ userId: row.id, ok: false, error: err.message });
    }
  }
  
  if (successRuns > 0) {
    stats.candidateCount = Math.round(totalCandidateCount / successRuns);
    stats.freshCandidateCount = Math.round(totalFreshCandidateCount / successRuns);
    stats.oldCandidateCount = Math.round(totalOldCandidateCount / successRuns);
    stats.otherDailyCandidateCount = Math.round(totalOtherDailyCandidateCount / successRuns);
    stats.overlapRatio = totalOverlapRatio / successRuns;
    stats.addedSongs = Math.round(totalAddedSongs / successRuns);
    stats.removedSongs = Math.round(totalRemovedSongs / successRuns);
    stats.crossPlaylistOverlapRatioBefore = Number((totalCrossBefore / successRuns).toFixed(2));
    stats.crossPlaylistOverlapRatioAfter = Number((totalCrossAfter / successRuns).toFixed(2));
    stats.actualMaxSameArtistRatio = Number((totalArtistRatio / successRuns).toFixed(2));
    stats.actualMaxSameGenreRatio = Number((totalGenreRatio / successRuns).toFixed(2));
    stats.worstMaxSameArtistRatio = Number(worstArtistRatio.toFixed(2));
    stats.worstMaxSameGenreRatio = Number(worstGenreRatio.toFixed(2));
    stats.failedDiversityPlaylists = failedDiversityPlaylists;
    stats.finalDiversityPassed = failedDiversityPlaylists === 0;
    stats.successRate = Number((canApplyRuns / successRuns).toFixed(3));
    stats.canApply = stats.finalDiversityPassed && stats.successRate >= 0.85;
    stats.status = lastStatus;
    if (!allCanApply && stats.canApply) {
      stats.status = 'warning';
    }
  }

  return stats;
}

module.exports = {
  SYSTEM_KEYS,
  PLAYLIST_DESCRIPTIONS,
  DEFAULT_PER_MIX,
  MAX_PER_MIX,
  MIN_PER_MIX,
  WEEKDAY_LABELS_VI,
  WEEKDAY_LABELS_EN,
  WEEKDAY_LABELS_VI_FULL,
  weekdayToSystemKey,
  weekdayLabel,
  weekdayFull,
  computeTargetRange,
  fmtDate,
  parseDateInput,
  generateDailyMixForDate,
  generateDailyMixesForUser,
  generateDailyMixesForAllUsers,
  generateDailyMixByKeyForAllUsers,
};
