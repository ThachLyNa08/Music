<template>
  <div class="manage-premium page-fade-in">
    <header class="header-section">
      <div>
        <h1 class="page-title">Quản lý Premium</h1>
        <p class="page-subtitle">Theo dõi và phân quyền Premium cho các thành viên hệ thống</p>
      </div>
    </header>

    <!-- Overview Stats Cards -->
    <div class="stats-overview">
      <!-- 1. Người dùng Premium -->
      <div class="summary-card">
        <div class="card-icon" style="background: #eef2ff; color: #6366f1;">
          <MfIcon name="workspace_premium" size="24" />
        </div>
        <div class="card-info">
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-label"></div>
          <span v-else class="card-label">Người dùng Premium</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-value"></div>
          <span v-else class="card-value">{{ summary?.totalPremiumUsers ?? 0 }}</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-subline" style="margin-top: 6px;"></div>
          <div v-else class="card-subline">
            <span class="text-emerald-600">{{ summary?.activePremiumUsers ?? 0 }} đang hoạt động</span> &middot; 
            <span class="text-rose-500">{{ summary?.expiredPremiumUsers ?? 0 }} đã hết hạn</span>
          </div>
        </div>
      </div>
      
      <!-- 2. Sắp hết hạn -->
      <div class="summary-card">
        <div class="card-icon" style="background: #fffbeb; color: #f59e0b;">
          <MfIcon name="history" size="24" />
        </div>
        <div class="card-info">
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-label"></div>
          <span v-else class="card-label">Sắp hết hạn (7 ngày)</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-value"></div>
          <span v-else class="card-value">{{ summary?.expiringSoonUsers ?? 0 }}</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-subline" style="margin-top: 6px;"></div>
          <div v-else class="card-subline" :class="(summary?.expiringSoonUsers ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'">
            {{ (summary?.expiringSoonUsers ?? 0) > 0 ? 'Cần gia hạn ngay' : 'Không có cảnh báo' }}
          </div>
        </div>
      </div>
      
      <!-- 3. Doanh thu tháng này -->
      <div class="summary-card">
        <div class="card-icon" style="background: #eff6ff; color: #3b82f6;">
          <MfIcon name="payments" size="24" />
        </div>
        <div class="card-info">
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-label"></div>
          <span v-else class="card-label">Doanh thu tháng này</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-value" style="width: 100px;"></div>
          <span v-else class="card-value">{{ formatCurrency(summary?.monthlyPremiumRevenue) }}</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-subline" style="margin-top: 6px;"></div>
          <div v-else class="card-subline text-slate-400">Từ giao dịch đã thanh toán</div>
        </div>
      </div>
      
      <!-- 4. Giao dịch đang chờ -->
      <div class="summary-card">
        <div class="card-icon" style="background: #f1f5f9; color: #64748b;">
          <MfIcon name="history" size="24" />
        </div>
        <div class="card-info">
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-label"></div>
          <span v-else class="card-label">Giao dịch đang chờ</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-value"></div>
          <span v-else class="card-value">{{ summary?.pendingPremiumTransactions ?? 0 }}</span>
          
          <div v-if="isSummaryLoading" class="skeleton-box skeleton-subline" style="margin-top: 6px;"></div>
          <div v-else class="card-subline" :class="(summary?.pendingPremiumTransactions ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'">
            {{ (summary?.pendingPremiumTransactions ?? 0) > 0 ? 'Chờ xác nhận thanh toán' : 'Không có giao dịch chờ' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <MfIcon name="search" size="18" className="search-icon" />
        <input 
          v-model="filterForm.q" 
          @keyup.enter="handleFilterChange" 
          type="text" 
          placeholder="Tìm theo tên, email hoặc ID..." 
          class="search-field" 
          :disabled="isInitialLoading"
        />
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterForm.status" @change="handleFilterChange" class="filter-select" :disabled="isInitialLoading">
          <option value="Tất cả Premium">Tất cả Premium</option>
          <option value="Đang hoạt động">Đang hoạt động</option>
          <option value="Sắp hết hạn">Sắp hết hạn</option>
          <option value="Đã hết hạn">Đã hết hạn</option>
          <option value="Chưa Premium">Chưa Premium</option>
        </select>
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterForm.plan" @change="handleFilterChange" class="filter-select" :disabled="isPlansLoading">
          <option value="Tất cả">{{ isPlansLoading ? 'Đang tải gói...' : 'Tất cả gói' }}</option>
          <option v-for="plan in plans" :key="plan.id" :value="plan.name">{{ plan.name }}</option>
        </select>
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterForm.sort" @change="handleFilterChange" class="filter-select" :disabled="isInitialLoading">
          <option value="">Sắp xếp mặc định</option>
          <option value="Hết hạn gần nhất">Hết hạn gần nhất</option>
          <option value="Mới nâng cấp gần đây">Mới nâng cấp gần đây</option>
          <option value="Chi tiêu cao nhất">Chi tiêu cao nhất</option>
          <option value="Tên A-Z">Tên A-Z</option>
        </select>
      </div>
      <AdminResetButton :disabled="isInitialLoading || isTableLoading" @click="resetFilters" />
    </div>

    <!-- Main Content -->
    <div class="table-container shadow-3d">
      <table class="users-table">
        <thead>
          <tr>
            <th style="width: 24%">Người dùng</th>
            <th style="width: 14%">Trạng thái</th>
            <th style="width: 14%">Gói hiện tại</th>
            <th style="width: 14%">Ngày hết hạn</th>
            <th style="width: 11%">Tổng chi</th>
            <th style="width: 18%; white-space: nowrap;">Lần cuối thanh toán</th>
            <th style="text-align: right; width: 5%"></th>
          </tr>
        </thead>
        <tbody>
          <!-- Initial Skeleton Loading -->
          <template v-if="isInitialLoading || (isTableLoading && users.length === 0)">
            <tr v-for="i in 8" :key="'skel-row-'+i" class="user-row">
              <td>
                <div class="user-info">
                  <div class="skeleton-box skeleton-avatar"></div>
                  <div class="user-details">
                    <div class="skeleton-box skeleton-text"></div>
                    <div class="skeleton-box skeleton-text-short"></div>
                  </div>
                </div>
              </td>
              <td><div class="skeleton-box skeleton-badge"></div></td>
              <td><div class="skeleton-box skeleton-badge" style="width: 70px;"></div></td>
              <td>
                <div class="expiry-cell">
                  <div class="skeleton-box skeleton-text"></div>
                  <div class="skeleton-box skeleton-text-short"></div>
                </div>
              </td>
              <td><div class="skeleton-box skeleton-text" style="width: 70px;"></div></td>
              <td>
                <div class="last-paid-cell">
                  <div class="skeleton-box skeleton-text"></div>
                  <div class="skeleton-box skeleton-text-short" style="width: 60px;"></div>
                </div>
              </td>
              <td><div class="skeleton-box skeleton-avatar" style="width: 24px; height: 24px; margin-left: auto;"></div></td>
            </tr>
          </template>

          <!-- Empty State -->
          <tr v-else-if="users.length === 0 && !isTableLoading">
            <td colspan="7" class="empty-state-cell">
              <div class="empty-state">
                <MfIcon name="workspace_premium" size="48" />
                <h3>Không tìm thấy người dùng</h3>
                <p>Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
              </div>
            </td>
          </tr>

          <!-- Data Rows -->
          <template v-else>
            <tr v-for="(u, index) in users" :key="u.user_id" class="user-row" @click="goToDetail(u.user_id)" style="cursor: pointer;">
              <td>
                <div class="user-info">
                  <img v-if="u.avatar_url" :src="normalizeImageUrl(u.avatar_url, 'user')" class="user-avatar-img" :alt="u.name" />
                  <div v-else class="user-avatar-placeholder">
                    {{ u.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="user-details">
                    <span class="user-name">{{ u.name }}</span>
                    <span class="user-email">{{ u.email }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="status-badge" :class="u.premium_status">
                  {{ formatPremiumStatus(u.premium_status) }}
                </span>
              </td>
              <td>
                <span class="plan-badge" :class="{'active': u.plan_id}">
                  {{ (u.plan_name && u.plan_name !== '-') ? u.plan_name : 'Free' }}
                </span>
              </td>
              <td>
                <div class="expiry-cell">
                  <span class="expiry-date" :class="{'text-red-500': u.premium_status === 'expired' || u.premium_status === 'expiring_soon'}">
                    {{ u.premium_expires_at ? new Date(u.premium_expires_at).toLocaleDateString('vi-VN') : '—' }}
                  </span>
                  <span v-if="u.days_remaining !== null" class="expiry-days" :class="{'text-red-500': u.days_remaining <= 7, 'text-slate-400': u.days_remaining < 0}">
                    ({{ formatDaysRemaining(u.days_remaining) }})
                  </span>
                </div>
              </td>
              <td>
                <span class="amount-val">{{ formatCurrency(u.total_spent) }}</span>
              </td>
              <td>
                <div v-if="u.last_paid_at" class="last-paid-cell">
                  <span class="last-paid-date">{{ new Date(u.last_paid_at).toLocaleDateString('vi-VN') }}</span>
                  <span v-if="u.last_transaction_code" class="last-paid-code">#{{ u.last_transaction_code }}</span>
                </div>
                <span v-else class="text-secondary">—</span>
              </td>
              <td style="text-align: right;">
                <div class="action-menu-wrapper" @click.stop>
                  <button class="btn-action-more" @click="toggleDropdown(u.user_id)">
                    <MfIcon name="more_vert" size="20" />
                  </button>
                  
                  <div v-if="activeDropdown === u.user_id" class="action-dropdown" :class="{ 'dropdown-up': index >= users.length - 2 && users.length > 3 }">
                    <button class="dropdown-item" @click="openDetailModal(u); closeDropdown()">
                      <MfIcon name="visibility" size="16" /> Xem chi tiết gói
                    </button>
                    <button class="dropdown-item" @click="openPremiumModal(u, u.plan_id ? 'extend' : 'activate'); closeDropdown()">
                      <MfIcon name="add" size="16" /> {{ u.plan_id ? 'Gia hạn thêm' : 'Kích hoạt Premium' }}
                    </button>
                    <button class="dropdown-item" @click="goToDetail(u.user_id); closeDropdown()">
                      <MfIcon name="open_in_new" size="16" /> Mở hồ sơ
                    </button>
                    <div v-if="u.premium_status === 'active' || u.premium_status === 'expiring_soon'" class="dropdown-divider"></div>
                    <button v-if="u.premium_status === 'active' || u.premium_status === 'expiring_soon'" class="dropdown-item delete-action" @click="cancelPremium(u); closeDropdown()">
                      <MfIcon name="cancel" size="16" /> Hủy Premium
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Table Loading Overlay for subsequent fetches -->
      <div v-if="isTableLoading && users.length > 0 && !isInitialLoading" class="table-loading-overlay">
        <div class="spinner-small"></div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination-wrapper">
      <AdminPagination 
        v-if="totalPages > 1 || isInitialLoading" 
        v-model:currentPage="currentPage" 
        :totalPages="isInitialLoading ? 1 : totalPages" 
      />
    </div>

    <!-- Modals -->
    <PremiumManageModal 
      :isOpen="showPremiumModal"
      :user="selectedUser"
      :plans="plans"
      :actionType="premiumActionType"
      @close="showPremiumModal = false"
      @refresh="fetchData"
    />

    <PremiumDetailModal
      :isOpen="showDetailModal"
      :user="selectedUser"
      @close="showDetailModal = false"
      @action="handleDetailAction"
    />

    <ConfirmDialog 
      v-model:open="confirmState.open"
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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'
import { normalizeImageUrl } from '@/utils/imageUrl'
import MfIcon from '@/components/common/MfIcon.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import PremiumManageModal from '@/components/admin/PremiumManageModal.vue'
import PremiumDetailModal from '@/components/admin/PremiumDetailModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const toast = useToastStore()

// Loading states
const isInitialLoading = ref(true)
const isSummaryLoading = ref(true)
const isTableLoading = ref(true)
const isPlansLoading = ref(true)

const summary = ref(null)
const users = ref([])
const plans = ref([])

const filterForm = ref({
  q: '',
  status: 'Tất cả Premium',
  plan: 'Tất cả',
  sort: ''
})

const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(1)

const activeDropdown = ref(null)

const showPremiumModal = ref(false)
const showDetailModal = ref(false)
const selectedUser = ref(null)
const premiumActionType = ref('extend')

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
})

function toggleDropdown(userId) {
  activeDropdown.value = activeDropdown.value === userId ? null : userId
}

function closeDropdown() {
  activeDropdown.value = null
}

const handleClickOutside = (e) => {
  if (!e.target.closest('.action-menu-wrapper')) {
    activeDropdown.value = null
  }
}

async function fetchSummary() {
  isSummaryLoading.value = true
  try {
    const res = await api.get('/admin/premium/summary')
    summary.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải summary:', err)
  } finally {
    isSummaryLoading.value = false
  }
}

async function fetchPlans() {
  isPlansLoading.value = true
  try {
    const res = await api.get('/admin/premium/plans')
    plans.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải plans:', err)
  } finally {
    isPlansLoading.value = false
  }
}

async function fetchUsers() {
  isTableLoading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      q: filterForm.value.q,
      status: filterForm.value.status,
      plan: filterForm.value.plan,
      sort: filterForm.value.sort
    }
    const res = await api.get('/admin/premium/users', { params })
    users.value = res.data.data.items
    totalPages.value = res.data.data.pagination.totalPages
  } catch (err) {
    console.error('Lỗi khi tải danh sách người dùng:', err)
    toast.showToast('Không thể tải danh sách người dùng', 'error')
    if (isInitialLoading.value) users.value = []
  } finally {
    isTableLoading.value = false
  }
}

async function fetchData() {
  await Promise.allSettled([
    fetchSummary(),
    fetchUsers()
  ])
}

function handleFilterChange() {
  currentPage.value = 1
  fetchUsers()
}

watch(currentPage, (newVal, oldVal) => {
  if (newVal !== oldVal && !isInitialLoading.value) {
    fetchUsers()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

function resetFilters() {
  filterForm.value = {
    q: '',
    status: 'Tất cả Premium',
    plan: 'Tất cả',
    sort: ''
  }
  currentPage.value = 1
  fetchUsers()
}

function formatCurrency(val) {
  if (val == null) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

function formatPremiumStatus(status) {
  switch (status) {
    case 'active': return 'Đang hoạt động'
    case 'expiring_soon': return 'Sắp hết hạn'
    case 'expired': return 'Đã hết hạn'
    case 'none': return 'Chưa Premium'
    default: return status
  }
}

function formatDaysRemaining(days) {
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days === 0) return 'Hết hạn hôm nay'
  return `Còn ${days} ngày`
}

function goToDetail(userId) {
  router.push(`/admin/users/${userId}`)
}

function goToTransactions(userId) {
  router.push({ path: '/admin/payments', query: { userId } })
}

function openDetailModal(user) {
  selectedUser.value = user
  showDetailModal.value = true
}

function handleDetailAction(actionType, user) {
  if (actionType === 'cancel') {
    cancelPremium(user)
  } else {
    openPremiumModal(user, actionType)
  }
}

function openPremiumModal(user, type) {
  selectedUser.value = user
  premiumActionType.value = type
  showPremiumModal.value = true
}

function openConfirm(options) {
  confirmState.value = { ...confirmState.value, ...options, open: true, loading: false }
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

function cancelPremium(user) {
  openConfirm({
    title: 'Hủy gói Premium?',
    message: `Bạn có chắc muốn hủy gói Premium của người dùng "${user.name}"? Người dùng sẽ trở về tài khoản thường ngay lập tức.`,
    confirmText: 'Hủy Premium',
    type: 'danger',
    action: async () => {
      try {
        await api.post(`/admin/premium/users/${user.user_id}/cancel`, { note: 'Admin cancelled' })
        toast.showToast('Đã hủy Premium thành công', 'success')
        fetchData()
      } catch (err) {
        console.error('Lỗi khi hủy premium:', err)
        toast.showToast(err.response?.data?.message || 'Không thể hủy gói Premium', 'error')
      }
    }
  })
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  
  // Parallel fetch for initial load
  await Promise.allSettled([
    fetchSummary(),
    fetchPlans(),
    fetchUsers()
  ])
  
  isInitialLoading.value = false
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.manage-premium {
  padding: 8px 16px;
  font-family: 'Be Vietnam Pro', sans-serif;
}

.page-fade-in {
  animation: fadeIn 0.25s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.header-section {
  margin-bottom: 24px;
  min-height: 52px;
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
  grid-template-columns: repeat(1, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}
@media (min-width: 640px) {
  .stats-overview { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .stats-overview { grid-template-columns: repeat(4, 1fr); }
}

.summary-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s;
  min-height: 112px;
}
.summary-card:hover {
  transform: translateY(-2px);
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
.card-info {
  display: flex;
  flex-direction: column;
  flex: 1;
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
  font-weight: 700;
  color: #0f172a;
  margin-top: 4px;
  line-height: 1;
}
.card-subline {
  font-size: 12px;
  margin-top: 6px;
  font-weight: 500;
  white-space: nowrap;
}
.text-emerald-600 { color: #059669; }
.text-rose-500 { color: #f43f5e; }
.text-amber-600 { color: #d97706; }
.text-slate-400 { color: #94a3b8; }
.skeleton-subline { width: 140px; height: 12px; border-radius: 4px; }

/* Filter bar */
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  min-height: 48px;
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
.search-field:disabled {
  background: #f8f9fa;
  color: #b2bec3;
}

.filter-select-wrapper {
  min-width: 160px;
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
.filter-select:disabled {
  background: #f8f9fa;
  color: #b2bec3;
  cursor: not-allowed;
}

/* Table Card */
.table-container {
  background: white;
  border-radius: 20px;
  overflow-x: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  border: 1px solid #f0f2f5;
  min-height: 520px; 
  position: relative;
}

.users-table {
  width: 100%;
  min-width: 1000px;
  border-collapse: collapse;
  text-align: left;
  table-layout: fixed;
}
.users-table th {
  padding: 16px 24px;
  background: #f8f9fa;
  border-bottom: 2px solid #f0f2f5;
  color: #000;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.users-table td {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f2f5;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  vertical-align: middle;
}
.user-row {
  transition: background 0.2s;
  height: 72px; /* Fixed height for rows to prevent shifting */
}
.user-row:hover {
  background: #f8f9fa;
}

/* Overlays */
.table-loading-overlay {
  position: absolute;
  top: 52px; /* Below header */
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.6);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}
.spinner-small {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(162, 155, 254, 0.2);
  border-top-color: #a29bfe;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Cell Content */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
}
.user-avatar-placeholder, .user-avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(162, 155, 254, 0.15);
  flex-shrink: 0;
}
.user-avatar-placeholder {
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 15px;
}
.user-avatar-img {
  object-fit: cover;
}
.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.user-name {
  font-weight: 700;
  color: #2d3436;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-email {
  font-size: 12px;
  color: #636e72;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.status-badge.active {
  background: rgba(85, 239, 196, 0.15);
  color: #00b894;
}
.status-badge.expiring_soon {
  background: rgba(253, 203, 110, 0.15);
  color: #e17055;
}
.status-badge.expired {
  background: rgba(255, 118, 117, 0.15);
  color: #d63031;
}
.status-badge.none {
  background: rgba(223, 228, 234, 0.5);
  color: #636e72;
}

.plan-badge {
  color: #636e72;
  font-weight: 700;
  background: #f1f2f6;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  display: inline-block;
  white-space: nowrap;
}
.plan-badge.active {
  background: rgba(162, 155, 254, 0.1);
  color: #6c5ce7;
}

.expiry-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.expiry-date {
  font-weight: 600;
  color: #2d3436;
}
.expiry-days {
  font-size: 12px;
  color: #636e72;
}
.text-red-500 {
  color: #d63031 !important;
}
.text-slate-400 {
  color: #b2bec3 !important;
}

.amount-val {
  font-weight: 800;
  color: #2d3436;
}

.last-paid-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.last-paid-date {
  color: #2d3436;
}
.last-paid-code {
  font-family: monospace;
  font-size: 11px;
  background: #f1f2f6;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
  color: #636e72;
}
.text-secondary {
  color: #b2bec3;
}

/* Actions Menu */
.action-menu-wrapper {
  position: relative;
  display: inline-block;
}
.btn-action-more {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-action-more:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.action-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  width: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  padding: 4px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: dropdownFade 0.2s ease;
}
.dropdown-up {
  top: auto;
  bottom: 100%;
  margin-bottom: 4px;
  margin-top: 0;
}
@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-10px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #334155;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.dropdown-item:hover {
  background: #f8fafc;
  color: #0f172a;
}
.dropdown-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 4px 0;
}
.delete-action {
  color: #e11d48;
}
.delete-action:hover {
  background: #fff1f2;
  color: #be123c;
}

/* Skeleton Loading Styles */
.skeleton-box {
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.skeleton-box::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.4) 60%,
    rgba(255, 255, 255, 0)
  );
  animation: shimmer 1.5s infinite;
  content: '';
}
@keyframes shimmer {
  100% { transform: translateX(100%); }
}

.skeleton-label { width: 120px; height: 12px; margin-bottom: 8px; }
.skeleton-value { width: 70px; height: 26px; border-radius: 6px; }
.skeleton-avatar { width: 40px; height: 40px; border-radius: 50%; }
.skeleton-text { width: 120px; height: 14px; margin-bottom: 6px; }
.skeleton-text-short { width: 80px; height: 12px; }
.skeleton-badge { width: 90px; height: 24px; border-radius: 12px; }

/* Empty state */
.empty-state-cell {
  height: 400px;
  vertical-align: middle;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #636e72;
  text-align: center;
}
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

/* Pagination Wrapper */
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 0 8px;
  min-height: 40px;
}
</style>
