<template>
  <div class="user-page-bg px-6 py-8 pb-4">
    <div class="mx-auto max-w-5xl">
      <button
        class="mb-6 rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-white hover:text-white"
        type="button"
        @click="$router.back()"
      >
        Quay lại
      </button>

      <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex flex-col sm:flex-row sm:items-end gap-6">
          <div class="w-32 h-32 shrink-0 shadow-2xl rounded-xl overflow-hidden hidden sm:block">
            <img :src="normalizeAssetUrl(DEFAULT_SPECIAL_COVERS.charts)" alt="Charts" class="w-full h-full object-cover" />
          </div>
          <div>
            <p class="text-sm font-black uppercase text-violet-300">MusicFlow Charts</p>
            <h1 class="mt-1 text-3xl font-black">{{ chartTitle }}</h1>
            <p class="mt-2 text-sm font-semibold text-slate-400">Bảng xếp hạng theo lượt nghe trong 7 ngày gần nhất.</p>
          </div>
        </div>

        <button
          class="flex h-11 items-center justify-center gap-2 rounded-full bg-violet-500 px-5 font-black text-white transition hover:bg-violet-400 disabled:opacity-50"
          type="button"
          :disabled="songs.length === 0"
          @click="playAll"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current">
            <polygon points="7 4 19 12 7 20 7 4" />
          </svg>
          Phát tất cả
        </button>
      </header>

      <div class="user-panel overflow-hidden p-3">
        <div v-if="loading" class="space-y-2">
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
  if (region.value === 'KPOP' || region.value === 'K-POP') return 'KPOP'
  if (region.value === 'USUK' || region.value === 'US-UK') return 'USUK'
  return 'VN'
})
const chartTitle = computed(() => {
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
    songs.value = res.data?.success ? normalizeSongs(res.data.data || []) : []
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
