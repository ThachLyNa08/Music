<template>
  <div class="manage-transactions">
    <header class="header-section">
      <div>
        <h1 class="page-title">Lịch sử Giao dịch</h1>
        <p class="page-subtitle">Theo dõi lịch sử thanh toán hóa đơn nâng cấp Premium và doanh thu hệ thống</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary btn-icon" @click="fetchData(true)" title="Làm mới">
          <MfIcon name="sync" size="18" :class="{'spinning': loading}" />
        </button>
        <button class="btn-primary btn-icon" @click="exportReport" title="Xuất báo cáo">
          <MfIcon name="download" size="18" />
        </button>
      </div>
    </header>

    <!-- Overview Stats Cards -->
    <div class="stats-overview">
      <div class="summary-card">
        <div class="card-icon revenue">
          <MfIcon name="payments" size="24" />
        </div>
        <div class="card-info">
          <span class="card-label">Tổng Doanh thu</span>
          <span class="card-value" v-if="loadingSummary"><div class="skeleton-text"></div></span>
          <span class="card-value" v-else>{{ formatCurrency(summary.totalRevenue) }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon count">
          <MfIcon name="receipt_long" size="24" />
        </div>
        <div class="card-info">
          <span class="card-label">Số Giao dịch</span>
          <span class="card-value" v-if="loadingSummary"><div class="skeleton-text"></div></span>
          <span class="card-value" v-else>{{ summary.totalTransactions }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon paid">
          <MfIcon name="check_circle" size="24" />
        </div>
        <div class="card-info">
          <span class="card-label">Đã thanh toán</span>
          <span class="card-value" v-if="loadingSummary"><div class="skeleton-text"></div></span>
          <span class="card-value text-emerald-600" v-else>{{ summary.paidTransactions }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon pending">
          <MfIcon name="clock" size="24" />
        </div>
        <div class="card-info">
          <span class="card-label">Chờ xử lý / Thất bại</span>
          <span class="card-value" v-if="loadingSummary"><div class="skeleton-text"></div></span>
          <span class="card-value text-amber-600" v-else>{{ summary.pendingTransactions + summary.expiredTransactions + summary.cancelledTransactions }}</span>
          <span class="card-subline" v-if="!loadingSummary">
            <span class="text-amber-600 font-bold">{{ summary.pendingTransactions }}</span> chờ &middot; <span class="text-slate-500 font-bold">{{ summary.expiredTransactions }}</span> hết hạn &middot; <span class="text-rose-500 font-bold">{{ summary.cancelledTransactions }}</span> đã hủy
          </span>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div v-if="route.query.userId" class="user-filter-chip">
      <span class="chip-text">Đang lọc theo người dùng: {{ filterUserName || 'User ID ' + route.query.userId }}</span>
      <button class="chip-clear" @click="clearUserFilter">
        <MfIcon name="close" size="16" /> Xóa bộ lọc
      </button>
    </div>

    <div class="filter-bar">
      <div class="search-input-wrapper">
        <MfIcon name="search" size="18" className="search-icon" />
        <input v-model="filterForm.q" type="text" placeholder="Tìm theo mã đơn, tên hoặc email khách hàng..." class="search-field" @keyup.enter="applyFilters" />
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterForm.gateway" class="filter-select">
          <option value="">Tất cả cổng thanh toán</option>
          <option value="sepay">SePay</option>
          <option value="momo">MoMo</option>
          <option value="vnpay">VNPay</option>
        </select>
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterForm.status" class="filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="paid">Đã thanh toán</option>
          <option value="pending">Đang chờ</option>
          <option value="expired">Hết hạn</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>
      <button class="btn-primary" @click="applyFilters" style="height: 42px">Tìm kiếm</button>
      <AdminResetButton :disabled="loading" @click="resetFilters" style="height: 42px" />
    </div>

    <!-- Main Content -->
    <div v-if="loading && transactions.length === 0" class="table-container shadow-3d">
      <table class="transactions-table">
        <thead>
          <tr>
            <th>Mã Đơn hàng</th>
            <th>Khách hàng</th>
            <th>Gói Premium</th>
            <th>Số tiền</th>
            <th>Cổng thanh toán</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in 5" :key="i">
            <td><div class="skeleton-box" style="width: 100px; height: 24px;"></div></td>
            <td><div class="skeleton-box" style="width: 150px; height: 24px;"></div></td>
            <td><div class="skeleton-box" style="width: 80px; height: 24px;"></div></td>
            <td><div class="skeleton-box" style="width: 80px; height: 24px;"></div></td>
            <td><div class="skeleton-box" style="width: 60px; height: 24px;"></div></td>
            <td><div class="skeleton-box" style="width: 80px; height: 24px;"></div></td>
            <td><div class="skeleton-box" style="width: 100px; height: 24px;"></div></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="error" class="empty-state">
      <MfIcon name="error_outline" size="64" style="color: #ff7675" />
      <h3 style="color: #d63031">Đã có lỗi xảy ra</h3>
      <p>{{ error }}</p>
      <button @click="fetchData" class="retry-btn">Thử lại</button>
    </div>

    <div v-else-if="transactions.length === 0" class="empty-state">
      <MfIcon name="credit_card_off" size="64" />
      <h3>Không tìm thấy giao dịch nào</h3>
      <p>Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
    </div>

    <div v-else class="table-container shadow-3d relative">
      <div v-if="loading" class="table-loading-overlay">
        <div class="spinner-small"></div>
      </div>
      <table class="transactions-table">
        <thead>
          <tr>
            <th>Mã Đơn hàng</th>
            <th>Khách hàng</th>
            <th>Gói Premium</th>
            <th>Số tiền</th>
            <th>Cổng TT</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th class="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(t, index) in transactions" :key="t.id" class="txn-row" @click="openDetail(t.id)" style="cursor: pointer;">
            <td>
              <div class="flex items-center gap-2">
                <span class="order-code">#{{ truncateCode(t.order_code) }}</span>
                <button class="btn-icon-small" @click.stop="copyCode(t.order_code)" title="Sao chép">
                  <MfIcon name="content_copy" size="14" />
                </button>
              </div>
            </td>
            <td>
              <div class="user-details" @click.stop="goToUser(t.user_id)">
                <span class="user-name">{{ t.user_name }}</span>
                <span class="user-email">{{ t.user_email }}</span>
              </div>
            </td>
            <td>
              <span class="plan-badge" v-if="t.plan_name">{{ t.plan_name }}</span>
              <span class="text-slate-400" v-else>—</span>
            </td>
            <td>
              <span class="amount-val">{{ formatCurrency(t.amount) }}</span>
            </td>
            <td>
              <span class="provider-badge" :class="t.provider">
                {{ t.provider || '—' }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="t.status">
                {{ formatStatus(t.status) }}
              </span>
            </td>
            <td>
              <div class="time-cell">
                <span class="time-main">{{ formatDate(t.created_at) }}</span>
                <span class="time-sub">{{ formatTime(t.created_at) }}</span>
                <span class="time-paid text-emerald-600" v-if="t.paid_at && t.status === 'paid'">
                  Thanh toán: {{ formatTime(t.paid_at) }}
                </span>
              </div>
            </td>
            <td class="text-right">
              <div class="action-menu-wrapper" @click.stop>
                <button class="btn-action-more" @click="toggleDropdown(t.id)">
                  <MfIcon name="more_vert" size="20" />
                </button>
                
                <div v-if="activeDropdown === t.id" class="action-dropdown" :class="{ 'dropdown-up': index >= transactions.length - 2 && transactions.length > 3 }">
                  <button class="dropdown-item" @click="openDetail(t.id); closeDropdown()">
                    <MfIcon name="visibility" size="16" /> Xem chi tiết
                  </button>
                  <button class="dropdown-item" @click="goToUser(t.user_id); closeDropdown()">
                    <MfIcon name="open_in_new" size="16" /> Mở hồ sơ
                  </button>
                  <button class="dropdown-item" @click="copyCode(t.order_code); closeDropdown()">
                    <MfIcon name="content_copy" size="16" /> Sao chép mã
                  </button>
                  <div class="dropdown-divider" v-if="t.status === 'pending'"></div>
                  <button class="dropdown-item text-rose-600" v-if="t.status === 'pending'" @click="cancelTx(t); closeDropdown()">
                    <MfIcon name="cancel" size="16" /> Hủy giao dịch
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-end mt-4 px-2">
      <AdminPagination 
        :currentPage="currentPage" 
        :totalPages="totalPages" 
        @update:currentPage="onPageChange"
      />
    </div>

    <PaymentDetailModal 
      v-model:isOpen="detailModalOpen" 
      :paymentId="selectedPaymentId" 
    />

    <ConfirmDialog 
      v-model:isOpen="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirmText="confirmState.confirmText"
      :type="confirmState.type"
      :loading="confirmState.loading"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import PaymentDetailModal from '@/components/admin/PaymentDetailModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

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
  status: ''
})

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

function toggleDropdown(id) {
  if (activeDropdown.value === id) {
    activeDropdown.value = null
  } else {
    activeDropdown.value = id
  }
}

function closeDropdown() {
  activeDropdown.value = null
}

function handleClickOutside(e) {
  if (!e.target.closest('.action-menu-wrapper')) {
    closeDropdown()
  }
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

function applyFilters() {
  currentPage.value = 1
  fetchData()
}

function onPageChange(page) {
  currentPage.value = page
  fetchData()
}

function resetFilters() {
  filterForm.q = ''
  filterForm.gateway = ''
  filterForm.status = ''
  currentPage.value = 1
  
  if (route.query.userId) {
    router.replace({ path: route.path, query: {} })
  } else {
    fetchData()
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
  document.addEventListener('click', handleClickOutside)
  fetchData()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
