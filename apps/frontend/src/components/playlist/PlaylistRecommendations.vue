<template>
  <div class="mt-4 pb-8">
    <div class="flex items-end justify-between mb-6">
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold text-white m-0">Đề xuất</h3>
        <p class="text-sm text-gray-400 m-0">
          {{ isEmpty ? 'Dựa trên sở thích nghe nhạc của bạn' : 'Dựa trên nội dung có trong danh sách phát này' }}
        </p>
      </div>
      <button 
        v-if="!isSearchMode"
        @click="openSearch"
        class="text-sm font-bold text-white bg-transparent border-none hover:underline cursor-pointer px-0"
      >
        Tìm thêm
      </button>
    </div>

    <!-- Search Input Area -->
    <div v-if="isSearchMode" class="mb-6 relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </div>
      <input 
        ref="searchInput"
        v-model="keyword"
        type="text"
        placeholder="Tìm kiếm bài hát hoặc tập tin podcast"
        class="w-full bg-gray-800 text-white text-sm rounded-md pl-10 pr-24 py-3 border border-transparent focus:border-gray-600 focus:bg-gray-700 focus:outline-none transition-colors"
        @input="handleInput"
      />
      <button 
        v-if="keyword" 
        @click="clearSearch"
        class="absolute inset-y-0 right-10 pr-2 flex items-center text-gray-400 hover:text-white bg-transparent border-none cursor-pointer"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <button 
        @click="closeSearch"
        class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white bg-transparent border-none cursor-pointer"
      >
        Đóng
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <svg class="animate-spin h-6 w-6 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Search Error / Not Found -->
    <div v-else-if="isSearchMode && keyword.trim().length >= 2 && displaySongs.length === 0 && !error" class="text-center py-8 text-gray-400 text-sm">
      Không tìm thấy kết quả nào cho "{{ keyword }}"
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Empty Recommendations -->
    <div v-else-if="!isSearchMode && displaySongs.length === 0" class="text-center py-8 text-gray-400 text-sm">
      Không tìm thấy đề xuất phù hợp. Hãy thử tìm bài hát cụ thể!
    </div>

    <!-- Song List -->
    <div v-else class="flex flex-col gap-1">
      <div 
        v-for="song in displaySongs" 
        :key="song.id"
        class="group flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors"
      >
        <div class="flex items-center gap-3 overflow-hidden flex-1 pr-4">
          <img 
            :src="getSongImage(song)" 
            :alt="song.title"
            class="w-10 h-10 rounded bg-gray-800 object-cover flex-shrink-0"
            @error="handleImageError"
          />
          <div class="flex flex-col overflow-hidden">
            <span class="text-white text-sm font-medium truncate">{{ song.title }}</span>
            <span class="text-gray-400 text-xs truncate">
              {{ song.artist_name }}
            </span>
          </div>
          <div class="hidden md:block flex-1 text-gray-400 text-xs truncate ml-4">
            {{ song.album_title }}
          </div>
        </div>

        <button 
          v-if="!isAdded(song.id)"
          @click="handleAdd(song)"
          class="flex-shrink-0 text-xs font-bold text-white px-4 py-1.5 rounded-full border border-gray-600 hover:border-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 sm:opacity-100 cursor-pointer"
          :disabled="isAdding(song.id)"
        >
          <span v-if="isAdding(song.id)">Đang thêm...</span>
          <span v-else>Thêm</span>
        </button>
        <button 
          v-else
          disabled
          class="flex-shrink-0 text-xs font-bold text-emerald-500 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 cursor-default"
        >
          Đã thêm
        </button>
      </div>
    </div>

    <!-- Refresh Button -->
    <div v-if="!isSearchMode && displaySongs.length > 0" class="mt-4 flex justify-end">
      <button 
        @click="refreshRecommendations" 
        :disabled="isRefreshing"
        class="text-sm font-bold text-gray-300 hover:text-white uppercase tracking-wider bg-transparent border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isRefreshing">Đang làm mới...</span>
        <span v-else>Làm mới</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { songApi } from '@/api/song'
import api from '@/api/axios'
import { getItemCover, DEFAULT_COVER } from '@/utils/imageUrl'

