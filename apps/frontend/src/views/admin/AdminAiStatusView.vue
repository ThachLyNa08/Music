<template>
  <section class="admin-ai-status">
    <header class="dashboard-header">
      <div>
        <h1 class="page-title">Recommendation System Overview</h1>
        <p class="page-subtitle">Giám sát hiệu suất và trạng thái của thuật toán gợi ý bài hát</p>
      </div>
      <div class="header-actions">
        <button class="btn-action" :disabled="loading" @click="fetchData">
          <MfIcon name="refresh" :class="{ spinning: loading }" size="18" />
          Làm mới
        </button>
        <span :title="offlineTrainingTooltip">
          <button class="btn-action primary" disabled @click="retrainModel">
            <MfIcon name="model_training" size="18" />
            Chạy offline script
          </button>
        </span>
      </div>
    </header>

    <div v-if="loading" class="data-quality-skeleton">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu hệ thống gợi ý...</p>
    </div>

    <div v-else-if="error" class="alert-card">
      <div class="alert-icon">
        <MfIcon name="error_outline" size="24" />
      </div>
      <div>
        <strong>Không thể lấy thông tin AI</strong>
        <p>{{ error }}</p>
      </div>
    </div>

    <div v-else class="dashboard-content">
      <!-- KPI Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-content">
            <span class="stat-label">Tổng Users</span>
            <span class="stat-value text-indigo">{{ formatNumber(data.totalUsers) }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-content">
            <span class="stat-label" title="Users có từ 10 lượt nghe trở lên">Users Đủ Điều Kiện</span>
            <span class="stat-value text-green">{{ formatNumber(data.usersWithEnoughHistory) }}</span>
          </div>
          <div class="stat-meta">
            {{ formatPercent(data.usersWithEnoughHistory / Math.max(data.totalUsers, 1)) }} tổng số
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-content">
            <span class="stat-label" title="Users dưới 10 lượt nghe">Users Cold Start</span>
            <span class="stat-value text-amber">{{ formatNumber(data.coldStartUsers) }}</span>
          </div>
          <div class="stat-meta">Áp dụng gợi ý Content-based</div>
        </div>
        <div class="stat-card">
          <div class="stat-content">
            <span class="stat-label">Tổng lượt nghe hệ thống</span>
            <span class="stat-value text-blue">{{ formatNumber(data.totalListeningHistory) }}</span>
          </div>
          <div class="stat-meta">Dữ liệu cho offline training</div>
        </div>
      </div>

      <div class="main-grid">
        <!-- Model Status & Info -->
        <article class="panel">
          <div class="panel-header">
            <h2><MfIcon name="psychology" size="20" /> Thông tin Model</h2>
          </div>
          <div class="panel-body">
            <div class="quality-item">
              <span class="label">Thuật toán hiện tại:</span>
              <span class="value font-semibold">{{ data.currentModel || 'BPR-MF / Hybrid' }}</span>
            </div>
            <div class="quality-item">
              <span class="label">Cập nhật artifact gần nhất:</span>
              <span class="value">{{ data.lastTrainingRun ? new Date(data.lastTrainingRun).toLocaleString('vi-VN') : 'N/A' }}</span>
            </div>
            <div class="quality-item">
              <span class="label">Trạng thái Redis Cache:</span>
              <span class="value" :class="data.redisConnected ? 'status-good' : 'status-bad'">
                {{ data.redisConnected ? 'Active' : 'Offline' }}
              </span>
            </div>
            <div class="quality-item">
              <span class="label">Trạng thái AI Service:</span>
              <span class="value" :class="data.aiServiceConfigured ? 'status-good' : 'status-bad'">
                {{ data.aiServiceConfigured ? 'Connected' : 'Disconnected' }}
              </span>
            </div>
            <div class="quality-item">
              <span class="label">Module Gợi ý:</span>
              <span class="value" :class="data.recommendationEnabled ? 'status-good' : 'status-bad'">
                {{ data.recommendationEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>
        </article>

        <!-- Evaluation Metrics -->
        <article class="panel">
          <div class="panel-header">
            <h2><MfIcon name="analytics" size="20" /> Hiệu suất (Evaluation Metrics)</h2>
          </div>
          <div class="panel-body" v-if="data.metrics">
            <div class="metric-row">
              <div class="metric-info">
                <span class="metric-name">Precision@10</span>
                <span class="metric-desc">Độ chính xác của top 10 gợi ý</span>
              </div>
              <div class="metric-value">{{ (data.metrics.precisionAt10 * 100).toFixed(1) }}%</div>
            </div>
            
            <div class="metric-row">
              <div class="metric-info">
                <span class="metric-name">Recall@10</span>
                <span class="metric-desc">Tỷ lệ bao phủ bài hát phù hợp</span>
              </div>
              <div class="metric-value">{{ (data.metrics.recallAt10 * 100).toFixed(1) }}%</div>
            </div>

            <div class="metric-row">
              <div class="metric-info">
                <span class="metric-name">NDCG@10</span>
                <span class="metric-desc">Độ liên quan xếp hạng</span>
              </div>
              <div class="metric-value">{{ (data.metrics.ndcgAt10 * 100).toFixed(1) }}%</div>
            </div>

            <div class="metric-row">
              <div class="metric-info">
                <span class="metric-name">Coverage</span>
                <span class="metric-desc">Mức độ đa dạng danh mục gợi ý</span>
              </div>
              <div class="metric-value">{{ (data.metrics.coverage * 100).toFixed(1) }}%</div>
            </div>
          </div>
          <div class="panel-body empty" v-else>
            Chưa có dữ liệu đánh giá model.
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const loading = ref(true)
const error = ref(null)
const data = ref({})
const offlineTrainingTooltip = 'MVP hiện sử dụng offline training script. Vui lòng chạy script huấn luyện từ backend để cập nhật model artifact.'

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get('/admin/ai-status')
    data.value = res.data?.data || {}
  } catch (err) {
    error.value = err.response?.data?.message || 'Có lỗi xảy ra'
  } finally {
    loading.value = false
  }
}

function retrainModel() {
  toast.showToast(offlineTrainingTooltip, 'warning')
  // TODO: Có thể bổ sung background job retraining trong phase sau.
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0'
  return new Intl.NumberFormat('vi-VN').format(num)
}

function formatPercent(num) {
  if (num === undefined || num === null) return '0%'
  return (num * 100).toFixed(1) + '%'
}

onMounted(fetchData)
</script>

<style scoped>
.admin-ai-status {
  padding: 24px;
  background-color: #f8fafc;
  min-height: 100vh;
  color: #0f172a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #0f172a;
}
.page-subtitle {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 12px;
}
.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-action:hover:not(:disabled) {
  background: #f8fafc;
}
.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-action.primary {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #ffffff;
}
.btn-action.primary:hover:not(:disabled) {
  background: #6d28d9;
}

/* Status Loading / Error */
.data-quality-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  color: #64748b;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  gap: 16px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(124, 58, 237, 0.2);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.alert-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.alert-icon {
  color: #ef4444;
}

