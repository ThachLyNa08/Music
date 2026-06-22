<template>
  <div class="p-4 md:p-6 bg-gray-50 dark:bg-bg-base min-h-screen text-gray-800 dark:text-text-base font-sans">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Quản lý thể loại</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Quản lý taxonomy thể loại phục vụ gợi ý nhạc, Cold Start và Genre Deep Dive.</p>
      </div>
      <div class="flex gap-2">
        <AdminAddButton title="Thêm thể loại" @click="openCreateModal" />
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-100 dark:border-bg-border shadow-sm">
        <div class="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">Tổng thể loại</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</div>
      </div>
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-100 dark:border-bg-border shadow-sm">
        <div class="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">Đang hoạt động</div>
        <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ stats.active }}</div>
      </div>
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-100 dark:border-bg-border shadow-sm">
        <div class="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">Featured</div>
        <div class="text-2xl font-bold text-amber-500 dark:text-amber-400">{{ stats.featured }}</div>
      </div>
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-100 dark:border-bg-border shadow-sm">
        <div class="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">Lượt nghe 7 ngày</div>
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ formatNumber(stats.listens) }}</div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col md:flex-row gap-3 mb-5">
      <div class="relative flex-1">
        <MfIcon name="search" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input 
          v-model="filters.search"
          @keyup.enter="fetchGenres"
          type="text" 
          placeholder="Tìm kiếm thể loại..."
          class="w-full pl-9 pr-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow shadow-sm"
        >
      </div>
      <div class="w-full md:w-40">
        <select 
          v-model="filters.status"
          @change="fetchGenres"
          class="w-full px-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="hidden">Đã ẩn</option>
        </select>
      </div>
      <div class="w-full md:w-40">
        <select 
          v-model="filters.featured"
          @change="fetchGenres"
          class="w-full px-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer"
        >
          <option value="all">Tất cả (Featured)</option>
          <option value="true">Chỉ Featured</option>
          <option value="false">Không Featured</option>
        </select>
      </div>
      <button 
        @click="fetchGenres"
        class="px-4 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-bg-surface transition-colors shadow-sm flex items-center justify-center gap-2"
        title="Làm mới"
      >
        Làm mới
      </button>
    </div>

    <!-- Data Table -->
    <div class="relative bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl shadow-sm overflow-hidden mb-8 min-h-[500px] flex flex-col">
      <div v-if="loading" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/55 dark:bg-bg-surface/60 backdrop-blur-[1px] transition-opacity duration-300">
        <div class="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p class="font-medium text-sm text-gray-700 dark:text-gray-300">Đang tải dữ liệu...</p>
      </div>

      <div v-if="genres.length === 0 && !loading" class="flex-1 p-16 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <MfIcon name="music_off" size="64" className="mb-4 text-gray-300 dark:text-gray-600" />
        <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-1">Không tìm thấy thể loại nào</h3>
        <p class="text-sm dark:text-text-secondary">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
      </div>

      <div v-else class="flex-1 overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50/50 dark:bg-bg-card/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-100 dark:border-bg-border">
              <th class="py-3 px-4 min-w-[250px] whitespace-nowrap">Tên thể loại</th>
              <th class="py-3 px-4 min-w-[200px] whitespace-nowrap">Thông tin</th>
              <th class="py-3 px-4 min-w-[120px] text-center whitespace-nowrap">Bài hát</th>
              <th class="py-3 px-4 min-w-[140px] text-center whitespace-nowrap">Trạng thái</th>
              <th class="py-3 px-4 w-[120px] text-right whitespace-nowrap">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr v-for="genre in genres" :key="genre.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
              <!-- Tên Thể loại & Cover -->
              <td class="py-3 px-4 max-w-0">
                <div class="flex items-center gap-3">
                  <div class="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-bg-border flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <img v-if="genre.cover_url || genre.coverUrl" :src="$formatImageUrl(genre.cover_url || genre.coverUrl)" class="w-full h-full object-cover" alt="cover">
                    <div v-else class="text-gray-500 font-bold flex items-center justify-center">
                      <span v-if="genre.icon" class="text-xl" :style="{ color: genre.color || 'inherit' }">{{ genre.icon }}</span>
                      <span v-else class="text-xl uppercase" :style="{ color: genre.color || 'inherit' }">{{ genre.name ? genre.name.charAt(0) : 'G' }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-sm font-bold text-gray-900 dark:text-white truncate">{{ genre.name }}</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500 font-medium truncate">{{ genre.slug }}</span>
                  </div>
                </div>
              </td>
              <!-- Thông tin -->
              <td class="py-3 px-4 max-w-[200px] truncate text-sm text-gray-600 dark:text-gray-300" :title="genre.description">
                {{ genre.description || '—' }}
              </td>
              <!-- Bài hát -->
              <td class="py-3 px-4 text-center">
                <button @click="openSongsDrawer(genre)" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                  {{ formatNumber(genre.song_count) }} bài
                </button>
              </td>
              <!-- Trạng thái -->
              <td class="py-3 px-4 text-center">
                <div class="flex flex-col gap-1 items-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold" :class="genre.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'">
                    {{ genre.status === 'active' ? 'Hoạt động' : 'Đã ẩn' }}
                  </span>
                  <button @click="toggleFeatured(genre)" class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" :class="genre.is_featured ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30' : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'">
                    {{ genre.is_featured ? 'Nổi bật' : 'Bình thường' }}
                  </button>
                </div>
              </td>
              <!-- Hành động -->
              <td class="py-3 px-4 text-right">
                <div class="relative inline-block text-left">
                  <button @click="toggleDropdown(genre.id)" class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors focus:outline-none" title="Thao tác">
                    <span class="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-indigo-500">
                      Thao tác <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </span>
                  </button>

                  <div v-if="activeDropdown === genre.id" class="absolute right-0 mt-2 w-40 rounded-xl shadow-lg bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border z-20 origin-top-right focus:outline-none py-1 overflow-hidden" v-click-outside="closeDropdown">
                    <button @click="openSongsDrawer(genre); closeDropdown()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-bg-card font-medium">
                      Xem bài hát
                    </button>
                    <button @click="openEditModal(genre); closeDropdown()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-bg-card font-medium">
                      Sửa thông tin
                    </button>
                    <button @click="openMergeModal(genre); closeDropdown()" class="w-full text-left px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 font-medium">
                      Gộp thể loại
                    </button>
                    <button @click="toggleStatus(genre); closeDropdown()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-bg-card font-medium">
                      {{ genre.status === 'active' ? 'Ẩn thể loại' : 'Hiện thể loại' }}
                    </button>
                    <button @click="deleteGenre(genre); closeDropdown()" class="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-medium">
                      Xoá
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium hidden md:inline">Trang {{ pagination.page }} / {{ pagination.totalPages }}</span>
        <AdminPagination :currentPage="pagination.page" :totalPages="pagination.totalPages" @update:currentPage="changePage" />
      </div>
    </div>

    <!-- Modals & Drawers -->
    <GenreFormModal 
      v-if="showFormModal" 
      :genre="editingGenre" 
      @close="showFormModal = false" 
      @success="handleFormSuccess"
    />
    <GenreMergeModal 
      v-if="showMergeModal" 
      :sourceGenre="mergeSource" 
      :genres="genres"
      @close="showMergeModal = false" 
      @success="handleMergeSuccess"
    />
    <GenreSongsDrawer 
      v-if="showSongsDrawer" 
      :genre="activeDrawerGenre" 
      @close="showSongsDrawer = false" 
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';
import GenreFormModal from '@/components/admin/GenreFormModal.vue';
import GenreMergeModal from '@/components/admin/GenreMergeModal.vue';
import GenreSongsDrawer from '@/components/admin/GenreSongsDrawer.vue';
import AdminAddButton from '@/components/admin/AdminAddButton.vue';
import AdminPagination from '@/components/admin/AdminPagination.vue';
import MfIcon from '@/components/common/MfIcon.vue'; // Optional if not global

const toast = useToastStore();

const loading = ref(false);
const genres = ref([]);
const pagination = reactive({ page: 1, limit: 10, totalPages: 1, total: 0 });
const filters = reactive({ search: '', status: 'all', featured: 'all' });
const activeDropdown = ref(null);

const stats = reactive({
  total: 0,
  active: 0,
  featured: 0,
  listens: 0
});

// Modals state
const showFormModal = ref(false);
const editingGenre = ref(null);
const showMergeModal = ref(false);
const mergeSource = ref(null);
const showSongsDrawer = ref(false);
const activeDrawerGenre = ref(null);

// Custom directive for v-click-outside
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = function(event) {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent);
  }
};

