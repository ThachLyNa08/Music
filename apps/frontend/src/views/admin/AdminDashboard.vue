<template>
  <section class="admin-dashboard">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">MusicFlow Admin</p>
        <h1 class="page-title">Thống kê tổng quan</h1>
        <p class="page-subtitle">Theo dõi nội dung, người dùng và doanh thu Premium từ dữ liệu thật của hệ thống.</p>
      </div>

      <button class="refresh-button" type="button" :disabled="loading" @click="fetchData">
        <svg :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 4a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
        </svg>
        Làm mới
      </button>
    </header>

    <div v-if="error" class="alert-card">
      <div class="alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <div>
        <strong>Không thể tải dashboard</strong>
        <p>{{ error }}</p>
      </div>
      <button type="button" @click="fetchData">Thử lại</button>
    </div>

    <div class="stats-grid" aria-label="Chỉ số chính">
      <div v-for="card in statCards" :key="card.key" class="stat-card">
        <template v-if="loading">
          <div class="skeleton icon-skeleton"></div>
          <div class="stat-body">
            <div class="skeleton line short"></div>
            <div class="skeleton line value"></div>
            <div class="skeleton line medium"></div>
          </div>
        </template>

        <template v-else>
          <div class="stat-icon" :class="card.tone" v-html="card.icon"></div>
          <div class="stat-body">
            <span class="stat-label">{{ card.label }}</span>
            <strong class="stat-value">{{ card.value }}</strong>
            <span class="stat-note">{{ card.note }}</span>
          </div>
        </template>
      </div>
    </div>

    <div v-if="auxiliaryWarning && !loading" class="inline-warning">
      {{ auxiliaryWarning }}
    </div>

    <article class="panel trend-panel">
      <div class="panel-header trend-header">
        <div>
          <h2>Xu hướng nghe nhạc</h2>
          <p>Top bài hát và lượt nghe theo thời gian từ lịch sử phát nhạc.</p>
        </div>

        <div class="range-tabs" aria-label="Khoảng thời gian">
          <button
            v-for="option in trendRangeOptions"
            :key="option.value"
            type="button"
            :class="{ active: trendRange === option.value }"
            :disabled="trendLoading"
            @click="setTrendRange(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="trend-compact-grid">
        <aside class="top-three-panel">
          <div class="ranking-title compact">
            <h3>Top 3 thịnh hành</h3>
            <span>{{ trendRangeLabel }}</span>
          </div>

          <div v-if="trendLoading" class="top-three-skeleton">
            <div v-for="row in 3" :key="row" class="top-three-skeleton-row">
              <span></span><span></span>
            </div>
          </div>

          <div v-else-if="topTrendSongs.length === 0" class="empty-state compact-trend-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 18V5l10-2v13M9 18a3 3 0 1 1-2-2.83M19 16a3 3 0 1 1-2-2.83" />
            </svg>
            <p>Chưa có bài hát thịnh hành.</p>
          </div>

          <div v-else class="top-three-list">
            <div v-for="(song, index) in topThreeSongs" :key="song.id" class="top-three-row">
              <span class="rank-number" :class="{ podium: index < 3 }">#{{ index + 1 }}</span>
              <img :src="songCover(song)" :alt="song.title" />
              <div class="song-meta">
                <strong>{{ song.title }}</strong>
                <span>{{ song.artist || 'Nghệ sĩ chưa cập nhật' }}</span>
              </div>
              <div class="listen-count">
                <strong>{{ formatNumber(song.listens) }}</strong>
                <span>lượt nghe</span>
              </div>
              <span class="trend-badge" :class="trendClass(song)">
                {{ trendLabel(song) }}
              </span>
            </div>
          </div>
        </aside>

        <div class="trend-chart-card compact">
          <div v-if="trendLoading" class="line-skeleton compact">
            <span></span>
          </div>
          <div v-else-if="!hasTrendData" class="empty-state trend-empty compact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M7 15l4-4 3 3 5-7" />
            </svg>
            <p>Chưa có dữ liệu lượt nghe trong khoảng thời gian này.</p>
          </div>
          <div v-else class="chart-container line-chart compact">
            <Line :data="trendChartData" :options="lineOptions" />
          </div>
        </div>
      </div>
    </article>

    <div class="dashboard-grid">
      <article class="panel panel-wide">
        <div class="panel-header">
          <div>
            <h2>Doanh thu Premium theo tháng</h2>
            <p>6 tháng gần nhất từ giao dịch đã thanh toán.</p>
          </div>
        </div>

        <div v-if="loading" class="chart-skeleton">
          <span v-for="item in 6" :key="item" :style="{ height: `${38 + item * 8}%` }"></span>
        </div>
        <div v-else-if="!hasRevenueData" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3" />
          </svg>
          <p>Chưa có dữ liệu thống kê trong khoảng thời gian này.</p>
        </div>
        <div v-else class="chart-container">
          <Bar :data="revenueChartData" :options="barOptions" />
        </div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Thể loại nổi bật</h2>
            <p>Top thể loại theo lượt nghe.</p>
          </div>
        </div>

        <div v-if="loading" class="donut-skeleton"></div>
        <div v-else-if="!hasGenreData" class="empty-state compact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 3a9 9 0 1 0 9 9h-9V3Zm4-1v6h6a9 9 0 0 0-6-6Z" />
          </svg>
          <p>Chưa có dữ liệu lượt nghe theo thể loại.</p>
        </div>
        <div v-else class="chart-container donut">
          <Doughnut :data="genresChartData" :options="doughnutOptions" />
        </div>
      </article>
    </div>

    <div class="bottom-grid">
      <article class="panel table-panel">
        <div class="panel-header">
          <div>
            <h2>Giao dịch Premium gần đây</h2>
            <p>Các giao dịch mới nhất từ lịch sử thanh toán.</p>
          </div>
          <RouterLink class="view-link" to="/admin/transactions">Xem thêm</RouterLink>
        </div>

        <div v-if="loading" class="table-skeleton">
          <div v-for="row in 5" :key="row" class="table-skeleton-row">
            <span></span><span></span><span></span><span></span>
          </div>
        </div>

        <div v-else-if="recentTransactions.length === 0" class="empty-state table-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16v10H4zM7 11h4m6 0h.01M7 15h2" />
          </svg>
          <p>Chưa có giao dịch Premium gần đây.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Gói Premium</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in recentTransactions" :key="transaction.id">
                <td>
                  <div class="user-cell">
                    <strong>{{ transaction.user_name || 'Người dùng' }}</strong>
                    <span>{{ maskEmail(transaction.user_email) }}</span>
                  </div>
                </td>
                <td>{{ transaction.plan_name || 'Premium' }}</td>
                <td>{{ formatCurrency(transaction.amount) }}</td>
                <td>
                  <span class="status-badge" :class="statusClass(transaction.status)">
                    {{ formatStatus(transaction.status) }}
                  </span>
                </td>
                <td>{{ formatDateTime(transaction.paid_at || transaction.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <aside class="panel insights-panel">
        <div class="panel-header">
          <div>
            <h2>Quick insights</h2>
            <p>Tóm tắt vận hành hiện tại.</p>
          </div>
        </div>

        <div v-if="loading" class="insights-list">
          <div v-for="item in 4" :key="item" class="insight-row">
            <div class="skeleton dot"></div>
            <div class="skeleton line full"></div>
          </div>
        </div>

        <div v-else class="insights-list">
          <div class="insight-row">
            <span class="insight-dot positive"></span>
            <span>{{ formatNumber(stats.totalPremium || 0) }} người dùng Premium đang hoạt động.</span>
          </div>
          <div class="insight-row">
            <span class="insight-dot primary"></span>
            <span>{{ premiumRate }}% người dùng đang dùng Premium.</span>
          </div>
          <div class="insight-row">
            <span class="insight-dot success"></span>
            <span>{{ formatNumber(totalListens) }} lượt nghe đã ghi nhận.</span>
          </div>
          <div class="insight-row">
            <span class="insight-dot warning"></span>
            <span>{{ formatNumber(recentTransactions.length) }} giao dịch hiển thị trong bảng gần đây.</span>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/api/axios'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  LineElement,
  PointElement,
  Filler
} from 'chart.js'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { normalizeImageUrl } from '@/utils/imageUrl'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement, LineElement, PointElement, Filler)

const loading = ref(true)
const error = ref(null)
const auxiliaryWarning = ref('')
const stats = ref({})
const rawCharts = ref({ revenue: [], genres: [] })
const latestUsers = ref([])
const songGroups = ref([])
const transactions = ref([])
const trendLoading = ref(true)
const trendRange = ref('today')
const listeningTrend = ref({ series: [], topSongs: [] })

const trendRangeOptions = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' }
]

