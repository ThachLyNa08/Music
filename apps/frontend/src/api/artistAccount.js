import api from './axios'

export const artistAccountApi = {
  createAccount: (artistId, data) => api.post(`/admin/artists/${artistId}/account/create`, data),
  bulkCreateAccounts: (data) => api.post('/admin/artists/accounts/bulk-create', data),
  resetTempPassword: (artistId) => api.post(`/admin/artists/${artistId}/account/reset-temp-password`),
  updateAccountStatus: (artistId, status) => api.patch(`/admin/artists/${artistId}/account/status`, { status }),
  getAccountStatus: (artistId) => api.get(`/admin/artists/${artistId}/account-status`),
  getArtistMe: () => api.get('/artist/me'),
  changePassword: (data) => api.post('/artist/change-password', data),
  getArtistProfile: () => api.get('/artist/profile'),
  updateArtistProfile: (data) => api.put('/artist/profile', data),
  uploadArtistAvatar: (formData) => api.post('/artist/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}