onMounted(() => {
  fetchGenres();
});

const fetchGenres = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      status: filters.status,
      featured: filters.featured
    };
    
    const { data } = await api.get('/admin/genres', { params });
    genres.value = data.data;
    Object.assign(pagination, data.pagination);
    
    if (params.page === 1 && !params.search && params.status === 'all' && params.featured === 'all') {
      stats.total = data.pagination.total;
      stats.active = genres.value.filter(g => g.status === 'active').length;
      stats.featured = genres.value.filter(g => g.is_featured).length;
      stats.listens = genres.value.reduce((sum, g) => sum + (g.listens_7d || 0), 0);
    }
  } catch (error) {
    toast.showToast('Lỗi khi tải danh sách thể loại', 'error');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const changePage = (page) => {
  pagination.page = page;
  fetchGenres();
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const toggleDropdown = (id) => {
  activeDropdown.value = activeDropdown.value === id ? null : id;
};

const closeDropdown = () => {
  activeDropdown.value = null;
};

// Form Actions
const openCreateModal = () => {
  editingGenre.value = null;
  showFormModal.value = true;
};

const openEditModal = (genre) => {
  editingGenre.value = { ...genre };
  showFormModal.value = true;
};

const handleFormSuccess = () => {
  showFormModal.value = false;
  fetchGenres();
};

// Merge Actions
const openMergeModal = (genre) => {
  mergeSource.value = genre;
  showMergeModal.value = true;
};

const handleMergeSuccess = () => {
  showMergeModal.value = false;
  fetchGenres();
};

// Drawer Actions
const openSongsDrawer = (genre) => {
  activeDrawerGenre.value = genre;
  showSongsDrawer.value = true;
};

// Quick Actions
const toggleStatus = async (genre) => {
  try {
    const newStatus = genre.status === 'active' ? 'hidden' : 'active';
    await api.patch(`/admin/genres/${genre.id}/status`, { status: newStatus });
    toast.showToast(`Đã ${newStatus === 'active' ? 'hiện' : 'ẩn'} thể loại`, 'success');
    genre.status = newStatus;
  } catch (error) {
    toast.showToast(error.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error');
  }
};

const toggleFeatured = async (genre) => {
  try {
    const newValue = !genre.is_featured;
    await api.patch(`/admin/genres/${genre.id}/featured`, { is_featured: newValue });
    toast.showToast(`Đã ${newValue ? 'bật' : 'tắt'} featured`, 'success');
    genre.is_featured = newValue ? 1 : 0;
  } catch (error) {
    toast.showToast('Lỗi khi cập nhật featured', 'error');
  }
};

const deleteGenre = async (genre) => {
  if (!confirm(`Bạn có chắc chắn muốn xoá thể loại "${genre.name}"?`)) return;
  
  try {
    await api.delete(`/admin/genres/${genre.id}`);
    toast.showToast('Đã ẩn/xoá thể loại thành công', 'success');
    fetchGenres();
  } catch (error) {
    toast.showToast(error.response?.data?.message || 'Không thể xoá thể loại này', 'error');
  }
};
</script>
