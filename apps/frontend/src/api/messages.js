import api from '@/api/axios'

export const messagesApi = {
  getConversations() {
    return api.get('/messages/conversations')
  },
  getUnreadCount() {
    return api.get('/messages/unread-count')
  },
  createDirectConversation(userId) {
    return api.post('/messages/conversations/direct', { userId })
  },
  getMessages(conversationId, params = {}) {
    return api.get(`/messages/conversations/${conversationId}/messages`, { params })
  },
  searchConversationMessages(conversationId, params = {}) {
    return api.get(`/messages/conversations/${conversationId}/search`, { params })
  },
  getConversationPin(conversationId) {
    return api.get(`/messages/conversations/${conversationId}/pin`)
  },
  pinMessage(conversationId, messageId) {
    return api.post(`/messages/conversations/${conversationId}/pin`, { messageId })
  },
  unpinConversationMessage(conversationId) {
    return api.delete(`/messages/conversations/${conversationId}/pin`)
  },
  getConversationSharedMedia(conversationId, params = {}) {
    return api.get(`/messages/conversations/${conversationId}/shared-media`, { params })
  },
  sendMessage(conversationId, body, replyToMessageId = null) {
    return api.post(`/messages/conversations/${conversationId}/messages`, { body, replyToMessageId })
  },
  shareSongToConversation(conversationId, songId, body = '', replyToMessageId = null) {
    return api.post(`/messages/conversations/${conversationId}/share-song`, { songId, body, replyToMessageId })
  },
  shareEntityToConversation(conversationId, type, entityId, body = '', replyToMessageId = null) {
    return api.post(`/messages/conversations/${conversationId}/share`, { type, entityId, body, replyToMessageId })
  },
  shareSongToUser(recipientUserId, songId, body = '', replyToMessageId = null) {
    return api.post('/messages/share-song', { recipientUserId, songId, body, replyToMessageId })
  },
  shareEntityToUser(recipientUserId, type, entityId, body = '', replyToMessageId = null) {
    return api.post('/messages/share', { recipientUserId, type, entityId, body, replyToMessageId })
  },
  toggleReaction(messageId, emoji) {
    return api.post(`/messages/${messageId}/reactions`, { emoji })
  },
  markRead(conversationId) {
    return api.post(`/messages/conversations/${conversationId}/read`)
  },
  deleteMessage(conversationId, messageId) {
    return api.delete(`/messages/conversations/${conversationId}/messages/${messageId}`)
  },
  searchUsers(q) {
    return api.get('/messages/users/search', { params: { q } })
  },
  getListenSession(conversationId) {
    return api.get(`/messages/conversations/${conversationId}/listen-session`)
  },
  startListenSession(conversationId, payload) {
    return api.post(`/messages/conversations/${conversationId}/listen-session/start`, payload)
  },
  joinListenSession(conversationId) {
    return api.post(`/messages/conversations/${conversationId}/listen-session/join`)
  },
  leaveListenSession(conversationId) {
    return api.post(`/messages/conversations/${conversationId}/listen-session/leave`)
  },
  endListenSession(conversationId) {
    return api.post(`/messages/conversations/${conversationId}/listen-session/end`)
  },
}
