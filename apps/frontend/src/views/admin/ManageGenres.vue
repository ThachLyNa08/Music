<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10">
    <!-- Header Hero -->
    <header class="sticky -top-6 z-30 py-6 bg-white dark:bg-bg-surface border-b border-gray-100 dark:border-bg-border overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center px-6 shrink-0 gap-4">
      <!-- Background subtle gradient -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-2">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Taxonomy Center</h1>
          <span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-100 dark:border-indigo-500/20">
            Quản lý Thể loại
          </span>
        </div>
        <p class="text-gray-500 dark:text-text-secondary text-sm font-medium max-w-2xl">
          Trung tâm quản lý phân loại âm nhạc. Dữ liệu tại đây điều phối thuật toán Gợi ý (Recommendation), trải nghiệm người dùng mới (Cold Start) và bộ máy AI Playlist.
        </p>
      </div>
      <div class="relative z-10 flex gap-2">
        <AdminExportButton :loading="exportLoading" @click="handleExport" />
        <AdminAddButton title="Thêm thể loại" @click="openCreateModal" />
      </div>
    </header>

    <div class="p-4 md:p-6 flex flex-col space-y-6">
      <!-- Stat Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 mb-2">
        <AdminKpiCard
          v-for="item in genreKpiCards"
          :key="item.title"
          v-bind="item"
          :loading="isStatsLoading"
          :show-icon="false"
          compact
        />
      </div>

    <!-- Genre Intelligence -->
    <h2 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
      <MfIcon name="ai" size="18" class="text-indigo-500" />
      Genre Intelligence
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <!-- Trending -->
      <div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl shadow-md text-white relative overflow-hidden group">
        <MfIcon name="activity" size="80" class="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 transition-transform" />
        <div class="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
          Đang Trending
        </div>
        <div v-if="insights.trending && insights.trending.length > 0" class="space-y-1">
          <div v-for="(t, idx) in insights.trending" :key="t.id" class="text-sm font-bold truncate flex justify-between">
            <span>{{ idx + 1 }}. {{ t.name }}</span>
            <span class="text-white/70 text-xs">{{ formatNumber(t.listens) }}</span>
          </div>
        </div>
        <div v-else class="text-sm">Chưa có dữ liệu</div>
      </div>
      
      <!-- Needs Optimization -->
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm relative overflow-hidden">
        <div class="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-blue-500">
          Cần tối ưu gợi ý
        </div>
        <div class="flex items-end gap-2">
          <span class="text-3xl font-black text-gray-900 dark:text-white">{{ insights.needs_optimization_count }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">thể loại</span>
        </div>
        <p class="text-[10px] text-gray-400 mt-1">Đang bật Suggest nhưng ít lượt nghe (< 50).</p>
      </div>

      <!-- Few Songs -->
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm relative overflow-hidden">
        <div class="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-amber-500">
          Quá ít bài hát
        </div>
        <div class="flex items-end gap-2">
          <span class="text-3xl font-black text-gray-900 dark:text-white">{{ insights.few_songs_count }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">thể loại</span>
        </div>
        <p class="text-[10px] text-gray-400 mt-1">Có dưới 50 bài hát, ảnh hưởng Cold Start.</p>
      </div>

      <!-- Missing Data -->
      <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-sm relative overflow-hidden">
        <div class="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-rose-500">
          Thiếu Metadata
        </div>
        <div class="flex items-end gap-2">
          <span class="text-3xl font-black text-gray-900 dark:text-white">{{ insights.missing_data_count }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">thể loại</span>
        </div>
        <p class="text-[10px] text-gray-400 mt-1">Chưa có ảnh Cover hoặc Mô tả.</p>
      </div>
    </div>

    <!-- Filters & Bulk Actions -->
    <div class="flex flex-col xl:flex-row justify-between gap-3 mb-2">
      <AdminFilterBar class="flex-1 !mb-0">
        <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
          <div class="relative flex-1 min-w-[200px]">
            <MfIcon name="search" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input 
              v-model="filters.search"
              @input="handleSearchInput"
              @keyup.enter="handleEnter"
              @focus="showHistory = true"
              @blur="handleBlur"
              type="text" 
              placeholder="Tìm kiếm thể loại..."
              class="admin-input pl-9 pr-8 w-full"
            >
          <button v-if="filters.search" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
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
          <select 
            v-model="filters.data_status"
            @change="fetchGenres"
            class="admin-input w-full xl:w-40 xl:shrink-0 cursor-pointer"
          >
            <option value="all">Tất cả dữ liệu</option>
            <option value="has_data">Có dữ liệu</option>
            <option value="no_data">Chưa có dữ liệu</option>
          </select>
          <select 
            v-model="filters.taxonomy_flag"
            @change="fetchGenres"
            class="admin-input w-full xl:w-48 xl:shrink-0 cursor-pointer"
          >
            <option value="all">Mọi cờ Taxonomy</option>
            <option value="cold_start">Dùng Cold Start</option>
            <option value="recommendation">Dùng Recommendation</option>
            <option value="ai_playlist">Dùng AI Playlist</option>
          </select>
          <select 
            v-model="filters.featured"
            @change="fetchGenres"
            class="admin-input w-full xl:w-40 xl:shrink-0 cursor-pointer"
          >
            <option value="all">Tất cả Featured</option>
            <option value="true">Được Featured</option>
            <option value="false">Không Featured</option>
          </select>
          <AdminResetButton :disabled="isLoading" @click="resetFilters" class="xl:shrink-0" />
        </div>
      </AdminFilterBar>

      <!-- Bulk Actions -->
      <div v-if="selectedGenres.length > 0" class="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-500/20 shadow-sm animate-fade-in">
        <span class="text-xs font-bold text-indigo-700 dark:text-indigo-300 mr-2">{{ selectedGenres.length }} đã chọn</span>
        <select 
          v-model="bulkAction"
          class="px-2 py-1 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-lg text-xs font-medium text-gray-900 dark:text-white focus:outline-none appearance-none cursor-pointer"
        >
          <option value="">-- Chọn thao tác --</option>
          <option value="status_active">Hiện thể loại</option>
          <option value="status_hidden">Ẩn thể loại</option>
          <option value="featured_true">Bật Featured</option>
          <option value="featured_false">Tắt Featured</option>
          <option value="tax_rec_true">Bật Gợi ý</option>
          <option value="tax_rec_false">Tắt Gợi ý</option>
        </select>
        <button 
          @click="applyBulkAction"
          :disabled="!bulkAction"
          class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
        >
          Áp dụng
        </button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="flex-1 flex flex-col mb-8">
      <AdminTableShell 
        maxHeight="375px"
        :loading="loading" 
        :empty="!loading && genres.length === 0" 
        emptyTitle="Không tìm thấy thể loại nào" 
        emptySubtitle="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
      >
        <table class="w-full text-left border-collapse text-sm whitespace-nowrap table-fixed">
          <thead class="bg-gray-50 dark:bg-bg-card sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
            <tr>
              <th class="py-3 px-2 w-[50px] min-w-[50px] max-w-[50px] text-center sticky left-0 z-30 bg-gray-50 dark:bg-bg-card">
                <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
              </th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 w-[220px] min-w-[220px] sticky left-[50px] z-30 bg-gray-50 dark:bg-bg-card shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">Thể loại</th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 w-[120px]">Market/Parent</th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 text-center w-[140px]">Data (Bài/NS/Alb)</th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 text-center w-[110px]">Lượt nghe 7N</th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 text-center w-[130px]">Taxonomy Flags</th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 text-center w-[100px]">Trạng thái</th>
              <th class="py-3 px-4 font-bold text-gray-900 dark:text-gray-300 w-[80px] text-right sticky right-0 z-30 bg-gray-50 dark:bg-bg-card shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)]">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr 
              v-for="genre in genres" 
              :key="genre.id" 
              class="hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer"
              @click="openDetailDrawer(genre.id, $event)"
            >
              <!-- Checkbox -->
              <td class="py-3 px-2 w-[50px] min-w-[50px] max-w-[50px] text-center sticky left-0 z-10 bg-white dark:bg-bg-surface group-hover:bg-indigo-50/30 dark:group-hover:bg-indigo-500/5 transition-colors" @click.stop>
                <input type="checkbox" :value="genre.id" v-model="selectedGenres" class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
              </td>

              <!-- Tên Thể loại & Cover -->
              <td class="py-3 px-4 sticky left-[50px] z-10 bg-white dark:bg-bg-surface group-hover:bg-indigo-50/30 dark:group-hover:bg-indigo-500/5 transition-colors shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                <div class="flex items-center gap-3">
                  <div class="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-bg-border flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <img v-if="genre.cover_url || genre.coverUrl" :src="$formatImageUrl(genre.cover_url || genre.coverUrl)" class="w-full h-full object-cover" alt="cover">
                    <div v-else class="text-gray-500 font-bold flex items-center justify-center text-sm">
                      <span v-if="genre.icon" :style="{ color: genre.color || 'inherit' }">{{ genre.icon }}</span>
                      <span v-else class="uppercase" :style="{ color: genre.color || 'inherit' }">{{ genre.name ? genre.name.charAt(0) : 'G' }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-extrabold text-gray-900 dark:text-white truncate">{{ genre.name }}</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500 font-medium truncate">{{ genre.slug }}</span>
                  </div>
                </div>
              </td>

              <!-- Market / Subgenre -->
              <td class="py-3 px-4">
                <div class="flex flex-col gap-1 items-start">
                  <span v-if="genre.market && genre.market !== 'OTHER'" class="inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {{ genre.market }}
                    <span v-if="genre.parent_id" class="text-gray-400 font-normal ml-1">/ {{ getParentName(genre.parent_id) || 'Sub' }}</span>
                  </span>
                  <span v-else class="inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400" title="Cần chuẩn hoá lại">
                    Chưa phân loại
                  </span>
                </div>
              </td>

              <!-- Data Stats -->
              <td class="py-3 px-4 text-center">
                <div v-if="genre.song_count > 0" class="text-xs font-medium text-gray-600 dark:text-gray-300">
                  <span class="font-bold text-gray-900 dark:text-white">{{ formatNumber(genre.song_count) }}</span> <span class="text-[10px] text-gray-400">bài</span>
                  <div class="text-[10px] text-gray-400 mt-0.5">
                    {{ formatNumber(genre.artist_count) }} NS • {{ formatNumber(genre.album_count) }} Alb
                  </div>
                </div>
                <div v-else class="text-[11px] font-bold text-gray-400 bg-gray-50 dark:bg-bg-card px-2 py-1 rounded inline-block">
                  Chưa gắn bài hát
                </div>
              </td>

              <!-- Lượt nghe 7N -->
              <td class="py-3 px-4 text-center">
                <span class="text-sm font-bold text-blue-600 dark:text-blue-400" :class="{'text-gray-300 dark:text-gray-600': !genre.listens_7d}">{{ formatNumber(genre.listens_7d) }}</span>
              </td>

              <!-- Taxonomy Flags -->
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-1.5 text-xs font-bold">
                  <div :class="genre.use_in_recommendation ? 'text-indigo-500' : 'text-gray-200 dark:text-gray-700'" title="Dùng cho Gợi ý (Recommendation)">
                    <span v-if="genre.use_in_recommendation">✨</span><span v-else class="text-[10px]">REC</span>
                  </div>
                  <div :class="genre.use_in_cold_start ? 'text-emerald-500' : 'text-gray-200 dark:text-gray-700'" title="Dùng cho Cold Start (Người dùng mới)">
                    <span v-if="genre.use_in_cold_start">🌱</span><span v-else class="text-[10px]">COLD</span>
                  </div>
                  <div :class="genre.use_in_ai_playlist ? 'text-amber-500' : 'text-gray-200 dark:text-gray-700'" title="Dùng cho AI Playlist">
                    <span v-if="genre.use_in_ai_playlist">🤖</span><span v-else class="text-[10px]">AI</span>
                  </div>
                </div>
              </td>

              <!-- Trạng thái -->
              <td class="py-3 px-4 text-center">
                <div class="flex flex-col gap-1 items-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" :class="genre.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'">
                    {{ genre.status === 'active' ? 'Active' : 'Hidden' }}
                  </span>
                  <span v-if="genre.is_featured" class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
                    Featured
                  </span>
                </div>
              </td>

              <!-- Hành động -->
              <td class="py-3 px-4 text-right sticky right-0 z-10 bg-white dark:bg-bg-surface group-hover:bg-indigo-50/30 dark:group-hover:bg-indigo-500/5 transition-colors shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)]" @click.stop>
                <div class="flex justify-end">
                  <AdminActionMenu :actions="getGenreActions(genre)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30 mt-auto">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium hidden md:inline">Trang {{ pagination.page }} / {{ pagination.totalPages }}</span>
        <AdminPagination v-model:currentPage="pagination.page" :totalPages="pagination.totalPages" @update:currentPage="changePage" />
      </div>
    </div>

    <!-- Modals & Drawers -->
    <GenreFormModal 
      v-if="showFormModal" 
      :genre="editingGenre" 
      :genres="allGenresForDropdown"
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
    <!-- New Detail Drawer -->
    <GenreDetailDrawer
      v-if="showDetailDrawer"
      :genreId="activeDetailGenreId"
      @close="showDetailDrawer = false"
      @updated="fetchGenres"
    />

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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';
import AdminAddButton from '@/components/admin/AdminAddButton.vue';
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue';
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue';
import AdminExportButton from '@/components/admin/AdminExportButton.vue';
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob';
import AdminTableShell from '@/components/admin/AdminTableShell.vue';
import AdminPagination from '@/components/admin/AdminPagination.vue';
import AdminResetButton from '@/components/admin/AdminResetButton.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue';

const toast = useToastStore();

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
});

function openConfirm(options) {
  confirmState.value = { ...confirmState.value, ...options, open: true, loading: false };
}

async function handleConfirm() {
  if (!confirmState.value.action) return;
  confirmState.value.loading = true;
  try {
    await confirmState.value.action();
  } finally {
    confirmState.value.open = false;
    confirmState.value.loading = false;
  }
}

function getGenreActions(genre) {
  return [
    {
      label: 'Sửa thông tin',
      icon: 'edit',
      onClick: () => openEditModal(genre)
    },
    {
      label: 'Gộp thể loại',
      icon: 'call_merge',
      variant: 'warning',
      onClick: () => openMergeModal(genre)
    },
    {
      label: 'Xoá',
      icon: 'delete',
      danger: true,
      onClick: () => deleteGenre(genre)
    }
  ]
}

const loading = ref(false);
const isStatsLoading = ref(false);
const genres = ref([]);
const allGenresForDropdown = ref([]);
const pagination = reactive({ page: 1, limit: 10, totalPages: 1, total: 0 });
const filters = reactive({ search: '', status: 'all', featured: 'all', data_status: 'all', taxonomy_flag: 'all' });
const activeDropdown = ref(null);

const summary = reactive({
  total: 0,
  active_total: 0,
  active_with_data: 0,
  empty_active: 0,
  featured: 0,
  listens_7d: 0,
  users_selected: 0,
  playlist_usage: 0
});

const insights = reactive({
  trending: [],
  missing_data_count: 0,
  few_songs_count: 0,
  needs_optimization_count: 0
});

// Bulk Action State
const selectedGenres = ref([]);
const bulkAction = ref('');

// Modals & Drawers state
const showFormModal = ref(false);
const editingGenre = ref(null);
const showMergeModal = ref(false);
const mergeSource = ref(null);
const showSongsDrawer = ref(false);
const activeDrawerGenre = ref(null);
const showDetailDrawer = ref(false);
const activeDetailGenreId = ref(null);

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

const isAllSelected = computed(() => {
  return genres.value.length > 0 && selectedGenres.value.length === genres.value.length;
});

onMounted(() => {
  fetchDashboardData();
  fetchGenres();
  fetchAllGenresForDropdown();
});

const fetchDashboardData = async () => {
  isStatsLoading.value = true;
  try {
    const [summaryRes, insightsRes] = await Promise.all([
      api.get('/admin/genres/summary'),
      api.get('/admin/genres/insights')
    ]);
    if (summaryRes.data.success) Object.assign(summary, summaryRes.data.data);
    if (insightsRes.data.success) Object.assign(insights, insightsRes.data.data);
  } catch (error) {
    console.error('Lỗi khi tải dashboard data', error);
  } finally {
    isStatsLoading.value = false;
  }
};

const fetchGenres = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      status: filters.status,
      featured: filters.featured,
      data_status: filters.data_status,
      taxonomy_flag: filters.taxonomy_flag
    };
    
    const { data } = await api.get('/admin/genres', { params });
    genres.value = data.data;
    Object.assign(pagination, data.pagination);
    selectedGenres.value = []; // reset selection on page change
  } catch (error) {
    toast.showToast('Lỗi khi tải danh sách thể loại', 'error');
  } finally {
    loading.value = false;
  }
};

