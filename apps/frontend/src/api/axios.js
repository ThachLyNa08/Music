import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL, clearAuthTokensWhenApiBaseChanged } from '@/config/runtime'

clearAuthTokensWhenApiBaseChanged()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Tự động gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Tự động refresh token khi hết hạn
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.data?.code === 'ACCOUNT_LOCKED') {
      const authStore = useAuthStore()
      authStore.handleAccountLocked(err.response.data.data || {})
      window.dispatchEvent(new CustomEvent('musicflow:account-locked', {
        detail: err.response.data.data || {},
      }))
      return Promise.reject(err)
    }

    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url.includes('/auth/login') &&
      !original.url.includes('/auth/refresh')
    ) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refreshToken')
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: refresh })
        localStorage.setItem('accessToken', data.data.accessToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        const path = window.location.pathname
        if (path.startsWith('/admin')) window.location.href = '/admin/login'
        else if (path.startsWith('/artist')) window.location.href = '/artist/login'
        else window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
