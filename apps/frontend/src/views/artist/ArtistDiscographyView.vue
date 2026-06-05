<template>
  <div class="artist-discography-page relative user-page-bg pb-4" v-if="artist" :style="{ '--artist-color': dominantColor }">
    
    <!-- Sticky Header -->
    <div class="sticky-header visible border-b border-white/10">
      <div class="flex items-center gap-4 px-6 h-full">
        <button 
          @click="$router.push(`/artist/${artist.id}`)"
          class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <svg viewBox="0 0 24 24" class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h2 class="text-2xl font-bold text-white">{{ artist.name }}</h2>
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-wrapper pt-24 px-6 md:px-8">
      <div class="content-bg-gradient"></div>
      
      <div class="relative z-10">
        <h1 class="text-3xl font-bold text-white mb-8">Danh sách đĩa nhạc</h1>
        
        <!-- Tabs -->
        <div class="flex gap-2 mb-8 border-b border-white/10 pb-4">
          <button 
            class="px-5 py-2 rounded-full text-sm font-bold transition-colors"
            :class="activeTab === 'all' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'"
            @click="activeTab = 'all'"
          >
            Tất cả
          </button>
          <button 
            v-if="artist.singles?.length"
            class="px-5 py-2 rounded-full text-sm font-bold transition-colors"
            :class="activeTab === 'singles' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'"
            @click="activeTab = 'singles'"
          >
            Singles ({{ artist.singles.length }})
          </button>
          <button 
            v-if="artist.albums?.length"
            class="px-5 py-2 rounded-full text-sm font-bold transition-colors"
            :class="activeTab === 'albums' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'"
            @click="activeTab = 'albums'"
          >
            Albums ({{ artist.albums.length }})
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          <div 
            v-for="item in displayedItems" 
            :key="item.id"
            class="release-card user-card user-card-hover p-4 group cursor-pointer relative"
            @click="$router.push(`/album/${item.id}`)"
          >
            <div class="relative w-full aspect-square mb-4 shadow-lg rounded-md overflow-hidden">
              <CoverImage :src="getItemCover(item)" />
              <button 
                class="absolute bottom-2 right-2 user-play-btn w-12 h-12 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                @click.stop="$router.push(`/album/${item.id}`)"
              >
                <svg viewBox="0 0 24 24" class="w-6 h-6 fill-black ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
            </div>
            <h3 class="text-base font-bold text-white truncate mb-1">{{ item.title }}</h3>
            <p class="text-sm text-gray-400 truncate">{{ item.album_type === 'single' ? 'Single' : `Album • ${item.total_tracks} bài` }}</p>
          </div>
        </div>
        
        <div v-if="displayedItems.length === 0" class="text-gray-400 text-center py-12">
          Không có đĩa nhạc nào để hiển thị.
        </div>
      </div>
    </div>
  </div>

  <!-- Loading & Error States -->
  <div v-else-if="loading" class="user-page-bg flex items-center justify-center">
    <div class="w-12 h-12 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
  </div>
  <div v-else-if="error" class="user-page-bg flex flex-col items-center justify-center text-center px-4">
    <svg class="w-16 h-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
    <h2 class="text-2xl font-bold text-white mb-2">Không tìm thấy nghệ sĩ</h2>
    <p class="text-gray-400 mb-6">{{ error }}</p>
    <button @click="$router.push('/')" class="px-6 py-2 bg-white text-black rounded-full font-bold hover:scale-105 transition">Trang chủ</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { extractDominantColor } from '@/utils/colorPalette'
import CoverImage from '@/components/common/CoverImage.vue'
import { getItemCover } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()

const artist = ref(null)
const loading = ref(true)
const error = ref('')
const dominantColor = ref('32, 32, 32')

const activeTab = ref('all')

const displayedItems = computed(() => {
  if (!artist.value) return []
  const singles = artist.value.singles || []
  const albums = artist.value.albums || []
  
  if (activeTab.value === 'singles') return singles
  if (activeTab.value === 'albums') return albums
  
  // Mix both and sort by release date? They are usually already sorted from backend.
  // For 'all', we just concat albums then singles
  return [...albums, ...singles]
})

const getAvatarUrl = (item) => {
  if (!item) return '/default-artist.png'
  let url = item.avatar_url || item.avatarUrl || item.image_url || item.thumbnail_url || item.avatar || '/default-artist.png'
  if (url.startsWith('http') || url.startsWith('/default-')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}

async function loadArtist() {
  loading.value = true
  error.value = ''
  artist.value = null
  dominantColor.value = '32, 32, 32'
  
  try {
    const res = await api.get(`/artists/${route.params.id}`)
    if (res.data.success) {
      artist.value = res.data.data
      
      if (artist.value.avatar_url || artist.value.avatar) {
        dominantColor.value = await extractDominantColor(getAvatarUrl(artist.value))
      }
    } else {
      error.value = res.data.message || 'Lỗi khi tải dữ liệu'
    }
  } catch (err) {
    console.error('Fetch artist error:', err)
    error.value = 'Không thể lấy thông tin nghệ sĩ'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, () => {
  if (route.name === 'ArtistDiscography') {
    loadArtist()
    window.scrollTo(0, 0)
  }
})

onMounted(() => {
  loadArtist()
})
</script>

<style scoped>
.artist-discography-page {
  overflow-x: hidden;
}

.sticky-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(var(--artist-color), 0.95);
  backdrop-filter: blur(16px);
  z-index: 50;
}

.content-wrapper {
  position: relative;
}

.content-bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 300px;
  background: linear-gradient(180deg, rgba(var(--artist-color), 0.25) 0%, rgba(15,23,42,0) 100%);
  z-index: 1;
  pointer-events: none;
}
</style>
