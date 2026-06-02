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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879-.659c1.546-1.16 2.898-1.74 3.738-1.74s2.192.58 3.738 1.74l.879.66M8.25 10.5h11.5" />
          </svg>
        </div>
        <div class="card-info">
          <span class="card-label">Tổng Doanh thu</span>
          <span class="card-value">{{ formatCurrency(totalRevenue) }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon count">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="card-info">
          <span class="card-label">Số Giao dịch</span>
          <span class="card-value">{{ transactions.length }}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon rate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="search-icon">
          <circle cx="11" cy="11" r="8" />
          <path stroke-linecap="round" d="m21 21-4.35-4.35" />
        </svg>
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
    </div>

    <!-- Main Content -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải danh sách hóa đơn giao dịch...</p>
    </div>

    <div v-else-if="filteredTransactions.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
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
          <tr v-for="t in filteredTransactions" :key="t.id" class="txn-row">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'

const loading = ref(true)
const transactions = ref([])
const searchQuery = ref('')
const filterProvider = ref('')
const filterStatus = ref('')

async function fetchTransactions() {
  loading.value = true
  try {
    const res = await api.get('/admin/transactions')
    transactions.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải lịch sử giao dịch:', err)
  } finally {
    loading.value = false
  }
}

const totalRevenue = computed(() => {
  return transactions.value
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0)
})

const successRate = computed(() => {
  if (transactions.value.length === 0) return 0
  const successCount = transactions.value.filter(t => t.status === 'success').length
  return Math.round((successCount / transactions.value.length) * 100)
})

const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    const query = searchQuery.value.toLowerCase()
    const matchSearch = 
      t.order_code.toLowerCase().includes(query) ||
      t.user_name.toLowerCase().includes(query) ||
      t.user_email.toLowerCase().includes(query)

    const matchProvider = !filterProvider.value || t.provider === filterProvider.value
    const matchStatus = !filterStatus.value || t.status === filterStatus.value

    return matchSearch && matchProvider && matchStatus
  })
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
</style>
