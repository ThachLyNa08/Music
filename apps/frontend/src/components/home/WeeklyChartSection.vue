<template>
  <section class="weekly-chart-section">
    <SectionHeader
      title="Bảng Xếp Hạng Tuần"
      subtitle="Top bài hát theo lượt nghe thật trong 7 ngày gần nhất"
      :show-view-all="false"
    />

    <div v-if="isError && !isLoading" class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm font-semibold text-slate-400">
      Khong the tai bang xep hang tuan. Vui long thu lai.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
      <WeeklyChartCard
        v-for="chart in visibleCharts"
        :key="chart.region"
        :title="chart.title"
        :region="chart.region"
        :songs="chart.songs"
        :loading="isLoading"
        @play-song="playSong"
        @play-list="playList"
        @view-all="viewAll"
        @open-menu="$emit('open-menu', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { chartApi } from '@/api/chart'
import { usePlayerStore } from '@/stores/player'
import SectionHeader from './SectionHeader.vue'
import WeeklyChartCard from './WeeklyChartCard.vue'

const emit = defineEmits(['open-menu'])
const props = defineProps({
  chartsData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  loaded: {
    type: Boolean,
    default: false
  },
  error: {
    type: [Object, String],
    default: null
  }
})

const router = useRouter()
const player = usePlayerStore()
const internalLoading = ref(true)
const internalLoaded = ref(false)
const internalError = ref(null)
const internalCharts = ref({
  vn: [],
  usuk: [],
  kpop: []
})

const chartMeta = [
  { title: 'Việt Nam', region: 'VN', key: 'vn' },
  { title: 'US-UK', region: 'USUK', key: 'usuk' },
  { title: 'K-Pop', region: 'KPOP', key: 'kpop' }
]

const visibleCharts = computed(() => {
  const sourceCharts = props.chartsData || internalCharts.value
  return chartMeta
    .map(item => ({ ...item, songs: sourceCharts[item.key] || [] }))
})

const isControlled = computed(() => props.chartsData !== null)
const isError = computed(() => isControlled.value ? props.error : internalError.value)
const isLoading = computed(() => {
  if (!isControlled.value) return internalLoading.value
  return props.loading || (!props.loaded && !props.error)
})

onMounted(() => {
  if (!props.chartsData) loadWeeklyCharts()
})

async function loadWeeklyCharts() {
  internalLoading.value = true
  internalError.value = null
  try {
    const res = await chartApi.getWeekly({ limit: 10 }, { timeout: 20000 })
    if (res.data?.success) {
      internalCharts.value = {
        vn: normalizeSongs(res.data.data?.vn || []),
        usuk: normalizeSongs(res.data.data?.usuk || []),
        kpop: normalizeSongs(res.data.data?.kpop || [])
      }
      internalLoaded.value = true
    }
  } catch (error) {
    internalError.value = error
    console.warn('Không thể tải bảng xếp hạng tuần:', error)
  } finally {
    internalLoading.value = false
  }
}

function normalizeSongs(songs) {
  return songs.map(song => ({
    ...song,
    artist_name: song.artist_name || song.artist,
    duration_sec: song.duration_sec || song.duration || 0
  }))
}

function playSong(song, queue) {
  const normalizedQueue = normalizeSongs(queue || [])
  const target = normalizedQueue.find(item => String(item.id) === String(song.id)) || song
  player.playbackSource = 'chart'
  player.setSong(target, normalizedQueue)
}

function playList(songs) {
  const queue = normalizeSongs(songs || [])
  if (!queue.length) return
  player.playbackSource = 'chart'
  player.setSong(queue[0], queue)
}

function viewAll(region) {
  router.push(`/charts/${String(region).toLowerCase()}`)
}
</script>
