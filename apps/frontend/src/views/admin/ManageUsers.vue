<template>
  <div class="manage-users">
    <header class="header-section">
      <div>
        <h1 class="page-title">Quản lý Thành viên</h1>
        <p class="page-subtitle">Quản trị phân quyền, trạng thái hoạt động và gói Premium của người dùng</p>
      </div>
    </header>

    <!-- Filters & Search -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <MfIcon name="search" size="18" className="search-icon" />
        <input v-model="searchQuery" type="text" placeholder="Tìm thành viên theo tên, email..." class="search-field" />
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterRole" class="filter-select">
          <option value="">Tất cả vai trò</option>
          <option value="user">Người dùng thường</option>
          <option value="admin">Quản trị viên (Admin)</option>
        </select>
      </div>
      <div class="filter-select-wrapper">
        <select v-model="filterStatus" class="filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="locked">Bị khóa</option>
        </select>
      </div>
      <AdminResetButton :disabled="loading" @click="resetFilters" />
      <div style="margin-left: auto;">
        <AdminAddButton title="Thêm thành viên" @click="showAddUserModal = true" />
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải danh sách thành viên...</p>
    </div>

    <div v-else-if="filteredUsers.length === 0" class="empty-state">
      <MfIcon name="person_off" size="64" />
      <h3>Không tìm thấy người dùng</h3>
      <p>Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
    </div>

    <div v-else class="table-container shadow-3d">
      <table class="users-table">
        <thead>
          <tr>
            <th style="width: 28%">Thành viên</th>
            <th style="width: 12%">Vai trò</th>
            <th style="width: 12%">Trạng thái</th>
            <th style="width: 15%">Hạn Premium</th>
            <th style="width: 14%">Lượt tạo Playlist</th>
            <th style="width: 15%">Hoạt động<br>gần nhất</th>
            <th style="text-align: right; width: 80px;">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, index) in paginatedUsers" :key="u.id" class="user-row" @click="goToDetail(u.id)" style="cursor: pointer;">
            <td>
              <div class="user-info">
                <img v-if="u.avatar_url" :src="normalizeImageUrl(u.avatar_url, 'user')" class="user-avatar-img" :alt="u.display_name" />
                <div v-else class="user-avatar-placeholder">
                  {{ u.display_name.charAt(0).toUpperCase() }}
                </div>
                <div class="user-details">
                  <span class="user-name">{{ u.display_name }}</span>
                  <span class="user-email">{{ u.email }}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="role-badge" :class="u.role">
                {{ u.role === 'admin' ? 'Quản trị viên' : 'Thành viên' }}
              </span>
            </td>
            <td>
              <div class="status-toggle-wrapper" @click.stop="toggleStatus(u)" :title="u.status === 'locked' ? 'Bị khóa' : 'Hoạt động'">
                <div class="switch-ui" :class="{ 'is-on': u.status === 'active' }">
                  <div class="switch-knob"></div>
                </div>
              </div>
            </td>
            <td>
              <div class="premium-cell">
                <span class="premium-date" :class="{ 'is-active': isPremiumActive(u.premium_expires_at) }">
                  {{ formatPremiumDate(u.premium_expires_at) }}
                </span>
              </div>
            </td>
            <td><span class="playlist-count">{{ u.playlistCount || 0 }}</span></td>
            <td style="white-space: nowrap">
              <span class="last-active-text">{{ formatLastActive(u.last_listened_at) }}</span>
            </td>
            <td style="text-align: right;">
              <div class="action-menu-wrapper" @click.stop>
                <button class="btn-action-more" @click="toggleDropdown(u.id)">
                  <MfIcon name="more_vert" size="20" />
                </button>
                
                <div v-if="activeDropdown === u.id" class="action-dropdown" :class="{ 'dropdown-up': index >= paginatedUsers.length - 2 && paginatedUsers.length > 3 }">
                  <button class="dropdown-item" @click="goToDetail(u.id); closeDropdown()">
                    <MfIcon name="visibility" size="18" /> Xem chi tiết
                  </button>
                  <button class="dropdown-item" @click="openEditModal(u); closeDropdown()">
                    <MfIcon name="edit" size="18" /> Chỉnh sửa
                  </button>
                  <button class="dropdown-item premium-action" @click="openPremiumModal(u); closeDropdown()">
                    <MfIcon name="workspace_premium" size="18" /> Quản lý Premium
                  </button>
                  <button class="dropdown-item" @click="toggleRole(u); closeDropdown()">
                    <MfIcon :name="u.role === 'admin' ? 'person' : 'admin_panel_settings'" size="18" />
                    {{ u.role === 'admin' ? 'Hạ cấp Member' : 'Thăng cấp Admin' }}
                  </button>
                  <button class="dropdown-item" :class="u.status === 'locked' ? 'unlock-action' : 'lock-action'" @click="toggleStatus(u); closeDropdown()">
                    <MfIcon :name="u.status === 'locked' ? 'lock_open' : 'lock'" size="18" />
                    {{ u.status === 'locked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản' }}
                  </button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item delete-action" @click="deleteUser(u); closeDropdown()">
                    <MfIcon name="delete" size="18" /> Xóa người dùng
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
      <AdminPagination v-model:currentPage="currentPage" :totalPages="totalPages" />
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditUserModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Chỉnh sửa hồ sơ</h2>
          <button class="close-btn" @click="showEditUserModal = false">&times;</button>
        </div>
        <form @submit.prevent="submitEditUser" class="modal-body">
          <div class="form-group">
            <label>Tên hiển thị</label>
            <input type="text" v-model="editUser.display_name" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" v-model="editUser.email" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Vai trò</label>
            <select v-model="editUser.role" class="form-input" required style="background-color: white;">
              <option value="user">Thành viên</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>
          <div v-if="editError" class="error-text" style="color: #d63031; font-size: 13px; font-weight: 600;">
            {{ editError }}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showEditUserModal = false">Hủy</button>
            <button type="submit" class="btn-primary" :disabled="savingUser">
              {{ savingUser ? 'Đang lưu...' : 'Lưu thay đổi' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Premium Manager Modal -->
    <div v-if="showPremiumModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Gia hạn Gói Premium</h2>
          <button class="close-btn" @click="showPremiumModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="user-preview">
            <span class="user-preview-title">Thành viên:</span>
            <span class="user-preview-name">{{ selectedUser.display_name }} ({{ selectedUser.email }})</span>
          </div>
          
          <div class="form-group">
            <label>Chọn thời gian gia hạn</label>
            <div class="premium-options">
              <button class="btn-premium-opt" @click="setPremiumExpiry(30)">+30 ngày (1 tháng)</button>
              <button class="btn-premium-opt" @click="setPremiumExpiry(90)">+90 ngày (3 tháng)</button>
              <button class="btn-premium-opt" @click="setPremiumExpiry(365)">+365 ngày (1 năm)</button>
              <button class="btn-premium-opt cancel" @click="setPremiumExpiry(0)">Hủy gói Premium</button>
            </div>
          </div>

          <div class="form-group custom-date">
            <label>Hoặc chọn ngày hết hạn cụ thể</label>
            <input type="date" v-model="customExpiryDate" class="form-input" />
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="showPremiumModal = false">Đóng</button>
            <button class="btn-primary" @click="saveCustomPremiumExpiry" :disabled="savingPremium">
              {{ savingPremium ? 'Đang lưu...' : 'Xác nhận thay đổi' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div v-if="showAddUserModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Thêm Thành viên mới</h2>
          <button class="close-btn" @click="showAddUserModal = false">&times;</button>
        </div>
        <form @submit.prevent="submitAddUser" class="modal-body">
          <div class="form-group">
            <label>Tên hiển thị</label>
            <input type="text" v-model="newUser.display_name" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" v-model="newUser.email" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Mật khẩu</label>
            <input type="password" v-model="newUser.password" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Vai trò</label>
            <select v-model="newUser.role" class="form-input" required style="background-color: white;">
              <option value="user">Người dùng</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showAddUserModal = false">Hủy</button>
            <button type="submit" class="btn-primary" :disabled="savingUser">
              {{ savingUser ? 'Đang thêm...' : 'Thêm thành viên' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirm Dialog -->
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { normalizeImageUrl } from '@/utils/imageUrl'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import AdminAddButton from '@/components/admin/AdminAddButton.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const toast = useToastStore()
const authStore = useAuthStore()
const loading = ref(true)
const users = ref([])
const searchQuery = ref('')
const filterRole = ref('')
const filterStatus = ref('')

// Dropdown state
const activeDropdown = ref(null)

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

// Premium modal state
const showPremiumModal = ref(false)
const savingPremium = ref(false)
const selectedUser = ref(null)
const customExpiryDate = ref('')

// Add user modal state
const showAddUserModal = ref(false)
const savingUser = ref(false)
const newUser = ref({
  email: '',
  password: '',
  display_name: '',
  role: 'user'
})

// Confirm state
const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
})

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

// Edit user modal state
const showEditUserModal = ref(false)
const editUser = ref({ id: null, display_name: '', email: '', role: 'user' })
const editError = ref('')

function openEditModal(user) {
  editUser.value = { ...user }
  editError.value = ''
  showEditUserModal.value = true
}

async function submitEditUser() {
  savingUser.value = true
  editError.value = ''
  
  if (!editUser.value.display_name.trim() || !editUser.value.email.trim()) {
    editError.value = 'Tên hiển thị và Email không được để trống'
    savingUser.value = false
    return
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(editUser.value.email.trim())) {
    editError.value = 'Email không đúng định dạng'
    savingUser.value = false
    return
  }

  try {
    const res = await api.put(`/admin/users/${editUser.value.id}`, {
      display_name: editUser.value.display_name,
      email: editUser.value.email,
      role: editUser.value.role
    })
    
    const idx = users.value.findIndex(u => u.id === editUser.value.id)
    if (idx !== -1) {
      users.value[idx] = { ...users.value[idx], ...res.data.data }
    }
    
    toast.showToast('Cập nhật hồ sơ thành công', 'success')
    showEditUserModal.value = false
  } catch (err) {
    console.error('Lỗi khi cập nhật người dùng:', err)
    editError.value = err.response?.data?.message || 'Không thể cập nhật hồ sơ'
  } finally {
    savingUser.value = false
  }
}

async function fetchUsers() {
  loading.value = true
  try {
    const res = await api.get('/admin/users')
    users.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi lấy danh sách user:', err)
  } finally {
    loading.value = false
  }
}

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const matchSearch = 
      u.display_name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchRole = !filterRole.value || u.role === filterRole.value
    const matchStatus = !filterStatus.value || u.status === filterStatus.value

    return matchSearch && matchRole && matchStatus
  })
})

