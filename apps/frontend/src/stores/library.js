import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { songApi } from '@/api/song'
import { addToast } from '@/utils/toast'

const LOCAL_LIKED_KEY = 'musicflowLikedSongs'
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80'

function loadLocalLikedSongs() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_LIKED_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocalLikedSongs(songs) {
  localStorage.setItem(LOCAL_LIKED_KEY, JSON.stringify(songs))
}

function getSongId(song) {
  return song?.id ?? song?.song_id ?? song?.songId ?? null
}

function isSongLiked(song) {
  return Boolean(
    song?.is_liked === true ||
    song?.is_liked === 1 ||
    song?.isLiked === true ||
    song?.isLiked === 1 ||
    song?.liked === true ||
    song?.liked === 1 ||
    song?.is_favorite === true ||
    song?.is_favorite === 1 ||
    song?.isFavorite === true ||
    song?.isFavorite === 1
  )
}

function setSongLiked(song, liked) {
  if (!song) return
  song.is_liked = liked
  song.isLiked = liked
  song.liked = liked
  song.is_favorite = liked
  song.isFavorite = liked
}

function formatDuration(song) {
  if (song.duration) return song.duration
  const seconds = Number(song.duration_sec || 0)
  const minutes = Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

function formatAddedDate(value) {
  if (!value) return 'Vừa xong'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('vi-VN')
}

function normalizeSong(song, fallbackDate = 'Vừa xong') {
  const cover = song.cover || song.cover_url || DEFAULT_COVER
  const liked = isSongLiked(song)
  return {
    ...song,
    artist_name: song.artist_name || song.artist || 'Unknown Artist',
    album: song.album || 'Single',
    cover,
    duration: formatDuration(song),
    dateAdded: formatAddedDate(song.dateAdded || song.liked_at) || fallbackDate,
    is_liked: liked,
    isLiked: liked,
    liked,
    is_favorite: liked,
    isFavorite: liked,
  }
}

function getSpotifyId(song) {
  if (!song) return null
  if (song.spotify_uri) return song.spotify_uri.replace('spotify:track:', '')
  if (song.audio_url && song.audio_url.startsWith('spotify:')) return song.audio_url.replace('spotify:track:', '')
  if (typeof song.id === 'string' && song.id.length > 5) return song.id
  return null
}

function hasBackendIdentity(song) {
  if (!song) return false
  const isSpotify = song.source === 'spotify' || (typeof song.id === 'string' && song.id.length > 5)
  return Boolean(
    isSpotify ||
    (Number.isInteger(Number(song.id)) &&
     (song.audio_url || song.cover_url || song.duration_sec !== undefined))
  )
}

function matchesSong(a, b) {
  if (!a || !b) return false
  const sa = getSpotifyId(a)
  const sb = getSpotifyId(b)
  if (sa && sb) return sa === sb
  if (a.id != null && b.id != null) return String(a.id) === String(b.id)
  return a.title === b.title && (a.artist_name || a.artist) === (b.artist_name || b.artist)
}

export const useLibraryStore = defineStore('library', () => {
  const likedSongs = ref(loadLocalLikedSongs())
  const loadingLikedSongs = ref(false)
  const likedSongsLoaded = ref(false)
  const likedSongIds = computed(() => new Set(
    likedSongs.value
      .map((song) => getSongId(song))
      .filter((id) => id !== null && id !== undefined)
      .map((id) => String(id))
  ))

  function isLiked(song) {
    if (!song) return false
    const id = getSongId(song)
    
    // Always access these reactive properties FIRST to ensure Vue registers them as dependencies for this render cycle
    // If we use short-circuiting (||), Vue might never track them!
    const hasInStore = id !== null && id !== undefined && likedSongIds.value.has(String(id))
    const hasInSongs = likedSongs.value.some((item) => matchesSong(item, song))
    
    return isSongLiked(song) || hasInStore || hasInSongs
  }

  function hydrateSong(song) {
    if (!song) return song
    setSongLiked(song, isLiked(song))
    return song
  }

  function hydrateSongs(songs) {
    if (!Array.isArray(songs)) return []
    return songs.map((song) => hydrateSong(song))
  }

  async function fetchLikedSongs(force = false) {
    if (loadingLikedSongs.value || (likedSongsLoaded.value && !force)) return

    loadingLikedSongs.value = true
    try {
      const res = await songApi.getLiked()
      if (res.data?.success) {
        likedSongs.value = res.data.data.map((song) => {
          const normalized = normalizeSong(song, song.dateAdded)
          setSongLiked(normalized, true)
          return normalized
        })
        saveLocalLikedSongs(likedSongs.value)
      }
      likedSongsLoaded.value = true
    } catch (err) {
      console.warn('Cannot load liked songs:', err)
      likedSongsLoaded.value = true
    } finally {
      loadingLikedSongs.value = false
    }
  }

  async function toggleLike(song) {
    if (!song) return

    const existingIndex = likedSongs.value.findIndex((item) => matchesSong(item, song))
    const wasLiked = existingIndex !== -1 || isSongLiked(song)
    const normalized = normalizeSong(song)
    setSongLiked(song, !wasLiked)
    setSongLiked(normalized, !wasLiked)

    if (wasLiked) {
      if (existingIndex !== -1) likedSongs.value.splice(existingIndex, 1)
      addToast('Đã xóa khỏi Bài hát đã thích')
    } else {
      likedSongs.value.unshift(normalized)
      addToast('Đã lưu vào Bài hát đã thích')
    }
    saveLocalLikedSongs(likedSongs.value)

    if (!hasBackendIdentity(song)) return

    try {
      if (wasLiked) {
        await songApi.unlike(song.id)
      } else {
        await songApi.like(song.id)
      }
    } catch (err) {
      setSongLiked(song, wasLiked)
      if (wasLiked) {
        if (existingIndex !== -1) {
          likedSongs.value.splice(existingIndex, 0, normalized)
        } else {
          likedSongs.value.unshift(normalized)
        }
      } else {
        likedSongs.value = likedSongs.value.filter((item) => !matchesSong(item, song))
      }
      saveLocalLikedSongs(likedSongs.value)
      addToast('Lỗi: Không thể cập nhật mục yêu thích')
      console.error('Cannot update liked song:', err)
    }
  }

  const showPlaylistModal = ref(false)
  const songToAdd = ref(null)

  function openPlaylistModal(song) {
    if (!song) return
    songToAdd.value = song
    showPlaylistModal.value = true
  }

  function closePlaylistModal() {
    showPlaylistModal.value = false
    songToAdd.value = null
  }

  return {
    likedSongs,
    likedSongIds,
    loadingLikedSongs,
    likedSongsLoaded,
    fetchLikedSongs,
    isLiked,
    hydrateSong,
    hydrateSongs,
    toggleLike,
    showPlaylistModal,
    songToAdd,
    openPlaylistModal,
    closePlaylistModal,
  }
})
