<template>
  <div class="home-page home-page-bg pb-4">
    <div class="relative z-10 max-w-[1920px] mx-auto home-shell" :class="{ 'home-shell--entered': isHomeEntered }">

      <!-- Error Banner -->
      <div v-if="homeError" class="mb-3 p-4 mx-4 sm:mx-6 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm flex items-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <span>{{ homeError }}</span>
      </div>

      <!-- Hero Section -->
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 w-full">
        <div class="h-[280px] w-full bg-white/5 rounded-none md:rounded-2xl animate-pulse"></div>
      </div>
      <HomeHero
        v-else-if="featuredItem"
        :displayName="auth.user?.display_name || 'bạn'"
        :featuredItem="featuredItem"
        @play="handlePlayFeatured"
        @explore="$router.push('/search')"
        class="mb-4 md:mb-5 rounded-none md:rounded-none"
      />

      <!-- Quick Access Section -->
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
           <div v-for="i in 6" :key="i" class="h-20 bg-white/5 rounded-xl animate-pulse"></div>
        </div>
      </div>
      <section v-else-if="quickAccess.length > 0" class="home-panel-soft mb-4 md:mb-5">
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <div
            v-for="item in displayQuickAccess"
            :key="`qa-${item.id}`"
            class="home-card home-card-hover group relative flex h-16 md:h-20 cursor-pointer items-center overflow-hidden rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.08] transition-all duration-300"
            @click="goToPlaylist(item)"
          >
            <img :src="getPlaylistCover(item)" loading="lazy" decoding="async" @error="e => e.target.src='/default-cover.png'" class="w-16 h-16 md:w-20 md:h-20 object-cover flex-shrink-0 shadow-md" />
            <div class="flex-1 min-w-0 px-2 md:px-4">
              <h3 class="text-white font-bold tracking-tight text-[13px] md:text-base truncate">{{ item.name }}</h3>
            </div>
            <button
              class="home-play-btn absolute right-2 md:right-4 z-10 h-8 w-8 md:h-10 md:w-10 flex-shrink-0 cursor-pointer border-none opacity-0 group-hover:opacity-100"
              @click.stop="playPlaylist(item)"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4 md:w-5 md:h-5 fill-black ml-1 md:ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </button>
          </div>
        </div>
      </section>

      <!-- Section: Mix cá nhân của bạn (Made For You) -->
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="madeForYouPlaylists.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Mix cá nhân của bạn"
          subtitle="Những danh sách phát cá nhân hóa dựa trên thói quen nghe nhạc của bạn"
          @viewAll="router.push('/library')"
        />
        <div class="user-horizontal-row">
          <PlaylistCard
            v-for="item in displayMadeForYou"
            :key="`mfy-${item.id || item.name}`"
            :playlist="item"
            :customBottomLabel="getSystemMixBasisLabel(item)"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </div>
      </section>

      <!-- Section: Đề xuất từ gu nghe của bạn (BPR-MF) -->
      <div v-if="loadingRecommendations" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="recommendedSongs.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          :title="recommendTitle"
          :subtitle="recommendSubtitle"
          @viewAll="router.push('/recommendations/for-you')"
        />
        <div class="user-horizontal-row">
          <RecentSongCard
            v-for="song in displayRecommendedSongs"
            :key="`rec-song-${song.id || song.song_id}`"
            :song="song"
            class="user-horizontal-card user-playlist-card-size"
            @play="playRecommendedSong"
          />
        </div>
      </section>

      <!-- Section: Nghe gần đây (Compact list) -->
      <div v-if="loadingRecent" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="recentSongs.length > 0" class="home-panel mb-4 md:mb-5">
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
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="recommendedToday.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Gợi ý hôm nay"
          subtitle="Playlist phù hợp với thời điểm và thói quen nghe nhạc của bạn"
        />
        <div class="user-horizontal-row">
          <PlaylistCard
            v-for="item in displayRecommendedToday"
            :key="`rec-${item.id || item.name}`"
            :playlist="item"
            :customBottomLabel="getSystemMixBasisLabel(item)"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </div>
      </section>

      <!-- Section: Xu hướng (Trending Now) -->
      <div v-if="loadingTrending" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-2 space-y-2">
           <div v-for="j in 5" :key="j" class="h-14 w-full bg-white/5 rounded-md animate-pulse"></div>
        </div>
      </div>
      <section v-else-if="trendingSongs.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Xu hướng"
          subtitle="Những bài hát hot nhất hiện nay"
          @viewAll="onTrendingViewAll"
        />
        <div class="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-2">
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

      <!-- Weekly Chart -->
      <WeeklyChartSection class="home-panel mb-4 md:mb-5" @open-menu="handleOpenMenu" />

      <!-- Section: Danh sách phát của bạn -->
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="userPlaylists.length > 0" class="home-panel mb-4 md:mb-5">
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
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[124px] rounded-full bg-white/5 animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="displayArtists.length > 0" class="home-panel mb-4 md:mb-5">
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

      <!-- Empty States -->
      <div v-if="!isAnyLoading && !hasAnyData" class="text-center py-20">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-900/20">
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

