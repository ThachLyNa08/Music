<template>
  <div class="mt-8 pb-8 pt-4">
    <!-- Search Bar -->
    <div class="relative max-w-lg mb-6 flex items-center">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <input 
        ref="searchInput"
        v-model="keyword"
        type="text" 
        placeholder="Tìm bài hát, nghệ sĩ hoặc podcast..." 
        class="user-input text-sm rounded-full pl-10 pr-10 py-3"
        @input="handleInput"
      />
      <button 
        v-if="keyword"
        @click="clearSearch"
        class="absolute inset-y-0 right-10 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <!-- Close Inline Search Button -->
      <button 
        @click="$emit('close')"
        class="absolute -right-12 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
        title="Đóng tìm kiếm"
      >
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- State Messages -->
    <div v-if="loading" class="flex justify-center py-10">
      <svg class="animate-spin h-6 w-6 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
    
    <div v-else-if="keyword.trim().length >= 2 && results.length === 0 && !error" class="text-center py-10 text-gray-400 text-sm">
      Không tìm thấy kết quả nào cho "{{ keyword }}"
    </div>
    
    <div v-else-if="error" class="text-center py-10 text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Search Results List -->
    <div v-else-if="keyword.trim().length >= 2 && results.length > 0" class="flex flex-col gap-1">
      <div 
        v-for="song in results" 
        :key="song.id"
        class="group flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors"
      >
        <div class="flex items-center gap-3 overflow-hidden flex-1 pr-4">
          <img 
            :src="getSongImage(song)" 
            :alt="song.title || 'Unknown'"
            class="w-10 h-10 rounded bg-gray-800 object-cover flex-shrink-0"
            @error="handleImageError"
          />
          <div class="flex flex-col overflow-hidden">
            <span class="text-white text-sm font-medium truncate">{{ song.title || 'Unknown Title' }}</span>
            <span class="text-gray-400 text-xs truncate">
              {{ song.artist_name || song.artist?.name || (song.artists ? song.artists.map(a => a?.name).join(', ') : 'Unknown Artist') }}
            </span>
          </div>
          <div class="hidden md:block flex-1 text-gray-400 text-xs truncate ml-4">
            {{ song.album_title || song.album?.title || '' }}
          </div>
        </div>

        <button 
          v-if="!isAdded(song.id)"
          @click="$emit('add-song', song)"
          class="flex-shrink-0 text-xs font-bold text-white px-4 py-1.5 rounded-full border border-gray-600 hover:border-white hover:scale-105 transition-all"
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

    <!-- Recommendations Fallback (when keyword is empty) -->
    <div v-else-if="keyword.trim().length < 2">
      <div class="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider pl-2">Gợi ý</div>
      <div v-if="recLoading" class="flex justify-center py-4">
        <svg class="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      </div>
      <div v-else-if="recommendations.length > 0" class="flex flex-col gap-1">
        <div 
          v-for="song in filteredRecommendations" 
          :key="song.id"
          class="group flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors"
        >
          <div class="flex items-center gap-3 overflow-hidden flex-1 pr-4">
            <img 
              :src="getSongImage(song)" 
              :alt="song.title || 'Unknown'"
              class="w-10 h-10 rounded bg-gray-800 object-cover flex-shrink-0"
              @error="handleImageError"
            />
            <div class="flex flex-col overflow-hidden">
              <span class="text-white text-sm font-medium truncate">{{ song.title || 'Unknown Title' }}</span>
              <span class="text-gray-400 text-xs truncate">
                {{ song.artist_name || song.artist?.name || (song.artists ? song.artists.map(a => a?.name).join(', ') : 'Unknown Artist') }}
              </span>
            </div>
            <div class="hidden md:block flex-1 text-gray-400 text-xs truncate ml-4">
              {{ song.album_title || song.album?.title || '' }}
            </div>
          </div>

          <button 
            v-if="!isAdded(song.id)"
            @click="$emit('add-song', song)"
            class="flex-shrink-0 text-xs font-bold text-white px-4 py-1.5 rounded-full border border-gray-600 hover:border-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 sm:opacity-100"
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'
import { recommendApi } from '@/api/recommend'
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
  }
})

defineEmits(['add-song', 'close'])

const searchInput = ref(null)
const keyword = ref('')
const loading = ref(false)
const results = ref([])
const error = ref('')

// Recommendations state
const recLoading = ref(false)
const recommendations = ref([])

let debounceTimer = null

const filteredRecommendations = computed(() => recommendations.value.slice(0, 10))

onMounted(() => {
  if (searchInput.value) {
    searchInput.value.focus()
  }
  fetchRecommendations()
})

async function fetchRecommendations() {
  recLoading.value = true
  try {
    const res = await recommendApi.getHomeRecommendations()
    recommendations.value = normalizeRecommendedSongs(res)
  } catch (error) {
    console.error('Failed to fetch recommendations in search:', error)
    recommendations.value = []
  } finally {
    recLoading.value = false
  }
}

function normalizeRecommendedSongs(res) {
  const data = res?.data ?? res
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.songs)) return data.songs
  if (Array.isArray(data?.personalized)) return data.personalized
  if (Array.isArray(data?.recommendations)) return data.recommendations
  if (Array.isArray(data?.forYou)) return data.forYou
  if (Array.isArray(data?.trending)) return data.trending
  if (Array.isArray(data?.data?.songs)) return data.data.songs
  if (Array.isArray(data?.data?.personalized)) return data.data.personalized
  if (Array.isArray(data?.data?.recommendations)) return data.data.recommendations
  if (Array.isArray(data?.data?.trending)) return data.data.trending
  return []
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  error.value = ''
  if (searchInput.value) searchInput.value.focus()
}

function handleInput() {
  clearTimeout(debounceTimer)
  const query = keyword.value.trim()
  
  if (query.length < 2) {
    results.value = []
    error.value = ''
    return
  }
  
  debounceTimer = setTimeout(() => {
    performSearch(query)
  }, 300)
}

async function performSearch(query) {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/songs/search', { params: { q: query } })
    results.value = normalizeSearchSongs(res)
  } catch (err) {
    console.error('Search failed:', err)
    error.value = 'Đã có lỗi xảy ra khi tìm kiếm.'
    results.value = []
  } finally {
    loading.value = false
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
  
  return songs.filter(s => s && s.id)
}

function isAdded(id) {
  return props.existingSongIds.has(id)
}

function isAdding(id) {
  return props.addingSongIds.has(id)
}

function getSongImage(song) {
  return getItemCover(song)
}

function handleImageError(e) {
  e.target.src = DEFAULT_COVER
}
</script>
