import api from './axios'

const popularCache = new Map()
const CACHE_TTL = 300000 // 5 minutes

export const artistApi = {
  getAll: (params) => api.get('/artists', { params }),
  getPopular: async (params) => {
    const key = `popular_${JSON.stringify(params || {})}`
    const cached = popularCache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve({ data: cached.data })
    }
    const response = await api.get('/artists/popular', { params })
    if (response.data?.success) {
      popularCache.set(key, { timestamp: Date.now(), data: response.data })
    }
    return response
  },
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