const currentPage = ref(1)
const pageSize = ref(20)

watch([searchQuery, filterRole, filterStatus], () => {
  currentPage.value = 1
  activeDropdown.value = null
})

watch(currentPage, () => {
  activeDropdown.value = null
})

function resetFilters() {
  searchQuery.value = ''
  filterRole.value = ''
  filterStatus.value = ''
  currentPage.value = 1
}

const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value)))

watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) {
    currentPage.value = newTotal
  }
})

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredUsers.value.slice(start, start + pageSize.value)
})

function isPremiumActive(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) > new Date()
}

function formatPremiumDate(dateStr) {
  if (!dateStr) return 'Chưa kích hoạt'
  const date = new Date(dateStr)
  if (date < new Date()) {
    return `Đã hết hạn (${date.toLocaleDateString('vi-VN')})`
  }
  return date.toLocaleDateString('vi-VN')
}

function formatListenHours(sec) {
  if (!sec) return '0'
  return (sec / 3600).toFixed(1)
}

function formatLastActive(dateStr) {
  if (!dateStr) return 'Chưa nghe'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay === 0) {
    if (diffHour > 0) return `${diffHour} giờ trước`
    if (diffMin > 0) return `${diffMin} phút trước`
    return 'Vừa xong'
  }
  if (diffDay < 7) {
    return `${diffDay} ngày trước`
  }
  return date.toLocaleDateString('vi-VN')
}

