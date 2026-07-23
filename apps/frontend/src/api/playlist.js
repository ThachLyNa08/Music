import api from './axios'

export const playlistApi = {
  getMyPlaylists: () => api.get('/playlists'),
  getDetail: (id) => api.get(`/playlists/${id}`),

  create: (formData) => api.post('/playlists', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  update: (id, data) => api.patch(`/playlists/${id}`, data),

  addSong: (playlistId, songId) => {
    const id = typeof songId === 'object' && songId !== null ? (songId.id ?? songId.song_id ?? songId.songId) : songId
    return api.post(`/playlists/${playlistId}/songs`, { song_id: id })
  },
  reorderSongs: (playlistId, songIds) => api.patch(`/playlists/${playlistId}/songs/reorder`, { songIds }),
  removeSong: (playlistId, songId) => {
    const id = typeof songId === 'object' && songId !== null ? (songId.id ?? songId.song_id ?? songId.songId) : songId
    return api.delete(`/playlists/${playlistId}/songs/${id}`)
  },
  deletePlaylist: (id) => api.delete(`/playlists/${id}`),
  clonePlaylist: (id) => api.post(`/playlists/${id}/clone`),

  savePlaylist: (id) => api.post(`/playlists/${id}/save`),
  unsavePlaylist: (id) => api.delete(`/playlists/${id}/save`)
}
