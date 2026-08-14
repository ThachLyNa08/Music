const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');

const MAX_MESSAGE_LENGTH = 1000;
const MAX_USER_SEARCH_QUERY_LENGTH = 100;

function normalizeUserId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeConversationId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeOptionalPositiveId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 0) return value;
    const error = new Error(`${field} khong hop le`);
    error.statusCode = 400;
    throw error;
  }
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    const error = new Error(`${field} khong hop le`);
    error.statusCode = 400;
    throw error;
  }
  return Number(text);
}

function buildDirectKey(userA, userB) {
  const [first, second] = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `${first}:${second}`;
}

function sanitizeBody(body) {
  return String(body || '').trim().replace(/\s+\n/g, '\n');
}

function mapUser(row, prefix = '') {
  return {
    id: row[`${prefix}id`],
    display_name: row[`${prefix}display_name`],
    email: row[`${prefix}email`],
    avatar_url: row[`${prefix}avatar_url`],
  };
}

function mapSharedSong(row, prefix = 'shared_song_') {
  if (!row[`${prefix}id`]) return null;
  return {
    id: row[`${prefix}id`],
    title: row[`${prefix}title`],
    artist: row[`${prefix}artist`],
    artist_name: row[`${prefix}artist`],
    artist_id: row[`${prefix}artist_id`],
    cover_url: row[`${prefix}cover_url`],
    audio_url: row[`${prefix}audio_url`],
    duration_sec: row[`${prefix}duration_sec`],
  };
}

function mapSharedPlaylist(row) {
  if (!row.shared_playlist_id) return null;
  return {
    id: row.shared_playlist_id,
    title: row.shared_playlist_title,
    subtitle: row.shared_playlist_subtitle,
    cover_url: row.shared_playlist_cover_url,
  };
}

function mapSharedAlbum(row) {
  if (!row.shared_album_id) return null;
  return {
    id: row.shared_album_id,
    title: row.shared_album_title,
    artist_name: row.shared_album_artist,
    cover_url: row.shared_album_cover_url,
  };
}

function mapSharedArtist(row) {
  if (!row.shared_artist_id) return null;
  return {
    id: row.shared_artist_id,
    name: row.shared_artist_name,
    avatar_url: row.shared_artist_avatar_url,
  };
}

function mapMessage(row) {
  let msg;
  if (row.deleted_at) {
    msg = {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      sender: {
        id: row.sender_id,
        display_name: row.sender_display_name,
        avatar_url: row.sender_avatar_url,
      },
      body: 'Tin nhắn đã được thu hồi',
      message_type: 'recalled',
      shared_song_id: null,
      shared_song: null,
      reply_to_message_id: null,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  } else {
    msg = {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      sender: {
        id: row.sender_id,
        display_name: row.sender_display_name,
        avatar_url: row.sender_avatar_url,
      },
      body: row.body,
      message_type: row.message_type,
      shared_song_id: row.shared_song_id,
      shared_song: mapSharedSong(row),
      shared_playlist_id: row.shared_playlist_id,
      shared_playlist: mapSharedPlaylist(row),
      shared_album_id: row.shared_album_id,
      shared_album: mapSharedAlbum(row),
      shared_artist_id: row.shared_artist_id,
      shared_artist: mapSharedArtist(row),
      reply_to_message_id: row.reply_to_message_id || null,
      system_event_type: row.system_event_type || null,
      system_metadata: (function() {
        if (!row.system_metadata) return {};
        try {
          return typeof row.system_metadata === 'string' 
            ? JSON.parse(row.system_metadata) 
            : row.system_metadata;
        } catch (e) {
          return {};
        }
      })(),
      created_at: row.created_at,
    };
  }

  if (row.reply_to_message_id && row.reply_id) {
    if (row.reply_deleted_at) {
      msg.reply_to = {
        id: row.reply_id,
        sender_name: row.reply_sender_display_name,
        body: 'Tin nhắn đã được thu hồi',
        message_type: 'recalled',
      };
    } else {
      msg.reply_to = {
        id: row.reply_id,
        sender_name: row.reply_sender_display_name,
        body: row.reply_body,
        message_type: row.reply_type,
      };
      if (row.reply_type === 'song_share' && row.reply_song_id) {
        msg.reply_to.shared_song = {
          id: row.reply_song_id,
          title: row.reply_song_title,
          artist_name: row.reply_song_artist_name,
          cover_url: row.reply_song_cover_url,
        };
      } else if (row.reply_type === 'playlist_share' && row.reply_playlist_id) {
        msg.reply_to.shared_playlist = {
          id: row.reply_playlist_id,
          title: row.reply_playlist_title,
          cover_url: row.reply_playlist_cover_url,
        };
      } else if (row.reply_type === 'album_share' && row.reply_album_id) {
        msg.reply_to.shared_album = {
          id: row.reply_album_id,
          title: row.reply_album_title,
          cover_url: row.reply_album_cover_url,
        };
      } else if (row.reply_type === 'artist_share' && row.reply_artist_id) {
        msg.reply_to.shared_artist = {
          id: row.reply_artist_id,
          name: row.reply_artist_name,
          avatar_url: row.reply_artist_avatar_url,
        };
      }
    }
  }

  return msg;
}

async function userExists(userId) {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE id = ? AND status = "active" AND role = "user" LIMIT 1',
    [userId]
  );
  return rows.length > 0;
}

async function getParticipantUserIds(conversationId) {
  const [rows] = await pool.query(
    'SELECT user_id FROM conversation_participants WHERE conversation_id = ?',
    [conversationId]
  );
  return rows.map((row) => row.user_id);
}

