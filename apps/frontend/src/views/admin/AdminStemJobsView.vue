<template>
  <div class="admin-stem-jobs pb-10">
    <!-- Header -->
    <div class="header-section mb-6 flex justify-between items-start">
      <div>
        <h1 class="page-title text-2xl font-bold text-slate-800">Stem Jobs</h1>
        <p class="page-subtitle text-sm text-slate-500 mt-1">
          Theo dõi tiến trình tách vocal/instrumental phục vụ tính năng Karaoke
        </p>
      </div>
      <div class="header-actions flex gap-2">
        <button class="btn-secondary btn-icon" title="Làm mới" @click="fetchData">
          <MfIcon name="sync" size="20" :class="{ 'animate-spin': loadingSummary || loadingList }" />
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div class="kpi-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div class="text-sm font-semibold text-slate-500 mb-1">Tổng Job</div>
        <div class="text-2xl font-bold text-slate-800">
          <span v-if="!loadingSummary">{{ summary?.total || 0 }}</span>
          <div v-else class="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
        </div>
      </div>
      <div class="kpi-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-400">
        <div class="text-sm font-semibold text-slate-500 mb-1">Đang chờ (Pending)</div>
        <div class="text-2xl font-bold text-amber-600">
          <span v-if="!loadingSummary">{{ summary?.pending || 0 }}</span>
          <div v-else class="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
        </div>
      </div>
      <div class="kpi-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-400">
        <div class="text-sm font-semibold text-slate-500 mb-1">Đang xử lý (Processing)</div>
        <div class="text-2xl font-bold text-blue-600">
          <span v-if="!loadingSummary">{{ summary?.processing || 0 }}</span>
          <div v-else class="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
        </div>
      </div>
      <div class="kpi-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-400">
        <div class="text-sm font-semibold text-slate-500 mb-1">Hoàn thành</div>
        <div class="text-2xl font-bold text-emerald-600 flex items-center gap-2">
          <span v-if="!loadingSummary">{{ summary?.completed || 0 }}</span>
          <div v-else class="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
          
          <span v-if="!loadingSummary && summary?.missingFiles > 0" class="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-semibold" title="Thiếu file vật lý trên đĩa">
            -{{ summary.missingFiles }} file
          </span>
        </div>
      </div>
      <div class="kpi-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-rose-400">
        <div class="text-sm font-semibold text-slate-500 mb-1">Lỗi (Failed)</div>
        <div class="text-2xl font-bold text-rose-600">
          <span v-if="!loadingSummary">{{ summary?.failed || 0 }}</span>
          <div v-else class="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
      <div class="search-box flex-1 min-w-[200px] relative">
        <MfIcon name="search" size="20" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          v-model="filters.q" 
          placeholder="Tìm theo tên bài hát hoặc nghệ sĩ..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm"
          @keyup.enter="handleSearch"
        />
      </div>
      
      <select v-model="filters.status" class="py-2 px-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm bg-white min-w-[150px]" @change="handleSearch">
        <option value="all">Tất cả trạng thái</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
      
      <button class="btn-primary" @click="handleSearch" :disabled="loadingList">
        Tìm kiếm
      </button>
      <button class="btn-secondary" @click="resetFilters" :disabled="loadingList">
        Xóa lọc
      </button>
    </div>

    <!-- Job Table -->
    <div class="card bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div class="table-container p-0 min-h-[300px] relative">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-xs text-slate-900 uppercase tracking-wider">
              <th class="p-4 font-semibold w-16">ID</th>
              <th class="p-4 font-semibold min-w-[250px]">Bài hát</th>
              <th class="p-4 font-semibold text-center">Trạng thái</th>
              <th class="p-4 font-semibold min-w-[150px]">File Stems</th>
              <th class="p-4 font-semibold">Cập nhật lúc</th>
              <th class="p-4 font-semibold min-w-[150px]">Lỗi (nếu có)</th>
              <th class="p-4 font-semibold text-center w-24 whitespace-nowrap">Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingList && items.length === 0">
              <td colspan="7" class="p-8 text-center text-slate-400">
                <div class="flex justify-center mb-2"><div class="spinner small"></div></div>
                Đang tải dữ liệu...
              </td>
            </tr>
            <tr v-else-if="!loadingList && items.length === 0">
              <td colspan="7" class="p-12 text-center">
                <MfIcon name="queue_music" size="48" class="text-slate-300 mx-auto mb-3" />
                <p class="text-slate-500 font-medium">Chưa có job tách stem nào.</p>
              </td>
            </tr>
            <tr v-else v-for="item in items" :key="item.stem_id" class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
              <td class="p-4 text-sm font-medium text-slate-500">#{{ item.stem_id }}</td>
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <img v-if="item.cover_url" :src="item.cover_url" class="w-10 h-10 rounded-md object-cover shadow-sm" alt="" />
                  <div v-else class="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
                    <MfIcon name="music_note" class="text-slate-400" size="18" />
                  </div>
                  <div class="max-w-[200px]">
                    <div class="font-semibold text-slate-800 text-sm truncate" :title="item.title">{{ item.title }}</div>
                    <div class="text-xs text-slate-500 truncate" :title="item.artist_name">{{ item.artist_name }}</div>
                  </div>
                </div>
              </td>
              <td class="p-4 text-center">
                <span :class="getStatusBadgeClass(item.status)" class="inline-block px-2.5 py-1 text-xs font-bold rounded-md uppercase border">
                  {{ item.status }}
                </span>
              </td>
              <td class="p-4 text-xs">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1.5" :class="item.has_vocals_file ? 'text-emerald-600' : 'text-slate-400'">
                    <MfIcon :name="item.has_vocals_file ? 'check_circle' : 'cancel'" size="14" /> 
                    <span>Vocals</span>
                  </div>
                  <div class="flex items-center gap-1.5" :class="item.has_instrumental_file ? 'text-emerald-600' : 'text-slate-400'">
                    <MfIcon :name="item.has_instrumental_file ? 'check_circle' : 'cancel'" size="14" /> 
                    <span>Instrumental</span>
                  </div>
                  <div v-if="item.status === 'completed' && (!item.has_vocals_file || !item.has_instrumental_file)" 
                       class="text-[10px] text-rose-500 font-semibold mt-1 bg-rose-50 px-1 py-0.5 rounded w-fit border border-rose-100">
                    ⚠️ Thiếu file
                  </div>
                </div>
              </td>
              <td class="p-4 text-xs text-slate-600">
                <div v-if="item.completed_at" title="Hoàn thành lúc">
                  <MfIcon name="check_circle" size="12" class="text-emerald-500 mr-1 align-text-bottom" />
                  {{ formatDate(item.completed_at) }}
                </div>
                <div v-else title="Cập nhật lúc">
                  <MfIcon name="update" size="12" class="text-slate-400 mr-1 align-text-bottom" />
                  {{ formatDate(item.updated_at) }}
                </div>
              </td>
              <td class="p-4 text-xs">
                <div v-if="item.error_message" class="text-rose-600 max-w-[200px] truncate" :title="item.error_message">
                  {{ item.error_message }}
                </div>
                <span v-else class="text-slate-400 italic">-</span>
              </td>
              <td class="p-4 text-center">
                <!-- Simple Dropdown trigger -->
                <div class="relative group inline-block text-left">
                  <button class="p-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
                    <MfIcon name="more_vert" size="20" />
                  </button>
                  <div class="dropdown-menu absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                    <div class="p-1 flex flex-col gap-1 text-sm text-slate-700">
                      <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2" @click="goToSong(item.song_id)">
                        <MfIcon name="open_in_new" size="16" class="text-slate-400" /> Mở bài hát
                      </button>
                      <button v-if="item.vocals_url" class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2" @click="copyPath(item.vocals_url)">
                        <MfIcon name="content_copy" size="16" class="text-slate-400" /> Copy Vocals
                      </button>
                      <button v-if="item.instrumental_url" class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2" @click="copyPath(item.instrumental_url)">
                        <MfIcon name="content_copy" size="16" class="text-slate-400" /> Copy Instru
                      </button>
                      <div v-if="item.status === 'failed'" class="h-px bg-slate-100 my-1"></div>
                      <button v-if="item.status === 'failed'" class="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium" @click="requestRetry(item)">
                        <MfIcon name="replay" size="16" /> Retry Job
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center">
        <div class="text-sm text-slate-500 mr-auto font-medium">
          Tổng số: {{ pagination.total }} job
        </div>
        <AdminPagination 
          :currentPage="pagination.page" 
          :totalPages="pagination.totalPages" 
          :disabled="loadingList"
          @update:currentPage="changePage"
        />
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog 
      v-model:open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      confirmText="Thử lại (Retry)"
      type="warning"
      :loading="confirmState.loading"
      @confirm="executeRetry"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import MfIcon from '@/components/common/MfIcon.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'

