const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SYSTEM_KEY = 'trending_now';
const PLAYLIST_NAME = 'Trending Now';
const PLAYLIST_DESCRIPTION = 'Những bài hát đang thịnh hành trên MusicFlow';

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

async function getGlobalSystemUserId(conn = pool) {
  const [admins] = await conn.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  if (admins.length) return Number(admins[0].id);

  const [users] = await conn.query(`SELECT id FROM users ORDER BY id LIMIT 1`);
  if (users.length) return Number(users[0].id);

  throw new Error('Cannot find a user row to own global system playlists');
}

function duplicateCount(items) {
  const seen = new Set();
  let duplicates = 0;
  for (const item of items) {
    const id = Number(item.id || item.song_id);
    if (!Number.isInteger(id)) continue;
    if (seen.has(id)) duplicates += 1;
    seen.add(id);
  }
  return duplicates;
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const id = Number(row.id || row.song_id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...row, id });
  }
  return out;
}

async function fetchRecentTrendingCandidates(limit) {
  const [rows] = await pool.query(
    `SELECT
        s.id,
        s.title,
        s.artist_id,
        a.name AS artist_name,
        s.genre_id,
        g.name AS genre_name,
        s.play_count,
        COUNT(lh.id) AS recent_listens,
        COALESCE(likes.recent_likes, 0) AS recent_likes,
        AVG(COALESCE(lh.completion_rate, 0)) AS avg_completion_rate,
        SUM(CASE WHEN COALESCE(lh.is_skipped, 0) = 1 THEN 1 ELSE 0 END) AS skip_count,
        (
          COUNT(lh.id) * 1.0
          + COALESCE(likes.recent_likes, 0) * 2.0
          + AVG(COALESCE(lh.completion_rate, 0)) * 3.0
          - SUM(CASE WHEN COALESCE(lh.is_skipped, 0) = 1 THEN 1 ELSE 0 END) * 0.5
        ) AS trending_score
     FROM listening_history lh
     JOIN songs s ON s.id = lh.song_id
     JOIN artists a ON a.id = s.artist_id
     LEFT JOIN genres g ON g.id = s.genre_id
     LEFT JOIN (
       SELECT song_id, COUNT(*) AS recent_likes
       FROM song_likes
       WHERE liked_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY song_id
     ) likes ON likes.song_id = s.id
     WHERE lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     GROUP BY s.id, s.title, s.artist_id, a.name, s.genre_id, g.name, s.play_count, likes.recent_likes
     ORDER BY trending_score DESC, recent_listens DESC, s.play_count DESC, s.id DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    recent_listens: Number(row.recent_listens || 0),
    recent_likes: Number(row.recent_likes || 0),
    avg_completion_rate: Number(row.avg_completion_rate || 0),
    skip_count: Number(row.skip_count || 0),
    trending_score: Number(row.trending_score || 0),
    strategy: 'recent_7d'
  }));
}

async function fetchPopularFallbackCandidates(limit) {
  const [rows] = await pool.query(
    `SELECT
        s.id,
        s.title,
        s.artist_id,
        a.name AS artist_name,
        s.genre_id,
        g.name AS genre_name,
        s.play_count,
        0 AS recent_listens,
        0 AS recent_likes,
        0 AS avg_completion_rate,
        0 AS skip_count,
        COALESCE(s.play_count, 0) AS trending_score
     FROM songs s
     JOIN artists a ON a.id = s.artist_id
     LEFT JOIN genres g ON g.id = s.genre_id
     WHERE ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY s.play_count DESC, s.id DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    recent_listens: 0,
    recent_likes: 0,
    avg_completion_rate: 0,
    skip_count: 0,
    trending_score: Number(row.trending_score || 0),
    strategy: 'popular_fallback'
  }));
}

