import api from './axios'

export function getLyricsBySongId(songId) {
  return api.get(`/lyrics/song/${songId}`)
}

export const lyricsApi = {
  getSongLyrics: getLyricsBySongId,
  getLyricsBySongId,
}
