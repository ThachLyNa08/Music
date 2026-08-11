function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function resolveBackendBaseUrl(apiBaseUrl) {
  return trimTrailingSlash(import.meta.env.VITE_BACKEND_BASE_URL || apiBaseUrl.replace(/\/api\/?$/, ''))
}

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api')
export const BACKEND_BASE_URL = resolveBackendBaseUrl(API_BASE_URL)
export const SOCKET_URL = trimTrailingSlash(import.meta.env.VITE_SOCKET_URL || BACKEND_BASE_URL)

const LAST_API_BASE_URL_KEY = 'musicflow:lastApiBaseUrl'

export function clearAuthTokensWhenApiBaseChanged() {
  if (typeof window === 'undefined') return
  const previous = localStorage.getItem(LAST_API_BASE_URL_KEY)
  if (previous && previous !== API_BASE_URL) {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }
  localStorage.setItem(LAST_API_BASE_URL_KEY, API_BASE_URL)
}

export function toBackendAssetUrl(url) {
  if (!url) return ''
  const clean = String(url).trim()
  if (!clean) return ''
  if (/^(https?:)?\/\//i.test(clean) || clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean
  }
  if (clean.startsWith('/uploads') || clean.startsWith('/storage') || clean.startsWith('/stems') || clean.startsWith('/playlist_cover')) {
    return `${BACKEND_BASE_URL}${clean}`
  }
  if (clean.startsWith('uploads/') || clean.startsWith('storage/') || clean.startsWith('stems/') || clean.startsWith('playlist_cover/')) {
    return `${BACKEND_BASE_URL}/${clean}`
  }
  return clean
}

if (import.meta.env.DEV) {
  console.info('[MusicFlow] API_BASE_URL =', API_BASE_URL)
  console.info('[MusicFlow] BACKEND_BASE_URL =', BACKEND_BASE_URL)
}
