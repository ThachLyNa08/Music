<template>
  <div class="flex-1 flex flex-col relative full-bleed min-h-0 pb-10">
    <!-- Header -->
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm mb-6">
      <div class="flex items-center justify-between gap-4 w-full">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Stem Jobs</h1>
          <p class="text-gray-500 mt-1 text-sm font-medium">Theo dõi tiến trình tách vocal/instrumental phục vụ tính năng Karaoke</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Làm mới" @click="fetchData">
            <MfIcon name="sync" size="20" :class="{ 'animate-spin': loadingSummary || loadingList }" />
          </button>
          <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Xuất báo cáo" @click="exportReport">
            <MfIcon name="download" size="20" />
          </button>
        </div>
      </div>
    </header>

    <div class="px-6 flex flex-col space-y-6">
      <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <AdminKpiCard
        title="Tổng Job"
        :value="summary?.total || 0"
        icon="analytics"
        tone="blue"
        :loading="loadingSummary"
        :showIcon="false"
        compact
      />
      <AdminKpiCard
        title="Đang chờ (Pending)"
        :value="summary?.pending || 0"
        icon="timer"
        tone="amber"
        :loading="loadingSummary"
        :showIcon="false"
        compact
      />
      <AdminKpiCard
        title="Đang xử lý (Processing)"
        :value="summary?.processing || 0"
        icon="sync"
        tone="blue"
        :loading="loadingSummary"
        :showIcon="false"
        compact
      />
      <AdminKpiCard
        title="Hoàn thành"
        :value="summary?.completed || 0"
        :subtitle="summary?.missingFiles > 0 ? `Thiếu ${summary.missingFiles} file` : ''"
        icon="check_circle"
        :tone="summary?.missingFiles > 0 ? 'amber' : 'green'"
        :loading="loadingSummary"
        :showIcon="false"
        compact
      />
      <AdminKpiCard
        title="Lỗi (Failed)"
        :value="summary?.failed || 0"
        icon="error"
        tone="red"
        :loading="loadingSummary"
        :showIcon="false"
        compact
      />
    </div>

    <!-- Main Content -->
    <div class="flex flex-col gap-3">
      <AdminFilterBar class="!mb-0">
        <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
          <div class="relative min-w-[320px] flex-1">
            <MfIcon
              name="search"
              class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              v-model="filters.q"
              type="text"
              placeholder="Tìm theo tên bài hát, ca sĩ..."
              class="h-10 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              @input="debounceSearch"
              @focus="showHistory = true"
              @blur="onSearchBlur"
              @keyup.enter="handleEnterSearch"
            />

            <!-- Nút Xóa (Clear) -->
            <button
              v-if="filters.q"
              @click="clearSearch"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full p-1"
              title="Xóa tìm kiếm"
            >
              <MfIcon name="close" size="14" />
            </button>

            <!-- Lịch sử tìm kiếm Dropdown -->
            <div 
              v-if="showHistory && searchHistory.length > 0" 
              class="absolute left-0 right-0 top-[calc(100%+8px)] bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden"
            >
              <div class="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 flex justify-between items-center border-b border-slate-100">
                <span>Lịch sử tìm kiếm</span>
                <button @click.stop="clearHistory" class="text-violet-600 hover:text-violet-700 transition-colors">Xóa tất cả</button>
              </div>
              <ul class="max-h-64 overflow-y-auto">
                <li 
                  v-for="term in searchHistory" 
                  :key="term"
                  @click="selectHistory(term)"
                  class="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors group"
                >
                  <MfIcon name="history" size="16" class="text-slate-400" />
                  <span class="flex-1 truncate">{{ term }}</span>
                  <button @click.stop="removeHistoryItem(term)" class="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all p-1 rounded-md hover:bg-rose-50" title="Xóa">
                    <MfIcon name="close" size="14" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <select
            v-model="filters.status"
            class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 xl:w-56 xl:shrink-0 cursor-pointer"
            @change="handleSearch"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            title="Làm mới"
            @click="resetFilters"
            :disabled="loadingList"
          >
            <MfIcon name="refresh" class="h-4 w-4" />
          </button>
        </div>
      </AdminFilterBar>

      <div class="flex flex-col gap-3">
        <!-- Table -->
      <AdminTableShell 
        :loading="loadingList" 
        :empty="!loadingList && items.length === 0" 
        emptyTitle="Chưa có job tách stem nào" 
        emptySubtitle="Chưa có bài hát nào được đưa vào hàng đợi."
        maxHeight="440px"
        class="h-[440px] !flex-none"
      >
        <table class="w-full text-left border-separate border-spacing-0 whitespace-nowrap table-fixed min-w-[1000px]">
          <thead class="bg-slate-50">
            <tr class="text-xs text-slate-900 uppercase tracking-wider font-bold">
              <th class="p-4 font-semibold w-16 sticky top-0 bg-slate-50 z-10 border-b border-slate-200">ID</th>
              <th class="p-4 font-semibold sticky top-0 bg-slate-50 z-10 border-b border-slate-200">Bài hát</th>
              <th class="p-4 font-semibold text-center w-32 sticky top-0 bg-slate-50 z-10 border-b border-slate-200">Trạng thái</th>
              <th class="p-4 font-semibold w-36 sticky top-0 bg-slate-50 z-10 border-b border-slate-200">File Stems</th>
              <th class="p-4 font-semibold w-44 sticky top-0 bg-slate-50 z-10 border-b border-slate-200">Cập nhật lúc</th>
              <th class="p-4 font-semibold w-48 sticky top-0 bg-slate-50 z-10 border-b border-slate-200">Lỗi (nếu có)</th>
              <th class="p-4 font-semibold text-center w-28 sticky right-0 top-0 bg-slate-50 z-30 border-b border-slate-200 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="item in items" :key="item.stem_id" class="hover:bg-slate-50 transition-colors group">
              <td class="p-4 text-sm font-medium text-slate-500 border-b border-slate-100">#{{ item.stem_id }}</td>
              <td class="p-4 border-b border-slate-100">
                <div class="flex items-center gap-3">
                  <img v-if="item.cover_url" :src="item.cover_url" class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0" alt="" />
                  <div v-else class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <MfIcon name="music_note" class="text-slate-400" size="18" />
                  </div>
                  <div class="min-w-0 max-w-[250px]">
                    <div class="font-bold text-slate-900 text-sm truncate" :title="item.title">{{ item.title }}</div>
                    <div class="text-xs text-slate-500 truncate" :title="item.artist_name">{{ item.artist_name }}</div>
                  </div>
                </div>
              </td>
              <td class="p-4 text-center border-b border-slate-100">
                <div class="flex flex-col items-center gap-1.5">
                  <span :class="getStatusBadgeClass(item.status)" class="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-md uppercase border">
                    {{ item.status }}
                  </span>
                  <div v-if="item.status === 'pending' && isPendingLong(item.updated_at)" 
                       class="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 cursor-help"
                       title="Job đã nằm trong hàng chờ lâu. Hãy kiểm tra AI service hoặc worker xử lý stem.">
                    <MfIcon name="warning" size="12" /> Pending lâu
                  </div>
                </div>
              </td>
              <td class="p-4 text-xs border-b border-slate-100">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center gap-1.5" :class="item.has_vocals_file ? 'text-emerald-600' : 'text-slate-400'">
                    <MfIcon :name="item.has_vocals_file ? 'check_circle' : 'cancel'" size="14" /> 
                    <span>Vocals</span>
                  </div>
                  <div class="flex items-center gap-1.5" :class="item.has_instrumental_file ? 'text-emerald-600' : 'text-slate-400'">
                    <MfIcon :name="item.has_instrumental_file ? 'check_circle' : 'cancel'" size="14" /> 
                    <span>Instrumental</span>
                  </div>
                  <div v-if="item.status === 'completed' && (!item.has_vocals_file || !item.has_instrumental_file)" 
                       class="text-[10px] text-amber-700 font-bold mt-1 bg-amber-50 px-1.5 py-0.5 rounded w-fit border border-amber-200 inline-flex items-center gap-1">
                    <MfIcon name="warning" size="12" /> Thiếu file
                  </div>
                </div>
              </td>
              <td class="p-4 text-xs text-slate-600 border-b border-slate-100">
                <div v-if="item.completed_at" class="flex items-center gap-1.5 text-slate-500" title="Hoàn thành lúc">
                  <MfIcon name="check_circle" size="14" class="text-emerald-500 shrink-0" />
                  <span class="truncate">{{ formatDate(item.completed_at) }}</span>
                </div>
                <div v-else class="flex items-center gap-1.5 text-slate-500" title="Cập nhật lúc">
                  <MfIcon name="update" size="14" class="text-slate-400 shrink-0" />
                  <span class="truncate">{{ formatDate(item.updated_at) }}</span>
                </div>
              </td>
              <td class="p-4 text-xs border-b border-slate-100">
                <div v-if="item.error_message" class="flex items-start gap-1 group/error">
                  <div class="text-rose-600 max-w-[200px] truncate" :title="item.error_message">
                    {{ item.error_message }}
                  </div>
                  <button @click="copyPath(item.error_message)" class="text-slate-400 hover:text-slate-600 opacity-0 group-hover/error:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100" title="Copy chi tiết lỗi">
                    <MfIcon name="content_copy" size="12" />
                  </button>
                </div>
                <span v-else class="text-slate-400 italic">-</span>
              </td>
              <td class="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] border-b border-slate-100">
                <div class="flex justify-center">
                  <AdminActionMenu :actions="getJobActions(item)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>
      
      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1 || items.length > 0" class="flex justify-between items-center px-2">
        <div class="text-sm text-slate-500 font-medium">
          Tổng số: <span class="font-bold text-slate-700">{{ pagination.total }}</span> job
        </div>
        <AdminPagination 
          :currentPage="pagination.page" 
          :totalPages="pagination.totalPages" 
          :limit="pagination.limit"
          @update:currentPage="changePage"
        />
      </div>
      </div>
    </div>
  </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog 
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      confirmText="Thử lại (Retry)"
      type="warning"
      :loading="confirmState.loading"
      @confirm="executeRetry"
      @cancel="confirmState.open = false"
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
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'

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

