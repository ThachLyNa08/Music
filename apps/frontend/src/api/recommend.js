import api from './axios'

export const recommendApi = {
  getHomeRecommendations: () => api.get('/recommend/home'),
}