const iconUsers = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11a4 4 0 1 0-8 0m8 0a4 4 0 0 1-8 0m8 0c2.2.7 4 2.2 4 4.5V19H4v-3.5C4 13.2 5.8 11.7 8 11"/></svg>'
const iconSongs = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18V5l10-2v13M9 18a3 3 0 1 1-2-2.83M19 16a3 3 0 1 1-2-2.83M9 9l10-2"/></svg>'
const iconListens = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 0 1 16 0M4 12v3a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2Zm16 0v3a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2Z"/></svg>'
const iconRevenue = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m3-9.5A3 3 0 0 0 12 7c-1.7 0-3 1-3 2.3 0 3.4 6 1.4 6 4.8 0 1.3-1.3 2.4-3 2.4a3.4 3.4 0 0 1-3.2-1.8"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'

const totalListens = computed(() => {
  const allGroup = songGroups.value.find(group => group.key === 'ALL')
  if (allGroup) return Number(allGroup.totalListens || 0)
  return (rawCharts.value.genres || []).reduce((sum, genre) => sum + Number(genre.listens || 0), 0)
})

const statCards = computed(() => [
  {
    key: 'songs',
    label: 'Tổng bài hát',
    value: formatNumber(stats.value.totalSongs || 0),
    note: `${formatNumber(activeSongs.value)} bài đang hoạt động`,
    icon: iconSongs,
    tone: 'tone-primary'
  },
  {
    key: 'users',
    label: 'Tổng người dùng',
    value: formatNumber(stats.value.totalUsers || 0),
    note: `${formatNumber(stats.value.totalPremium || 0)} tài khoản Premium`,
    icon: iconUsers,
    tone: 'tone-blue'
  },
  {
    key: 'listens',
    label: 'Tổng lượt nghe',
    value: formatNumber(totalListens.value),
    note: totalListens.value ? 'Tổng từ thống kê bài hát' : 'Chưa có lượt nghe',
    icon: iconListens,
    tone: 'tone-green'
  },
  {
    key: 'revenue',
    label: 'Doanh thu Premium',
    value: formatCurrency(stats.value.totalRevenue || 0),
    note: 'Từ giao dịch thanh toán thành công',
    icon: iconRevenue,
    tone: 'tone-purple'
  }
])

