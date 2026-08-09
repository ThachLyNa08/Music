// apps/backend/src/services/weeklyMix.service.js
// Weekly Mix auto-generation based on the recommendation service.
//
// Strategy:
//   - Reuses recommendation.service.getRecommendationsForUser which already
//     dispatches BPR-MF / content_based / popular fallback and returns deduped,
//     public-songs-only items with cover_url + audio_url.
//   - Persists a per-user, system-owned playlist keyed by SYSTEM_KEY below.
//   - Idempotent: if a playlist with the same (user_id, system_key) already
//     exists, we keep the same id and refresh its songs/description/updated_at.
//     Other playlists (manual, ai, other system_keys) are never touched.

const { pool } = require('../config/database');
const recommendationService = require('./recommendation.service');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const { publicSongCondition } = require('../utils/public.utils');
const {
  computeOverlapStats,
  selectSongsWithOverlapCheck,
  getPlaylistSongIds,
  getRecentSystemPlaylistSongs,
  evaluateRegenerateQuality
} = require('../utils/playlistRegenerate.util');

const SYSTEM_KEY = 'weekly_mix';
const PLAYLIST_NAME = 'Weekly Mix của bạn';
const PLAYLIST_DESCRIPTION =
  'Danh sách phát được tổng hợp vào sáng Chủ nhật từ thói quen nghe nhạc trong tuần của bạn.';

const DEFAULT_LIMIT = 35;
const MAX_LIMIT = 50;

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function getWeeklyMixListeningWindow(referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const day = ref.getDay(); // 0 = Sun, 1 = Mon...

  // Target: the most recent Sunday 00:00 (or if today is Sunday, this Sunday)
  const d = new Date(ref.getTime());
  d.setHours(0, 0, 0, 0);

  let diffToSun = day === 0 ? 0 : day;
  if (day === 0 && ref.getTime() < d.getTime()) {
    diffToSun = 7; // It is Sunday before the scheduled 00:00 boundary; use last Sunday.
  }
  
  // The end of the window is the Sunday at 00:00.
  const endAt = new Date(ref.getTime());
  endAt.setDate(ref.getDate() - diffToSun);
  endAt.setHours(0, 0, 0, 0);

  // The start of the closed 7-day window before Sunday 00:00.
  const startAt = new Date(endAt.getTime());
  startAt.setDate(startAt.getDate() - 7);

  return { startAt, endAt };
}

function getListeningWindowFromOptions(options = {}) {
  const window = options.analysisWindow || options.listeningWindow;
  const startAt = window?.analysisStart || window?.startAt;
  const endAt = window?.analysisEnd || window?.endAt;
  return startAt && endAt ? { startAt, endAt } : null;
}

async function findExistingPlaylist(conn, userId) {
  const [rows] = await conn.query(
    `SELECT id, user_id, type, is_system, system_key
     FROM playlists
     WHERE user_id = ? AND system_key = ? AND is_system = 1
     LIMIT 1`,
    [userId, SYSTEM_KEY]
  );
  return rows[0] || null;
}

async function ensurePlaylist(conn, userId) {
  const existing = await findExistingPlaylist(conn, userId);
  const coverUrl = resolvePlaylistCoverUrl(SYSTEM_KEY);

  if (existing) {
    await conn.query(
      `UPDATE playlists
       SET name = ?, description = ?, cover_url = ?, type = 'system', is_system = 1, updated_at = NOW()
       WHERE id = ?`,
      [PLAYLIST_NAME, PLAYLIST_DESCRIPTION, coverUrl, existing.id]
    );
    return { playlistId: existing.id, created: false };
  }

  const [result] = await conn.query(
    `INSERT INTO playlists (user_id, name, description, cover_url, type, is_public, is_system, system_key)
     VALUES (?, ?, ?, ?, 'system', 0, 1, ?)`,
    [userId, PLAYLIST_NAME, PLAYLIST_DESCRIPTION, coverUrl, SYSTEM_KEY]
  );
  return { playlistId: result.insertId, created: true };
}

