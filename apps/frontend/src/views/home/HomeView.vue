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
        v-else
        :displayName="auth.user?.display_name || 'bạn'"
        :featuredItem="featuredItem"
        @play="handlePlayFeatured"
        @explore="$router.push('/search')"
        class="mb-4 md:mb-5 rounded-none md:rounded-none"
      />

      <!-- Quick Access (Personalized) -->
      <div v-if="loadingHomeBase && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
           <div v-for="i in 6" :key="i" class="h-20 bg-white/5 rounded-xl animate-pulse"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && quickAccess.length > 0" class="home-panel-soft mb-4 md:mb-5">
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

      <!-- Bắt đầu từ sở thích của bạn (Cold Start) -->
      <section v-if="newUserExperience && starterRecommendations.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader title="Bắt đầu từ sở thích của bạn" subtitle="Dựa trên thể loại và nghệ sĩ bạn vừa chọn" @viewAll="router.push('/search')" />
        <div class="user-horizontal-row">
          <RecentSongCard v-for="song in displayStarterRecommendations" :key="'start-'+(song.id || song.song_id)" :song="song" class="user-horizontal-card user-playlist-card-size" @play="playStarterSong" />
        </div>
      </section>

      <!-- Mix cá nhân của bạn (Personalized) -->
      <div v-if="loadingHomeBase && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && madeForYouPlaylists.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Mix cá nhân của bạn"
          :subtitle="madeForYouSubtitle"
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

      <!-- Vibes theo thời điểm (Both: Normal user fetches it from recommendation service, New user gets it injected) -->
      <section v-if="timeBasedVibes.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader title="Vibes theo thời điểm" subtitle="Âm nhạc phù hợp với từng khoảnh khắc trong ngày" />
        <div class="user-horizontal-row">
          <PlaylistCard v-for="item in timeBasedVibes" :key="'vibe-'+item.system_key" :playlist="item" :customBottomLabel="item.isCurrent ? 'Phù hợp lúc này' : getSystemMixBasisLabel(item)" class="user-horizontal-card user-playlist-card-size" @click="goToPlaylist(item)" @play="playPlaylist(item)" />
        </div>
      </section>

      <!-- Đề xuất nghe (Personalized) -->
      <div v-if="loadingRecommendations && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && recommendedSongs.length > 0" class="home-panel mb-4 md:mb-5">
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

      <!-- Nghe gần đây (Personalized) -->
      <div v-if="loadingRecent && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && recentSongs.length > 0" class="home-panel mb-4 md:mb-5">
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

      <!-- Gợi ý hôm nay (Personalized) -->
      <div v-if="loadingHomeBase && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && recommendedToday.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Gợi ý hôm nay"
          :subtitle="recommendedTodaySubtitle"
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

      <!-- Xu hướng (Trending Now) (Both) -->
      <div v-if="loadingTrending" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-2 space-y-2">
           <div v-for="j in 5" :key="j" class="h-14 w-full bg-white/5 rounded-md animate-pulse"></div>
        </div>
      </div>
      <section v-else class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Xu hướng"
          subtitle="Những bài hát được nghe nhiều nhất trên hệ thống"
          @viewAll="onTrendingViewAll"
        />
        <div v-if="trendingSongs.length > 0" class="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-2">
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
        <div v-else-if="globalChartError" class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm font-semibold text-slate-400">
          Khong the tai du lieu xu huong. Vui long thu lai.
        </div>
        <div v-else-if="globalChartLoaded" class="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm font-semibold text-slate-400">
          Chưa có dữ liệu xu hướng
        </div>
      </section>

      <WeeklyChartSection
        class="home-panel mb-4 md:mb-5"
        @open-menu="handleOpenMenu"
      />

      <!-- Nghệ sĩ bạn đã chọn / Nghệ sĩ quan tâm -->
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[124px] rounded-full bg-white/5 animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="newUserExperience && onboardingArtists.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader :title="hasFollowedArtists ? 'Nghệ sĩ bạn đã chọn' : 'Nghệ sĩ nổi bật'" subtitle="Dựa trên lựa chọn của bạn" />
        <div class="user-horizontal-row">
          <ArtistCard v-for="artist in displayOnboardingArtists" :key="'onb-'+artist.id" :artist="artist" size="compact" :show-stats="false" class="user-horizontal-card user-artist-card-size" />
        </div>
      </section>
      <section v-else-if="!newUserExperience && displayArtists.length > 0" class="home-panel mb-4 md:mb-5">
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

      <!-- Danh sách phát của bạn (Personalized) -->
      <div v-if="loadingHomeBase && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && userPlaylists.length > 0" class="home-panel mb-4 md:mb-5">
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
import { playlistApi } from '@/api/playlist'
import { chartApi } from '@/api/chart'
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
  chartLoaded: false,
  recentSongs: null,
  recommendedSongs: null,
  recommendStrategy: ''
}

const loadingHomeBase = ref(!_homeCache.homeBaseData)
const globalChartSongs = ref(_homeCache.trendingSongs || [])
const globalChartLoading = ref(!_homeCache.chartLoaded)
const globalChartLoaded = ref(_homeCache.chartLoaded)
const globalChartError = ref(null)
const loadingTrending = globalChartLoading
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
const newUserExperience = ref(false)
const starterRecommendations = ref([])
const timeBasedVibes = ref([])
const onboardingArtists = ref([])
const trendingSongsList = ref([])
const discoveryGenres = ref([])

const displayStarterRecommendations = computed(() => starterRecommendations.value)
const displayOnboardingArtists = computed(() => onboardingArtists.value)
const displayTrendingSongsList = computed(() => trendingSongsList.value)

