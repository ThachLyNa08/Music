<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10">
    <header class="sticky -top-6 z-30 py-6 bg-white dark:bg-bg-surface border-b border-gray-100 dark:border-bg-border flex flex-col md:flex-row justify-between items-start md:items-center px-6 shrink-0 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Lịch sử Giao dịch</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Theo dõi lịch sử thanh toán hóa đơn nâng cấp Premium và doanh thu hệ thống</p>
      </div>
      <div class="flex items-center gap-3 mt-4 md:mt-0">
        <button class="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition" @click="fetchData(true)" title="Làm mới">
          <MfIcon name="sync" size="18" :class="{'fa-spin': loading}" class="mr-2" />
          Làm mới
        </button>
        <AdminExportButton :loading="exportLoading" @click="handleExport" />
      </div>
    </header>
    <div class="p-6 flex flex-col gap-4">
      <!-- Overview Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
      <AdminKpiCard 
        title="Tổng Doanh thu" 
        :value="formatCurrency(summary.totalRevenue)" 
        icon="payments" 
        tone="emerald" 
        :loading="loadingSummary"
        :show-icon="false"
      />
      <AdminKpiCard 
        title="Số Giao dịch" 
        :value="summary.totalTransactions" 
        icon="receipt_long" 
        tone="blue" 
        :loading="loadingSummary"
        :show-icon="false"
      />
      <AdminKpiCard 
        title="Đã thanh toán" 
        :value="summary.paidTransactions" 
        icon="check_circle" 
        tone="emerald" 
        :loading="loadingSummary"
        :show-icon="false"
      />
      <AdminKpiCard 
        title="Chờ xử lý / Thất bại" 
        :value="summary.pendingTransactions + summary.expiredTransactions + summary.cancelledTransactions" 
        icon="clock" 
        tone="amber" 
        :loading="loadingSummary"
        :show-icon="false"
      >
        <template #subtext v-if="!loadingSummary">
          <span class="text-amber-600 font-bold">{{ summary.pendingTransactions }}</span> chờ &middot; <span class="text-slate-500 font-bold">{{ summary.expiredTransactions }}</span> hết hạn &middot; <span class="text-rose-500 font-bold">{{ summary.cancelledTransactions }}</span> đã hủy
        </template>
      </AdminKpiCard>
    </div>

    <!-- Filters & Search -->
    <div v-if="route.query.userId" class="user-filter-chip">
      <span class="chip-text">Đang lọc theo người dùng: {{ filterUserName || 'User ID ' + route.query.userId }}</span>
      <button class="chip-clear" @click="clearUserFilter">
        <MfIcon name="close" size="16" /> Xóa bộ lọc
      </button>
    </div>

    <div>
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center w-full">
        <div class="relative w-full xl:flex-1 xl:min-w-[240px]">
          <MfIcon name="search" size="18" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            v-model="filterForm.q" 
            @input="handleSearchInput"
            @keyup.enter="handleEnter"
            @focus="showHistory = true"
            @blur="handleBlur"
            type="text" 
            placeholder="Tìm mã đơn, khách hàng..." 
            class="admin-input pl-9 pr-8 w-full" 
          />
          <button v-if="filterForm.q" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <MfIcon name="close" size="14" />
          </button>
          
          <!-- History Dropdown -->
          <div v-if="showHistory && searchHistory.length > 0" class="absolute z-50 w-full mt-1 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-lg shadow-lg overflow-hidden animate-fade-in-up">
            <ul>
              <li v-for="item in searchHistory" :key="item" class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group" @mousedown.prevent="selectHistoryItem(item)">
                <div class="flex items-center gap-2 overflow-hidden">
                  <MfIcon name="history" size="14" class="text-gray-400 flex-shrink-0" />
                  <span class="text-sm text-gray-600 dark:text-gray-300 truncate">{{ item }}</span>
                </div>
                <button @mousedown.prevent.stop="removeHistoryItem(item)" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1">
                  <MfIcon name="close" size="12" />
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 w-full xl:w-auto xl:shrink-0">
        <select v-model="filterForm.status" @change="applyFilters" class="admin-input min-w-0 truncate w-full xl:w-40 cursor-pointer">
          <option value="">Tất cả trạng thái</option>
          <option value="paid">Đã thanh toán</option>
          <option value="pending">Đang chờ</option>
          <option value="expired">Hết hạn</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <select v-model="filterForm.gateway" @change="applyFilters" class="admin-input min-w-0 truncate w-full xl:w-36 cursor-pointer">
          <option value="">Tất cả cổng</option>
          <option value="sepay">SePay</option>
          <option value="momo">MoMo</option>
          <option value="vnpay">VNPay</option>
        </select>
        <select v-model="filterForm.plan" @change="applyFilters" class="admin-input min-w-0 truncate w-full xl:w-36 cursor-pointer">
          <option value="">Tất cả gói</option>
          <option value="BASIC">Gói Cơ Bản</option>
          <option value="PLUS">Gói Nâng Cao</option>
          <option value="PREMIUM">Gói Cao Cấp</option>
        </select>
      </div>
      <AdminResetButton :disabled="loading" @click="resetFilters" />
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col mb-8">
      <div v-if="error" class="p-16 flex flex-col items-center justify-center text-rose-500">
        <MfIcon name="error_outline" size="64" />
        <h3 class="text-lg font-bold mt-4 mb-2">Đã có lỗi xảy ra</h3>
        <p class="text-sm mb-4">{{ error }}</p>
        <button @click="fetchData" class="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition font-bold">Thử lại</button>
      </div>
      <AdminTableShell 
        v-else
        :loading="loading" 
        :empty="!loading && transactions.length === 0" 
        emptyTitle="Không tìm thấy giao dịch nào" 
        emptySubtitle="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
        maxHeight="450px"
        class="h-[450px]"
      >
        <table class="w-full text-left border-collapse text-xs whitespace-nowrap table-fixed">
          <thead>
            <tr class="bg-gray-50 dark:bg-bg-card sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[15%]">Mã Đơn hàng</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[25%] truncate">Khách hàng</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[15%]">Gói Premium</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[10%]">Số tiền</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[10%]">Cổng TT</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[12%]">Trạng thái</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white w-[13%]">Thời gian</th>
              <th class="py-3 px-4 font-bold text-black dark:text-white text-right sticky right-0 bg-gray-50 dark:bg-bg-card w-24">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr v-for="(t, index) in transactions" :key="t.id" class="hover:bg-gray-50 dark:hover:bg-bg-card transition-colors group cursor-pointer" @click="openDetail(t.id)">
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-bold text-gray-900 dark:text-white">#{{ truncateCode(t.order_code) }}</span>
                  <button class="text-gray-400 hover:text-indigo-600 transition" @click.stop="copyCode(t.order_code)" title="Sao chép">
                    <MfIcon name="content_copy" size="14" />
                  </button>
                </div>
              </td>
              <td class="py-3 px-4 truncate">
                <div class="flex flex-col hover:opacity-80 transition truncate" @click.stop="goToUser(t.user_id)">
                  <span class="font-bold text-gray-900 dark:text-white text-sm truncate" :title="t.user_name || t.user_email">
                    {{ t.user_name || 'Khách hàng' }}
                  </span>
                  <span class="text-xs text-gray-500 truncate" :title="t.user_email">{{ t.user_email }}</span>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400" v-if="t.plan_name">{{ t.plan_name }}</span>
                <span class="text-gray-400" v-else>—</span>
              </td>
              <td class="py-3 px-4">
                <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(t.amount) }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {{ t.provider || '—' }}
                </span>
              </td>
              <td class="py-3 px-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" :class="t.status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : (t.status === 'pending' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400')">
                  {{ formatStatus(t.status) }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-bold text-gray-700 dark:text-gray-300">{{ formatDate(t.created_at) }}</span>
                  <span class="text-[10px] text-gray-500">{{ formatTime(t.created_at) }}</span>
                  <span class="text-[10px] text-emerald-600 font-bold" v-if="t.paid_at && t.status === 'paid'">
                    TT: {{ formatTime(t.paid_at) }}
                  </span>
                </div>
              </td>
              <td class="py-3 px-4 text-right sticky right-0 bg-white dark:bg-bg-surface group-hover:bg-gray-50 dark:group-hover:bg-bg-card transition-colors" @click.stop>
                <div class="flex justify-end">
                  <AdminActionMenu :actions="getTxActions(t)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>

      <div v-if="totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30 mt-auto">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium hidden md:inline">Trang {{ currentPage }} / {{ totalPages }}</span>
        <AdminPagination v-model:currentPage="currentPage" :totalPages="totalPages" @update:currentPage="onPageChange" />
      </div>
    </div>

    <PaymentDetailModal 
      v-model:isOpen="detailModalOpen" 
      :paymentId="selectedPaymentId" 
    />

    <ConfirmDialog 
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirmText="confirmState.confirmText"
      :type="confirmState.type"
      :loading="confirmState.loading"
      @confirm="handleConfirm"
      @cancel="confirmState.open = false"
    />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import AdminExportButton from '@/components/admin/AdminExportButton.vue'
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob'
import PaymentDetailModal from '@/components/admin/PaymentDetailModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'

import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import MfIcon from '@/components/common/MfIcon.vue'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const loading = ref(true)
const loadingSummary = ref(true)
const error = ref(null)
const transactions = ref([])
const summary = ref({
  totalTransactions: 0,
  paidTransactions: 0,
  pendingTransactions: 0,
  expiredTransactions: 0,
  cancelledTransactions: 0,
  totalRevenue: 0
})

const filterForm = reactive({
  q: '',
  gateway: '',
  status: '',
  plan: '',
  dateFrom: '',
  dateTo: ''
})

// Search History State
const showHistory = ref(false)
const searchHistory = ref(JSON.parse(localStorage.getItem('paymentSearchHistory')) || [])
let searchTimeout = null

function saveSearchHistory(term) {
  if (!term || term.trim() === '') return
  const current = searchHistory.value.filter(item => item !== term)
  current.unshift(term)
  if (current.length > 10) current.pop()
  searchHistory.value = current
  localStorage.setItem('paymentSearchHistory', JSON.stringify(current))
}

function handleSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    applyFilters()
  }, 500)
}

