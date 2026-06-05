<template>
  <div class="top-artists-page user-page-bg p-6 md:p-10 font-inter">
    <!-- Header -->
    <header class="user-panel mb-10 flex flex-col md:flex-row items-start md:items-end gap-6">
      <div class="w-32 h-32 md:w-48 md:h-48 shrink-0 shadow-2xl rounded-full flex items-center justify-center overflow-hidden">
        <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.topArtists)" alt="Top Artists" class="w-full h-full object-cover" />
      </div>
      <div class="flex flex-col">
        <p class="text-sm font-bold uppercase tracking-widest text-white/80 mb-2">Hồ sơ</p>
        <h1 class="text-5xl md:text-7xl font-black tracking-tighter mb-4 md:mb-6">Nghệ sĩ hàng đầu</h1>
        <p class="text-sm font-medium text-gray-400">Những nghệ sĩ bạn nghe nhiều nhất trong tháng</p>
      </div>
    </header>

    <!-- Content -->
    <main class="user-panel-soft">
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
          v-for="(artist, idx) in artists"
          :key="artist.id || artist.artist_id"
          class="relative"
        >
          <div class="absolute top-2 left-2 w-8 h-8 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-sm font-bold z-10 text-white">
            #{{ idx + 1 }}
          </div>
          <ArtistCard
            :artist="artist"
            :meta="`Nghệ sĩ · ${formatNumber(artist.listen_count)} lượt nghe`"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api/axios'
import ArtistCard from '@/components/common/ArtistCard.vue'
import { DEFAULT_SPECIAL_COVERS, normalizeAssetUrl } from '@/utils/imageUrl'

const loading = ref(true)
const error = ref('')
const artists = ref([])

const localFormatImageUrl = (url) => {
  if (!url) return '' 
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}

function formatNumber(num) {
  if (!num) return '0'
  return new Intl.NumberFormat('vi-VN').format(num)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/users/me/profile')
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
  loadData()
})
</script>
