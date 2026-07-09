const messageService = require('../services/message.service');
const listenSessionService = require('../services/listenSession.service');
const { emitChatMessage, emitConversationUpdated, emitMessageRead, emitReactionUpdated, getIo } = require('../services/socket.service');
const { pool } = require('../config/database');

function handleError(res, error, fallback = 'Server error') {
  console.error('message controller error:', error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
  });
}

exports.getConversations = async (req, res) => {
  try {
    const data = await messageService.listConversations(req.user.id);
    const io = getIo();
    if (io) {
      for (const conv of data) {
        try {
          const sockets = await io.in(`user:${conv.other_user.id}`).fetchSockets();
          conv.other_user.online = sockets.length > 0;
        } catch (err) {
          conv.other_user.online = false;
        }
      }
    }
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await messageService.getUnreadCount(req.user.id);
    res.json({ success: true, unreadCount });
  } catch (error) {
    handleError(res, error);
  }
};

exports.createDirectConversation = async (req, res) => {
  try {
    const data = await messageService.getOrCreateDirectConversation(req.user.id, req.body.userId);
    const io = getIo();
    if (io) {
      try {
        const sockets = await io.in(`user:${data.other_user.id}`).fetchSockets();
        data.other_user.online = sockets.length > 0;
      } catch (err) {
        data.other_user.online = false;
      }
    }
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getMessages = async (req, res) => {
  try {
    const data = await messageService.listMessages(req.params.id, req.user.id, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.searchMessages = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) {
      return res.json({ success: true, data: { items: [], nextCursor: null } });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;
    
    const data = await messageService.searchConversationMessages(req.params.id, req.user.id, q, { limit, cursor });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const message = await messageService.createMessage(req.params.id, req.user.id, req.body.body, req.body.replyToMessageId);
    const participants = await messageService.getParticipantUserIds(message.conversation_id);
    emitChatMessage(message.conversation_id, message, participants);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    handleError(res, error);
  }
};

exports.shareSongToConversation = async (req, res) => {
  try {
    const message = await messageService.createSongShareMessage(
      req.params.id,
      req.user.id,
      req.body.songId,
      req.body.body,
      req.body.replyToMessageId
    );
    const participants = await messageService.getParticipantUserIds(message.conversation_id);
    emitChatMessage(message.conversation_id, message, participants);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    handleError(res, error);
  }
};

exports.shareSongToUser = async (req, res) => {
  try {
    const result = await messageService.shareSongToUser(
      req.user.id,
      req.body.recipientUserId,
      req.body.songId,
      req.body.body,
      req.body.replyToMessageId
    );
    const participants = await messageService.getParticipantUserIds(result.conversationId);
    emitChatMessage(result.conversationId, result.message, participants);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

exports.markRead = async (req, res) => {
  try {
    const data = await messageService.markRead(req.params.id, req.user.id);
    emitMessageRead(data.conversation_id, data);
    emitConversationUpdated(data.conversation_id, await messageService.getParticipantUserIds(data.conversation_id));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const data = await messageService.searchUsers(req.user.id, req.query.q);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.toggleReaction = async (req, res) => {
  try {
    const data = await messageService.toggleReaction(req.params.messageId, req.user.id, req.body.emoji);
    if (data.conversationId) {
      emitReactionUpdated(data.conversationId, data.messageId, data.reactions, req.user.id);
    }
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const data = await messageService.deleteMessage(req.params.id, req.params.messageId, req.user.id);
    
    // We should emit chat:message_deleted here
    const { emitChatMessageDeleted } = require('../services/socket.service');
    const participants = await messageService.getParticipantUserIds(data.conversation_id);
    if (emitChatMessageDeleted) {
      emitChatMessageDeleted(data.conversation_id, data.message_id, participants);
    }
    
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getConversationPin = async (req, res) => {
  try {
    const data = await messageService.getConversationPin(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.pinMessage = async (req, res) => {
  try {
    const data = await messageService.pinMessage(req.params.id, req.body.messageId, req.user.id);
    const { emitConversationPinUpdated, emitChatMessage } = require('../services/socket.service');
    if (emitConversationPinUpdated) {
      emitConversationPinUpdated(data.conversation_id, data);
    }
    
    const [userRows] = await pool.query('SELECT display_name FROM users WHERE id = ?', [req.user.id]);
    const displayName = userRows.length > 0 && userRows[0].display_name ? userRows[0].display_name : 'Ai đó';

    // Create system message
    let bodyText = `${displayName} đã ghim một tin nhắn`;
    if (data.message) {
      const type = data.message.message_type;
      if (type === 'song_share') bodyText = `${displayName} đã ghim một bài hát`;
      else if (type === 'playlist_share') bodyText = `${displayName} đã ghim một playlist`;
      else if (type === 'album_share') bodyText = `${displayName} đã ghim một album`;
      else if (type === 'artist_share') bodyText = `${displayName} đã ghim một nghệ sĩ`;
    }
    const sysMessage = await messageService.createSystemMessage({
      conversationId: req.params.id,
      actorUserId: req.user.id,
      eventType: 'message_pinned',
      body: bodyText,
      metadata: { message_id: req.body.messageId }
    });
    const participants = await messageService.getParticipantUserIds(req.params.id);
    if (emitChatMessage) emitChatMessage(req.params.id, sysMessage, participants);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.unpinMessage = async (req, res) => {
  try {
    await messageService.unpinMessage(req.params.id, req.user.id);
    const { emitConversationPinUpdated } = require('../services/socket.service');
    if (emitConversationPinUpdated) {
      emitConversationPinUpdated(req.params.id, null);
    }
    res.json({ success: true, data: null });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getConversationSharedMedia = async (req, res) => {
  try {
    const type = req.query.type || 'song';
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;
    
    const data = await messageService.getConversationSharedMedia(
      req.params.id,
      req.user.id,
      type,
      { limit, cursor }
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.shareEntityToConversation = async (req, res) => {
  try {
    const { type, entityId, body, replyToMessageId } = req.body;
    if (!type || !entityId) {
      return res.status(400).json({ success: false, message: 'Type and entityId are required' });
    }
    
    const message = await messageService.shareEntity(req.params.id, req.user.id, {
      type,
      entityId,
      body,
      replyToMessageId
    });

    const participants = await messageService.getParticipantUserIds(message.conversation_id);
    emitChatMessage(message.conversation_id, message, participants);

    res.json({ success: true, data: message });
  } catch (error) {
    handleError(res, error);
  }
};

exports.shareEntityToUser = async (req, res) => {
  try {
    const { type, entityId, body, replyToMessageId, recipientUserId } = req.body;
    if (!type || !entityId || !recipientUserId) {
      return res.status(400).json({ success: false, message: 'Type, entityId and recipientUserId are required' });
    }

    const data = await messageService.shareEntityToUser(req.user.id, recipientUserId, {
      type,
      entityId,
      body,
      replyToMessageId
    });

    const participants = await messageService.getParticipantUserIds(data.conversationId);
    emitConversationUpdated(data.conversationId, participants);
    emitChatMessage(data.conversationId, data.message, participants);

    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getListenSession = async (req, res) => {
  try {
    const data = await listenSessionService.getActiveSession(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.startListenSession = async (req, res) => {
  try {
    const data = await listenSessionService.startSession(req.params.id, req.user.id, req.body);
    const { getIo, emitChatMessage } = require('../services/socket.service');
    const io = getIo();
    if (io) {
      io.to(`conversation:${req.params.id}`).emit('listen_together:session_started', data);
    }
    
    const [userRows] = await pool.query('SELECT display_name FROM users WHERE id = ?', [req.user.id]);
    const displayName = userRows.length > 0 && userRows[0].display_name ? userRows[0].display_name : 'Ai đó';

    // Create system message
    const sysMessage = await messageService.createSystemMessage({
      conversationId: req.params.id,
      actorUserId: req.user.id,
      eventType: 'listen_together_started',
      body: `${displayName} đã bắt đầu phiên nghe cùng nhau`
    });
    const participants = await messageService.getParticipantUserIds(req.params.id);
    if (emitChatMessage) emitChatMessage(req.params.id, sysMessage, participants);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.joinListenSession = async (req, res) => {
  try {
    const data = await listenSessionService.getActiveSession(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên nghe chung' });
    }
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.leaveListenSession = async (req, res) => {
  try {
    // Participant leaves. For MVP, we just return success without DB updates,
    // as we don't store participant lists in MVP.
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
};

exports.endListenSession = async (req, res) => {
  try {
    await listenSessionService.endSession(req.params.id, req.user.id);
    const { getIo, emitChatMessage } = require('../services/socket.service');
    const io = getIo();
    if (io) {
      io.to(`conversation:${req.params.id}`).emit('listen_together:session_ended', { conversationId: req.params.id });
    }
    
    // Create system message
    const sysMessage = await messageService.createSystemMessage({
      conversationId: req.params.id,
      actorUserId: req.user.id,
      eventType: 'listen_together_ended',
      body: `Phiên nghe cùng nhau đã kết thúc`
    });
    const participants = await messageService.getParticipantUserIds(req.params.id);
    if (emitChatMessage) emitChatMessage(req.params.id, sysMessage, participants);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
};
