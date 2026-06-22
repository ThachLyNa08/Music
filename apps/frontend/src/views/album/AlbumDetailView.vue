<template>
  <div class="flex flex-col user-page-bg pb-4" v-if="album">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden w-full px-6 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img 
        :src="getItemCover(album)"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.38] scale-[1.18] blur-[34px] saturate-[1.2] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,20,0.86),rgba(9,11,20,0.68),rgba(9,11,20,0.94))] z-0 pointer-events-none"></div>
      <!-- Pink/Purple Tint Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-transparent to-pink-500/10 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-center lg:items-center gap-6 md:gap-8 max-w-[1400px] mx-auto">
        <!-- Foreground Cover -->
        <div class="w-[160px] h-[160px] lg:w-[200px] lg:h-[200px] rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0 overflow-hidden">
          <CoverImage :src="getItemCover(album)" class="w-full h-full object-cover" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1 text-center lg:text-left w-full">
          <span class="hidden lg:inline-block text-xs font-bold uppercase tracking-wider text-white/70 mb-0.5 w-max">
            {{ album.album_type === 'single' ? 'SINGLE' : (album.album_type === 'compilation' ? 'COMPILATION' : 'ALBUM') }}
          </span>
          <h1 class="text-4xl md:text-5xl lg:text-[64px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-1">{{ album.title }}</h1>
          
          <div class="flex items-center justify-center lg:justify-start gap-2 text-sm md:text-base font-bold text-white/90 mt-1 flex-wrap">
            <img v-if="album.artist_avatar_url" :src="$formatImageUrl(album.artist_avatar_url)" @error="event => event.target.src = '/default-cover.png'" class="w-6 h-6 rounded-full object-cover shadow-sm hidden md:block" />
            <RouterLink :to="'/artist/' + album.artist_id" class="text-white hover:text-[#1ed760] transition font-bold text-base md:text-lg">{{ album.artist_name }}</RouterLink>
            
            <span class="w-1 h-1 bg-white/30 rounded-full mx-1 hidden lg:block"></span>
            <span class="hidden lg:block">{{ album.song_count }} bài hát</span>
            
            <span class="w-1 h-1 bg-white/30 rounded-full mx-1 hidden lg:block"></span>
            <span class="hidden lg:block">{{ formatTotalDuration(album.total_duration_sec) }}</span>
            
            <span class="w-1 h-1 bg-white/30 rounded-full mx-1 hidden lg:block"></span>
            <span class="hidden lg:block">{{ formatNumber(album.total_plays) }} lượt nghe</span>
          </div>

          <!-- Mobile only metadata -->
          <div class="flex lg:hidden items-center justify-center gap-2 text-xs font-semibold text-white/60 mt-1">
            <span>{{ album.song_count }} bài hát</span>
            <span class="w-1 h-1 bg-white/30 rounded-full mx-1"></span>
            <span>{{ formatTotalDuration(album.total_duration_sec) }}</span>
          </div>

          <!-- Action Buttons -->
          <div class="album-actions mt-4 flex items-center justify-center lg:justify-start gap-4">
            <PlaybackButton class="mr-2" :is-playing="isAlbumPlaying" :disabled="!album.songs || album.songs.length === 0" @click="toggleAlbumPlayback" />
            
            <!-- Add to Library Button -->
            <div class="album-library-action relative inline-flex group/tooltip">
              <button 
                type="button"
                class="w-12 h-12 rounded-full border border-white/10 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all shadow-lg backdrop-blur-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isLibraryLoading"
                @click.stop.prevent="handleToggleLibrary"
              >
                <!-- Check icon if saved -->
                <svg v-if="isSavedToLibrary" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="text-[#1ed760]">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <!-- Plus icon if not saved -->
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
              <!-- Tooltip -->
              <div class="album-library-tooltip absolute left-1/2 -translate-x-1/2 bottom-full mb-3 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap user-dropdown text-xs font-semibold px-3 py-2 z-50">
                {{ isSavedToLibrary ? 'Đã thêm vào thư viện' : 'Thêm vào thư viện' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Song List Section -->
    <div class="mx-6 px-6 py-4 user-panel-soft flex-1 relative">
      
      <!-- Table Header -->
      <div class="relative z-10 w-full mb-4 px-4 flex items-center text-sm font-semibold text-white border-b border-white/10 pb-2 mt-4 h-10">
        <div class="w-12 text-center shrink-0">#</div>
        <div class="flex-1 min-w-0">Tiêu đề</div>
        <div class="w-28 text-right pr-4 hidden sm:block">Lượt nghe</div>
        <div class="w-24 flex justify-end shrink-0 pr-8">
        </div>
      </div>

      <!-- Empty State -->
      <div class="relative z-10" v-if="!album.songs || album.songs.length === 0">
        <div class="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="64" height="64" class="mb-4 text-gray-600"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
          <p class="font-bold text-lg text-white mb-2">Album này hiện chưa có bài hát nào trên hệ thống.</p>
        </div>
      </div>

      <!-- Song Rows -->
      <div class="relative z-10 flex flex-col gap-1 pb-8" v-else>
        <SongRow
          v-for="(song, idx) in album.songs"
          :key="song.id"
          :song="song"
          :index="idx + 1"
          :showIndex="true"
          :showAlbum="false"
          :compact="true"
          :isPlaying="player.currentSong?.id === song.id"
          @play="playSong"
          @open-menu="handleOpenMenu"
          @toggle-like="toggleLike"
        />
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
  
  <div v-else-if="loading" class="flex flex-col items-center justify-center min-h-full user-page-bg">
    <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p class="text-gray-400 font-medium">Đang tải thông tin album...</p>
  </div>

  <div v-else-if="error" class="flex flex-col items-center justify-center min-h-full user-page-bg">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" class="text-gray-500 mb-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
    <h3 class="text-2xl font-black mb-2">{{ error }}</h3>
    <RouterLink to="/" class="mt-4 text-emerald-400 hover:text-emerald-300 no-underline hover:underline font-medium">← Về trang chủ</RouterLink>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { albumApi } from '@/api/album'
import api from '@/api/axios'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { formatDuration, formatTotalDuration } from '@/utils/formatters'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import PlaybackButton from '@/components/common/PlaybackButton.vue'
import { getItemCover } from '@/utils/imageUrl'
import { addToast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()

const album = ref(null)
const loading = ref(true)
const error = ref('')
const isLibraryLoading = ref(false)
const isSavedToLibrary = ref(false)

function getSongId(song) {
  return song?.id ?? song?.song_id ?? null
}

const isCurrentAlbumTrack = computed(() => {
  const currentId = getSongId(player.currentSong)
  if (!currentId || !Array.isArray(album.value?.songs)) return false
  return album.value.songs.some(song => String(getSongId(song)) === String(currentId))
})

const isAlbumPlaying = computed(() => {
  return isCurrentAlbumTrack.value && player.isPlaying
})

// Computed label for play button
const playButtonLabel = computed(() => {
  if (!album.value) return 'Phát'
  switch (album.value.album_type) {
    case 'single': return 'Phát single'
    case 'compilation': return 'Phát'
    default: return 'Phát album'
  }
})

async function handleToggleLibrary() {
  if (!album.value?.id || isLibraryLoading.value) return

  const previous = isSavedToLibrary.value
  isSavedToLibrary.value = !previous
  isLibraryLoading.value = true

  try {
    if (isSavedToLibrary.value) {
      await albumApi.addToLibrary(album.value.id)
      addToast('Đã thêm vào thư viện thành công!')
    } else {
      await albumApi.removeFromLibrary(album.value.id)
      addToast('Đã xóa khỏi thư viện!', 'danger')
    }
  } catch (err) {
    isSavedToLibrary.value = previous
    console.error('[AlbumDetail] toggle library failed:', err)
    addToast('Lỗi: Không thể cập nhật thư viện')
  } finally {
    isLibraryLoading.value = false
  }
}

onMounted(() => {
  fetchAlbumDetail()
  library.fetchLikedSongs()
})

onUnmounted(() => {
})

watch(() => route.params.id, () => {
  if (route.name === 'AlbumDetail') {
    fetchAlbumDetail()
    window.scrollTo(0, 0)
  }
})

async function fetchAlbumDetail() {
  loading.value = true
  error.value = ''
  album.value = null
  isSavedToLibrary.value = false
  try {
    const res = await albumApi.getById(route.params.id)
    if (res.data?.success) {
      album.value = res.data.data
      if (Array.isArray(album.value?.songs)) {
        album.value.songs = library.applyLikedStateToSongs(album.value.songs)
      }
      // Sync library state from API response
      isSavedToLibrary.value = Boolean(
        album.value?.is_saved ||
        album.value?.isSaved ||
        album.value?.in_library ||
        album.value?.inLibrary ||
        album.value?.is_in_library
      )
    } else {
      error.value = 'Không tìm thấy album.'
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Không tìm thấy album.'
  } finally {
    loading.value = false
  }
}

function formatNumber(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function playSong(song) {
  if(player.setSong) {
    player.playbackSource = 'album'
    player.setSong(song, album.value.songs)
    if (!player.isPlaying) player.togglePlay()
  }
}

function playAlbum() {
  if (album.value && album.value.songs && album.value.songs.length > 0) {
    player.playbackSource = 'album'
    player.setSong(album.value.songs[0], album.value.songs)
    if (!player.isPlaying) player.togglePlay()
  }
}

function toggleAlbumPlayback() {
  if (!album.value?.songs?.length) return
  if (isCurrentAlbumTrack.value) {
    player.togglePlay()
    return
  }
  playAlbum()
}

// Menu logic for songs
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}
async function toggleLike(song) {
  if (!song) return;
  await library.toggleLike(song);
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
