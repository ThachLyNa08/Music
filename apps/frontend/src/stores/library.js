import { defineStore } from 'pinia'
import { ref } from 'vue'
import { songApi } from '@/api/song'
import { addToast } from '@/utils/toast'
import { useAuthStore } from '@/stores/auth'

const LOCAL_LIKED_KEY = 'musicflowLikedSongs'
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80'

function getSongId(song) {
  if (song === null || song === undefined) return null
  if (typeof song === 'number' || typeof song === 'string') return song
  return song.id ?? song.song_id ?? song.songId ?? null
}

function normalizeSongId(song) {
  const id = getSongId(song)
  return id === null || id === undefined || id === '' ? null : String(id)
}

function hasLikedFlag(song) {
  return Boolean(
    song?.is_liked === true ||
    song?.is_liked === 1 ||
    song?.is_liked === '1' ||
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
  if (!song || typeof song !== 'object') return
  song.is_liked = liked ? 1 : 0
  song.isLiked = liked
  song.liked = liked
  song.is_favorite = liked ? 1 : 0
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
  if (!song) return null
  const cover = song.cover || song.cover_url || DEFAULT_COVER
  const liked = hasLikedFlag(song)
  return {
    ...song,
    id: song.id ?? song.song_id,
    artist_name: song.artist_name || song.artist || 'Unknown Artist',
    album: song.album || song.album_title || 'Single',
    cover,
    duration: formatDuration(song),
    dateAdded: formatAddedDate(song.dateAdded || song.liked_at) || fallbackDate,
    is_liked: liked ? 1 : 0,
    isLiked: liked,
    liked,
    is_favorite: liked ? 1 : 0,
    isFavorite: liked,
  }
}

function getSpotifyId(song) {
  if (!song || typeof song !== 'object') return null
  if (song.spotify_uri) return song.spotify_uri.replace('spotify:track:', '')
  if (song.audio_url && song.audio_url.startsWith('spotify:')) return song.audio_url.replace('spotify:track:', '')
  if (typeof song.id === 'string' && song.id.length > 5) return song.id
  return null
}

function matchesSong(a, b) {
  if (!a || !b) return false
  const sa = getSpotifyId(a)
  const sb = getSpotifyId(b)
  if (sa && sb) return sa === sb
  const aId = normalizeSongId(a)
  const bId = normalizeSongId(b)
  if (aId && bId) return aId === bId
  return a.title === b.title && (a.artist_name || a.artist) === (b.artist_name || b.artist)
}

export const useLibraryStore = defineStore('library', () => {
  const likedSongs = ref([])
  const likedSongIds = ref(new Set())
  const loadingLikedSongs = ref(false)
  const likedSongsLoaded = ref(false)
  const pendingLikeIds = ref(new Set())

  function replaceLikedIds(ids) {
    likedSongIds.value = new Set(
      ids
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => String(id))
    )
  }

  function addLikedId(id) {
    const normalizedId = normalizeSongId(id)
    if (!normalizedId) return
    likedSongIds.value = new Set([...likedSongIds.value, normalizedId])
  }

  function removeLikedId(id) {
    const normalizedId = normalizeSongId(id)
    if (!normalizedId) return
    const next = new Set(likedSongIds.value)
    next.delete(normalizedId)
    likedSongIds.value = next
  }

  function setPending(id, pending) {
    const normalizedId = normalizeSongId(id)
    if (!normalizedId) return
    const next = new Set(pendingLikeIds.value)
    if (pending) next.add(normalizedId)
    else next.delete(normalizedId)
    pendingLikeIds.value = next
  }

  function isLikePending(songOrId) {
    const id = normalizeSongId(songOrId)
    return !!id && pendingLikeIds.value.has(id)
  }

  function isSongLiked(songOrId) {
    const id = normalizeSongId(songOrId)
    if (!id) return typeof songOrId === 'object' && hasLikedFlag(songOrId)
    if (likedSongIds.value.has(id)) return true
    if (likedSongsLoaded.value || likedSongIds.value.size > 0) return false
    return typeof songOrId === 'object' && hasLikedFlag(songOrId)
  }

  function applyLikedStateToSong(song) {
    if (!song) return song
    const id = normalizeSongId(song)
    if (id && hasLikedFlag(song) && !likedSongsLoaded.value) {
      addLikedId(id)
    }
    setSongLiked(song, isSongLiked(song))
    return song
  }

  function applyLikedStateToSongs(songs) {
    if (!Array.isArray(songs)) return []
    return songs.map((song) => applyLikedStateToSong(song))
  }

  function upsertLikedSong(song) {
    const normalized = normalizeSong(song)
    if (!normalized) return
    setSongLiked(normalized, true)
    likedSongs.value = [
      normalized,
      ...likedSongs.value.filter((item) => !matchesSong(item, normalized))
    ]
  }

  function removeLikedSong(songOrId) {
    const id = normalizeSongId(songOrId)
    likedSongs.value = likedSongs.value.filter((item) => {
      if (id) return normalizeSongId(item) !== id
      return !matchesSong(item, songOrId)
    })
  }

  function clearLikedState() {
    likedSongs.value = []
    replaceLikedIds([])
    pendingLikeIds.value = new Set()
    loadingLikedSongs.value = false
    likedSongsLoaded.value = false
    localStorage.removeItem(LOCAL_LIKED_KEY)
  }

  async function fetchLikedSongs(force = false) {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) {
      clearLikedState()
      return
    }
    if (loadingLikedSongs.value || (likedSongsLoaded.value && !force)) return

    loadingLikedSongs.value = true
    try {
      const res = await songApi.getLiked()
      const payload = res.data || {}
      const items = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
          ? payload.data
          : []
      const ids = Array.isArray(payload.ids)
        ? payload.ids
        : items.map((song) => getSongId(song))

      replaceLikedIds(ids)
      likedSongs.value = items.map((song) => {
        const normalized = normalizeSong(song, song.dateAdded)
        setSongLiked(normalized, true)
        return normalized
      })
      likedSongsLoaded.value = true
    } catch (err) {
      console.warn('Cannot load liked songs:', err)
      likedSongsLoaded.value = true
    } finally {
      loadingLikedSongs.value = false
    }
  }

  async function likeSong(songOrId) {
    const id = normalizeSongId(songOrId)
    if (!id) return false
    await songApi.like(id)
    addLikedId(id)
    if (typeof songOrId === 'object') {
      setSongLiked(songOrId, true)
      upsertLikedSong(songOrId)
    }
    return true
  }

  async function unlikeSong(songOrId) {
    const id = normalizeSongId(songOrId)
    if (!id) return false
    await songApi.unlike(id)
    removeLikedId(id)
    if (typeof songOrId === 'object') setSongLiked(songOrId, false)
    removeLikedSong(songOrId)
    return true
  }

  async function toggleSongLike(song) {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) {
      addToast('Vui lòng đăng nhập để thích bài hát', 'warning')
      return false
    }

    const id = normalizeSongId(song)
    if (!id) {
      addToast('Không thể xác định bài hát để thích', 'warning')
      return false
    }
    if (isLikePending(id)) return false

    if (!likedSongsLoaded.value) {
      await fetchLikedSongs()
    }

    const wasLiked = isSongLiked(id)
    const previousLikedSongs = [...likedSongs.value]

    setPending(id, true)
    if (wasLiked) {
      removeLikedId(id)
      removeLikedSong(song)
      setSongLiked(song, false)
    } else {
      addLikedId(id)
      setSongLiked(song, true)
      upsertLikedSong(song)
    }

    try {
      if (wasLiked) {
        const res = await songApi.unlike(id)
        if (song && res.data?.likeCount !== undefined) song.like_count = res.data.likeCount
        addToast('Đã xóa khỏi Bài hát đã thích', 'danger')
      } else {
        const res = await songApi.like(id)
        if (song && res.data?.likeCount !== undefined) song.like_count = res.data.likeCount
        addToast('Đã lưu vào Bài hát đã thích')
      }
      return true
    } catch (err) {
      if (wasLiked) addLikedId(id)
      else removeLikedId(id)
      setSongLiked(song, wasLiked)
      likedSongs.value = previousLikedSongs
      addToast('Lỗi: Không thể cập nhật mục yêu thích', 'error')
      console.error('Cannot update liked song:', err)
      return false
    } finally {
      setPending(id, false)
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
    pendingLikeIds,
    fetchLikedSongs,
    clearLikedState,
    isSongLiked,
    isLiked: isSongLiked,
    isLikePending,
    applyLikedStateToSong,
    applyLikedStateToSongs,
    hydrateSong: applyLikedStateToSong,
    hydrateSongs: applyLikedStateToSongs,
    likeSong,
    unlikeSong,
    toggleSongLike,
    toggleLike: toggleSongLike,
    showPlaylistModal,
    songToAdd,
    openPlaylistModal,
    closePlaylistModal,
  }
})
