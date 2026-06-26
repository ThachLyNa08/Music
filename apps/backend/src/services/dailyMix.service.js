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

/**
 * Trả về system_key tương ứng với ngày ICT truyền vào.
 * Saturday hoặc Sunday đều map dailymix_06 (weekend mix).
 */
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

/**
 * Tính range [start, end) trong ICT (tính theo day-of-month) cho target date.
 * - dateObj: Date object ở ICT (vd new Date('2026-06-17') cho Wed 17/06 ICT).
 * - includeWeekend: nếu true và dateObj là Sat hoặc Sun, range = cả Sat+Sun.
 */
function computeTargetRange(dateObj) {
  const wd = dateObj.getDay();
  let start, end;
  if (wd === 0) {
    // Sunday: range = Sat 00:00 -> Mon 00:00
    const sat = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() - 1);
    const mon = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1);
    start = sat;
    end = mon;
  } else if (wd === 6) {
    // Saturday: range = Sat 00:00 -> Mon 00:00
    const mon = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 2);
    start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    end = mon;
  } else {
    // Mon..Fri: range = 1 ngày
    start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    end = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1);
  }
  return { start, end, isWeekend: wd === 0 || wd === 6 };
}

/**
 * Format Date thành 'YYYY-MM-DD' theo local time (ICT).
 */
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Helpers về target range + listened rows
// ---------------------------------------------------------------------------

/**
 * Lấy tất cả listening rows của user trong target range, join với songs để
 * có đầy đủ thông tin genre/artist/market.
 *
 * Trả về:
 *   rows: array of listening rows
 *   totalCount: tổng rows (kể cả bài private)
 *   publicSongCount: số row có song public/audio-ok
 */