const showHistory = ref(false)
const searchHistory = ref([])
const HISTORY_KEY = 'admin_stem_jobs_search_history'

onMounted(() => {
  fetchData()
  const history = localStorage.getItem(HISTORY_KEY)
  if (history) {
    try {
      searchHistory.value = JSON.parse(history)
    } catch (e) {}
  }
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

function exportReport() {
  toast.showToast('Chức năng xuất báo cáo đang được hoàn thiện', 'info')
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

let searchTimeout = null
function debounceSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    handleSearch()
  }, 400)
}

function saveSearchHistory(term) {
  if (!term || !term.trim()) return
  const q = term.trim()
  const idx = searchHistory.value.indexOf(q)
  if (idx !== -1) {
    searchHistory.value.splice(idx, 1)
  }
  searchHistory.value.unshift(q)
  if (searchHistory.value.length > 8) { // Lưu tối đa 8 lịch sử
    searchHistory.value.pop()
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
}

function handleEnterSearch() {
  showHistory.value = false
  saveSearchHistory(filters.q)
  handleSearch()
}

function onSearchBlur() {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

function selectHistory(term) {
  filters.q = term
  showHistory.value = false
  saveSearchHistory(term)
  handleSearch()
}

function clearSearch() {
  filters.q = ''
  showHistory.value = false
  handleSearch()
}

function clearHistory() {
  searchHistory.value = []
  localStorage.removeItem(HISTORY_KEY)
}

function removeHistoryItem(term) {
  searchHistory.value = searchHistory.value.filter(t => t !== term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
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
    case 'pending': return 'bg-amber-50 text-amber-600 border-amber-200'
    case 'processing': return 'bg-blue-50 text-blue-600 border-blue-200'
    case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-200'
    case 'failed': return 'bg-rose-50 text-rose-600 border-rose-200'
    default: return 'bg-slate-50 text-slate-600 border-slate-200'
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

function isPendingLong(updatedAt) {
  if (!updatedAt) return false
  const updatedTime = new Date(updatedAt).getTime()
  const now = new Date().getTime()
  return (now - updatedTime) > 10 * 60 * 1000 // > 10 minutes
}

function goToSong(id) {
  router.push(`/admin/songs/${id}`)
}

function copyPath(text) {
  navigator.clipboard.writeText(text)
  toast.showToast('Đã copy đường dẫn', 'success')
}

function getJobActions(item) {
  const actions = [
    {
      label: 'Mở bài hát',
      icon: 'open_in_new',
      onClick: () => goToSong(item.song_id)
    }
  ]
  
  if (item.vocals_url) {
    actions.push({
      label: 'Copy Vocals',
      icon: 'copy',
      onClick: () => copyPath(item.vocals_url)
    })
  }
  
  if (item.instrumental_url) {
    actions.push({
      label: 'Copy Instrumental',
      icon: 'copy',
      onClick: () => copyPath(item.instrumental_url)
    })
  }
  
  if (item.status === 'failed') {
    actions.push({
      label: 'Retry Job',
      icon: 'refresh',
      danger: true,
      onClick: () => requestRetry(item)
    })
  } else if (item.status === 'pending' && isPendingLong(item.updated_at)) {
    actions.push({
      label: 'Retry Job',
      icon: 'refresh',
      danger: false,
      onClick: () => requestRetry(item)
    })
  }
  
  return actions
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
