import api from './axios'

export const userApi = {
  getStats: () => api.get('/users/me/stats'),
  getPublicProfile: (id) => api.get(`/users/${id}/public-profile`),
}