const exportLoading = ref(false)

async function handleExport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/genres/export', {
      params: {
        search: filters.search,
        status: filters.status,
        featured: filters.featured,
        data_status: filters.data_status,
        taxonomy_flag: filters.taxonomy_flag
      },
      responseType: 'blob'
    })
    
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'musicflow-genres.csv'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    toast.showToast('Không thể xuất báo cáo. Vui lòng thử lại.', 'error')
  } finally {
    exportLoading.value = false
  }
}

// Search & History
const searchTimeout = ref(null);
const showHistory = ref(false);
const searchHistory = ref(JSON.parse(localStorage.getItem('adminGenresSearchHistory') || '[]'));

const saveSearchHistory = (term) => {
  const t = term?.trim();
  if (t && !searchHistory.value.includes(t)) {
    searchHistory.value.unshift(t);
    if (searchHistory.value.length > 5) searchHistory.value.pop();
    localStorage.setItem('adminGenresSearchHistory', JSON.stringify(searchHistory.value));
  }
};

const handleSearchInput = () => {
  clearTimeout(searchTimeout.value);
  searchTimeout.value = setTimeout(() => {
    pagination.page = 1;
    fetchGenres();
  }, 500);
};

const handleEnter = () => {
  clearTimeout(searchTimeout.value);
  pagination.page = 1;
  fetchGenres();
  saveSearchHistory(filters.search);
  showHistory.value = false;
};

