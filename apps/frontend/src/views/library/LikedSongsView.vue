<template>
  <div class="liked-songs-view user-page-bg">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden px-6 py-4 md:px-8 md:py-6 mb-6 border-b border-white/5 shadow-xl -mx-8 -mt-8 bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img
        :src="getPlaylistCover({ system_key: 'favorite_songs' })"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-35 scale-[1.15] blur-[30px] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay with Pinkish Tint -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/80 to-[#ec4899]/20 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 w-full">
        <!-- Foreground Cover -->
        <div class="w-[100px] h-[100px] lg:w-[140px] lg:h-[140px] rounded-2xl shadow-2xl border border-white/10 flex-shrink-0 overflow-hidden">
          <CoverImage :src="getPlaylistCover({ system_key: 'favorite_songs' })" class="w-full h-full object-cover" />
        </div>
        
        <div class="flex flex-col gap-1.5 min-w-0 flex-1">
          <span class="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/70">Playlist</span>
          <h1 class="text-4xl lg:text-[56px] font-black leading-[1.1] text-white tracking-tight mb-1 drop-shadow-lg">Bài Hát Đã Thích</h1>
          <div class="flex items-center gap-2 text-xs md:text-sm text-white/60 font-semibold mb-2">
            <span class="text-white font-bold">{{ userDisplayName }}</span>
            <span>•</span>
            <span>{{ likedSongs.length }} bài hát</span>
          </div>
          
          <div class="flex items-center gap-4 mt-2">
            <button v-if="likedSongs.length > 0" class="w-12 h-12 rounded-full bg-[#1ED760] text-black flex items-center justify-center hover:scale-105 hover:bg-[#1fdf64] transition-all shadow-[0_0_30px_rgba(30,215,96,0.3)] shrink-0" @click="toggleLikedSongsPlayback">
              <svg v-if="!isLikedSongsPlaying" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="ml-1"><path d="M8 5v14l11-7z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Song List -->
    <div class="song-list-container user-panel-soft">
      <div class="flex items-center gap-4 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 mb-2">
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
          v-for="(song, idx) in paginatedSongs"
          :key="song.id || song.title"
          :song="song"
          :index="(currentPage - 1) * itemsPerPage + idx + 1"
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

      <div class="mt-8 mb-4">
        <UserPagination 
          v-if="likedSongs.length > 0"
          v-model:page="currentPage" 
          v-model:limit="itemsPerPage"
          :total="likedSongs.length" 
          :showPageSize="true"
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
import UserPagination from '@/components/common/UserPagination.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const library = useLibraryStore()

const userDisplayName = computed(() => auth.user?.display_name || 'Người dùng')

const likedSongs = computed(() => library.likedSongs)

const currentPage = ref(1)
const itemsPerPage = ref(10)

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(likedSongs.value.length / itemsPerPage.value))
})

const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return likedSongs.value.slice(start, end)
})

function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

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
