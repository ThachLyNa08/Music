import api from './axios'

const inFlight = new Map()
const responseCache = new Map()
const CACHE_TTL_MS = 30000

function stableParams(params = {}) {
  return Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
}

function dedupeGet(key, requestFactory) {
  const cached = responseCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cached.response)
  }

  if (inFlight.has(key)) return inFlight.get(key)

  const request = requestFactory()
    .then(response => {
      responseCache.set(key, { timestamp: Date.now(), response })
      return response
    })
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, request)
  return request
}

export const chartApi = {
  getWeekly: (params = {}, config = {}) => {
    const key = `weekly:${stableParams(params)}`
    return dedupeGet(key, () => api.get('/charts/weekly', { params, ...config }))
  },
  getGlobal: (params = {}, config = {}) => {
    const key = `global:${stableParams(params)}`
    return dedupeGet(key, () => api.get('/charts/global', { params, ...config }))
  }
}