function playStarterRecommendations() {
  if (starterRecommendations.value.length > 0) {
    player.setQueue(starterRecommendations.value, 0)
    player.play()
  } else {
    router.push('/search')
  }
}
function playStarterSong(song) {
  if (!song) return
  player.setQueue([song], 0)
  player.play()
}
function playTrendingSongRaw(song) {
  if (!song) return
  player.setQueue([song], 0)
  player.play()
}

// Fast reactive refs for template logic and fast computed slice
const quickAccess = ref(_rawQuickAccess)
const madeForYouPlaylists = ref(_rawMadeForYou)
const recommendedToday = ref(_rawRecommendedToday)
const userPlaylists = ref(_rawUserPlaylists)
const trendingSongs = globalChartSongs
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
  model_personalized: 'Gợi ý cá nhân hóa',
  content_based_onboarding: 'Gợi ý theo sở thích ban đầu',
  most_popular_fallback: 'Bài hát phổ biến',
  bpr_mf: 'Đề xuất nghe',
  bpr_mf_rerank: 'Đề xuất nghe',
  content_based_fallback: 'Đề xuất nghe',
  cold_start_preferences: 'Đề xuất nghe',
  popular_fallback: 'Đang thịnh hành trên MusicFlow',
  most_popular_v4: 'Đề xuất nghe',
};

const STRATEGY_SUBTITLES = {
  model_personalized: 'Dựa trên thói quen nghe nhạc của bạn',
  content_based_onboarding: 'Người dùng chưa có đủ lịch sử nghe hoặc chưa có trong serving artifact.',
  most_popular_fallback: 'Không có đủ dữ liệu cá nhân hóa hoặc sở thích ban đầu.',
  bpr_mf: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  bpr_mf_rerank: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  content_based_fallback: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  cold_start_preferences: 'Dựa trên sở thích ban đầu và xu hướng hiện tại',
  popular_fallback: 'Những bài hát được nghe nhiều gần đây',
  most_popular_v4: 'Dành cho bạn để bắt đầu khám phá âm nhạc',
};

const recommendTitle = computed(() => STRATEGY_TITLES[recommendStrategy.value] || 'Đề xuất nghe');
const recommendSubtitle = computed(() => STRATEGY_SUBTITLES[recommendStrategy.value] || 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay');

const isColdStartUser = ref(_homeCache.homeBaseData?.isColdStartUser || false);

const madeForYouSubtitle = computed(() => {
  return isColdStartUser.value
    ? 'Danh sách phát dành cho bạn dựa trên sở thích và xu hướng'
    : 'Những danh sách phát cá nhân hóa dựa trên thói quen nghe nhạc của bạn';
});

const recommendedTodaySubtitle = computed(() => {
  return isColdStartUser.value
    ? 'Những gợi ý theo thời điểm để bạn bắt đầu nghe hôm nay'
    : 'Playlist phù hợp với thời điểm và thói quen nghe nhạc của bạn';
});


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
        if (recRes.data.newUserExperience) {
          newUserExperience.value = true
          const sections = recRes.data.sections || {}
          starterRecommendations.value = sections.starterRecommendations?.items || []
          timeBasedVibes.value = sections.timeBasedVibes?.items || []
          onboardingArtists.value = sections.onboardingArtists?.items || []
          trendingSongsList.value = sections.trending?.items || []
          discoveryGenres.value = sections.discoveryGenres?.items || []
          _homeCache.newUserExperience = true
          _homeCache.sections = sections
        } else {
          newUserExperience.value = false
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
        isColdStartUser.value = d.isColdStartUser || false

        _homeCache.homeBaseData = d
        } // close else block for newUserExperience
      } else {
        homeError.value = 'Không thể tải đầy đủ gợi ý cá nhân hóa.'
      }
    } catch (err) {
      console.warn('Không thể tải gợi ý:', err)
      homeError.value = 'Không thể kết nối tải gợi ý.'
    } finally {
      loadingHomeBase.value = false
      performance.mark('home-homebase-ready')
    }
  }

  const fetchTrending = async () => {
    globalChartLoading.value = !globalChartLoaded.value
    globalChartError.value = null

    try {
      const chartRes = await chartApi.getGlobal({ limit: 10 }, { timeout: 20000 })
      if (chartRes.data?.success && chartRes.data.data) {
        const raw = chartRes.data.data
        let combined = []
        if (Array.isArray(raw)) {
          combined = raw
        } else if (typeof raw === 'object') {
          combined = Array.isArray(raw.all) ? raw.all : []
        }
        if (combined.length) {
          combined.sort((a, b) => (Number(b.weekly_plays || b.play_count || 0) - Number(a.weekly_plays || a.play_count || 0)))
          const seen = new Set()
          const uniqueSongs = []
          for (const s of combined) {
            const id = s.id || s.song_id
            if (id && !seen.has(id)) {
              seen.add(id)
              uniqueSongs.push({
                ...s,
                artist_name: s.artist_name || s.artist,
                duration_sec: s.duration_sec || s.duration || 0
              })
            }
          }
          _rawTrending = library.applyLikedStateToSongs(uniqueSongs.slice(0, 10))
        } else {
          _rawTrending = []
        }
      } else {
        _rawTrending = []
      }
      trendingSongs.value = _rawTrending
      globalChartLoaded.value = true
      _homeCache.trendingSongs = _rawTrending
      _homeCache.chartLoaded = true
    } catch (err) {
      console.warn('Không thể tải bảng xếp hạng weekly:', err)
      globalChartError.value = err
    } finally {
      globalChartLoading.value = false
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
  fetchHomeBase()
  fetchTrending()

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
  player.playbackSource = 'chart'
  player.setSong(queue[trendingSongs.value.indexOf(song)], queue)
}

function onTrendingViewAll() {
  router.push('/charts/all')
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
