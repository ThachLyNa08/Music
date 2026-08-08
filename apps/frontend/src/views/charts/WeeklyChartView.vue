<template>
  <div class="user-page-bg pb-4">
    <!-- Hero Section Edge-to-Edge -->
    <section class="relative overflow-hidden w-full px-6 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img 
        :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.charts)"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.38] scale-[1.18] blur-[34px] saturate-[1.2] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,20,0.88),rgba(9,11,20,0.64),rgba(9,11,20,0.95))] z-0 pointer-events-none"></div>
      <!-- Tint Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-transparent to-purple-500/10 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-center lg:items-center gap-6 md:gap-8 max-w-[1400px] mx-auto">
        <!-- Foreground Cover -->
        <div class="w-[160px] h-[160px] lg:w-[200px] lg:h-[200px] rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0 overflow-hidden bg-white/10">
          <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.charts)" class="w-full h-full object-cover" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1 text-center lg:text-left w-full">
          <span class="hidden lg:inline-block text-xs font-bold uppercase tracking-wider text-white/70 mb-0.5 w-max">
            MUSICFLOW CHARTS
          </span>
          <h1 class="text-4xl md:text-5xl lg:text-[64px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-1">{{ chartTitle }}</h1>
          
          <p class="text-gray-300 font-medium text-sm lg:text-base mt-1 line-clamp-2 max-w-3xl">
            Bảng xếp hạng theo lượt nghe trong 7 ngày gần nhất.
          </p>

          <!-- Action Buttons -->
          <div class="mt-4 flex items-center justify-center lg:justify-start gap-4">
            <button
              class="flex h-14 w-14 items-center justify-center rounded-full bg-[#1ED760] text-black shadow-[0_8px_8px_rgba(0,0,0,0.3)] transition-all hover:scale-105 hover:bg-[#1FDF64] disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
              type="button"
              :disabled="songs.length === 0"
              @click="playAll"
            >
              <svg viewBox="0 0 24 24" class="h-7 w-7 ml-1 fill-current">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-[1400px] px-6">
      <div class="user-panel overflow-hidden" style="padding: 0 !important;">
        <div v-if="loading" class="space-y-2 p-3">
          <div v-for="item in 10" :key="item" class="h-16 animate-pulse rounded-xl bg-white/[0.06]"></div>
        </div>

        <div v-else-if="songs.length === 0" class="py-16 text-center text-sm font-semibold text-slate-400">
          Chưa có dữ liệu bảng xếp hạng.
        </div>

        <template v-else>
          <WeeklyChartRow
            v-for="song in songs"
            :key="song.id"
            :song="song"
            :rank="song.rank"
            @play="playSong(song)"
            @open-menu="handleOpenMenu"
          />
        </template>
      </div>
    </div>

    <SongActionMenu
      :show="menuState.show"
      :position="menuState.position"
      :song="menuState.song"
      :is-liked="library?.isLiked(menuState.song)"
      @close="menuState.show = false"
      @toggle-like="toggleLike"
      @add-to-playlist="song => library.openPlaylistModal(song)"
      @add-to-queue="song => player.addToQueue(song)"
      @go-to-song="song => $router.push(`/song/${song.id || song.song_id}`)"
      @go-to-artist="song => song.artist_id && $router.push(`/artist/${song.artist_id}`)"
      @go-to-album="song => song.album_id && $router.push(`/album/${song.album_id}`)"
      @share="handleShare"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { chartApi } from '@/api/chart'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import WeeklyChartRow from '@/components/home/WeeklyChartRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import { DEFAULT_SPECIAL_COVERS, normalizeAssetUrl } from '@/utils/imageUrl'

const route = useRoute()
const player = usePlayerStore()
const library = useLibraryStore()
const loading = ref(true)
const songs = ref([])
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })

const region = computed(() => String(route.params.region || 'vn').toUpperCase())
const apiRegion = computed(() => {
  if (region.value === 'ALL' || region.value === 'GLOBAL') return 'ALL'
  if (region.value === 'KPOP' || region.value === 'K-POP') return 'KPOP'
  if (region.value === 'USUK' || region.value === 'US-UK') return 'USUK'
  return 'VN'
})
const chartTitle = computed(() => {
  if (apiRegion.value === 'ALL') return 'Xu hướng MusicFlow'
  if (apiRegion.value === 'KPOP') return 'Bảng Xếp Hạng K-Pop'
  if (apiRegion.value === 'USUK') return 'Bảng Xếp Hạng US-UK'
  return 'Bảng Xếp Hạng Việt Nam'
})

onMounted(loadChart)
watch(apiRegion, loadChart)

async function loadChart() {
  loading.value = true
  try {
    const res = await chartApi.getWeekly({ region: apiRegion.value, limit: 30 })
    songs.value = res.data?.success ? library.applyLikedStateToSongs(normalizeSongs(res.data.data || [])) : []
  } catch (error) {
    console.warn('Không thể tải bảng xếp hạng:', error)
    songs.value = []
  } finally {
    loading.value = false
  }
}

function normalizeSongs(items) {
  return items.map(song => ({
    ...song,
    artist_name: song.artist_name || song.artist,
    duration_sec: song.duration_sec || song.duration || 0
  }))
}

function playSong(song) {
  player.playbackSource = 'chart'
  player.setSong(song, songs.value)
}

function playAll() {
  if (!songs.value.length) return
  player.playbackSource = 'chart'
  player.setSong(songs.value[0], songs.value)
}

function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}

async function toggleLike(song) {
  if (!song) return
  await library.toggleLike(song)
}

function handleShare(song) {
  navigator.clipboard.writeText(`${window.location.origin}/song/${song.id || song.song_id}`)
}
</script>

<style scoped>
</style>
