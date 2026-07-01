<template>
  <div class="space-y-6 pb-10">
    <!-- Header -->
    <header class="flex flex-col md:flex-row items-start md:items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Recommendation</h1>
        <p class="text-gray-500 mt-1 text-sm font-medium">Giám sát mô hình gợi ý, dữ liệu huấn luyện và chất lượng đề xuất cá nhân hóa</p>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Làm mới" @click="fetchData(true)" :disabled="loading">
          <MfIcon name="sync" size="20" :class="{ 'animate-spin': loading }" />
        </button>
        <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Xuất báo cáo" @click="exportReport">
          <MfIcon name="download" size="20" />
        </button>
        <button class="btn-primary px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-indigo-700 transition" @click="openRetrainConfirm">
          <MfIcon name="refresh" size="18" /> Retrain Model
        </button>
      </div>
    </header>

    <div v-if="loading && !summary" class="flex flex-col items-center justify-center py-20">
      <div class="spinner"></div>
      <p class="mt-4 text-slate-500">Đang tải dữ liệu hệ thống gợi ý...</p>
    </div>

    <template v-else>
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminKpiCard
          title="Người dùng có dữ liệu"
          :value="summary?.eligibleUsers ?? '—'"
          :subtitle="summary?.usersWithHistory ? `Đủ điều kiện train từ ${summary.usersWithHistory} user` : ''"
          icon="users"
          tone="blue"
          :loading="loading"
        />
        <AdminKpiCard
          title="Bài hát trong Catalog"
          :value="summary?.catalogSongs ?? '—'"
          subtitle="Các bài hát public có audio"
          icon="music"
          tone="purple"
          :loading="loading"
        />
        <AdminKpiCard
          title="Model hiện tại"
          :value="formatStrategyName(summary?.currentStrategy)"
          :subtitle="summary?.modelLoaded ? 'Đã load vào bộ nhớ' : 'Sử dụng fallback'"
          icon="ai"
          :tone="summary?.modelLoaded ? 'green' : 'amber'"
          :loading="loading"
        />
        <AdminKpiCard
          title="Coverage@20 (BPR-MF)"
          :value="getMetricValue('bpr_mf', 'global_catalog_coverage_at_20', true)"
          subtitle="Tỷ lệ bao phủ catalog"
          icon="analytics"
          tone="cyan"
          :loading="loading"
        />
      </div>

      <!-- Detail Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Model Status Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 class="text-lg font-bold text-slate-800">Trạng thái mô hình</h2>
          </div>
          <div class="p-5 flex-1 text-sm text-slate-600 space-y-4">
            <div class="flex justify-between items-center">
              <span class="font-medium text-slate-500">Chiến lược đang dùng:</span>
              <span class="font-bold text-slate-900">{{ summary?.currentStrategy || '—' }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="font-medium text-slate-500">Artifact path:</span>
              <span class="text-xs text-slate-500 truncate ml-4" :title="summary?.modelArtifact">{{ formatPath(summary?.modelArtifact) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="font-medium text-slate-500">Cập nhật lúc:</span>
              <span class="font-medium">{{ formatDate(summary?.modelUpdatedAt) }}</span>
            </div>
            
            <hr class="border-slate-100">
            
            <template v-if="summary?.metadata">
              <div class="flex justify-between items-center">
                <span class="font-medium text-slate-500">Trained Users:</span>
                <span class="font-medium">{{ summary.metadata.trained_users || summary.trainedUsers }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-medium text-slate-500">Trained Items:</span>
                <span class="font-medium">{{ summary.metadata.trained_items || summary.trainedItems }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-medium text-slate-500">Latent Factors:</span>
                <span class="font-medium">{{ summary.metadata.factors || summary.factors }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-medium text-slate-500">Epochs:</span>
                <span class="font-medium">{{ summary.metadata.hyperparameters?.epochs || summary.epochs || '—' }}</span>
              </div>
            </template>
            <div v-else class="text-center py-4 text-slate-400 italic">
              Chưa có metadata model
            </div>
          </div>
        </div>

        <!-- Fallback Strategy Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-slate-100 bg-amber-50">
            <h2 class="text-lg font-bold text-amber-900">Chiến lược Fallback</h2>
          </div>
          <div class="p-5 flex-1 text-sm text-slate-700">
            <p class="mb-3">Hệ thống gợi ý sử dụng cơ chế fallback đa tầng để đảm bảo luôn có kết quả phù hợp cho user:</p>
            <ul class="list-disc pl-5 space-y-2 mb-4">
              <li>
                <strong class="text-slate-900">User đủ dữ liệu:</strong> Sử dụng <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">BPR-MF</code> / <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">Hybrid</code> rerank để tối ưu hóa cá nhân hóa.
              </li>
              <li>
                <strong class="text-slate-900">User ít dữ liệu:</strong> Chuyển sang <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">content_based_fallback</code> dựa trên lịch sử nghe nhạc gần đây.
              </li>
              <li>
                <strong class="text-slate-900">User mới (Cold Start):</strong> 
                <div class="mt-1 ml-2 space-y-1 text-slate-600">
                  <p>- Nếu có chọn sở thích: dùng <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">cold_start_preferences</code></p>
                  <p>- Nếu không: dùng <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">popular_fallback</code></p>
                </div>
              </li>
            </ul>
            <div class="mt-4 pt-4 border-t border-slate-100">
              <strong class="text-slate-900 block mb-2">Quy tắc bổ sung (Rules):</strong>
              <div class="text-xs text-slate-600 space-y-1">
                <p>- Artist Cap (tránh lặp quá nhiều bài của 1 nghệ sĩ)</p>
                <p>- Market Strict Rule (ưu tiên nhạc cùng thị trường với gu nghe)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Evaluation Metrics -->
      <div class="mt-6">
        <h2 class="text-xl font-bold text-slate-800 mb-4">Đánh giá mô hình (Metrics)</h2>
        
        <div v-if="!metrics" class="bg-white p-10 rounded-2xl border border-slate-200 text-center shadow-sm">
          <MfIcon name="analytics" size="48" class="text-slate-300 mx-auto mb-3" />
          <h3 class="text-lg font-semibold text-slate-700">Chưa có dữ liệu đánh giá mô hình</h3>
          <p class="text-slate-500 mt-1">Hãy chạy script evaluation để tạo metrics trước khi hiển thị.</p>
        </div>
        
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="(metricGroup, key) in metrics" :key="key" class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative" :class="{'ring-2 ring-indigo-500': key === bestModelKey}">
            <div v-if="key === bestModelKey" class="absolute -top-3 -right-3 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md uppercase tracking-wider">
              Tốt nhất
            </div>
            <h3 class="font-bold text-slate-800 mb-4 capitalize border-b border-slate-100 pb-2">
              {{ metricGroup.label || key }}
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-slate-500 mb-1">Precision@10</div>
                <div class="font-semibold text-slate-800 text-lg">{{ formatPercent(metricGroup.precision_at_10) }}</div>
              </div>
              <div>
                <div class="text-xs text-slate-500 mb-1">Recall@10</div>
                <div class="font-semibold text-slate-800 text-lg">{{ formatPercent(metricGroup.recall_at_10) }}</div>
              </div>
              <div>
                <div class="text-xs text-slate-500 mb-1">NDCG@10</div>
                <div class="font-semibold text-slate-800 text-lg">{{ formatPercent(metricGroup.ndcg_at_10) }}</div>
              </div>
              <div>
                <div class="text-xs text-slate-500 mb-1">Coverage@20</div>
                <div class="font-semibold text-slate-800 text-lg">{{ formatPercent(metricGroup.global_catalog_coverage_at_20) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Recommendation Samples -->
      <div class="mt-8">
        <h2 class="text-xl font-bold text-slate-800 mb-4">Kiểm tra nhanh đề xuất</h2>
        
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center mb-4">
          <div class="relative flex-1 w-full">
            <MfIcon name="search" size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="number" 
              v-model="previewUserId" 
              placeholder="Nhập User ID để xem đề xuất..." 
              class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              @keyup.enter="fetchPreview"
            />
          </div>
          <button class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap flex items-center gap-2" @click="fetchPreview" :disabled="previewLoading || !previewUserId">
            <span v-if="previewLoading" class="animate-spin"><MfIcon name="sync" size="16" /></span>
            <span v-else><MfIcon name="search" size="16" /> Xem đề xuất</span>
          </button>
        </div>

        <div v-if="previewError" class="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 text-sm mb-4">
          {{ previewError }}
        </div>

        <AdminTableShell 
          v-if="previewResults.length > 0"
          :loading="previewLoading" 
          :empty="false"
        >
          <table class="w-full text-left border-collapse whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200 text-xs text-slate-900 uppercase tracking-wider">
              <tr>
                <th class="p-4 font-semibold w-12 text-center">#</th>
                <th class="p-4 font-semibold w-16">Ảnh</th>
                <th class="p-4 font-semibold">Bài hát</th>
                <th class="p-4 font-semibold">Nghệ sĩ</th>
                <th class="p-4 font-semibold">Chiến lược</th>
                <th class="p-4 font-semibold max-w-[200px]">Lý do</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in previewResults" :key="item.song_id" class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td class="p-4 text-center text-sm text-slate-400">{{ idx + 1 }}</td>
                <td class="p-4">
                  <img v-if="item.cover_url" :src="item.cover_url" class="w-10 h-10 rounded-md object-cover shadow-sm" alt="" />
                  <div v-else class="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
                    <MfIcon name="music_note" class="text-slate-400" size="18" />
                  </div>
                </td>
                <td class="p-4">
                  <a href="#" @click.prevent="goToSong(item.song_id)" class="text-sm font-bold text-slate-900 hover:text-indigo-600 hover:underline">
                    {{ item.title }}
                  </a>
                </td>
                <td class="p-4 text-sm text-slate-600">
                  <a href="#" @click.prevent="goToArtist(item.artist_id)" class="hover:text-indigo-600 hover:underline" v-if="item.artist_id">
                    {{ item.artist_name }}
                  </a>
                  <span v-else>{{ item.artist_name }}</span>
                </td>
                <td class="p-4">
                  <span class="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded uppercase">
                    {{ item.strategy }}
                  </span>
                </td>
                <td class="p-4 text-xs text-slate-500 truncate max-w-[200px]" :title="item.reason">
                  {{ item.reason }}
                </td>
              </tr>
            </tbody>
          </table>
        </AdminTableShell>
        
        <div v-else-if="previewSearched && !previewLoading" class="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
          <p class="text-slate-500">Không tìm thấy đề xuất nào cho User ID này.</p>
        </div>
      </div>
    </template>

    <ConfirmDialog 
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirmText="confirmState.confirmText"
      :type="confirmState.type"
      :loading="confirmState.loading"
      @confirm="handleConfirmRetrain"
      @cancel="confirmState.open = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import MfIcon from '@/components/common/MfIcon.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

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

const confirmState = ref({
  open: false,
  title: 'Huấn luyện lại mô hình',
  message: 'Quá trình huấn luyện mô hình gợi ý có thể tốn nhiều tài nguyên của hệ thống và mất một khoảng thời gian. Bạn có chắc chắn muốn thực hiện ngay bây giờ?',
  confirmText: 'Bắt đầu huấn luyện',
  type: 'danger',
  loading: false
})

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
      api.get('/admin/recommendation/summary').catch(() => ({ data: {} })),
      api.get('/admin/recommendation/metrics').catch(() => ({ data: {} }))
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

function openRetrainConfirm() {
  confirmState.value.open = true
}

async function handleConfirmRetrain() {
  confirmState.value.loading = true
  try {
    const res = await api.post('/admin/recommendation/retrain')
    if (res.data?.success) {
      toast.showToast('Đã bắt đầu tiến trình huấn luyện mô hình', 'success')
      fetchData()
    } else {
      toast.showToast(res.data?.message || 'Có lỗi xảy ra khi gọi lệnh retrain', 'error')
    }
  } catch (err) {
    console.error('Retrain error:', err)
    toast.showToast('Không thể thực hiện huấn luyện lúc này', 'error')
  } finally {
    confirmState.value.loading = false
    confirmState.value.open = false
  }
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
/* Scoped styles have been removed in favor of Tailwind CSS utility classes */
</style>
