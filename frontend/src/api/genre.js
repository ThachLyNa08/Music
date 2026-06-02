import api from './axios'

export const genreApi = {
  getAll: () => api.get('/genres'),
}
