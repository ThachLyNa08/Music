import api from './axios'

export const songApi = {
  getAll: () => api.get('/songs'),
  getTrending: () => api.get('/songs/trending'),
  getRecommended: () => api.get('/songs/recommended'),
  getLiked: () => api.get('/songs/liked'),
  search: (q, limit = 10) => api.get('/songs/search', { params: { q, limit } }),
  getSuggestions: (q) => api.get('/songs/suggestions', { params: { q } }),
  getSongDetail: (id) => api.get(`/songs/${id}/detail`),
  getRelatedSongs: (id, limit = 10) => api.get(`/songs/${id}/related`, { params: { limit } }),
  getAutoContinueSongs: (id, params = {}) => api.get(`/songs/${id}/auto-continue`, { params }),
  like: (songId) => api.post(`/songs/${songId}/like`),
  unlike: (songId) => api.delete(`/songs/${songId}/like`),
}