function handleEnter() {
  if (searchTimeout) clearTimeout(searchTimeout)
  saveSearchHistory(filterForm.q)
  showHistory.value = false
  applyFilters()
}

function handleBlur() {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

function clearSearch() {
  filterForm.q = ''
  applyFilters()
}

function selectHistoryItem(item) {
  filterForm.q = item
  showHistory.value = false
  applyFilters()
}

function removeHistoryItem(item) {
  searchHistory.value = searchHistory.value.filter(i => i !== item)
  localStorage.setItem('paymentSearchHistory', JSON.stringify(searchHistory.value))
}


const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

const activeDropdown = ref(null)
const detailModalOpen = ref(false)
const selectedPaymentId = ref(null)

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'danger',
  loading: false,
  action: null
})

function getTxActions(t) {
  const actions = [
    {
      label: 'Xem chi tiết',
      icon: 'visibility',
      onClick: () => openDetail(t.id)
    },
    {
      label: 'Mở hồ sơ',
      icon: 'open_in_new',
      onClick: () => goToUser(t.user_id)
    },
    {
      label: 'Sao chép mã',
      icon: 'content_copy',
      onClick: () => copyCode(t.order_code)
    }
  ]
  if (t.status === 'pending') {
    actions.push({
      label: 'Hủy giao dịch',
      icon: 'cancel',
      danger: true,
      onClick: () => cancelTx(t)
    })
  }
  return actions
}