function getSystemMixBasisLabel(playlist) {
  const name = String(playlist?.name || '').toLowerCase()

  if (name.includes('daily mix 01')) return 'Dựa trên gu nghe Thứ Hai'
  if (name.includes('daily mix 02')) return 'Dựa trên gu nghe Thứ Ba'
  if (name.includes('daily mix 03')) return 'Dựa trên gu nghe Thứ Tư'
  if (name.includes('daily mix 04')) return 'Dựa trên gu nghe Thứ Năm'
  if (name.includes('daily mix 05')) return 'Dựa trên gu nghe Thứ Sáu'
  if (name.includes('daily mix 06')) return 'Dựa trên gu nghe cuối tuần'

  if (name.includes('weekly mix')) return 'Tổng hợp gu nghe trong tuần'
  if (name.includes('morning')) return 'Dành cho buổi sáng của bạn'
  if (name.includes('afternoon')) return 'Dành cho buổi chiều thư giãn'
  if (name.includes('evening')) return 'Dành cho buổi tối nhẹ nhàng'
  if (name.includes('night')) return 'Dành cho đêm nghe nhạc'
  if (name.includes('mood')) return 'Dựa trên mood nghe gần đây'
  if (name.includes('favorite')) return 'Những bài hát bạn đã yêu thích'
  if (name.includes('trending')) return 'Những bài hát đang thịnh hành'

  return 'Cá nhân hóa theo gu nghe của bạn'
}

const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const library = useLibraryStore()
const { previewLimit } = useResponsivePreviewLimit()

// Animation flag
const isHomeEntered = ref(false)

// Global memory cache for HomeView to prevent empty flicker on remount
const _homeCache = {
  homeBaseData: null,
  trendingSongs: null,
  recentSongs: null,
  recommendedSongs: null,
  recommendStrategy: ''
}

const loadingHomeBase = ref(!_homeCache.homeBaseData)
const loadingTrending = ref(!_homeCache.trendingSongs)
const loadingRecent = ref(!_homeCache.recentSongs)
const loadingRecommendations = ref(!_homeCache.recommendedSongs)
const homeError = ref('')

// Data state
const trendingNowPlaylist = ref(null)
const recommendStrategy = ref(_homeCache.recommendStrategy || '')
const hasFollowedArtists = ref(_homeCache.homeBaseData?.has_followed_artists || false)

