import { defineStore } from 'pinia'
import api from '@/api/axios'
import { io } from 'socket.io-client'
import { useToastStore } from '@/stores/toast'

function normalizeNotification(notification) {
  if (!notification) return notification
  if (typeof notification.data === 'string' && notification.data) {
    try {
      return { ...notification, data: JSON.parse(notification.data) }
    } catch {
      return { ...notification, data: null }
    }
  }
  return notification
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [],
    unreadCount: 0,
    socket: null,
    socketUserId: null
  }),
  actions: {
    async fetchNotifications() {
      try {
        const res = await api.get('/notifications')
        this.notifications = (res.data.data || []).map(normalizeNotification)
        this.updateUnreadCount()
      } catch (err) {
        console.error('Failed to fetch notifications:', err)
      }
    },
    updateUnreadCount() {
      this.unreadCount = this.notifications.filter(n => !n.is_read).length
    },
    async markAsRead(id) {
      try {
        if (id === 'all') {
          await api.put('/notifications/read-all')
          this.notifications.forEach(n => { n.is_read = true })
        } else {
          await api.put(`/notifications/${id}/read`)
          const notification = this.notifications.find(item => item.id === id)
          if (notification) notification.is_read = true
        }
        this.updateUnreadCount()
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    },
    initSocket(userId) {
      this.socketUserId = userId
      if (this.socket) {
        if (this.socket.connected && userId) {
          this.socket.emit('join', { userId })
        }
        return
      }

      const baseURL = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api'
      const socketURL = baseURL.replace('/api', '')
      const token = localStorage.getItem('accessToken')

      this.socket = io(socketURL, {
        withCredentials: true,
        auth: { token }
      })

      this.socket.on('connect', () => {
        console.log('Socket connected for notifications')
        if (this.socketUserId) {
          this.socket.emit('join', { userId: this.socketUserId })
        }
      })

      const handleNewNotification = (payload) => {
        const notification = normalizeNotification(payload)
        if (!notification) return
        if (notification.id && this.notifications.some(item => item.id === notification.id)) return

        this.notifications.unshift(notification)
        this.updateUnreadCount()

        if (notification.type === 'karaoke_ready') {
          useToastStore().showToast(notification.title || 'Karaoke đã sẵn sàng', 'success')
        }
      }

      this.socket.on('notification:new', handleNewNotification)
      this.socket.on('new_notification', handleNewNotification)
    },
    disconnectSocket() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.socketUserId = null
      }
    }
  }
})
