import api from './axios'

export const artistStudioApi = {
  getDashboard: (params) => api.get('/artist/dashboard', { params }),
  getUploadOptions: () => api.get('/artist/upload-options'),
  getAlbumSongOptions: () => api.get('/artist/album-song-options'),
  getSongs: (params) => api.get('/artist/songs', { params }),
  getSongDetail: (songId) => api.get(`/artist/songs/${songId}`),
  uploadArtistSong: (formData) => api.post('/artist/songs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAlbums: () => api.get('/artist/albums'),
  getAlbumDetail: (albumId) => api.get(`/artist/albums/${albumId}`),
  createAlbum: (formData) => api.post('/artist/albums', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}
