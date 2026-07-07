const messageService = require('../services/message.service');
const { emitChatMessage, emitConversationUpdated, emitMessageRead, emitReactionUpdated, getIo } = require('../services/socket.service');

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