async function getShareableSong(songId) {
  const id = Number(songId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Bai hat khong hop le');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await pool.query(
    `SELECT
       s.id,
       s.title,
       s.artist_id,
       a.name AS artist,
       s.cover_url,
       s.audio_url,
       s.duration_sec
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE s.id = ?
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    const error = new Error('Khong tim thay bai hat kha dung');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function getShareablePlaylist(playlistId, userId) {
  const id = Number(playlistId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Playlist không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  const [rows] = await pool.query(
    `SELECT id, name AS title, description AS subtitle, cover_url, type, is_public, user_id
     FROM playlists
     WHERE id = ? LIMIT 1`,
    [id]
  );
  const playlist = rows[0];
  if (!playlist) {
    const error = new Error('Không tìm thấy playlist');
    error.statusCode = 404;
    throw error;
  }
  if (playlist.type !== 'system' && !playlist.is_public && playlist.user_id !== userId) {
    const error = new Error('Bạn không có quyền chia sẻ playlist riêng tư này');
    error.statusCode = 403;
    throw error;
  }
  return { ...playlist, title: playlist.title };
}

async function getShareableAlbum(albumId) {
  const id = Number(albumId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Album không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  const [rows] = await pool.query(
    `SELECT al.id, al.title, a.name AS artist, al.cover_url, al.release_status
     FROM albums al
     LEFT JOIN artists a ON a.id = al.artist_id
     WHERE al.id = ? LIMIT 1`,
    [id]
  );
  const album = rows[0];
  if (!album || ['deleted', 'hidden', 'draft'].includes(album.release_status)) {
    const error = new Error('Không tìm thấy album khả dụng');
    error.statusCode = 404;
    throw error;
  }
  return album;
}

async function getShareableArtist(artistId) {
  const id = Number(artistId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Nghệ sĩ không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  const [rows] = await pool.query(
    `SELECT id, name AS title, bio AS subtitle, avatar_url AS cover_url
     FROM artists
     WHERE id = ? LIMIT 1`,
    [id]
  );
  const artist = rows[0];
  if (!artist) {
    const error = new Error('Không tìm thấy nghệ sĩ');
    error.statusCode = 404;
    throw error;
  }
  return artist;
}

async function assertParticipant(conversationId, userId) {
  const [rows] = await pool.query(
    `SELECT cp.conversation_id
     FROM conversation_participants cp
     WHERE cp.conversation_id = ? AND cp.user_id = ?
     LIMIT 1`,
    [conversationId, userId]
  );
  if (!rows.length) {
    const error = new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
    error.statusCode = 403;
    throw error;
  }
}

async function findDirectConversation(userA, userB, conn = pool) {
  const directKey = buildDirectKey(userA, userB);
  const [byKey] = await conn.query(
    'SELECT id FROM conversations WHERE type = "direct" AND direct_key = ? LIMIT 1',
    [directKey]
  );
  if (byKey.length) return byKey[0].id;

  const [rows] = await conn.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
     WHERE c.type = "direct"
     LIMIT 1`,
    [userA, userB]
  );
  return rows[0]?.id || null;
}

