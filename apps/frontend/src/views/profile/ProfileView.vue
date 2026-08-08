<template>
  <div class="profile-page user-page-bg pb-4 font-inter">
    
    <!-- Profile Hero Section -->
    <section class="relative overflow-hidden px-8 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Avatar -->
      <img
        v-if="user?.avatar_url"
        :src="localFormatImageUrl(user.avatar_url)"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.32] scale-[1.18] blur-[32px] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/80 to-[#8b5cf6]/10 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-6 sm:gap-8 w-full">
        <!-- Foreground Avatar -->
        <div 
          class="relative w-[140px] h-[140px] lg:w-[200px] lg:h-[200px] rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-2 border-white/10 flex-shrink-0 overflow-hidden bg-white/5 flex items-center justify-center group cursor-pointer"
          @click="showEditModal = true"
        >
          <img 
            v-if="user?.avatar_url" 
            :src="localFormatImageUrl(user.avatar_url)" 
            class="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40" 
            @error="e => { e.target.onerror = null; e.target.src = '/default-avatar.png' }"
          />
          <span v-else class="text-6xl font-bold text-white group-hover:opacity-40">{{ user?.name?.charAt(0)?.toUpperCase() || 'U' }}</span>
          
          <!-- Hover Overlay -->
          <div class="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <svg class="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span class="text-sm font-medium text-white shadow-sm">Chọn ảnh</span>
          </div>
        </div>
        
        <div class="flex flex-col gap-2 min-w-0 flex-1 text-center sm:text-left">
          <span class="hidden sm:block text-sm font-bold uppercase tracking-wider text-white/70 mb-1">Hồ sơ</span>
          <h1 class="text-5xl lg:text-[84px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-2">{{ user?.name }}</h1>
          
          <div class="flex items-center justify-center sm:justify-start gap-3 mt-1">
            <span v-if="user?.is_premium" class="px-2.5 py-0.5 bg-[#1ed760] text-black text-xs font-bold uppercase tracking-wide rounded-sm shadow-lg">Premium</span>
            <span class="text-white font-bold text-sm">12.3K <span class="text-white/60 font-medium">Người theo dõi</span></span>
            <span class="w-1 h-1 bg-white/30 rounded-full"></span>
            <button class="text-white font-bold text-sm hover:text-[#1ed760] transition cursor-pointer" @click="$router.push('/me/followed-artists')">
              {{ followedArtistCount }} <span class="text-white/60 font-medium">Đang theo dõi</span>
            </button>
            <span class="w-1 h-1 bg-white/30 rounded-full mx-1"></span>
            <button
              type="button"
              title="Chỉnh sửa hồ sơ"
              class="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all shadow-lg ml-1"
              @click="showEditModal = true"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="content-wrapper px-6 md:px-8 py-8 relative z-10">
      
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-12 h-12 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center py-20">
        <svg class="w-16 h-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <p class="text-red-400 text-lg">{{ error }}</p>
      </div>

      <div v-else class="flex flex-col gap-12">
        
        <!-- Top Tracks This Month -->
        <section v-if="topTracks.length > 0">
          <div class="flex items-end justify-between mb-4">
            <div>
              <h2 class="text-2xl font-bold hover:underline cursor-pointer" @click="$router.push('/profile/top-tracks')">Bản nhạc hàng đầu tháng này</h2>
              <p class="text-sm font-medium text-gray-400 mt-1">Dựa trên lịch sử nghe nhạc trong tháng này</p>
            </div>
            <RouterLink to="/profile/top-tracks" class="text-sm font-bold text-gray-400 hover:text-white hover:underline shrink-0 ml-4 mb-1">Xem tất cả</RouterLink>
          </div>
          <div class="flex flex-col gap-1">
            <SongRow
              v-for="(song, idx) in topTracks.slice(0, 5)"
              :key="song.id"
              :song="song"
              :index="idx + 1"
              :showIndex="true"
              :showAlbum="true"
              :compact="true"
              :isPlaying="isPlaying(song)"
              @play="(s) => playSong(s, topTracks)"
              @open-menu="handleOpenMenu"
              @toggle-like="toggleLike"
            />
          </div>
        </section>

        <!-- Top Artists This Month -->
        <section v-if="topArtists.length > 0">
          <div class="flex items-end justify-between mb-4">
            <div>
              <h2 class="text-2xl font-bold hover:underline cursor-pointer" @click="$router.push('/profile/top-artists')">Nghệ sĩ hàng đầu tháng này</h2>
              <p class="text-sm font-medium text-gray-400 mt-1">Những nghệ sĩ bạn nghe nhiều nhất trong tháng</p>
            </div>
            <RouterLink to="/profile/top-artists" class="text-sm font-bold text-gray-400 hover:text-white hover:underline shrink-0 ml-4 mb-1">Xem tất cả</RouterLink>
          </div>
          <div class="user-horizontal-row">
            <ArtistCard
              v-for="artist in topArtists.slice(0, 8)"
              :key="artist.id || artist.artist_id"
              :artist="artist"
              class="user-horizontal-card user-artist-card-size"
            />
          </div>
        </section>

        <!-- Listening Stats & Top Genres -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="user-card p-6 relative overflow-hidden">
            <div class="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-[#1ed760] rounded-full blur-[80px] opacity-20"></div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Tổng thời gian nghe</h3>
            <div class="text-5xl font-black mb-1">{{ formatListeningTime(stats.total_listening_seconds) }}</div>
            <p class="text-gray-400 font-medium">Đã phát {{ stats.total_songs_played }} bài hát trong {{ stats.active_days }} ngày</p>
          </div>

          <div class="user-card p-6">
            <h3 class="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Thể loại hàng đầu</h3>
            <div class="flex flex-wrap gap-2" v-if="topGenres.length > 0">
              <span 
                v-for="genre in topGenres" 
                :key="genre.id"
                class="px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition cursor-pointer"
                @click="$router.push(`/search?genre=${genre.name}`)"
              >
                {{ genre.name }}
              </span>
            </div>
            <p v-else class="text-sm text-gray-400 italic">Chưa đủ dữ liệu thể loại. Hãy nghe thêm nhạc!</p>
          </div>
        </section>

        <!-- Recently Played -->
        <section v-if="recentlyPlayed.length > 0">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold hover:underline cursor-pointer" @click="$router.push('/recently-played')">Mới nghe gần đây</h2>
            <RouterLink to="/recently-played" class="text-sm font-bold text-gray-400 hover:underline">Hiện tất cả</RouterLink>
          </div>
          <div class="user-horizontal-row">
            <RecentSongCard
              v-for="song in recentlyPlayed.slice(0, 8)" 
              :key="song.history_id"
              :song="song"
              class="user-horizontal-card user-playlist-card-size"
              @play="(s) => playSong(s, recentlyPlayed)"
            />
          </div>
        </section>

        <!-- Public Playlists -->
        <section>
          <h2 class="text-2xl font-bold mb-4 hover:underline cursor-pointer">Danh sách phát công khai</h2>
          <div v-if="publicPlaylists.length > 0" class="user-horizontal-row">
            <div 
              v-for="pl in publicPlaylists.slice(0, 8)" 
              :key="pl.id"
              class="user-horizontal-card user-playlist-card-size user-card user-card-hover p-4 group cursor-pointer relative"
              @click="$router.push(`/playlist/${pl.id}`)"
            >
              <div class="relative w-full aspect-square mb-4 shadow-lg rounded-md overflow-hidden">
                <img :src="getPlaylistCover(pl)" class="w-full h-full object-cover" @error="e => { e.target.onerror = null; e.target.src = '/images/default-cover.svg' }" />
                <button class="absolute bottom-2 right-2 user-play-btn w-12 h-12 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" class="w-6 h-6 fill-black ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </button>
              </div>
              <h3 class="text-base font-bold text-white truncate mb-1">{{ pl.name }}</h3>
              <p class="text-sm text-gray-400 truncate">{{ pl.song_count || 0 }} bài hát</p>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">Bạn chưa có playlist công khai nào.</p>
        </section>

        <!-- Following Artists -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold hover:underline cursor-pointer">Đang theo dõi</h2>
            <button 
              v-if="followedArtistCount > 0" 
              @click="$router.push('/me/followed-artists')"
              class="text-sm font-bold text-gray-400 hover:text-white hover:underline"
            >
              Xem tất cả
            </button>
          </div>
          <div v-if="followingArtists.length > 0" class="user-horizontal-row">
            <div 
              v-for="artist in followingArtists.slice(0, 8)" 
              :key="artist.id"
              class="user-horizontal-card user-artist-card-size user-card user-card-hover p-4 group cursor-pointer flex flex-col items-center text-center relative"
              @click="$router.push(`/artist/${artist.id}`)"
            >
              <div class="relative w-full aspect-square mb-4 shadow-lg rounded-full overflow-hidden">
                <img :src="localFormatImageUrl(artist.avatar_url)" class="w-full h-full object-cover" @error="e => { e.target.onerror = null; e.target.src = '/default-artist.png' }" />
              </div>
              <h3 class="text-base font-bold text-white truncate w-full">{{ artist.name }}</h3>
              <p class="text-sm text-gray-400 mt-1">Nghệ sĩ</p>
            </div>
          </div>
          <div v-else class="user-panel-soft text-center">
            <p class="text-gray-400 mb-4">Bạn chưa theo dõi nghệ sĩ nào.</p>
            <button @click="$router.push('/')" class="user-primary-btn">
              Khám phá nghệ sĩ
            </button>
          </div>
        </section>

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

  <EditProfileModal 
    :show="showEditModal" 
    :user="user" 
    @close="showEditModal = false" 
    @updated="handleProfileUpdated"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import api from '@/api/axios'
import EditProfileModal from '@/components/profile/EditProfileModal.vue'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'
import RecentSongCard from '@/components/common/RecentSongCard.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

const router = useRouter()
const playerStore = usePlayerStore()
const library = useLibraryStore()
const showEditModal = ref(false)

function handleProfileUpdated(updatedUser) {
  if (user.value) {
    user.value.name = updatedUser.name
    user.value.bio = updatedUser.bio
    user.value.avatar_url = updatedUser.avatar_url
  }
}


const loading = ref(true)
const error = ref('')

const user = ref(null)
const stats = ref({
  total_listening_seconds: 0,
  total_songs_played: 0,
  active_days: 0,
  unique_artists: 0,
  unique_genres: 0
})
const topGenres = ref([])
const topArtists = ref([])
const topTracks = ref([])
const recentlyPlayed = ref([])
const publicPlaylists = ref([])
const followingArtists = ref([])
const followedArtistCount = ref(0)

const localFormatImageUrl = (url) => {
  if (!url) return '' // handled by @error
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}

function formatDuration(seconds) {
  const s = Number(seconds || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatNumber(num) {
  if (!num) return '0'
  return new Intl.NumberFormat('vi-VN').format(num)
}

function formatListeningTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getSongId(song) {
  return song?.song_id ?? song?.id ?? song?.track_id ?? null
}

function isPlaying(song) {
  const currentId = getSongId(playerStore.currentSong)
  const songId = getSongId(song)
  return Boolean(playerStore.isPlaying && currentId !== null && songId !== null && String(currentId) === String(songId))
}

async function playSong(song, queueContext) {
  if (isPlaying(song)) {
    await playerStore.togglePlay()
    return
  }
  playerStore.playSong(song, queueContext, 'profile')
}

async function loadProfile() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/users/me/profile')
    if (res.data.success) {
      const data = res.data.data
      user.value = data.user
      stats.value = data.stats || stats.value
      topGenres.value = data.top_genres || []
      topArtists.value = data.top_artists_month || []
      topTracks.value = library.applyLikedStateToSongs(data.top_tracks_month || [])
      recentlyPlayed.value = library.applyLikedStateToSongs(data.recently_played || [])
      publicPlaylists.value = data.public_playlists || []
      followingArtists.value = data.following_artists || []
      followedArtistCount.value = data.followed_artist_count || data.following_artists?.length || 0
      
      // Deduplicate recently played on frontend just in case
      const seen = new Set()
      recentlyPlayed.value = recentlyPlayed.value.filter(song => {
        if (seen.has(song.id)) return false
        seen.add(song.id)
        return true
      })
      
    } else {
      error.value = res.data.message || 'Lỗi khi tải dữ liệu'
    }
  } catch (err) {
    console.error('Fetch profile error:', err)
    if (err.response) {
      error.value = `Lỗi ${err.response.status}: ${err.response.data?.message || 'Không thể tải hồ sơ'}`
    } else {
      error.value = 'Không thể kết nối đến server'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProfile()
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
function handleAddToQueue(song) { playerStore.addToQueue(song) }
function handleGoToSong(song) { router.push(`/song/${song.id || song.song_id}`) }
function handleGoToArtist(song) { if (song.artist_id) router.push(`/artist/${song.artist_id}`) }
function handleGoToAlbum(song) { if (song.album_id) router.push(`/album/${song.album_id}`) }
function handleShare(song) { 
  navigator.clipboard.writeText(`${window.location.origin}/song/${song.id || song.song_id}`) 
}
</script>

<style scoped>
</style>
