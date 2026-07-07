import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import api from '@/api/axios'
import { messagesApi } from '@/api/messages'

function getSocketURL() {
  const baseURL = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api'
  return baseURL.replace(/\/api\/?$/, '')
}

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    unreadCount: 0,
    socket: null,
    socketUserId: null,
  }),
  actions: {
    async fetchUnreadCount() {
      try {
        const { data } = await messagesApi.getUnreadCount()
        this.setUnreadCount(data?.unreadCount || 0)
      } catch (err) {
        console.error('Failed to fetch message unread count:', err)
      }
    },
    refreshUnreadCount() {
      return this.fetchUnreadCount()
    },
    setUnreadCount(count) {
      const next = Number(count)
      this.unreadCount = Number.isFinite(next) && next > 0 ? next : 0
    },
    incrementUnreadCount(amount = 1) {
      const next = Number(amount)
      if (!Number.isFinite(next) || next <= 0) return
      this.unreadCount += next
    },
    initSocket(userId) {
      this.socketUserId = userId
      if (this.socket) {
        if (this.socket.connected && userId) {
          this.socket.emit('join', { userId })
        }
        return
      }

      const token = localStorage.getItem('accessToken')
      this.socket = io(getSocketURL(), {
        withCredentials: true,
        auth: { token },
      })

      this.socket.on('connect', () => {
        if (this.socketUserId) {
          this.socket.emit('join', { userId: this.socketUserId })
        }
      })

      this.socket.on('chat:conversation_updated', (payload) => {
        if (typeof payload?.totalUnreadCount === 'number') {
          this.setUnreadCount(payload.totalUnreadCount)
          return
        }
        this.refreshUnreadCount()
      })
    },
    disconnectSocket() {
      if (this.socket) {
        this.socket.off('chat:conversation_updated')
        this.socket.disconnect()
        this.socket = null
      }
      this.socketUserId = null
      this.unreadCount = 0
    },
  },
})