async function fetchData(showToastSuccess = false) {
  await Promise.all([
    fetchSummary(),
    fetchList()
  ])
  if (showToastSuccess === true) {
    toast.showToast('Làm mới dữ liệu thành công!', 'success')
  }
}

function buildQueryParams() {
  const params = {
    page: currentPage.value,
    limit: pageSize.value
  }
  if (filterForm.q) params.q = filterForm.q
  if (filterForm.gateway) params.gateway = filterForm.gateway
  if (filterForm.status) params.status = filterForm.status
  if (filterForm.plan) params.plan = filterForm.plan
  if (filterForm.dateFrom) params.dateFrom = filterForm.dateFrom
  if (filterForm.dateTo) params.dateTo = filterForm.dateTo
  if (route.query.userId) params.userId = route.query.userId
  return params
}

async function fetchSummary() {
  loadingSummary.value = true
  try {
    const params = buildQueryParams()
    const res = await api.get('/admin/payments/summary', { params })
    if (res.data?.success) {
      summary.value = res.data.data
    }
  } catch (err) {
    console.error('Lỗi khi tải summary:', err)
  } finally {
    loadingSummary.value = false
  }
}

async function fetchList() {
  loading.value = true
  error.value = null
  try {
    const params = buildQueryParams()
    const res = await api.get('/admin/payments', { params })
    if (res.data?.success) {
      transactions.value = res.data.data.items || []
      totalItems.value = res.data.data.pagination.total
    }
  } catch (err) {
    console.error('Lỗi khi tải lịch sử giao dịch:', err)
    error.value = 'Không thể tải danh sách giao dịch. Vui lòng thử lại sau.'
  } finally {
    loading.value = false
  }
}

