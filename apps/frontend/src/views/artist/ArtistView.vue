<template>
  <div class="artist-page relative user-page-bg pb-4" v-if="artist" :style="{ '--artist-color': dominantColor }">
    
    <!-- Sticky Header -->
    <div class="sticky-header" :class="{ 'visible': showStickyHeader }">
      <div class="flex items-center gap-4 px-6 h-full">
        <PlaybackButton class="sticky-play" size="sm" :is-playing="isArtistPlaying" @click="toggleArtistPlayback" />
        <h2 class="text-2xl font-bold text-white">{{ artist.name }}</h2>
      </div>
    </div>

    <!-- Hero Banner -->
    <header 
      class="artist-hero" 
      :style="{
        backgroundImage: `
          linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.78)),
          linear-gradient(to right, rgba(0,0,0,0.72), rgba(0,0,0,0.05)),
          url(${getAvatarUrl(artist)})
        `
      }"
    >
      <div class="hero-content">
        <div class="verified-badge flex items-center gap-2 mb-2" v-if="(artist.total_plays ?? artist.totalPlays ?? 0) > 100">
          <svg viewBox="0 0 24 24" class="w-6 h-6 text-blue-400" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span class="text-sm font-medium tracking-wide">Nghệ sĩ được xác minh</span>
        </div>
        <h1 class="artist-name">{{ artist.name }}</h1>
        <p class="artist-stats mt-4 text-base font-medium">
          {{ formatNumber(artist.follower_count) }} người theo dõi •
          {{ formatNumber(artist.total_plays ?? artist.totalPlays ?? 0) }} lượt nghe •
          {{ formatNumber(artist.song_count) }} bài hát
        </p>
        <p v-if="artistSummary" class="mt-4 max-w-2xl text-sm md:text-base font-medium leading-7 text-white/82 line-clamp-2">
          {{ artistSummary }}
        </p>
        <div v-if="artistGenres.length" class="mt-4 flex max-w-3xl flex-wrap gap-2">
          <span v-for="genre in artistGenres" :key="genre" class="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur">
            {{ genre }}
          </span>
        </div>
        <div v-if="artist.followers || artist.popularity" class="mt-4 flex flex-wrap gap-3 text-xs font-bold text-white/82">
          <span v-if="artist.followers" class="rounded-full bg-black/28 px-3 py-1.5">
            Spotify followers: {{ formatNumber(artist.followers) }}
          </span>
          <span v-if="artist.popularity" class="rounded-full bg-black/28 px-3 py-1.5">
            Popularity: {{ artist.popularity }}/100
          </span>
        </div>
      </div>
    </header>

    <!-- Content Area with dominant color gradient -->
    <div class="content-wrapper">
      <div class="content-bg-gradient"></div>
      
      <div class="relative z-10 px-6 md:px-8 py-6">
        <!-- Action Bar -->
        <section class="action-bar flex items-center gap-6 mb-10">
          <PlaybackButton size="md" :is-playing="isArtistPlaying" @click="toggleArtistPlayback" />
          
          <!-- Follow/Unfollow Button -->
          <button 
            class="follow-btn font-bold text-sm tracking-wide transition-all rounded-full px-6 py-2"
            :class="{
              'border border-[#b3b3b3] text-white hover:border-white hover:scale-105': isFollowing,
              'bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-105': !isFollowing && !followLoading
            }"
            :disabled="followLoading"
            @click="handleFollowToggle"
          >
            <span v-if="followLoading" class="flex items-center gap-2">
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isFollowing ? 'Đang bỏ theo dõi...' : 'Đang theo dõi...' }}
            </span>
            <span v-else>
              {{ isFollowing ? 'Đang theo dõi' : 'Theo dõi' }}
            </span>
          </button>
          
          <button 
            class="more-btn text-gray-400 hover:text-white transition-colors" 
            title="Chia sẻ"
            @click="isShareModalOpen = true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-7 h-7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          
          <button class="more-btn text-gray-400 hover:text-white transition-colors" title="Thêm">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </section>

        <!-- Popular & Artist Pick Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          <!-- Popular Songs -->
          <section class="lg:col-span-2 user-panel-soft">
            <h2 class="text-2xl font-bold mb-4 text-white hover:underline cursor-pointer">Phổ biến</h2>
            <div class="songs-table flex flex-col gap-1">
              <SongRow
                v-for="(song, idx) in displayedPopularSongs"
                :key="song.id"
                :song="song"
                :index="idx + 1"
                :isPlaying="isPlaying(song)"
                :showAlbum="false"
                :showPlays="true"
                @play="(s) => playSong(s, displayedPopularSongs)"
                @open-menu="handleOpenMenu"
                @toggle-like="handleToggleLike"
              />
            </div>
            <button 
              v-if="artist.popular_songs?.length > 5" 
              class="mt-4 text-sm font-bold text-gray-400 hover:text-white transition uppercase tracking-widest"
              @click="showPopularAll = !showPopularAll"
            >
              {{ showPopularAll ? 'Thu gọn' : 'Xem thêm' }}
            </button>
          </section>

          <!-- Artist Pick -->
          <section class="lg:col-span-1" v-if="artist.artist_pick">
            <h2 class="text-2xl font-bold mb-4 text-white">Lựa chọn của nghệ sĩ</h2>
            <div class="artist-pick-card user-card user-card-hover p-4 cursor-pointer group flex flex-col lg:flex-row xl:flex-col gap-4">
              <div class="relative w-20 h-20 lg:w-24 lg:h-24 xl:w-full xl:h-auto xl:aspect-square shrink-0 shadow-lg overflow-hidden rounded-md">
                <CoverImage :src="getItemCover(artist.artist_pick)" />
                <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
              </div>
              <div class="flex flex-col justify-center flex-1">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Pick của nghệ sĩ</span>
                <h3 class="text-base font-bold text-white line-clamp-2 group-hover:underline">{{ artist.artist_pick.title }}</h3>
                <p class="text-sm text-gray-400 mt-1 line-clamp-2">{{ artist.artist_pick.subtitle }}</p>
              </div>
            </div>
          </section>

        </div>

        <!-- Discography -->
        <section class="discography mb-12" v-if="artist.singles?.length || artist.albums?.length">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-white hover:underline cursor-pointer">Danh sách đĩa nhạc</h2>
            <button 
              v-if="hasMoreDiscography"
              class="text-sm font-bold text-gray-400 hover:text-white transition uppercase tracking-widest"
              @click="$router.push(`/artist/${artist.id}/discography`)"
            >
              Xem tất cả
            </button>
          </div>
          
          <!-- Tabs -->
          <div class="flex gap-2 mb-6">
            <button 
              v-if="artist.singles?.length"
              class="px-4 py-1.5 rounded-full text-sm font-bold transition-colors"
              :class="activeDiscoTab === 'singles' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'"
              @click="activeDiscoTab = 'singles'"
            >
              Singles
            </button>
            <button 
              v-if="artist.albums?.length"
              class="px-4 py-1.5 rounded-full text-sm font-bold transition-colors"
              :class="activeDiscoTab === 'albums' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'"
              @click="activeDiscoTab = 'albums'"
            >
              Albums
            </button>
          </div>

          <div class="user-horizontal-row">
            <div 
              v-for="item in displayedDiscography" 
              :key="item.id"
              class="user-horizontal-card user-album-card-size release-card user-card user-card-hover p-4 group cursor-pointer relative"
              @click="$router.push(`/album/${item.id}`)"
            >
              <div class="relative w-full aspect-square mb-4 shadow-lg rounded-md overflow-hidden">
                <CoverImage :src="getItemCover(item)" />
                <button 
                  class="absolute bottom-2 right-2 user-play-btn w-12 h-12 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                  @click.stop="$router.push(`/album/${item.id}`)"
                >
                  <svg viewBox="0 0 24 24" class="w-6 h-6 fill-black ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </button>
              </div>
              <h3 class="text-base font-bold text-white truncate mb-1">{{ item.title }}</h3>
              <p class="text-sm text-gray-400 truncate">{{ item.album_type === 'single' ? 'Single' : `Album • ${item.total_tracks} bài` }}</p>
            </div>
          </div>
        </section>

        <!-- Fans Also Like -->
        <section class="fans-also-like mb-12" v-if="artist.fans_also_like?.length">
          <h2 class="text-2xl font-bold text-white hover:underline cursor-pointer mb-6">Fan cũng thích</h2>
          <div class="user-horizontal-row">
            <ArtistCard
              v-for="fanArtist in artist.fans_also_like.slice(0, 8)"
              :key="fanArtist.id || fanArtist.artist_id"
              :artist="fanArtist"
              :show-stats="false"
              class="user-horizontal-card user-artist-card-size"
            />
          </div>
        </section>

        <!-- About Section -->
        <section class="about-section">
          <h2 class="text-2xl font-bold text-white hover:underline cursor-pointer mb-6">Giới thiệu</h2>
          <div 
            class="about-card relative w-full rounded-2xl overflow-hidden shadow-2xl cursor-pointer group bg-white/10 border border-white/10"
            :style="{
              minHeight: '400px',
              backgroundImage: `url(${getAvatarUrl(artist)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 20%'
            }"
          >
            <!-- Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
            
            <div class="absolute bottom-0 left-0 right-0 p-8">
              <div class="flex items-end gap-2 mb-4">
                <span class="text-white font-bold text-lg">{{ formatNumber(artist.follower_count) }}</span>
                <span class="text-gray-300 font-medium text-sm pb-0.5">người theo dõi</span>
              </div>
              <p class="text-white text-base md:text-lg font-medium leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all">
                {{ artistSummary || 'Thông tin nghệ sĩ đang được cập nhật.' }}
              </p>
              <a v-if="artist.bio_source_url" :href="artist.bio_source_url" target="_blank" rel="noreferrer" class="block mt-2 text-xs text-gray-300 hover:text-white underline" @click.stop>
                Nguồn tiểu sử: {{ artist.bio_source === 'wikipedia' ? 'Wikipedia' : (artist.bio_source === 'lastfm' ? 'Last.fm' : artist.bio_source) }}
              </a>
              <div class="mt-5 flex flex-wrap gap-2">
                <span v-for="genre in artistGenres" :key="`about-${genre}`" class="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white/88">
                  {{ genre }}
                </span>
                <a v-if="artist.external_url" :href="artist.external_url" target="_blank" rel="noreferrer" class="rounded-full bg-[#1ed760] px-3 py-1 text-xs font-bold text-black hover:bg-[#1fdf64]">
                  Spotify
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  </div>

  <!-- Loading & Error States -->
  <div v-else-if="loading" class="user-page-bg flex items-center justify-center">
    <div class="w-12 h-12 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
  </div>
  <div v-else-if="error" class="user-page-bg flex flex-col items-center justify-center text-center px-4">
    <svg class="w-16 h-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
    <h2 class="text-2xl font-bold text-white mb-2">Không tìm thấy nghệ sĩ</h2>
    <p class="text-gray-400 mb-6">{{ error }}</p>
    <button @click="$router.push('/')" class="px-6 py-2 bg-white text-black rounded-full font-bold hover:scale-105 transition">Trang chủ</button>
  </div>

  <SongActionMenu
    :show="menuState.show"
    :position="menuState.position"
    :song="menuState.song"
    :isLiked="library.isLiked(menuState.song)"
    @close="menuState.show = false"
    @add-to-playlist="handleAddToPlaylist"
    @toggle-like="handleToggleLike"
    @add-to-queue="handleAddToQueue"
    @go-to-song="handleGoToSong"
    @go-to-artist="handleGoToArtist"
    @go-to-album="handleGoToAlbum"
    @share="handleShare"
  />

  <!-- Share Modal -->
  <ShareEntityModal v-model:open="isShareModalOpen" :entity="artist" entityType="artist" />

  <ToastManager ref="toastManager" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useFollowedArtistsStore } from '@/stores/followedArtists'
import api from '@/api/axios'
import { extractDominantColor } from '@/utils/colorPalette'

import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import ShareEntityModal from '@/components/common/ShareEntityModal.vue'

import ToastManager from '@/components/common/ToastManager.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import PlaybackButton from '@/components/common/PlaybackButton.vue'
import { getItemCover } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const authStore = useAuthStore()
const followedArtistsStore = useFollowedArtistsStore()
const library = useLibraryStore()

const isShareModalOpen = ref(false)

const artist = ref(null)
const loading = ref(true)
const error = ref('')
const dominantColor = ref('32, 32, 32')
const showStickyHeader = ref(false)

// Follow state
const isFollowing = ref(false)
const followLoading = ref(false)

const activeDiscoTab = ref('singles')
const DISPLAY_LIMIT = 8

const artistGenres = computed(() => {
  if (!artist.value) return []
  if (Array.isArray(artist.value.genres)) return artist.value.genres.filter(Boolean)
  if (Array.isArray(artist.value.genres_json)) return artist.value.genres_json.filter(Boolean)
  if (typeof artist.value.genres_json === 'string') {
    try {
      const parsed = JSON.parse(artist.value.genres_json)
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
})

const artistSummary = computed(() => {
  return artist.value?.short_bio || artist.value?.bio || ''
})

const filteredDiscography = computed(() => {
  if (!artist.value) return []
  return activeDiscoTab.value === 'singles' ? artist.value.singles || [] : artist.value.albums || []
})

const displayedDiscography = computed(() => {
  return filteredDiscography.value.slice(0, DISPLAY_LIMIT)
})

const hasMoreDiscography = computed(() => {
  return filteredDiscography.value.length > DISPLAY_LIMIT
})

const getAvatarUrl = (item) => {
  if (!item) return '/default-artist.png'
  let url = item.avatar_url || item.avatarUrl || item.image_url || item.thumbnail_url || item.avatar || '/default-artist.png'
  if (url.startsWith('http') || url.startsWith('/default-')) return url
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

function isPlaying(song) {
  return playerStore.currentSong?.id === song.id
}

function getSongId(song) {
  return song?.id ?? song?.song_id ?? null
}

function getArtistQueue() {
  if (!artist.value) return []
  return artist.value.songs?.length ? artist.value.songs : artist.value.popular_songs || []
}

const isCurrentArtistTrack = computed(() => {
  const currentId = getSongId(playerStore.currentSong)
  if (!currentId) return false
  return getArtistQueue().some(song => String(getSongId(song)) === String(currentId))
})

const isArtistPlaying = computed(() => {
  return isCurrentArtistTrack.value && playerStore.isPlaying
})

function getArtistPlaybackContext(song) {
  return {
    source: 'artist',
    artistId: artist.value?.id || song?.artist_id || song?.artistId || null,
    genreId: song?.genre_id || song?.genreId || null,
    albumId: song?.album_id || song?.albumId || null,
    seedSongId: getSongId(song)
  }
}

function playSong(song, queueContext) {
  const queue = Array.isArray(queueContext) && queueContext.length ? queueContext : [song]
  const songId = getSongId(song)
  const index = queue.findIndex(item => String(getSongId(item)) === String(songId))
  playerStore.playSong(song, queue, index >= 0 ? index : 0, getArtistPlaybackContext(song))
}

function playArtist() {
  if (!artist.value) return
  if (isCurrentArtistTrack.value) {
    playerStore.togglePlay()
    return
  }
  const queue = getArtistQueue()
  if (!queue || !queue.length) return

  playerStore.playSong(queue[0], queue, 0, getArtistPlaybackContext(queue[0]))
}

function toggleArtistPlayback() {
  playArtist()
}

// Xử lý Follow/Unfollow
async function handleFollowToggle() {
  if (!authStore.isLoggedIn) {
    showToast('Vui lòng đăng nhập để theo dõi nghệ sĩ', 'warning')
    router.push('/login')
    return
  }

  followLoading.value = true
  try {
    if (isFollowing.value) {
      // Unfollow
      await followedArtistsStore.unfollowArtist(artist.value.id)
      isFollowing.value = false
      // Cập nhật số follower
      artist.value.follower_count = Math.max(0, (artist.value.follower_count || 1) - 1)
      showToast(`Đã bỏ theo dõi ${artist.value.name}`)
    } else {
      // Follow
      await followedArtistsStore.followArtist(artist.value.id)
      isFollowing.value = true
      // Cập nhật số follower
      artist.value.follower_count = (artist.value.follower_count || 0) + 1
      showToast(`Đã theo dõi ${artist.value.name}`)
    }
  } catch (err) {
    console.error('Follow toggle error:', err)
    showToast('Có lỗi xảy ra, vui lòng thử lại', 'error')
  } finally {
    followLoading.value = false
  }
}

// --- Menu & Interactivity ---

const showPopularAll = ref(false)
const displayedPopularSongs = computed(() => {
  if (!artist.value) return []
  return showPopularAll.value ? artist.value.popular_songs : (artist.value.popular_songs || []).slice(0, 5)
})

const menuState = ref({
  show: false,
  position: { x: 0, y: 0 },
  song: null
})



const toastManager = ref(null)
const showToast = (msg, type = 'success') => toastManager.value?.addToast(msg, type)

function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}

async function handleToggleLike(songItem) {
  if (!authStore.isLoggedIn) {
    showToast('Vui lòng đăng nhập để sử dụng chức năng này', 'warning')
    return
  }
  if (!songItem) return
  await library.toggleLike(songItem)
}

function handleAddToQueue(song) {
  playerStore.addToQueue(song)
  showToast('Đã thêm vào danh sách chờ')
}

function handleAddToPlaylist(song) {
  if (!authStore.isLoggedIn) {
    showToast('Vui lòng đăng nhập để sử dụng chức năng này', 'warning')
    return
  }
  library.openPlaylistModal(song)
}

function handleGoToAlbum(song) {
  if (song.album_id) {
    router.push(`/album/${song.album_id}`)
  }
}

function handleGoToSong(song) {
  router.push(`/song/${song.id || song.song_id}`)
}

function handleGoToArtist(song) {
  if (song.artist_id) router.push(`/artist/${song.artist_id}`)
}

function handleShare(song) {
  const url = `${window.location.origin}/song/${song.id}`
  navigator.clipboard.writeText(url)
  showToast('Đã sao chép liên kết bài hát')
}

function handlePlaylistSuccess(msg) {
  showToast(msg)
}


async function loadArtist() {
  loading.value = true
  error.value = ''
  artist.value = null
  dominantColor.value = '32, 32, 32'
  
  try {
    const res = await api.get(`/artists/${route.params.id}`)
    if (res.data.success) {
      artist.value = res.data.data
      if (Array.isArray(artist.value?.popular_songs)) {
        artist.value.popular_songs = library.applyLikedStateToSongs(artist.value.popular_songs)
      }
      if (Array.isArray(artist.value?.songs)) {
        artist.value.songs = library.applyLikedStateToSongs(artist.value.songs)
      }
      
      // Sync follow state từ API
      isFollowing.value = artist.value.is_following === true
      
      // Setup initial disco tab
      if (artist.value.singles?.length) {
        activeDiscoTab.value = 'singles'
      } else if (artist.value.albums?.length) {
        activeDiscoTab.value = 'albums'
      }
      
      // Extract color
      if (artist.value.avatar_url || artist.value.avatar) {
        dominantColor.value = await extractDominantColor(getAvatarUrl(artist.value))
      }
    } else {
      error.value = res.data.message || 'Lỗi khi tải dữ liệu'
    }
  } catch (err) {
    console.error('Fetch artist error:', err)
    error.value = 'Không thể lấy thông tin nghệ sĩ'
  } finally {
    loading.value = false
  }
}

function handleScroll() {
  showStickyHeader.value = window.scrollY > 300
}

watch(() => route.params.id, () => {
  if (route.name === 'ArtistProfile') {
    loadArtist()
    window.scrollTo(0, 0)
  }
})

onMounted(() => {
  loadArtist()
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
/* Variables injected via JS: --artist-color */

.artist-page {
  overflow-x: hidden;
}

/* Hero Section */
.artist-hero {
  height: clamp(340px, 40vh, 400px);
  background-size: cover;
  background-position: center 20%;
  position: relative;
}

.hero-content {
  position: absolute;
  left: max(32px, 5%);
  bottom: 24px;
  z-index: 2;
  color: white;
}

.artist-name {
  font-size: clamp(48px, 6vw, 96px);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.04em;
  text-shadow: 0 4px 24px rgba(0,0,0,0.5);
}

.artist-stats {
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

/* Sticky Header */
.sticky-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(var(--artist-color), 0.95);
  backdrop-filter: blur(16px);
  z-index: 50;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
  pointer-events: none;
}
.sticky-header.visible {
  transform: translateY(0);
  pointer-events: auto;
}

.sticky-play {
  opacity: 0;
  transform: translateY(8px);
}
.sticky-header.visible .sticky-play {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0.1s;
}
.sticky-play:hover {
  transform: scale(1.05) !important;
}

/* Gradient Background */
.content-wrapper {
  position: relative;
}
.content-bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 300px;
  background: linear-gradient(180deg, rgba(var(--artist-color), 0.25) 0%, rgba(15,23,42,0) 100%);
  z-index: 1;
  pointer-events: none;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
}
</style>
