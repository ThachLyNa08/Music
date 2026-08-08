<template>
  <section class="artist-page">
    <div v-if="loading" class="artist-panel">Đang tải hồ sơ nghệ sĩ...</div>
    <div v-else-if="errorMsg" class="artist-panel error">{{ errorMsg }}</div>

    <div v-else class="artist-page-content">
      <!-- Hero Section -->
      <div class="artist-hero compact">
        <div class="hero-bg" :style="{ backgroundImage: `url(${artist.coverUrl || artist.cover_url || fallbackCover})` }"></div>
        <div class="hero-content">
          <img :src="artist.avatarUrl || artist.avatar_url || fallbackAvatar" @error="onImageError" class="artist-avatar compact" alt="">
          <div class="hero-info">
            <p class="eyebrow">Tổng quan</p>
            <h1 class="compact-title">Xin chào, {{ artist?.name || 'nghệ sĩ' }}</h1>
            <div class="meta-row">
              <span class="email" v-if="artist.email">{{ artist.email }}</span>
              <span class="email" v-if="artist.genreName">• {{ artist.genreName }}</span>
              <span class="status" :class="accountStatus">{{ statusLabel }}</span>
            </div>
          </div>
        </div>
      </div>



      <div class="artist-cards-grid mt-4">
        <!-- KPI Cards -->
        <div class="dashboard-section">
          <h2 class="section-title">Thống kê nhanh</h2>
          <div class="stats-grid">
            <div class="artist-stat-card" @mouseenter="handleSparklineEnter" @mouseleave="handleSparklineLeave">
              <div class="artist-stat-label">BÀI HÁT</div>
              <div class="artist-stat-value">{{ formatNumber(summary.totalSongs) }}</div>
              <div class="stat-sparkline">
                <div class="spark-bar" style="height:40%"></div>
                <div class="spark-bar" style="height:60%"></div>
                <div class="spark-bar" style="height:45%"></div>
                <div class="spark-bar" style="height:80%"></div>
                <div class="spark-bar" style="height:65%"></div>
                <div class="spark-bar" style="height:90%"></div>
                <div class="spark-bar" style="height:100%"></div>
              </div>
            </div>
            <div class="artist-stat-card" @mouseenter="handleSparklineEnter" @mouseleave="handleSparklineLeave">
              <div class="artist-stat-label">ALBUM</div>
              <div class="artist-stat-value">{{ formatNumber(summary.totalAlbums) }}</div>
              <div class="stat-sparkline">
                <div class="spark-bar" style="height:30%"></div>
                <div class="spark-bar" style="height:30%"></div>
                <div class="spark-bar" style="height:50%"></div>
                <div class="spark-bar" style="height:50%"></div>
                <div class="spark-bar" style="height:70%"></div>
                <div class="spark-bar" style="height:70%"></div>
                <div class="spark-bar" style="height:100%"></div>
              </div>
            </div>
            <div class="artist-stat-card" @mouseenter="handleSparklineEnter" @mouseleave="handleSparklineLeave">
              <div class="artist-stat-label">TỔNG LƯỢT NGHE</div>
              <div class="artist-stat-value">{{ formatNumber(summary.totalPlays) }}</div>
              <div class="stat-sparkline">
                <div class="spark-bar" style="height:20%"></div>
                <div class="spark-bar" style="height:35%"></div>
                <div class="spark-bar" style="height:30%"></div>
                <div class="spark-bar" style="height:55%"></div>
                <div class="spark-bar" style="height:70%"></div>
                <div class="spark-bar" style="height:85%"></div>
                <div class="spark-bar" style="height:100%"></div>
              </div>
            </div>
            <div class="artist-stat-card" @mouseenter="handleSparklineEnter" @mouseleave="handleSparklineLeave">
              <div class="artist-stat-label">LƯỢT THÍCH</div>
              <div class="artist-stat-value">{{ formatNumber(summary.totalLikes) }}</div>
              <div class="stat-sparkline">
                <div class="spark-bar" style="height:25%"></div>
                <div class="spark-bar" style="height:40%"></div>
                <div class="spark-bar" style="height:35%"></div>
                <div class="spark-bar" style="height:60%"></div>
                <div class="spark-bar" style="height:75%"></div>
                <div class="spark-bar" style="height:90%"></div>
                <div class="spark-bar" style="height:100%"></div>
              </div>
            </div>
            <div class="artist-stat-card" @mouseenter="handleSparklineEnter" @mouseleave="handleSparklineLeave">
              <div class="artist-stat-label">NGƯỜI THEO DÕI</div>
              <div class="artist-stat-value">{{ formatNumber(summary.totalFollowers) }}</div>
              <div class="stat-sparkline">
                <div class="spark-bar" style="height:10%"></div>
                <div class="spark-bar" style="height:10%"></div>
                <div class="spark-bar" style="height:10%"></div>
                <div class="spark-bar" style="height:10%"></div>
                <div class="spark-bar" style="height:10%"></div>
                <div class="spark-bar" style="height:10%"></div>
                <div class="spark-bar" style="height:10%"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="dashboard-section mb-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="section-title mb-0" style="margin-bottom: 0;">Lượt nghe theo thời gian</h3>
            <select v-model="trendRange" @change="updateChartRange" :disabled="isUpdatingChart" class="px-3 py-1.5 bg-gray-50 dark:bg-[#16162a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer">
              <option value="today" class="bg-white dark:bg-[#16162a] text-gray-900 dark:text-gray-200">Hôm nay</option>
              <option value="7d" class="bg-white dark:bg-[#16162a] text-gray-900 dark:text-gray-200">7 ngày qua</option>
              <option value="30d" class="bg-white dark:bg-[#16162a] text-gray-900 dark:text-gray-200">30 ngày qua</option>
              <option value="90d" class="bg-white dark:bg-[#16162a] text-gray-900 dark:text-gray-200">90 ngày qua</option>
            </select>
          </div>
          <div class="bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border rounded-xl p-4 shadow-sm relative mb-4">
            <div class="h-72 relative" :class="{ 'opacity-40 transition-opacity': isUpdatingChart }">
              <LineChart v-if="listenTrend.length" :data="listenTrendData" :options="chartOptions" />
              <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">Không có dữ liệu lượt nghe</div>
            </div>

            <div v-if="isUpdatingChart" class="absolute inset-0 flex items-center justify-center">
              <div class="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          </div>

          <div class="flex items-center justify-between mb-4">
            <h3 class="section-title mb-0" style="margin-bottom: 0;">Lượt nghe theo giờ trong tuần</h3>
            <div class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Ít</span>
              <div class="flex items-center gap-0.5">
                <div class="w-4 h-4 rounded-sm" style="background:rgba(0,212,170,0.1)"></div>
                <div class="w-4 h-4 rounded-sm" style="background:rgba(0,212,170,0.25)"></div>
                <div class="w-4 h-4 rounded-sm" style="background:rgba(0,212,170,0.45)"></div>
                <div class="w-4 h-4 rounded-sm" style="background:rgba(0,212,170,0.7)"></div>
                <div class="w-4 h-4 rounded-sm" style="background:rgba(0,212,170,1)"></div>
              </div>
              <span>Nhiều</span>
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border rounded-xl p-4 shadow-sm overflow-x-auto">
            <div class="min-w-[400px] h-72 grid gap-px mt-1" style="grid-template-columns: 24px repeat(24, 1fr); grid-template-rows: 20px repeat(7, 1fr);">
              <!-- Headers -->
              <div class="flex items-center justify-end pr-1 text-[8px] text-gray-500"></div>
              <div v-for="hour in hours" :key="'h'+hour" class="flex items-center justify-center text-[8px] text-gray-500">{{ hour }}h</div>

              <!-- Grid Rows -->
              <template v-for="row in heatmapRows" :key="row.day">
                <div class="flex items-center justify-end pr-1 text-[8px] text-gray-500 font-medium">{{ row.day }}</div>
                <div v-for="cell in row.cells" :key="row.day+'-'+cell.hour"
                     class="h-full w-full rounded-[2px] cursor-pointer hover:scale-110 hover:z-10 hover:shadow-lg transition-transform relative group"
                     :style="{ backgroundColor: `rgba(0, 212, 170, ${cell.intensity})` }">
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                    {{ cell.value }} lượt nghe
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-4 mb-4">
          <div class="dashboard-section mb-0 flex flex-col">
            <h2 class="section-title">Top bài hát</h2>
            <div class="bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border rounded-xl p-3 flex-1 flex flex-col">
              <div v-if="topSongs.length" class="flex flex-col gap-2 flex-1">
                <div v-for="(song, index) in topSongs" :key="song.id" class="flex items-center gap-3 p-1.5 hover:bg-white dark:hover:bg-bg-base rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-bg-border transition-colors">
                  <div class="font-mono text-gray-400 text-[11px] w-4 text-right">{{ index + 1 }}</div>
                  <img :src="song.coverUrl || fallbackAvatar" class="w-8 h-8 rounded shadow-sm object-cover bg-gray-200" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ song.title }}</div>
                    <div v-if="song.album" class="text-[11px] text-gray-500 truncate mt-0.5">{{ song.album }}</div>
                  </div>
                  <div class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ formatNumber(song.playCount) }} lượt</div>
                </div>
              </div>
              <div v-else class="text-center flex-1 flex flex-col items-center justify-center text-gray-400 text-sm">
                Chưa có bài hát nào được duyệt.
              </div>
            </div>
          </div>

          <div class="dashboard-section mb-0 flex flex-col">
            <h2 class="section-title">Trạng thái nội dung gần đây</h2>
            <div class="bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border rounded-xl p-3 flex-1">
              <div v-if="recentContent.length" class="flex flex-col gap-2">
                <div v-for="item in recentContent" :key="item.type + item.id" class="flex items-center gap-3 p-2 bg-white dark:bg-bg-base rounded-lg border border-gray-100 dark:border-bg-border shadow-sm relative overflow-hidden group">
                  <div class="relative shrink-0">
                    <img :src="item.coverUrl || fallbackAvatar" class="w-8 h-8 rounded shadow-sm object-cover bg-gray-200" />
                    <div class="absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-gray-800 rounded-full w-4 h-4 flex items-center justify-center shadow" :title="item.type === 'album' ? 'Album' : 'Bài hát'">
                      {{ item.type === 'album' ? '💿' : '🎵' }}
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.title }}</div>
                    <div class="text-[11px] text-gray-500 mt-0.5">{{ formatDate(item.createdAt) }}</div>
                    <div v-if="item.reviewStatus === 'rejected' && item.rejectionReason" class="text-[11px] text-rose-500 mt-1 italic">
                      Lý do từ chối: {{ item.rejectionReason }}
                    </div>
                  </div>
                  <div class="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase" :class="getStatusClass(item.reviewStatus)">
                    {{ formatStatus(item.reviewStatus) }}
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-6 text-gray-400 h-full flex flex-col items-center justify-center text-sm">Chưa có hoạt động nào gần đây.</div>
            </div>
          </div>
        </div>
      </div>


    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { artistAccountApi } from '@/api/artistAccount'
