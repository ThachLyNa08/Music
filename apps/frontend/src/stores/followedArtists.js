import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/axios'

export const useFollowedArtistsStore = defineStore('followedArtists', () => {
  const followedArtists = ref([])
  const followedArtistIds = ref(new Set())
  const followedArtistCount = ref(0)
  const loading = ref(false)
  const error = ref(null)

  // Fetch danh sách nghệ sĩ đã follow
  async function fetchFollowedArtists() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/users/me/followed-artists')
      if (res.data.success) {
        followedArtists.value = res.data.data || []
        followedArtistIds.value = new Set(res.data.data.map(a => a.id))
        followedArtistCount.value = res.data.data?.length || 0
      }
    } catch (err) {
      console.error('fetchFollowedArtists error:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Kiểm tra user có follow artist không
  function isFollowing(artistId) {
    return followedArtistIds.value.has(Number(artistId))
  }

  // Follow artist
  async function followArtist(artistId) {
    try {
      const res = await api.post(`/artists/${artistId}/follow`)
      if (res.data.success) {
        // Cập nhật local state
        if (!followedArtistIds.value.has(Number(artistId))) {
          followedArtistIds.value.add(Number(artistId))
          followedArtistCount.value++
        }
        return { success: true, ...res.data }
      }
      return { success: false }
    } catch (err) {
      console.error('followArtist error:', err)
      throw err
    }
  }

  // Unfollow artist
  async function unfollowArtist(artistId) {
    try {
      const res = await api.delete(`/artists/${artistId}/follow`)
      if (res.data.success) {
        // Cập nhật local state
        followedArtistIds.value.delete(Number(artistId))
        followedArtistCount.value = Math.max(0, followedArtistCount.value - 1)
        return { success: true, ...res.data }
      }
      return { success: false }
    } catch (err) {
      console.error('unfollowArtist error:', err)
      throw err
    }
  }

  // Xóa artist khỏi danh sách (khi unfollow)
  function removeFromList(artistId) {
    followedArtists.value = followedArtists.value.filter(a => a.id !== artistId)
    followedArtistIds.value.delete(Number(artistId))
    followedArtistCount.value = followedArtists.value.length
  }

  // Reset store
  function $reset() {
    followedArtists.value = []
    followedArtistIds.value = new Set()
    followedArtistCount.value = 0
    loading.value = false
    error.value = null
  }

  return {
    followedArtists,
    followedArtistIds,
    followedArtistCount,
    loading,
    error,
    fetchFollowedArtists,
    isFollowing,
    followArtist,
    unfollowArtist,
    removeFromList,
    $reset
  }
})
