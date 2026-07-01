<template>
  <div class="space-y-6 pb-10">
    <!-- Header -->
    <header class="flex flex-col md:flex-row items-start md:items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Stem Jobs</h1>
        <p class="text-gray-500 mt-1 text-sm font-medium">Theo dõi tiến trình tách vocal/instrumental phục vụ tính năng Karaoke</p>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Làm mới" @click="fetchData">
          <MfIcon name="sync" size="20" :class="{ 'animate-spin': loadingSummary || loadingList }" />
        </button>
      </div>
    </header>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <AdminKpiCard
        title="Tổng Job"
        :value="summary?.total || 0"
        icon="analytics"
        tone="blue"
        :loading="loadingSummary"
      />
      <AdminKpiCard
        title="Đang chờ (Pending)"
        :value="summary?.pending || 0"
        icon="timer"
        tone="amber"
        :loading="loadingSummary"
      />
      <AdminKpiCard
        title="Đang xử lý (Processing)"
        :value="summary?.processing || 0"
        icon="sync"
        tone="blue"
        :loading="loadingSummary"
      />
      <AdminKpiCard
        title="Hoàn thành"
        :value="summary?.completed || 0"
        :subtitle="summary?.missingFiles > 0 ? `Thiếu ${summary.missingFiles} file` : ''"
        icon="check_circle"
        :tone="summary?.missingFiles > 0 ? 'amber' : 'green'"
        :loading="loadingSummary"
      />
      <AdminKpiCard
        title="Lỗi (Failed)"
        :value="summary?.failed || 0"
        icon="error"
        tone="red"
        :loading="loadingSummary"
      />
    </div>

    <!-- Main Content -->
    <div class="flex flex-col gap-6">
      <!-- Filters -->
      <AdminFilterBar>
        <div class="relative flex-1 min-w-[200px]">
          <MfIcon name="search" size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            v-model="filters.q" 
            placeholder="Tìm theo tên bài hát hoặc nghệ sĩ..." 
            class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            @keyup.enter="handleSearch"
          />
        </div>
        
        <select v-model="filters.status" class="py-2 px-3 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm bg-white min-w-[150px]" @change="handleSearch">
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        
        <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap disabled:bg-slate-400" @click="handleSearch" :disabled="loadingList">
          Tìm kiếm
        </button>
        <button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition whitespace-nowrap disabled:text-slate-400" @click="resetFilters" :disabled="loadingList">
          Xóa lọc
        </button>
      </AdminFilterBar>

      <!-- Table -->
      <AdminTableShell 
        :loading="loadingList" 
        :empty="!loadingList && items.length === 0" 
        emptyTitle="Chưa có job tách stem nào" 
        emptySubtitle="Chưa có bài hát nào được đưa vào hàng đợi."
      >
        <table class="w-full text-left border-collapse whitespace-nowrap">
          <thead class="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
            <tr class="text-xs text-slate-500 uppercase tracking-wider">
              <th class="p-4 font-semibold w-16">ID</th>
              <th class="p-4 font-semibold min-w-[250px]">Bài hát</th>
              <th class="p-4 font-semibold text-center w-28">Trạng thái</th>
              <th class="p-4 font-semibold w-40">File Stems</th>
              <th class="p-4 font-semibold w-40">Cập nhật lúc</th>
              <th class="p-4 font-semibold min-w-[150px] max-w-[250px]">Lỗi (nếu có)</th>
              <th class="p-4 font-semibold text-center w-24 sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in items" :key="item.stem_id" class="hover:bg-slate-50 transition-colors group">
              <td class="p-4 text-sm font-medium text-slate-500">#{{ item.stem_id }}</td>
              <td class="p-4">
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
              <td class="p-4 text-center">
                <span :class="getStatusBadgeClass(item.status)" class="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-md uppercase border">
                  {{ item.status }}
                </span>
              </td>
              <td class="p-4 text-xs">
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
              <td class="p-4 text-xs text-slate-600">
                <div v-if="item.completed_at" class="flex items-center gap-1.5 text-slate-500" title="Hoàn thành lúc">
                  <MfIcon name="check_circle" size="14" class="text-emerald-500 shrink-0" />
                  <span class="truncate">{{ formatDate(item.completed_at) }}</span>
                </div>
                <div v-else class="flex items-center gap-1.5 text-slate-500" title="Cập nhật lúc">
                  <MfIcon name="update" size="14" class="text-slate-400 shrink-0" />
                  <span class="truncate">{{ formatDate(item.updated_at) }}</span>
                </div>
              </td>
              <td class="p-4 text-xs">
                <div v-if="item.error_message" class="text-rose-600 max-w-[200px] truncate" :title="item.error_message">
                  {{ item.error_message }}
                </div>
                <span v-else class="text-slate-400 italic">-</span>
              </td>
              <td class="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
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
  fetchData()
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
