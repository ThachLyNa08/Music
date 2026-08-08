import api from './axios'

export const accountApi = {
  submitLockAppeal: (payload) => {
    if (payload instanceof FormData) {
      return api.post('/account/appeals/lock', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }
    return api.post('/account/appeals/lock', payload)
  },
}