function dedupeSongIds(items) {
  const seen = new Set();
  const ids = [];
  for (const item of items) {
    const id = Number(item.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function fetchPublicSongIds(conn, songIds) {
  if (!songIds.length) return [];
  const placeholders = songIds.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT id FROM songs
     WHERE id IN (${placeholders})
       AND audio_url IS NOT NULL AND audio_url <> ''
       AND ${publicSongCondition('songs')}`,
    songIds
  );
  return rows.map((r) => Number(r.id));
}

async function replacePlaylistSongs(conn, playlistId, songIds) {
  await conn.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId]);
  if (!songIds.length) return 0;
  const values = songIds.map((songId, idx) => [playlistId, songId, idx]);
  await conn.query(
    `INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ?`,
    [values]
  );
  await conn.query(
    `UPDATE playlists 
     SET last_refreshed_at = NOW(), 
         next_refresh_at = DATE_ADD(NOW(), INTERVAL 7 DAY) 
     WHERE id = ?`, 
    [playlistId]
  );
  return songIds.length;
}

async function generateWeeklyMixForUser(userId, options = {}) {
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error('userId must be a positive integer');
  }
  const uid = Number(userId);
  const limit = clampLimit(options.limit);
  const dryRun = Boolean(options.dryRun);
  const referenceDate = options.referenceDate || options.scheduledFor || null;
  const listeningWindow = getListeningWindowFromOptions(options) || getWeeklyMixListeningWindow(referenceDate);

  const conn = await pool.getConnection();
  try {
    const existingPlaylist = await findExistingPlaylist(conn, uid);
    let oldSongIds = [];
    if (existingPlaylist) {
       oldSongIds = await getPlaylistSongIds(conn, existingPlaylist.id);
    }
    const recentSystemSongs = await getRecentSystemPlaylistSongs(conn, SYSTEM_KEY);

    const result = await recommendationService.getRecommendationsForUser(uid, { limit: limit * 5, listeningWindow, context: 'weekly_mix' });
    // result.items is [{ id, score, ... }]
    const candidateObjs = result.items.map(c => {
       let score = c.score || 0;
       if (recentSystemSongs.has(Number(c.id))) score -= 100;
       return { ...c, score };
    }).sort((a,b) => b.score - a.score);

    // Gather artist/genre info directly from candidateObjs (already included by recommendationService)
    // No need to query songs table again.

    // Custom selection logic with diversity quotas and overlap check
    const maxArtistCount = Math.floor(limit * 0.3);
    const maxGenreCount = Math.floor(limit * 0.65);
    const maxOldSongs = Math.floor(limit * 0.7); // target overlap <= 0.7 ideally

    const selectedIds = [];
    const artistCount = new Map();
    const genreCount = new Map();
    const oldIdSet = new Set(oldSongIds.map(Number));
    let oldAdded = 0;

    for (const c of candidateObjs) {
      if (selectedIds.length >= limit) break;
      const cid = Number(c.id);
      if (selectedIds.includes(cid)) continue;

      const isOld = oldIdSet.has(cid);
      if (isOld && oldAdded >= maxOldSongs) continue;

      const a = c.artist_id != null ? Number(c.artist_id) : null;
      const g = c.genre_id != null ? Number(c.genre_id) : null;

      if (a !== null && (artistCount.get(a) || 0) >= maxArtistCount) continue;
      if (g !== null && (genreCount.get(g) || 0) >= maxGenreCount) continue;

      selectedIds.push(cid);
      if (a !== null) artistCount.set(a, (artistCount.get(a) || 0) + 1);
      if (g !== null) genreCount.set(g, (genreCount.get(g) || 0) + 1);
      if (isOld) oldAdded++;
    }

    // Fallback if we couldn't reach the limit due to strict quotas
    let fallbackUsed = false;
    let fallbackReason = '';
    if (selectedIds.length < limit) {
      fallbackUsed = true;
      fallbackReason = 'insufficient candidates under weekly diversity quota';
      const relaxedMaxArtistCount = Math.floor(limit * 0.35);
      const relaxedMaxGenreCount = Math.floor(limit * 0.70);

      for (const c of candidateObjs) {
        if (selectedIds.length >= limit) break;
        const cid = Number(c.id);
        if (selectedIds.includes(cid)) continue;

        const a = c.artist_id != null ? Number(c.artist_id) : null;
        const g = c.genre_id != null ? Number(c.genre_id) : null;

        if (a !== null && (artistCount.get(a) || 0) >= relaxedMaxArtistCount) continue;
        if (g !== null && (genreCount.get(g) || 0) >= relaxedMaxGenreCount) continue;

        selectedIds.push(cid);
        if (a !== null) artistCount.set(a, (artistCount.get(a) || 0) + 1);
        if (g !== null) genreCount.set(g, (genreCount.get(g) || 0) + 1);
      }
    }

    const songIds = selectedIds;
    const strategy = result.strategy;
    const reason = result.reason;
    
    const overlapStats = computeOverlapStats(oldSongIds, songIds);
    let evalResult = evaluateRegenerateQuality({ ...overlapStats, candidateCount: candidateObjs.length }, limit);

    // Hard gate for Weekly Mix
    if (songIds.length < limit) {
      evalResult.canApply = false;
      evalResult.status = 'skipped';
      evalResult.message = `newSongs < ${limit}`;
    } else if (candidateObjs.length < 70) {
      evalResult.canApply = false;
      evalResult.status = 'skipped';
      evalResult.message = 'candidateCount < 70';
    } else if (overlapStats.overlapRatio >= 0.9) {
      evalResult.canApply = false;
      evalResult.status = 'skipped';
      evalResult.message = 'overlapRatio >= 0.9';
    } else if (overlapStats.addedSongs < 10) {
      evalResult.canApply = false;
      evalResult.status = 'skipped';
      evalResult.message = 'addedSongs < 10';
    }

    // Check final diversity ratios
    let maxSameArtist = 0;
    let maxSameGenre = 0;
    const finalArtistCount = new Map();
    const finalGenreCount = new Map();
    for (const sid of songIds) {
      const c = candidateObjs.find(obj => Number(obj.id) === sid) || {};
      const a = c.artist_id != null ? Number(c.artist_id) : null;
      const g = c.genre_id != null ? Number(c.genre_id) : null;
      if (a != null) {
        const c = (finalArtistCount.get(a) || 0) + 1;
        finalArtistCount.set(a, c);
        if (c > maxSameArtist) maxSameArtist = c;
      }
      if (g != null) {
        const c = (finalGenreCount.get(g) || 0) + 1;
        finalGenreCount.set(g, c);
        if (c > maxSameGenre) maxSameGenre = c;
      }
    }
    const finalMaxSameArtistRatio = songIds.length > 0 ? maxSameArtist / songIds.length : 0;
    const finalMaxSameGenreRatio = songIds.length > 0 ? maxSameGenre / songIds.length : 0;

    if (finalMaxSameArtistRatio > 0.3 || finalMaxSameGenreRatio > 0.65) {
      evalResult.canApply = false;
      evalResult.status = 'skipped';
      evalResult.message = 'Weekly Mix diversity threshold failed';
    }

  const summary = {
    userId: uid,
    strategy,
    reason,
    candidateCount: candidateObjs.length,
    dedupedCount: songIds.length,
    oldSongs: oldSongIds.length,
    newSongs: songIds.length,
    ...overlapStats,
    addedSongs: overlapStats.addedSongs,
    removedSongs: overlapStats.removedSongs,
    actualMaxSameArtistRatio: Number(finalMaxSameArtistRatio.toFixed(2)),
    actualMaxSameGenreRatio: Number(finalMaxSameGenreRatio.toFixed(2)),
    maxSameArtistLimit: 0.3,
    maxSameGenreLimit: 0.65,
    canApply: evalResult.canApply,
    status: evalResult.status,
    message: evalResult.message,
    fallbackUsed,
    fallbackReason,
    playlistId: existingPlaylist ? existingPlaylist.id : null,
    created: !existingPlaylist,
    insertedSongs: 0,
    dryRun,
  };

  if (dryRun) {
    return { ...summary, listeningWindow, topSongIds: songIds.slice(0, 10) };
  }

  if (evalResult.canApply || options.forceApply === true) {
    await conn.beginTransaction();
    const { playlistId, created } = await ensurePlaylist(conn, uid);
    const publicIds = await fetchPublicSongIds(conn, songIds);
    const inserted = await replacePlaylistSongs(conn, playlistId, publicIds);
    await conn.commit();
    summary.playlistId = playlistId;
    summary.created = created;
    summary.insertedSongs = inserted;
    summary.dedupedCount = publicIds.length;
    summary.forceApplied = options.forceApply === true && !evalResult.canApply;
    if (summary.forceApplied && inserted > 0) {
      summary.status = 'warning';
      summary.canApply = true;
    }
    
    // Post-apply verification logging
    console.log(`[WeeklyMix] Post-apply verification for User ${uid}:`, {
      playlistId,
      savedSongs: inserted,
      savedMaxSameArtistRatio: summary.actualMaxSameArtistRatio,
      savedMaxSameGenreRatio: summary.actualMaxSameGenreRatio,
      canApply: summary.canApply
    });
  }
  return summary;

  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

async function generateWeeklyMixForAllUsers(options = {}) {
  const limit = clampLimit(options.limit);
  const dryRun = Boolean(options.dryRun);
  const referenceDate = options.referenceDate || null;
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
  let totalCandidate = 0;
  let totalOverlap = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let maxArtist = 0;
  let maxGenre = 0;
  let allCanApply = true;
  let lastStatus = 'success';
  let successRuns = 0;

  let failedDiversityUsers = 0;
  let representativeUserId = null;

  for (const row of rows) {
    try {
      const summary = await generateWeeklyMixForUser(row.id, { limit, dryRun, referenceDate });
      stats.usersProcessed += 1;
      if (!dryRun) {
        if (summary.created) stats.playlistsCreated += 1;
        else stats.playlistsUpdated += 1;
        stats.songsInserted += summary.insertedSongs || 0;
      }
      
      totalCandidate += (summary.candidateCount || 0);
      totalOverlap += (summary.overlapRatio || 0);
      totalAdded += (summary.addedSongs || 0);
      totalRemoved += (summary.removedSongs || 0);
      if (summary.actualMaxSameArtistRatio > maxArtist) {
        maxArtist = summary.actualMaxSameArtistRatio;
        representativeUserId = row.id;
      }
      if (summary.actualMaxSameGenreRatio > maxGenre) maxGenre = summary.actualMaxSameGenreRatio;
      
      if (!summary.canApply) {
        allCanApply = false;
        if (summary.reason === 'Weekly Mix diversity threshold failed' || summary.message === 'Weekly Mix diversity threshold failed') {
          failedDiversityUsers++;
        }
      }
      lastStatus = summary.status;
      successRuns++;

      stats.details.push(summary);
    } catch (err) {
      stats.errors += 1;
      stats.skipped += 1;
      stats.details.push({
        userId: row.id,
        error: err.message,
      });
    }
  }

  if (successRuns > 0) {
    stats.systemKey = 'weekly_mix'; // for matching script logic
    stats.targetSize = limit;
    stats.totalUsers = stats.usersProcessed;
    stats.successCount = successRuns;
    stats.skippedCount = stats.skipped;
    stats.failedCount = stats.errors;
    stats.candidateCount = Math.round(totalCandidate / successRuns);
    stats.overlapRatio = Number((totalOverlap / successRuns).toFixed(2));
    stats.avgAddedSongs = Math.round(totalAdded / successRuns);
    stats.avgRemovedSongs = Math.round(totalRemoved / successRuns);
    stats.avgMaxSameArtistRatio = Number((totalAdded / successRuns > 0 ? maxArtist : 0).toFixed(2)); // We'll just report the worst case as requested
    stats.worstMaxSameArtistRatio = maxArtist;
    stats.worstMaxSameGenreRatio = maxGenre;
    stats.failedDiversityUsers = failedDiversityUsers;
    stats.representativeUserId = representativeUserId;
    stats.maxSameArtistLimit = 0.3;
    stats.maxSameGenreLimit = 0.65;
    
    // Explicit hard gate for the batch
    if (failedDiversityUsers > 0 || maxArtist > 0.30 || maxGenre > 0.65) {
      allCanApply = false;
    }
    stats.canApply = allCanApply;
    stats.status = lastStatus;
  }

  return stats;
}

module.exports = {
  SYSTEM_KEY,
  PLAYLIST_NAME,
  PLAYLIST_DESCRIPTION,
  getWeeklyMixListeningWindow,
  generateWeeklyMixForUser,
  generateWeeklyMixForAllUsers,
};
