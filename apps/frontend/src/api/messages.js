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
  sendMessage(conversationId, body, replyToMessageId = null) {
    return api.post(`/messages/conversations/${conversationId}/messages`, { body, replyToMessageId })
  },
  shareSongToConversation(conversationId, songId, body, replyToMessageId = null) {
    return api.post(`/messages/conversations/${conversationId}/share-song`, { songId, body, replyToMessageId })
  },
  shareSongToUser(recipientUserId, songId, body, replyToMessageId = null) {
    return api.post('/messages/share-song', { recipientUserId, songId, body, replyToMessageId })
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
}