// Raw normalized data (processed once during fetch)
let _rawQuickAccess = _homeCache.homeBaseData?.quickAccess ? uniqueByPlaylist(_homeCache.homeBaseData.quickAccess) : []
let _rawMadeForYou = _homeCache.homeBaseData?.madeForYouPlaylists ? processMadeForYou(_homeCache.homeBaseData.madeForYouPlaylists) : []
let _rawRecommendedToday = _homeCache.homeBaseData?.recommendedToday || []
let _rawUserPlaylists = _homeCache.homeBaseData?.userPlaylists || []
let _rawFollowedArtists = _homeCache.homeBaseData?.followed_artists || []
let _rawPopularArtists = _homeCache.homeBaseData?.popular_artists || []

let _rawTrending = _homeCache.trendingSongs || []
let _rawRecent = _homeCache.recentSongs || []
let _rawRecommendedSongs = _homeCache.recommendedSongs || []

// Fast reactive refs for template logic and fast computed slice
const quickAccess = ref(_rawQuickAccess)
const madeForYouPlaylists = ref(_rawMadeForYou)
const recommendedToday = ref(_rawRecommendedToday)
const userPlaylists = ref(_rawUserPlaylists)
const trendingSongs = ref(_rawTrending)
const recentSongs = ref(_rawRecent)
const recommendedSongs = ref(_rawRecommendedSongs)
const displayArtistsRaw = ref(_rawFollowedArtists.length > 0 ? _rawFollowedArtists : _rawPopularArtists)

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

const MADE_FOR_YOU_ORDER = [
  'weekly_mix', 'dailymix_01', 'dailymix_02', 'dailymix_03',
  'dailymix_04', 'dailymix_05', 'dailymix_06', 'weeklymix'
];

