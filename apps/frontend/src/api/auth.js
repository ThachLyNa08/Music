import api from './axios'

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  artistLogin: (data) => api.post('/auth/artist/login', data),
  logout:   ()     => api.post('/auth/logout'),
  getMe:    ()     => api.get('/auth/me'),
  refresh:  (token)=> api.post('/auth/refresh', { refreshToken: token }),
}
