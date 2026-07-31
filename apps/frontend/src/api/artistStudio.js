import api from './axios'

export const artistStudioApi = {
  getDashboard: (params) => api.get('/artist/dashboard', { params }),
  getUploadOptions: () => api.get('/artist/upload-options'),
  getAlbumSongOptions: (params) => api.get('/artist/album-song-options', { params }),
  getSongs: (params) => api.get('/artist/songs', { params: { ...params, _t: Date.now() } }),
  getSongDetail: (songId) => api.get(`/artist/songs/${songId}`),
  uploadArtistSong: (formData) => api.post('/artist/songs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAlbums: () => api.get('/artist/albums', { params: { _t: Date.now() } }),
  getAlbumDetail: (albumId) => api.get(`/artist/albums/${albumId}`),
  createAlbum: (formData) => api.post('/artist/albums', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  resubmitSong: (id, formData) => api.post(`/artist/songs/${id}/resubmit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  resubmitAlbum: (id, formData) => api.post(`/artist/albums/${id}/resubmit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}
