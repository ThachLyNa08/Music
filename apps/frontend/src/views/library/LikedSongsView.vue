<template>
  <div class="liked-songs-view user-page-bg">
    <!-- Header Hero Section -->
    <div class="hero-section user-panel">
      <div class="hero-cover overflow-hidden">
        <CoverImage :src="getPlaylistCover({ system_key: 'favorite_songs' })" class="w-full h-full object-cover" />
      </div>
      <div class="hero-info">
        <span class="playlist-type">Playlist</span>
        <h1 class="playlist-title">Bài Hát Đã Thích</h1>
        <div class="playlist-meta">
          <span class="user-name">{{ userDisplayName }}</span>
          <span class="dot">•</span>
          <span class="song-count">{{ likedSongs.length }} bài hát</span>
        </div>
        <div class="hero-actions">
          <PlaybackButton v-if="likedSongs.length > 0" :is-playing="isLikedSongsPlaying" @click="toggleLikedSongsPlayback" />
        </div>
      </div>
    </div>

    <!-- Song List -->
    <div class="song-list-container user-panel-soft">
      <div class="flex items-center gap-4 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/10 mb-2">
        <div class="w-8 text-center shrink-0">#</div>
        <div class="flex-1 pr-4">Tiêu đề</div>
        <div class="flex-1 hidden md:block pr-4">Album</div>
        <div class="flex-1 hidden md:block pr-4">Ngày thêm</div>
        <div class="w-auto min-w-[80px] flex justify-end shrink-0 pr-8">
          <!-- Removed duration clock icon -->
        </div>
      </div>

      <div v-if="library.loadingLikedSongs" class="empty-state">Đang tải bài hát yêu thích...</div>
      <div v-else-if="likedSongs.length === 0" class="empty-state">Bạn chưa thích bài hát nào.</div>
      <div v-else class="tracks">
        <SongRow
          v-for="(song, idx) in likedSongs"
          :key="song.id || song.title"
          :song="song"
          :index="idx + 1"
          :showIndex="true"
          :showAlbum="true"
          :showDateAdded="true"
          :compact="false"
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
      :isLiked="menuState.song?.is_liked === 1 || menuState.song?.is_liked === true || menuState.song?.liked"
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { formatImageUrl } from '@/utils/formatters'
import { useLibraryStore } from '@/stores/library'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import PlaybackButton from '@/components/common/PlaybackButton.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const library = useLibraryStore()

const userDisplayName = computed(() => auth.user?.display_name || 'Người dùng')

const likedSongs = computed(() => library.likedSongs)

function getSongId(song) {
  return song?.id ?? song?.song_id ?? null
}

const isCurrentLikedTrack = computed(() => {
  const currentId = getSongId(player.currentSong)
  if (!currentId) return false
  return likedSongs.value.some(song => String(getSongId(song)) === String(currentId))
})

const isLikedSongsPlaying = computed(() => {
  return isCurrentLikedTrack.value && player.isPlaying
})

onMounted(() => {
  library.fetchLikedSongs()
})

function toggleLike(song) {
  library.toggleLike(song)
}

function playSong(song) {
  // Truyền toàn bộ danh sách bài hát vào hàng chờ (Queue)
  player.playbackSource = 'liked_songs'
  player.setSong(song, likedSongs.value)
}

function playLikedSongs() {
  if (!likedSongs.value.length) return
  player.playbackSource = 'liked_songs'
  player.setSong(likedSongs.value[0], likedSongs.value)
}

function toggleLikedSongsPlayback() {
  if (!likedSongs.value.length) return
  if (isCurrentLikedTrack.value) {
    player.togglePlay()
    return
  }
  playLikedSongs()
}

function getCoverStyle(song) {
  const cover = song.cover || song.cover_url
  if (!cover) {
    return { backgroundImage: 'url(/default-cover.png)' }
  }
  if (cover.startsWith('linear-gradient') || cover.startsWith('radial-gradient')) {
    return { background: cover }
  }
  return { backgroundImage: `url(${formatImageUrl(cover)})` }
}

// Menu logic for songs
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
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
.liked-songs-view {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.hero-section {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 32px;
}

.hero-cover {
  width: 232px;
  height: 232px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 15px 35px rgba(124, 58, 237, 0.3);
  flex-shrink: 0;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-type {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.playlist-title {
  font-size: 72px;
  font-weight: 900;
  line-height: 1.1;
  color: #ffffff;
  letter-spacing: -2px;
  margin-bottom: 12px;
}

.playlist-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.user-name {
  font-weight: 700;
  color: #ffffff;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.play-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #10b981;
  color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}
.play-btn:hover {
  transform: scale(1.05);
  background: #34d399;
  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.45);
}

/* List Structure */
.song-list-container {
  display: flex;
  flex-direction: column;
}

.tracks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  padding: 40px;
  border: 1px dashed rgba(124, 58, 237, 0.3);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 700;
  text-align: center;
}

.glass-row {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.glass-row:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(124, 58, 237, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.2);
}

.col-index {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
}

.play-icon {
  display: none;
  background: none;
  border: none;
  color: #ffffff;
}
.glass-row:hover .number { display: none; }
.glass-row:hover .play-icon { display: block; }

.col-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.song-cover-small {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.song-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.song-name {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.song-artist:hover {
  text-decoration: underline;
}

.heart-active {
  background: none;
  border: none;
  color: #EC4899;
  cursor: pointer;
  display: flex;
  transition: transform 0.2s;
}
.heart-active:hover {
  transform: scale(1.2);
}

.add-to-playlist-btn {
  background: none; border: none; color: #7C3AED; cursor: pointer;
  padding: 4px; border-radius: 50%; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: translateX(10px);
}
.glass-row:hover .add-to-playlist-btn { opacity: 1; transform: translateX(0); }
.add-to-playlist-btn:hover { background: rgba(124, 58, 237, 0.15); transform: scale(1.1); }
.add-to-playlist-btn svg { width: 18px; height: 18px; }
</style>