async function getTrendingSongIds(options = {}) {
  const limit = clampLimit(options.limit);
  const pullLimit = Math.max(limit, Math.min(MAX_LIMIT, limit * 2));
  const recentRows = dedupeRows(await fetchRecentTrendingCandidates(pullLimit));
  const hasRecentSignal = recentRows.filter((row) => Number(row.recent_listens || 0) > 0).length >= Math.min(10, limit);

  if (hasRecentSignal) {
    const selected = recentRows.slice(0, limit);
    return {
      strategy: 'recent_7d',
      formula: 'recent_listens * 1.0 + recent_likes * 2.0 + avg_completion_rate * 3.0 - skip_count * 0.5',
      candidateCount: recentRows.length,
      duplicateCount: duplicateCount(recentRows),
      items: selected,
      songIds: selected.map((row) => Number(row.id))
    };
  }

  const popularRows = dedupeRows(await fetchPopularFallbackCandidates(pullLimit));
  const selected = popularRows.slice(0, limit);
  return {
    strategy: 'popular_fallback',
    formula: 'songs.play_count DESC fallback',
    candidateCount: popularRows.length,
    duplicateCount: duplicateCount(popularRows),
    items: selected,
    songIds: selected.map((row) => Number(row.id))
  };
}

async function ensureTrendingPlaylist(conn, songIds) {
  const globalSystemUserId = await getGlobalSystemUserId(conn);
  const coverUrl = resolvePlaylistCoverUrl(SYSTEM_KEY);

  const [existing] = await conn.query(
    `SELECT id, cover_url FROM playlists WHERE system_key = ? ORDER BY id LIMIT 1`,
    [SYSTEM_KEY]
  );

  let playlistId;
  let created = false;

  if (existing.length) {
    playlistId = existing[0].id;
    await conn.query(
      `UPDATE playlists
       SET user_id = ?, name = ?, description = ?, cover_url = COALESCE(?, cover_url),
           type = 'system', is_system = 1, is_public = 0, updated_at = NOW()
       WHERE id = ?`,
      [globalSystemUserId, PLAYLIST_NAME, PLAYLIST_DESCRIPTION, coverUrl, playlistId]
    );
  } else {
    const [result] = await conn.query(
      `INSERT INTO playlists
         (user_id, name, description, cover_url, type, is_public, is_system, system_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'system', 0, 1, ?, NOW(), NOW())`,
      [globalSystemUserId, PLAYLIST_NAME, PLAYLIST_DESCRIPTION, coverUrl, SYSTEM_KEY]
    );
    playlistId = result.insertId;
    created = true;
  }

  await conn.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId]);

  if (songIds.length) {
    const values = songIds.map((songId, index) => [playlistId, songId, index, new Date()]);
    await conn.query(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES ?`,
      [values]
    );
  }

  return { playlistId, created, insertedSongs: songIds.length };
}

async function generateTrendingPlaylist(options = {}) {
  const limit = clampLimit(options.limit);
  const dryRun = options.dryRun === true;
  const selection = await getTrendingSongIds({ limit });
  const topSongs = selection.items.slice(0, 10).map((item, index) => ({
    position: index + 1,
    id: Number(item.id),
    title: item.title,
    artist_name: item.artist_name,
    trending_score: Number(item.trending_score || 0),
    recent_listens: Number(item.recent_listens || 0),
    recent_likes: Number(item.recent_likes || 0),
    avg_completion_rate: Number(item.avg_completion_rate || 0),
    skip_count: Number(item.skip_count || 0)
  }));

  const baseResult = {
    systemKey: SYSTEM_KEY,
    strategy: selection.strategy,
    formula: selection.formula,
    candidateCount: selection.candidateCount,
    selectedCount: selection.songIds.length,
    duplicateCount: selection.duplicateCount,
    topSongs,
    dryRun
  };

  if (dryRun) {
    return {
      ...baseResult,
      playlistId: null,
      created: false,
      insertedSongs: 0,
      updatedAt: null
    };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const writeResult = await ensureTrendingPlaylist(conn, selection.songIds);
    await conn.commit();
    return {
      ...baseResult,
      ...writeResult,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.warn('[TrendingPlaylist] rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  SYSTEM_KEY,
  getTrendingSongIds,
  generateTrendingPlaylist
};
