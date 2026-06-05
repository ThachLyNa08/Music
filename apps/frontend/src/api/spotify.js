import api from './axios'

export const spotifyApi = {
  getAuthorizeUrl: () => api.get('/spotify/authorize'),
  completeCallback: ({ code, state }) => api.post('/spotify/callback', { code, state }),
  getStatus: () => api.get('/spotify/status'),
  getPlayerToken: () => api.get('/spotify/player-token'),
  disconnect: () => api.delete('/spotify/disconnect'),
  search: (q, limit = 20) => api.get('/spotify/search', { params: { q, limit } }),
  getPlaylist: (id) => api.get('/spotify/playlists/' + id),
}
