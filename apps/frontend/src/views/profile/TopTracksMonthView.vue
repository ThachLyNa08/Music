<template>
  <div class="top-tracks-page user-page-bg">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden w-full px-6 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img 
        :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.topTracks)"
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
          <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.topTracks)" alt="Top Tracks" class="w-full h-full object-cover" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1 text-center lg:text-left w-full">
          <div class="hidden lg:flex items-center gap-2 mb-0.5 w-max text-xs font-bold uppercase tracking-wider text-white/70">
            <span class="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md font-black uppercase tracking-widest border border-indigo-500/30">HỒ SƠ</span>
          </div>

          <h1 class="text-4xl md:text-5xl lg:text-[64px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-1">Bản nhạc hàng đầu</h1>
          
          <p class="text-gray-300 font-medium text-sm lg:text-base mt-1 line-clamp-2 max-w-3xl">
            Dựa trên lịch sử nghe nhạc của bạn
          </p>

          <div class="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-4">
            <span class="text-sm md:text-base font-semibold text-gray-300 flex items-center">
              {{ tracks.length }} bài hát 
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

    <main class="top-tracks-content user-panel-soft px-6 md:px-10 mt-8">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
      </div>

      <div v-else-if="error" class="empty-state">
        <p class="text-red-400 text-lg">{{ error }}</p>
      </div>

      <div v-else-if="tracks.length === 0" class="empty-state">
        <p class="text-gray-400 text-lg">Chưa có bài hát nào được nghe trong tháng này.</p>
        <RouterLink to="/search" class="explore-link">Khám phá nhạc mới</RouterLink>
      </div>

      <div v-else class="top-tracks-table">
        <div class="top-tracks-table-row top-tracks-table-header">
          <div class="track-index-header">#</div>
          <div>Tiêu đề</div>
          <div class="album-header">Album</div>
          <div class="listens-header">Lượt nghe của bạn</div>
          <div class="duration-header">
            <!-- Removed duration clock icon -->
          </div>
        </div>

        <div class="top-tracks-table-body">
          <div
            v-for="(song, idx) in tracks"
            :key="song.song_id || song.id || idx"
            class="top-tracks-table-row top-tracks-song-row"
            :class="{ 'is-playing': isPlaying(song) }"
            @click="handleGoToSong(song)"
          >
            <div class="track-index">
              <span v-if="!isPlaying(song)" class="track-number">{{ idx + 1 }}</span>
              <button
                v-if="!isPlaying(song)"
                type="button"
                class="track-play"
                aria-label="Play song"
                @click.stop="playSong(song)"
              >
                <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
              <button
                v-else
                type="button"
                class="track-playing"
                aria-label="Now playing"
                @click.stop="playSong(song)"
              >
                <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              </button>
            </div>

            <div class="track-title-cell">
              <CoverImage :src="getItemCover(song)" class="track-cover" />
              <div class="track-info">
                <RouterLink class="track-title" :to="`/song/${getSongId(song)}`" @click.stop>
                  {{ song.title || song.name || 'Unknown Title' }}
                </RouterLink>
                <p class="track-artist" @click.stop="handleGoToArtist(song)">
                  {{ song.artist_name || song.artist || song.artists || 'Unknown Artist' }}
                </p>
              </div>
            </div>

            <div class="track-album" @click.stop="handleGoToAlbum(song)">
              {{ song.album_title || song.album_name || song.album || 'Single' }}
            </div>

            <div class="track-listens">
              {{ formatNumber(song.user_plays ?? song.listen_count ?? song.listens ?? 0) }}
            </div>

            <div class="track-actions">
              <LikeButton
                :song="song"
                baseClass="like-button"
                activeClass="liked"
                inactiveClass=""
              >
                <template #icon="{ isLiked }">
                  <svg
                    viewBox="0 0 24 24"
                    :fill="isLiked ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                </template>
              </LikeButton>
              <span class="duration">{{ formatDuration(song.duration_sec ?? song.duration_seconds ?? song.duration_ms ?? song.duration) }}</span>
              <button
                type="button"
                class="more-button"
                aria-label="More options"
                @click.stop="openMenu($event, song)"
              >
                <svg viewBox="0 0 24 24"><path d="M4.5 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <SongActionMenu
      :show="menuState.show"
      :position="menuState.position"
      :song="menuState.song"
      :isLiked="isLiked(menuState.song)"
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
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import api from '@/api/axios'
import CoverImage from '@/components/common/CoverImage.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import LikeButton from '@/components/common/LikeButton.vue'
import { DEFAULT_SPECIAL_COVERS, normalizeAssetUrl, getItemCover } from '@/utils/imageUrl'

const router = useRouter()
const route = useRoute()
const playerStore = usePlayerStore()
const library = useLibraryStore()

const loading = ref(true)
const error = ref('')
const tracks = ref([])
const timeRange = ref(route.query.time_range || 'this_month')

function handleTimeRangeChange() {
  router.replace({ query: { ...route.query, time_range: timeRange.value } })
  loadData()
}

function getSongId(song) {
  return song?.song_id || song?.id
}

function isLiked(song) {
  return library.isLiked(song)
}

function normalizeSong(song) {
  return {
    ...song,
    id: getSongId(song),
    artist_name: song?.artist_name || song?.artist || song?.artists,
    album: song?.album_title || song?.album_name || song?.album
  }
}

function formatDuration(value) {
  if (typeof value === 'string' && value.includes(':')) return value

  let seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds > 10000) seconds = Math.floor(seconds / 1000)

  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(Number(num || 0))
}

