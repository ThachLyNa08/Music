<template>
  <div class="top-artists-page user-page-bg font-inter pb-8">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden w-full px-6 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img 
        :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.topArtists)"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.38] scale-[1.18] blur-[34px] saturate-[1.15] pointer-events-none"
      />
      <!-- Dark Overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,20,0.88),rgba(9,11,20,0.68),rgba(9,11,20,0.95))] z-0 pointer-events-none"></div>
      <!-- Tint Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-transparent to-indigo-500/10 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-center lg:items-center gap-6 md:gap-8 max-w-[1400px] mx-auto">
        <!-- Foreground Cover -->
        <div class="w-[160px] h-[160px] lg:w-[200px] lg:h-[200px] rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0 overflow-hidden bg-white/5">
          <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.topArtists)" alt="Top Artists" class="w-full h-full object-cover" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1 text-center lg:text-left w-full">
          <div class="hidden lg:flex items-center gap-2 mb-0.5 w-max text-xs font-bold uppercase tracking-wider text-white/70">
            <span class="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md font-black uppercase tracking-widest border border-indigo-500/30">HỒ SƠ</span>
          </div>

          <h1 class="text-4xl md:text-5xl lg:text-[64px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-1">Nghệ sĩ hàng đầu</h1>
          
          <p class="text-gray-300 font-medium text-sm lg:text-base mt-1 line-clamp-2 max-w-3xl">
            Những nghệ sĩ bạn nghe nhiều nhất
          </p>

          <div class="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-4">
            <span class="text-sm md:text-base font-semibold text-gray-300 flex items-center">
              {{ artists.length }} nghệ sĩ 
              <span class="w-1 h-1 bg-white/30 rounded-full mx-2"></span>
              Cập nhật theo lượt nghe gần đây
            </span>
            <select v-model="timeRange" @change="handleTimeRangeChange" class="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/30 text-indigo-300 font-bold px-4 py-2 rounded-full hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:scale-105 transition-all shadow-lg cursor-pointer appearance-none outline-none w-max text-sm">
              <option value="this_month" class="bg-zinc-800 text-white">Tháng này</option>
              <option value="last_30_days" class="bg-zinc-800 text-white">30 ngày qua</option>
              <option value="all_time" class="bg-zinc-800 text-white">Tất cả thời gian</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- Content -->
    <main class="user-panel-soft mx-6 md:mx-10 mt-8">
      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-12 h-12 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="error" class="flex flex-col items-center py-20">
        <p class="text-red-400 text-lg">{{ error }}</p>
      </div>

      <div v-else-if="artists.length === 0" class="flex flex-col items-center py-20">
        <p class="text-gray-400 text-lg">Chưa có nghệ sĩ nào được nghe trong tháng này.</p>
        <RouterLink to="/search" class="mt-4 px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition">Khám phá nghệ sĩ mới</RouterLink>
      </div>

      <div v-else class="artists-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <div
          v-for="(artist, idx) in paginatedArtists"
          :key="artist.id || artist.artist_id"
          class="relative"
        >
          <div class="absolute top-2 left-2 w-8 h-8 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-sm font-bold z-10 text-white shadow-md">
            #{{ (currentPage - 1) * itemsPerPage + idx + 1 }}
          </div>
          <ArtistCard
            :artist="artist"
            :meta="`Nghệ sĩ · ${formatNumber(artist.user_plays ?? artist.listen_count ?? artist.listens ?? 0)} lượt nghe`"
          />
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
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '@/api/axios'
import ArtistCard from '@/components/common/ArtistCard.vue'
import UserPagination from '@/components/common/UserPagination.vue'
import { DEFAULT_SPECIAL_COVERS, normalizeAssetUrl } from '@/utils/imageUrl'
import { toBackendAssetUrl } from '@/config/runtime'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const error = ref('')
const artists = ref([])
const timeRange = ref(route.query.time_range || 'this_month')

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

watch(artists, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

function handleTimeRangeChange() {
  router.replace({ query: { ...route.query, time_range: timeRange.value } })
  currentPage.value = 1
  loadData()
}

const localFormatImageUrl = (url) => {
  if (!url) return '' 
  return toBackendAssetUrl(url)
}

function formatNumber(num) {
  if (!num) return '0'
  return new Intl.NumberFormat('vi-VN').format(num)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get(`/users/me/profile?time_range=${timeRange.value}`)
    if (res.data.success) {
      artists.value = res.data.data.top_artists_month || []
    } else {
      error.value = res.data.message || 'Lỗi khi tải dữ liệu'
    }
  } catch (err) {
    console.error(err)
    error.value = 'Không thể kết nối đến server'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  updateItemsPerPage()
  window.addEventListener('resize', updateItemsPerPage)
  loadData()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateItemsPerPage)
})
</script>