async function getOrCreateDirectConversation(currentUserId, targetUserId) {
  const userId = normalizeUserId(currentUserId);
  const otherUserId = normalizeUserId(targetUserId);
  if (!otherUserId) {
    const error = new Error('User không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  if (userId === otherUserId) {
    const error = new Error('Không thể tự nhắn tin với chính mình');
    error.statusCode = 400;
    throw error;
  }
  if (!(await userExists(otherUserId))) {
    const error = new Error('Không tìm thấy người dùng');
    error.statusCode = 404;
    throw error;
  }

  const conn = await pool.getConnection();
  const directKey = buildDirectKey(userId, otherUserId);

  try {
    await conn.beginTransaction();

    const existingId = await findDirectConversation(userId, otherUserId, conn);
    if (existingId) {
      await conn.commit();
      return getConversationForUser(existingId, userId);
    }

    try {
      const [result] = await conn.query(
        'INSERT INTO conversations (type, direct_key) VALUES ("direct", ?)',
        [directKey]
      );
      const conversationId = result.insertId;
      await conn.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES (?, ?), (?, ?)`,
        [conversationId, userId, conversationId, otherUserId]
      );
      await conn.commit();
      return getConversationForUser(conversationId, userId);
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      await conn.rollback();
      const conversationId = await findDirectConversation(userId, otherUserId);
      return getConversationForUser(conversationId, userId);
    }
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

async function getConversationForUser(conversationId, userId) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  const [rows] = await pool.query(
    `SELECT
       c.id AS conversation_id,
       c.updated_at,
       u.id AS other_id,
       u.display_name AS other_display_name,
       u.email AS other_email,
       u.avatar_url AS other_avatar_url,
       other_cp.last_read_message_id AS other_last_read_message_id,
       m.id AS last_message_id,
       m.body AS last_message_body,
       m.sender_id AS last_message_sender_id,
       m.message_type AS last_message_type,
       m.created_at AS last_message_created_at,
       m.deleted_at AS last_message_deleted_at,
       ss.id AS last_shared_song_id,
       ss.title AS last_shared_song_title,
       sa.name AS last_shared_song_artist,
       (
         SELECT COUNT(*)
         FROM messages unread
         WHERE unread.conversation_id = c.id
           AND unread.deleted_at IS NULL
           AND unread.sender_id <> ?
           AND unread.id > COALESCE(cp.last_read_message_id, 0)
       ) AS unread_count
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
     JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id <> ?
     JOIN users u ON u.id = other_cp.user_id
     LEFT JOIN messages m ON m.id = (
       SELECT lm.id
       FROM messages lm
       WHERE lm.conversation_id = c.id
       ORDER BY lm.created_at DESC, lm.id DESC
       LIMIT 1
     )
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists sa ON sa.id = ss.artist_id
     WHERE c.id = ?
     LIMIT 1`,
    [userId, userId, userId, id]
  );

  const row = rows[0];
  if (!row) return null;
  return {
    conversation_id: row.conversation_id,
    other_user: mapUser(row, 'other_'),
    last_message: row.last_message_id ? {
      id: row.last_message_id,
      body: row.last_message_deleted_at ? 'Tin nhắn đã được thu hồi' : row.last_message_body,
      sender_id: row.last_message_sender_id,
      message_type: row.last_message_deleted_at ? 'recalled' : row.last_message_type,
      shared_song: (row.last_shared_song_id && !row.last_message_deleted_at) ? {
        id: row.last_shared_song_id,
        title: row.last_shared_song_title,
        artist: row.last_shared_song_artist,
      } : null,
      created_at: row.last_message_created_at,
      deleted_at: row.last_message_deleted_at,
    } : null,
    unread_count: Number(row.unread_count || 0),
    other_last_read_message_id: row.other_last_read_message_id || 0,
    updated_at: row.updated_at,
  };
}

async function listConversations(userId) {
  const [rows] = await pool.query(
    `SELECT
       c.id AS conversation_id,
       c.updated_at,
       u.id AS other_id,
       u.display_name AS other_display_name,
       u.email AS other_email,
       u.avatar_url AS other_avatar_url,
       other_cp.last_read_message_id AS other_last_read_message_id,
       m.id AS last_message_id,
       m.body AS last_message_body,
       m.sender_id AS last_message_sender_id,
       m.message_type AS last_message_type,
       m.created_at AS last_message_created_at,
       m.deleted_at AS last_message_deleted_at,
       ss.id AS last_shared_song_id,
       ss.title AS last_shared_song_title,
       sa.name AS last_shared_song_artist,
       (
         SELECT COUNT(*)
         FROM messages unread
         WHERE unread.conversation_id = c.id
           AND unread.deleted_at IS NULL
           AND unread.sender_id <> ?
           AND unread.id > COALESCE(cp.last_read_message_id, 0)
       ) AS unread_count
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
     JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id <> ?
     JOIN users u ON u.id = other_cp.user_id
     LEFT JOIN messages m ON m.id = (
       SELECT lm.id
       FROM messages lm
       WHERE lm.conversation_id = c.id
       ORDER BY lm.created_at DESC, lm.id DESC
       LIMIT 1
     )
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists sa ON sa.id = ss.artist_id
     WHERE c.type = "direct"
     ORDER BY COALESCE(m.created_at, c.updated_at) DESC, c.id DESC`,
    [userId, userId, userId]
  );

  return rows.map((row) => ({
    conversation_id: row.conversation_id,
    other_user: mapUser(row, 'other_'),
    last_message: row.last_message_id ? {
      id: row.last_message_id,
      body: row.last_message_deleted_at ? 'Tin nhắn đã được thu hồi' : row.last_message_body,
      sender_id: row.last_message_sender_id,
      message_type: row.last_message_deleted_at ? 'recalled' : row.last_message_type,
      shared_song: (row.last_shared_song_id && !row.last_message_deleted_at) ? {
        id: row.last_shared_song_id,
        title: row.last_shared_song_title,
        artist: row.last_shared_song_artist,
      } : null,
      created_at: row.last_message_created_at,
      deleted_at: row.last_message_deleted_at,
    } : null,
    unread_count: Number(row.unread_count || 0),
    other_last_read_message_id: row.other_last_read_message_id || 0,
    updated_at: row.updated_at,
  }));
}

async function getUnreadCount(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS unread_count
     FROM conversation_participants cp
     JOIN messages m ON m.conversation_id = cp.conversation_id
     WHERE cp.user_id = ?
       AND m.deleted_at IS NULL
       AND m.sender_id <> ?
       AND m.id > COALESCE(cp.last_read_message_id, 0)`,
    [userId, userId]
  );

  return Number(rows[0]?.unread_count || 0);
}

async function listMessages(conversationId, userId, { limit = 50, before = null } = {}) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const params = [id];
  let beforeClause = '';
  const beforeId = Number(before);
  if (Number.isInteger(beforeId) && beforeId > 0) {
    beforeClause = 'AND m.id < ?';
    params.push(beforeId);
  }
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.display_name AS sender_display_name,
       u.avatar_url AS sender_avatar_url,
       m.reply_to_message_id,
       m.body,
       m.message_type,
       m.shared_song_id,
       ss.id AS shared_song_id,
       ss.title AS shared_song_title,
       ss.artist_id AS shared_song_artist_id,
       a.name AS shared_song_artist,
       ss.cover_url AS shared_song_cover_url,
       ss.audio_url AS shared_song_audio_url,
       ss.duration_sec AS shared_song_duration_sec,
       m.shared_playlist_id,
       spl.name AS shared_playlist_title,
       spl.description AS shared_playlist_subtitle,
       COALESCE(spl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = spl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS shared_playlist_cover_url,
       m.shared_album_id,
       sal.title AS shared_album_title,
       sal_a.name AS shared_album_artist,
       COALESCE(sal.cover_url, (SELECT cover_url FROM songs WHERE album_id = sal.id AND cover_url IS NOT NULL LIMIT 1)) AS shared_album_cover_url,
       m.shared_artist_id,
       sar.name AS shared_artist_name,
       sar.avatar_url AS shared_artist_avatar_url,
       m.system_event_type,
       m.system_metadata,
       m.created_at,
       m.deleted_at,
       rm.id AS reply_id,
       rm.body AS reply_body,
       rm.message_type AS reply_type,
       rm.deleted_at AS reply_deleted_at,
       ru.display_name AS reply_sender_display_name,
       rss.id AS reply_song_id,
       rss.title AS reply_song_title,
       rss.cover_url AS reply_song_cover_url,
       rsa.name AS reply_song_artist_name,
       rspl.id AS reply_playlist_id,
       rspl.name AS reply_playlist_title,
       COALESCE(rspl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = rspl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS reply_playlist_cover_url,
       rsal.id AS reply_album_id,
       rsal.title AS reply_album_title,
       COALESCE(rsal.cover_url, (SELECT cover_url FROM songs WHERE album_id = rsal.id AND cover_url IS NOT NULL LIMIT 1)) AS reply_album_cover_url,
       rsar.id AS reply_artist_id,
       rsar.name AS reply_artist_name,
       rsar.avatar_url AS reply_artist_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists a ON a.id = ss.artist_id
     LEFT JOIN playlists spl ON spl.id = m.shared_playlist_id
     LEFT JOIN albums sal ON sal.id = m.shared_album_id
     LEFT JOIN artists sal_a ON sal_a.id = sal.artist_id
     LEFT JOIN artists sar ON sar.id = m.shared_artist_id
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.sender_id = ru.id
     LEFT JOIN songs rss ON rm.shared_song_id = rss.id
     LEFT JOIN artists rsa ON rss.artist_id = rsa.id
     LEFT JOIN playlists rspl ON rspl.id = rm.shared_playlist_id
     LEFT JOIN albums rsal ON rsal.id = rm.shared_album_id
     LEFT JOIN artists rsar ON rsar.id = rm.shared_artist_id
     WHERE m.conversation_id = ?
       ${beforeClause}
     ORDER BY m.id DESC
     LIMIT ?`,
    params
  );

  const messages = rows.reverse().map(mapMessage);

  if (messages.length > 0) {
    const messageIds = messages.map(m => m.id);
    const [reactionsRows] = await pool.query(
      `SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id IN (?)`,
      [messageIds]
    );

    const reactionsByMessage = {};
    for (const r of reactionsRows) {
      if (!reactionsByMessage[r.message_id]) {
        reactionsByMessage[r.message_id] = [];
      }
      reactionsByMessage[r.message_id].push(r);
    }

    for (const msg of messages) {
      const msgReactions = reactionsByMessage[msg.id] || [];
      const emojiCounts = {};
      for (const r of msgReactions) {
        if (!emojiCounts[r.emoji]) {
          emojiCounts[r.emoji] = { count: 0, reactedByMe: false };
        }
        emojiCounts[r.emoji].count++;
        if (r.user_id === userId) {
          emojiCounts[r.emoji].reactedByMe = true;
        }
      }
      msg.reactions = Object.keys(emojiCounts).map(emoji => ({
        emoji,
        count: emojiCounts[emoji].count,
        reactedByMe: emojiCounts[emoji].reactedByMe
      }));
    }
  }

  return messages;
}

async function createMessage(conversationId, senderId, body, replyToMessageId = null) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, senderId);

  let validReplyTo = null;
  const rId = normalizeOptionalPositiveId(replyToMessageId, 'replyToMessageId');
  if (rId) {
      const [rRows] = await pool.query(
        'SELECT id, conversation_id, message_type FROM messages WHERE id = ? AND deleted_at IS NULL',
        [rId]
      );
      if (!rRows.length || rRows[0].conversation_id !== id || rRows[0].message_type === 'system') {
        const error = new Error('Tin nhắn phản hồi không hợp lệ hoặc không thuộc cuộc trò chuyện này');
        error.statusCode = 400;
        throw error;
      }
      validReplyTo = rId;
  }

  const cleanBody = sanitizeBody(body);
  if (!cleanBody) {
    const error = new Error('Nội dung tin nhắn không được để trống');
    error.statusCode = 400;
    throw error;
  }
  if (cleanBody.length > MAX_MESSAGE_LENGTH) {
    const error = new Error(`Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự`);
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, body, message_type, reply_to_message_id)
     VALUES (?, ?, ?, 'text', ?)`,
    [id, senderId, cleanBody, validReplyTo]
  );
  await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [id]);

  const [rows] = await pool.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.display_name AS sender_display_name,
       u.avatar_url AS sender_avatar_url,
       m.reply_to_message_id,
       m.body,
       m.message_type,
       m.shared_song_id,
       ss.id AS shared_song_id,
       ss.title AS shared_song_title,
       ss.artist_id AS shared_song_artist_id,
       a.name AS shared_song_artist,
       ss.cover_url AS shared_song_cover_url,
       ss.audio_url AS shared_song_audio_url,
       ss.duration_sec AS shared_song_duration_sec,
       m.shared_playlist_id,
       spl.name AS shared_playlist_title,
       spl.description AS shared_playlist_subtitle,
       COALESCE(spl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = spl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS shared_playlist_cover_url,
       m.shared_album_id,
       sal.title AS shared_album_title,
       sal_a.name AS shared_album_artist,
       COALESCE(sal.cover_url, (SELECT cover_url FROM songs WHERE album_id = sal.id AND cover_url IS NOT NULL LIMIT 1)) AS shared_album_cover_url,
       m.shared_artist_id,
       sar.name AS shared_artist_name,
       sar.avatar_url AS shared_artist_avatar_url,
       m.created_at,
       m.deleted_at,
       rm.id AS reply_id,
       rm.body AS reply_body,
       rm.message_type AS reply_type,
       rm.deleted_at AS reply_deleted_at,
       ru.display_name AS reply_sender_display_name,
       rss.id AS reply_song_id,
       rss.title AS reply_song_title,
       rss.cover_url AS reply_song_cover_url,
       rsa.name AS reply_song_artist_name,
       rspl.id AS reply_playlist_id,
       rspl.name AS reply_playlist_title,
       COALESCE(rspl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = rspl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS reply_playlist_cover_url,
       rsal.id AS reply_album_id,
       rsal.title AS reply_album_title,
       COALESCE(rsal.cover_url, (SELECT cover_url FROM songs WHERE album_id = rsal.id AND cover_url IS NOT NULL LIMIT 1)) AS reply_album_cover_url,
       rsar.id AS reply_artist_id,
       rsar.name AS reply_artist_name,
       rsar.avatar_url AS reply_artist_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists a ON a.id = ss.artist_id
     LEFT JOIN playlists spl ON spl.id = m.shared_playlist_id
     LEFT JOIN albums sal ON sal.id = m.shared_album_id
     LEFT JOIN artists sal_a ON sal_a.id = sal.artist_id
     LEFT JOIN artists sar ON sar.id = m.shared_artist_id
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.sender_id = ru.id
     LEFT JOIN songs rss ON rm.shared_song_id = rss.id
     LEFT JOIN artists rsa ON rss.artist_id = rsa.id
     LEFT JOIN playlists rspl ON rspl.id = rm.shared_playlist_id
     LEFT JOIN albums rsal ON rsal.id = rm.shared_album_id
     LEFT JOIN artists rsar ON rsar.id = rm.shared_artist_id
     WHERE m.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  const msg = mapMessage(rows[0]);
  msg.reactions = [];
  return msg;
}

async function shareEntity(conversationId, senderId, { type, entityId, body = '', replyToMessageId = null }) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, senderId);

  let entity = null;
  let messageType = '';
  let entityColumn = '';

  if (type === 'song') {
    entity = await getShareableSong(entityId);
    messageType = 'song_share';
    entityColumn = 'shared_song_id';
  } else if (type === 'playlist') {
    entity = await getShareablePlaylist(entityId, senderId);
    messageType = 'playlist_share';
    entityColumn = 'shared_playlist_id';
  } else if (type === 'album') {
    entity = await getShareableAlbum(entityId);
    messageType = 'album_share';
    entityColumn = 'shared_album_id';
  } else if (type === 'artist') {
    entity = await getShareableArtist(entityId);
    messageType = 'artist_share';
    entityColumn = 'shared_artist_id';
  } else {
    const error = new Error('Loại chia sẻ không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  const cleanBody = sanitizeBody(body) || `Đã chia sẻ: ${entity.title}`;
  let validReplyTo = null;

  const rId = normalizeOptionalPositiveId(replyToMessageId, 'replyToMessageId');
  if (rId) {
      const [rRows] = await pool.query(
        'SELECT id, conversation_id FROM messages WHERE id = ? AND deleted_at IS NULL',
        [rId]
      );
      if (!rRows.length || rRows[0].conversation_id !== id) {
        const error = new Error('Tin nhắn phản hồi không hợp lệ hoặc không thuộc cuộc trò chuyện này');
        error.statusCode = 400;
        throw error;
      }
      validReplyTo = rId;
  }

  const [result] = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, body, message_type, ${entityColumn}, reply_to_message_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, senderId, cleanBody, messageType, entity.id, validReplyTo]
  );
  await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [id]);

  const messages = await listMessages(id, senderId, { limit: 1, before: result.insertId + 1 });
  return messages[messages.length - 1];
}