function processMadeForYou(items) {
  return uniqueByPlaylist(items)
    .filter(p => MADE_FOR_YOU_ORDER.includes(p.system_key))
    .sort((a, b) => {
      const aIndex = MADE_FOR_YOU_ORDER.indexOf(a.system_key);
      const bIndex = MADE_FOR_YOU_ORDER.indexOf(b.system_key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}

// Computed for Safe Fast Display (only slice, no heavy filters)
const displayQuickAccess = computed(() => quickAccess.value.slice(0, 3));
const displayMadeForYou = computed(() => madeForYouPlaylists.value.slice(0, previewLimit.value));
const displayRecentSongs = computed(() => recentSongs.value.slice(0, previewLimit.value));
const displayRecommendedToday = computed(() => recommendedToday.value.slice(0, previewLimit.value));
const displayUserPlaylists = computed(() => userPlaylists.value.slice(0, previewLimit.value));
const displayRecommendedSongs = computed(() => recommendedSongs.value.slice(0, previewLimit.value));
const displayArtists = computed(() => displayArtistsRaw.value.slice(0, previewLimit.value));

const STRATEGY_TITLES = {
  bpr_mf: 'Đề xuất từ gu nghe của bạn',
  bpr_mf_rerank: 'Đề xuất từ gu nghe của bạn',
  content_based_fallback: 'Đề xuất từ gu nghe của bạn',
  cold_start_preferences: 'Bắt đầu với gu bạn chọn',
  popular_fallback: 'Đang thịnh hành trên MusicFlow',
};

const STRATEGY_SUBTITLES = {
  bpr_mf: 'Dựa trên thói quen nghe của bạn',
  bpr_mf_rerank: 'Dựa trên thói quen nghe của bạn',
  content_based_fallback: 'Dựa trên những bài hát bạn đã nghe gần đây',
  cold_start_preferences: 'Dựa trên thể loại và nghệ sĩ bạn chọn khi đăng ký',
  popular_fallback: 'Những bài hát được nghe nhiều gần đây',
};

const recommendTitle = computed(() => STRATEGY_TITLES[recommendStrategy.value] || 'Đề xuất từ gu nghe của bạn');
const recommendSubtitle = computed(() => STRATEGY_SUBTITLES[recommendStrategy.value] || 'Dựa trên thói quen nghe nhạc của bạn');

// Featured item for hero
const featuredItem = computed(() => {
  if (madeForYouPlaylists.value.length > 0) return madeForYouPlaylists.value[0]
  if (recommendedToday.value.length > 0) return recommendedToday.value[0]
  return null
})

// Loading flags
const isAnyLoading = computed(() => loadingHomeBase.value || loadingTrending.value || loadingRecent.value || loadingRecommendations.value)

// Check if has any data
const hasAnyData = computed(() => {
  return trendingSongs.value.length > 0 ||
         quickAccess.value.length > 0 ||
         madeForYouPlaylists.value.length > 0 ||
         recommendedToday.value.length > 0 ||
         recentSongs.value.length > 0 ||
         displayArtistsRaw.value.length > 0 ||
         recommendedSongs.value.length > 0
})

function loadDataParallel() {
  const fetchHomeBase = async () => {
    try {
      const recRes = await recommendApi.getHomeRecommendations()
      if (recRes.data?.success) {
        const d = recRes.data.data

        // Heavy processing once
        _rawQuickAccess = uniqueByPlaylist(d.quickAccess || [])
        _rawMadeForYou = processMadeForYou(d.madeForYouPlaylists || [])
        _rawRecommendedToday = d.recommendedToday || []
        _rawUserPlaylists = d.userPlaylists || []
        _rawFollowedArtists = d.followed_artists || []
        _rawPopularArtists = d.popular_artists || []

        quickAccess.value = _rawQuickAccess
        madeForYouPlaylists.value = _rawMadeForYou
        recommendedToday.value = _rawRecommendedToday
        userPlaylists.value = _rawUserPlaylists
        displayArtistsRaw.value = _rawFollowedArtists.length > 0 ? _rawFollowedArtists : _rawPopularArtists

        hasFollowedArtists.value = d.has_followed_artists || false
        trendingNowPlaylist.value = d.trendingNowPlaylist || null

        _homeCache.homeBaseData = d
      } else {
        homeError.value = 'Không thể tải đầy đủ gợi ý cá nhân hóa.'
      }
    } catch (err) {
      console.warn('Không thể tải gợi ý:', err)
      homeError.value = 'Không thể kết nối tải gợi ý.'
    } finally {
      loadingHomeBase.value = false
      performance.mark('home-homebase-ready')

      // Once homeBase is done, trigger trending
      fetchTrending()
    }
  }

  const fetchTrending = async () => {
    try {
      if (trendingNowPlaylist.value?.id) {
        const detailRes = await playlistApi.getDetail(trendingNowPlaylist.value.id)
        const songs = detailRes.data?.data?.songs || []
        if (songs.length) {
          _rawTrending = library.applyLikedStateToSongs(songs.slice(0, 10))
        } else {
          await fallbackTrending()
        }
      } else {
        await fallbackTrending()
      }
      trendingSongs.value = _rawTrending
      _homeCache.trendingSongs = _rawTrending
    } catch (err) {
      console.warn('Không thể tải bảng xếp hạng:', err)
      if (err?.response?.status === 404) {
        trendingNowPlaylist.value = null
        if (_homeCache.homeBaseData) {
          _homeCache.homeBaseData.trendingNowPlaylist = null
        }
      }
      await fallbackTrending()
      trendingSongs.value = _rawTrending
      _homeCache.trendingSongs = _rawTrending
    } finally {
      loadingTrending.value = false
    }
  }

  const fallbackTrending = async () => {
    const trendRes = await songApi.getTrending()
    if (trendRes.data?.success && trendRes.data.data?.length) {
      _rawTrending = library.applyLikedStateToSongs(trendRes.data.data.slice(0, 10))
    }
  }

  const fetchRecent = async () => {
    try {
      const profileRes = await api.get('/users/me/recently-played')
      if (profileRes.data?.success) {
        const raw = profileRes.data.data || []
        const seen = new Set()
        _rawRecent = library.applyLikedStateToSongs(raw.filter(s => {
          if (seen.has(s.song_id || s.id)) return false
          seen.add(s.song_id || s.id)
          return true
        }).slice(0, 10))
        recentSongs.value = _rawRecent
        _homeCache.recentSongs = _rawRecent
      }
    } catch (err) {
      console.warn('Không thể tải lịch sử nghe:', err)
    } finally {
      loadingRecent.value = false
    }
  }

  const fetchRecommendations = async () => {
    try {
      const recSongRes = await recommendApi.getHomeSongRecommendations(20)
      if (recSongRes.data?.success && Array.isArray(recSongRes.data.items)) {
        recommendStrategy.value = recSongRes.data.strategy || ''
        _rawRecommendedSongs = library.applyLikedStateToSongs(recSongRes.data.items)
        recommendedSongs.value = _rawRecommendedSongs
        _homeCache.recommendStrategy = recommendStrategy.value
        _homeCache.recommendedSongs = _rawRecommendedSongs
      }
    } catch (err) {
      console.warn('Không thể tải gợi ý bài hát cá nhân hóa:', err)
    } finally {
      loadingRecommendations.value = false
      performance.mark('home-recommend-ready')
      performance.measure('fetch-to-recommend-ready', 'home-first-fetch-start', 'home-recommend-ready')
    }
  }

  // Execute in parallel (non-blocking)
  fetchHomeBase() // fetchTrending depends on this

  const runIdle = (fn) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(fn, { timeout: 1000 })
    } else {
      setTimeout(fn, 120)
    }
  }

  runIdle(() => {
    fetchRecent()
    fetchRecommendations()
  })
}

function afterFirstPaint(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      callback()
    })
  })
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
      const songs = library.applyLikedStateToSongs(playlistData.songs)
      player.playbackSource = 'playlist'
      await player.setSong(songs[0], songs)
    }
  } catch (err) {
    console.error('Cannot play playlist:', err)
  }
}

