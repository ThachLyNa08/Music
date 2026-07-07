const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');

const MAX_MESSAGE_LENGTH = 1000;

function normalizeUserId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeConversationId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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
      reply_to_message_id: row.reply_to_message_id || null,
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
       rsa.name AS reply_song_artist_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists a ON a.id = ss.artist_id
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.sender_id = ru.id
     LEFT JOIN songs rss ON rm.shared_song_id = rss.id
     LEFT JOIN artists rsa ON rss.artist_id = rsa.id
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
  if (replyToMessageId) {
    const rId = Number(replyToMessageId);
    if (Number.isInteger(rId) && rId > 0) {
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
       rsa.name AS reply_song_artist_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN songs ss ON ss.id = m.shared_song_id
     LEFT JOIN artists a ON a.id = ss.artist_id
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.sender_id = ru.id
     LEFT JOIN songs rss ON rm.shared_song_id = rss.id
     LEFT JOIN artists rsa ON rss.artist_id = rsa.id
     WHERE m.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  const msg = mapMessage(rows[0]);
  msg.reactions = [];
  return msg;
}

async function createSongShareMessage(conversationId, senderId, songId, body = '', replyToMessageId = null) {
  const id = normalizeConversationId(conversationId);
  await assertParticipant(id, senderId);
  const song = await getShareableSong(songId);
  const cleanBody = sanitizeBody(body) || `Đã chia sẻ: ${song.title}`;

  let validReplyTo = null;
  if (replyToMessageId) {
    const rId = Number(replyToMessageId);
    if (Number.isInteger(rId) && rId > 0) {
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
    'SELECT conversation_id FROM messages WHERE id = ? AND deleted_at IS NULL',
    [messageId]
  );
  if (!msgRows.length) {
    const err = new Error('Không tìm thấy tin nhắn');
    err.statusCode = 404;
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

module.exports = {
  MAX_MESSAGE_LENGTH,
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
};