async function createSongShareMessage(conversationId, senderId, songId, body = '', replyToMessageId = null) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, senderId);
  const song = await getShareableSong(songId);
  const cleanBody = sanitizeBody(body) || `Đã chia sẻ: ${song.title}`;

  let validReplyTo = null;
  const rId = normalizeOptionalPositiveId(replyToMessageId, 'replyToMessageId');
  if (rId) {
      const [rRows] = await pool.query(
        'SELECT id, conversation_id, message_type FROM messages WHERE id = ? AND deleted_at IS NULL',
        [rId]
      );
      if (!rRows.length || rRows[0].conversation_id !== id || rRows[0].message_type === 'system') {
        const error = new Error('Tin nhắn phản hồi không hợp lệ hoặc không thuộc cuộc trò chuyện này');
        error.statusCode = 400;
        throw error;
      }
      validReplyTo = rId;
  }

  const [result] = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, body, message_type, shared_song_id, reply_to_message_id)
     VALUES (?, ?, ?, 'song_share', ?, ?)`,
    [id, senderId, cleanBody, song.id, validReplyTo]
  );
  await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [id]);

  const messages = await listMessages(id, senderId, { limit: 1, before: result.insertId + 1 });
  return messages[messages.length - 1];
}

async function shareSongToUser(senderId, recipientUserId, songId, body = '', replyToMessageId = null) {
  const conversation = await getOrCreateDirectConversation(senderId, recipientUserId);
  const message = await createSongShareMessage(conversation.conversation_id, senderId, songId, body, replyToMessageId);
  return { conversation, conversationId: conversation.conversation_id, message };
}

async function shareEntityToUser(senderId, recipientUserId, { type, entityId, body = '', replyToMessageId = null }) {
  const conversation = await getOrCreateDirectConversation(senderId, recipientUserId);
  const message = await shareEntity(conversation.conversation_id, senderId, { type, entityId, body, replyToMessageId });
  return { conversation, conversationId: conversation.conversation_id, message };
}

async function markRead(conversationId, userId) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  const [latestRows] = await pool.query(
    `SELECT id FROM messages
     WHERE conversation_id = ? AND deleted_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [id]
  );

  const latestId = latestRows[0]?.id || null;
  await pool.query(
    `UPDATE conversation_participants
     SET last_read_message_id = ?
     WHERE conversation_id = ? AND user_id = ?`,
    [latestId, id, userId]
  );

  return { conversation_id: id, user_id: userId, last_read_message_id: latestId };
}

