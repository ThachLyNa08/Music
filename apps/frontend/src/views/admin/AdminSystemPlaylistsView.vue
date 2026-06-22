<template>
  <div class="maintenance-dashboard">
    <header class="dashboard-header">
      <div>
        <h1 class="page-title">Giám sát Playlist Hệ thống</h1>
        <p class="page-subtitle">Theo dõi trạng thái và bảo trì dữ liệu các playlist hệ thống / tự động</p>
      </div>
      <div class="header-actions">
        <button class="btn-action primary" @click="confirmRegenerateAll" :disabled="isRegeneratingAll">
          <MfIcon v-if="isRegeneratingAll" name="sync" class="spinning" size="18" />
          <MfIcon v-else name="auto_fix_high" size="18" />
          {{ isRegeneratingAll ? 'Đang xử lý...' : 'Tạo lại tất cả' }}
        </button>
      </div>
    </header>

    <!-- Thống kê tổng quan -->
    <div class="stats-grid" v-if="summary">
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Tổng Playlist Hệ Thống</span>
          <span class="stat-value text-indigo">{{ formatNumber(summary.total_playlists) }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Đang Hoạt Động</span>
          <span class="stat-value text-green">{{ formatNumber(summary.total_playlists - summary.empty_playlists - summary.missing_cover_playlists) }}</span>
        </div>
        <div class="stat-meta">Trạng thái bình thường</div>
      </div>
      <div class="stat-card cursor-pointer" @click="setFilter('empty')" title="Lọc playlist trống">
        <div class="stat-content">
          <span class="stat-label">Playlist Trống</span>
          <span class="stat-value text-amber">{{ formatNumber(summary.empty_playlists) }}</span>
        </div>
        <div class="stat-meta">0 bài hát</div>
      </div>
      <div class="stat-card cursor-pointer" @click="setFilter('missing_cover')" title="Lọc playlist thiếu ảnh">
        <div class="stat-content">
          <span class="stat-label">Thiếu Ảnh Bìa</span>
          <span class="stat-value text-orange">{{ formatNumber(summary.missing_cover_playlists) }}</span>
        </div>
        <div class="stat-meta">Chưa có cover/first_song_cover</div>
      </div>
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Tổng Số Bài Hát</span>
          <span class="stat-value text-blue">{{ formatNumber(summary.total_songs) }}</span>
        </div>
      </div>
    </div>

    <!-- Tra cứu nâng cao -->
    <div class="panel filter-panel">
      <div class="panel-header" @click="toggleAdvancedSearch" style="cursor: pointer;">
        <h2>
          <MfIcon name="search" size="20" /> Tra cứu nâng cao
          <span v-if="hasActiveFilters" class="filter-badge">Có bộ lọc</span>
        </h2>
        <MfIcon :name="showAdvancedSearch ? 'expand_less' : 'expand_more'" size="20" />
      </div>
      
      <div class="panel-body" v-show="showAdvancedSearch">
        <div class="filter-grid">
          <div class="filter-group">
            <label>Từ khóa (Tên / System Key)</label>
            <input type="text" v-model="filters.q" placeholder="Nhập từ khóa..." class="form-input" @keyup.enter="handleSearch">
          </div>
          
          <div class="filter-group">
            <label>Trạng thái</label>
            <select v-model="filters.status" class="form-input">
              <option value="need_update">Cần xử lý (Lỗi/Trống)</option>
              <option value="all">Tất cả</option>
              <option value="active">Bình thường (Active)</option>
              <option value="empty">Trống bài hát</option>
              <option value="missing_cover">Thiếu ảnh bìa</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Loại System Key</label>
            <select v-model="filters.type" class="form-input">
              <option value="all">Tất cả</option>
              <option value="dailymix">Daily Mix</option>
              <option value="weeklymix">Weekly Mix</option>
              <option value="morning_vibes">Morning Vibes</option>
              <option value="night_vibes">Night Vibes</option>
              <option value="mood">Mood Mix</option>
              <option value="genre">Genre Mix</option>
            </select>
          </div>
        </div>
        
        <div v-if="searchWarning" class="alert-warning mt-4">
          <MfIcon name="warning" size="18" />
          {{ searchWarning }}
        </div>
        
        <div class="filter-actions mt-4">
          <button class="btn-action" @click="resetFilters">Xóa bộ lọc</button>
          <button class="btn-action primary" @click="handleSearch">Tìm kiếm</button>
        </div>
      </div>
    </div>

    <!-- Bảng danh sách cần xử lý -->
    <div class="panel mt-6">
      <div class="panel-header">
        <h2>
          <MfIcon name="list_alt" size="20" />
          {{ filters.status === 'need_update' ? 'Danh sách cần xử lý' : 'Kết quả tra cứu' }}
        </h2>
        <span class="text-sm text-slate-500">Hiển thị {{ playlists.length }} / {{ totalItems }} kết quả</span>
      </div>
      
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Playlist</th>
              <th>Người Dùng (Owner)</th>
              <th>Loại / System Key</th>
              <th>Số bài</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th class="text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="text-center py-8">
                <div class="spinner inline-block"></div>
                <div class="mt-2 text-slate-500">Đang tải dữ liệu...</div>
              </td>
            </tr>
            <tr v-else-if="playlists.length === 0">
              <td colspan="7" class="text-center py-8 text-slate-500">
                Không tìm thấy playlist nào phù hợp.
              </td>
            </tr>
            <tr v-else v-for="item in playlists" :key="item.id">
              <td>
                <div class="flex items-center gap-3">
                  <div class="playlist-cover">
                    <img :src="normalizeCoverUrl(item)" @error="handleImageError" alt="Cover" />
                  </div>
                  <div>
                    <div class="font-semibold text-slate-900">{{ item.name }}</div>
                  </div>
                </div>
              </td>
              <td>
                <router-link v-if="item.user_id" :to="`/admin/users/${item.user_id}`" class="text-indigo-600 hover:underline">
                  {{ item.owner_name || 'User #' + item.user_id }}
                </router-link>
                <span v-else class="text-slate-400">Hệ thống</span>
              </td>
              <td>
                <div class="system-key-badge" v-if="item.system_key">{{ item.system_key }}</div>
                <div class="text-xs text-slate-500 mt-1 uppercase">{{ item.type }}</div>
              </td>
              <td :class="{'text-red-500 font-bold': item.song_count === 0}">
                {{ item.song_count }}
              </td>
              <td>
                <span class="status-badge" :class="item.status">
                  {{ formatStatus(item.status) }}
                </span>
              </td>
              <td class="text-sm text-slate-500">
                {{ item.updated_at ? new Date(item.updated_at).toLocaleDateString('vi-VN') : 'N/A' }}
              </td>
              <td>
                <div class="action-menu-container" v-click-outside="() => closeActionMenu(item.id)">
                  <button class="btn-icon" @click.stop="toggleActionMenu(item.id)">
                    <MfIcon name="more_vert" size="20" />
                  </button>
                  <div v-if="openActionMenuId === item.id" class="dropdown-menu">
                    <button class="dropdown-item" @click="viewDetail(item)">
                      <MfIcon name="visibility" size="16" /> Xem chi tiết
                    </button>
                    <button class="dropdown-item" v-if="item.user_id" @click="$router.push(`/admin/users/${item.user_id}`)">
                      <MfIcon name="person" size="16" /> Xem người dùng
                    </button>
                    <button class="dropdown-item" @click="regenerateSingle(item)">
                      <MfIcon name="sync" size="16" /> Tạo lại playlist này
                    </button>
                    <button class="dropdown-item" v-if="item.system_key" @click="copySystemKey(item.system_key)">
                      <MfIcon name="content_copy" size="16" /> Sao chép system_key
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="btn-page" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
          <MfIcon name="chevron_left" size="20" />
        </button>
        <span class="page-info">Trang {{ currentPage }} / {{ totalPages }}</span>
        <button class="btn-page" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">
          <MfIcon name="chevron_right" size="20" />
        </button>
      </div>
    </div>

    <!-- Modals & Drawers -->
    <!-- Confirm Modal for Regenerate All -->
    <div class="modal-backdrop" v-if="showConfirmModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Xác nhận tạo lại TẤT CẢ System Playlists</h3>
        </div>
        <div class="modal-body">
          <p class="text-slate-600 mb-4">Bạn sắp chạy tiến trình tạo lại hàng loạt cho toàn bộ playlist hệ thống của tất cả người dùng.</p>
          <div class="alert-warning mb-4">
            <MfIcon name="warning" size="20" />
            Quá trình này rất nặng, có thể ảnh hưởng hiệu năng database và mất vài phút để hoàn thành. Hãy đảm bảo chạy vào giờ thấp điểm.
          </div>
          <p class="text-sm font-semibold text-slate-800">Bạn có chắc chắn muốn tiếp tục?</p>
        </div>
        <div class="modal-footer">
          <button class="btn-action" @click="showConfirmModal = false">Hủy bỏ</button>
          <button class="btn-action primary" @click="executeRegenerateAll">Xác nhận Tạo Lại</button>
        </div>
      </div>
    </div>

    <!-- Regenerate Result Modal -->
    <div class="modal-backdrop" v-if="regenerateResult">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Kết quả Tạo Lại</h3>
        </div>
        <div class="modal-body">
          <div class="result-stats flex gap-4 mb-4">
            <div class="stat-box success">
              <span class="block text-2xl font-bold">{{ regenerateResult.success }}</span>
              <span class="text-xs uppercase text-slate-500">Thành công</span>
            </div>
            <div class="stat-box failed">
              <span class="block text-2xl font-bold">{{ regenerateResult.failed }}</span>
              <span class="text-xs uppercase text-slate-500">Thất bại</span>
            </div>
            <div class="stat-box total">
              <span class="block text-2xl font-bold">{{ regenerateResult.total }}</span>
              <span class="text-xs uppercase text-slate-500">Tổng cộng</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-action primary" @click="closeResultModal">Đóng</button>
        </div>
      </div>
    </div>

    <!-- Drawer Chi Tiết (Reuse logic cũ gọn lại) -->
    <div class="drawer-overlay" v-if="drawerItem" @click="drawerItem = null"></div>
    <div class="drawer-content" :class="{ 'open': drawerItem }">
      <div class="drawer-header" v-if="drawerItem">
        <h3>Chi tiết Playlist</h3>
        <button class="btn-icon" @click="drawerItem = null"><MfIcon name="close" size="24" /></button>
      </div>
      <div class="drawer-body" v-if="drawerItem">
        <div class="drawer-cover mb-4">
          <img :src="normalizeCoverUrl(drawerItem)" @error="handleImageError" alt="Cover lớn" />
        </div>
        <h2 class="text-xl font-bold mb-1">{{ drawerItem.name }}</h2>
        <p class="text-sm text-slate-500 mb-4">{{ drawerItem.description || 'Không có mô tả' }}</p>
        
        <div class="flex flex-col gap-2 text-sm text-slate-700 mb-6">
          <div><span class="font-semibold w-24 inline-block">System Key:</span> <span class="system-key-badge">{{ drawerItem.system_key || 'N/A' }}</span></div>
          <div><span class="font-semibold w-24 inline-block">Trạng thái:</span> <span class="status-badge" :class="drawerItem.status">{{ formatStatus(drawerItem.status) }}</span></div>
          <div><span class="font-semibold w-24 inline-block">Số bài hát:</span> {{ drawerItem.song_count }}</div>
          <div><span class="font-semibold w-24 inline-block">Cập nhật lúc:</span> {{ drawerItem.updated_at ? new Date(drawerItem.updated_at).toLocaleString('vi-VN') : 'N/A' }}</div>
        </div>

        <button class="btn-action primary w-full justify-center mb-6" @click="regenerateSingle(drawerItem)">
          <MfIcon name="sync" size="18" /> Tạo lại Playlist này
        </button>

        <h4 class="font-bold text-slate-800 mb-3 border-b pb-2">Danh sách bài hát (Đang chờ load)</h4>
        <div class="empty-text p-4 text-center bg-slate-50 rounded-lg border border-slate-100">
          Chức năng xem danh sách bài hát thật trong drawer vui lòng xem bên AdminUserDetailView.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const router = useRouter()

// Refs
const summary = ref(null)
const playlists = ref([])
const loading = ref(false)
const totalItems = ref(0)
const totalPages = ref(1)
const currentPage = ref(1)

const showAdvancedSearch = ref(false)
const searchWarning = ref('')

const filters = reactive({
  q: '',
  type: 'all',
  status: 'need_update', // Mặc định là cần xử lý
  limit: 20
})

const isRegeneratingAll = ref(false)
const showConfirmModal = ref(false)
const regenerateResult = ref(null)

const openActionMenuId = ref(null)
const drawerItem = ref(null)

const hasActiveFilters = computed(() => {
  return filters.q || filters.type !== 'all' || filters.status !== 'need_update'
})

// Directive for click outside
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}

