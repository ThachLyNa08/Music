<template>
  <div class="manage-transactions">
    <header class="header-section">
      <div>
        <h1 class="page-title">Lịch sử Giao dịch</h1>
        <p class="page-subtitle">Theo dõi lịch sử thanh toán hóa đơn nâng cấp Premium và doanh thu hệ thống</p>
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
          <span class="card-value">{{ formatCurrency(totalRevenue) }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon count">
          <MfIcon name="receipt_long" size="24" />
        </div>
        <div class="card-info">
          <span class="card-label">Số Giao dịch</span>
          <span class="card-value">{{ transactions.length }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon rate">
          <MfIcon name="verified" size="24" />
        </div>
        <div class="card-info">
          <span class="card-label">Tỷ lệ Thành công</span>
          <span class="card-value">{{ successRate }}%</span>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <MfIcon name="search" size="18" className="search-icon" />
        <input v-model="searchQuery" type="text" placeholder="Tìm theo mã đơn, tên hoặc email khách hàng..." class="search-field" />
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterProvider" class="filter-select">
          <option value="">Tất cả cổng thanh toán</option>
          <option value="vnpay">VNPay</option>
          <option value="momo">MoMo</option>
        </select>
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterStatus" class="filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="success">Thành công</option>
          <option value="pending">Chờ thanh toán</option>
          <option value="failed">Thất bại</option>
          <option value="refunded">Đã hoàn tiền</option>
        </select>
      </div>
      <AdminResetButton :disabled="loading" @click="resetFilters" />
    </div>

    <!-- Main Content -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải danh sách hóa đơn giao dịch...</p>
    </div>

    <div v-else-if="error" class="empty-state">
      <MfIcon name="error_outline" size="64" style="color: #ff7675" />
      <h3 style="color: #d63031">Đã có lỗi xảy ra</h3>
      <p>{{ error }}</p>
      <button @click="fetchTransactions" class="retry-btn">Thử lại</button>
    </div>

    <div v-else-if="filteredTransactions.length === 0" class="empty-state">
      <MfIcon name="credit_card_off" size="64" />
      <h3>Không tìm thấy giao dịch nào</h3>
      <p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
    </div>

    <div v-else class="table-container shadow-3d">
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
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in paginatedTransactions" :key="t.id" class="txn-row">
            <td>
              <span class="order-code">#{{ t.order_code }}</span>
            </td>
            <td>
              <div class="user-details">
                <span class="user-name">{{ t.user_name }}</span>
                <span class="user-email">{{ t.user_email }}</span>
              </div>
            </td>
            <td>
              <span class="plan-badge">{{ t.plan_name }}</span>
            </td>
            <td>
              <span class="amount-val">{{ formatCurrency(t.amount) }}</span>
            </td>
            <td>
              <span class="provider-badge" :class="t.provider">
                {{ t.provider === 'vnpay' ? 'VNPay' : 'MoMo' }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="t.status">
                {{ formatStatus(t.status) }}
              </span>
            </td>
            <td class="text-secondary">
              {{ formatDateTime(t.paid_at || t.created_at) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-end mt-4 px-2">
      <AdminPagination v-model:currentPage="currentPage" :totalPages="totalPages" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/api/axios'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'

const loading = ref(true)
const error = ref(null)
const transactions = ref([])
const searchQuery = ref('')
const filterProvider = ref('')
const filterStatus = ref('')

async function fetchTransactions() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get('/admin/transactions')
    transactions.value = res.data?.data || []
  } catch (err) {
    console.error('Lỗi khi tải lịch sử giao dịch:', err)
    error.value = 'Không thể tải danh sách giao dịch. Vui lòng thử lại sau.'
  } finally {
    loading.value = false
  }
}

const totalRevenue = computed(() => {
  if (!transactions.value || !Array.isArray(transactions.value)) return 0
  return transactions.value
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0)
})

const successRate = computed(() => {
  if (!transactions.value || !Array.isArray(transactions.value) || transactions.value.length === 0) return 0
  const successCount = transactions.value.filter(t => t.status === 'success').length
  return Math.round((successCount / transactions.value.length) * 100)
})

const filteredTransactions = computed(() => {
  if (!transactions.value || !Array.isArray(transactions.value)) return []
  return transactions.value.filter(t => {
    const query = searchQuery.value.toLowerCase()
    const matchSearch = 
      (t.order_code || '').toLowerCase().includes(query) ||
      (t.user_name || '').toLowerCase().includes(query) ||
      (t.user_email || '').toLowerCase().includes(query)

    const matchProvider = !filterProvider.value || t.provider === filterProvider.value
    const matchStatus = !filterStatus.value || t.status === filterStatus.value

    return matchSearch && matchProvider && matchStatus
  })
})

const currentPage = ref(1)
const pageSize = ref(20)

watch([searchQuery, filterProvider, filterStatus], () => {
  currentPage.value = 1
})

function resetFilters() {
  searchQuery.value = ''
  filterProvider.value = ''
  filterStatus.value = ''
  currentPage.value = 1
}

const totalPages = computed(() => Math.max(1, Math.ceil(filteredTransactions.value.length / pageSize.value)))

watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) {
    currentPage.value = newTotal
  }
})

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTransactions.value.slice(start, start + pageSize.value)
})