const exportLoading = ref(false)

async function handleExport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/payments/export', {
      params: {
        q: filterForm.q,
        status: filterForm.status,
        gateway: filterForm.gateway,
        userId: route.query.userId || ''
      },
      responseType: 'blob'
    })
    
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'musicflow-payments.csv'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    toast.error('Không thể xuất báo cáo. Vui lòng thử lại.')
  } finally {
    exportLoading.value = false
  }
}

function applyFilters() {
  currentPage.value = 1
  fetchList()
}

function onPageChange(page) {
  currentPage.value = page
  fetchList()
}

function resetFilters() {
  filterForm.q = ''
  filterForm.gateway = ''
  filterForm.status = ''
  filterForm.plan = ''
  
  if (route.query.userId) {
    router.replace({ path: route.path, query: {} }).then(() => {
      applyFilters()
    })
  } else {
    applyFilters()
  }
}

const filterUserName = computed(() => {
  if (transactions.value.length > 0) {
    const user = transactions.value[0];
    return user.user_name || user.user_email;
  }
  return '';
});

function clearUserFilter() {
  router.push('/admin/payments');
}

watch(() => route.query.userId, () => {
  currentPage.value = 1;
  fetchData();
});

function openDetail(id) {
  selectedPaymentId.value = id
  detailModalOpen.value = true
}

function goToUser(userId) {
  router.push(`/admin/users/${userId}`)
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code)
    toast.showToast('Đã sao chép mã đơn hàng', 'success')
  } catch (err) {
    toast.showToast('Không thể sao chép mã', 'error')
  }
}

function cancelTx(t) {
  confirmState.value = {
    open: true,
    title: 'Hủy giao dịch',
    message: `Bạn có chắc muốn hủy giao dịch #${t.order_code}? Hành động này sẽ cập nhật trạng thái đơn thành "Đã hủy" và không thể khôi phục.`,
    confirmText: 'Hủy giao dịch',
    type: 'danger',
    loading: false,
    action: async () => {
      try {
        await api.post(`/admin/payments/${t.id}/cancel`)
        toast.showToast('Đã hủy giao dịch thành công', 'success')
        fetchData()
      } catch (err) {
        toast.showToast(err.response?.data?.message || 'Lỗi khi hủy giao dịch', 'error')
      }
    }
  }
}

async function handleConfirm() {
  if (!confirmState.value.action) return
  confirmState.value.loading = true
  try {
    await confirmState.value.action()
  } finally {
    confirmState.value.open = false
    confirmState.value.loading = false
  }
}

function exportReport() {
  toast.showToast('Chức năng xuất báo cáo đang được hoàn thiện', 'info')
}

// Helpers
function truncateCode(code) {
  if (!code) return ''
  return code.length > 10 ? code.substring(0, 10) + '...' : code
}

function formatCurrency(val) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0)
}

function formatStatus(status) {
  switch (status) {
    case 'paid': return 'Đã thanh toán'
    case 'success': return 'Thành công'
    case 'pending': return 'Đang chờ'
    case 'expired': return 'Hết hạn'
    case 'cancelled': return 'Đã hủy'
    default: return status
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  if (route.query.userId) {
    filterForm.q = ''
  }
  fetchData()
})
</script>