// APIs
async function fetchSummary() {
  try {
    const res = await api.get('/admin/system-playlists/summary')
    summary.value = res.data?.data || null
  } catch (err) {
    console.error('Lỗi lấy summary:', err)
  }
}

async function fetchPlaylists(page = 1) {
  // Validate if status is 'all' and no filter
  if (filters.status === 'all' && !filters.q && filters.type === 'all') {
    searchWarning.value = 'Vui lòng nhập từ khóa hoặc chọn loại playlist trước khi tra cứu toàn bộ để tránh tải quá nhiều dữ liệu.'
    playlists.value = []
    return
  }

  searchWarning.value = ''
  loading.value = true
  try {
    const res = await api.get('/admin/system-playlists', {
      params: { ...filters, page, limit: filters.limit }
    })
    playlists.value = res.data?.data || []
    totalItems.value = res.data?.pagination?.total || 0
    totalPages.value = res.data?.pagination?.totalPages || 1
    currentPage.value = page
  } catch (err) {
    toast.showToast('Lỗi khi tải danh sách playlist', 'error')
  } finally {
    loading.value = false
  }
}

// Actions
function handleSearch() {
  fetchPlaylists(1)
}

function resetFilters() {
  filters.q = ''
  filters.type = 'all'
  filters.status = 'need_update'
  fetchPlaylists(1)
}

