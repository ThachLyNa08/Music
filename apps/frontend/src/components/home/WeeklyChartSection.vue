<template>
  <section class="weekly-chart-section">
    <SectionHeader
      title="Bảng Xếp Hạng Tuần"
      subtitle="Top bài hát theo lượt nghe thật trong 7 ngày gần nhất"
      :show-view-all="false"
    />

    <div class="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
      <WeeklyChartCard
        v-for="chart in visibleCharts"
        :key="chart.region"
        :title="chart.title"
        :region="chart.region"
        :songs="chart.songs"
        :loading="loading"
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

const router = useRouter()
const player = usePlayerStore()
const loading = ref(true)
const charts = ref({
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
  return chartMeta
    .map(item => ({ ...item, songs: charts.value[item.key] || [] }))
})

onMounted(loadWeeklyCharts)

async function loadWeeklyCharts() {
  loading.value = true
  try {
    const res = await chartApi.getWeekly({ limit: 5 })
    if (res.data?.success) {
      charts.value = {
        vn: normalizeSongs(res.data.data?.vn || []),
        usuk: normalizeSongs(res.data.data?.usuk || []),
        kpop: normalizeSongs(res.data.data?.kpop || [])
      }
    }
  } catch (error) {
    console.warn('Không thể tải bảng xếp hạng tuần:', error)
  } finally {
    loading.value = false
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
