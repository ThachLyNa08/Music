<template>
  <div class="followed-artists-page user-page-bg pb-4">
    <!-- Header -->
    <div class="user-panel mx-6 mt-6 flex flex-col sm:flex-row sm:items-end gap-6">
      <div class="w-32 h-32 shrink-0 shadow-2xl rounded-full overflow-hidden hidden sm:block">
        <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.followedArtists)" alt="Followed Artists" class="w-full h-full object-cover" />
      </div>
      <div>
        <div class="flex items-center gap-3 mb-2">
          <button @click="$router.back()" class="text-gray-400 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
          <span class="text-sm text-gray-400 font-bold uppercase tracking-widest text-white/80">Thư viện</span>
        </div>
        <h1 class="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter">Nghệ sĩ đã theo dõi</h1>
        <p class="text-gray-400 font-medium">Những nghệ sĩ bạn quan tâm</p>
      </div>
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
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="pagination-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">&lt;</button>
        <div class="pagination-pages">
          <button v-for="page in totalPages" :key="`page-${page}`" class="page-dot" :class="{ active: page === currentPage }" @click="goToPage(page)">{{ page }}</button>
        </div>
        <span class="pagination-label">Trang {{ currentPage }} / {{ totalPages }}</span>
        <button class="pagination-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">&gt;</button>
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
  updateItemsPerPage()
  window.addEventListener('resize', updateItemsPerPage)
  fetchArtists()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateItemsPerPage)
})
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
  margin-bottom: 12px;
  width: 100%;
}

.pagination-pages {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-btn,
.page-dot {
  min-width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.pagination-btn:hover:not(:disabled),
.page-dot:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.pagination-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-dot.active {
  background: #7C3AED;
  border-color: #7C3AED;
  color: #ffffff;
}

.pagination-label {
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  font-weight: 700;
  min-width: 86px;
  text-align: center;
}

@media (max-width: 639px) {
  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }
  .pagination-label {
    order: 3;
    width: 100%;
  }
}
</style>
