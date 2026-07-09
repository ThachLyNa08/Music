const jwt = require('jsonwebtoken');
const messageService = require('./message.service');
const listenSessionService = require('./listenSession.service');

let ioInstance;
const nowPlayingMap = new Map();
const typingMap = new Map(); // userId -> Set of conversationIds

function joinUserRoom(socket, userId) {
  if (!userId) return;
  socket.join(`user:${userId}`);
  socket.data.userId = userId;
  console.log(`Socket ${socket.id} joined user:${userId}`);
  if (ioInstance) {
    ioInstance.emit('user:presence_changed', { userId, online: true, lastSeenAt: null });
  }
}

function registerSocketEvents(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        joinUserRoom(socket, payload.id);
      } catch (err) {
        console.warn(`Socket auth failed: ${err.message}`);
      }
    }

    socket.on('join', ({ userId }) => {
      if (socket.data.userId && Number(socket.data.userId) !== Number(userId)) {
        socket.emit('chat:error', { message: 'Không thể tham gia room của người dùng khác' });
        return;
      }
      joinUserRoom(socket, userId);
    });

    socket.on('chat:join', async ({ conversationId } = {}) => {
      try {
        if (!socket.data.userId) {
          socket.emit('chat:error', { message: 'Bạn cần đăng nhập để dùng chat' });
          return;
        }
        await messageService.assertParticipant(conversationId, socket.data.userId);
        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        socket.emit('chat:error', { message: err.message || 'Không thể tham gia cuộc trò chuyện' });
      }
    });

    socket.on('chat:leave', ({ conversationId } = {}) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    socket.on('chat:send_message', async ({ conversationId, body, replyToMessageId } = {}, callback) => {
      try {
        if (!socket.data.userId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Bạn cần đăng nhập để gửi tin nhắn' });
          else socket.emit('chat:error', { message: 'Bạn cần đăng nhập để gửi tin nhắn' });
          return;
        }
        const message = await messageService.createMessage(conversationId, socket.data.userId, body, replyToMessageId);
        const participants = await messageService.getParticipantUserIds(message.conversation_id);
        emitChatMessage(message.conversation_id, message, participants);
        
        if (typeof callback === 'function') callback({ success: true, message });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message || 'Không thể gửi tin nhắn' });
        else socket.emit('chat:error', { message: err.message || 'Không thể gửi tin nhắn' });
      }
    });

    socket.on('chat:mark_read', async ({ conversationId } = {}) => {
      try {
        if (!socket.data.userId) {
          socket.emit('chat:error', { message: 'Bạn cần đăng nhập để đánh dấu đã đọc' });
          return;
        }
        const payload = await messageService.markRead(conversationId, socket.data.userId);
        emitMessageRead(payload.conversation_id, payload);
        const participants = await messageService.getParticipantUserIds(payload.conversation_id);
        emitConversationUpdated(payload.conversation_id, participants);
      } catch (err) {
        socket.emit('chat:error', { message: err.message || 'Không thể đánh dấu đã đọc' });
      }
    });

    socket.on('chat:now_playing:update', (payload) => {
      const userId = socket.data.userId;
      if (!userId) return;
      const data = {
        song: payload.song ? {
          id: payload.song.id,
          title: payload.song.title,
          artist_name: payload.song.artist_name || payload.song.artist,
          cover_url: payload.song.cover_url,
          duration: payload.song.duration
        } : null,
        isPlaying: payload.isPlaying,
        position: payload.position,
        updatedAt: Date.now(),
        userId
      };
      nowPlayingMap.set(userId, data);

      for (const room of socket.rooms) {
        if (room.startsWith('conversation:')) {
          const conversationId = room.replace('conversation:', '');
          socket.to(room).emit('chat:now_playing:state_updated', {
            conversationId: Number(conversationId),
            ...data
          });
        }
      }
    });

    socket.on('chat:now_playing:get', async ({ conversationId } = {}) => {
      try {
        const userId = socket.data.userId;
        if (!userId || !conversationId) return;
        const participants = await messageService.getParticipantUserIds(conversationId);
        if (!participants.includes(userId)) return;
        const users = participants.map(id => nowPlayingMap.get(id)).filter(Boolean);
        socket.emit('chat:now_playing:state', { conversationId: Number(conversationId), users });
      } catch (err) {
        console.warn('chat:now_playing:get error:', err);
      }
    });

    socket.on('listen_together:control', async (payload) => {
      try {
        const userId = socket.data.userId;
        if (!userId || !payload.conversationId) return;
        
        const updatedSession = await listenSessionService.updateSessionControl(
          payload.conversationId, 
          userId, 
          payload
        );

        socket.to(`conversation:${payload.conversationId}`).emit('listen_together:control_updated', {
          conversationId: payload.conversationId,
          session: updatedSession,
          action: payload.action,
          clientTimestamp: payload.clientTimestamp
        });
      } catch (err) {
        console.warn('listen_together:control error:', err);
      }
    });

    socket.on('chat:typing:start', async ({ conversationId } = {}) => {
      try {
        const userId = socket.data.userId;
        if (!userId || !conversationId) return;
        
        await messageService.assertParticipant(conversationId, userId);
        
        let userTypingSet = typingMap.get(userId);
        if (!userTypingSet) {
          userTypingSet = new Set();
          typingMap.set(userId, userTypingSet);
        }
        userTypingSet.add(conversationId);

        socket.to(`conversation:${conversationId}`).emit('chat:typing:update', {
          conversationId: Number(conversationId),
          userId,
          isTyping: true,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn('chat:typing:start error:', err.message);
      }
    });

    socket.on('chat:typing:stop', async ({ conversationId } = {}) => {
      try {
        const userId = socket.data.userId;
        if (!userId || !conversationId) return;
        
        const userTypingSet = typingMap.get(userId);
        if (userTypingSet) {
          userTypingSet.delete(conversationId);
        }

        socket.to(`conversation:${conversationId}`).emit('chat:typing:update', {
          conversationId: Number(conversationId),
          userId,
          isTyping: false,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn('chat:typing:stop error:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.data.userId && ioInstance) {
        try {
          const sockets = await ioInstance.in(`user:${socket.data.userId}`).fetchSockets();
          if (sockets.length === 0) {
            ioInstance.emit('user:presence_changed', { 
              userId: socket.data.userId, 
              online: false, 
              lastSeenAt: new Date().toISOString() 
            });

            const np = nowPlayingMap.get(socket.data.userId);
            if (np) {
              np.isPlaying = false;
              np.updatedAt = Date.now();
              nowPlayingMap.set(socket.data.userId, np);

              const conversations = await messageService.listConversations(socket.data.userId);
              for (const conv of conversations) {
                ioInstance.to(`conversation:${conv.conversation_id}`).emit('chat:now_playing:state_updated', {
                  conversationId: conv.conversation_id,
                  ...np
                });
              }
            }
            
            // Listen Together MVP: End session if host disconnects and has no more sockets
            const endedConvIds = await listenSessionService.endSessionsByHost(socket.data.userId);
            for (const cId of endedConvIds) {
              ioInstance.to(`conversation:${cId}`).emit('listen_together:session_ended', { conversationId: cId });
              
              // Create system message
              const sysMessage = await messageService.createSystemMessage({
                conversationId: cId,
                actorUserId: socket.data.userId,
                eventType: 'listen_together_ended',
                body: `Phiên nghe cùng nhau đã kết thúc`
              });
              const participants = await messageService.getParticipantUserIds(cId);
              emitChatMessage(cId, sysMessage, participants);
            }

            // Typing indicator: stop typing on disconnect
            const userTypingSet = typingMap.get(socket.data.userId);
            if (userTypingSet) {
              for (const cId of userTypingSet) {
                ioInstance.to(`conversation:${cId}`).emit('chat:typing:update', {
                  conversationId: Number(cId),
                  userId: socket.data.userId,
                  isTyping: false,
                  updatedAt: Date.now()
                });
              }
              typingMap.delete(socket.data.userId);
            }
          }
        } catch (err) {
          console.error('Error fetching sockets on disconnect', err);
        }
      }
    });
  });
}

function notifyUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

async function emitConversationUpdated(conversationId, participantIds = null) {
  const io = getIo();
  if (!io) return;

  const ids = participantIds || await messageService.getParticipantUserIds(conversationId);
  await Promise.all(ids.map(async (userId) => {
    const conversation = await messageService.getConversationForUser(conversationId, userId);
    if (conversation) {
      try {
        const sockets = await io.in(`user:${conversation.other_user.id}`).fetchSockets();
        conversation.other_user.online = sockets.length > 0;
      } catch (err) {
        conversation.other_user.online = false;
      }
      const totalUnreadCount = await messageService.getUnreadCount(userId);
      io.to(`user:${userId}`).emit('chat:conversation_updated', {
        ...conversation,
        conversationId: conversation.conversation_id,
        unreadCount: conversation.unread_count,
        totalUnreadCount,
      });
    }
  }));
}

function emitMessageRead(conversationId, payload) {
  const io = getIo();
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('chat:message_read', payload);
}

function emitChatMessage(conversationId, message, participantIds = null) {
  const io = getIo();
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('chat:new_message', message);
  emitConversationUpdated(conversationId, participantIds).catch((err) => {
    console.error('emitConversationUpdated error:', err);
  });
}

function getIo() {
  return ioInstance;
}

function emitChatMessageDeleted(conversationId, messageId, participantIds = null) {
  const io = getIo();
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('chat:message_deleted', { conversationId, messageId });
  emitConversationUpdated(conversationId, participantIds).catch((err) => {
    console.error('emitConversationUpdated error:', err);
  });
}

function emitReactionUpdated(conversationId, messageId, reactions, actorUserId) {
  const io = getIo();
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('chat:reaction_updated', {
    conversationId,
    messageId,
    reactions,
    actorUserId
  });
}

function emitConversationPinUpdated(conversationId, pin) {
  const io = getIo();
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('chat:conversation_pin_updated', { conversationId, pin });
}

module.exports = {
  registerSocketEvents,
  notifyUser,
  getIo,
  emitChatMessage,
  emitConversationUpdated,
  emitMessageRead,
  emitChatMessageDeleted,
  emitReactionUpdated,
  emitConversationPinUpdated,
};
