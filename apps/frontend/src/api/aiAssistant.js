import api from './axios'

export const aiAssistantApi = {
  music(payload) {
    return api.post('/ai-assistant/music', payload)
  },
}
