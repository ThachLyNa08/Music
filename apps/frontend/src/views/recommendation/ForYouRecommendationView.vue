<template>
  <div class="recommendation-page user-page-bg pb-28">
    <section class="relative overflow-hidden w-full px-6 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <img
        v-if="heroBackground"
        :src="heroBackground"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.34] scale-[1.18] blur-[34px] saturate-[1.15] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,20,0.9),rgba(9,11,20,0.68),rgba(9,11,20,0.96))] z-0 pointer-events-none"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-transparent to-emerald-500/10 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-center lg:items-center gap-6 md:gap-8 max-w-[1400px] mx-auto">
        <div class="recommendation-cover w-[160px] h-[160px] lg:w-[200px] lg:h-[200px] rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0 overflow-hidden">
          <template v-if="coverSongs.length">
            <img
              v-for="song in coverSongs"
              :key="`cover-${song.id || song.song_id}`"
              :src="getItemCover(song)"
              alt=""
              class="w-full h-full object-cover"
            />
          </template>
          <div v-else class="recommendation-cover-fallback w-full h-full flex items-center justify-center bg-[linear-gradient(135deg,#14b8a6,#4f46e5,#db2777)]">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-20 h-20 text-white/90">
              <path d="M12 3v10.55A3.96 3.96 0 0010 13c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1 text-center lg:text-left w-full">
          <span class="hidden lg:inline-block text-xs font-bold uppercase tracking-wider text-white/70 mb-0.5 w-max">Dành cho bạn</span>
          <h1 class="text-4xl md:text-5xl lg:text-[64px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-1">
            {{ title }}
          </h1>

          <p class="text-gray-300 font-medium text-sm lg:text-base mt-1 line-clamp-2 max-w-3xl">
            {{ subtitle }}
          </p>

          <div class="flex items-center justify-center lg:justify-start gap-2 text-sm md:text-base font-semibold text-gray-300 mt-2 flex-wrap">
            <span>{{ songs.length }} bài hát</span>
            <template v-if="dominantMarket">
              <span class="w-1 h-1 bg-white/30 rounded-full mx-1"></span>
              <span>Gu nổi bật: <b class="text-white">{{ dominantMarket }}</b></span>
            </template>
            <template v-if="generatedAtLabel">
              <span class="w-1 h-1 bg-white/30 rounded-full mx-1 hidden lg:block"></span>
              <span class="hidden lg:block">Cập nhật: {{ generatedAtLabel }}</span>
            </template>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <PlaybackButton
              size="lg"
              :is-playing="isRecommendationPlaying"
              :disabled="songs.length === 0"
              @click="toggleRecommendationPlayback"
            />
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="loading"
              @click="refreshRecommendations"
            >
              <svg v-if="loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25" />
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-15.5 6.25M3 12A9 9 0 0118.5 5.75M18 3v4h-4M6 21v-4h4" />
              </svg>
              Làm mới
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="mx-4 md:mx-6 px-3 md:px-6 py-4 user-panel-soft flex-1 relative">
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-sm font-bold">Đang tải đề xuất...</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-center">
        <p class="mb-4 text-red-300 font-bold">{{ error }}</p>
        <button class="px-6 py-2 rounded-full bg-white text-black font-bold hover:scale-105 transition-transform" @click="fetchRecommendations">
          Thử lại
        </button>
      </div>

      <div v-else-if="songs.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" class="mb-4 text-gray-600">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p class="font-bold text-lg text-white mb-2">Chưa có đề xuất nào</p>
        <p class="text-sm">Nghe thêm vài bài để MusicFlow hiểu gu của bạn hơn.</p>
      </div>

      <template v-else>
        <div class="relative z-10 w-full mb-4 px-4 flex items-center gap-4 text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 mt-4 h-10">
          <div class="w-8 text-center shrink-0">#</div>
          <div class="flex-1 pr-4">Tiêu đề</div>
          <div class="flex-1 hidden md:block pr-4">Album</div>
          <div class="w-auto min-w-[80px] flex justify-end shrink-0 pr-8"></div>
        </div>

        <div class="relative z-10 flex flex-col gap-1 pb-12">
          <SongRow
            v-for="(song, idx) in songs"
            :key="song.id || song.song_id || idx"
            :song="song"
            :index="idx + 1"
            :showIndex="true"
            :showAlbum="true"
            :compact="false"
            :isPlaying="isCurrentSong(song)"
            @play="playSong"
            @open-menu="handleOpenMenu"
            @toggle-like="toggleLike"
          />
        </div>
      </template>
    </div>

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
import { recommendApi } from '@/api/recommend'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import PlaybackButton from '@/components/common/PlaybackButton.vue'
import { getItemCover } from '@/utils/imageUrl'