const clearSearch = () => {
  filters.search = '';
  pagination.page = 1;
  fetchGenres();
  showHistory.value = false;
};

const handleBlur = () => {
  setTimeout(() => {
    showHistory.value = false;
  }, 200);
};

const selectHistoryItem = (item) => {
  filters.search = item;
  showHistory.value = false;
  pagination.page = 1;
  fetchGenres();
};

const removeHistoryItem = (item) => {
  searchHistory.value = searchHistory.value.filter(i => i !== item);
  localStorage.setItem('adminGenresSearchHistory', JSON.stringify(searchHistory.value));
};

const getParentName = (parentId) => {
  if (!parentId) return '';
  const parent = allGenresForDropdown.value.find(g => g.id === parentId);
  return parent ? parent.name : '';
};

const fetchAllGenresForDropdown = async () => {
  try {
    const { data } = await api.get('/admin/genres', { params: { limit: 1000 } });
    allGenresForDropdown.value = data.data;
  } catch (e) {
    // ignore
  }
};

const toggleSelectAll = (e) => {
  if (e.target.checked) {
    selectedGenres.value = genres.value.map(g => g.id);
  } else {
    selectedGenres.value = [];
  }
};

const applyBulkAction = async () => {
  if (!bulkAction.value || selectedGenres.value.length === 0) return;
  
  openConfirm({
    title: 'Thao tác hàng loạt?',
    message: `Bạn có chắc chắn muốn áp dụng thao tác này cho ${selectedGenres.value.length} thể loại?`,
    confirmText: 'Thực hiện',
    type: 'warning',
    action: async () => {
      try {
        let payload = { genreIds: selectedGenres.value };
        
        if (bulkAction.value.startsWith('status_')) {
          payload.action = 'status';
          payload.value = bulkAction.value.split('_')[1];
        } else if (bulkAction.value.startsWith('featured_')) {
          payload.action = 'featured';
          payload.value = bulkAction.value === 'featured_true';
        } else if (bulkAction.value.startsWith('tax_rec_')) {
          payload.action = 'taxonomy';
          payload.value = { use_in_recommendation: bulkAction.value === 'tax_rec_true' };
        }

        await api.patch('/admin/genres/bulk-action', payload);
        toast.showToast('Thao tác hàng loạt thành công', 'success');
        
        selectedGenres.value = [];
        bulkAction.value = '';
        fetchGenres();
        fetchDashboardData();
      } catch (error) {
        toast.showToast('Lỗi khi thực hiện bulk action', 'error');
      }
    }
  });
};

