import api from './axios'

export const artistApi = {
  getAll: (params) => api.get('/artists', { params }),
  getById: (id) => api.get(`/artists/${id}`),
  
  // Follow/Unfollow APIs
  followArtist: (artistId) => api.post(`/artists/${artistId}/follow`),
  unfollowArtist: (artistId) => api.delete(`/artists/${artistId}/follow`),
  
  // Get followed artists list
  getFollowedArtists: () => api.get('/users/me/followed-artists'),
}
