import axios from './axios'

export const aiPlaylistApi = {
  preview(data) {
    return axios.post('/ai-playlists/preview', data)
  },

  previewAiPlaylist(payload) {
    return axios.post('/ai-playlists/preview', payload)
  },

  previewAiPlaylistIntent(payload) {
    return axios.post('/ai-playlists/intent/preview', payload)
  },

  refineAiPlaylist(payload) {
    return axios.post('/ai-playlists/refine', payload)
  },
  
  save(data) {
    return axios.post('/ai-playlists/save', data)
  },

  saveAiPlaylist(payload) {
    return axios.post('/ai-playlists/save', payload)
  },

  getHistory(limit = 10) {
    return axios.get('/ai-playlists/history', { params: { limit } })
  },

  getHistoryDetail(id) {
    return axios.get(`/ai-playlists/history/${id}`)
  },

  saveHistory(id, payload = {}) {
    return axios.post(`/ai-playlists/history/${id}/save`, payload)
  },

  getSuggestions() {
    return axios.get('/ai-playlists/suggestions')
  },

  getQuota() {
    return axios.get('/ai-playlists/quota')
  }
}