function formatCurrency(val) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

function formatStatus(status) {
  switch (status) {
    case 'success': return 'Thành công'
    case 'pending': return 'Chờ thanh toán'
    case 'failed': return 'Thất bại'
    case 'refunded': return 'Đã hoàn tiền'
    default: return status
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'Chưa thanh toán'
  const date = new Date(dateStr)
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchTransactions()
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

/* Stats Cards Section */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 32px;
}
.summary-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  border: 1px solid #f0f2f5;
}
.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-icon.revenue { background: rgba(162, 155, 254, 0.12); color: #6c5ce7; }
.card-icon.count { background: rgba(116, 185, 255, 0.12); color: #0984e3; }
.card-icon.rate { background: rgba(85, 239, 196, 0.12); color: #00b894; }

.card-info {
  display: flex;
  flex-direction: column;
}
.card-label {
  font-size: 12px;
  color: #b2bec3;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.card-value {
  font-size: 22px;
  font-weight: 800;
  color: #2d3436;
  margin-top: 4px;
}

/* Filter bar */
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
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
  padding: 12px 16px 12px 48px;
  border-radius: 14px;
  border: 1px solid #e4e6eb;
  background: white;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  transition: all 0.2s;
}
.search-field:focus {
  border-color: #a29bfe;
  box-shadow: 0 4px 15px rgba(162, 155, 254, 0.15);
}

.filter-select-wrapper {
  min-width: 180px;
}
.filter-select {
  width: 100%;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid #e4e6eb;
  background: white;
  font-size: 14px;
  font-weight: 600;
  color: #2d3436;
  outline: none;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  cursor: pointer;
}
.filter-select:focus {
  border-color: #a29bfe;
}

/* Table Card */
.table-container {
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  border: 1px solid #f0f2f5;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.transactions-table th {
  padding: 16px 24px;
  background: #f8f9fa;
  border-bottom: 2px solid #f0f2f5;
  color: #b2bec3;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.transactions-table td {
  padding: 18px 24px;
  border-bottom: 1px solid #f0f2f5;
  color: #2d3436;
  font-size: 14px;
  font-weight: 600;
}
.txn-row {
  transition: background 0.2s;
}
.txn-row:hover {
  background: #f8f9fa;
}

.order-code {
  font-family: monospace;
  background: #f1f2f6;
  color: #2d3436;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.user-name {
  font-weight: 700;
  color: #2d3436;
}
.user-email {
  font-size: 12px;
  color: #b2bec3;
}

.plan-badge {
  color: #636e72;
  font-weight: 700;
  background: #f1f2f6;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
}

.amount-val {
  font-weight: 800;
  color: #2d3436;
}

.provider-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  display: inline-block;
  text-transform: uppercase;
}
.provider-badge.vnpay {
  background: rgba(116, 185, 255, 0.12);
  color: #0984e3;
}
.provider-badge.momo {
  background: rgba(253, 121, 168, 0.12);
  color: #e84393;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  display: inline-block;
}
.status-badge.success {
  background: rgba(85, 239, 196, 0.12);
  color: #00b894;
}
.status-badge.pending {
  background: rgba(255, 234, 167, 0.12);
  color: #d63031; /* using red or orange */
  color: #fdcb6e;
}
.status-badge.failed {
  background: rgba(255, 118, 117, 0.12);
  color: #d63031;
}
.status-badge.refunded {
  background: rgba(162, 155, 254, 0.12);
  color: #6c5ce7;
}

.text-secondary {
  color: #636e72;
  font-size: 13px;
}

/* Loading & Empty states */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #636e72;
  text-align: center;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(162, 155, 254, 0.1);
  border-top-color: #a29bfe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state svg {
  color: #dfe6e9;
  margin-bottom: 16px;
}
.empty-state h3 {
  font-size: 18px;
  font-weight: 700;
  color: #2d3436;
  margin: 0 0 8px 0;
}
.empty-state p {
  margin: 0;
  font-size: 14px;
}
.retry-btn {
  margin-top: 16px;
  padding: 8px 16px;
  border-radius: 8px;
  background: #a29bfe;
  color: white;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.retry-btn:hover {
  background: #6c5ce7;
}
</style>
