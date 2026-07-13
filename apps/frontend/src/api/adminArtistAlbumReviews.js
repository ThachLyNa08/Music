import axios from './axios'

export const adminArtistAlbumReviewsApi = {
  getReviews: (params) => axios.get('/admin/artist-album-reviews', { params }),
  getReviewDetail: (id) => axios.get(`/admin/artist-album-reviews/${id}`),
  approveAlbum: (id) => axios.post(`/admin/artist-album-reviews/${id}/approve`),
  rejectAlbum: (id, reason) => axios.post(`/admin/artist-album-reviews/${id}/reject`, { reason })
}
