<template>
  <div class="flex-1 flex flex-col relative full-bleed min-h-0 pb-10 bg-slate-50">
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm mb-6">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 tracking-tight">Giám sát Playlist Hệ thống</h1>
        <p class="text-gray-500 mt-1 text-sm font-medium">Theo dõi trạng thái và bảo trì dữ liệu các playlist hệ thống / tự động</p>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <button class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-60" @click="confirmRegenerateAll" :disabled="isRegeneratingAll">
          <MfIcon v-if="isRegeneratingAll" name="sync" class="spinning" size="18" />
          <MfIcon v-else name="auto_fix_high" size="18" />
          {{ isRegeneratingAll ? 'Đang xử lý...' : 'Tạo lại tất cả' }}
        </button>
      </div>
    </header>

    <div class="px-6 flex flex-col space-y-6">

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminKpiCard
        v-for="item in kpiCards"
        :key="item.title"
        v-bind="item"
        :loading="loading && !summary"
        :showIcon="false"
        compact
        :class="{'cursor-pointer hover:bg-slate-50 transition': !!item.onClick}"
      />
    </div>

    <!-- Main Content Group (Filter, Table, Pagination) -->
    <div class="flex flex-col gap-3">
      <!-- Tra cứu nâng cao -->
      <div>
        <AdminFilterBar class="!mb-0">
        <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
          <AdminSearchInput
            v-model="filters.q"
            placeholder="Từ khóa (Tên / System Key)..."
            icon="search"
            historyKey="admin-playlist-q-history"
            @search="handleSearch"
          />
          
          <AdminSearchInput
            v-model="filters.owner"
            placeholder="Người dùng (Tên, email, ID)..."
            icon="person"
            historyKey="admin-playlist-owner-history"
            @search="handleSearch"
          />

          <SearchableCombobox
            v-model="filters.system_key"
            :options="[{ key: 'all', label: 'Tất cả Loại System Key' }, ...systemKeysOptions]"
            valueKey="key"
            labelKey="label"
            placeholder="Tất cả Loại System Key"
            maxHeightClass="max-h-[128px]"
            compact
            class="w-full xl:w-56 xl:shrink-0"
            @change="handleSearch"
          />

          <select v-model="filters.status" class="admin-input !h-10 text-sm w-full xl:w-44 xl:shrink-0 cursor-pointer" @change="handleSearch">
            <option value="all">Tất cả trạng thái</option>
            <option value="need_update">Cần xử lý</option>
            <option value="active">Bình thường</option>
            <option value="empty">Trống bài hát</option>
            <option value="missing_cover">Thiếu ảnh bìa</option>
          </select>

          <AdminResetButton @click="resetFilters" class="xl:shrink-0 !h-10 !w-10" />
        </div>
      </AdminFilterBar>
      <div v-if="searchWarning" class="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm flex items-center gap-2 border border-rose-100">
        <MfIcon name="warning" size="18" />
        {{ searchWarning }}
      </div>
    </div>

    <!-- Bảng danh sách cần xử lý -->
    <AdminTableShell :loading="loading" :empty="!loading && playlists.length === 0" emptyTitle="Không tìm thấy playlist" emptyDescription="Thử thay đổi bộ lọc." maxHeight="375px">
      <table class="w-full text-left text-sm whitespace-nowrap table-fixed">
        <thead class="bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[25%]">Playlist</th>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[15%]">Người Dùng</th>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[15%]">Loại / System Key</th>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs text-right w-[10%]">Số bài</th>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[15%]">Trạng thái</th>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[10%]">Cập nhật</th>
            <th class="px-4 py-3 font-semibold text-black uppercase text-xs text-right w-[10%] sticky right-0 bg-slate-50 z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in playlists" :key="item.id" class="hover:bg-slate-50 transition group">
            <td class="px-4 py-3 truncate">
              <div class="flex items-center gap-3">
                <AdminCoverThumb :src="getPlaylistCover(item)" size="custom" class="w-10 h-10 shrink-0" rounded="lg" />
                <span class="font-semibold text-slate-900 truncate" :title="item.name">{{ item.name }}</span>
              </div>
            </td>
            <td class="px-4 py-3 truncate">
              <router-link v-if="item.user_id" :to="`/admin/users/${item.user_id}`" class="text-primary hover:underline font-medium">
                {{ item.owner_name || 'User #' + item.user_id }}
              </router-link>
              <span v-else class="text-slate-400">Hệ thống</span>
            </td>
            <td class="px-4 py-3">
              <div class="inline-block px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 border text-slate-600 mb-1" v-if="item.system_key">{{ item.system_key }}</div>
              <div class="text-[11px] text-slate-500 uppercase font-semibold">{{ item.type }}</div>
            </td>
            <td class="px-4 py-3 text-right" :class="{'text-rose-600 font-bold': item.song_count === 0, 'text-slate-700 font-medium': item.song_count > 0}">
              {{ item.song_count }}
            </td>
            <td class="px-4 py-3">
              <span class="status-badge" :class="item.status">{{ formatStatus(item.status) }}</span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500">
              {{ item.updated_at ? new Date(item.updated_at).toLocaleDateString('vi-VN') : 'N/A' }}
            </td>
            <td class="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-10">
              <AdminActionMenu :actions="getToolsActions(item)" />
            </td>
          </tr>
        </tbody>
      </table>
    </AdminTableShell>

    <!-- Pagination -->
    <div v-if="totalPages > 1 || playlists.length > 0" class="flex items-center justify-between mt-1">
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <label>Hiển thị:</label>
        <select v-model="filters.limit" @change="handleLimitChange" class="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>

      <AdminPagination 
        :limit="filters.limit"
        :currentPage="currentPage" 
        :totalPages="totalPages" 
        :disabled="loading"
        @update:currentPage="changePage" 
      />
    </div>

    </div> <!-- End Main Content Group -->

    <!-- Modals & Drawers -->
    <ConfirmDialog
      :open="showConfirmModal"
      title="Xác nhận tạo lại TẤT CẢ System Playlists"
      message="Bạn sắp chạy tiến trình tạo lại hàng loạt cho toàn bộ playlist hệ thống của tất cả người dùng. Quá trình này rất nặng, có thể ảnh hưởng hiệu năng database."
      confirmText="Xác nhận Tạo Lại"
      type="danger"
      @confirm="executeRegenerateAll"
      @cancel="showConfirmModal = false"
    />

    </div> <!-- End px-6 wrapper -->

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

    <!-- Modal Chi Tiết Playlist -->
    <Teleport to="body">
      <div v-if="drawerItem" class="detail-modal-overlay" @click="closeDetailModal">
        <div class="detail-modal-container" @click.stop>
          <div class="detail-modal-header">
            <h3>Chi tiết Playlist</h3>
            <button class="btn-icon" @click="closeDetailModal" :disabled="isRegeneratingSingle">
              <MfIcon name="close" size="24" />
            </button>
          </div>
          
          <div class="detail-modal-body">
            <div class="detail-modal-cover mb-6">
              <AdminCoverThumb 
                :src="getPlaylistCover(drawerItem)" 
                size="custom"
                rounded="lg"
                alt="Cover lớn"
                style="width: 100%; height: 100%; object-fit: cover;"
              />
            </div>
            <h2 class="text-xl font-bold mb-1">{{ drawerItem.name }}</h2>
            <p class="text-sm text-slate-500 mb-4">{{ drawerItem.description || 'Không có mô tả' }}</p>
            
            <div class="flex flex-col gap-2 text-sm text-slate-700 mb-6">
              <div><span class="font-semibold w-28 inline-block">System Key:</span> <span class="system-key-badge">{{ drawerItem.system_key || 'N/A' }}</span></div>
              <div><span class="font-semibold w-28 inline-block">Trạng thái:</span> <span class="status-badge" :class="drawerItem.status">{{ formatStatus(drawerItem.status) }}</span></div>
              <div><span class="font-semibold w-28 inline-block">Số bài hát:</span> {{ drawerItem.song_count }}</div>
              <div><span class="font-semibold w-28 inline-block">Cập nhật lúc:</span> {{ drawerItem.updated_at ? new Date(drawerItem.updated_at).toLocaleString('vi-VN') : 'N/A' }}</div>
              <div v-if="drawerItem.user_id"><span class="font-semibold w-28 inline-block">Owner:</span> {{ drawerItem.owner_name || 'User #' + drawerItem.user_id }}</div>
            </div>

            <h4 class="font-bold text-slate-800 mb-3 border-b pb-2">Danh sách bài hát</h4>
            <div v-if="drawerItem.user_id" class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center gap-3">
              <div>
                <div class="text-slate-800 font-semibold">Danh sách bài hát được quản lý theo từng người dùng</div>
                <div class="text-slate-500 text-sm mt-1">Để xem đầy đủ bài hát trong playlist này, vui lòng mở trang chi tiết người dùng.</div>
              </div>
              <button class="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors" @click="goToUserDetail(drawerItem.user_id)">
                <MfIcon name="open_in_new" size="16" />
                Xem tại Admin User Detail
              </button>
            </div>
            <div v-else class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <div class="text-slate-500 text-sm">Không xác định được người dùng sở hữu playlist này.</div>
            </div>
          </div>
          
          <div class="detail-modal-footer">
            <button class="btn-action primary" @click="regenerateSingle(drawerItem)" :disabled="isRegeneratingSingle">
              <MfIcon v-if="isRegeneratingSingle" name="sync" class="spinning" size="18" />
              <MfIcon v-else name="sync" size="18" /> 
              {{ isRegeneratingSingle ? 'Đang xử lý...' : 'Tạo lại Playlist này' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import AdminCoverThumb from '@/components/admin/AdminCoverThumb.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import { getPlaylistCover } from '@/utils/imageUrl'
import SearchableCombobox from '@/components/common/SearchableCombobox.vue'
import AdminSearchInput from '@/components/admin/AdminSearchInput.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

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
  owner: '',
  system_key: 'all',
  status: 'need_update', // Mặc định là cần xử lý
  limit: 20
})

