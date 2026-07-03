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
        <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Xuất báo cáo" @click="exportReport" :disabled="exportLoading">
          <MfIcon v-if="exportLoading" name="sync" size="20" class="animate-spin" />
          <MfIcon v-else name="download" size="20" />
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
          title="Chiến lược"
          :value="formatStrategyName(summary?.strategy)"
          subtitle="Đang phục vụ gợi ý"
          :show-icon="false"
          tone="blue"
          :loading="loading"
        />
        <AdminKpiCard
          title="Model"
          :value="summary?.hasArtifact ? 'Sẵn sàng' : 'Fallback'"
          :subtitle="summary?.hasArtifact ? 'Có artifact' : 'Chưa có artifact'"
          :show-icon="false"
          :tone="summary?.hasArtifact ? 'green' : 'amber'"
          :loading="loading"
        />
        <AdminKpiCard
          title="Precision@10"
          :value="summary?.metrics?.precisionAt10 ?? '—'"
          subtitle="Đánh giá offline"
          :show-icon="false"
          tone="purple"
          :loading="loading"
        />
        <AdminKpiCard
          title="NDCG@10"
          :value="summary?.metrics?.ndcgAt10 ?? '—'"
          subtitle="Chất lượng xếp hạng"
          :show-icon="false"
          tone="cyan"
          :loading="loading"
        />
      </div>

      <!-- Detail Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Model Status Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div class="px-5 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 class="text-lg font-bold text-slate-800">Trạng thái mô hình</h2>
          </div>
          <div class="p-5 flex-1 text-sm text-slate-600 flex flex-col">
            <div class="flex justify-between items-center mb-4">
              <span class="font-medium text-slate-500">Chiến lược đang dùng:</span>
              <div class="flex flex-col items-end">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900">{{ formatStrategyName(summary?.strategy) }}</span>
                  <span v-if="summary?.strategy && summary.strategy.includes('fallback')" class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">
                    Đang dùng fallback
                  </span>
                </div>
                <span class="text-[10px] text-slate-400 mt-0.5">Mã chiến lược: {{ summary?.strategy || '—' }}</span>
              </div>
            </div>
            <div class="flex justify-between items-center mb-4">
              <span class="font-medium text-slate-500">Artifact path:</span>
              <span class="text-xs text-slate-500 truncate ml-4" :title="summary?.artifactPath">{{ summary?.artifactPath || 'Không có' }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="font-medium text-slate-500">Cập nhật lúc:</span>
              <span class="font-medium">{{ summary?.updatedAt ? formatDate(summary.updatedAt) : '—' }}</span>
            </div>
            
            <hr class="border-slate-100 my-4">
            
            <template v-if="summary?.hasArtifact">
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Trained Users:</span>
                  <span class="font-medium">{{ summary?.training?.trainedUsers || '—' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Trained Items:</span>
                  <span class="font-medium">{{ summary?.training?.trainedItems || '—' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Latent Factors:</span>
                  <span class="font-medium">{{ summary?.training?.factors || '—' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Epochs:</span>
                  <span class="font-medium">{{ summary?.training?.epochs || '—' }}</span>
                </div>
              </div>
            </template>
            <div v-else class="flex-1 bg-slate-50 rounded-xl p-5 border border-slate-100 text-center flex flex-col justify-center mt-2">
              <MfIcon name="info" size="32" class="text-slate-400 mx-auto mb-2" />
              <h3 class="font-bold text-slate-700 mb-1">Chưa có metadata model</h3>
              <p class="text-xs text-slate-500 mb-4 leading-relaxed">
                Hệ thống hiện đang dùng chiến lược fallback để đảm bảo vẫn có gợi ý cho người dùng. 
                Bạn có thể kiểm tra artifact model hoặc chạy lại pipeline huấn luyện nếu cần.
              </p>
              <div class="flex justify-center">
                <button class="btn-secondary px-4 py-2 text-sm bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-semibold" @click="fetchData(true)">
                  Làm mới
                </button>
              </div>
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
        
        <div v-if="!summary?.hasMetrics" class="bg-white py-8 px-5 rounded-2xl border border-slate-200 text-center shadow-sm">
          <MfIcon name="analytics" size="48" class="text-slate-300 mx-auto mb-3" />
          <h3 class="text-lg font-semibold text-slate-700">Chưa có dữ liệu đánh giá mô hình</h3>
          <p class="text-slate-500 mt-1">Hãy chạy script evaluation để tạo metrics trước khi hiển thị.</p>
        </div>
        
        <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-900">
                  Metric
                </th>
                <th
                  v-for="model in metricsComparison"
                  :key="model.key"
                  class="px-5 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-900"
                  :class="model.key === bestModelKey ? 'bg-emerald-50 text-emerald-900' : ''"
                >
                  <div class="flex flex-col items-center gap-1">
                    <span>{{ model.name }}</span>
                    <span
                      v-if="model.key === bestModelKey"
                      class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                    >
                      Đang chọn
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in metricRows" :key="row.key">
                <td class="px-5 py-4">
                  <p class="font-semibold text-slate-800">{{ row.label }}</p>
                  <p class="text-xs text-slate-500">{{ row.description }}</p>
                </td>
                <td
                  v-for="model in metricsComparison"
                  :key="`${model.key}-${row.key}`"
                  class="px-5 py-4 text-center text-lg font-bold text-slate-900"
                  :class="model.key === bestModelKey ? 'bg-emerald-50/60 text-emerald-700' : ''"
                >
                  {{ formatPercent(model[row.key]) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            Nguồn metrics: {{ summary?.metricsPath || summary?.files?.metrics || '—' }}
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
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob'

const router = useRouter()
const toast = useToastStore()

const summary = ref(null)
const loading = ref(true)
const exportLoading = ref(false)

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
    const sumRes = await api.get('/admin/recommendation/summary')
    if (sumRes.data?.success) {
      summary.value = sumRes.data.data
      if (showToastSuccess) {
        toast.showToast('Làm mới dữ liệu thành công!', 'success')
      }
    }
  } catch (err) {
    console.error('Error loading recommendation data:', err)
    toast.showToast('Không thể tải dữ liệu recommendation', 'error')
  } finally {
    loading.value = false
  }
}

const metricsComparison = computed(() => summary.value?.metricsComparison || [])

const bestModelKey = computed(() => {
  const models = metricsComparison.value
  if (!models.length) return null

  // Check backend strategy
  const currentStrategy = summary.value?.strategy || ''
  const matchedModel = models.find(m => currentStrategy.includes(m.key))
  if (matchedModel) return matchedModel.key

  // Fallback to highest NDCG@10
  return [...models].sort((a, b) => {
    const av = Number(a.ndcgAt10 || 0)
    const bv = Number(b.ndcgAt10 || 0)
    return bv - av
  })[0]?.key
})

const metricRows = computed(() => [
  {
    key: 'precisionAt10',
    label: 'Precision@10',
    description: 'Tỷ lệ bài được gợi ý đúng trong top 10'
  },
  {
    key: 'recallAt10',
    label: 'Recall@10',
    description: 'Mức độ bao phủ bài đúng trong tập kiểm thử'
  },
  {
    key: 'ndcgAt10',
    label: 'NDCG@10',
    description: 'Chất lượng thứ tự xếp hạng'
  },
  {
    key: 'coverageAt20',
    label: 'Coverage@20',
    description: 'Độ phủ danh mục bài hát'
  },
  {
    key: 'mapAt10',
    label: 'MAP@10',
    description: 'Độ chính xác trung bình nếu có'
  }
])

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

async function exportReport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/recommendation/export', { responseType: 'blob' })
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'recommendation_metrics_report.json'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    console.error('Export error:', error)
    if (error.response?.status === 404) {
      toast.showToast('Không tìm thấy báo cáo', 'error')
    } else {
      toast.showToast('Không thể xuất báo cáo. Vui lòng thử lại.', 'error')
    }
  } finally {
    exportLoading.value = false
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
  const strategyLabelMap = {
    bpr_mf_rerank: 'BPR-MF cá nhân hóa',
    bpr_mf: 'BPR-MF',
    content_based_fallback: 'Fallback theo nội dung',
    popular_fallback: 'Fallback phổ biến',
    cold_start_preferences: 'Dựa trên sở thích ban đầu'
  }
  return strategyLabelMap[str] || str
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }

  const numeric = Number(value)
  const percent = numeric <= 1 ? numeric * 100 : numeric

  return `${percent.toFixed(2)}%`
}

function formatPath(fullPath) {
  if (!fullPath) return 'Không có'
  const parts = fullPath.split(/[/\\]/)
  if (parts.length <= 3) return fullPath
  return '.../' + parts.slice(-3).join('/')
}
</script>

<style scoped>
/* Scoped styles have been removed in favor of Tailwind CSS utility classes */
</style>
