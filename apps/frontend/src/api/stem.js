import api from '@/api/axios'

export const stemApi = {
  separateSong: (songId) => api.post(`/stem/songs/${songId}/separate`),
  getLatestForSong: (songId) => api.get(`/stem/songs/${songId}/latest`),
  getJob: (jobId) => api.get(`/stem/jobs/${jobId}`),
  downloadInstrumental: (jobId) => api.get(`/stem/jobs/${jobId}/download/instrumental`, { responseType: 'blob' }),
}