<style scoped>
.manage-transactions {
  padding: 8px 16px;
  font-family: 'Be Vietnam Pro', sans-serif;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
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
  color: #2d3436;
  margin: 0;
}
.page-subtitle {
  color: #636e72;
  margin: 6px 0 0 0;
  font-size: 14px;
  font-weight: 500;
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
.btn-primary:hover { background: #5a4bcf; }
.btn-secondary {
  background: white;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:hover { background: #f8fafc; }
.btn-icon {
  padding: 0;
  width: 40px;
  height: 40px;
  justify-content: center;
}

/* Stats Cards */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}
.summary-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}
.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-icon.revenue { background: rgba(162, 155, 254, 0.12); color: #6c5ce7; }
.card-icon.count { background: rgba(116, 185, 255, 0.12); color: #0984e3; }
.card-icon.paid { background: #ecfdf5; color: #10b981; }
.card-icon.pending { background: #fffbeb; color: #f59e0b; }

.card-info {
  display: flex;
  flex-direction: column;
}
.card-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.card-value {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  margin-top: 4px;
  line-height: 1;
}
.card-subline {
  font-size: 11px;
  margin-top: 6px;
  font-weight: 500;
  color: #64748b;
  white-space: nowrap;
}
.skeleton-text {
  width: 100px;
  height: 24px;
  background: #f1f5f9;
  border-radius: 4px;
  margin-top: 4px;
}
.text-emerald-600 { color: #059669; }
.text-amber-600 { color: #d97706; }

/* Filter bar */
.user-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: #e0e7ff;
  border: 1px solid #c7d2fe;
  padding: 8px 16px;
  border-radius: 20px;
  margin-bottom: 16px;
}
.chip-text {
  font-size: 14px;
  font-weight: 600;
  color: #4338ca;
}
.chip-clear {
  display: flex;
  align-items: center;
  gap: 4px;
  background: white;
  border: 1px solid #c7d2fe;
  color: #4338ca;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.chip-clear:hover { background: #e0e7ff; }

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}
.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 250px;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 16px;
  color: #b2bec3;
}
.search-field {
  width: 100%;
  padding: 10px 16px 10px 48px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  font-size: 14px;
  outline: none;
  background: white;
}
.search-field:focus { border-color: #6366f1; }
.filter-select, .filter-date {
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  font-size: 14px;
  outline: none;
  height: 42px;
}
.filter-select:focus, .filter-date:focus { border-color: #6366f1; }
.filter-select-wrapper { min-width: 160px; }

/* Table */
.table-container {
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #f1f5f9;
}
.transactions-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.transactions-table th {
  padding: 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  color: #000000;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.transactions-table td {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  color: #334155;
  vertical-align: middle;
}
.txn-row:hover { background: #f8fafc; }

.order-code {
  font-family: monospace;
  font-weight: 600;
  color: #475569;
}
.btn-icon-small {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
}
.btn-icon-small:hover { background: #f1f5f9; color: #475569; }

.user-details {
  display: flex;
  flex-direction: column;
}
.user-name { font-weight: 600; color: #0f172a; }
.user-name:hover { color: #6366f1; text-decoration: underline; cursor: pointer; }
.user-email { font-size: 12px; color: #64748b; }

.plan-badge {
  background: #f1f5f9;
  color: #475569;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.amount-val { font-weight: 700; color: #0f172a; }

.provider-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  text-transform: uppercase;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.provider-badge.sepay { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.provider-badge.momo { background: #fdf2f8; color: #be185d; border-color: #fbcfe8; }
.provider-badge.vnpay { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  white-space: nowrap;
}
.status-badge.paid { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.status-badge.success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.status-badge.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.status-badge.expired { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
.status-badge.cancelled { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }

.time-cell { display: flex; flex-direction: column; gap: 2px; }
.time-main { font-weight: 600; color: #334155; }
.time-sub { font-size: 12px; color: #94a3b8; }
.time-paid { font-size: 11px; font-weight: 600; }
.text-right { text-align: right; }
.text-slate-400 { color: #94a3b8; }

/* Actions Menu */
.action-menu-wrapper { position: relative; display: inline-block; }
.btn-action-more {
  width: 32px; height: 32px; border-radius: 50%; border: none;
  background: transparent; color: #64748b; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.btn-action-more:hover { background: #f1f5f9; color: #0f172a; }
.action-dropdown {
  position: absolute; right: 0; top: 100%; margin-top: 4px;
  width: 180px; background: white; border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;
  padding: 8px 0; z-index: 50; display: flex; flex-direction: column;
}
.dropdown-up { top: auto; bottom: 100%; margin-bottom: 4px; margin-top: 0; }
.dropdown-item {
  padding: 10px 16px; border: none; background: transparent;
  display: flex; align-items: center; gap: 10px; font-size: 13px;
  font-weight: 500; color: #334155; cursor: pointer; text-align: left;
}
.dropdown-item:hover { background: #f8fafc; color: #0f172a; }
.text-rose-600 { color: #e11d48 !important; }
.dropdown-divider { height: 1px; background: #f1f5f9; margin: 4px 0; }

.table-loading-overlay {
  position: absolute; inset: 0; background: rgba(255,255,255,0.6);
  backdrop-filter: blur(2px); z-index: 10; display: flex;
  align-items: center; justify-content: center;
}
.spinner-small {
  width: 32px; height: 32px; border: 3px solid rgba(99,102,241,0.2);
  border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 20px; color: #64748b; text-align: center;
}
.empty-state svg { color: #cbd5e1; margin-bottom: 16px; }
.empty-state h3 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
.skeleton-box { background: #f1f5f9; border-radius: 4px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
