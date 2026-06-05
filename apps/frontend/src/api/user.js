import api from './axios'

export const userApi = {
  getStats: () => api.get('/users/me/stats'),
}