async function playArtistSongs(artist) {
  try {
    const res = await api.get(`/artists/${artist.id}`)
    if (res.data?.success && res.data.data?.songs?.length) {
      const songs = library.applyLikedStateToSongs(res.data.data.songs)
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

function onTrendingViewAll() {
  const tn = trendingNowPlaylist.value
  if (tn && tn.id) {
    router.push(`/playlist/${tn.id}`)
  } else {
    router.push('/search')
  }
}

function playRecommendedSong(song) {
  const queue = recommendedSongs.value.map(s => ({
    ...s,
    artist_name: s.artist_name || s.artist
  }))
  const target = queue.find(s => (s.id || s.song_id) === (song.id || song.song_id)) || song
  player.playbackSource = 'recommend'
  player.setSong(target, queue)
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
  performance.mark('home-mount-start')

  // Trigger animation frame 1
  requestAnimationFrame(() => {
    isHomeEntered.value = true
    performance.mark('home-enter-class-set')
    performance.measure('mount-to-enter', 'home-mount-start', 'home-enter-class-set')
  })

  // Non-blocking fetch delayed until after first paint
  afterFirstPaint(() => {
    performance.mark('home-first-fetch-start')
    performance.measure('enter-to-fetch', 'home-enter-class-set', 'home-first-fetch-start')
    loadDataParallel()
  })
})
</script>

<style scoped>
.home-page {
  position: relative;
}

/* ==================================
   HOME ANIMATION CSS
   ================================== */
.home-shell {
  opacity: 0;
  transform: translateY(24px);
  will-change: opacity, transform;
}

.home-shell--entered {
  animation: home-soft-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes home-soft-enter {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-shell--entered {
    animation: none !important;
    opacity: 1;
    transform: translateY(0);
  }
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
  padding: 0 24px;
}

.recent-song-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding: 0 24px;
}

.home-panel, .home-panel-soft {
  padding-left: 16px;
  padding-right: 16px;
}

@media (min-width: 640px) {
  .home-panel, .home-panel-soft {
    padding-left: 24px;
    padding-right: 24px;
  }
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
