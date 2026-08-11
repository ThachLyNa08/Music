<template>
  <div class="recently-played-page user-page-bg pb-4">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden px-6 py-4 md:px-8 md:py-6 mb-6 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img
        :src="getPlaylistCover({ system_key: 'recently_played' })"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-35 scale-[1.15] blur-[30px] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay with Blueish Tint -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/80 to-[#3b82f6]/20 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 w-full">
        <!-- Foreground Cover -->
        <div class="w-[100px] h-[100px] lg:w-[140px] lg:h-[140px] rounded-2xl shadow-2xl border border-white/10 flex-shrink-0 overflow-hidden">
          <CoverImage :src="getPlaylistCover({ system_key: 'recently_played' })" class="w-full h-full object-cover" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1">
          <span class="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/70">Playlist</span>
          <h1 class="text-4xl lg:text-[56px] font-black leading-[1.1] text-white tracking-tight mb-1 drop-shadow-lg">Nghe Gần Đây</h1>
          <div class="flex items-center gap-2 text-xs md:text-sm text-white/60 font-semibold mb-2">
            <span class="text-white font-bold">{{ auth.user?.display_name || 'Người dùng' }}</span>
          </div>

          <div class="flex items-center gap-3 mt-2">
            <span class="text-xs md:text-[13px] font-semibold text-white/70 uppercase tracking-wide">Thời gian:</span>
            <div class="relative group">
              <select v-model="timeRange" @change="fetchRecentlyPlayed" class="bg-white/10 backdrop-blur-lg text-white text-xs font-bold py-2 pl-5 pr-10 rounded-full border border-white/10 outline-none group-hover:bg-white/20 group-hover:border-white/30 transition-all cursor-pointer appearance-none shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                <option value="all_time" class="bg-[#1e293b]">Tất cả thời gian</option>
                <option value="last_30_days" class="bg-[#1e293b]">30 ngày qua</option>
                <option value="this_month" class="bg-[#1e293b]">Tháng này</option>
              </select>
              <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 group-hover:text-white transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="content mx-6">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="flex flex-col gap-6">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-16 h-16 bg-white/10 rounded shadow"></div>
            <div class="flex flex-col gap-2">
              <div class="w-40 h-6 bg-white/10 rounded"></div>
              <div class="w-24 h-4 bg-white/10 rounded"></div>
            </div>
          </div>
          <div class="space-y-2">
            <div v-for="j in 2" :key="j" class="h-12 bg-white/5 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-center">
        <svg class="w-16 h-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-red-400 text-lg mb-4">{{ error }}</p>
        <button @click="fetchRecentlyPlayed" class="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold transition">Thử lại</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="groupedHistory.length === 0" class="empty-state flex flex-col items-center justify-center py-32 text-center">
        <div class="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-12 h-12 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        </div>
        <h2 class="text-3xl font-bold text-white mb-3">Bạn chưa nghe bài hát nào.</h2>
        <p class="text-gray-400 max-w-md mx-auto mb-8">Hãy tìm kiếm và phát một vài bài hát để chúng xuất hiện trong lịch sử nghe của bạn nhé.</p>
        <button @click="$router.push('/search')" class="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition transform active:scale-95">Khám phá nhạc</button>
      </div>

      <!-- History Groups -->
      <div v-else>
        <div v-for="group in groupedHistory" :key="group.date" class="history-group mb-10">

          <!-- Group Header -->
          <div
            class="group-header flex items-center justify-between cursor-pointer hover:bg-white/5 p-3 -mx-3 rounded-xl transition duration-200"
            @click="toggleGroup(group)"
          >
            <div class="flex items-center gap-5">
              <div class="relative w-16 h-16 shadow-2xl rounded-md overflow-hidden bg-white/5">
                <img :src="localFormatImageUrl(group.cover)" class="w-full h-full object-cover" @error="event => event.target.src = '/default-cover.png'" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-white mb-1">{{ group.label }}</h2>
                <p class="text-sm font-medium text-gray-400">{{ group.songs.length }} bài hát đã phát</p>
              </div>
            </div>
            <div class="text-gray-400 hover:text-white transition p-2">
              <svg v-if="group.expanded" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </div>

          <!-- Song List for Group -->
          <div v-show="group.expanded" class="mt-4">
            <!-- Table Header -->
            <div class="flex items-center gap-4 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 mb-2 mt-4">
              <div class="w-8 text-center shrink-0">#</div>
              <div class="flex-1 pr-4">Tiêu đề</div>
              <div class="flex-1 hidden md:block pr-4">Album</div>
              <div class="w-32 hidden lg:block text-right pr-4">Thời gian</div>
              <div class="w-auto min-w-[80px] flex justify-end shrink-0 pr-8">
                <!-- Removed duration clock icon -->
              </div>
            </div>

            <SongRow
              v-for="(song, idx) in group.songs"
              :key="song.history_id"
              :song="song"
              :index="idx + 1"
              :showIndex="true"
              :showAlbum="true"
              :showTimeAgo="true"
              :compact="false"
              :isPlaying="isPlaying(song)"
              @play="(s) => playSong(s, group.songs)"
              @open-menu="handleOpenMenu"
              @toggle-like="toggleLike"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Action Menu -->
    <SongActionMenu
      :show="menuState.show"
      :position="menuState.position"
      :song="menuState.song"
      :isLiked="library.isLiked(menuState.song)"
      @close="menuState.show = false"
      @add-to-playlist="handleAddToPlaylist"
      @toggle-like="toggleLike"
      @add-to-queue="handleAddToQueue"
      @go-to-song="handleGoToSong"
      @go-to-artist="handleGoToArtist"
      @go-to-album="handleGoToAlbum"
      @share="handleShare"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import api from '@/api/axios'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import { getPlaylistCover } from '@/utils/imageUrl'
import { useAuthStore } from '@/stores/auth'
import { toBackendAssetUrl } from '@/config/runtime'

const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
const auth = useAuthStore()

const rawHistory = ref([])
const loading = ref(true)
const error = ref('')
const timeRange = ref('all_time')

const localFormatImageUrl = (url) => {
  if (!url) return '/default-cover.png'
  return toBackendAssetUrl(url)
}

const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)
const yesterdayStart = new Date(todayStart)
yesterdayStart.setDate(todayStart.getDate() - 1)

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function getSafePlayedAt(item) {
  if (typeof item === 'string') return item;
  return (
    item.played_at ||
    item.listened_at ||
    item.created_at ||
    item.updated_at ||
    null
  )
}

function getDateKeyAndLabel(item) {
  const rawDate = getSafePlayedAt(item)
  const d = rawDate ? new Date(rawDate) : null

  if (!isValidDate(d)) {
    return {
      key: 'unknown',
      label: 'Không rõ thời gian'
    }
  }

  const ts = d.getTime()
  if (ts >= todayStart.getTime()) {
    return { key: 'today', label: 'Hôm nay' }
  } else if (ts >= yesterdayStart.getTime()) {
    return { key: 'yesterday', label: 'Hôm qua' }
  } else {
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })
    return { key, label }
  }
}