const systemKeysOptions = ref([])

const isRegeneratingAll = ref(false)
const showConfirmModal = ref(false)
const regenerateResult = ref(null)

const openActionMenuId = ref(null)
const drawerItem = ref(null)
const isRegeneratingSingle = ref(false)

function closeDetailModal() {
  if (isRegeneratingSingle.value) return;
  drawerItem.value = null;
  document.body.style.overflow = '';
}

const hasActiveFilters = computed(() => {
  return filters.q || filters.owner || filters.system_key !== 'all' || filters.status !== 'need_update'
})

function percent(value, total) {
  if (!total) return '0%'
  return `${((Number(value || 0) / Number(total)) * 100).toFixed(1)}%`
}

const kpiCards = computed(() => {
  if (!summary.value) return Array(4).fill({})
  const s = summary.value
  const total = s.total_playlists || 0
  const activePlaylists = total - s.empty_playlists - s.missing_cover_playlists

  return [
    { 
      title: 'Tổng Playlist', 
      value: formatNumber(total), 
      subtitle: 'Hệ thống', 
      tone: 'purple',
      meta: '100%' 
    },
    { 
      title: 'Đang Hoạt Động', 
      value: formatNumber(activePlaylists), 
      subtitle: 'Trạng thái bình thường', 
      tone: 'green',
      meta: percent(activePlaylists, total)
    },
    { 
      title: 'Playlist Trống', 
      value: formatNumber(s.empty_playlists), 
      subtitle: '0 bài hát', 
      tone: 'amber', 
      meta: percent(s.empty_playlists, total),
      onClick: () => setFilter('empty') 
    },
    { 
      title: 'Thiếu Ảnh Bìa', 
      value: formatNumber(s.missing_cover_playlists), 
      subtitle: 'Cần cập nhật cover', 
      tone: 'rose', 
      meta: percent(s.missing_cover_playlists, total),
      onClick: () => setFilter('missing_cover') 
    },
  ]
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

async function fetchSystemKeys() {
  try {
    const res = await api.get('/admin/system-playlists/system-keys')
    systemKeysOptions.value = res.data?.data || []
  } catch (err) {
    console.error('Lỗi lấy system keys:', err)
  }
}

async function fetchPlaylists(page = 1) {
  // Validate if status is 'all' and no filter
  if (filters.status === 'all' && !filters.q && !filters.owner && filters.system_key === 'all') {
    searchWarning.value = 'Vui lòng nhập từ khóa, chọn người dùng hoặc chọn system key trước khi tra cứu toàn bộ.'
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
let searchTimeout = null
function debounceSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    handleSearch()
  }, 400)
}

function handleSearch() {
  fetchPlaylists(1)
}

function resetFilters() {
  filters.q = ''
  filters.owner = ''
  filters.system_key = 'all'
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

function handleLimitChange() {
  fetchPlaylists(1)
}

function toggleActionMenu(id) {
  openActionMenuId.value = openActionMenuId.value === id ? null : id
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function getToolsActions(item) {
  const actions = [
    { label: 'Xem chi tiết', icon: 'visibility', onClick: () => viewDetail(item) }
  ]
  if (item.user_id) {
    actions.push({ label: 'Xem người dùng', icon: 'person', onClick: () => router.push(`/admin/users/${item.user_id}`) })
  }
  actions.push({ label: 'Tạo lại playlist này', icon: 'sync', onClick: () => regenerateSingle(item) })
  if (item.system_key) {
    actions.push({ label: 'Sao chép system_key', icon: 'content_copy', onClick: () => copySystemKey(item.system_key) })
  }
  return actions
}

function viewDetail(item) {
  closeActionMenu()
  drawerItem.value = item
  document.body.style.overflow = 'hidden'
}

function goToUserDetail(userId) {
  closeDetailModal()
  router.push(`/admin/users/${userId}`)
}

function copySystemKey(key) {
  closeActionMenu()
  navigator.clipboard.writeText(key)
  toast.showToast('Đã sao chép System Key', 'success')
}

async function regenerateSingle(item) {
  closeActionMenu()
  isRegeneratingSingle.value = true
  toast.showToast('Đang tạo lại...', 'info')
  try {
    await api.post(`/admin/system-playlists/${item.id}/regenerate`)
    toast.showToast('Đã tạo lại thành công', 'success')
    fetchPlaylists(currentPage.value)
    if (drawerItem.value && drawerItem.value.id === item.id) {
      drawerItem.value = null
      document.body.style.overflow = ''
    }
  } catch (err) {
    toast.showToast(err.response?.data?.message || 'Lỗi khi tạo lại', 'error')
  } finally {
    isRegeneratingSingle.value = false
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

const handleKeydown = (e) => {
  if (e.key === 'Escape' && drawerItem.value) {
    closeDetailModal();
  }
}

onMounted(() => {
  fetchSummary()
  fetchSystemKeys()
  fetchPlaylists(1)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.maintenance-dashboard {
  background-color: #f8fafc;
  min-height: 100vh;
  color: #0f172a;
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
.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label { 
  color: #0f172a; 
  font-size: 12px; 
  font-weight: 700; 
  text-transform: uppercase; 
  line-height: 1.4;
}
.stat-value { 
  font-size: 32px; 
  font-weight: 800; 
  line-height: 1.1; 
  word-break: break-word;
}
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

/* Detail Modal (Center) */
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.detail-modal-container {
  background: white;
  width: calc(100vw - 32px);
  max-width: 640px;
  max-height: calc(100vh - 64px);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-fade-in 0.2s ease-out;
}

@keyframes modal-fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.detail-modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.detail-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.detail-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.detail-modal-cover {
  width: 200px;
  height: 200px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: #f1f5f9;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.detail-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: center;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

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