async function searchUsers(currentUserId, query) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];
  if (q.length > MAX_USER_SEARCH_QUERY_LENGTH) {
    const error = new Error(`Tu khoa tim kiem khong duoc vuot qua ${MAX_USER_SEARCH_QUERY_LENGTH} ky tu`);
    error.statusCode = 400;
    throw error;
  }

  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, display_name, email, avatar_url
     FROM users
     WHERE id <> ?
       AND status = "active"
       AND role = "user"
       AND (display_name LIKE ? OR email LIKE ?)
     ORDER BY display_name ASC
     LIMIT 20`,
    [currentUserId, like, like]
  );

  return rows.map((row) => ({
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    avatar_url: row.avatar_url,
  }));
}

async function deleteMessage(conversationId, messageId, userId) {
  const cId = normalizeConversationId(conversationId);
  await assertParticipant(cId, userId);
  const [result] = await pool.query(
    'UPDATE messages SET deleted_at = NOW() WHERE id = ? AND conversation_id = ? AND sender_id = ? AND deleted_at IS NULL',
    [messageId, cId, userId]
  );
  if (result.affectedRows === 0) {
    const error = new Error('Không tìm thấy tin nhắn hoặc bạn không có quyền thu hồi');
    error.statusCode = 403;
    throw error;
  }
  return { conversation_id: cId, message_id: Number(messageId) };
}

async function toggleReaction(messageId, userId, emoji) {
  const allowedEmojis = ['❤️', '🔥', '🎧', '😍', '👏', '🎵'];
  if (!allowedEmojis.includes(emoji)) {
    const err = new Error('Emoji không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  // Check if message exists and user is participant
  const [msgRows] = await pool.query(
    'SELECT conversation_id, message_type FROM messages WHERE id = ? AND deleted_at IS NULL',
    [messageId]
  );
  if (!msgRows.length) {
    const err = new Error('Không tìm thấy tin nhắn');
    err.statusCode = 404;
    throw err;
  }
  if (msgRows[0].message_type === 'system') {
    const err = new Error('Không thể thả cảm xúc cho tin nhắn hệ thống');
    err.statusCode = 400;
    throw err;
  }
  const conversationId = msgRows[0].conversation_id;
  await assertParticipant(conversationId, userId);

  // Check existing reaction
  const [existing] = await pool.query(
    'SELECT id, emoji FROM message_reactions WHERE message_id = ? AND user_id = ? LIMIT 1',
    [messageId, userId]
  );

  if (existing.length > 0) {
    if (existing[0].emoji === emoji) {
      // Toggle off
      await pool.query('DELETE FROM message_reactions WHERE id = ?', [existing[0].id]);
    } else {
      // Update
      await pool.query('UPDATE message_reactions SET emoji = ? WHERE id = ?', [emoji, existing[0].id]);
    }
  } else {
    // Insert
    await pool.query(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
      [messageId, userId, emoji]
    );
  }

  // Fetch updated reactions
  const [reactionsRows] = await pool.query(
    'SELECT emoji, user_id FROM message_reactions WHERE message_id = ?',
    [messageId]
  );

  const emojiCounts = {};
  for (const r of reactionsRows) {
    if (!emojiCounts[r.emoji]) {
      emojiCounts[r.emoji] = { count: 0, reactedByMe: false };
    }
    emojiCounts[r.emoji].count++;
    if (r.user_id === userId) {
      emojiCounts[r.emoji].reactedByMe = true;
    }
  }
  
  const reactions = Object.keys(emojiCounts).map(e => ({
    emoji: e,
    count: emojiCounts[e].count,
    reactedByMe: emojiCounts[e].reactedByMe
  }));

  return { conversationId, messageId, reactions };
}

async function searchConversationMessages(conversationId, userId, q, { limit = 20, cursor = null } = {}) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  
  const escapedQ = String(q).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const like = `%${escapedQ}%`;

  const params = [id, like, like, like, like, like, like, like];
  let cursorClause = '';
  
  const cursorId = Number(cursor);
  if (Number.isInteger(cursorId) && cursorId > 0) {
    cursorClause = 'AND m.id < ?';
    params.push(cursorId);
  }
  
  params.push(safeLimit);

  const [rows] = await pool.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.display_name AS sender_display_name,
       u.avatar_url AS sender_avatar_url,
       m.body,
       m.message_type,
       m.created_at,
       ss.id AS song_id,
       ss.title AS song_title,
       a.name AS song_artist_name,
       ss.cover_url AS song_cover_url,
       spl.name AS playlist_title,
       COALESCE(spl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = spl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS playlist_cover_url,
       sal.title AS album_title,
       sal_a.name AS album_artist_name,
       COALESCE(sal.cover_url, (SELECT cover_url FROM songs WHERE album_id = sal.id AND cover_url IS NOT NULL LIMIT 1)) AS album_cover_url,
       sar.name AS artist_name,
       sar.avatar_url AS artist_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists a ON a.id = ss.artist_id
     LEFT JOIN playlists spl ON spl.id = m.shared_playlist_id
     LEFT JOIN albums sal ON sal.id = m.shared_album_id
     LEFT JOIN artists sal_a ON sal_a.id = sal.artist_id
     LEFT JOIN artists sar ON sar.id = m.shared_artist_id
     WHERE m.conversation_id = ?
       AND m.deleted_at IS NULL
       AND (
         (m.message_type = 'text' AND m.body LIKE ?) OR
         (m.message_type = 'song_share' AND (ss.title LIKE ? OR a.name LIKE ?)) OR
         (m.message_type = 'playlist_share' AND spl.name LIKE ?) OR
         (m.message_type = 'album_share' AND (sal.title LIKE ? OR sal_a.name LIKE ?)) OR
         (m.message_type = 'artist_share' AND sar.name LIKE ?)
       )
       ${cursorClause}
     ORDER BY m.id DESC
     LIMIT ?`,
    params
  );

  const items = rows.map(row => {
    let matched_type = 'text';
    if (row.message_type === 'song_share') {
      matched_type = 'song';
    } else if (row.message_type === 'playlist_share') {
      matched_type = 'playlist';
    } else if (row.message_type === 'album_share') {
      matched_type = 'album';
    } else if (row.message_type === 'artist_share') {
      matched_type = 'artist';
    }

    const item = {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      sender_name: row.sender_display_name,
      sender_avatar: row.sender_avatar_url,
      message_type: row.message_type,
      body: row.body,
      created_at: row.created_at,
      matched_type
    };

    if (row.message_type === 'song_share' && row.song_id) {
      item.song = {
        id: row.song_id,
        title: row.song_title,
        artist_name: row.song_artist_name,
        cover_url: row.song_cover_url
      };
    } else if (row.message_type === 'playlist_share') {
      item.playlist = { title: row.playlist_title, cover_url: row.playlist_cover_url };
    } else if (row.message_type === 'album_share') {
      item.album = { title: row.album_title, artist_name: row.album_artist_name, cover_url: row.album_cover_url };
    } else if (row.message_type === 'artist_share') {
      item.artist = { name: row.artist_name, avatar_url: row.artist_avatar_url };
    }

    return item;
  });

  let nextCursor = null;
  if (items.length === safeLimit) {
    nextCursor = items[items.length - 1].id;
  }

  return { items, nextCursor };
}

