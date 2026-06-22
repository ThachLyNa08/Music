const { pool } = require('../config/database');
const contextualMoodService = require('./contextualMood.service');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');

const DEFAULT_LIMIT = 25;
const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'];

const SLOT_PLAYLISTS = {
  morning: {
    timeSlot: 'morning',
    system_key: 'morning_vibes',
    name: 'Morning Vibes',
    description: 'Những gợi ý phù hợp để khởi động ngày mới.'
  },
  afternoon: {
    timeSlot: 'afternoon',
    system_key: 'afternoon_vibes',
    name: 'Afternoon Vibes',
    description: 'Những bài hát có năng lượng phù hợp cho buổi chiều.'
  },
  evening: {
    timeSlot: 'evening',
    system_key: 'evening_vibes',
    name: 'Evening Vibes',
    description: 'Những gợi ý nhẹ nhàng cho khoảng thời gian cuối ngày.'
  },
  night: {
    timeSlot: 'night',
    system_key: 'night_vibes',
    name: 'Night Vibes',
    description: 'Những bài hát phù hợp để thư giãn về đêm.'
  }
};

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(40, Math.floor(n));
}

function normalizeTimeSlot(timeSlot) {
  const slot = String(timeSlot || '').trim().toLowerCase();
  if (!TIME_SLOTS.includes(slot)) {
    throw new Error(`Invalid timeSlot: ${timeSlot}. Expected one of ${TIME_SLOTS.join(', ')}`);
  }
  return slot;
}

function dedupeSongItems(items) {
  const seen = new Set();
  const deduped = [];
  let duplicateCount = 0;

  for (const item of Array.isArray(items) ? items : []) {
    const songId = Number(item.id || item.song_id);
    if (!Number.isInteger(songId) || songId <= 0) continue;
    if (seen.has(songId)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(songId);
    deduped.push({ ...item, id: songId });
  }

  return { deduped, duplicateCount };
}

async function ensureContextualMoodPlaylist(conn, userId, config, songIds) {
  const coverUrl = resolvePlaylistCoverUrl(config.system_key);
  const [existing] = await conn.query(
    `SELECT id FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1`,
    [userId, config.system_key]
  );

  let playlistId;
  let created = false;

  if (existing.length) {
    playlistId = existing[0].id;
    await conn.query(
      `UPDATE playlists
       SET name = ?, description = ?, cover_url = ?, type = 'system',
           is_system = 1, is_public = 0, updated_at = NOW()
       WHERE id = ?`,
      [config.name, config.description, coverUrl, playlistId]
    );
  } else {
    const [result] = await conn.query(
      `INSERT INTO playlists
         (user_id, name, description, cover_url, type, is_public, is_system, system_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'system', 0, 1, ?, NOW(), NOW())`,
      [userId, config.name, config.description, coverUrl, config.system_key]
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

async function generateContextualMoodPlaylistForSlot(userId, timeSlot, options = {}) {
  const slot = normalizeTimeSlot(timeSlot);
  const config = SLOT_PLAYLISTS[slot];
  const limit = clampLimit(options.limit);
  const dryRun = options.dryRun === true;

  const recommendation = await contextualMoodService.getContextualMoodRecommendations(userId, {
    timeSlot: slot,
    limit,
    now: options.now,
    req: options.req || null
  });

  const { deduped, duplicateCount } = dedupeSongItems(recommendation.items);
  const songIds = deduped.map((item) => Number(item.id));
  const topSongs = deduped.slice(0, 5).map((item, index) => ({
    position: index + 1,
    id: Number(item.id),
    title: item.title,
    artist_name: item.artist_name || item.artist || null,
    recommendation_score: item.recommendation_score,
    mood_reason: item.mood_reason || null
  }));

  const baseResult = {
    userId: Number(userId),
    timeSlot: slot,
    systemKey: config.system_key,
    name: config.name,
    itemCount: songIds.length,
    duplicateCount,
    withAudioFeaturesCount: recommendation.withAudioFeaturesCount || null,
    withoutAudioFeaturesCount: recommendation.withoutAudioFeaturesCount || null,
    strategy: recommendation.strategy,
    strategyReason: recommendation.reason,
    topSongs,
    dryRun
  };

  if (dryRun) {
    return {
      ...baseResult,
      playlistId: null,
      created: false,
      insertedSongs: 0
    };
  }

  const conn = options.conn || await pool.getConnection();
  const ownsConnection = !options.conn;

  try {
    if (ownsConnection) await conn.beginTransaction();
    const writeResult = await ensureContextualMoodPlaylist(conn, userId, config, songIds);
    if (ownsConnection) await conn.commit();
    return {
      ...baseResult,
      ...writeResult
    };
  } catch (err) {
    if (ownsConnection) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.warn('[ContextualMoodPlaylist] rollback failed:', rollbackErr.message);
      }
    }
    throw err;
  } finally {
    if (ownsConnection) conn.release();
  }
}

async function generateContextualMoodPlaylistsForUser(userId, options = {}) {
  const requestedSlots = options.timeSlot ? [normalizeTimeSlot(options.timeSlot)] : TIME_SLOTS;
  const results = [];

  for (const slot of requestedSlots) {
    const result = await generateContextualMoodPlaylistForSlot(userId, slot, options);
    results.push(result);
  }

  return {
    userId: Number(userId),
    dryRun: options.dryRun === true,
    playlistsProcessed: results.length,
    playlistsCreated: results.filter((item) => item.created).length,
    playlistsUpdated: results.filter((item) => !item.created && !item.dryRun).length,
    songsInserted: results.reduce((sum, item) => sum + Number(item.insertedSongs || 0), 0),
    results
  };
}

async function getEligibleUserIds(limit = null) {
  const params = [];
  let limitSql = '';
  if (Number.isInteger(limit) && limit > 0) {
    limitSql = ' LIMIT ?';
    params.push(limit);
  }
  const [rows] = await pool.query(
    `SELECT id
     FROM users
     WHERE (role IS NULL OR role <> 'admin')
       AND (status IS NULL OR status = 'active')
     ORDER BY id${limitSql}`,
    params
  );
  return rows.map((row) => Number(row.id)).filter(Number.isInteger);
}

async function generateContextualMoodPlaylistsForAllUsers(options = {}) {
  const userIds = Array.isArray(options.userIds) && options.userIds.length
    ? options.userIds.map(Number).filter(Number.isInteger)
    : await getEligibleUserIds(options.userLimit);

  const summary = {
    dryRun: options.dryRun === true,
    totalUsers: userIds.length,
    usersProcessed: 0,
    playlistsProcessed: 0,
    playlistsCreated: 0,
    playlistsUpdated: 0,
    songsInserted: 0,
    errors: 0,
    results: []
  };

  for (const userId of userIds) {
    try {
      const result = await generateContextualMoodPlaylistsForUser(userId, options);
      summary.usersProcessed += 1;
      summary.playlistsProcessed += result.playlistsProcessed;
      summary.playlistsCreated += result.playlistsCreated;
      summary.playlistsUpdated += result.playlistsUpdated;
      summary.songsInserted += result.songsInserted;
      summary.results.push(result);
    } catch (err) {
      summary.errors += 1;
      summary.results.push({ userId, error: err.message });
    }
  }

  return summary;
}

module.exports = {
  TIME_SLOTS,
  SLOT_PLAYLISTS,
  generateContextualMoodPlaylistForSlot,
  generateContextualMoodPlaylistsForUser,
  generateContextualMoodPlaylistsForAllUsers,
  getEligibleUserIds
};