const props = defineProps({
  playlistId: {
    type: [String, Number],
    required: false
  },
  existingSongIds: {
    type: Set,
    default: () => new Set()
  },
  addingSongIds: {
    type: Set,
    default: () => new Set()
  },
  isEmpty: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add-song'])

const RECOMMEND_LIMIT = 5

// State
const isSearchMode = ref(false)
const keyword = ref('')
const loading = ref(true)
const isRefreshing = ref(false)
const error = ref('')
const searchInput = ref(null)

const recommendations = ref([])
const candidatePool = ref([])
const searchResults = ref([])
let debounceTimer = null

onMounted(async () => {
  await fetchRecommendations()
})

const displaySongs = computed(() => {
  if (isSearchMode.value && keyword.value.trim().length >= 2) {
    return searchResults.value.slice(0, RECOMMEND_LIMIT)
  }
  return recommendations.value.slice(0, RECOMMEND_LIMIT)
})

function isAdded(id) {
  return props.existingSongIds.has(String(id))
}

function isAdding(id) {
  return props.addingSongIds.has(String(id))
}

function handleAdd(song) {
  emit('add-song', song)
  // Optimistically remove the added song from current recommendations
  recommendations.value = recommendations.value.filter(s => String(s.id) !== String(song.id))
  
  // Pump 1 new song from the pool to keep exactly 5 items
  if (recommendations.value.length < RECOMMEND_LIMIT) {
    if (candidatePool.value.length > 0) {
      recommendations.value.push(candidatePool.value.shift())
    } else {
      fetchMoreCandidatesInBackground()
    }
  }
}

async function fetchMoreCandidatesInBackground() {
  try {
    let raw = await fetchRecommendationCandidates()
    let valid = filterValidSongs(raw)
    
    if (valid.length < RECOMMEND_LIMIT) {
      const fallbackRaw = await fetchFallbackSongs()
      valid = [...valid, ...filterValidSongs(fallbackRaw)]
    }
    
    const currentIds = new Set(recommendations.value.map(s => String(s.id)))
    const fresh = valid.filter(s => !currentIds.has(String(s.id)))
    
    candidatePool.value = [...candidatePool.value, ...shuffleArray(fresh)]
    
    while (recommendations.value.length < RECOMMEND_LIMIT && candidatePool.value.length > 0) {
      recommendations.value.push(candidatePool.value.shift())
    }
  } catch (e) {
    console.warn('Background fetch failed:', e)
  }
}

function openSearch() {
  isSearchMode.value = true
  nextTick(() => {
    if (searchInput.value) searchInput.value.focus()
  })
}

function closeSearch() {
  isSearchMode.value = false
  keyword.value = ''
  searchResults.value = []
}

function clearSearch() {
  keyword.value = ''
  searchResults.value = []
  if (searchInput.value) searchInput.value.focus()
}

function handleInput() {
  clearTimeout(debounceTimer)
  
  if (keyword.value.trim().length < 2) {
    searchResults.value = []
    error.value = ''
    return
  }

  loading.value = true
  error.value = ''

  debounceTimer = setTimeout(async () => {
    try {
      const res = await api.get('/songs/search', { params: { q: keyword.value } })
      searchResults.value = normalizeSearchSongs(res)
    } catch (err) {
      console.error('Search failed:', err)
      error.value = 'Lỗi khi tìm kiếm'
    } finally {
      loading.value = false
    }
  }, 300)
}

function uniqueSongsById(songs) {
  const seen = new Set()
  return songs.filter(song => {
    const id = song?.id ?? song?.song_id
    if (!id) return false
    const key = String(id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function filterValidSongs(rawSongs) {
  const existingSet = new Set(Array.from(props.existingSongIds).map(id => String(id)))

  return uniqueSongsById(
    rawSongs
      .map(normalizeSong)
      .filter(Boolean)
      .filter(song => song.id && song.title && song.artist_name)
      .filter(song => !existingSet.has(String(song.id)))
  )
}

function pickRecommendedSongs(rawSongs, options = { avoidCurrent: false }) {
  const validSongs = filterValidSongs(rawSongs)

  if (validSongs.length === 0) {
    return []
  }

  if (!options.avoidCurrent) {
    return shuffleArray(validSongs).slice(0, RECOMMEND_LIMIT)
  }

  const currentSet = new Set(
    recommendations.value.map(song => String(song.id))
  )

  const freshSongs = validSongs.filter(song => !currentSet.has(String(song.id)))
  const oldButValidSongs = validSongs.filter(song => currentSet.has(String(song.id)))

  const picked = [
    ...shuffleArray(freshSongs),
    ...shuffleArray(oldButValidSongs)
  ]

  return uniqueSongsById(picked).slice(0, RECOMMEND_LIMIT)
}

async function fetchRecommendationCandidates() {
  try {
    const res = await songApi.getRecommended()
    return normalizeRecommendedSongs(res)
  } catch (err) {
    console.warn('[PlaylistRecommendations] failed to fetch candidates:', err)
    return []
  }
}

async function fetchFallbackSongs() {
  try {
    const res = await api.get('/songs/trending', { params: { limit: 50 } }).catch(() => api.get('/songs', { params: { limit: 50 } }))
    return normalizeRecommendedSongs(res)
  } catch (err) {
    console.error('[PlaylistRecommendations] fallback songs failed:', err)
    return []
  }
}

async function fetchRecommendations() {
  loading.value = true
  try {
    let raw = await fetchRecommendationCandidates()
    let valid = filterValidSongs(raw)
    
    if (valid.length < RECOMMEND_LIMIT) {
      const fallbackRaw = await fetchFallbackSongs()
      valid = [...valid, ...filterValidSongs(fallbackRaw)]
    }
    
    valid = uniqueSongsById(valid)
    candidatePool.value = shuffleArray(valid)
    recommendations.value = candidatePool.value.splice(0, RECOMMEND_LIMIT)
  } catch (err) {
    console.error('[PlaylistRecommendations] fetch failed:', err)
  } finally {
    loading.value = false
  }
}

async function refreshRecommendations() {
  isRefreshing.value = true
  const currentIds = new Set(recommendations.value.map(s => String(s.id)))
  
  try {
    if (candidatePool.value.length < RECOMMEND_LIMIT) {
      let raw = await fetchRecommendationCandidates()
      let valid = filterValidSongs(raw)
      
      if (valid.length < RECOMMEND_LIMIT * 2) {
        const fallbackRaw = await fetchFallbackSongs()
        valid = [...valid, ...filterValidSongs(fallbackRaw)]
      }
      
      valid = uniqueSongsById(valid)
      const fresh = valid.filter(s => !currentIds.has(String(s.id)))
      candidatePool.value = [...candidatePool.value, ...shuffleArray(fresh)]
    }
    
    const newSongs = []
    // Pick up to RECOMMEND_LIMIT songs from pool that are completely different from current
    while(newSongs.length < RECOMMEND_LIMIT && candidatePool.value.length > 0) {
      const candidate = candidatePool.value.shift()
      if (!currentIds.has(String(candidate.id))) {
        newSongs.push(candidate)
      }
    }
    
    if (newSongs.length > 0) {
      recommendations.value = newSongs
    }
  } catch (err) {
    console.error('[PlaylistRecommendations] refresh failed:', err)
  } finally {
    isRefreshing.value = false
  }
}

function normalizeSong(item) {
  if (!item) return null

  const base = item?.song || item?.track || item?.music || item

  const id = base?.id ?? base?.song_id ?? item?.song_id ?? item?.id
  const title = base?.title ?? base?.name ?? base?.song_title ?? item?.title ?? item?.name
  const artistName =
    base?.artist_name ??
    (typeof base?.artist === 'string' ? base.artist : base?.artist?.name) ??
    (Array.isArray(base?.artists) ? base.artists.map(a => a?.name).join(', ') : null) ??
    item?.artist_name ??
    (typeof item?.artist === 'string' ? item.artist : item?.artist?.name) ??
    'Unknown Artist'

  const albumTitle =
    base?.album_title ??
    base?.album?.title ??
    base?.album?.name ??
    item?.album_title ??
    item?.album?.title

  const coverUrl =
    base?.cover_url ??
    base?.image_url ??
    base?.thumbnail ??
    base?.album_cover ??
    base?.album?.cover_url ??
    base?.album?.image_url ??
    item?.cover_url ??
    item?.image_url

  if (!id || !title || !artistName) return null

  return {
    ...base,
    id,
    title,
    artist_name: artistName,
    album_title: albumTitle || '',
    cover_url: coverUrl || '',
  }
}

function normalizeSearchSongs(res) {
  const data = res?.data ?? res
  if (!data) return []
  let songs = []
  if (Array.isArray(data)) songs = data
  else if (Array.isArray(data.songs)) songs = data.songs
  else if (Array.isArray(data.results?.songs)) songs = data.results.songs
  else if (Array.isArray(data.data?.songs)) songs = data.data.songs
  else if (Array.isArray(data.tracks)) songs = data.tracks
  
  return songs.map(normalizeSong).filter(song => song !== null)
}

function normalizeRecommendedSongs(res) {
  const data = res?.data ?? res

  const candidates = [
    data,
    data?.data,
    data?.songs,
    data?.data?.songs,
    data?.recommendations,
    data?.data?.recommendations,
    data?.personalized,
    data?.data?.personalized,
    data?.forYou,
    data?.data?.forYou,
    data?.trending,
    data?.data?.trending,
    data?.weeklyMix,
    data?.data?.weeklyMix,
    data?.recentlyPlayedBased,
    data?.data?.recentlyPlayedBased,
  ]

  for (const item of candidates) {
    if (Array.isArray(item)) return item
  }

  const objectData = data?.data ?? data
  if (objectData && typeof objectData === 'object') {
    const merged = []
    for (const key of Object.keys(objectData)) {
      if (Array.isArray(objectData[key])) {
        merged.push(...objectData[key])
      }
      if (Array.isArray(objectData[key]?.songs)) {
        merged.push(...objectData[key].songs)
      }
      if (Array.isArray(objectData[key]?.items)) {
        merged.push(...objectData[key].items)
      }
    }
    return merged
  }

  return []
}

function getSongImage(song) {
  return song?.cover_url || getItemCover(song)
}

function handleImageError(e) {
  e.target.src = DEFAULT_COVER
}
</script>
