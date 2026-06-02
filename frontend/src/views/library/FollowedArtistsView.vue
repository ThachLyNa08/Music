<template>
  <div class="followed-artists-page user-page-bg pb-4">
    <!-- Header -->
    <div class="user-panel mx-6 mt-6">
      <div class="flex items-center gap-3 mb-2">
        <button @click="$router.back()" class="text-gray-400 hover:text-white transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <span class="text-sm text-gray-400">Thư viện</span>
      </div>
      <h1 class="text-4xl font-black text-white">Nghệ sĩ đã theo dõi</h1>
      <p class="text-gray-400 mt-2">Những nghệ sĩ bạn quan tâm</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-12 h-12 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center py-20 px-6 text-center">
      <svg class="w-16 h-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <p class="text-red-400 text-lg">{{ error }}</p>
      <button @click="fetchArtists" class="mt-4 px-6 py-2 bg-white text-black rounded-full font-bold hover:scale-105 transition">
        Thử lại
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="artists.length === 0" class="flex flex-col items-center py-20 px-6 text-center">
      <div class="w-24 h-24 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="white" class="w-12 h-12 opacity-70">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
      <h2 class="text-2xl font-bold text-white mb-3">Bạn chưa theo dõi nghệ sĩ nào</h2>
      <p class="text-gray-400 max-w-md mb-8">Hãy khám phá nghệ sĩ yêu thích để nhận gợi ý phù hợp hơn và theo dõi họ tại đây.</p>
      <button @click="$router.push('/')" class="user-primary-btn">
        Khám phá ngay
      </button>
    </div>

    <!-- Artists Grid -->
    <div v-else class="user-panel-soft mx-6">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <div
          v-for="artist in artists"
          :key="artist.id || artist.artist_id"
          class="relative group"
        >
          <ArtistCard :artist="artist" />
          <button
            class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80 hover:scale-110"
            @click.stop="handleUnfollow(artist)"
            title="Bỏ theo dõi"
          >
            <svg viewBox="0 0 24 24" fill="white" class="w-4 h-4">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <ToastManager ref="toastManager" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFollowedArtistsStore } from '@/stores/followedArtists'
import ToastManager from '@/components/common/ToastManager.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'

const router = useRouter()
const authStore = useAuthStore()
const followedArtistsStore = useFollowedArtistsStore()

const artists = ref([])
const loading = ref(true)
const error = ref('')

const toastManager = ref(null)
const showToast = (msg) => toastManager.value?.addToast(msg)

const localFormatImageUrl = (url) => {
  if (!url) return '/default-artist.png'
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}

async function fetchArtists() {
  loading.value = true
  error.value = ''
  
  try {
    // Sử dụng store hoặc gọi trực tiếp API
    await followedArtistsStore.fetchFollowedArtists()
    artists.value = followedArtistsStore.followedArtists
  } catch (err) {
    console.error('Fetch followed artists error:', err)
    error.value = 'Không thể tải danh sách nghệ sĩ'
  } finally {
    loading.value = false
  }
}

async function handleUnfollow(artist) {
  if (!authStore.isLoggedIn) {
    showToast('Vui lòng đăng nhập')
    router.push('/login')
    return
  }

  try {
    await followedArtistsStore.unfollowArtist(artist.id)
    // Xóa khỏi danh sách local
    artists.value = artists.value.filter(a => a.id !== artist.id)
    showToast(`Đã bỏ theo dõi ${artist.name}`)
  } catch (err) {
    console.error('Unfollow error:', err)
    showToast('Có lỗi xảy ra')
  }
}

onMounted(() => {
  fetchArtists()
})
</script>

<style scoped>
.followed-artists-page {
  font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

</style>
