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

const SYSTEM_KEY = 'weekly_mix';
const PLAYLIST_NAME = 'Weekly Mix của bạn';
const PLAYLIST_DESCRIPTION =
  'Danh sách phát được tổng hợp vào sáng Chủ nhật từ thói quen nghe nhạc trong tuần của bạn.';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 30;

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function getWeeklyMixListeningWindow(referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const day = ref.getDay(); // 0 = Sun, 1 = Mon...
  
  // Target: the most recent Sunday 07:00 (or if today is Sunday, this Sunday)
  const d = new Date(ref.getTime());
  d.setHours(7, 0, 0, 0);

  let diffToSun = day === 0 ? 0 : day;
  if (day === 0 && ref.getTime() < d.getTime()) {
    diffToSun = 7; // It's Sunday but before 07:00, use last Sunday
  }
  
  // The end of the window is the Sunday at 00:00.
  const endAt = new Date(ref.getTime());
  endAt.setDate(ref.getDate() - diffToSun);
  endAt.setHours(0, 0, 0, 0);

  // The start of the window is the Monday before that Sunday at 00:00 (i.e. 6 days before Sunday).
  const startAt = new Date(endAt.getTime());
  startAt.setDate(startAt.getDate() - 6);

  return { startAt, endAt };
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
  const referenceDate = options.referenceDate || null;
  const listeningWindow = getWeeklyMixListeningWindow(referenceDate);

  const result = await recommendationService.getRecommendationsForUser(uid, { limit, listeningWindow });
  const songIds = dedupeSongIds(result.items);
  const strategy = result.strategy;
  const reason = result.reason;

  const summary = {
    userId: uid,
    strategy,
    reason,
    candidateCount: result.items.length,
    dedupedCount: songIds.length,
    playlistId: null,
    created: false,
    insertedSongs: 0,
    dryRun,
  };

  if (dryRun) {
    return { ...summary, listeningWindow, topSongIds: songIds.slice(0, 10) };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { playlistId, created } = await ensurePlaylist(conn, uid);
    const publicIds = await fetchPublicSongIds(conn, songIds);
    const inserted = await replacePlaylistSongs(conn, playlistId, publicIds);
    await conn.commit();
    summary.playlistId = playlistId;
    summary.created = created;
    summary.insertedSongs = inserted;
    summary.dedupedCount = publicIds.length;
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
  for (const row of rows) {
    try {
      const summary = await generateWeeklyMixForUser(row.id, { limit, dryRun, referenceDate });
      stats.usersProcessed += 1;
      if (!dryRun) {
        if (summary.created) stats.playlistsCreated += 1;
        else stats.playlistsUpdated += 1;
        stats.songsInserted += summary.insertedSongs || 0;
      }
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
