import api from './axios'

export const artistApi = {
  getAll: (params) => api.get('/artists', { params }),
  getPopular: (params) => api.get('/artists/popular', { params }),
  getById: (id) => api.get(`/artists/${id}`),
  
  // Follow/Unfollow APIs
  followArtist: (artistId) => api.post(`/artists/${artistId}/follow`),
  unfollowArtist: (artistId) => api.delete(`/artists/${artistId}/follow`),
  
  // Get followed artists list
  getFollowedArtists: () => api.get('/users/me/followed-artists'),

  // Custom helper for Register fallbacks (Fast Onboarding Endpoint)
  getArtistsByGenres: (genreIds, limit = 24) => api.get('/artists/onboarding', {
    params: {
      popular: true,
      limit,
      genreIds: Array.isArray(genreIds) ? genreIds.join(',') : genreIds
    }
  }),
  getArtistsByMarket: (markets, limit = 24) => api.get('/artists/onboarding', {
    params: {
      popular: true,
      limit,
      markets: Array.isArray(markets) ? markets.join(',') : markets
    }
  }),
  getPopularArtistsGlobal: (limit = 24) => api.get('/artists/onboarding', {
    params: {
      popular: true,
      limit
    }
  })
}