async function toggleRole(user) {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  const message = user.role === 'admin' 
    ? `Bạn có chắc muốn hạ quyền quản trị của "${user.display_name}"?` 
    : `Người dùng này sẽ có quyền truy cập khu vực quản trị.`
    
  openConfirm({
    title: user.role === 'admin' ? 'Hạ quyền Admin?' : 'Thăng cấp Admin?',
    message: message,
    type: 'warning',
    action: async () => {
      try {
        await api.put(`/admin/users/${user.id}/role`, { role: newRole })
        user.role = newRole
        toast.showToast(`Đã cập nhật quyền Admin thành công`, 'success')
      } catch (err) {
        console.error('Lỗi khi đổi vai trò:', err)
        toast.showToast(err.response?.data?.message || 'Không thể thay đổi quyền người dùng', 'error')
      }
    }
  })
}

function toggleStatus(user) {
  if (user.id === authStore.user?.id) {
    toast.showToast('Bạn không thể khóa tài khoản của chính mình', 'error')
    return
  }

  const isLocked = user.status === 'locked'
  openConfirm({
    title: isLocked ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?',
    message: isLocked 
      ? `Người dùng "${user.display_name}" sẽ có thể đăng nhập lại.` 
      : `Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.`,
    confirmText: isLocked ? 'Mở khóa' : 'Khóa tài khoản',
    type: isLocked ? 'default' : 'warning',
    action: async () => {
      const newStatus = isLocked ? 'active' : 'locked'
      try {
        await api.put(`/admin/users/${user.id}/status`, { status: newStatus })
        user.status = newStatus
        toast.showToast(newStatus === 'active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', 'success')
      } catch (err) {
        console.error('Lỗi khi đổi trạng thái:', err)
        toast.showToast(err.response?.data?.message || 'Không thể cập nhật trạng thái người dùng', 'error')
      }
    }
  })
}