async function getConversationPin(conversationId, userId) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  const [rows] = await pool.query(
    `SELECT cp.id as pin_id, cp.conversation_id as pin_conversation_id, cp.message_id as pin_message_id, cp.pinned_by, cp.created_at as pin_created_at,
       pu.display_name AS pinned_by_name,
       m.id,
       m.conversation_id,
       m.sender_id,
       u.display_name AS sender_display_name,
       u.avatar_url AS sender_avatar_url,
       m.reply_to_message_id,
       m.body,
       m.message_type,
       m.shared_song_id,
       ss.id AS shared_song_id,
       ss.title AS shared_song_title,
       ss.artist_id AS shared_song_artist_id,
       a.name AS shared_song_artist,
       ss.cover_url AS shared_song_cover_url,
       ss.audio_url AS shared_song_audio_url,
       ss.duration_sec AS shared_song_duration_sec,
       m.shared_playlist_id,
       spl.name AS shared_playlist_title,
       spl.description AS shared_playlist_subtitle,
       COALESCE(spl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = spl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS shared_playlist_cover_url,
       m.shared_album_id,
       sal.title AS shared_album_title,
       sal_a.name AS shared_album_artist,
       COALESCE(sal.cover_url, (SELECT cover_url FROM songs WHERE album_id = sal.id AND cover_url IS NOT NULL LIMIT 1)) AS shared_album_cover_url,
       m.shared_artist_id,
       sar.name AS shared_artist_name,
       sar.avatar_url AS shared_artist_avatar_url,
       m.system_event_type,
       m.system_metadata,
       m.created_at,
       m.deleted_at,
       rm.id AS reply_id,
       rm.body AS reply_body,
       rm.message_type AS reply_type,
       rm.deleted_at AS reply_deleted_at,
       ru.display_name AS reply_sender_display_name,
       rss.id AS reply_song_id,
       rss.title AS reply_song_title,
       rss.cover_url AS reply_song_cover_url,
       rsa.name AS reply_song_artist_name,
       rspl.id AS reply_playlist_id,
       rspl.name AS reply_playlist_title,
       COALESCE(rspl.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = rspl.id AND s.cover_url IS NOT NULL LIMIT 1)) AS reply_playlist_cover_url,
       rsal.id AS reply_album_id,
       rsal.title AS reply_album_title,
       COALESCE(rsal.cover_url, (SELECT cover_url FROM songs WHERE album_id = rsal.id AND cover_url IS NOT NULL LIMIT 1)) AS reply_album_cover_url,
       rsar.id AS reply_artist_id,
       rsar.name AS reply_artist_name,
       rsar.avatar_url AS reply_artist_avatar_url
     FROM conversation_pins cp
     JOIN messages m ON cp.message_id = m.id
     JOIN users pu ON cp.pinned_by = pu.id
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists a ON a.id = ss.artist_id
     LEFT JOIN playlists spl ON spl.id = m.shared_playlist_id
     LEFT JOIN albums sal ON sal.id = m.shared_album_id
     LEFT JOIN artists sal_a ON sal.artist_id = sal_a.id
     LEFT JOIN artists sar ON sar.id = m.shared_artist_id
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.sender_id = ru.id
     LEFT JOIN songs rss ON rm.shared_song_id = rss.id
     LEFT JOIN artists rsa ON rss.artist_id = rsa.id
     LEFT JOIN playlists rspl ON rspl.id = rm.shared_playlist_id
     LEFT JOIN albums rsal ON rsal.id = rm.shared_album_id
     LEFT JOIN artists rsar ON rsar.id = rm.shared_artist_id
     WHERE cp.conversation_id = ?`,
    [id]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  const message = mapMessage(row);

  return {
    id: row.pin_id,
    conversation_id: row.pin_conversation_id,
    message_id: row.pin_message_id,
    pinned_by: row.pinned_by,
    pinned_by_name: row.pinned_by_name,
    created_at: row.pin_created_at,
    message
  };
}

