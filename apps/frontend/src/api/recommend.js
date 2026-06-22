import api from './axios'

export const recommendApi = {
  getHomeRecommendations: () => api.get('/recommend/home'),
  getHomeSongRecommendations: (limit = 20, options = {}) =>
    api.get('/recommend/home-songs', {
      params: {
        limit,
        ...(options.refresh ? { _t: Date.now() } : {}),
      },
    }),
  // Contextual mood recommendations theo buổi trong ngày.
  // options: { limit, timeSlot, now } - timeSlot mặc định 'auto'.
  getContextualMoodRecommendations: ({ limit = 20, timeSlot = 'auto', now } = {}) =>
    api.get('/recommend/contextual-mood', {
      params: {
        limit,
        timeSlot,
        ...(now ? { now } : {}),
      },
    }),
}