function setFilter(statusFilter) {
  filters.status = statusFilter
  showAdvancedSearch.value = true
  fetchPlaylists(1)
}

function toggleAdvancedSearch() {
  showAdvancedSearch.value = !showAdvancedSearch.value
}

function changePage(p) {
  if (p < 1 || p > totalPages.value) return
  fetchPlaylists(p)
}

function toggleActionMenu(id) {
  openActionMenuId.value = openActionMenuId.value === id ? null : id
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function viewDetail(item) {
  closeActionMenu()
  drawerItem.value = item
}

function copySystemKey(key) {
  closeActionMenu()
  navigator.clipboard.writeText(key)
  toast.showToast('Đã sao chép System Key', 'success')
}

async function regenerateSingle(item) {
  closeActionMenu()
  toast.showToast('Đang tạo lại...', 'info')
  try {
    await api.post(`/admin/system-playlists/${item.id}/regenerate`)
    toast.showToast('Đã tạo lại thành công', 'success')
    fetchPlaylists(currentPage.value)
    if (drawerItem.value && drawerItem.value.id === item.id) {
      drawerItem.value = null // Close drawer for simplicity
    }
  } catch (err) {
    toast.showToast(err.response?.data?.message || 'Lỗi khi tạo lại', 'error')
  }
}

function confirmRegenerateAll() {
  showConfirmModal.value = true
}

async function executeRegenerateAll() {
  showConfirmModal.value = false
  isRegeneratingAll.value = true
  toast.showToast('Bắt đầu tiến trình tạo lại hàng loạt...', 'info')
  try {
    const res = await api.post('/admin/system-playlists/regenerate-all')
    regenerateResult.value = res.data?.data || { success: 0, failed: 0, total: 0 }
    fetchSummary()
    fetchPlaylists(1)
  } catch (err) {
    toast.showToast('Lỗi tiến trình tạo lại hàng loạt', 'error')
  } finally {
    isRegeneratingAll.value = false
  }
}

function closeResultModal() {
  regenerateResult.value = null
}

// Utils
function normalizeCoverUrl(pl) {
  if (pl.cover_url) return pl.cover_url
  if (pl.first_song_cover_url) return pl.first_song_cover_url
  return '/default_playlist_cover.png'
}

function handleImageError(e) {
  e.target.src = '/default_playlist_cover.png' // Fallback image or a generated data URI
}

function formatStatus(status) {
  const map = {
    'ok': 'Hoạt động',
    'active': 'Hoạt động',
    'empty': 'Trống',
    'missing_cover': 'Thiếu ảnh bìa'
  }
  return map[status] || status
}

function formatNumber(num) {
  return num ? new Intl.NumberFormat('vi-VN').format(num) : '0'
}

onMounted(() => {
  fetchSummary()
  fetchPlaylists(1)
})
</script>

<style scoped>
.maintenance-dashboard {
  padding: 24px;
  background-color: #f8fafc;
  min-height: 100vh;
  color: #0f172a;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
}
.page-subtitle {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

/* Base Components */
.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-action:hover:not(:disabled) {
  background: #f1f5f9;
}
.btn-action.primary {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #ffffff;
}
.btn-action.primary:hover:not(:disabled) {
  background: #6d28d9;
}
.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.btn-icon:hover { background: #f1f5f9; color: #0f172a; }

.panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  margin-bottom: 24px;
}
.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #fdfdfd;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-body { padding: 20px; }

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card.cursor-pointer:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.stat-label { color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.stat-value { font-size: 28px; font-weight: 800; line-height: 1.2; }
.stat-meta { font-size: 12px; color: #94a3b8; }
.text-indigo { color: #7c3aed; }
.text-green { color: #16a34a; }
.text-amber { color: #d97706; }
.text-orange { color: #ea580c; }
.text-blue { color: #2563eb; }

/* Filters */
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}
.filter-group { display: flex; flex-direction: column; gap: 6px; }
.filter-group label { font-size: 13px; font-weight: 600; color: #475569; }
.form-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}
.form-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1); }
.filter-actions { display: flex; gap: 12px; justify-content: flex-end; }
.filter-badge { background: #7c3aed; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 10px; }

/* Alerts */
.alert-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Table */
.table-responsive { overflow-x: auto; }
.admin-table {
  width: 100%;
  border-collapse: collapse;
}
.admin-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  background: #fdfdfd;
  text-transform: uppercase;
  white-space: nowrap;
}
.admin-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  vertical-align: middle;
}
.playlist-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  flex-shrink: 0;
}
.playlist-cover img { width: 100%; height: 100%; object-fit: cover; }

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.status-badge.ok, .status-badge.active { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.status-badge.empty { background: #f1f5f9; color: #64748b; border-color: #cbd5e1; }
.status-badge.missing_cover { background: #fff7ed; color: #ea580c; border-color: #ffedd5; }

.system-key-badge {
  font-family: monospace;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #334155;
  border: 1px solid #e2e8f0;
  display: inline-block;
}

/* Action Menu */
.action-menu-container { position: relative; display: flex; justify-content: center; }
.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  border-radius: 8px;
  z-index: 10;
  width: 200px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #334155;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
}
.dropdown-item:hover { background: #f1f5f9; }

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 16px 20px;
}
.btn-page {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 13px; font-weight: 600; color: #475569; }

/* Modal & Drawers */
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal-content {
  background: white;
  width: 90%;
  max-width: 500px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
.modal-header { padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
.modal-body { padding: 24px; }
.modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }

.result-stats { display: flex; justify-content: space-between; }
.stat-box { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
.stat-box.success { background: #f0fdf4; color: #16a34a; }
.stat-box.failed { background: #fef2f2; color: #dc2626; }
.stat-box.total { background: #f1f5f9; color: #475569; }

.drawer-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15,23,42,0.4); z-index: 40;
}
.drawer-content {
  position: fixed; top: 0; right: -400px; width: 400px; max-width: 100%; height: 100vh;
  background: white; z-index: 50; transition: right 0.3s;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 15px rgba(0,0,0,0.05);
}
.drawer-content.open { right: 0; }
.drawer-header { padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.drawer-body { padding: 24px; flex: 1; overflow-y: auto; }
.drawer-cover { width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
.drawer-cover img { width: 100%; height: 100%; object-fit: cover; }

.spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(124, 58, 237, 0.2);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }
</style>