import { artistStudioApi } from '@/api/artistStudio'

// --- CHARTJS IMPORTS ---
import { Line as LineChart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
)

import MfIcon from '@/components/common/MfIcon.vue'
const fallbackAvatar = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80'
const fallbackCover = 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f401?w=800&q=80'
const loading = ref(true)
const errorMsg = ref('')
const user = ref({})
const artist = ref({})
const accountStatus = ref('active')

const summary = ref({
  totalPlays: 0,
  totalSongs: 0,
  totalAlbums: 0,
  pendingSongs: 0,
  pendingAlbums: 0,
  totalLikes: 0,
  newLikesThisWeek: 0,
  totalFollowers: 0
})
const topSongs = ref([])
const recentContent = ref([])
const listenTrend = ref([])
const trendRange = ref('7d')

const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const hours = Array.from({length: 24}, (_, i) => i);
const rawHeatmapData = ref([]);

const getDbDayOfWeek = (dayStr) => {
  const map = { 'T2': 2, 'T3': 3, 'T4': 4, 'T5': 5, 'T6': 6, 'T7': 7, 'CN': 1 };
  return map[dayStr];
}

const heatmapRows = computed(() => {
  const maxListens = Math.max(1, ...rawHeatmapData.value.map(d => d.listens));

  return days.map(day => {
    const dbDay = getDbDayOfWeek(day);
    return {
      day,
      cells: hours.map(hour => {
        const record = rawHeatmapData.value.find(d => d.dayOfWeek === dbDay && d.hourOfDay === hour);
        const value = record ? Number(record.listens) : 0;
        const intensity = value / maxListens;

        return { hour, intensity, value }
      })
    }
  })
})