function deleteUser(user) {
  openConfirm({
    title: 'Xóa người dùng?',
    message: `Hành động này có thể ảnh hưởng đến playlist, giao dịch và lịch sử nghe nhạc của người dùng.`,
    confirmText: 'Xóa người dùng',
    type: 'danger',
    action: async () => {
      try {
        await api.delete(`/admin/users/${user.id}`)
        users.value = users.value.filter(u => u.id !== user.id)
        toast.showToast('Đã xóa người dùng thành công', 'success')
      } catch (err) {
        console.error('Lỗi khi xóa người dùng:', err)
        toast.showToast(err.response?.data?.message || 'Không thể xóa người dùng này.', 'error')
      }
    }
  })
}

function goToDetail(userId) {
  router.push(`/admin/users/${userId}`)
}

async function submitAddUser() {
  savingUser.value = true
  try {
    await api.post('/admin/users', newUser.value)
    showAddUserModal.value = false
    newUser.value = { email: '', password: '', display_name: '', role: 'user' }
    fetchUsers()
  } catch (err) {
    console.error('Lỗi khi thêm người dùng:', err)
    toast.showToast(err.response?.data?.message || 'Không thể thêm người dùng', 'error')
  } finally {
    savingUser.value = false
  }
}

function openPremiumModal(user) {
  selectedUser.value = user
  customExpiryDate.value = user.premium_expires_at 
    ? new Date(user.premium_expires_at).toISOString().split('T')[0]
    : ''
  showPremiumModal.value = true
}

async function setPremiumExpiry(days) {
  savingPremium.value = true
  try {
    let expiry = null
    if (days > 0) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      expiry = d.toISOString()
    }
    
    await api.put(`/admin/users/${selectedUser.value.id}/premium`, { premium_expires_at: expiry })
    selectedUser.value.premium_expires_at = expiry
    showPremiumModal.value = false
  } catch (err) {
    console.error('Lỗi khi gia hạn premium:', err)
    toast.showToast(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error')
  } finally {
    savingPremium.value = false
  }
}

