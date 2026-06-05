<template>
  <div class="home-page home-page-bg pb-4">
    <div class="relative z-10 px-6 py-6 max-w-[1920px] mx-auto">
      <!-- Hero Section (Greeting) -->
      <HomeHero
        :displayName="auth.user?.display_name || 'bạn'"
        :featuredItem="featuredItem"
        @play="handlePlayFeatured"
        @explore="$router.push('/search')"
        class="mb-8" 
      />

      <!-- Error Banner -->
      <div v-if="homeError" class="mb-8 p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm flex items-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <span>{{ homeError }}</span>
      </div>

      <section v-if="quickAccess.length > 0" class="home-panel-soft mb-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="item in displayQuickAccess" 
            :key="`qa-${item.id}`"
            class="home-card home-card-hover group relative flex h-20 cursor-pointer items-center overflow-hidden rounded-2xl"
            @click="goToPlaylist(item)"
          >
            <img :src="getPlaylistCover(item)" @error="e => e.target.src='/default-cover.png'" class="w-20 h-20 object-cover flex-shrink-0 shadow-md" />
            <div class="flex-1 min-w-0 px-4">
              <h3 class="text-white font-bold text-base truncate">{{ item.name }}</h3>
            </div>
            <button 
              class="home-play-btn absolute right-4 z-10 h-10 w-10 flex-shrink-0 cursor-pointer border-none opacity-0 group-hover:opacity-100"
              @click.stop="playPlaylist(item)"
            >
              <svg viewBox="0 0 24 24" class="w-5 h-5 fill-white ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </button>
          </div>
        </div>
      </section>

      <!-- Section: Dành cho bạn (Made For You) -->
      <section v-if="madeForYouPlaylists.length > 0" class="home-panel mb-8">
        <SectionHeader 
          title="Dành cho bạn"
          subtitle="Những danh sách phát cá nhân hóa dựa trên thói quen nghe nhạc của bạn"
        />
        <div class="user-horizontal-row">
          <PlaylistCard
            v-for="item in displayMadeForYou"
            :key="`mfy-${item.id || item.name}`"
            :playlist="item"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </div>
      </section>

      <!-- Section: Nghe gần đây (Compact list) -->
      <section v-if="recentSongs.length > 0" class="home-panel mb-8">
        <SectionHeader 
          title="Nghe gần đây"
          subtitle="Tiếp tục từ nơi bạn đã dừng lại"
          @viewAll="$router.push('/recently-played')"
        />
        <div class="user-horizontal-row">
          <RecentSongCard
            v-for="song in displayRecentSongs"
            :key="song.history_id || song.song_id || song.id"
            :song="song"
            class="user-horizontal-card user-playlist-card-size"
            @play="playRecentSong"
          />
        </div>
      </section>

      <!-- Section: Gợi ý hôm nay -->
      <section v-if="recommendedToday.length > 0" class="home-panel mb-8">
        <SectionHeader 
          title="Gợi ý hôm nay"
          subtitle="Playlist phù hợp với thời điểm và thói quen nghe nhạc của bạn"
        />
        <div class="user-horizontal-row">
          <PlaylistCard
            v-for="item in displayRecommendedToday"
            :key="`rec-${item.id || item.name}`"
            :playlist="item"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </div>
      </section>

      <!-- Section: Xu hướng (Trending Now) -->
      <section v-if="trendingSongs.length > 0" class="home-panel mb-8">
        <SectionHeader 
          title="Xu hướng"
          subtitle="Những bài hát hot nhất hiện nay"
          @viewAll="$router.push('/search')"
        />
        <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          <SongRow
            v-for="(song, idx) in trendingSongs"
            :key="song.id || idx"
            :song="song"
            :index="idx + 1"
            :showIndex="true"
            :showAlbum="true"
            :compact="true"
            @play="playTrendingSong"
            @open-menu="handleOpenMenu"
            @toggle-like="toggleLike"
          />
        </div>
      </section>

      <WeeklyChartSection class="home-panel mb-8" @open-menu="handleOpenMenu" />

      <!-- Section: Danh sách phát của bạn -->
      <section v-if="userPlaylists.length > 0" class="home-panel mb-8">
        <SectionHeader 
          title="Danh sách phát của bạn"
          subtitle="Những playlist do bạn tạo"
        />
        <div class="user-horizontal-row">
          <PlaylistCard
            v-for="item in displayUserPlaylists"
            :key="`up-${item.id || item.name}`"
            :playlist="item"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </div>
      </section>

      <!-- Section: Nghệ sĩ quan tâm / Nổi bật -->
      <section v-if="displayArtists.length > 0" class="home-panel mb-8">
        <SectionHeader 
          :title="hasFollowedArtists ? 'Từ nghệ sĩ bạn quan tâm' : 'Nghệ sĩ nổi bật'"
          :subtitle="hasFollowedArtists ? 'Những nghệ sĩ bạn đang theo dõi' : 'Khám phá những nghệ sĩ được yêu thích'"
          :showViewAll="hasFollowedArtists"
          @viewAll="$router.push('/me/followed-artists')"
        />
        <div class="user-horizontal-row">
          <ArtistCard
            v-for="artist in displayArtists"
            :key="artist.id || artist.artist_id"
            :artist="artist"
            size="compact"
            :show-stats="false"
            class="user-horizontal-card user-artist-card-size"
          />
        </div>
      </section>

      <!-- Loading States -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-10 h-10 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Empty States -->
      <div v-if="!loading && !hasAnyData" class="text-center py-20">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="white" class="w-10 h-10">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">Chưa có gợi ý nào</h3>
        <p class="text-gray-400 mb-6">Hãy nghe thêm nhạc để chúng tôi hiểu bạn hơn</p>
        <button 
          @click="$router.push('/search')"
          class="px-6 py-3 bg-[#1ed760] text-black font-bold rounded-full hover:bg-[#1fdf64] transition"
        >
          Khám phá ngay
        </button>
      </div>
    </div>
    <!-- Action Menu -->
    <SongActionMenu
      :show="menuState.show"
      :position="menuState.position"
      :song="menuState.song"
      :isLiked="library?.isLiked(menuState.song)"
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
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { recommendApi } from '@/api/recommend'
import { songApi } from '@/api/song'
import { playlistApi } from '@/api/playlist'
import api from '@/api/axios'
import { useResponsivePreviewLimit } from '@/composables/useResponsivePreviewLimit'

