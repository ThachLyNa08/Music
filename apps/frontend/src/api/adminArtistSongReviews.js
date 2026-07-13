import api from './axios'

export const adminArtistSongReviewsApi = {
  getSummary: () => api.get('/admin/artist-song-reviews/summary'),
  getReviews: (params) => api.get('/admin/artist-song-reviews', { params }),
  getReviewDetail: (songId) => api.get(`/admin/artist-song-reviews/${songId}`),
  approveSong: (songId) => api.post(`/admin/artist-song-reviews/${songId}/approve`),
  rejectSong: (songId, reason) => api.post(`/admin/artist-song-reviews/${songId}/reject`, { reason })
}