const changePage = (page) => {
  pagination.page = page;
  fetchGenres();
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const genreKpiCards = computed(() => [
  {
    title: 'Tổng thể loại',
    value: summary.total,
    subtitle: 'Trong thư viện',
    icon: 'music',
    tone: 'blue'
  },
  {
    title: 'Hoạt động',
    value: summary.active_with_data,
    subtitle: `${summary.empty_active || 0} rỗng`,
    icon: 'check',
    tone: 'green'
  },
  {
    title: 'Featured',
    value: summary.featured,
    subtitle: 'Đang nổi bật',
    icon: 'star',
    tone: 'amber'
  },
  {
    title: 'Nghe 7 ngày',
    value: formatNumber(summary.listens_7d),
    subtitle: 'Tổng lượt nghe',
    icon: 'activity',
    tone: 'purple'
  },
  {
    title: 'User đăng ký',
    value: formatNumber(summary.users_selected),
    subtitle: 'Theo gu nghe',
    icon: 'users',
    tone: 'cyan'
  },
  {
    title: 'Playlist dùng',
    value: formatNumber(summary.playlist_usage),
    subtitle: 'AI/System playlist',
    icon: 'list-music',
    tone: 'rose'
  }
]);

const toggleDropdown = (id) => {
  activeDropdown.value = activeDropdown.value === id ? null : id;
};

const closeDropdown = () => {
  activeDropdown.value = null;
};

const openDetailDrawer = (id, event) => {
  // Prevent opening drawer if clicking on checkbox or actions
  if (event.target.closest('input[type="checkbox"]') || event.target.closest('button')) return;
  
  activeDetailGenreId.value = id;
  showDetailDrawer.value = true;
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
  fetchAllGenresForDropdown();
  fetchDashboardData();
};

// Merge Actions
const openMergeModal = (genre) => {
  mergeSource.value = genre;
  showMergeModal.value = true;
};

const handleMergeSuccess = () => {
  showMergeModal.value = false;
  fetchGenres();
  fetchDashboardData();
};

// Drawer Actions
const openSongsDrawer = (genre) => {
  activeDrawerGenre.value = genre;
  showSongsDrawer.value = true;
};

// Quick Actions
const deleteGenre = async (genre) => {
  openConfirm({
    title: 'Xóa thể loại?',
    message: `Bạn có chắc chắn muốn xoá thể loại "${genre.name}"?`,
    confirmText: 'Xóa thể loại',
    type: 'danger',
    action: async () => {
      try {
        await api.delete(`/admin/genres/${genre.id}`);
        toast.showToast('Đã ẩn/xoá thể loại thành công', 'success');
        fetchGenres();
        fetchDashboardData();
      } catch (error) {
        toast.showToast(error.response?.data?.message || 'Không thể xoá thể loại này', 'error');
      }
    }
  });
};
</script>