const activeSongs = computed(() => {
  const allGroup = songGroups.value.find(group => group.key === 'ALL')
  return Number(allGroup?.activeSongs || 0)
})

const premiumRate = computed(() => {
  const totalUsers = Number(stats.value.totalUsers || 0)
  if (!totalUsers) return 0
  return Math.round((Number(stats.value.totalPremium || 0) / totalUsers) * 100)
})

const recentTransactions = computed(() => transactions.value.slice(0, 5))
const topTrendSongs = computed(() => listeningTrend.value.topSongs || [])
const topThreeSongs = computed(() => topTrendSongs.value.slice(0, 3))
const hasTrendData = computed(() => (listeningTrend.value.series || []).some(item => Number(item.listens || 0) > 0))
const trendRangeLabel = computed(() => trendRangeOptions.find(item => item.value === trendRange.value)?.label || 'Hôm nay')

const hasRevenueData = computed(() => (rawCharts.value.revenue || []).some(row => Number(row.revenue || 0) > 0))
const hasGenreData = computed(() => (rawCharts.value.genres || []).some(row => Number(row.listens || 0) > 0))

const revenueChartData = computed(() => ({
  labels: (rawCharts.value.revenue || []).map(row => formatMonth(row.month)),
  datasets: [{
    label: 'Doanh thu',
    backgroundColor: '#7C3AED',
    hoverBackgroundColor: '#6D28D9',
    borderRadius: 8,
    maxBarThickness: 42,
    data: (rawCharts.value.revenue || []).map(row => Number(row.revenue || 0))
  }]
}))

const genresChartData = computed(() => ({
  labels: (rawCharts.value.genres || []).map(genre => genre.name || 'Khác'),
  datasets: [{
    data: (rawCharts.value.genres || []).map(genre => Number(genre.listens || 0)),
    backgroundColor: ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
    borderColor: 'transparent',
    hoverOffset: 6
  }]
}))