async function saveCustomPremiumExpiry() {
  savingPremium.value = true
  try {
    const expiry = customExpiryDate.value ? new Date(customExpiryDate.value).toISOString() : null
    await api.put(`/admin/users/${selectedUser.value.id}/premium`, { premium_expires_at: expiry })
    selectedUser.value.premium_expires_at = expiry
    showPremiumModal.value = false
  } catch (err) {
    console.error('Lỗi khi gia hạn custom premium:', err)
    toast.showToast(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error')
  } finally {
    savingPremium.value = false
  }
}

onMounted(() => {
  fetchUsers()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.manage-users {
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
  overflow-x: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  border: 1px solid #f0f2f5;
  min-height: 450px; /* Ensure space for dropdowns */
}

.users-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
  text-align: left;
  table-layout: fixed;
}
.users-table th {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 2px solid #f0f2f5;
  color: #000000;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.users-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  height: 56px;
}
.user-row {
  transition: background 0.2s;
}
.user-row:hover {
  background: #f8f9fa;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-avatar-placeholder, .user-avatar-img {
  width: 36px;
  height: 36px;
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
  font-size: 14px;
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
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-email {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-badge {
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  display: inline-block;
  text-transform: uppercase;
  white-space: nowrap;
}
.role-badge.admin {
  background: rgba(253, 121, 168, 0.12);
  color: #e84393;
}
.role-badge.user {
  background: rgba(116, 185, 255, 0.12);
  color: #0984e3;
}

.status-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.switch-ui {
  position: relative;
  display: inline-flex;
  height: 20px;
  width: 36px;
  align-items: center;
  border-radius: 9999px;
  background-color: #cbd5e1;
  transition: background-color 0.3s ease;
}
.switch-ui.is-on {
  background-color: #10b981;
}
.switch-knob {
  height: 16px;
  width: 16px;
  border-radius: 9999px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  transform: translateX(2px);
}
.switch-ui.is-on .switch-knob {
  transform: translateX(18px);
}

.premium-date {
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.premium-date.is-active {
  color: #db2777;
  font-weight: 600;
  background: rgba(219, 39, 119, 0.08);
  padding: 4px 8px;
  border-radius: 6px;
}

.last-active-text {
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.playlist-count {
  font-weight: 600;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 12px;
  color: #334155;
}

/* Action Menu */
.action-menu-wrapper {
  position: relative;
  display: inline-block;
}
.btn-action-more {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-action-more:hover {
  background: #f1f5f9;
  color: #334155;
}

.action-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  min-width: 190px;
  padding: 6px 0;
  z-index: 50;
  text-align: left;
}
.action-dropdown.dropdown-up {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 6px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
}
.dropdown-item:hover {
  background: #f8fafc;
}
.dropdown-item.premium-action {
  color: #db2777;
}
.dropdown-item.unlock-action {
  color: #64748b;
}
.dropdown-item.lock-action {
  color: #d97706;
}
.dropdown-item.delete-action {
  color: #e11d48;
}

.dropdown-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 4px 0;
}

/* Modals Overlay */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}
.modal-card {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  overflow: hidden;
}
.modal-header {
  padding: 24px;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h2 {
  font-size: 18px;
  font-weight: 800;
  color: #2d3436;
  margin: 0;
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #b2bec3;
  line-height: 1;
}
.close-btn:hover {
  color: #2d3436;
}
.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.user-preview {
  display: flex;
  gap: 8px;
  font-size: 14px;
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #f0f2f5;
}
.user-preview-title {
  font-weight: 700;
  color: #636e72;
}
.user-preview-name {
  font-weight: 700;
  color: #2d3436;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.form-group label {
  font-size: 12px;
  font-weight: 800;
  color: #a29bfe;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.premium-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.btn-premium-opt {
  background: white;
  border: 2px solid #e4e6eb;
  padding: 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  color: #2d3436;
}
.btn-premium-opt:hover {
  border-color: #fd79a8;
  color: #e84393;
  background: rgba(253, 121, 168, 0.04);
}
.btn-premium-opt.cancel {
  grid-column: span 2;
  border-color: #ff7675;
  color: #d63031;
}
.btn-premium-opt.cancel:hover {
  background: rgba(255, 118, 117, 0.08);
}

.custom-date {
  border-top: 1px dashed #f0f2f5;
  padding-top: 16px;
}
.form-input {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #dfe6e9;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
}
.form-input:focus {
  border-color: #fd79a8;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.btn-secondary {
  background: #f1f2f6;
  color: #2d3436;
  border: 1px solid #dfe6e9;
  padding: 12px 20px;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
}
.btn-secondary:hover {
  background: #dfe6e9;
}
.btn-primary {
  background: linear-gradient(135deg, #fd79a8, #fd79a8);
  color: white;
  padding: 12px 20px;
  border-radius: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 15px rgba(253, 121, 168, 0.3);
  transition: all 0.2s;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(253, 121, 168, 0.4);
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
