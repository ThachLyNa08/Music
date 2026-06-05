import axios from './axios'

export const albumApi = {
  getById: (id) => axios.get(`/albums/${id}`),
  addToLibrary: (id) => axios.post(`/albums/${id}/library`),
  removeFromLibrary: (id) => axios.delete(`/albums/${id}/library`)
}
