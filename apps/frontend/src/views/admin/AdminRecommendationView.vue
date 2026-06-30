<template>
  <div class="admin-recommendation">
    <div class="header-section">
      <div>
        <h1 class="page-title">Recommendation</h1>
        <p class="page-subtitle">Giám sát mô hình gợi ý, dữ liệu huấn luyện và chất lượng đề xuất cá nhân hóa</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary btn-icon" title="Làm mới" @click="fetchData(true)" :disabled="loading">
          <MfIcon name="sync" size="20" :class="{ 'spinning': loading }" />
        </button>
        <button class="btn-primary btn-icon" title="Xuất báo cáo" @click="exportReport">
          <MfIcon name="download" size="20" />
        </button>
      </div>
    </div>

    <div v-if="loading && !summary" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu hệ thống gợi ý...</p>
    </div>

    <template v-else>
      <!-- KPI Cards -->
      <div class="stats-overview">
        <div class="summary-card">
          <div class="card-icon revenue"><MfIcon name="group" size="24" /></div>
          <div class="card-info">
            <span class="card-label">Người dùng có dữ liệu</span>
            <span class="card-value">{{ summary?.eligibleUsers ?? '—' }}</span>
            <span class="card-subline" v-if="summary?.usersWithHistory">Đủ điều kiện train từ {{ summary.usersWithHistory }} user có lịch sử</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon count"><MfIcon name="library_music" size="24" /></div>
          <div class="card-info">
            <span class="card-label">Bài hát trong Catalog</span>
            <span class="card-value">{{ summary?.catalogSongs ?? '—' }}</span>
            <span class="card-subline">Các bài hát public có audio</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon paid"><MfIcon name="ai" size="24" /></div>
          <div class="card-info">
            <span class="card-label">Model hiện tại</span>
            <span class="card-value">{{ formatStrategyName(summary?.currentStrategy) }}</span>
            <span class="card-subline" :class="summary?.modelLoaded ? 'text-emerald-600' : 'text-amber-600'">
              {{ summary?.modelLoaded ? 'Đã load vào bộ nhớ' : 'Sử dụng fallback' }}
            </span>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon pending"><MfIcon name="analytics" size="24" /></div>
          <div class="card-info">
            <span class="card-label">Coverage@20 (BPR-MF)</span>
            <span class="card-value">{{ getMetricValue('bpr_mf', 'global_catalog_coverage_at_20', true) }}</span>
            <span class="card-subline">Tỷ lệ bao phủ catalog</span>
          </div>
        </div>
      </div>

      <div class="grid-2-col">
        <!-- Model Status Card -->
        <div class="status-card">
          <h2 class="section-title">Trạng thái mô hình</h2>
          <div class="status-content">
            <div class="info-row">
              <span class="info-label">Chiến lược đang dùng:</span>
              <span class="info-value font-semibold">{{ summary?.currentStrategy || '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Artifact path:</span>
              <span class="info-value text-xs text-slate-500 truncate-path" :title="summary?.modelArtifact">{{ formatPath(summary?.modelArtifact) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Cập nhật lúc:</span>
              <span class="info-value">{{ formatDate(summary?.modelUpdatedAt) }}</span>
            </div>
            
            <div class="divider"></div>
            
            <template v-if="summary?.metadata">
              <div class="info-row">
                <span class="info-label">Trained Users:</span>
                <span class="info-value">{{ summary.metadata.trained_users || summary.trainedUsers }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Trained Items:</span>
                <span class="info-value">{{ summary.metadata.trained_items || summary.trainedItems }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Latent Factors:</span>
                <span class="info-value">{{ summary.metadata.factors || summary.factors }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Epochs:</span>
                <span class="info-value">{{ summary.metadata.hyperparameters?.epochs || summary.epochs || '—' }}</span>
              </div>
            </template>
            <div v-else class="empty-metadata">
              Chưa có metadata model
            </div>
          </div>
        </div>

        <!-- Fallback Strategy -->
        <div class="status-card fallback-card">
          <h2 class="section-title">Chiến lược Fallback</h2>
          <div class="fallback-content">
            <p class="fallback-desc">Hệ thống gợi ý sử dụng cơ chế fallback đa tầng để đảm bảo luôn có kết quả phù hợp cho user:</p>
            <ul class="fallback-list">
              <li>
                <strong>User đủ dữ liệu:</strong> Sử dụng <code>BPR-MF</code> / <code>Hybrid</code> rerank để tối ưu hóa cá nhân hóa.
              </li>
              <li>
                <strong>User ít dữ liệu:</strong> Chuyển sang <code>content_based_fallback</code> dựa trên lịch sử nghe nhạc gần đây.
              </li>
              <li>
                <strong>User mới (Cold Start):</strong> 
                <br> - Nếu có chọn sở thích: dùng <code>cold_start_preferences</code>
                <br> - Nếu không: dùng <code>popular_fallback</code>
              </li>
            </ul>
            <div class="fallback-rules mt-4">
              <strong>Quy tắc bổ sung (Rules):</strong>
              <div class="text-xs text-slate-600 mt-1">
                - Artist Cap (tránh lặp quá nhiều bài của 1 nghệ sĩ)<br>
                - Market Strict Rule (ưu tiên nhạc cùng thị trường với gu nghe)
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Evaluation Metrics -->
      <div class="metrics-section">
        <h2 class="section-title">Đánh giá mô hình (Metrics)</h2>
        
        <div v-if="!metrics" class="empty-state">
          <MfIcon name="analytics" size="48" class="text-slate-300 mb-2" />
          <h3>Chưa có dữ liệu đánh giá mô hình</h3>
          <p>Hãy chạy script evaluation để tạo metrics trước khi hiển thị.</p>
        </div>
        
        <div v-else class="metrics-grid">
          <div v-for="(metricGroup, key) in metrics" :key="key" class="metric-card" :class="{'is-best-model': key === bestModelKey}">
            <h3 class="metric-title">
              {{ metricGroup.label || key }}
              <span v-if="key === bestModelKey" class="best-badge">Tốt nhất</span>
            </h3>
            <div class="metric-stats">
              <div class="stat-item">
                <span class="stat-lbl">Precision@10</span>
                <span class="stat-val">{{ formatPercent(metricGroup.precision_at_10) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">Recall@10</span>
                <span class="stat-val">{{ formatPercent(metricGroup.recall_at_10) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">NDCG@10</span>
                <span class="stat-val">{{ formatPercent(metricGroup.ndcg_at_10) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">Coverage@20</span>
                <span class="stat-val">{{ formatPercent(metricGroup.global_catalog_coverage_at_20) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Recommendation Samples -->
      <div class="preview-section">
        <h2 class="section-title">Kiểm tra nhanh đề xuất</h2>
        
        <div class="preview-controls">
          <input 
            type="number" 
            v-model="previewUserId" 
            placeholder="Nhập User ID để xem đề xuất..." 
            class="search-input"
            @keyup.enter="fetchPreview"
          />
          <button class="btn-primary" @click="fetchPreview" :disabled="previewLoading || !previewUserId">
            <MfIcon name="search" size="18" /> Xem đề xuất
          </button>
        </div>

        <div v-if="previewLoading" class="preview-loading">
          <div class="spinner small"></div> Đang lấy danh sách đề xuất...
        </div>

        <div v-else-if="previewError" class="preview-error">
          {{ previewError }}
        </div>

        <div v-else-if="previewResults.length > 0" class="table-container shadow-sm mt-4">
          <table class="preview-table">
            <thead>
              <tr>
                <th width="50">#</th>
                <th width="60">Ảnh</th>
                <th>Bài hát</th>
                <th>Nghệ sĩ</th>
                <th>Chiến lược (Strategy)</th>
                <th>Lý do (Reason)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in previewResults" :key="item.song_id" class="preview-row">
                <td class="text-slate-400 font-medium">{{ idx + 1 }}</td>
                <td>
                  <img :src="item.cover_url" class="song-cover" alt="" v-if="item.cover_url" />
                  <div class="song-cover-placeholder" v-else><MfIcon name="music_note" /></div>
                </td>
                <td>
                  <a href="#" @click.prevent="goToSong(item.song_id)" class="item-link song-title">
                    {{ item.title }}
                  </a>
                </td>
                <td>
                  <a href="#" @click.prevent="goToArtist(item.artist_id)" class="item-link" v-if="item.artist_id">
                    {{ item.artist_name }}
                  </a>
                  <span v-else>{{ item.artist_name }}</span>
                </td>
                <td><span class="badge badge-strategy">{{ item.strategy }}</span></td>
                <td class="text-xs text-slate-500">{{ item.reason }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div v-else-if="previewSearched" class="empty-state small">
          <p>Không tìm thấy đề xuất nào cho User ID này.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import MfIcon from '@/components/common/MfIcon.vue'

const router = useRouter()
const toast = useToastStore()

const loading = ref(true)
const summary = ref(null)
const metrics = ref(null)

const previewUserId = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const previewResults = ref([])
const previewSearched = ref(false)

watch(previewUserId, (newVal) => {
  if (!newVal || newVal.toString().trim() === '') {
    previewResults.value = []
    previewSearched.value = false
    previewError.value = ''
  }
})

onMounted(() => {
  fetchData()
})

async function fetchData(showToastSuccess = false) {
  loading.value = true
  try {
    const [sumRes, metRes] = await Promise.all([
      api.get('/admin/recommendation/summary'),
      api.get('/admin/recommendation/metrics')
    ])
    
    if (sumRes.data?.success) {
      summary.value = sumRes.data.data
    }
    if (metRes.data?.success && metRes.data.data) {
      metrics.value = metRes.data.data
    } else {
      metrics.value = null
    }

    if (showToastSuccess) {
      toast.showToast('Làm mới dữ liệu thành công!', 'success')
    }
  } catch (err) {
    console.error('Error loading recommendation data:', err)
    toast.showToast('Không thể tải dữ liệu recommendation', 'error')
  } finally {
    loading.value = false
  }
}

const bestModelKey = computed(() => {
  if (!metrics.value) return null
  let bestKey = null
  let maxScore = -1
  for (const [key, data] of Object.entries(metrics.value)) {
    const score = data.ndcg_at_10 || data.precision_at_10 || 0
    if (score > maxScore) {
      maxScore = score
      bestKey = key
    }
  }
  return bestKey
})

async function fetchPreview() {
  if (!previewUserId.value) {
    toast.showToast('Vui lòng nhập User ID để xem đề xuất', 'warning')
    return
  }
  
  previewLoading.value = true
  previewError.value = ''
  previewSearched.value = false
  previewResults.value = []
  
  try {
    const res = await api.get(`/admin/recommendation/users/${previewUserId.value}/preview?limit=10`)
    if (res.data?.success) {
      previewResults.value = res.data.data || []
      previewSearched.value = true
    } else {
      previewError.value = res.data?.message || 'Có lỗi xảy ra khi tải đề xuất'
    }
  } catch (err) {
    console.error('Preview error:', err)
    if (err.response?.status === 404) {
      previewError.value = 'User không tồn tại hoặc không thể tạo đề xuất'
    } else {
      previewError.value = 'Không thể tải bản xem trước đề xuất'
    }
  } finally {
    previewLoading.value = false
  }
}

function exportReport() {
  toast.showToast('Chức năng xuất báo cáo đang được hoàn thiện', 'info')
}

function goToSong(id) {
  if (id) router.push(`/admin/songs/${id}`)
}

function goToArtist(id) {
  if (id) router.push(`/admin/artists/${id}/detail`)
}

// Helpers
function formatStrategyName(str) {
  if (!str) return '—'
  if (str === 'bpr_mf_rerank') return 'BPR-MF Rerank'
  if (str === 'bpr_mf') return 'BPR-MF'
  if (str === 'content_based_fallback') return 'Content-Based Fallback'
  if (str === 'popular_fallback') return 'Popular Fallback'
  return str
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatPercent(val) {
  if (val === undefined || val === null) return '—'
  return (val * 100).toFixed(1) + '%'
}

function formatPath(fullPath) {
  if (!fullPath) return 'Không có'
  const parts = fullPath.split(/[/\\]/)
  if (parts.length <= 3) return fullPath
  return '.../' + parts.slice(-3).join('/')
}

function getMetricValue(strategy, field, format = false) {
  if (!metrics.value || !metrics.value[strategy]) return '—'
  const val = metrics.value[strategy][field]
  if (val === null || val === undefined) return '—'
  return format ? formatPercent(val) : val
}
</script>

<style scoped>
.admin-recommendation {
  padding: 8px 16px 40px;
  animation: fadeIn 0.4s ease-out;
  color: #1e293b;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.btn-icon {
  padding: 0;
  width: 40px;
  height: 40px;
  justify-content: center;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}
.page-title {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}
.page-subtitle {
  color: #64748b;
  margin: 6px 0 0 0;
  font-size: 14px;
}
.header-actions {
  display: flex;
  gap: 12px;
}

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  height: 40px;
}
.btn-primary {
  background: #6366f1;
  color: white;
  border: none;
}
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary {
  background: white;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:hover:not(:disabled) { background: #f8fafc; }

.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Stats Overview */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.summary-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #f1f5f9;
}
.card-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-icon.revenue { background: #e0e7ff; color: #4f46e5; }
.card-icon.count { background: #ecfdf5; color: #059669; }
.card-icon.paid { background: #fffbeb; color: #d97706; }
.card-icon.pending { background: #fef2f2; color: #dc2626; }

.card-info {
  display: flex;
  flex-direction: column;
}
.card-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
}
.card-value {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  margin-top: 4px;
  line-height: 1.2;
}
.card-subline {
  font-size: 10px;
  margin-top: 4px;
  color: #94a3b8;
  line-height: 1.4;
}

/* Grid layout for Status and Fallback */
.grid-2-col {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}
.status-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #f1f5f9;
}
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-content .info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed #e2e8f0;
}
.status-content .info-row:last-child {
  border-bottom: none;
}
.info-label {
  color: #64748b;
  font-size: 14px;
}
.info-value {
  color: #0f172a;
  font-size: 14px;
  text-align: right;
  flex: 1;
  word-break: break-all;
}
.truncate-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
  display: block;
  max-width: 100%;
}
.divider {
  height: 1px;
  background: #e2e8f0;
  margin: 16px 0;
}
.empty-metadata {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-style: italic;
  font-size: 14px;
}

.fallback-content {
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}
.fallback-desc {
  margin-bottom: 12px;
}
.fallback-list {
  padding-left: 20px;
  margin: 0;
}
.fallback-list li {
  margin-bottom: 8px;
}
.fallback-list code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #dc2626;
}

/* Metrics Section */
.metrics-section {
  margin-bottom: 32px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}
.metric-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
}
.metric-card.is-best-model {
  border-color: #a855f7;
  box-shadow: 0 0 0 1px #a855f710;
  background: #faf5ff;
}
.metric-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.best-badge {
  background: #e9d5ff;
  color: #7e22ce;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}
.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}
.stat-lbl {
  color: #64748b;
  font-size: 13px;
}
.stat-val {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

/* Preview Section */
.preview-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #f1f5f9;
}
.preview-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.search-input {
  width: 300px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  outline: none;
}
.search-input:focus {
  border-color: #6366f1;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.preview-table th {
  padding: 12px 16px;
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e2e8f0;
}
.preview-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  vertical-align: middle;
}
.preview-row:hover {
  background: #f8fafc;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}
.song-cover-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.item-link {
  color: #4f46e5;
  text-decoration: none;
  font-weight: 500;
}
.item-link:hover {
  text-decoration: underline;
}
.song-title {
  color: #0f172a;
}

.badge-strategy {
  background: #f3f4f6;
  color: #4b5563;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
}
.empty-state h3 {
  margin: 0 0 8px 0;
  color: #334155;
  font-size: 16px;
}
.empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}
.empty-state.small {
  padding: 24px;
}

.loading-state, .preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: #64748b;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.text-emerald-600 { color: #059669; }
.text-amber-600 { color: #d97706; }
.preview-error {
  padding: 12px 16px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 14px;
}
</style>
