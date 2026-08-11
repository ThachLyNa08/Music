<template>
  <div class="home-page home-page-bg pb-32 md:pb-36">
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
        <HorizontalScrollRow>
          <RecentSongCard v-for="song in displayStarterRecommendations" :key="'start-'+(song.id || song.song_id)" :song="song" class="user-horizontal-card user-playlist-card-size" @play="playStarterSong" />
        </HorizontalScrollRow>
      </section>

      <!-- Section 1: Mix cá nhân của bạn -->
      <div v-if="loadingHomeBase && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[136px] sm:w-[146px] md:w-[154px] lg:w-[160px] xl:w-[164px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Mix cá nhân của bạn"
          :subtitle="madeForYouSubtitle"
          @viewAll="router.push('/library')"
        />
        <HorizontalScrollRow v-if="madeForYouPlaylists.length > 0">
          <PlaylistCard
            v-for="item in displayMadeForYou"
            :key="`mfy-${item.id || item.name}`"
            :playlist="item"
            :customBottomLabel="getSystemMixBasisLabel(item)"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
          <button
            v-for="item in displayMadeForYouFillers"
            :key="item.key"
            type="button"
            class="user-horizontal-card user-playlist-card-size home-mix-filler-card"
            @click="router.push(item.to)"
          >
            <div class="home-mix-filler-card__cover">
              <img :src="item.cover" :alt="item.title" class="home-mix-filler-card__image" loading="lazy" decoding="async" />
              <span class="home-mix-filler-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </div>
            <span class="home-mix-filler-card__title">{{ item.title }}</span>
            <span class="home-mix-filler-card__desc">{{ item.desc }}</span>
          </button>
        </HorizontalScrollRow>
        <!-- Empty State for Mix cá nhân -->
        <div v-else class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13M9 9l12-2"/></svg>
          </div>
          <div class="text-center sm:text-left">
            <h4 class="text-sm font-bold text-white">Chưa có mix cá nhân</h4>
            <p class="text-xs text-white/60 mt-0.5">MusicFlow sẽ tạo mix cá nhân hóa sau khi bạn nghe thêm một vài bài hát.</p>
          </div>
        </div>
      </section>

      <!-- Vibes theo thời điểm (Both: Normal user fetches it from recommendation service, New user gets it injected) -->
      <section v-if="timeBasedVibes.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader title="Vibes theo thời điểm" subtitle="Âm nhạc phù hợp với từng khoảnh khắc trong ngày" />
        <HorizontalScrollRow>
          <PlaylistCard v-for="item in timeBasedVibes" :key="'vibe-'+item.system_key" :playlist="item" :customBottomLabel="item.isCurrent ? 'Phù hợp lúc này' : getSystemMixBasisLabel(item)" class="user-horizontal-card user-playlist-card-size" @click="goToPlaylist(item)" @play="playPlaylist(item)" />
        </HorizontalScrollRow>
      </section>

      <!-- Section 2: Gợi ý cá nhân hóa (Đề xuất nghe / Fallback) -->
      <div v-if="loadingRecommendations && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[136px] sm:w-[146px] md:w-[154px] lg:w-[160px] xl:w-[164px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && effectiveRecommendedSongs.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          :title="effectiveRecommendTitle"
          :subtitle="effectiveRecommendSubtitle"
          @viewAll="router.push('/recommendations/for-you')"
        />
        <HorizontalScrollRow>
          <RecentSongCard
            v-for="song in effectiveRecommendedSongs"
            :key="`rec-song-${song.id || song.song_id}`"
            :song="song"
            class="user-horizontal-card user-playlist-card-size"
            @play="playRecommendedSong"
          />
        </HorizontalScrollRow>
      </section>

      <!-- Section 3: Nghe gần đây (Personalized / Empty state) -->
      <div v-if="loadingRecent && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[136px] sm:w-[146px] md:w-[154px] lg:w-[160px] xl:w-[164px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Nghe gần đây"
          subtitle="Tiếp tục từ nơi bạn đã dừng lại"
          :showViewAll="recentSongs.length > 0"
          @viewAll="$router.push('/recently-played')"
        />
        <HorizontalScrollRow v-if="recentSongs.length > 0">
          <RecentSongCard
            v-for="song in displayRecentSongs"
            :key="song.history_id || song.song_id || song.id"
            :song="song"
            class="user-horizontal-card user-playlist-card-size"
            @play="playRecentSong"
          />
        </HorizontalScrollRow>
        <!-- Empty State for Nghe gần đây -->
        <div v-else class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="text-center sm:text-left">
            <h4 class="text-sm font-bold text-white">Bạn chưa nghe bài nào gần đây</h4>
            <p class="text-xs text-white/60 mt-0.5">Bắt đầu nghe nhạc để MusicFlow lưu lịch sử cho bạn.</p>
          </div>
        </div>
      </section>

      <!-- Section 4: Gợi ý hôm nay (Contextual / Fallback) -->
      <div v-if="loadingHomeBase && !newUserExperience" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[136px] sm:w-[146px] md:w-[154px] lg:w-[160px] xl:w-[164px] h-[180px] bg-white/5 rounded-xl animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="!newUserExperience && effectiveRecommendedToday.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          title="Gợi ý hôm nay"
          :subtitle="effectiveRecommendedTodaySubtitle"
        />
        <HorizontalScrollRow>
          <PlaylistCard
            v-for="item in effectiveRecommendedToday"
            :key="`rec-${item.id || item.name}`"
            :playlist="item"
            :customBottomLabel="getSystemMixBasisLabel(item)"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </HorizontalScrollRow>
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
            :play-on-row-click="true"
            @play="playTrendingSong"
            @open-menu="handleOpenMenu"
            @toggle-like="toggleLike"
          />
        </div>
        <div v-else-if="globalChartError" class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm font-semibold text-slate-400">
          Không thể tải dữ liệu xu hướng. Vui lòng thử lại.
        </div>
        <div v-else-if="globalChartLoaded" class="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm font-semibold text-slate-400">
          Chưa có dữ liệu xu hướng
        </div>
      </section>

      <WeeklyChartSection
        class="home-panel mb-4 md:mb-5"
        @open-menu="handleOpenMenu"
      />

      <!-- Section 5: Từ nghệ sĩ bạn quan tâm / Nghệ sĩ nổi bật -->
      <div v-if="loadingHomeBase" class="px-3 sm:px-6 py-4 space-y-4 w-full">
        <div class="h-8 w-48 bg-white/5 rounded-md animate-pulse"></div>
        <div class="flex gap-3 md:gap-4 overflow-hidden">
          <div v-for="j in 5" :key="j" class="w-[124px] sm:w-[140px] md:w-[160px] h-[124px] rounded-full bg-white/5 animate-pulse flex-shrink-0"></div>
        </div>
      </div>
      <section v-else-if="newUserExperience && onboardingArtists.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader :title="hasFollowedArtists ? 'Nghệ sĩ bạn đã chọn' : 'Nghệ sĩ nổi bật'" subtitle="Dựa trên lựa chọn của bạn" />
        <HorizontalScrollRow class="home-mix-row">
          <ArtistCard v-for="artist in displayOnboardingArtists" :key="'onb-'+artist.id" :artist="artist" size="compact" :show-stats="false" class="user-horizontal-card user-artist-card-size" />
        </HorizontalScrollRow>
      </section>
      <section v-else-if="!newUserExperience && effectiveArtists.length > 0" class="home-panel mb-4 md:mb-5">
        <SectionHeader
          :title="artistSectionTitle"
          :subtitle="artistSectionSubtitle"
          :showViewAll="hasFollowedArtists && _rawFollowedArtists.length > 0"
          @viewAll="$router.push('/me/followed-artists')"
        />
        <HorizontalScrollRow>
          <ArtistCard
            v-for="artist in effectiveArtists"
            :key="artist.id || artist.artist_id"
            :artist="artist"
            size="compact"
            :show-stats="false"
            class="user-horizontal-card user-artist-card-size"
          />
        </HorizontalScrollRow>
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
        <HorizontalScrollRow class="home-preserve-empty-row">
          <PlaylistCard
            v-for="item in displayUserPlaylists"
            :key="`up-${item.id || item.name}`"
            :playlist="item"
            class="user-horizontal-card user-playlist-card-size"
            @click="goToPlaylist(item)"
            @play="playPlaylist(item)"
          />
        </HorizontalScrollRow>
      </section>

      <!-- Empty States (If nothing at all loaded) -->
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
import HorizontalScrollRow from '@/components/common/HorizontalScrollRow.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