function isPlaying(song) {
  const currentId = getSongId(playerStore.currentSong)
  const songId = getSongId(song)
  return Boolean(playerStore.isPlaying && currentId && songId && String(currentId) === String(songId))
}

function playSong(song) {
  if (isPlaying(song)) {
    playerStore.togglePlay()
    return
  }
  const queue = tracks.value.map(normalizeSong)
  const targetId = getSongId(song)
  const target = queue.find(item => item.id === targetId) || normalizeSong(song)
  playerStore.playSong(target, queue, 'profile_top_tracks')
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get(`/users/me/profile?time_range=${timeRange.value}`)
    if (res.data.success) {
      tracks.value = library.applyLikedStateToSongs(res.data.data.top_tracks_month || [])
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

const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })

function openMenu(event, song) {
  const rect = event.currentTarget.getBoundingClientRect()
  menuState.value = {
    show: true,
    position: { x: rect.left, y: rect.bottom + 8 },
    song: normalizeSong(song)
  }
}

async function toggleLike(song) {
  if (!song) return
  await library.toggleLike(song)
}

function handleAddToPlaylist(song) {
  library.openPlaylistModal(song)
}

function handleAddToQueue(song) {
  playerStore.addToQueue(song)
}

function handleGoToSong(song) {
  const id = getSongId(song)
  if (id) router.push(`/song/${id}`)
}

function handleGoToArtist(song) {
  if (song?.artist_id) router.push(`/artist/${song.artist_id}`)
}

function handleGoToAlbum(song) {
  if (song?.album_id) router.push(`/album/${song.album_id}`)
}

function handleShare(song) {
  const id = getSongId(song)
  if (id) navigator.clipboard.writeText(`${window.location.origin}/song/${id}`)
}
</script>

<style scoped>
.top-tracks-page {
  width: 100%;
  min-width: 0;
  min-height: 100vh;
  padding-bottom: 140px;
  overflow-x: hidden;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
}

.top-tracks-content,
.top-tracks-table {
  width: 100%;
  min-width: 0;
}

.top-tracks-table-row {
  display: grid;
  grid-template-columns: 48px minmax(280px, 1.8fr) minmax(220px, 1fr) 160px 96px;
  align-items: center;
  column-gap: 16px;
}

.top-tracks-table-header {
  height: 40px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.listens-header {
  white-space: nowrap;
}

.duration-header {
  display: flex;
  justify-content: flex-end;
}

.duration-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.top-tracks-table-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 10px;
}

.top-tracks-song-row {
  min-height: 64px;
  padding: 8px 16px;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.top-tracks-song-row:hover,
.top-tracks-song-row.is-playing {
  background: rgba(255, 255, 255, 0.1);
}

.track-index,
.track-index-header {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b3b3b3;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.track-play,
.track-playing {
  display: none;
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  color: #ffffff;
  align-items: center;
  justify-content: center;
}

.track-play svg,
.track-playing svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.track-playing {
  display: flex;
  color: #1ed760;
}

.top-tracks-song-row:hover .track-number {
  display: none;
}

.top-tracks-song-row:hover .track-play {
  display: flex;
}

.track-title-cell {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.track-cover {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: cover;
}

.track-info {
  min-width: 0;
}

.track-title {
  display: block;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.25;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-title:hover,
.track-artist:hover,
.track-album:hover {
  color: #ffffff;
  text-decoration: underline;
}

.track-artist {
  margin: 4px 0 0;
  color: #b3b3b3;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-album {
  color: #b3b3b3;
  font-size: 14px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-listens {
  color: #b3b3b3;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.track-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  color: #b3b3b3;
}

.like-button,
.more-button {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 160ms ease,
    opacity 160ms ease,
    transform 160ms ease;
}

.like-button {
  color: #ffffff;
  opacity: 1;
}

.more-button {
  color: currentColor;
  opacity: 0;
}

.like-button svg,
.more-button svg {
  width: 18px;
  height: 18px;
}

.like-button.liked {
  color: #ec4899;
}

.top-tracks-song-row:hover .more-button {
  opacity: 1;
}

.like-button:hover {
  color: #ec4899;
  transform: scale(1.08);
}

.more-button:hover {
  color: #ffffff;
  transform: scale(1.05);
}

.duration {
  min-width: 42px;
  color: #b3b3b3;
  text-align: right;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.loading-state,
.empty-state {
  display: flex;
  min-height: 280px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #1ed760;
  border-top-color: transparent;
  border-radius: 999px;
  animation: spin 900ms linear infinite;
}

.explore-link {
  margin-top: 16px;
  padding: 12px 28px;
  border-radius: 999px;
  background: #ffffff;
  color: #000000;
  font-weight: 800;
  text-decoration: none;
  transition: transform 160ms ease;
}

.explore-link:hover {
  transform: scale(1.04);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .top-tracks-table-row {
    grid-template-columns: 44px minmax(240px, 1.7fr) minmax(180px, 1fr) 140px 84px;
    column-gap: 12px;
  }
}

@media (max-width: 900px) {
  .top-tracks-page {
    padding-bottom: 140px;
  }

  .top-tracks-table-row {
    grid-template-columns: 40px minmax(0, 1fr) 82px;
  }

  .album-header,
  .listens-header,
  .track-album,
  .track-listens {
    display: none;
  }
}

@media (max-width: 640px) {
  .top-tracks-page {
    padding-bottom: 140px;
  }

  .top-tracks-table-header,
  .top-tracks-song-row {
    padding-left: 8px;
    padding-right: 8px;
  }

  .track-cover {
    width: 44px;
    height: 44px;
  }

  .like-button {
    display: none;
  }
}
</style>
