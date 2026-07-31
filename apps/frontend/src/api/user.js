import api from './axios'

export const userApi = {
  getStats: () => api.get('/users/me/stats'),
  getPublicProfile: (id) => api.get(`/users/${id}/public-profile`),
  updateProfile: (payload) => api.put('/users/me/profile', payload),
  uploadAvatar: (formData) => api.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verifyCurrentPassword: (payload) => api.post('/users/me/password/verify', payload),
  changePassword: (payload) => api.put('/users/me/password', payload),
}
