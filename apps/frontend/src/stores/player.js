import { defineStore } from 'pinia'
import { ref } from 'vue'
import { spotifyApi } from '@/api/spotify'
import api from '@/api/axios'
import { addToast } from '@/utils/toast'

export const usePlayerStore = defineStore('player', () => {
  const audio = ref(new Audio())
  const currentSong = ref(null)
  const queue = ref([])
  const queueIndex = ref(0)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)

  const shuffle = ref(false)
  const repeat = ref('none')
  const spotifyPlayer = ref(null)
  const spotifyDeviceId = ref(null)
  const spotifyReady = ref(false)
  const spotifyError = ref('')
  const isSpotifyActive = ref(false)
  const isNowPlayingExpanded = ref(false)
  let spotifyProgressTimer = null

  const playbackSource = ref('unknown')
  const playbackContext = ref({
    source: null,
    artistId: null,
    genreId: null,
    albumId: null,
    playlistId: null,
    seedSongId: null
  })
  const hasReportedCurrent = ref(false)
  const currentListenStartAt = ref(Date.now())
  const currentListenSongId = ref(null)
  const currentHistoryId = ref(null)
  let trackingTimer = null
  let isTrackingCurrentSong = false
  let isAutoContinuing = false

  function getSongId(song) {
    return song?.id ?? song?.song_id ?? song?.track_id ?? null
  }

  function sameSong(a, b) {
    const aId = getSongId(a)
    const bId = getSongId(b)
    if (aId !== null && bId !== null) return String(aId) === String(bId)
    return a === b
  }

  function findSongIndex(list, song) {
    if (!Array.isArray(list) || !song) return -1
    return list.findIndex((item) => sameSong(item, song))
  }

  function getAudioSource(song) {
    return song?.audio_url || song?.preview_url || null
  }

  function getAudioUrl(song) {
    const audioSource = getAudioSource(song)
    if (!audioSource) return ''
    return audioSource.startsWith('http') ? audioSource : `http://localhost:3000${audioSource}`
  }

  function firstValue(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '')
  }

  function normalizePlaybackContext(song, sourceOrContext = null, explicitContext = null) {
    const context = {
      ...(typeof sourceOrContext === 'object' && sourceOrContext ? sourceOrContext : {}),
      ...(explicitContext || {})
    }
    const source = typeof sourceOrContext === 'string' ? sourceOrContext : context.source

    return {
      source: source || playbackContext.value.source || playbackSource.value || null,
      artistId: firstValue(context.artistId, context.artist_id, song?.artist_id, song?.artistId, null),
      genreId: firstValue(context.genreId, context.genre_id, song?.genre_id, song?.genreId, null),
      albumId: firstValue(context.albumId, context.album_id, song?.album_id, song?.albumId, null),
      playlistId: firstValue(context.playlistId, context.playlist_id, null),
      seedSongId: firstValue(context.seedSongId, context.seed_song_id, getSongId(song), null)
    }
  }

  function setPlaybackContext(song, sourceOrContext = null, explicitContext = null) {
    const nextContext = normalizePlaybackContext(song, sourceOrContext, explicitContext)
    playbackContext.value = nextContext
    playbackSource.value = nextContext.source || 'unknown'
  }

  // --- PERSIST PLAYER STATE ---
  let lastPersistAt = 0
  const sessionUserId = ref('guest')

  function getPlayerSessionKey(userId = null) {
    const id = userId || sessionUserId.value || 'guest'
    return `musicflow_player_session_${id}`
  }

  function stopPlayback() {
    try {
      if (audio.value) {
        audio.value.pause()
      }
    } catch (e) {
      console.warn('stopPlayback error:', e)
    }
    if (spotifyPlayer.value && isSpotifyActive.value) {
      spotifyPlayer.value.pause().catch(e => console.warn(e))
    }
    isPlaying.value = false
  }

  function clearRuntimePlayer() {
    stopPlayback()
    currentSong.value = null
    queue.value = []
    queueIndex.value = 0
    duration.value = 0
    currentTime.value = 0
    spotifyError.value = ''
    isSpotifyActive.value = false
    playbackSource.value = 'unknown'
    playbackContext.value = {
      source: null,
      artistId: null,
      genreId: null,
      albumId: null,
      playlistId: null,
      seedSongId: null
    }
    if (audio.value) {
      audio.value.src = ''
      try {
        audio.value.load()
      } catch (e) {}
    }
  }

  function savePlayerSession(userId = null) {
    if (!currentSong.value) return
    const key = getPlayerSessionKey(userId)
    const state = {
      currentSong: currentSong.value,
      queue: queue.value,
      currentIndex: queueIndex.value,
      currentTime: currentTime.value,
      volume: volume.value,
      isShuffle: shuffle.value,
      repeatMode: repeat.value,
      source: playbackSource.value,
      playbackContext: playbackContext.value,
      savedAt: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(state))
  }

  function restorePlayerSession(userId = null) {
    if (userId) {
      sessionUserId.value = userId
    }
    clearRuntimePlayer()
    const key = getPlayerSessionKey(userId)
    try {
      const saved = localStorage.getItem(key)
      if (!saved) return
      const state = JSON.parse(saved)
      
      // Bỏ qua nếu dữ liệu quá cũ (24h)
      if (Date.now() - state.savedAt > 24 * 60 * 60 * 1000) return

      currentSong.value = state.currentSong
      queue.value = state.queue || []
      queueIndex.value = state.currentIndex || 0
      volume.value = state.volume ?? 1
      shuffle.value = state.isShuffle || false
      repeat.value = state.repeatMode || 'none'
      playbackSource.value = state.source || 'unknown'
      playbackContext.value = state.playbackContext || normalizePlaybackContext(currentSong.value, playbackSource.value)
      
      // Khôi phục currentTime khi audio sẵn sàng
      const restoredTime = state.currentTime || 0
      if (restoredTime > 0) {
        audio.value.currentTime = restoredTime
        currentTime.value = restoredTime
      }
      
      isPlaying.value = false
      if (currentSong.value?.audio_url) {
        if (currentSong.value.audio_url.startsWith('http')) {
          audio.value.src = currentSong.value.audio_url
        } else {
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
          audio.value.src = `${baseUrl}${currentSong.value.audio_url}`
        }
      }
    } catch (err) {
      console.warn('Lỗi khi khôi phục player state:', err)
    }
  }

  function clearPlayerSession(userId = null) {
    localStorage.removeItem(getPlayerSessionKey(userId))
  }
  // ----------------------------

  async function trackCurrentSong(options = {}) {
    if (!currentSong.value || hasReportedCurrent.value) return
    if (currentSong.value.id !== currentListenSongId.value) return
    if (isTrackingCurrentSong) return

    isTrackingCurrentSong = true

    const listenDuration = Math.floor((Date.now() - currentListenStartAt.value) / 1000)
    const songDuration = currentSong.value.duration_sec || duration.value || 0
    const completionRate = songDuration > 0 ? listenDuration / songDuration : 0

    const shouldTrack =
      listenDuration >= 5 ||
      completionRate >= 0.1 ||
      options.completed ||
      options.skipped ||
      options.in_progress

    if (!shouldTrack) {
      isTrackingCurrentSong = false
      return
    }

    const songId = getSongId(currentSong.value)
    const skipAt = options.skipped ? Math.floor(currentTime.value) : null
    const source = playbackSource.value || 'unknown'

    try {
      const response = await api.post(`/songs/${songId}/listen`, {
        history_id: currentHistoryId.value,
        listen_duration: listenDuration,
        song_duration: Math.floor(songDuration),
        completion_rate: completionRate,
        is_completed: options.completed || completionRate >= 0.8,
        is_skipped: options.skipped || (listenDuration < 30 && completionRate < 0.3),
        skip_at_sec: skipAt,
        source: source,
        in_progress: options.in_progress || false
      })
      
      if (response.data?.success && response.data?.data?.history_id) {
        currentHistoryId.value = response.data.data.history_id
      }
      console.log(`[Tracking] Recorded listen for song ${songId}: listen=${listenDuration}s, rate=${completionRate.toFixed(2)}, skip=${skipAt}, source=${source}`)
    } catch (err) {
      console.warn('Failed to record song listen:', err)
    } finally {
      isTrackingCurrentSong = false
    }

    if (!options.in_progress) {
      hasReportedCurrent.value = true
    }
  }

  audio.value.addEventListener('timeupdate', () => {
    if (!isSpotifyActive.value) {
      currentTime.value = audio.value.currentTime
      const now = Date.now()
      if (now - lastPersistAt > 3000) {
        savePlayerSession()
        lastPersistAt = now
      }
    }
  })
  audio.value.addEventListener('loadedmetadata', () => {
    if (!isSpotifyActive.value) duration.value = audio.value.duration
  })
  audio.value.addEventListener('ended', handleTrackEnded)
  audio.value.addEventListener('play', () => isPlaying.value = true)
  audio.value.addEventListener('pause', () => {
    if (!isSpotifyActive.value) isPlaying.value = false
  })

  async function getSpotifyToken() {
    const { data } = await spotifyApi.getPlayerToken()
    return data.data.access_token
  }

  function loadSpotifySdk() {
    if (window.Spotify) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')
      window.onSpotifyWebPlaybackSDKReady = () => resolve()
      if (existing) return

      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      script.onerror = () => reject(new Error('Cannot load Spotify Web Playback SDK'))
      document.body.appendChild(script)
    })
  }

  async function ensureSpotifyPlayer() {
    if (spotifyReady.value && spotifyDeviceId.value) return spotifyDeviceId.value

    await loadSpotifySdk()

    if (!spotifyPlayer.value) {
      spotifyPlayer.value = new window.Spotify.Player({
        name: 'MusicFlow Web Player',
        getOAuthToken: async (cb) => cb(await getSpotifyToken()),
        volume: volume.value,
      })

      spotifyPlayer.value.addListener('ready', ({ device_id }) => {
        spotifyDeviceId.value = device_id
        spotifyReady.value = true
        spotifyError.value = ''
      })
      spotifyPlayer.value.addListener('not_ready', () => {
        spotifyReady.value = false
      })
      spotifyPlayer.value.addListener('player_state_changed', (state) => {
        if (!state) return
        currentTime.value = state.position / 1000
        duration.value = state.duration / 1000
        isPlaying.value = !state.paused
        isSpotifyActive.value = true
        updateSpotifyProgressTimer()
      })
      spotifyPlayer.value.addListener('initialization_error', ({ message }) => spotifyError.value = message)
      spotifyPlayer.value.addListener('authentication_error', ({ message }) => spotifyError.value = message)
      spotifyPlayer.value.addListener('account_error', ({ message }) => spotifyError.value = message)
      spotifyPlayer.value.addListener('playback_error', ({ message }) => spotifyError.value = message)
      spotifyPlayer.value.addListener('autoplay_failed', () => {
        spotifyError.value = 'Browser blocked Spotify autoplay. Press Play again.'
      })
    }

    const connected = await spotifyPlayer.value.connect()
    if (!connected) throw new Error('Cannot connect Spotify Web Playback SDK')

    await waitForSpotifyDevice()
    return spotifyDeviceId.value
  }

  function waitForSpotifyDevice() {
    if (spotifyDeviceId.value) return Promise.resolve(spotifyDeviceId.value)

    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const timer = window.setInterval(() => {
        if (spotifyDeviceId.value) {
          window.clearInterval(timer)
          resolve(spotifyDeviceId.value)
        } else if (Date.now() - startedAt > 8000) {
          window.clearInterval(timer)
          reject(new Error('Spotify player device is not ready'))
        }
      }, 100)
    })
  }

  function updateSpotifyProgressTimer() {
    window.clearInterval(spotifyProgressTimer)
    if (!isSpotifyActive.value || !isPlaying.value) return

    spotifyProgressTimer = window.setInterval(() => {
      currentTime.value = Math.min(currentTime.value + 1, duration.value || currentTime.value + 1)
    }, 1000)
  }

  async function playSpotifySong(song) {
    audio.value.pause()
    const deviceId = await ensureSpotifyPlayer()
    const token = await getSpotifyToken()

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [song.spotify_uri] }),
    })

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text()
      throw new Error(errorText || 'Spotify playback request failed')
    }

    isSpotifyActive.value = true
    isPlaying.value = true
  }

  async function playSong(song, newQueue = null, sourceOrIndex = null, context = null) {
    if (!song) return

    if (currentSong.value && !hasReportedCurrent.value) {
      await trackCurrentSong({ skipped: true })
    }

    const explicitIndex = Number.isInteger(sourceOrIndex) ? sourceOrIndex : null
    const source = typeof sourceOrIndex === 'string' ? sourceOrIndex : context?.source
    setPlaybackContext(song, source || context || null, context)

    currentListenStartAt.value = Date.now()
    currentListenSongId.value = getSongId(song)
    currentHistoryId.value = null
    hasReportedCurrent.value = false

    if (trackingTimer) clearTimeout(trackingTimer)
    trackingTimer = setTimeout(() => {
      if (currentSong.value && currentSong.value.id === song.id && !hasReportedCurrent.value) {
        trackCurrentSong({ in_progress: true })
      }
    }, 5000)

    if (Array.isArray(newQueue) && newQueue.length > 0) {
      queue.value = newQueue
      const indexInQueue = explicitIndex !== null ? explicitIndex : findSongIndex(newQueue, song)
      queueIndex.value = indexInQueue >= 0 ? indexInQueue : 0
    } else if (!queue.value.length) {
      queue.value = [song]
      queueIndex.value = 0
    } else {
      const indexInQueue = findSongIndex(queue.value, song)
      if (indexInQueue >= 0) {
        queueIndex.value = indexInQueue
      } else {
        queue.value.push(song)
        queueIndex.value = queue.value.length - 1
      }
    }

    if (queueIndex.value < 0 || queueIndex.value >= queue.value.length) {
      const indexInQueue = findSongIndex(queue.value, song)
      queueIndex.value = indexInQueue >= 0 ? indexInQueue : 0
    }

    const queuedSong = queue.value[queueIndex.value]
    if (queuedSong && !sameSong(queuedSong, song)) {
      const exactIndex = findSongIndex(queue.value, song)
      if (exactIndex >= 0) queueIndex.value = exactIndex
    }

    if (queue.value[queueIndex.value] && sameSong(queue.value[queueIndex.value], song)) {
      currentSong.value = queue.value[queueIndex.value]
    } else {
      currentSong.value = song
    }

    if (song.audio_url && song.audio_url.startsWith('spotify:')) {
      song.spotify_uri = song.audio_url
    }

    spotifyError.value = ''
    savePlayerSession()

    if (song.spotify_uri) {
      try {
        await playSpotifySong(song)
        return
      } catch (error) {
        spotifyError.value = error.message || 'Cannot play Spotify track'
        console.warn('Spotify playback failed, falling back to preview:', error)
      }
    }

    const audioSource = getAudioSource(song)
    if (audioSource) {
      if (spotifyPlayer.value && isSpotifyActive.value) {
        spotifyPlayer.value.pause().catch((err) => console.warn('Cannot pause Spotify player:', err))
      }
      isSpotifyActive.value = false
      window.clearInterval(spotifyProgressTimer)
      audio.value.src = getAudioUrl(song)
      audio.value.volume = volume.value
      isPlaying.value = true
      audio.value.play().catch((error) => {
        isPlaying.value = false
        console.warn('[Player] audio play failed:', error)
      })
    } else {
      if (spotifyPlayer.value && isSpotifyActive.value) {
        spotifyPlayer.value.pause().catch((err) => console.warn('Cannot pause Spotify player:', err))
      }
      isSpotifyActive.value = false
      window.clearInterval(spotifyProgressTimer)
      audio.value.pause()
      isPlaying.value = false
      currentTime.value = 0
      duration.value = 0
      spotifyError.value = 'Bài hát này chưa có nguồn phát.'
    }
  }

  function addToQueue(song) {
    queue.value.push(song)
    addToast('Đã thêm vào hàng đợi')
    if (!currentSong.value) playSong(song)
    else savePlayerSession()
  }

  function removeFromQueue(index) {
    if (index === queueIndex.value) {
      next()
    } else if (index < queueIndex.value) {
      queueIndex.value--
    }
    queue.value.splice(index, 1)
    addToast('Đã xóa khỏi hàng đợi')
    savePlayerSession()
  }

  function reorderQueue(newQueue) {
    if (!Array.isArray(newQueue)) return

    const current = currentSong.value
    queue.value = [...newQueue]
    if (current) {
      const nextIndex = findSongIndex(queue.value, current)
      queueIndex.value = nextIndex >= 0 ? nextIndex : Math.min(queueIndex.value, Math.max(queue.value.length - 1, 0))
    } else {
      queueIndex.value = Math.min(queueIndex.value, Math.max(queue.value.length - 1, 0))
    }
    savePlayerSession()
  }

  function moveQueueItem(fromIndex, toIndex) {
    if (
      !Array.isArray(queue.value) ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= queue.value.length ||
      toIndex >= queue.value.length
    ) {
      return
    }

    const nextQueue = [...queue.value]
    const [item] = nextQueue.splice(fromIndex, 1)
    nextQueue.splice(toIndex, 0, item)
    reorderQueue(nextQueue)
  }

  async function togglePlay() {
    if (!currentSong.value) return
    if (isSpotifyActive.value && spotifyPlayer.value) {
      await spotifyPlayer.value.togglePlay()
      return
    }
    if (audio.value.paused) audio.value.play()
    else audio.value.pause()
  }

  async function next() {
    if (!queue.value.length) {
      isPlaying.value = false
      return
    }

    if (queueIndex.value < 0 || queueIndex.value >= queue.value.length) {
      queueIndex.value = currentSong.value ? findSongIndex(queue.value, currentSong.value) : 0
    }

    if (queueIndex.value < 0) queueIndex.value = 0

    let nextIndex
    if (shuffle.value) {
      if (queue.value.length === 1) {
        nextIndex = repeat.value === 'all' ? 0 : queueIndex.value + 1
      } else {
        do {
          nextIndex = Math.floor(Math.random() * queue.value.length)
        } while (nextIndex === queueIndex.value)
      }
    } else {
      nextIndex = queueIndex.value + 1
    }

    if (nextIndex >= queue.value.length) {
      if (repeat.value === 'all') {
        nextIndex = 0
      } else {
        isPlaying.value = false
        currentTime.value = 0
        savePlayerSession()
        return
      }
    }

    await playAtIndex(nextIndex)
  }

  async function prev() {
    if (currentTime.value > 3) {
      seek(0)
      return
    }
    if (!queue.value.length) return
    let prevIndex = queueIndex.value - 1
    if (prevIndex < 0) {
      prevIndex = repeat.value === 'all' ? queue.value.length - 1 : 0
    }
    await playAtIndex(prevIndex)
  }

  async function playAtIndex(index) {
    if (!queue.value.length) {
      isPlaying.value = false
      return
    }

    if (index < 0 || index >= queue.value.length) {
      isPlaying.value = false
      return
    }

    queueIndex.value = index
    const song = queue.value[index]
    await playSong(song, queue.value, index, playbackContext.value)
  }

  async function replayCurrentSong() {
    if (!currentSong.value) return
    currentListenStartAt.value = Date.now()
    currentListenSongId.value = getSongId(currentSong.value)
    currentHistoryId.value = null
    hasReportedCurrent.value = false

    if (isSpotifyActive.value && spotifyPlayer.value) {
      await playSong(currentSong.value, queue.value, queueIndex.value, playbackContext.value)
      return
    }
    try {
      audio.value.currentTime = 0
      isPlaying.value = true
      await audio.value.play()
    } catch (error) {
      isPlaying.value = false
      console.warn('[Player] replay failed:', error)
    }
  }

  async function handleTrackEnded() {
    if (currentSong.value && !hasReportedCurrent.value) {
      await trackCurrentSong({ completed: true })
    }

    if (repeat.value === 'one') {
      await replayCurrentSong()
      return
    }

    if (queue.value.length > 0) {
      const currentIndex =
        queueIndex.value >= 0 && queueIndex.value < queue.value.length
          ? queueIndex.value
          : findSongIndex(queue.value, currentSong.value)

      if (shuffle.value || currentIndex < queue.value.length - 1) {
        await next()
        return
      }

      if (repeat.value === 'all') {
        await playAtIndex(0)
        return
      }
    }

    const continued = await autoContinueQueue()
    if (continued) return

    isPlaying.value = false
    currentTime.value = 0
    savePlayerSession()
  }

  async function fetchAutoContinueSongs({ songId, artistId, genreId, source, excludeIds, limit = 20 }) {
    const response = await api.get(`/songs/${songId}/auto-continue`, {
      params: {
        artistId,
        genreId,
        source,
        excludeIds: Array.isArray(excludeIds) ? excludeIds.join(',') : excludeIds,
        limit
      }
    })

    return response.data?.data?.songs || response.data?.songs || []
  }

  async function autoContinueQueue() {
    if (isAutoContinuing) return false

    const current = currentSong.value
    const songId = getSongId(current)
    if (!current || !songId) return false

    isAutoContinuing = true
    try {
      const context = normalizePlaybackContext(current, playbackContext.value)
      const excludeIds = queue.value
        .map((song) => getSongId(song))
        .filter((id) => id !== null && id !== undefined)

      const songs = await fetchAutoContinueSongs({
        songId,
        artistId: context.artistId,
        genreId: context.genreId,
        source: context.source,
        excludeIds,
        limit: 20
      })

      if (!Array.isArray(songs) || songs.length === 0) return false

      const seenIds = new Set(queue.value.map((song) => String(getSongId(song))).filter(Boolean))
      const additions = songs.filter((song) => {
        const id = getSongId(song)
        if (!id || String(id) === String(songId) || seenIds.has(String(id))) return false
        seenIds.add(String(id))
        return true
      })

      if (!additions.length) return false

      const firstAddedIndex = queue.value.length
      queue.value = [...queue.value, ...additions]
      playbackContext.value = context

      const currentIndex =
        queueIndex.value >= 0 && queueIndex.value < queue.value.length
          ? queueIndex.value
          : findSongIndex(queue.value, current)
      const nextIndex = currentIndex >= 0 ? currentIndex + 1 : firstAddedIndex

      if (queue.value[nextIndex]) {
        await playAtIndex(nextIndex)
        return true
      }

      return false
    } catch (error) {
      console.error('[Player] autoContinueQueue failed:', error)
      return false
    } finally {
      isAutoContinuing = false
    }
  }

  async function seek(time) {
    if (isSpotifyActive.value && spotifyPlayer.value) {
      await spotifyPlayer.value.seek(time * 1000)
      currentTime.value = time
      return
    }
    audio.value.currentTime = time
    currentTime.value = time
  }

  function setVolume(v) {
    volume.value = Math.max(0, Math.min(1, v))
    if (!isSpotifyActive.value) {
      audio.value.volume = volume.value
    } else if (spotifyPlayer.value && spotifyReady.value) {
      spotifyPlayer.value.setVolume(volume.value)
    }
    savePlayerSession()
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
    savePlayerSession()
  }

  function toggleRepeat() {
    if (repeat.value === 'none') repeat.value = 'all'
    else if (repeat.value === 'all') repeat.value = 'one'
    else repeat.value = 'none'
    savePlayerSession()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (currentSong.value && !hasReportedCurrent.value) {
        const songId = getSongId(currentSong.value)
        const listenDuration = Math.floor((Date.now() - currentListenStartAt.value) / 1000)
        const songDuration = currentSong.value.duration_sec || duration.value || 0
        const completionRate = songDuration > 0 ? listenDuration / songDuration : 0
        
        const shouldTrack = listenDuration >= 30 || completionRate >= 0.5
        if (!shouldTrack) return

        const skipAt = Math.floor(currentTime.value)
        const source = playbackSource.value || 'unknown'
        if (localStorage.getItem('accessToken')) {
          api.post(`/songs/${songId}/listen`, {
            history_id: currentHistoryId.value,
            listen_duration: listenDuration,
            song_duration: Math.floor(songDuration),
            completion_rate: completionRate,
            is_completed: completionRate >= 0.8,
            is_skipped: (listenDuration < 30 && completionRate < 0.3),
            skip_at_sec: skipAt,
            source: source
          }).catch(err => console.warn(err))
        }
      }
    })
  }

  return {
    currentSong,
    queue,
    isPlaying,
    currentTime,
    duration,
    queueIndex,
    volume,
    shuffle,
    repeat,
    spotifyReady,
    spotifyError,
    isSpotifyActive,
    isNowPlayingExpanded,
    playSong,
    setSong: playSong,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    moveQueueItem,
    togglePlay,
    next,
    prev,
    playAtIndex,
    handleTrackEnded,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    playbackSource,
    playbackContext,
    hasReportedCurrent,
    trackCurrentSong,
    autoContinueQueue,
    sessionUserId,
    stopPlayback,
    clearRuntimePlayer,
    savePlayerSession,
    restorePlayerSession,
    clearPlayerSession
  }
})
