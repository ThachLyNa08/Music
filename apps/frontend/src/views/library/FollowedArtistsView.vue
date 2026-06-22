<template>
  <div class="followed-artists-page user-page-bg pb-4">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden px-8 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img
        :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.followedArtists)"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.32] scale-[1.18] blur-[30px] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay with Purple Tint -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/80 to-[#8b5cf6]/20 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-6 sm:gap-8 w-full">
        <!-- Foreground Avatar -->
        <div class="w-[120px] h-[120px] lg:w-[160px] lg:h-[160px] rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-2 border-white/10 flex-shrink-0 overflow-hidden">
          <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.followedArtists)" alt="Followed Artists" class="w-full h-full object-cover" />
        </div>
        
        <div class="flex flex-col gap-1 min-w-0 flex-1 text-center sm:text-left">
          <span class="hidden sm:block text-sm font-bold uppercase tracking-wider text-white/70 mb-1">Hồ sơ</span>
          <h1 class="text-4xl sm:text-5xl lg:text-[72px] font-black leading-[1.1] text-white tracking-tight mb-2 drop-shadow-lg">Nghệ sĩ đã theo dõi</h1>
          <p class="text-white/70 font-medium text-sm sm:text-base mb-1">Những nghệ sĩ bạn quan tâm</p>
          <div class="flex items-center justify-center sm:justify-start gap-2 text-sm text-white/50 font-semibold">
            <span class="text-white font-bold">{{ artists.length }}</span>
            <span>nghệ sĩ</span>
          </div>
        </div>
      </div>
    </section>

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
      <div class="w-24 h-24 rounded-full flex items-center justify-center mb-6 overflow-hidden bg-white/5">
        <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.followedArtists)" alt="Followed Artists" class="w-full h-full object-cover" />
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
          v-for="artist in paginatedArtists"
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

        <!-- Placeholders để giữ nguyên chiều cao của Grid ở trang cuối -->
        <div 
          v-for="i in (itemsPerPage - paginatedArtists.length)" 
          :key="`placeholder-${i}`" 
          class="invisible pointer-events-none"
        >
          <ArtistCard :artist="{ name: 'Placeholder' }" />
        </div>
      </div>

      <!-- Pagination -->
      <div class="mt-8 mb-4">
        <UserPagination 
          v-if="artists.length > 0"
          v-model:page="currentPage" 
          v-model:limit="itemsPerPage"
          :total="artists.length" 
          :showPageSize="false"
        />
      </div>
    </div>

    <ToastManager ref="toastManager" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFollowedArtistsStore } from '@/stores/followedArtists'
import ToastManager from '@/components/common/ToastManager.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'
import UserPagination from '@/components/common/UserPagination.vue'
import { DEFAULT_SPECIAL_COVERS, normalizeAssetUrl } from '@/utils/imageUrl'

const router = useRouter()
const authStore = useAuthStore()
const followedArtistsStore = useFollowedArtistsStore()

const artists = ref([])
const loading = ref(true)
const error = ref('')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(12)

const totalPages = computed(() => Math.max(1, Math.ceil(artists.value.length / itemsPerPage.value)))
const paginatedArtists = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return artists.value.slice(start, start + itemsPerPage.value)
})

function updateItemsPerPage() {
  const width = window.innerWidth
  if (width < 640) itemsPerPage.value = 8
  else if (width < 1024) itemsPerPage.value = 10
  else itemsPerPage.value = 12
}

function goToPage(page) {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(artists, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

const toastManager = ref(null)
const showToast = (msg, type = 'success') => toastManager.value?.addToast(msg, type)

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
    showToast('Vui lòng đăng nhập', 'warning')
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
    showToast('Có lỗi xảy ra', 'error')
  }
}

onMounted(() => {
  updateItemsPerPage()
  window.addEventListener('resize', updateItemsPerPage)
  fetchArtists()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateItemsPerPage)
})
</script>