async function pinMessage(conversationId, messageId, userId) {
  const id = normalizeConversationId(conversationId);
  const msgId = Number(messageId);
  await assertParticipant(id, userId);

  const [msgRows] = await pool.query(
    'SELECT id, deleted_at, message_type FROM messages WHERE id = ? AND conversation_id = ?',
    [msgId, id]
  );

  if (msgRows.length === 0) {
    const error = new Error('Message not found or does not belong to this conversation');
    error.statusCode = 404;
    throw error;
  }
  if (msgRows[0].deleted_at) {
    const error = new Error('Cannot pin a deleted message');
    error.statusCode = 400;
    throw error;
  }
  if (msgRows[0].message_type === 'system') {
    const error = new Error('Không thể ghim tin nhắn hệ thống');
    error.statusCode = 400;
    throw error;
  }

  await pool.query(
    `INSERT INTO conversation_pins (conversation_id, message_id, pinned_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE message_id = VALUES(message_id), pinned_by = VALUES(pinned_by)`,
    [id, msgId, userId]
  );

  return await getConversationPin(id, userId);
}

async function unpinMessage(conversationId, userId) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  await pool.query('DELETE FROM conversation_pins WHERE conversation_id = ?', [id]);
  return true;
}

async function getConversationSharedMedia(conversationId, userId, type, { limit = 30, cursor = null } = {}) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, userId);

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const queryLimit = safeLimit + 1;
  const params = [id];
  let cursorClause = '';

  const cursorId = Number(cursor);
  if (Number.isInteger(cursorId) && cursorId > 0) {
    cursorClause = 'AND m.id < ?';
    params.push(cursorId);
  }
  params.push(queryLimit);

  let rows = [];

  if (type === 'song') {
    [rows] = await pool.query(
      `SELECT m.id AS message_id, m.conversation_id, m.created_at AS shared_at, m.sender_id, u.display_name AS sender_display_name, u.avatar_url AS sender_avatar_url,
              s.id AS song_id, s.title AS song_title, a.name AS song_artist_name, s.cover_url AS song_cover_url, s.duration_sec AS song_duration
       FROM messages m
       JOIN songs s ON m.shared_song_id = s.id
       LEFT JOIN artists a ON s.artist_id = a.id
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND m.message_type = 'song_share' AND m.deleted_at IS NULL ${cursorClause}
       ORDER BY m.id DESC LIMIT ?`, params
    );
  } else if (type === 'playlist') {
    [rows] = await pool.query(
      `SELECT m.id AS message_id, m.conversation_id, m.created_at AS shared_at, m.sender_id, u.display_name AS sender_display_name, u.avatar_url AS sender_avatar_url,
              p.id AS playlist_id, p.name AS playlist_title, COALESCE(p.cover_url, (SELECT s.cover_url FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = p.id AND s.cover_url IS NOT NULL LIMIT 1)) AS playlist_cover_url
       FROM messages m
       JOIN playlists p ON m.shared_playlist_id = p.id
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND m.message_type = 'playlist_share' AND m.deleted_at IS NULL ${cursorClause}
       ORDER BY m.id DESC LIMIT ?`, params
    );
  } else if (type === 'album_artist') {
    [rows] = await pool.query(
      `SELECT m.id AS message_id, m.conversation_id, m.created_at AS shared_at, m.sender_id, u.display_name AS sender_display_name, u.avatar_url AS sender_avatar_url,
              m.message_type,
              al.id AS album_id, al.title AS album_title, COALESCE(al.cover_url, (SELECT cover_url FROM songs WHERE album_id = al.id AND cover_url IS NOT NULL LIMIT 1)) AS album_cover_url, ala.name AS album_artist_name,
              ar.id AS artist_id, ar.name AS artist_name, ar.avatar_url AS artist_avatar_url
       FROM messages m
       LEFT JOIN albums al ON m.shared_album_id = al.id
       LEFT JOIN artists ala ON al.artist_id = ala.id
       LEFT JOIN artists ar ON m.shared_artist_id = ar.id
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND m.message_type IN ('album_share', 'artist_share') AND m.deleted_at IS NULL ${cursorClause}
       ORDER BY m.id DESC LIMIT ?`, params
    );
  } else {
    return { type, items: [], nextCursor: null };
  }

  let nextCursor = null;
  const items = rows.slice(0, safeLimit).map(row => {
    const item = {
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      shared_at: row.shared_at,
      sender: { id: row.sender_id, display_name: row.sender_display_name, avatar_url: row.sender_avatar_url }
    };
    if (type === 'song') {
      item.song = { id: row.song_id, title: row.song_title, artist_name: row.song_artist_name, cover_url: row.song_cover_url, duration: row.song_duration };
    } else if (type === 'playlist') {
      item.playlist = { id: row.playlist_id, title: row.playlist_title, cover_url: row.playlist_cover_url };
    } else if (type === 'album_artist') {
      if (row.message_type === 'album_share') {
        item.album = { id: row.album_id, title: row.album_title, artist_name: row.album_artist_name, cover_url: row.album_cover_url };
      } else {
        item.artist = { id: row.artist_id, name: row.artist_name, avatar_url: row.artist_avatar_url };
      }
    }
    return item;
  });

  if (rows.length > safeLimit) {
    nextCursor = items[items.length - 1].message_id;
  }
  return { type, items, nextCursor };
}