const trendChartData = computed(() => {
  const series = listeningTrend.value.series || []
  const maxValue = Math.max(...series.map(item => Number(item.listens || 0)), 0)
  return {
    labels: series.map(item => item.label),
    datasets: [
      {
        label: 'Lượt nghe',
        data: series.map(item => Number(item.listens || 0)),
        borderColor: '#7C3AED',
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        pointBackgroundColor: series.map(item => Number(item.listens || 0) === maxValue && maxValue > 0 ? '#EF4444' : '#7C3AED'),
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: series.map(item => Number(item.listens || 0) === maxValue && maxValue > 0 ? 6 : 4),
        pointHoverRadius: 7,
        borderWidth: 3,
        tension: 0.38,
        fill: true
      }
    ]
  }
})

const chartTextColor = computed(() => '#475569')
const chartGridColor = computed(() => 'rgba(148, 163, 184, 0.24)')

const barOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: context => ` ${formatCurrency(context.parsed.y)}`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: chartGridColor.value },
      ticks: {
        color: chartTextColor.value,
        callback: value => compactNumber(value)
      }
    },
    x: {
      grid: { display: false },
      ticks: { color: chartTextColor.value }
    }
  }
}))

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTextColor.value,
        usePointStyle: true,
        boxWidth: 8,
        padding: 16
      }
    },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: context => ` ${context.label}: ${formatNumber(context.parsed)} lượt nghe`
      }
    }
  }
}))

const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      displayColors: false,
      callbacks: {
        label: context => ` ${formatNumber(context.parsed.y)} lượt nghe`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: chartGridColor.value },
      ticks: {
        color: chartTextColor.value,
        precision: 0,
        callback: value => compactNumber(value)
      }
    },
    x: {
      grid: { display: false },
      ticks: {
        color: chartTextColor.value,
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 9
      }
    }
  }
}))

