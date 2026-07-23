const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const { SYSTEM_PLAYLIST_BY_KEY } = require('./systemPlaylist.service');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const BEHAVIOR_PLAYLIST_KEYS = {
  favorite_songs: 'favorite_songs',
  recently_played: 'recently_played',
};

let listeningTimestampColumnPromise = null;

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

async function getListeningTimestampColumn() {
  if (!listeningTimestampColumnPromise) {
    listeningTimestampColumnPromise = (async () => {
      const [listenedAt] = await pool.query(`SHOW COLUMNS FROM listening_history LIKE 'listened_at'`);
      if (listenedAt.length) return 'listened_at';

      const [createdAt] = await pool.query(`SHOW COLUMNS FROM listening_history LIKE 'created_at'`);
      if (createdAt.length) return 'created_at';

      throw new Error('listening_history has no listened_at or created_at column');
    })();
  }
  return listeningTimestampColumnPromise;
}

async function getEligibleUserIds(limit = null) {
  const params = [];
  let sql = `SELECT id FROM users WHERE role = 'user' AND status = 'active' ORDER BY id`;
  const safeLimit = Number(limit);
  if (Number.isInteger(safeLimit) && safeLimit > 0) {
    sql += ` LIMIT ?`;
    params.push(safeLimit);
  }
  const [rows] = await pool.query(sql, params);
  return rows.map((row) => Number(row.id)).filter(Number.isInteger);
}

async function getPlaylistSongIds(conn, playlistId) {
  const [rows] = await conn.query(
    `SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position, added_at`,
    [playlistId]
  );
  return rows.map((row) => Number(row.song_id)).filter(Number.isInteger);
}

function diffSongIds(oldSongIds, newSongIds) {
  const oldSet = new Set(oldSongIds.map(Number));
  const newSet = new Set(newSongIds.map(Number));
  let added = 0;
  let removed = 0;

  for (const id of newSet) {
    if (!oldSet.has(id)) added += 1;
  }
  for (const id of oldSet) {
    if (!newSet.has(id)) removed += 1;
  }

  return { songsAdded: added, songsRemoved: removed };
}

async function ensureBehaviorPlaylist(conn, userId, systemKey) {
  const config = SYSTEM_PLAYLIST_BY_KEY[systemKey];
  if (!config) {
    throw new Error(`Missing system playlist config: ${systemKey}`);
  }

  const coverUrl = resolvePlaylistCoverUrl(systemKey);
  const [existing] = await conn.query(
    `SELECT id FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1`,
    [userId, systemKey]
  );

  if (existing.length) {
    await conn.query(
      `UPDATE playlists
       SET name = ?, description = ?, cover_url = ?, type = 'system',
           is_system = 1, is_public = 0, updated_at = NOW()
       WHERE id = ?`,
      [config.name, config.description, coverUrl, existing[0].id]
    );
    return { playlistId: Number(existing[0].id), created: false };
  }

  const [result] = await conn.query(
    `INSERT INTO playlists
       (user_id, name, description, cover_url, type, is_public, is_system, system_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'system', 0, 1, ?, NOW(), NOW())`,
    [userId, config.name, config.description, coverUrl, systemKey]
  );
  return { playlistId: Number(result.insertId), created: true };
}