async function createSystemMessage({ conversationId, actorUserId, eventType, body, metadata }) {
  const id = normalizeConversationId(conversationId);
  if (!id) {
    const error = new Error('Conversation ID không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  // Validate conversation exists
  const [convRows] = await pool.query('SELECT id FROM conversations WHERE id = ?', [id]);
  if (!convRows.length) {
    const error = new Error('Không tìm thấy cuộc trò chuyện');
    error.statusCode = 404;
    throw error;
  }

  let finalSenderId = null;
  if (actorUserId) {
    const uid = normalizeUserId(actorUserId);
    await assertParticipant(id, uid);
    finalSenderId = uid;
  }

  const cleanBody = sanitizeBody(body);
  const eventTypeStr = eventType ? String(eventType) : null;
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  const [result] = await pool.query(
    `INSERT INTO messages (
      conversation_id, sender_id, message_type, body, 
      system_event_type, system_metadata, created_at
    ) VALUES (?, ?, 'system', ?, ?, ?, NOW())`,
    [id, finalSenderId, cleanBody, eventTypeStr, metadataStr]
  );

  const insertedId = result.insertId;

  // Cập nhật last_message
  await pool.query(
    `UPDATE conversations 
     SET updated_at = NOW() 
     WHERE id = ?`,
    [id]
  );

  // Retrieve to map properly
  const messages = await listMessages(id, finalSenderId || -1, { limit: 1 });
  const message = messages.find(m => m.id === insertedId);
  return message;
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_USER_SEARCH_QUERY_LENGTH,
  normalizeOptionalPositiveId,
  assertParticipant,
  createMessage,
  createSongShareMessage,
  getConversationForUser,
  getOrCreateDirectConversation,
  getParticipantUserIds,
  getUnreadCount,
  listConversations,
  listMessages,
  markRead,
  searchUsers,
  shareSongToUser,
  deleteMessage,
  toggleReaction,
  searchConversationMessages,
  getConversationPin,
  pinMessage,
  unpinMessage,
  getConversationSharedMedia,
  shareEntity,
  shareEntityToUser,
  createSystemMessage,
};