function normalizeListResponse(response) {
  const data = response?.data ?? response

  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.songs)) return data.songs
  if (Array.isArray(data?.playlists)) return data.playlists
  if (Array.isArray(data?.data)) return data.data

  return []
}

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
const { previewLimit, windowWidth } = useResponsivePreviewLimit()

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

// Fast reactive refs for template logic
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

// Reactive refs for template logic
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

// Computed for Displaying Rows in Horizontal Scroll Carousels
const displayQuickAccess = computed(() => quickAccess.value.slice(0, 6));
const displayMadeForYou = computed(() => madeForYouPlaylists.value.slice(0, 15));
const madeForYouTargetSlots = computed(() => {
  const width = windowWidth.value;
  if (width >= 900 && width < 1200) return 5;
  if (width >= 768 && width < 900) return 4;
  return previewLimit.value;
});

const displayMadeForYouFillers = computed(() => {
  const missingSlots = Math.max(0, madeForYouTargetSlots.value - displayMadeForYou.value.length);
  if (missingSlots <= 0) return [];

  return [
    {
      key: 'mfy-more-recommendations',
      title: 'Khám phá thêm',
      desc: 'Mở gợi ý cá nhân hóa cho bạn',
      to: '/recommendations/for-you',
      cover: '/images/default-cover.svg'
    },
    {
      key: 'mfy-library',
      title: 'Thư viện của bạn',
      desc: 'Xem các playlist và mix đã lưu',
      to: '/library',
      cover: '/images/default-cover.svg'
    },
    {
      key: 'mfy-search',
      title: 'Tìm vibe mới',
      desc: 'Khám phá nhạc hợp tâm trạng',
      to: '/search',
      cover: '/images/default-cover.svg'
    }
  ].slice(0, Math.min(3, missingSlots));
});

