import { defineStore } from 'pinia'
import api from '@/api/axios'
import { io } from 'socket.io-client'

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [],
    unreadCount: 0,
    socket: null
  }),
  actions: {
    async fetchNotifications() {
      try {
        const res = await api.get('/notifications')
        this.notifications = res.data.data
        this.updateUnreadCount()
      } catch (err) {
        console.error('Lỗi lấy danh sách thông báo:', err)
      }
    },
    updateUnreadCount() {
      this.unreadCount = this.notifications.filter(n => !n.is_read).length
    },
    async markAsRead(id) {
      try {
        await api.put(`/notifications/${id}/read`)
        if (id === 'all') {
          this.notifications.forEach(n => n.is_read = true)
        } else {
          const n = this.notifications.find(item => item.id === id)
          if (n) n.is_read = true
        }
        this.updateUnreadCount()
      } catch (err) {
        console.error('Lỗi khi đánh dấu đã đọc:', err)
      }
    },
    initSocket(userId) {
      if (this.socket) return

      // Use the API base URL for socket, remove /api if present
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
      const socketURL = baseURL.replace('/api', '')

      this.socket = io(socketURL, {
        withCredentials: true
      })

      this.socket.on('connect', () => {
        console.log('Socket connected for notifications')
        this.socket.emit('join', { userId })
      })

      this.socket.on('new_notification', (data) => {
        // Unshift adds to the beginning
        this.notifications.unshift(data)
        this.updateUnreadCount()
      })
    },
    disconnectSocket() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
      }
    }
  }
})