const router = useRouter()
const toast = useToastStore()

const loadingSummary = ref(false)
const loadingList = ref(false)
const summary = ref(null)
const items = ref([])
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

const filters = reactive({
  q: '',
  status: 'all'
})

const confirmState = reactive({
  open: false,
  loading: false,
  title: 'Xác nhận Retry Job',
  message: '',
  jobId: null
})

onMounted(() => {
  fetchSummary()
  fetchList()
})

async function fetchSummary() {
  loadingSummary.value = true
  try {
    const res = await api.get('/admin/stem-jobs/summary')
    if (res.data?.success) {
      summary.value = res.data.data
    }
  } catch (err) {
    console.error(err)
    toast.showToast('Lỗi khi tải tóm tắt job', 'error')
  } finally {
    loadingSummary.value = false
  }
}

async function fetchList() {
  loadingList.value = true
  try {
    const res = await api.get('/admin/stem-jobs', {
      params: {
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status,
        q: filters.q
      }
    })
    if (res.data?.success) {
      items.value = res.data.data.items
      Object.assign(pagination, res.data.data.pagination)
    }
  } catch (err) {
    console.error(err)
    toast.showToast('Lỗi khi tải danh sách job', 'error')
  } finally {
    loadingList.value = false
  }
}

function fetchData() {
  fetchSummary()
  fetchList()
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetFilters() {
  filters.q = ''
  filters.status = 'all'
  pagination.page = 1
  fetchList()
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.totalPages) {
    pagination.page = newPage
    fetchList()
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'failed': return 'bg-rose-100 text-rose-700 border-rose-200'
    default: return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function goToSong(id) {
  router.push(`/admin/songs/${id}`)
}

function copyPath(text) {
  navigator.clipboard.writeText(text)
  toast.showToast('Đã copy đường dẫn', 'success')
}

function requestRetry(job) {
  confirmState.jobId = job.stem_id
  confirmState.message = `Bạn có chắc chắn muốn chạy lại quá trình tách nhạc cho bài "${job.title}" không?`
  confirmState.open = true
}

async function executeRetry() {
  if (!confirmState.jobId) return
  
  confirmState.loading = true
  try {
    const res = await api.post(`/admin/stem-jobs/${confirmState.jobId}/retry`)
    if (res.data?.success) {
      toast.showToast(res.data.message || 'Retry thành công', 'success')
      confirmState.open = false
      // Refresh after small delay to let DB settle if needed
      setTimeout(() => {
        fetchData()
      }, 500)
    } else {
      toast.showToast(res.data?.message || 'Có lỗi xảy ra', 'error')
    }
  } catch (err) {
    console.error(err)
    toast.showToast(err.response?.data?.message || 'Lỗi kết nối khi retry', 'error')
  } finally {
    confirmState.loading = false
  }
}
</script>

<style scoped>
.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  height: 40px;
}
.btn-primary {
  background: #6c5ce7;
  color: white;
  border: none;
}
.btn-primary:hover:not(:disabled) { background: #5a4bcf; }
.btn-primary:disabled { background: #a5a5a5; cursor: not-allowed; }

.btn-secondary {
  background: white;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:hover:not(:disabled) { background: #f8fafc; }
.btn-icon {
  padding: 0;
  width: 40px;
  justify-content: center;
}

/* Spinner */
.spinner {
  border: 3px solid rgba(108, 92, 231, 0.1);
  border-left-color: #6c5ce7;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}
.spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.dropdown-menu {
  top: 100%;
}
</style>
