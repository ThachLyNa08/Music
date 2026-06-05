import api from './axios'

export const playlistApi = {
  getMyPlaylists: () => api.get('/playlists'),
  getDetail: (id) => api.get(`/playlists/${id}`),
  
  create: (formData) => api.post('/playlists', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  update: (id, data) => api.patch(`/playlists/${id}`, data),
  
  addSong: (playlistId, songId) => api.post(`/playlists/${playlistId}/songs`, { song_id: songId }),
  reorderSongs: (playlistId, songIds) => api.patch(`/playlists/${playlistId}/songs/reorder`, { songIds }),
  removeSong: (playlistId, songId) => api.delete(`/playlists/${playlistId}/songs/${songId}`),
  deletePlaylist: (id) => api.delete(`/playlists/${id}`),

  savePlaylist: (id) => api.post(`/playlists/${id}/save`),
  unsavePlaylist: (id) => api.delete(`/playlists/${id}/save`)
}