async function fetchData() {
  loading.value = true
  error.value = null
  auxiliaryWarning.value = ''
  trendLoading.value = true

  try {
    const dashboardRes = await api.get('/admin/dashboard')
    const dashboardData = dashboardRes.data?.data || {}
    stats.value = dashboardData.stats || {}
    rawCharts.value = dashboardData.charts || { revenue: [], genres: [] }
    latestUsers.value = dashboardData.latestUsers || []

    const [songSummaryResult, transactionsResult, trendResult] = await Promise.allSettled([
      api.get('/admin/songs/groups/summary'),
      api.get('/admin/transactions'),
      api.get('/admin/listening-trends', { params: { range: trendRange.value } })
    ])

    if (songSummaryResult.status === 'fulfilled') {
      songGroups.value = songSummaryResult.value.data?.data || []
    }

    if (transactionsResult.status === 'fulfilled') {
      transactions.value = transactionsResult.value.data?.data || []
    }

    if (trendResult.status === 'fulfilled') {
      listeningTrend.value = trendResult.value.data?.data || { series: [], topSongs: [] }
    }

    if (songSummaryResult.status === 'rejected' || transactionsResult.status === 'rejected' || trendResult.status === 'rejected') {
      auxiliaryWarning.value = 'Một số dữ liệu phụ chưa tải được. Dashboard vẫn hiển thị các chỉ số chính.'
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Không thể tải dữ liệu dashboard.'
  } finally {
    loading.value = false
    trendLoading.value = false
  }
}

async function fetchListeningTrend() {
  trendLoading.value = true
  auxiliaryWarning.value = ''
  try {
    const res = await api.get('/admin/listening-trends', { params: { range: trendRange.value } })
    listeningTrend.value = res.data?.data || { series: [], topSongs: [] }
  } catch (err) {
    listeningTrend.value = { series: [], topSongs: [] }
    auxiliaryWarning.value = err.response?.data?.message || 'Không thể tải dữ liệu xu hướng nghe nhạc.'
  } finally {
    trendLoading.value = false
  }
}

function setTrendRange(range) {
  if (trendRange.value === range) return
  trendRange.value = range
  fetchListeningTrend()
}

onMounted(fetchData)

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function compactNumber(value) {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatMonth(value) {
  if (!value) return ''
  const [year, month] = String(value).split('-')
  if (!year || !month) return value
  return `T${Number(month)}/${year}`
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || 'Không có email'
  const [name, domain] = email.split('@')
  if (name.length <= 2) return `${name}***@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

function songCover(song) {
  return normalizeImageUrl(song?.cover_url)
}

function trendDiff(song) {
  return Number(song?.listens || 0) - Number(song?.previous_listens || 0)
}

function trendClass(song) {
  const diff = trendDiff(song)
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}

function trendLabel(song) {
  const diff = trendDiff(song)
  if (diff > 0) return `+${formatNumber(diff)}`
  if (diff < 0) return `-${formatNumber(Math.abs(diff))}`
  return 'Ổn định'
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'success', 'completed'].includes(normalized)) return 'success'
  if (['pending', 'processing'].includes(normalized)) return 'warning'
  return 'danger'
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'success', 'completed'].includes(normalized)) return 'Thành công'
  if (['pending', 'processing'].includes(normalized)) return 'Đang xử lý'
  return 'Thất bại'
}
</script>

<style scoped>
.admin-dashboard {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  min-height: 100%;
  padding: 4px 0 16px;
  background: #f8fafc !important;
  color: #0f172a;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 800;
  color: #7c3aed;
  text-transform: uppercase;
  letter-spacing: 0;
}

.page-title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 800;
  color: #111827;
}

.page-subtitle {
  margin: 8px 0 0;
  max-width: 680px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.refresh-button,
.alert-card button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.refresh-button:hover:not(:disabled),
.alert-card button:hover {
  background: #f8fafc;
  border-color: #c4b5fd;
  color: #6d28d9;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.refresh-button svg {
  width: 17px;
  height: 17px;
}

.spinning {
  animation: spin 1s linear infinite;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card,
.panel,
.alert-card {
  background: #ffffff;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.stat-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
  min-height: 132px;
  padding: 18px;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  border-color: #c4b5fd;
  box-shadow: 0 12px 34px rgba(124, 58, 237, 0.08);
  transform: translateY(-1px);
}

.stat-icon {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}

.stat-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.tone-primary { background: rgba(124, 58, 237, 0.1); color: #7c3aed; }
.tone-blue { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
.tone-green { background: rgba(16, 185, 129, 0.12); color: #059669; }
.tone-purple { background: rgba(109, 40, 217, 0.12); color: #6d28d9; }

.stat-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.stat-value {
  margin-top: 6px;
  color: #0f172a;
  font-size: 25px;
  line-height: 1.15;
  font-weight: 800;
  word-break: break-word;
}

.stat-note {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.dashboard-grid,
.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.trend-panel {
  margin-bottom: 16px;
}

.trend-header {
  align-items: center;
}

.range-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  background: #f8fafc;
}

.range-tabs button {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.range-tabs button:hover:not(:disabled) {
  color: #6d28d9;
}

.range-tabs button.active {
  background: #ffffff;
  color: #6d28d9;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.range-tabs button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.trend-compact-grid {
  display: grid;
  grid-template-columns: minmax(280px, 4fr) minmax(0, 8fr);
  gap: 16px;
  align-items: stretch;
  min-height: 360px;
}

.trend-chart-card {
  min-width: 0;
}

.trend-chart-card.compact {
  height: 100%;
  min-height: 360px;
}

.chart-container.line-chart.compact {
  height: 360px;
}

.top-three-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  background: #fbfdff;
  padding: 12px;
}

.ranking-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.ranking-title h3 {
  margin: 0;
  color: #111827;
  font-size: 15px;
  font-weight: 800;
}

.ranking-title span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.ranking-title.compact {
  margin-bottom: 10px;
}

.top-three-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 8px;
  justify-content: space-between;
}

.top-three-row {
  display: grid;
  grid-template-columns: 38px 46px minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  row-gap: 4px;
  min-height: 86px;
  padding: 9px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #ffffff;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.top-three-row:hover {
  background: #f8fafc;
  border-color: #d8b4fe;
  transform: translateY(-1px);
}

.rank-number {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}

.rank-number.podium {
  color: #7c3aed;
}

.top-three-row img {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  object-fit: cover;
}

.song-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.song-meta strong {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-meta span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-count {
  grid-column: 3;
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.listen-count strong {
  color: #111827;
  font-size: 13px;
  font-weight: 900;
}

.listen-count span {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.trend-badge {
  grid-column: 3;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
}

.trend-badge.up { background: #dcfce7; color: #166534; }
.trend-badge.down { background: #fee2e2; color: #991b1b; }
.trend-badge.flat { background: #eef2ff; color: #4338ca; }

.line-skeleton {
  position: relative;
  height: 360px;
  overflow: hidden;
  border: 1px dashed #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.line-skeleton::before,
.line-skeleton::after,
.line-skeleton span {
  position: absolute;
  left: 24px;
  right: 24px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(124, 58, 237, 0.08), rgba(124, 58, 237, 0.38), rgba(59, 130, 246, 0.18));
  content: "";
}

.line-skeleton::before {
  top: 38%;
  transform: rotate(-3deg);
}

.line-skeleton::after {
  top: 58%;
  transform: rotate(4deg);
}

.line-skeleton span {
  top: 48%;
  animation: shimmer 1.4s ease infinite;
}

.top-three-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-three-skeleton-row {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 12px;
}

.top-three-skeleton-row span {
  height: 70px;
  border-radius: 8px;
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.compact-trend-empty {
  min-height: 300px;
}

.trend-empty.compact {
  min-height: 360px;
}

.panel {
  min-width: 0;
  padding: 18px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 1.3;
  font-weight: 800;
}

.panel-header p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.chart-container {
  height: 300px;
  position: relative;
}

.chart-container.donut {
  height: 282px;
}

.empty-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: #64748b;
  border: 1px dashed #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
  padding: 24px;
}

.empty-state.compact {
  min-height: 282px;
}

.empty-state.table-empty {
  min-height: 230px;
}

.empty-state svg {
  width: 42px;
  height: 42px;
  color: #94a3b8;
}

.empty-state p {
  margin: 0;
  max-width: 360px;
  font-weight: 600;
}

.alert-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding: 14px;
  border-color: #fecaca;
  background: #fff7f7;
  color: #991b1b;
}

.alert-card p {
  margin: 4px 0 0;
  color: #b91c1c;
  font-size: 13px;
}

.alert-card button {
  margin-left: auto;
  border-color: #fecaca;
  color: #b91c1c;
}

.alert-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 8px;
  background: #fee2e2;
}

.alert-icon svg {
  width: 20px;
  height: 20px;
}

.inline-warning {
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 13px;
  font-weight: 600;
}

.table-panel {
  overflow: hidden;
}

.view-link {
  color: #7c3aed;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}

.view-link:hover {
  color: #5b21b6;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}

.data-table th {
  padding: 12px 10px;
  border-bottom: 1px solid #e5eaf3;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
  text-transform: uppercase;
}

.data-table td {
  padding: 14px 10px;
  border-bottom: 1px solid #eef2f7;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  vertical-align: middle;
}

.data-table tbody tr {
  transition: background 0.2s ease;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.user-cell {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 3px;
}

.user-cell strong {
  color: #111827;
}

.user-cell span {
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.status-badge.success { background: #dcfce7; color: #166534; }
.status-badge.warning { background: #ffedd5; color: #9a3412; }
.status-badge.danger { background: #fee2e2; color: #991b1b; }

.insights-panel {
  align-self: start;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 36px;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 600;
}

.insight-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  margin-top: 6px;
  border-radius: 999px;
}

.insight-dot.positive,
.insight-dot.success { background: #10b981; }
.insight-dot.primary { background: #7c3aed; }
.insight-dot.warning { background: #f59e0b; }

.skeleton,
.chart-skeleton span,
.table-skeleton-row span,
.donut-skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.icon-skeleton {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
}

.line {
  height: 12px;
  margin-top: 8px;
}

.line.short { width: 94px; }
.line.medium { width: 150px; }
.line.value { width: 120px; height: 26px; }
.line.full { flex: 1; height: 12px; }
.dot { width: 8px; height: 8px; flex: 0 0 8px; margin-top: 6px; border-radius: 999px; }

.chart-skeleton {
  height: 300px;
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 24px 12px 8px;
}

.chart-skeleton span {
  flex: 1;
  min-width: 28px;
}

.donut-skeleton {
  width: min(220px, 70%);
  aspect-ratio: 1;
  margin: 32px auto;
  border-radius: 999px;
}

.table-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-skeleton-row {
  display: grid;
  grid-template-columns: 1.3fr 1fr 0.8fr 0.8fr;
  gap: 12px;
}

.table-skeleton-row span {
  height: 34px;
}

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

:global(.dark) .admin-dashboard,
:global(.dark) .admin-dashboard * {
  color-scheme: light;
}

:global(.dark) .admin-dashboard {
  background: #f8fafc !important;
  background-image: none !important;
  color: #0f172a !important;
}

:global(.dark) .admin-dashboard .stat-card,
:global(.dark) .admin-dashboard .panel,
:global(.dark) .admin-dashboard .refresh-button,
:global(.dark) .admin-dashboard .alert-card {
  background: #ffffff !important;
  border-color: #e5eaf3 !important;
  color: #334155 !important;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04) !important;
}

:global(.dark) .admin-dashboard .page-title,
:global(.dark) .admin-dashboard .panel-header h2,
:global(.dark) .admin-dashboard .ranking-title h3,
:global(.dark) .admin-dashboard .song-meta strong,
:global(.dark) .admin-dashboard .listen-count strong,
:global(.dark) .admin-dashboard .stat-value,
:global(.dark) .admin-dashboard .user-cell strong {
  color: #111827 !important;
}

:global(.dark) .admin-dashboard .page-subtitle,
:global(.dark) .admin-dashboard .panel-header p,
:global(.dark) .admin-dashboard .stat-label,
:global(.dark) .admin-dashboard .stat-note,
:global(.dark) .admin-dashboard .data-table th,
:global(.dark) .admin-dashboard .user-cell span,
:global(.dark) .admin-dashboard .ranking-title span,
:global(.dark) .admin-dashboard .song-meta span,
:global(.dark) .admin-dashboard .listen-count span,
:global(.dark) .admin-dashboard .empty-state p {
  color: #64748b !important;
}

:global(.dark) .admin-dashboard .empty-state,
:global(.dark) .admin-dashboard .insight-row,
:global(.dark) .admin-dashboard .line-skeleton {
  background: #f8fafc !important;
  border-color: #dbe3ef !important;
  color: #475569 !important;
}

:global(.dark) .admin-dashboard .top-three-panel,
:global(.dark) .admin-dashboard .top-three-row,
:global(.dark) .admin-dashboard .range-tabs button.active {
  background: #ffffff !important;
  border-color: #e5eaf3 !important;
}

:global(.dark) .admin-dashboard .range-tabs {
  background: #f8fafc !important;
  border-color: #e5eaf3 !important;
}

:global(.dark) .admin-dashboard .range-tabs button {
  color: #64748b !important;
}

:global(.dark) .admin-dashboard .range-tabs button.active {
  color: #6d28d9 !important;
}

:global(.dark) .admin-dashboard .data-table td {
  color: #334155 !important;
  border-color: #eef2f7 !important;
}

:global(.dark) .admin-dashboard .data-table tbody tr:hover {
  background: #f8fafc !important;
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }

  .trend-compact-grid {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .chart-container,
  .chart-skeleton {
    height: 280px;
  }

  .chart-container.line-chart.compact,
  .line-skeleton {
    height: 260px;
  }

  .trend-chart-card.compact {
    min-height: 260px;
  }

  .top-three-panel {
    height: auto;
  }
}

@media (max-width: 720px) {
  .dashboard-header {
    flex-direction: column;
  }

  .refresh-button {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .panel,
  .stat-card {
    padding: 14px;
  }

  .page-title {
    font-size: 24px;
  }

  .panel-header {
    flex-direction: column;
  }

  .trend-header {
    align-items: stretch;
  }

  .range-tabs {
    width: 100%;
  }

  .range-tabs button {
    flex: 1;
  }

  .top-three-row {
    grid-template-columns: 38px 44px minmax(0, 1fr);
  }

  .listen-count,
  .trend-badge {
    grid-column: 3;
    justify-self: start;
    align-items: flex-start;
  }

  .chart-container.line-chart.compact,
  .line-skeleton {
    height: 240px;
  }

  .trend-chart-card.compact {
    min-height: 240px;
  }

  .top-three-row {
    min-height: 74px;
  }

  .data-table {
    min-width: 640px;
  }

  .alert-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .alert-card button {
    width: 100%;
    margin-left: 0;
  }
}
</style>
