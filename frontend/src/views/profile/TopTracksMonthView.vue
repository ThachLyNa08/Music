<template>
  <div class="top-tracks-page user-page-bg">
    <header class="top-tracks-hero user-panel">
      <div class="hero-cover">
        <svg class="hero-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      <div class="hero-info">
        <p class="hero-label">Hồ sơ</p>
        <h1>Bản nhạc hàng đầu</h1>
        <p class="hero-subtitle">Dựa trên lịch sử nghe nhạc của bạn từ đầu tháng đến nay</p>
      </div>
    </header>

    <main class="top-tracks-content user-panel-soft">
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
          <div class="listens-header">Lượt nghe</div>
          <div class="duration-header">
            <svg viewBox="0 0 24 24" class="duration-icon">
              <path d="M11.999 2C6.478 2 2 6.479 2 12s4.478 10 9.999 10C17.522 22 22 17.521 22 12S17.522 2 11.999 2zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17zm-.5-13.5v5.5l4.5 2.5.75-1.25-3.75-2.1V7h-1.5z" />
            </svg>
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
              {{ formatNumber(song.listen_count || song.play_count || song.plays || 0) }}
            </div>

            <div class="track-actions">
              <button
                type="button"
                class="like-button"
                :class="{ liked: isLiked(song) }"
                aria-label="Toggle liked"
                @click.stop="toggleLike(song)"
              >
                <svg
                  viewBox="0 0 24 24"
                  :fill="isLiked(song) ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </button>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import api from '@/api/axios'
import CoverImage from '@/components/common/CoverImage.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import { getItemCover } from '@/utils/imageUrl'

const router = useRouter()
const playerStore = usePlayerStore()
const library = useLibraryStore()

const loading = ref(true)
const error = ref('')
const tracks = ref([])

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
  return playerStore.currentSong?.id === getSongId(song)
}

function playSong(song) {
  const queue = tracks.value.map(normalizeSong)
  const targetId = getSongId(song)
  const target = queue.find(item => item.id === targetId) || normalizeSong(song)
  playerStore.playSong(target, queue, 'profile_top_tracks')
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/users/me/profile')
    if (res.data.success) {
      tracks.value = res.data.data.top_tracks_month || []
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
  padding: 64px 32px 140px;
  overflow-x: hidden;
  color: #ffffff;
}

.top-tracks-hero {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 40px;
}

.hero-cover {
  width: 192px;
  height: 192px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #581c87);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
}

.hero-icon {
  width: 96px;
  height: 96px;
  color: rgba(255, 255, 255, 0.85);
}

.hero-info {
  min-width: 0;
}

.hero-label {
  margin: 0 0 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
}

.hero-info h1 {
  margin: 0 0 16px;
  color: #ffffff;
  font-size: clamp(44px, 6vw, 76px);
  font-weight: 900;
  line-height: 1;
}

.hero-subtitle {
  margin: 0;
  color: #b3b3b3;
  font-size: 14px;
  font-weight: 500;
}

.top-tracks-content,
.top-tracks-table {
  width: 100%;
  min-width: 0;
}

.top-tracks-table-row {
  display: grid;
  grid-template-columns: 48px minmax(280px, 1.8fr) minmax(220px, 1fr) 120px 96px;
  align-items: center;
  column-gap: 16px;
}

.top-tracks-table-header {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 40px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(18, 18, 18, 0.95);
  backdrop-filter: blur(12px);
  color: #b3b3b3;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
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
    grid-template-columns: 44px minmax(240px, 1.7fr) minmax(180px, 1fr) 100px 84px;
    column-gap: 12px;
  }
}

@media (max-width: 900px) {
  .top-tracks-page {
    padding: 48px 20px 140px;
  }

  .top-tracks-hero {
    align-items: center;
  }

  .hero-cover {
    width: 132px;
    height: 132px;
  }

  .hero-icon {
    width: 64px;
    height: 64px;
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
    padding: 32px 14px 140px;
  }

  .top-tracks-hero {
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 28px;
  }

  .hero-info h1 {
    font-size: 42px;
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
