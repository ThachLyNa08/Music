import api from './axios'

export const adminArtistSongReviewsApi = {
  getSummary: () => api.get('/admin/artist-song-reviews/summary'),
  getReviews: (params) => api.get('/admin/artist-song-reviews', { params }),
  getReviewDetail: (songId) => api.get(`/admin/artist-song-reviews/${songId}`),
  approveSong: (songId) => api.post(`/admin/artist-song-reviews/${songId}/approve`),
  rejectSong: (songId, reason, allowResubmit) => api.post(`/admin/artist-song-reviews/${songId}/reject`, { reason, allowResubmit }),
  bulkApproveSongs: (ids) => api.post('/admin/artist-song-reviews/bulk-approve', { ids }),
  bulkRejectSongs: (payload) => api.post('/admin/artist-song-reviews/bulk-reject', typeof payload === 'object' && !Array.isArray(payload) ? payload : { ids: payload })
}