const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()

const loading = ref(false)
const error = ref('')
const songs = ref([])
const strategy = ref('')
const reason = ref('')
const dominantMarket = ref('')
const generatedAt = ref('')
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })

const STRATEGY_TITLES = {
  model_personalized: 'Gợi ý cá nhân hóa',
  content_based_onboarding: 'Gợi ý theo sở thích ban đầu',
  most_popular_fallback: 'Bài hát phổ biến',
  cold_start_preferences: 'Đề xuất nghe',
  behavior_based_content: 'Đề xuất nghe',
  content_based_fallback: 'Đề xuất nghe',
  bpr_mf: 'Đề xuất nghe',
  bpr_mf_rerank: 'Đề xuất nghe',
  popular_fallback: 'Đang thịnh hành trên MusicFlow',
}

const STRATEGY_SUBTITLES = {
  model_personalized: 'Dựa trên thói quen nghe nhạc của bạn',
  content_based_onboarding: 'Người dùng chưa có đủ lịch sử nghe hoặc chưa có trong serving artifact.',
  most_popular_fallback: 'Không có đủ dữ liệu cá nhân hóa hoặc sở thích ban đầu.',
  behavior_based_content: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  content_based_fallback: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  bpr_mf: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  bpr_mf_rerank: 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
  cold_start_preferences: 'Dựa trên sở thích ban đầu và xu hướng hiện tại',
  popular_fallback: 'Những bài hát được nghe nhiều gần đây',
}

const title = computed(() => STRATEGY_TITLES[strategy.value] || 'Đề xuất nghe')
const subtitle = computed(() => reason.value || STRATEGY_SUBTITLES[strategy.value] || 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay')
const coverSongs = computed(() => songs.value.slice(0, 4))
const heroBackground = computed(() => (songs.value[0] ? getItemCover(songs.value[0]) : ''))
const generatedAtLabel = computed(() => {
  if (!generatedAt.value) return ''
  const date = new Date(generatedAt.value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
})

const isRecommendationTrack = computed(() => {
  const currentId = getSongId(player.currentSong)
  if (!currentId) return false
  return songs.value.some(song => String(getSongId(song)) === String(currentId))
})

const isRecommendationPlaying = computed(() => isRecommendationTrack.value && player.isPlaying)

function getSongId(song) {
  return song?.id ?? song?.song_id ?? null
}

function isCurrentSong(song) {
  const currentId = getSongId(player.currentSong)
  const songId = getSongId(song)
  return Boolean(currentId && songId && String(currentId) === String(songId) && player.isPlaying)
}

async function fetchRecommendations(options = {}) {
  loading.value = true
  error.value = ''
  try {
    const response = await recommendApi.getHomeSongRecommendations(50, options)
    const payload = response.data || {}
    const rawItems = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.data)
        ? payload.data
        : []

    strategy.value = payload.strategy || ''
    reason.value = payload.reason || payload.strategy_reason || ''
    dominantMarket.value = payload.dominantMarket || payload.taste_profile?.dominantMarket || ''
    generatedAt.value = payload.generatedAt || ''
    songs.value = library.applyLikedStateToSongs(rawItems)
  } catch (err) {
    error.value = err.response?.data?.message || 'Không thể tải đề xuất lúc này'
  } finally {
    loading.value = false
  }
}

function refreshRecommendations() {
  fetchRecommendations({ refresh: true })
}

function playSong(song) {
  const queue = songs.value.map(item => ({
    ...item,
    artist_name: item.artist_name || item.artist,
  }))
  const target = queue.find(item => String(getSongId(item)) === String(getSongId(song))) || song
  player.playbackSource = 'for_you_recommendation'
  player.setSong(target, queue, 'for_you_recommendation')
}

function playRecommendation() {
  if (!songs.value.length) return
  playSong(songs.value[0])
}

function toggleRecommendationPlayback() {
  if (!songs.value.length) return
  if (isRecommendationTrack.value) {
    player.togglePlay()
    return
  }
  playRecommendation()
}

async function toggleLike(song) {
  if (!song) return
  await library.toggleLike(song)
}

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

onMounted(() => {
  library.fetchLikedSongs()
  fetchRecommendations()
})
</script>

<style scoped>
.recommendation-cover {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  background: #111827;
}

.recommendation-cover img:first-child:nth-last-child(1) {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

.recommendation-cover img:first-child:nth-last-child(2),
.recommendation-cover img:first-child:nth-last-child(2) ~ img {
  grid-row: 1 / -1;
}

.recommendation-cover-fallback {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

@media (max-width: 640px) {
  .recommendation-page :deep(.home-row) {
    gap: 0.75rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
</style>
