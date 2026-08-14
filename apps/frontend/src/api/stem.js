import api from '@/api/axios'

export const stemApi = {
  getReadySongs: (limit = 24) => api.get('/stem/songs/ready', { params: { limit } }),
  separateSong: (songId) => api.post(`/stem/songs/${songId}/separate`),
  getLatestForSong: (songId) => api.get(`/stem/songs/${songId}/latest`),
  getJob: (jobId) => api.get(`/stem/jobs/${jobId}`),
  downloadSongInstrumental: (songId) => api.get(`/stem/songs/${songId}/download/instrumental`, {
    responseType: 'blob',
    timeout: 120000,
  }),
  downloadInstrumental: (jobId) => api.get(`/stem/jobs/${jobId}/download/instrumental`, {
    responseType: 'blob',
    timeout: 120000,
  }),
}