async function fetchFavoriteSongIds(conn, userId, limit) {
  const [rows] = await conn.query(
    `SELECT s.id
     FROM song_likes sl
     JOIN songs s ON s.id = sl.song_id
     WHERE sl.user_id = ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY sl.liked_at DESC, s.id DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map((row) => Number(row.id)).filter(Number.isInteger);
}

async function fetchRecentlyPlayedSongIds(conn, userId, limit) {
  const timeColumn = await getListeningTimestampColumn();
  const [rows] = await conn.query(
    `SELECT s.id, MAX(lh.${timeColumn}) AS last_played_at
     FROM listening_history lh
     JOIN songs s ON s.id = lh.song_id
     WHERE lh.user_id = ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     GROUP BY s.id
     ORDER BY last_played_at DESC, s.id DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map((row) => Number(row.id)).filter(Number.isInteger);
}

async function replacePlaylistSongs(conn, playlistId, songIds) {
  await conn.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId]);
  if (songIds.length) {
    const values = songIds.map((songId, index) => [playlistId, songId, index, new Date()]);
    await conn.query(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES ?`,
      [values]
    );
  }
  await conn.query(
    `UPDATE playlists
     SET last_refreshed_at = NOW(),
         next_refresh_at = DATE_ADD(NOW(), INTERVAL 1 DAY),
         updated_at = NOW()
     WHERE id = ?`,
    [playlistId]
  );
}

async function generateBehaviorPlaylistForUser(userId, systemKey, options = {}) {
  if (!Object.values(BEHAVIOR_PLAYLIST_KEYS).includes(systemKey)) {
    throw new Error(`Unsupported behavior system playlist: ${systemKey}`);
  }

  const limit = clampLimit(options.limit);
  const dryRun = options.dryRun === true;
  const conn = options.conn || await pool.getConnection();
  const ownsConnection = !options.conn;

  try {
    if (ownsConnection) await conn.beginTransaction();

    const { playlistId, created } = await ensureBehaviorPlaylist(conn, userId, systemKey);
    const oldSongIds = await getPlaylistSongIds(conn, playlistId);
    const newSongIds = systemKey === BEHAVIOR_PLAYLIST_KEYS.favorite_songs
      ? await fetchFavoriteSongIds(conn, userId, limit)
      : await fetchRecentlyPlayedSongIds(conn, userId, limit);
    const diff = diffSongIds(oldSongIds, newSongIds);

    if (!dryRun) {
      await replacePlaylistSongs(conn, playlistId, newSongIds);
    }

    if (ownsConnection) await conn.commit();
    return {
      userId,
      playlistId,
      systemKey,
      created,
      updated: !created,
      insertedSongs: newSongIds.length,
      totalSongs: newSongIds.length,
      ...diff,
      status: 'success',
      dryRun,
    };
  } catch (err) {
    if (ownsConnection) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.warn('[BehaviorSystemPlaylist] rollback failed:', rollbackErr.message);
      }
    }
    throw err;
  } finally {
    if (ownsConnection) conn.release();
  }
}

async function generateBehaviorPlaylistsForAllUsers(options = {}) {
  const systemKeys = Array.isArray(options.systemKeys) && options.systemKeys.length
    ? options.systemKeys
    : Object.values(BEHAVIOR_PLAYLIST_KEYS);
  const userIds = Array.isArray(options.userIds) && options.userIds.length
    ? options.userIds.map(Number).filter(Number.isInteger)
    : await getEligibleUserIds(options.userLimit);

  const summary = {
    dryRun: options.dryRun === true,
    totalUsers: userIds.length,
    usersProcessed: 0,
    playlistsCreated: 0,
    playlistsUpdated: 0,
    playlistsFailed: 0,
    songsInserted: 0,
    songsAdded: 0,
    songsRemoved: 0,
    totalSongs: 0,
    errors: 0,
    results: [],
  };

  for (const userId of userIds) {
    let userHadSuccess = false;
    for (const systemKey of systemKeys) {
      try {
        const result = await generateBehaviorPlaylistForUser(userId, systemKey, options);
        summary.results.push(result);
        if (result.created) summary.playlistsCreated += 1;
        else summary.playlistsUpdated += 1;
        summary.songsInserted += result.insertedSongs || 0;
        summary.songsAdded += result.songsAdded || 0;
        summary.songsRemoved += result.songsRemoved || 0;
        summary.totalSongs += result.totalSongs || 0;
        userHadSuccess = true;
      } catch (err) {
        summary.errors += 1;
        summary.playlistsFailed += 1;
        summary.results.push({
          userId,
          systemKey,
          status: 'failed',
          error: err.message,
        });
      }
    }
    if (userHadSuccess) summary.usersProcessed += 1;
  }

  summary.status = summary.errors > 0
    ? (summary.playlistsCreated + summary.playlistsUpdated > 0 ? 'partial' : 'failed')
    : 'success';
  return summary;
}

module.exports = {
  BEHAVIOR_PLAYLIST_KEYS,
  generateBehaviorPlaylistForUser,
  generateBehaviorPlaylistsForAllUsers,
};
