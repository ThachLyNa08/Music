<template>
  <section class="admin-listening-analytics">
    <header class="dashboard-header">
      <div>
        <h1 class="page-title">Thống kê Nghe nhạc</h1>
        <p class="page-subtitle">Phân tích chuyên sâu về lượt nghe theo thời gian, theo ngày, và theo nghệ sĩ.</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="range-tabs">
          <button type="button" :class="{ active: range === '7d' }" @click="setRange('7d')">7 Ngày</button>
          <button type="button" :class="{ active: range === '30d' }" @click="setRange('30d')">30 Ngày</button>
          <button type="button" :class="{ active: range === '90d' }" @click="setRange('90d')">90 Ngày</button>
        </div>
        <AdminResetButton :disabled="loading" :loading="loading" @click="resetFilters" />
      </div>
    </header>

    <div v-if="loading" class="data-quality-skeleton">
      Đang tải phân tích lượt nghe...
    </div>

    <div v-else-if="error" class="alert-card">
      <div class="alert-icon">
        <MfIcon name="error_outline" size="24" />
      </div>
      <div>
        <strong>Không thể tải dữ liệu</strong>
        <p>{{ error }}</p>
      </div>
    </div>

    <div v-else class="analytics-content">
      <div class="dashboard-grid mt-4">
        <article class="panel panel-wide">
          <div class="panel-header">
            <div>
              <h2>Biểu đồ Lượt nghe theo Ngày</h2>
            </div>
          </div>
          <div v-if="!data.listensByDay?.length" class="empty-state">
            <p>Chưa có dữ liệu lượt nghe trong khoảng thời gian này.</p>
          </div>
          <div v-else class="chart-container">
            <Bar :data="chartDataByDay" :options="chartOptions" />
          </div>
        </article>
      </div>

      <div class="dashboard-grid mt-4">
        <article class="panel panel-wide">
          <div class="panel-header">
            <div>
              <h2>Biểu đồ Lượt nghe theo Giờ trong Ngày</h2>
            </div>
          </div>
          <div v-if="!data.listensByHour?.length" class="empty-state">
            <p>Chưa có dữ liệu lượt nghe trong khoảng thời gian này.</p>
          </div>
          <div v-else class="chart-container">
            <Bar :data="chartDataByHour" :options="chartOptions" />
          </div>
        </article>
      </div>

      <div class="bottom-grid mt-4">
        <article class="panel table-panel">
          <div class="panel-header">
            <h2>Top Bài Hát</h2>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bài hát</th>
                  <th>Lượt nghe</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="song in data.topSongs" :key="song.id">
                  <td>
                    <div class="user-cell">
                      <strong>{{ song.title }}</strong>
                      <span>{{ song.artist }}</span>
                    </div>
                  </td>
                  <td>{{ song.listens }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        
        <article class="panel table-panel">
          <div class="panel-header">
            <h2>Top Nghệ Sĩ</h2>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nghệ sĩ</th>
                  <th>Lượt nghe</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="artist in data.topArtists" :key="artist.id">
                  <td>
                    <strong>{{ artist.name }}</strong>
                  </td>
                  <td>{{ artist.listens }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api/axios'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const loading = ref(true)
const error = ref(null)
const data = ref({ listensByDay: [], listensByHour: [], topSongs: [], topArtists: [] })
const range = ref('7d')

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}

const chartDataByDay = computed(() => ({
  labels: data.value.listensByDay.map(i => i.date),
  datasets: [{
    label: 'Lượt nghe',
    backgroundColor: '#3B82F6',
    data: data.value.listensByDay.map(i => i.listens)
  }]
}))

const chartDataByHour = computed(() => ({
  labels: data.value.listensByHour.map(i => `${i.hour}:00`),
  datasets: [{
    label: 'Lượt nghe',
    backgroundColor: '#10B981',
    data: data.value.listensByHour.map(i => i.listens)
  }]
}))

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get(`/admin/listening-analytics?range=${range.value}`)
    data.value = res.data?.data || {}
  } catch (err) {
    error.value = err.response?.data?.message || 'Có lỗi xảy ra'
  } finally {
    loading.value = false
  }
}

function setRange(newRange) {
  range.value = newRange
  fetchData()
}

function resetFilters() {
  range.value = '7d'
  fetchData()
}

onMounted(fetchData)
</script>

<style scoped>
.admin-listening-analytics {
  padding: 1rem;
}
.chart-container {
  height: 300px;
  width: 100%;
}
.mt-4 { margin-top: 1rem; }
</style>
