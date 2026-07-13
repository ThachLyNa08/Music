import { defineStore } from 'pinia'
import { adminArtistSongReviewsApi } from '@/api/adminArtistSongReviews'

export const useAdminNotificationStore = defineStore('adminNotification', {
  state: () => ({
    pendingReviewCount: 0,
    latestPendingItems: [],
    isLoaded: false,
    loading: false
  }),

  actions: {
    async fetchSummary() {
      if (this.loading) return
      this.loading = true
      try {
        const res = await adminArtistSongReviewsApi.getSummary()
        if (res.data.success) {
          this.pendingReviewCount = res.data.summary.pendingTotal || 0
          this.latestPendingItems = res.data.latestPending || []
          this.isLoaded = true
        }
      } catch (error) {
        console.error('Error fetching admin notification summary:', error)
      } finally {
        this.loading = false
      }
    }
  }
})