const sessionStats = ref({ newPlays: 0, newLikes: 0 })

const listenTrendData = computed(() => {
  return {
    labels: listenTrend.value.map(t => t.label),
    datasets: [
      {
        label: 'Lượt nghe',
        data: listenTrend.value.map(t => t.listens),
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#10b981',
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#fff',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 10,
      displayColors: false
    }
  },
  scales: {
    x: {
      grid: { display: false, drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11 }, precision: 0 }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}

watch(() => summary.value, (newVal) => {
  if (newVal.totalPlays === 0 && newVal.totalLikes === 0) return; // Ignore initial empty state

  const stored = localStorage.getItem('artist_stats_baseline_' + artist.value?.id);
  if (!stored) {
    localStorage.setItem('artist_stats_baseline_' + artist.value?.id, JSON.stringify({
      totalPlays: newVal.totalPlays,
      totalLikes: newVal.totalLikes,
      timestamp: Date.now()
    }));
  } else {
    try {
      const baseline = JSON.parse(stored);
      // Reset baseline if it's older than 7 days
      if (Date.now() - baseline.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.setItem('artist_stats_baseline_' + artist.value?.id, JSON.stringify({
          totalPlays: newVal.totalPlays,
          totalLikes: newVal.totalLikes,
          timestamp: Date.now()
        }));
      } else {
        sessionStats.value.newPlays = Math.max(0, newVal.totalPlays - baseline.totalPlays);
        // Use backend newLikesThisWeek if available and greater than 0, else fallback to local difference
        sessionStats.value.newLikes = newVal.newLikesThisWeek > 0
          ? newVal.newLikesThisWeek
          : Math.max(0, newVal.totalLikes - baseline.totalLikes);
      }
    } catch (e) {
      console.error('Failed to parse baseline stats', e);
    }
  }
}, { deep: true });

const statusLabel = computed(() => {
  if (accountStatus.value === 'locked') return 'Đã khóa'
  if (accountStatus.value === 'temp_password') return 'Mật khẩu tạm thời'
  return 'Đang hoạt động'
})

function onImageError(event) {
  event.target.src = fallbackAvatar
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function formatDate(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getStatusClass(status) {
  return {
    pending_review: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
  }[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

function formatStatus(status) {
  return {
    pending_review: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối'
  }[status] || status
}

// Chart Tooltip
const tooltip = ref({ show: false, x: 0, y: 0, value: '' })

const chartDates = computed(() => {
  const dates = []
  const today = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    dates.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }))
  }
  return dates
})

const chartValues = computed(() => {
  // Generate realistic-looking trend based on total plays
  const total = Number(summary.value.totalPlays || 1000)
  // Base daily is total / 30 roughly, but we just want the curve to look like the static one:
  // Points: 12.5%, 25%, 18.75%, 50%, 62.5%, 75%, 87.5%, 100% of something.
  // Let's just scale a base number so the max is roughly total / 10
  const maxDay = Math.max(10, Math.floor(total / 10))
  return [
    Math.floor(maxDay * 0.125),
    Math.floor(maxDay * 0.250),
    Math.floor(maxDay * 0.187),
    Math.floor(maxDay * 0.500),
    Math.floor(maxDay * 0.625),
    Math.floor(maxDay * 0.750),
    Math.floor(maxDay * 0.875),
    maxDay
  ]
})

const showTooltip = (event, index) => {
  tooltip.value = {
    show: true,
    x: event.clientX,
    y: event.clientY - 15,
    value: formatNumber(chartValues.value[index])
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

// Sparkline Animation Handlers
const handleSparklineEnter = (event) => {
  const bars = event.currentTarget.querySelectorAll('.spark-bar')
  bars.forEach((bar, i) => {
    if (!bar.dataset.height) {
      bar.dataset.height = bar.style.height
    }
    setTimeout(() => {
      bar.style.height = '100%'
    }, i * 50)
  })
}

const handleSparklineLeave = (event) => {
  const bars = event.currentTarget.querySelectorAll('.spark-bar')
  bars.forEach((bar, i) => {
    setTimeout(() => {
      bar.style.height = bar.dataset.height
    }, i * 50)
  })
}

const isUpdatingChart = ref(false)

const updateChartRange = async () => {
  isUpdatingChart.value = true
  try {
    const resDash = await artistStudioApi.getDashboard({ range: trendRange.value })
    if (resDash.data?.success) {
      const data = resDash.data.data
      listenTrend.value = data.listenTrend || []
      rawHeatmapData.value = data.heatmapData || []
    }
  } catch (err) {
    console.error('Lỗi khi tải thông tin biểu đồ:', err)
  } finally {
    isUpdatingChart.value = false
  }
}

const loadMe = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const resMe = await artistAccountApi.getArtistMe()
    if (resMe.data?.success) {
      accountStatus.value = resMe.data.data.status
    }

    // Also fetch dashboard data
    const resDash = await artistStudioApi.getDashboard({ range: trendRange.value })
    if (resDash.data?.success) {
      const data = resDash.data.data
      artist.value = data.artist
      summary.value = data.summary
      topSongs.value = data.topSongs
      recentContent.value = data.recentContent
      listenTrend.value = data.listenTrend || []
      rawHeatmapData.value = data.heatmapData || []
    }
  } catch (err) {
    console.error('Lỗi khi tải thông tin Dashboard:', err)
    errorMsg.value = err.response?.data?.message || 'Không thể tải thông tin lúc này. Vui lòng thử lại sau.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMe)
</script>

<style scoped>
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(30px);
  opacity: 0.36;
  pointer-events: none;
  transform: scale(1.15);
  z-index: 0;
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 2;
}

.artist-avatar {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  background: #1e293b;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #b3b3b3;
}

h1 {
  margin: 0;
  font-size: 48px;
  font-weight: 900;
  color: #ffffff;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.email {
  color: #b3b3b3;
  font-size: 14px;
}

.status {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 12px;
  background: rgba(22, 163, 74, 0.2);
  color: #4ade80;
  font-weight: 700;
  font-size: 12px;
  border: 1px solid rgba(74, 222, 128, 0.2);
}
.status.locked {
  background: rgba(220, 38, 38, 0.2);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.2);
}
.status.temp_password {
  background: rgba(217, 119, 6, 0.2);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.2);
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.artist-avatar.compact {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  box-shadow: var(--shadow);
  z-index: 1;
  position: relative;
  object-fit: cover;
}

.compact-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  background: linear-gradient(90deg, #fff, #c0c0d0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.artist-card-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #ffffff;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.artist-tool-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.artist-tool-card:hover:not(.disabled) {
  background: var(--bg-card-hover);
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.artist-tool-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tool-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}

.tool-arrow {
  color: var(--text-muted);
  font-size: 18px;
  transition: transform 0.2s;
}

.artist-tool-card:hover:not(.disabled) .tool-arrow {
  transform: translateX(4px);
  color: var(--text-primary);
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.tool-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.badge-sm {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
