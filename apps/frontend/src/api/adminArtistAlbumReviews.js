import axios from './axios'

export const adminArtistAlbumReviewsApi = {
  getReviews: (params) => axios.get('/admin/artist-album-reviews', { params }),
  getReviewDetail: (id) => axios.get(`/admin/artist-album-reviews/${id}`),
  approveAlbum: (id) => axios.post(`/admin/artist-album-reviews/${id}/approve`),
  rejectAlbum: (id, reason, allowResubmit) => axios.post(`/admin/artist-album-reviews/${id}/reject`, { reason, allowResubmit }),
  bulkApproveAlbums: (ids) => axios.post('/admin/artist-album-reviews/bulk-approve', { ids }),
  bulkRejectAlbums: (payload) => axios.post('/admin/artist-album-reviews/bulk-reject', typeof payload === 'object' && !Array.isArray(payload) ? payload : { ids: payload })
}