const effectiveRecommendedSongs = computed(() => {
  if (recommendedSongs.value.length > 0) return recommendedSongs.value.slice(0, 15);
  return trendingSongs.value.slice(0, 15);
});

const displayRecentSongs = computed(() => recentSongs.value.slice(0, 15));

const effectiveRecommendedToday = computed(() => {
  if (recommendedToday.value.length > 0) return recommendedToday.value.slice(0, 15);
  return madeForYouPlaylists.value.slice(0, 15);
});

const displayUserPlaylists = computed(() => userPlaylists.value.slice(0, 15));

const effectiveArtists = computed(() => {
  if (displayArtistsRaw.value.length > 0) return displayArtistsRaw.value.slice(0, 15);
  return onboardingArtists.value.slice(0, 15);
});

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
  content_based_onboarding: 'Gợi ý ban đầu dựa trên gu nghe ưa thích',
  most_popular_fallback: 'Các bài hát đang được nghe nhiều nhất',
  bpr_mf: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  bpr_mf_rerank: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  content_based_fallback: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  cold_start_preferences: 'Dựa trên sở thích ban đầu và xu hướng hiện tại',
  popular_fallback: 'Những bài hát được nghe nhiều gần đây',
  most_popular_v4: 'Dành cho bạn để bắt đầu khám phá âm nhạc',
};

const isColdStartUser = ref(_homeCache.homeBaseData?.isColdStartUser || false);

const effectiveRecommendTitle = computed(() => {
  if (recommendedSongs.value.length > 0) {
    return STRATEGY_TITLES[recommendStrategy.value] || 'Đề xuất nghe';
  }
  return 'Gợi ý nổi bật';
});

