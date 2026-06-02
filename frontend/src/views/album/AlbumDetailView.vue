<template>
  <div class="flex flex-col user-page-bg pb-4" v-if="album">
    <!-- Header Hero -->
    <div class="relative m-6 flex items-end gap-6 overflow-hidden rounded-[28px] border border-white/10 px-8 py-10 pt-20 bg-gradient-to-br from-violet-900/45 via-slate-950/70 to-slate-950">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>
      
      <div class="w-[232px] h-[232px] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex-shrink-0 relative z-10 bg-white/10 flex items-center justify-center overflow-hidden">
        <CoverImage :src="getItemCover(album)" />
      </div>

      <div class="flex flex-col gap-3 relative z-10 text-white mt-10 w-full">
        <div class="text-sm font-bold tracking-wider flex items-center gap-2 uppercase">
          {{ album.album_type === 'single' ? 'SINGLE' : (album.album_type === 'compilation' ? 'COMPILATION' : 'ALBUM') }}
        </div>
        <h1 class="text-5xl md:text-7xl font-black tracking-tighter m-0 leading-none py-2">{{ album.title }}</h1>
        <div class="flex items-center gap-2 text-sm font-semibold text-gray-300 mt-2">
          <img v-if="album.artist_avatar_url" :src="$formatImageUrl(album.artist_avatar_url)" @error="event => event.target.src = '/default-cover.png'" class="w-6 h-6 rounded-full object-cover" />
          <RouterLink :to="'/artist/' + album.artist_id" class="text-white hover:underline cursor-pointer font-bold">{{ album.artist_name }}</RouterLink>
          <span class="w-1 h-1 bg-white rounded-full mx-1"></span>
          <span>{{ album.song_count }} bài hát</span>
          <span class="w-1 h-1 bg-white rounded-full mx-1"></span>
          <span>{{ formatTotalDuration(album.total_duration_sec) }}</span>
          <span class="w-1 h-1 bg-white rounded-full mx-1"></span>
          <span>{{ formatNumber(album.total_plays) }} lượt nghe</span>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex items-center gap-4 mt-6">
          <button 
            class="flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-500 text-black font-bold text-base hover:scale-105 hover:bg-emerald-400 transition-all duration-200 shadow-[0_8px_20px_rgba(16,185,129,0.3)] border-none cursor-pointer"
            @click="playAlbum"
            :disabled="!album.songs || album.songs.length === 0"
            :class="{ 'opacity-50 cursor-not-allowed hover:scale-100 hover:bg-emerald-500': !album.songs || album.songs.length === 0 }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" class="ml-1"><path d="M8 5v14l11-7z"/></svg>
            <span>{{ playButtonLabel }}</span>
          </button>
          
          <!-- Add to Library Button -->
          <div class="album-library-action relative inline-flex group/tooltip">
            <button 
              type="button"
              class="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/15 hover:scale-105 transition-all duration-200 border border-white/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isLibraryLoading"
              @click.stop.prevent="handleToggleLibrary"
            >
              <!-- Check icon if saved -->
              <svg v-if="isSavedToLibrary" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="text-emerald-400">
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

    <!-- Song List Section -->
    <div class="mx-6 px-6 py-4 user-panel-soft flex-1 relative">
      
      <!-- Table Header -->
      <div class="relative z-10 w-full mb-4 px-4 flex items-center text-sm font-semibold text-slate-400 border-b border-white/10 pb-2 mt-4 h-10">
        <div class="w-12 text-center shrink-0">#</div>
        <div class="flex-1 min-w-0">Tiêu đề</div>
        <div class="w-28 text-right pr-4 hidden sm:block">Lượt nghe</div>
        <div class="w-16 flex items-center justify-end pr-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/></svg>
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
import { getItemCover } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()

const album = ref(null)
const loading = ref(true)
const error = ref('')
const isLibraryLoading = ref(false)
const isSavedToLibrary = ref(false)

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
    } else {
      await albumApi.removeFromLibrary(album.value.id)
    }
  } catch (err) {
    isSavedToLibrary.value = previous
    console.error('[AlbumDetail] toggle library failed:', err)
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
