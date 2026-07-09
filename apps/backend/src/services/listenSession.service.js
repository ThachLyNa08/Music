const { pool } = require('../config/database');
const messageService = require('./message.service');

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getActiveSession(conversationId) {
  const id = normalizeId(conversationId);
  if (!id) return null;

  const [rows] = await pool.query(
    `SELECT lts.*, u.display_name AS host_display_name, u.avatar_url AS host_avatar_url,
            s.title AS song_title, a.name AS song_artist_name, s.cover_url AS song_cover_url
     FROM listen_together_sessions lts
     JOIN users u ON lts.host_user_id = u.id
     LEFT JOIN songs s ON lts.current_song_id = s.id
     LEFT JOIN artists a ON s.artist_id = a.id
     WHERE lts.conversation_id = ? AND lts.status = 'active'
     LIMIT 1`,
    [id]
  );
  
  if (!rows.length) return null;
  const row = rows[0];
  
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    host_user_id: row.host_user_id,
    host_name: row.host_display_name,
    host_avatar: row.host_avatar_url,
    current_song_id: row.current_song_id,
    is_playing: Boolean(row.is_playing),
    position_seconds: Number(row.position_seconds),
    status: row.status,
    updated_at: row.updated_at,
    song: row.current_song_id ? {
      id: row.current_song_id,
      title: row.song_title,
      artist_name: row.song_artist_name,
      cover_url: row.song_cover_url
    } : null
  };
}

async function startSession(conversationId, hostUserId, { currentSongId, isPlaying, positionSeconds }) {
  const cId = normalizeId(conversationId);
  const hId = normalizeId(hostUserId);
  const sId = normalizeId(currentSongId);
  const playing = Boolean(isPlaying) ? 1 : 0;
  const pos = Number(positionSeconds) || 0;

  await messageService.assertParticipant(cId, hId);

  // Check if there is an active session
  const [existing] = await pool.query(
    `SELECT id FROM listen_together_sessions WHERE conversation_id = ? AND status = 'active' LIMIT 1`,
    [cId]
  );

  if (existing.length) {
    // Update existing session, take over host if needed (MVP allows taking over or we can restrict)
    await pool.query(
      `UPDATE listen_together_sessions
       SET host_user_id = ?, current_song_id = ?, is_playing = ?, position_seconds = ?, updated_at = NOW()
       WHERE id = ?`,
      [hId, sId, playing, pos, existing[0].id]
    );
  } else {
    // Create new session
    await pool.query(
      `INSERT INTO listen_together_sessions (conversation_id, host_user_id, current_song_id, is_playing, position_seconds, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [cId, hId, sId, playing, pos]
    );
  }

  return getActiveSession(cId);
}

async function updateSessionControl(conversationId, hostUserId, { currentSongId, isPlaying, positionSeconds }) {
  const cId = normalizeId(conversationId);
  const hId = normalizeId(hostUserId);
  const sId = normalizeId(currentSongId);
  const playing = Boolean(isPlaying) ? 1 : 0;
  const pos = Number(positionSeconds) || 0;

  await messageService.assertParticipant(cId, hId);

  const [result] = await pool.query(
    `UPDATE listen_together_sessions
     SET current_song_id = ?, is_playing = ?, position_seconds = ?, updated_at = NOW()
     WHERE conversation_id = ? AND host_user_id = ? AND status = 'active'`,
    [sId, playing, pos, cId, hId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Không tìm thấy phiên nghe chung đang hoạt động do bạn làm host.');
  }

  return getActiveSession(cId);
}

async function endSession(conversationId, hostUserId) {
  const cId = normalizeId(conversationId);
  const hId = normalizeId(hostUserId);

  await pool.query(
    `UPDATE listen_together_sessions
     SET status = 'ended', ended_at = NOW()
     WHERE conversation_id = ? AND host_user_id = ? AND status = 'active'`,
    [cId, hId]
  );
}

async function endSessionsByHost(hostUserId) {
  const hId = normalizeId(hostUserId);
  if (!hId) return [];

  // End all active sessions where this user is host, and return their conversation IDs
  const [rows] = await pool.query(
    `SELECT conversation_id FROM listen_together_sessions WHERE host_user_id = ? AND status = 'active'`,
    [hId]
  );

  if (rows.length > 0) {
    await pool.query(
      `UPDATE listen_together_sessions
       SET status = 'ended', ended_at = NOW()
       WHERE host_user_id = ? AND status = 'active'`,
      [hId]
    );
  }

  return rows.map(r => r.conversation_id);
}

module.exports = {
  getActiveSession,
  startSession,
  updateSessionControl,
  endSession,
  endSessionsByHost
};
