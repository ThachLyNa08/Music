import api from './axios'

export const chartApi = {
  getWeekly: (params = {}) => api.get('/charts/weekly', { params })
}