async function fetchListeningRowsInRange(conn, userId, start, end) {
  const startStr = fmtDate(start) + ' 00:00:00';
  const endStr = fmtDate(end) + ' 00:00:00';
  const [rows] = await pool.query(
    `SELECT lh.id, lh.song_id, lh.listen_duration, lh.song_duration,
            lh.completion_rate, lh.is_completed, lh.is_skipped, lh.implicit_rating,
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

async function fetchListeningRowsInRangeFallback(conn, userId, targetStart, lookbackDays) {
  // Mở rộng thêm N ngày trước target range (chỉ dùng khi target range rỗng).
  const startStr = fmtDate(targetStart) + ' 00:00:00';
  const endStr = fmtDate(new Date(
    targetStart.getFullYear(),
    targetStart.getMonth(),
    targetStart.getDate() + 1,
  )) + ' 00:00:00';
  const [rows] = await pool.query(
    `SELECT lh.id, lh.song_id, lh.listen_duration, lh.song_duration,
            lh.completion_rate, lh.is_completed, lh.is_skipped, lh.implicit_rating,
            lh.listened_at,
            s.id AS s_id, s.title, s.genre_id, s.artist_id, s.market,
            s.audio_url, s.is_active, s.release_status, s.play_count
     FROM listening_history lh
     JOIN songs s ON s.id = lh.song_id
     WHERE lh.user_id = ?
       AND lh.listened_at >= DATE_SUB(?, INTERVAL ? DAY)
       AND lh.listened_at < ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY lh.listened_at DESC`,
    [userId, startStr, lookbackDays, endStr]
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
    songStats: new Map(), // song_id -> { count, totalCompletion, skipCount, likeCount, implicitSum, lastListenedAt }
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
  // Lấy bài đã like trong target range. joined_at = liked_at (không có trong
  // listening_history). Dùng khoảng [start - 30d, end) để cover lịch sử like
  // vì user thường like sau khi nghe.
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

/**
 * Chọn anchor songs từ các bài đã nghe trong target range.
 * Ưu tiên:
 *   - completion_rate cao
 *   - không skip
 *   - nghe lặp nhiều lần
 *   - đã like
 *   - artist cap (không quá nhiều bài cùng artist)
 */
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

/**
 * Lấy discovery candidates dựa trên profile. Trả về Map<song_id, score>.
 * Ưu tiên:
 *   - cùng top genre
 *   - cùng top artist
 *   - cùng top market
 *   - play_count cao (popularity nhẹ)
 */
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
    SELECT s.id, s.artist_id, s.play_count,
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
  // MySQL không cho phép placeholder rỗng; thay NULL thành CAST(NULL AS UNSIGNED) hoặc ép kiểu
  // để SQL chạy được. Đơn giản: nếu mảng rỗng, thay bằng `0` để tránh lỗi.
  const fixed = sql
    .replace('IN (NULL)', 'IN (0)')
    .replace('IN (NULL)', 'IN (0)')
    .replace('IN (NULL)', 'IN (0)');
  const finalParams = [
    ...topArtists, ...topGenres, ...topMarkets,
    ...params,
    limit,
  ];
  const [rows] = await pool.query(fixed, finalParams);
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
    SELECT s.id, s.artist_id, s.play_count, 0 AS theme_score
    FROM songs s
    WHERE ${parts.join(' AND ')}
    ORDER BY s.play_count DESC, s.id DESC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [...params, limit]);
  return rows;
}

function buildDiscoveryFromRecommendations(recItems) {
  // recItems đã là array of { id, ... } từ recommendation.service
  return recItems.map((r) => ({
    id: Number(r.id),
    artist_id: r.artist_id !== undefined ? r.artist_id : null,
    play_count: r.play_count || 0,
    theme_score: 0,
  }));
}

// selectDiscoverySongs đã được inline lại trong generateDailyMixForDate
// (có 2 phase: tránh listened trong target range, sau đó soft anchor).

/**
 * Trộn thứ tự anchor + discovery. Không để toàn bộ anchor ở đầu, mà xen kẽ
 * nhẹ: cứ mỗi discovery thì có anchor, nhưng vẫn giữ tỉ lệ.
 */
function interleaveAnchorDiscovery(anchorIds, discoveryIds) {
  const out = [];
  const a = [...anchorIds];
  const d = [...discoveryIds];
  let ai = 0;
  let di = 0;
  // Tỉ lệ anchor/total ~ 30%; xen kẽ 1 anchor mỗi ~3 discovery
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

/**
 * Tạo/cập nhật 1 Daily Mix playlist cho user, dựa trên hành vi nghe nhạc
 * trong target date (hoặc cả weekend nếu là Sat/Sun).
 *
 * @param {number} userId
 * @param {Date|string} date  - Date object (ICT) hoặc string 'YYYY-MM-DD'
 * @param {object} options
 *   - perMix: 20-25 bài (default 25, max 30)
 *   - dryRun: bool
 *
 * @returns summary object
 */
async function generateDailyMixForDate(userId, date, options = {}) {
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error('userId must be a positive integer');
  }
  const uid = Number(userId);
  const perMix = clampPerMix(options.perMix);
  const dryRun = Boolean(options.dryRun);

  const dateObj = parseDateInput(date);
  const systemKey = weekdayToSystemKey(dateObj);
  if (!systemKey) {
    throw new Error(`Cannot map date to system_key (weekday=${dateObj.getDay()})`);
  }
  const { start, end, isWeekend } = computeTargetRange(dateObj);

  const conn = await pool.getConnection();
  try {
  // 1) Lấy listening rows trong target range (chỉ range gốc, dùng để đếm
  //    listenedFromTargetDateCount). Sau đó nếu rỗng thì mở rộng để build
  //    profile (anchor + discovery).
  const targetRows = await fetchListeningRowsInRange(conn, uid, start, end);
  let rows = targetRows;
  let usedFallbackHistory = false;
  if (rows.length === 0) {
    const expanded = await fetchListeningRowsInRangeFallback(
      conn, uid, start, HISTORY_LOOKBACK_DAYS,
    );
    if (expanded.length > 0) {
      rows = expanded;
      usedFallbackHistory = true;
    }
  }

  // 2) Build daily profile từ rows (range mở rộng nếu target rỗng)
  const profile = buildDailyProfile(rows);
  // Track set các bài đã nghe trong TARGET range gốc (không mở rộng) để
  // tính listenedFromTargetDateCount chính xác.
  const targetRangeSongIds = new Set();
  for (const r of targetRows) targetRangeSongIds.add(Number(r.song_id));
  const likedSet = await fetchLikedSongIdsInRange(conn, uid, start, end);

    // 3) Chọn anchor
    const anchorRatio = rows.length < FALLBACK_LISTENED_COUNT_FOR_ANCHOR
      ? ANCHOR_RATIO_FALLBACK
      : ANCHOR_RATIO;
    const anchorTarget = Math.max(2, Math.round(perMix * anchorRatio));
    const anchorIds = selectAnchorSongs(profile, likedSet, anchorTarget);
    const anchorSet = new Set(anchorIds);
    const discoveryTarget = perMix - anchorIds.length;

    // 4) Lấy discovery candidates
    let recStrategy = 'popular_fallback';
    let recReason = 'ok';
    let recCount = 0;
    let usedRecService = false;
    let discoveryCandidates = [];
    try {
      // Dùng recommendation.service cho gợi ý (BPR-MF hoặc fallback).
      const rec = await recommendationService.getRecommendationsForUser(uid, {
        limit: RECOMMEND_PULL,
      });
      recStrategy = rec.strategy;
      recReason = rec.reason;
      recCount = (rec.items || []).length;
      discoveryCandidates = buildDiscoveryFromRecommendations(rec.items || []);
      usedRecService = true;
    } catch (err) {
      console.warn(`[dailyMix] recommendation.service failed for user ${uid}: ${err.message}`);
    }

    // Bổ sung thêm từ DB pool theo profile. Loại trừ luôn các bài đã nghe
    // trong target range để discovery không bị lẫn vào Recently Played.
    const dbDiscovery = await fetchDiscoveryCandidates(
      conn,
      profile,
      new Set([...anchorSet, ...targetRangeSongIds]),
      discoveryTarget * 4,
    );
    // Gộp candidates (rec items trước, db sau, dedup theo id)
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
        play_count: c.play_count || 0,
        theme_score: c.theme_score || 0,
      });
    }

    // 5) Chọn discovery với artist cap dùng chung với anchor
    const artistCount = new Map();
    for (const sid of anchorIds) {
      const stat = profile.songStats.get(sid);
      if (stat && stat.artist_id !== null && stat.artist_id !== undefined) {
        const a = Number(stat.artist_id);
        artistCount.set(a, (artistCount.get(a) || 0) + 1);
      }
    }
    // Discovery phase 1: loại trừ listened trong target range (tránh lẫn
    // Recently Played). Phase 2: nếu thiếu thì cho phép lấy thêm từ listened
    // trong target range (giữ cảm giác quen thuộc, không vượt quá 1/3
    // discovery target).
    const discoveryIds = [];
    const softAnchorCap = Math.ceil(discoveryTarget / 3);
    let softAnchorUsed = 0;

    // Phase 1: discovery "tinh khiết" (chưa nghe target range)
    for (const c of mergedCandidates) {
      if (discoveryIds.length >= discoveryTarget) break;
      const id = Number(c.id);
      if (anchorSet.has(id)) continue;
      if (targetRangeSongIds.has(id)) continue; // skip
      const a = c.artist_id !== null && c.artist_id !== undefined ? Number(c.artist_id) : null;
      if (a !== null) {
        const cur = artistCount.get(a) || 0;
        if (cur >= ARTIST_CAP_HARD) continue;
        artistCount.set(a, cur + 1);
      }
      discoveryIds.push(id);
    }
    // Phase 2: nếu thiếu discovery target, lấy từ listened trong target range
    // (vẫn theo theme, giới hạn softAnchorCap)
    if (discoveryIds.length < discoveryTarget) {
      for (const c of mergedCandidates) {
        if (discoveryIds.length >= discoveryTarget) break;
        if (softAnchorUsed >= softAnchorCap) break;
        const id = Number(c.id);
        if (anchorSet.has(id)) continue;
        if (!targetRangeSongIds.has(id)) continue;
        if (discoveryIds.includes(id)) continue;
        const a = c.artist_id !== null && c.artist_id !== undefined ? Number(c.artist_id) : null;
        if (a !== null) {
          const cur = artistCount.get(a) || 0;
          if (cur >= ARTIST_CAP_HARD) continue;
          artistCount.set(a, cur + 1);
        }
        discoveryIds.push(id);
        softAnchorUsed += 1;
      }
    }

    // 6) Nếu discovery vẫn thiếu -> bổ sung từ popular pool
    let popularAdded = 0;
    if (discoveryIds.length < discoveryTarget) {
      const used = new Set([...anchorIds, ...discoveryIds]);
      const popular = await fetchPopularCandidates(conn, used, (discoveryTarget - discoveryIds.length) * 3);
      for (const p of popular) {
        if (discoveryIds.length >= discoveryTarget) break;
        const id = Number(p.id);
        if (used.has(id)) continue;
        const a = p.artist_id !== null && p.artist_id !== undefined ? Number(p.artist_id) : null;
        if (a !== null) {
          const cur = artistCount.get(a) || 0;
          if (cur >= ARTIST_CAP_HARD) continue;
          artistCount.set(a, cur + 1);
        }
        discoveryIds.push(id);
        used.add(id);
        popularAdded += 1;
      }
    }

    // 7) Trộn thứ tự + tính chỉ số
    const finalIds = interleaveAnchorDiscovery(anchorIds, discoveryIds);
    const finalSet = new Set(finalIds);
    const duplicateCount = finalIds.length - finalSet.size;
    const listenedFromTargetDateCount = finalIds.filter((id) =>
      targetRangeSongIds.has(id),
    ).length;
    const actualAnchorRatio = finalIds.length
      ? listenedFromTargetDateCount / finalIds.length
      : 0;
    const tooMuchLikeRecentlyPlayed = actualAnchorRatio > RECENTLY_PLAYED_RATIO_WARN;
    if (tooMuchLikeRecentlyPlayed) {
      console.warn(
        `[dailyMix] WARN user=${uid} systemKey=${systemKey} anchorRatio=${actualAnchorRatio.toFixed(2)} (>${RECENTLY_PLAYED_RATIO_WARN}) - playlist giống Recently Played`,
      );
    }

    const config = SYSTEM_PLAYLIST_BY_KEY[systemKey] || { name: `Daily Mix 0${Number(systemKey.slice(-2))}` };
    const name = config.name || systemKey;
    const description = PLAYLIST_DESCRIPTIONS[systemKey] || config.description || '';

    const summary = {
      userId: uid,
      systemKey,
      targetDate: fmtDate(dateObj),
      weekday: `${weekdayLabel(dateObj)} (${weekdayFull(dateObj)})`,
      targetRangeStart: fmtDate(start),
      targetRangeEnd: fmtDate(end),
      isWeekendRange: isWeekend,
      usedFallbackHistory,
      strategy: recStrategy,
      reason: recReason,
      // historyCount = số rows trong TARGET range gốc (không mở rộng)
      historyCount: targetRows.length,
      // profileCount = số rows dùng để build profile (range mở rộng nếu target rỗng)
      profileCount: rows.length,
      distinctListenedSongCount: profile.distinctSongIds.size,
      distinctTargetRangeSongCount: targetRangeSongIds.size,
      perMix,
      anchorTarget,
      anchorSelected: anchorIds.length,
      discoveryTarget,
      discoverySelected: discoveryIds.length,
      popularAdded,
      finalSongCount: finalIds.length,
      duplicateCount,
      listenedFromTargetDateCount,
      anchorRatio: Number(actualAnchorRatio.toFixed(2)),
      recentlyPlayedWarning: tooMuchLikeRecentlyPlayed,
      topGenres: topNFromMap(profile.genreCounts, 5).map((x) => x.id),
      topArtists: topNFromMap(profile.artistCounts, 5).map((x) => x.id),
      topMarkets: topNFromMap(profile.marketCounts, 5).map((x) => String(x.id)),
      topSongIds: finalIds.slice(0, 10),
      recItemsCount: recCount,
      usedRecService,
      playlistId: null,
      created: false,
      insertedSongs: 0,
      dryRun,
    };

    if (!dryRun) {
      await conn.beginTransaction();
      try {
        const { playlistId, created } = await ensurePlaylist(conn, uid, systemKey, name, description);
        const nextRefresh = getNextRefreshDateForDailyMix(systemKey);
        const inserted = await replacePlaylistSongs(conn, playlistId, finalIds, nextRefresh);
        await conn.commit();
        summary.playlistId = playlistId;
        summary.created = created;
        summary.insertedSongs = inserted;
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
    // Trả về bản sao chỉ giữ yyyy-mm-dd (bỏ phần time).
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  if (typeof date === 'string') {
    // 'YYYY-MM-DD' -> parse local (ICT) midnight
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error(`Invalid date string: ${date} (expected YYYY-MM-DD)`);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  throw new Error('date must be a Date or YYYY-MM-DD string');
}

// ---------------------------------------------------------------------------
// Backward-compat wrappers (giữ API cũ để không vỡ chỗ khác)
// ---------------------------------------------------------------------------

async function generateDailyMixesForUser(userId, options = {}) {
  // Backward-compat: cập nhật 6 Daily Mix theo 6 ngày gần nhất (Mon..Sun của
  // tuần vừa kết thúc). Daily Mix 06 (weekend) chỉ chạy 1 lần với target =
  // Sun, range sẽ tự mở rộng thành Sat+Sun.
  const perMix = clampPerMix(options.perMix);
  const dryRun = Boolean(options.dryRun);
  const today = new Date();
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dayOfWeek = today0.getDay(); // 0=Sun, 1=Mon, ...
  const offsetToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon
  // last Monday = today - (offsetToThisMonday + 7) days
  const lastMonday = new Date(
    today0.getFullYear(),
    today0.getMonth(),
    today0.getDate() - offsetToThisMonday - 7,
  );
  // 6 dates: Mon..Sat tuần trước
  const dates = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + i);
    dates.push(d);
  }
  // dates[5] = Sat (i=5), dates[6] = Sun. Thay thành Sun để analyze weekend.
  dates[5] = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + 6);

  // Dedupe theo system_key (Sat+Sun cùng map dailymix_06, chỉ giữ lần đầu).
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
};