const effectiveRecommendSubtitle = computed(() => {
  if (recommendedSongs.value.length > 0) {
    return STRATEGY_SUBTITLES[recommendStrategy.value] || 'Dựa trên thói quen nghe nhạc của bạn';
  }
  return isColdStartUser.value
    ? 'Gợi ý khởi đầu dựa trên sở thích của bạn'
    : 'Dựa trên gu nghe và xu hướng hiện tại';
});

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

const effectiveRecommendedTodaySubtitle = computed(() => {
  if (recommendedToday.value.length > 0) return recommendedTodaySubtitle.value;
  return 'Một vài bài hát nổi bật để bắt đầu hôm nay';
});

const artistSectionTitle = computed(() => {
  return (hasFollowedArtists.value && _rawFollowedArtists.length > 0)
    ? 'Từ nghệ sĩ bạn quan tâm'
    : 'Nghệ sĩ nổi bật';
});

const artistSectionSubtitle = computed(() => {
  return (hasFollowedArtists.value && _rawFollowedArtists.length > 0)
    ? 'Những nghệ sĩ bạn đang theo dõi'
    : 'Khám phá những nghệ sĩ được yêu thích';
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
  const fetchAllSections = async () => {
    const results = await Promise.allSettled([
      recommendApi.getHomeRecommendations(),
      chartApi.getGlobal({ limit: 10 }, { timeout: 20000 }),
      api.get('/users/me/recently-played'),
      recommendApi.getHomeSongRecommendations(20)
    ]);

    // 1. Home Base Recommendations
    if (results[0].status === 'fulfilled' && results[0].value?.data?.success) {
      const recRes = results[0].value;
      if (recRes.data.newUserExperience) {
        newUserExperience.value = true;
        const sections = recRes.data.sections || {};
        starterRecommendations.value = normalizeListResponse(sections.starterRecommendations);
        timeBasedVibes.value = normalizeListResponse(sections.timeBasedVibes);
        onboardingArtists.value = normalizeListResponse(sections.onboardingArtists);
        trendingSongsList.value = normalizeListResponse(sections.trending);
        discoveryGenres.value = normalizeListResponse(sections.discoveryGenres);
        _homeCache.newUserExperience = true;
        _homeCache.sections = sections;
      } else {
        newUserExperience.value = false;
        const d = recRes.data.data || {};
        _rawQuickAccess = uniqueByPlaylist(normalizeListResponse(d.quickAccess));
        _rawMadeForYou = processMadeForYou(normalizeListResponse(d.madeForYouPlaylists));
        _rawRecommendedToday = normalizeListResponse(d.recommendedToday);
        _rawUserPlaylists = normalizeListResponse(d.userPlaylists);
        _rawFollowedArtists = normalizeListResponse(d.followed_artists);
        _rawPopularArtists = normalizeListResponse(d.popular_artists);

        quickAccess.value = _rawQuickAccess;
        madeForYouPlaylists.value = _rawMadeForYou;
        recommendedToday.value = _rawRecommendedToday;
        userPlaylists.value = _rawUserPlaylists;
        displayArtistsRaw.value = _rawFollowedArtists.length > 0 ? _rawFollowedArtists : _rawPopularArtists;

        hasFollowedArtists.value = d.has_followed_artists || false;
        trendingNowPlaylist.value = d.trendingNowPlaylist || null;
        isColdStartUser.value = d.isColdStartUser || false;

        _homeCache.homeBaseData = d;
      }
    } else {
      if (results[0].status === 'rejected') {
        console.warn('[Home Sections] fetchHomeBase failed:', results[0].reason);
      }
    }
    loadingHomeBase.value = false;

    // 2. Trending Charts
    globalChartLoading.value = !globalChartLoaded.value;
    globalChartError.value = null;

    if (results[1].status === 'fulfilled' && results[1].value?.data?.success) {
      const chartRes = results[1].value;
      const raw = chartRes.data.data;
      let combined = [];
      if (Array.isArray(raw)) {
        combined = raw;
      } else if (typeof raw === 'object') {
        combined = Array.isArray(raw.all) ? raw.all : [];
      }
      if (combined.length) {
        combined.sort((a, b) => (Number(b.weekly_plays || b.play_count || 0) - Number(a.weekly_plays || a.play_count || 0)));
        const seen = new Set();
        const uniqueSongs = [];
        for (const s of combined) {
          const id = s.id || s.song_id;
          if (id && !seen.has(id)) {
            seen.add(id);
            uniqueSongs.push({
              ...s,
              artist_name: s.artist_name || s.artist,
              duration_sec: s.duration_sec || s.duration || 0
            });
          }
        }
        _rawTrending = library.applyLikedStateToSongs(uniqueSongs.slice(0, 10));
      } else {
        _rawTrending = [];
      }
      trendingSongs.value = _rawTrending;
      globalChartLoaded.value = true;
      _homeCache.trendingSongs = _rawTrending;
      _homeCache.chartLoaded = true;
    } else {
      if (results[1].status === 'rejected') {
        globalChartError.value = results[1].reason;
      }
    }
    globalChartLoading.value = false;

    // 3. Recently Played
    if (results[2].status === 'fulfilled' && results[2].value?.data?.success) {
      const profileRes = results[2].value;
      const raw = normalizeListResponse(profileRes.data);
      const seen = new Set();
      _rawRecent = library.applyLikedStateToSongs(raw.filter(s => {
        const id = s.song_id || s.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 15));
      recentSongs.value = _rawRecent;
      _homeCache.recentSongs = _rawRecent;
    } else {
      if (results[2].status === 'rejected') {
        console.warn('[Home Sections] fetchRecent failed:', results[2].reason);
      }
    }
    loadingRecent.value = false;

    // 4. Personalized Song Recommendations
    if (results[3].status === 'fulfilled' && results[3].value?.data?.success) {
      const recSongRes = results[3].value;
      const items = normalizeListResponse(recSongRes.data);
      recommendStrategy.value = recSongRes.data.strategy || '';
      _rawRecommendedSongs = library.applyLikedStateToSongs(items);
      recommendedSongs.value = _rawRecommendedSongs;
      _homeCache.recommendStrategy = recommendStrategy.value;
      _homeCache.recommendedSongs = _rawRecommendedSongs;
    } else {
      if (results[3].status === 'rejected') {
        console.warn('[Home Sections] fetchRecommendations failed:', results[3].reason);
      }
    }
    loadingRecommendations.value = false;

    console.log('[Home Sections]', {
      personalMixes: madeForYouPlaylists.value.length,
      personalized: recommendedSongs.value.length,
      recently: recentSongs.value.length,
      today: recommendedToday.value.length,
      artists: displayArtistsRaw.value.length
    });
  };

  fetchAllSections();
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
    id: s.song_id || s.id,
    artist_name: s.artist_name || s.artist
  }))
  const songId = song?.song_id || song?.id
  const targetIndex = queue.findIndex(s => String(s.song_id || s.id) === String(songId))
  const target = queue[targetIndex >= 0 ? targetIndex : 0]
  const currentId = player.currentSong?.song_id || player.currentSong?.id
  const targetId = target?.song_id || target?.id
  if (currentId && targetId && String(currentId) === String(targetId)) {
    player.togglePlay()
    return
  }
  player.playbackSource = 'chart'
  player.setSong(target, queue, targetIndex >= 0 ? targetIndex : 0)
}

function onTrendingViewAll() {
  router.push('/charts/all')
}

function playRecommendedSong(song) {
  const queue = effectiveRecommendedSongs.value.map(s => ({
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

.home-mix-filler-card {
  min-width: 0;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025));
  color: #ffffff;
  text-align: left;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}

.home-mix-filler-card:hover {
  border-color: rgba(30, 215, 96, 0.38);
  background-color: rgba(255, 255, 255, 0.07);
  transform: translateY(-2px);
}

.home-mix-filler-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
}

.home-mix-filler-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.56;
}

.home-mix-filler-card__icon {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: #1ED760;
  color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
}

.home-mix-filler-card__icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.home-mix-filler-card__title {
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-mix-filler-card__desc {
  margin-top: 6px;
  color: #b3b3b3;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
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