/* Dashboard Content */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
@media (min-width: 640px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }

.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}
.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stat-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
}
.stat-meta {
  font-size: 12px;
  color: #94a3b8;
}

.text-indigo { color: #7c3aed; }
.text-green { color: #16a34a; }
.text-amber { color: #d97706; }
.text-blue { color: #2563eb; }

/* Main Grid */
.main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 768px) { .main-grid { grid-template-columns: 1fr 1fr; } }

.panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
  overflow: hidden;
}
.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.panel-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-body {
  padding: 12px 20px;
}
.panel-body.empty {
  padding: 32px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

/* Quality Item (Info list) */
.quality-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
}
.quality-item:last-child {
  border-bottom: none;
}
.quality-item .label {
  color: #64748b;
}
.quality-item .value {
  color: #0f172a;
}
.status-good { color: #16a34a !important; font-weight: 600; background: #f0fdf4; padding: 2px 8px; border-radius: 6px; border: 1px solid #bbf7d0;}
.status-bad { color: #dc2626 !important; font-weight: 600; background: #fef2f2; padding: 2px 8px; border-radius: 6px; border: 1px solid #fecaca;}
.font-semibold { font-weight: 600; }

/* Metrics Row */
.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #f1f5f9;
}
.metric-row:last-child {
  border-bottom: none;
}
.metric-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.metric-name {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}
.metric-desc {
  font-size: 12px;
  color: #94a3b8;
}
.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #7c3aed;
}

/* Utilities */
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }
</style>