// Components
import HomeHero from '@/components/home/HomeHero.vue'
import SectionHeader from '@/components/home/SectionHeader.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'
import PlaylistCard from '@/components/home/PlaylistCard.vue'
import RecentSongCard from '@/components/common/RecentSongCard.vue'
import SongRow from '@/components/common/SongRow.vue'
import WeeklyChartSection from '@/components/home/WeeklyChartSection.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const library = useLibraryStore()
const { previewLimit } = useResponsivePreviewLimit()

// Loading state
const loading = ref(false)
const homeError = ref('')

// Data refs
const trendingSongs = ref([])
const quickAccess = ref([])
const madeForYouPlaylists = ref([])
const recommendedToday = ref([])
const userPlaylists = ref([])
const followedArtists = ref([])
const popularArtists = ref([])
const hasFollowedArtists = ref(false)
const recentSongs = ref([])

// Unique Helpers
function getPlaylistUniqueKey(item) {
  return item.system_key || item.id || item.playlist_id || item.name;
}

function uniqueByPlaylist(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = getPlaylistUniqueKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Computed for Safe Display
const displayQuickAccess = computed(() => uniqueByPlaylist(quickAccess.value).slice(0, 3));

const MADE_FOR_YOU_ORDER = [
  'dailymix_01',
  'dailymix_02',
  'dailymix_03',
  'dailymix_04',
  'dailymix_05',
  'dailymix_06',
  'weeklymix'
];

const displayMadeForYou = computed(() => {
  return uniqueByPlaylist(madeForYouPlaylists.value)
    .filter(p => MADE_FOR_YOU_ORDER.includes(p.system_key))
    .sort((a, b) => {
      const aIndex = MADE_FOR_YOU_ORDER.indexOf(a.system_key);
      const bIndex = MADE_FOR_YOU_ORDER.indexOf(b.system_key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    .slice(0, previewLimit.value);
});

const displayRecentSongs = computed(() => recentSongs.value.slice(0, previewLimit.value));
const displayRecommendedToday = computed(() => recommendedToday.value.slice(0, previewLimit.value));
const displayUserPlaylists = computed(() => userPlaylists.value.slice(0, previewLimit.value));

// Featured item for hero
const featuredItem = computed(() => {
  if (madeForYouPlaylists.value.length > 0) return madeForYouPlaylists.value[0]
  if (recommendedToday.value.length > 0) return recommendedToday.value[0]
  return null
})

// Display artists
const displayArtists = computed(() => {
  if (followedArtists.value.length > 0) return followedArtists.value.slice(0, previewLimit.value)
  return popularArtists.value.slice(0, previewLimit.value)
})

// Check if has any data
const hasAnyData = computed(() => {
  return trendingSongs.value.length > 0 || 
         quickAccess.value.length > 0 || 
         madeForYouPlaylists.value.length > 0 ||
         recommendedToday.value.length > 0 ||
         recentSongs.value.length > 0 ||
         displayArtists.value.length > 0
})

// Load all data
async function loadData() {
  loading.value = true
  
  try {
    // 1. Load home recommendations (includes playlists and followed artists)
    try {
      const recRes = await recommendApi.getHomeRecommendations()
      if (recRes.data?.success) {
        quickAccess.value = recRes.data.data.quickAccess || []
        madeForYouPlaylists.value = recRes.data.data.madeForYouPlaylists || []
        recommendedToday.value = recRes.data.data.recommendedToday || []
        userPlaylists.value = recRes.data.data.userPlaylists || []
        followedArtists.value = recRes.data.data.followed_artists || []
        popularArtists.value = recRes.data.data.popular_artists || []
        hasFollowedArtists.value = recRes.data.data.has_followed_artists || false
      } else {
        homeError.value = 'Không thể tải đầy đủ gợi ý cá nhân hóa, đang hiển thị các bài hát xu hướng.'
      }
    } catch (err) {
      console.warn('Không thể tải gợi ý:', err)
      homeError.value = 'Không thể kết nối tải gợi ý, đang hiển thị các bài hát xu hướng.'
    }

    // 2. Load trending songs
    try {
      const trendRes = await songApi.getTrending()
      if (trendRes.data?.success && trendRes.data.data?.length) {
        trendingSongs.value = trendRes.data.data.slice(0, 10)
      }
    } catch (err) {
      console.warn('Không thể tải bảng xếp hạng:', err)
    }

    // 3. Load recently played songs for "Nghe gần đây"
    try {
      const profileRes = await api.get('/users/me/recently-played')
      if (profileRes.data?.success) {
        const raw = profileRes.data.data || []
        // Deduplicate by song_id
        const seen = new Set()
        recentSongs.value = raw.filter(s => {
          if (seen.has(s.song_id || s.id)) return false
          seen.add(s.song_id || s.id)
          return true
        }).slice(0, 6)
      }
    } catch (err) {
      console.warn('Không thể tải lịch sử nghe:', err)
    }
    
  } finally {
    loading.value = false
  }
}

// Navigation
function goToArtist(artist) {
  router.push(`/artist/${artist.id}`)
}

function goToPlaylist(playlist) {
  router.push(`/playlist/${playlist.id}`)
}

// Play functions
async function handlePlayFeatured(item) {
  await playPlaylist(item)
}

async function playPlaylist(item) {
  try {
    const res = await playlistApi.getDetail(item.id)
    const playlistData = res.data?.data
    if (playlistData?.songs?.length) {
      player.playbackSource = 'playlist'
      await player.setSong(playlistData.songs[0], playlistData.songs)
    }
  } catch (err) {
    console.error('Cannot play playlist:', err)
  }
}

async function playArtistSongs(artist) {
  try {
    const res = await api.get(`/artists/${artist.id}`)
    if (res.data?.success && res.data.data?.songs?.length) {
      const songs = res.data.data.songs
      player.playbackSource = 'artist'
      await player.setSong(songs[0], songs)
    }
  } catch (err) {
    console.error('Cannot play artist:', err)
  }
}

function playRecentSong(song) {
  const queue = recentSongs.value.filter(s => s.id || s.song_id)
  const targetSong = {
    ...song,
    id: song.song_id || song.id,
    artist_name: song.artist_name || song.artist,
    cover_url: song.cover_url || song.cover
  }
  player.setSong(targetSong, queue)
}

function playTrendingSong(song) {
  const queue = trendingSongs.value.map(s => ({
    ...s,
    artist_name: s.artist_name || s.artist
  }))
  player.playbackSource = 'recommend'
  player.setSong(queue[trendingSongs.value.indexOf(song)], queue)
}

async function toggleLike(song) {
  if (!song) return;
  await library.toggleLike(song)
}

// Menu logic
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}
function handleAddToPlaylist(song) { /* logic to open modal */ }
function handleAddToQueue(song) { player.addToQueue(song) }
function handleGoToSong(song) { router.push(`/song/${song.id || song.song_id}`) }
function handleGoToArtist(song) { if (song.artist_id) router.push(`/artist/${song.artist_id}`) }
function handleGoToAlbum(song) { if (song.album_id) router.push(`/album/${song.album_id}`) }
function handleShare(song) { 
  navigator.clipboard.writeText(`${window.location.origin}/song/${song.id || song.song_id}`) 
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.home-page {
  position: relative;
}

/* Section spacing */
section {
  position: relative;
  z-index: 10;
}

.artist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.recent-song-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

@media (min-width: 640px) {
  .artist-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .recent-song-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .artist-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    justify-content: stretch;
  }

  .recent-song-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .artist-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .recent-song-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