const groupsState = ref({})

const groupedHistory = computed(() => {
  const groups = {}
  const seenSongIds = new Set()

  const safeHistory = Array.isArray(rawHistory.value) ? rawHistory.value : []

  safeHistory.forEach(song => {
    const { key, label } = getDateKeyAndLabel(song)

    // Deduplicate by combining date key and song id
    const compositeKey = `${key}-${song.id}`
    if (seenSongIds.has(compositeKey)) return
    seenSongIds.add(compositeKey)

    if (!groups[key]) {
      // Default expand 'today' or any first group if no state
      const isToday = key === 'today'
      const isExpanded = groupsState.value[key] !== undefined ? groupsState.value[key] : isToday

      groups[key] = {
        key,
        label,
        date: key,
        cover: song.cover_url, // first song cover acts as group cover
        songs: [],
        expanded: isExpanded
      }
    }
    song.timeAgo = formatTimeAgo(getSafePlayedAt(song) || '')
    groups[key].songs.push(song)
  })

  return Object.values(groups)
})

function toggleGroup(group) {
  groupsState.value[group.key] = !group.expanded
  group.expanded = !group.expanded
}

async function fetchRecentlyPlayed() {
  loading.value = true
  error.value = ''
  try {
    // Gọi API kèm theo time_range
    const res = await api.get(`/users/me/recently-played?limit=500&time_range=${timeRange.value}`)
    if (res.data.success) {
      rawHistory.value = library.applyLikedStateToSongs(res.data.data || [])
    } else {
      error.value = res.data.message || 'Có lỗi xảy ra'
    }
  } catch (err) {
    console.error('Recently played error:', err)
    if (err.response) {
      error.value = `Lỗi ${err.response.status}: ${err.response.data?.message || 'Không tải được lịch sử nghe'}`
    } else {
      error.value = 'Không thể kết nối đến server'
    }
  } finally {
    loading.value = false
  }
}

function playSong(song, contextQueue) {
  // Pass the entire group's song list as the new queue Context
  player.playSong(song, contextQueue, 'recently_played')
}

function isPlaying(song) {
  return player.currentSong?.id === song.id
}

function formatDuration(song) {
  const s = Number(song.duration_sec || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatTimeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (!isValidDate(date)) return ''
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)

  if (diffSec < 60) return `${diffSec} giây trước`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`

  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchRecentlyPlayed()
})

// Menu logic for songs
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}
async function toggleLike(song) {
  if (!song) return;
  await library.toggleLike(song)
}
function handleAddToPlaylist(song) { library.openPlaylistModal(song) }
function handleAddToQueue(song) { player.addToQueue(song) }
function handleGoToSong(song) { router.push(`/song/${song.id || song.song_id}`) }
function handleGoToArtist(song) { if (song.artist_id) router.push(`/artist/${song.artist_id}`) }
function handleGoToAlbum(song) { if (song.album_id) router.push(`/album/${song.album_id}`) }
function handleShare(song) {
  navigator.clipboard.writeText(`${window.location.origin}/song/${song.id || song.song_id}`)
}
</script>

<style scoped>
.recently-played-page {
  min-height: 100vh;
}
</style>
