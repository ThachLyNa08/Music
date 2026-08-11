import { defineStore } from 'pinia'
import api from '@/api/axios'
import { io } from 'socket.io-client'
import { useToastStore } from '@/stores/toast'
import { SOCKET_URL } from '@/config/runtime'

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
          if (!id || id === 'undefined') {
            const noti = this.notifications.find(item => !item.id || item.id === id)
            if (noti) noti.is_read = true
            this.updateUnreadCount()
            return
          }
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

      const token = localStorage.getItem('accessToken')

      this.socket = io(SOCKET_URL, {
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
        
        // Anti-duplication: check by ID or title+message
        if (notification.id && this.notifications.some(item => item.id === notification.id)) return
        if (!notification.id && this.notifications.some(item => item.title === notification.title && item.message === notification.message)) return

        this.notifications.unshift(notification)
        this.updateUnreadCount()

        if (notification.type === 'karaoke_ready') {
          useToastStore().showToast(notification.title || 'Karaoke đã sẵn sàng', 'success')
        } else if (notification.type === 'artist_content_approved') {
          useToastStore().showToast(notification.title || 'Nội dung đã được duyệt', 'success')
          window.dispatchEvent(new CustomEvent('artist:review_status_changed'))
        } else if (notification.type === 'artist_content_rejected') {
          useToastStore().showToast(notification.title || 'Nội dung bị từ chối', 'error')
          window.dispatchEvent(new CustomEvent('artist:review_status_changed'))
        } else if (notification.type === 'new_artist_submission') {
          useToastStore().showToast(notification.title || 'Nội dung mới chờ duyệt', 'info')
          window.dispatchEvent(new CustomEvent('admin:review_updated'))
        } else if (notification.type === 'new_song' || notification.type === 'new_album') {
          useToastStore().showToast(notification.message || 'Nội dung mới từ nghệ sĩ bạn theo dõi', 'info')
        } else if (notification.priority === 'high') {
          useToastStore().showToast(notification.title || 'Thông báo mới', 'info')
        }
      }

      this.socket.on('notification:new', handleNewNotification)
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
