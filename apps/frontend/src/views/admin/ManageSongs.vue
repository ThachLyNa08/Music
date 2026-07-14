<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10 font-sans text-gray-800 dark:text-text-base">
    <!-- Header -->
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur dark:bg-bg-card/95 border-b border-gray-200 dark:border-bg-border flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Quản lý bài hát</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Quản lý kho nhạc, metadata, trạng thái hiển thị và hiệu suất nghe của từng bài hát.</p>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <AdminExportButton :loading="exportLoading" @click="handleExport" />
        <!-- Optional Bulk Upload Button -->
        <button class="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-[13px] font-medium bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border hover:bg-gray-50 dark:hover:bg-bg-surface text-gray-700 dark:text-gray-200 rounded-xl transition-all shadow-sm">
          <MfIcon name="upload" size="18" />
          Upload hàng loạt
        </button>
        <AdminAddButton title="Thêm bài hát" @click="openAddModal" />
      </div>
    </header>

    <div class="p-4 md:p-6 flex flex-col gap-4">
      <!-- Group Cards -->
      <SongGroupCards
      :summary="store.groupsSummary"
      :selectedGroup="store.selectedGroup"
      @select-group="handleGroupSelect"
    />

    <!-- Section Title based on Group -->
    <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
      {{ store.selectedGroup === 'ALL' ? 'Tất cả bài hát' : `Bài hát ${groupLabel(store.selectedGroup)}` }}
    </h2>

    <div>
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center w-full">
        <div class="relative w-full xl:flex-1 xl:min-w-[320px]">
          <MfIcon name="search" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            v-model="store.filters.search"
            @input="handleSearchInput"
            @keyup.enter="handleEnter"
            @focus="showHistory = true"
            @blur="handleBlur"
            type="text"
            placeholder="Tìm theo tên bài hát, nghệ sĩ, album..."
            class="admin-input pl-9 pr-8 w-full"
          />
        <button v-if="store.filters.search" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
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
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto xl:shrink-0">
        <AdminSearchSelect 
          v-model="store.filters.genreId"
          :options="formData.genres"
          allLabel="Tất cả thể loại"
          @change="store.applyFilters"
          class="w-full xl:w-36"
        />
        <select v-model="store.filters.status" @change="store.applyFilters" class="admin-input min-w-0 truncate w-full xl:w-36 cursor-pointer">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã ẩn</option>
        </select>
        <select v-model="store.filters.releaseStatus" @change="store.applyFilters" class="admin-input min-w-0 truncate w-full xl:w-36 cursor-pointer">
          <option value="">Tất cả phát hành</option>
          <option value="draft">Nháp</option>
          <option value="scheduled">Lên lịch</option>
          <option value="published">Đã phát hành</option>
          <option value="hidden">Đã ẩn</option>
        </select>
        <select v-model="store.filters.sortBy" @change="store.applyFilters" class="admin-input min-w-0 truncate w-full xl:w-36 cursor-pointer">
          <option value="created_at">Mới nhất</option>
          <option value="play_count">Lượt nghe</option>
          <option value="title">Tên bài hát</option>
          <option value="duration_sec">Thời lượng</option>
        </select>
      </div>
      <AdminResetButton :disabled="store.loading.songs" @click="store.resetFilters" />
      </div>
    </div>

    <!-- Bulk Actions -->
    <div v-if="selectedSongIds.length > 0" class="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3 mb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 animate-fade-in-up">
      <div class="flex items-center gap-2 shrink-0">
        <span class="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{{ selectedSongIds.length }}</span>
        <span class="text-sm font-bold text-indigo-700 dark:text-indigo-400">bài hát được chọn</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button @click="handleBulkStatus('active')" class="px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30">Hiển thị</button>
        <button @click="handleBulkStatus('inactive')" class="px-3 py-1.5 text-xs font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Ẩn</button>
        <div class="h-6 w-px bg-indigo-200 dark:bg-indigo-500/30 mx-1"></div>
        <button @click="handleBulkMarket('VPOP')" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Gán VPOP</button>
        <button @click="handleBulkMarket('KPOP')" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Gán KPOP</button>
        <button @click="handleBulkMarket('USUK')" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Gán USUK</button>
        <div class="h-6 w-px bg-indigo-200 dark:bg-indigo-500/30 mx-1"></div>
        <select v-model="bulkAssignGenreId" class="px-2 py-1.5 text-xs font-medium border border-indigo-200 dark:border-indigo-500/30 rounded-lg bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 focus:outline-none">
          <option value="">Chọn thể loại...</option>
          <option v-for="g in formData.genres" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
        <button @click="handleBulkGenre" :disabled="!bulkAssignGenreId" class="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Gán Thể loại</button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="flex flex-col">
      <AdminTableShell
        maxHeight="500px"
        style="min-height: 500px;"
        :loading="store.loading.songs"
        :empty="!store.loading.songs && store.songs.length === 0"
        emptyTitle="Không tìm thấy bài hát nào"
        emptyDescription="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
      >
        <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
          <thead class="bg-gray-50 dark:bg-bg-card sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]">
            <tr class="text-black dark:text-white uppercase tracking-wider font-bold">
              <th class="py-2 px-3 w-10 text-center">
                <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              </th>
              <th class="py-2 px-3 w-full min-w-[250px]">Tên Bài hát</th>
              <th class="py-2 px-3 min-w-[150px]">Nghệ sĩ</th>
              <th class="py-2 px-3 min-w-[120px]">Thị trường</th>
              <th class="py-2 px-3 min-w-[140px] text-center">Phát hành</th>
              <th class="py-2 px-3 min-w-[120px] text-center">Trạng thái</th>
              <th class="py-2 px-3 w-[80px] text-right sticky right-0 bg-gray-50 dark:bg-bg-card z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr v-for="song in store.songs" :key="song.id" @click="goToDetail(song.id)" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group cursor-pointer" :class="{ 'ring-2 ring-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/20 z-10 relative': route.query.focus == song.id }">
              <!-- Checkbox -->
              <td class="py-2 px-3 text-center" @click.stop>
                <input type="checkbox" :value="song.id" v-model="selectedSongIds" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              </td>
              <!-- Bài hát -->
              <td class="py-2 px-3 max-w-0">
                <div class="flex items-center gap-3">
                  <div class="relative w-10 h-10 shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <img :src="$formatImageUrl(song.cover_url)" @error="e => e.target.src = '/default-cover.png'" loading="lazy" class="w-full h-full rounded-md object-cover shadow-sm bg-gray-100" />
                    <button @click.stop="previewSong(song)" class="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <MfIcon name="play_arrow" filled size="18" className="text-white" />
                    </button>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[13px] font-bold text-gray-900 dark:text-white truncate" :title="song.title">{{ song.title }}</span>
                    <span class="text-[11px] text-gray-400 dark:text-gray-500 font-medium truncate">{{ formatDuration(song.duration_sec) }} • {{ song.play_count }} lượt nghe</span>
                  </div>
                </div>
              </td>
              <!-- Nghệ sĩ -->
              <td class="py-2 px-3 max-w-0">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 truncate max-w-full" :title="song.artist_name || song.artist">
                  {{ song.artist_name || song.artist || 'N/A' }}
                </span>
              </td>
              <!-- Thị trường -->
              <td class="py-2 px-3">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold" :class="{
                  'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400': song.market === 'KPOP',
                  'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400': song.market === 'VPOP',
                  'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400': song.market === 'USUK',
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400': song.market === 'OTHER' || !song.market
                }">
                  {{ song.market || 'OTHER' }}
                </span>
              </td>
              <!-- Trạng thái -->
              <td class="py-2 px-3 text-center">
                <span class="inline-flex px-2 py-0.5 rounded text-[11px] font-bold" :class="releaseBadgeClass(song)">
                  {{ releaseLabel(song) }}
                </span>
              </td>
              <td class="py-2 px-3 text-center" @click.stop>
                <label class="relative inline-flex items-center cursor-pointer" :title="song.is_active ? 'Đang hoạt động' : 'Đã ẩn'">
                  <input type="checkbox" class="sr-only peer" :checked="song.is_active" @change="toggleStatus(song)">
                  <div class="w-7 h-4 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </td>
              <!-- Hành động -->
              <td class="py-2 px-3 text-right sticky right-0 bg-white dark:bg-bg-surface group-hover:bg-gray-50/80 dark:group-hover:bg-bg-card transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-10">
                <div class="flex items-center justify-end">
                  <AdminActionMenu :actions="[
                    { label: 'Chỉnh sửa', icon: 'edit', onClick: () => openEditModal(song) },
                    { label: 'Xóa bài hát', icon: 'delete', danger: true, onClick: () => confirmDelete(song) }
                  ]" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>

      <!-- Pagination -->
      <div v-if="store.pagination.totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden md:inline">Trang {{ store.pagination.page }} / {{ store.pagination.totalPages }}</span>
        <AdminPagination :currentPage="store.pagination.page" :totalPages="store.pagination.totalPages" @update:currentPage="page => store.setPage(page)" />
      </div>
    </div>

    <!-- Cảnh báo Metadata -->
    <MetadataIssuesPanel v-if="metadataIssues.length > 0" :issues="metadataIssues" />

    <!-- Thống kê bài hát -->
    <div v-if="store.statistics">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Thống kê & Phân tích</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopSongsChart :data="store.statistics.topSongs" />
        <GenreDistributionChart :data="store.statistics.genreDistribution" />
      </div>
    </div>

    <!-- Mini Audio Player for Preview -->
    <div v-if="previewUrl" class="fixed bottom-4 right-4 bg-white dark:bg-bg-surface p-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-bg-border z-40 flex items-center gap-4 animate-fade-in-up">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-gray-900 dark:text-white truncate">Đang phát thử...</p>
      </div>
      <audio :src="$formatImageUrl(previewUrl)" controls autoplay class="h-8 max-w-[200px]"></audio>
      <button @click="previewUrl = null" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full">
        <MfIcon name="close" size="20" />
      </button>
    </div>

    <!-- Song Form Modal -->
    <SongFormModal
      :isOpen="isModalOpen"
      :isEditing="isEditing"
      :songData="selectedSongData"
      :metadata="formData"
      :saving="saving"
      :statusMessage="statusMessage"
      :isError="isError"
      @close="closeModal"
      @submit="submitForm"
    />

    <ConfirmDialog
      v-model:open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirmText="confirmState.confirmText"
      :type="confirmState.type"
      :loading="confirmState.loading"
      @confirm="handleConfirm"
    </ConfirmDialog>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useAdminSongStore } from '@/store/adminSongStore';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import SongFormModal from '@/components/admin/SongFormModal.vue';
import SongGroupCards from '@/components/admin/SongGroupCards.vue';
import TopSongsChart from '@/components/admin/charts/TopSongsChart.vue';
import GenreDistributionChart from '@/components/admin/charts/GenreDistributionChart.vue';
import MetadataIssuesPanel from '@/components/admin/MetadataIssuesPanel.vue';
import AdminAddButton from '@/components/admin/AdminAddButton.vue';
import AdminPagination from '@/components/admin/AdminPagination.vue';
import AdminResetButton from '@/components/admin/AdminResetButton.vue';
import AdminExportButton from '@/components/admin/AdminExportButton.vue';
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob';
import AdminTableShell from '@/components/admin/AdminTableShell.vue';
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue';
import AdminSearchSelect from '@/components/admin/AdminSearchSelect.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { useToastStore } from '@/stores/toast';

const store = useAdminSongStore();
const router = useRouter();
const route = useRoute();
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

let searchTimeout = null;
const searchHistory = ref(JSON.parse(localStorage.getItem('adminSongsSearchHistory') || '[]'));
const showHistory = ref(false);

const handleSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    store.applyFilters();
  }, 500);
};

const handleEnter = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  const term = store.filters.search.trim();
  store.applyFilters();
  if (term && !searchHistory.value.includes(term)) {
    searchHistory.value.unshift(term);
    if (searchHistory.value.length > 5) searchHistory.value.pop();
    localStorage.setItem('adminSongsSearchHistory', JSON.stringify(searchHistory.value));
  }
  showHistory.value = false;
};

const selectHistoryItem = (item) => {
  store.filters.search = item;
  store.applyFilters();
  showHistory.value = false;
};

const clearSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  store.filters.search = '';
  store.applyFilters();
  showHistory.value = false;
};

const handleBlur = () => {
  setTimeout(() => {
    showHistory.value = false;
  }, 200);
};

const removeHistoryItem = (item) => {
  searchHistory.value = searchHistory.value.filter(i => i !== item);
  localStorage.setItem('adminSongsSearchHistory', JSON.stringify(searchHistory.value));
};

function goToDetail(id) {
  router.push(`/admin/songs/${id}`);
}

// Bulk Selection State
const selectedSongIds = ref([]);
const isAllSelected = computed(() => {
  return store.songs.length > 0 && selectedSongIds.value.length === store.songs.length
})

const exportLoading = ref(false)

async function handleExport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/songs/export', {
      params: {
        group: store.selectedGroup,
        search: store.filters.search,
        genreId: store.filters.genreId,
        artistId: store.filters.artistId,
        status: store.filters.status,
        releaseStatus: store.filters.releaseStatus,
        sortBy: store.filters.sortBy,
        sortOrder: store.filters.sortOrder
      },
      responseType: 'blob'
    })
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'musicflow-songs.csv'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    toast.error('Không thể xuất báo cáo. Vui lòng thử lại.')
  } finally {
    exportLoading.value = false
  }
}

function toggleSelectAll(e) {
  if (e.target.checked) {
    selectedSongIds.value = store.songs.map(s => s.id);
  } else {
    selectedSongIds.value = [];
  }
}

async function handleBulkStatus(status) {
  const isShow = status === 'active';
  openConfirm({
    title: isShow ? 'Hiển thị bài hát?' : 'Ẩn bài hát?',
    message: `Bạn có chắc muốn ${isShow ? 'hiển thị' : 'ẩn'} ${selectedSongIds.value.length} bài hát?`,
    confirmText: isShow ? 'Hiển thị' : 'Ẩn',
    type: isShow ? 'default' : 'warning',
    action: async () => {
      await store.bulkUpdateStatus(selectedSongIds.value, status);
      selectedSongIds.value = [];
      toast.showToast('Cập nhật trạng thái thành công', 'success');
    }
  });
}

async function handleBulkMarket(market) {
  openConfirm({
    title: 'Gán nhóm khu vực?',
    message: `Bạn có chắc muốn gán nhóm ${market} cho ${selectedSongIds.value.length} bài hát?`,
    confirmText: 'Xác nhận',
    type: 'default',
    action: async () => {
      await store.bulkUpdateMarket(selectedSongIds.value, market);
      selectedSongIds.value = [];
      toast.showToast('Cập nhật khu vực thành công', 'success');
    }
  });
}

const bulkAssignGenreId = ref('');
async function handleBulkGenre() {
  if (!bulkAssignGenreId.value) return;
  openConfirm({
    title: 'Gán thể loại?',
    message: `Bạn có chắc muốn gán thể loại này cho ${selectedSongIds.value.length} bài hát?`,
    confirmText: 'Xác nhận',
    type: 'default',
    action: async () => {
      try {
        await api.post('/admin/genres/bulk-assign', {
          songIds: selectedSongIds.value,
          genreId: bulkAssignGenreId.value,
          role: 'primary'
        });
        toast.showToast(`Đã gán thể loại thành công`, 'success');
        store.fetchSongs();
        store.fetchGroupsSummary();
        selectedSongIds.value = [];
      } catch (err) {
        console.error('Lỗi khi gán thể loại:', err);
        toast.showToast(err.response?.data?.message || 'Có lỗi xảy ra', 'error');
      }
    }
  });
}

// Group Navigation
function handleGroupSelect(key) {
  store.setSelectedGroup(key);
  selectedSongIds.value = [];
}

function groupLabel(key) {
  const map = { KPOP: 'Kpop', VPOP: 'Vpop', USUK: 'US-UK' };
  return map[key] || '';
}

function releaseLabel(song) {
  if (song?.release_status === 'scheduled' && song?.effective_release_status === 'published') return 'Theo lịch'
  return {
    draft: 'Nháp',
    scheduled: 'Lên lịch',
    published: 'Đã phát hành',
    hidden: 'Đã ẩn',
  }[song?.release_status] || 'Không rõ'
}

function releaseBadgeClass(song) {
  if (song?.release_status === 'scheduled' && song?.effective_release_status === 'published') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  return {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    scheduled: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    hidden: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  }[song?.release_status] || 'bg-gray-100 text-gray-700'
}

// Preview Audio
const previewUrl = ref(null);
function previewSong(song) {
  previewUrl.value = song.audio_url;
}

// Metadata Issues Fetching
const metadataIssues = ref([]);
async function fetchMetadataIssues() {
  try {
    const res = await api.get('/admin/songs/metadata-issues');
    metadataIssues.value = res.data.data;
  } catch (e) {
    console.error('Lỗi tải metadata issues:', e);
  }
}

// Form Data & Modal State (Keep existing logic)
const formData = reactive({
  artists: [],
  albums: [],
  genres: []
});

const isModalOpen = ref(false);
const isEditing = ref(false);
const selectedSongId = ref(null);
const selectedSongData = ref(null);
const saving = ref(false);
const statusMessage = ref('');
const isError = ref(false);

async function fetchFormData() {
  try {
    const res = await api.get('/admin/form-data');
    formData.artists = res.data.data.artists;
    formData.albums = res.data.data.albums;
    formData.genres = res.data.data.genres;
  } catch (error) {
    console.error('Lỗi tải metadata form:', error);
  }
}

function openAddModal() {
  isEditing.value = false;
  selectedSongId.value = null;
  selectedSongData.value = null;
  statusMessage.value = '';
  isError.value = false;
  isModalOpen.value = true;
}

function openEditModal(song) {
  isEditing.value = true;
  selectedSongId.value = song.id;
  selectedSongData.value = { ...song };
  statusMessage.value = '';
  isError.value = false;
  isModalOpen.value = true;
}

function closeModal() {
  if (saving.value) return;
  isModalOpen.value = false;
}

async function submitForm(submitData) {
  saving.value = true;
  statusMessage.value = '';

  try {
    if (isEditing.value) {
      await api.put(`/admin/songs/${selectedSongId.value}`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      statusMessage.value = 'Đã cập nhật bài hát thành công!';
      toast.showToast('Cập nhật bài hát thành công!', 'success');
    } else {
      await api.post('/songs/upload', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      statusMessage.value = 'Tải lên thành công!';
      toast.showToast('Thêm bài hát thành công!', 'success');
    }

    // Re-fetch data from store
    await store.fetchGroupsSummary();
    await store.fetchSongs();

    isError.value = false;
    setTimeout(() => { closeModal(); }, 1000);

  } catch (err) {
    statusMessage.value = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu.';
    isError.value = true;
    toast.showToast(statusMessage.value, 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(song) {
  const newStatus = !song.is_active;
  try {
    await api.put(`/admin/songs/${song.id}`, { is_active: newStatus ? 1 : 0 });
    // Update locally or refetch
    store.fetchSongs();
    store.fetchGroupsSummary();
    toast.showToast('Đã cập nhật trạng thái', 'success');
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái:', err);
    toast.showToast('Không thể cập nhật trạng thái bài hát', 'error');
  }
}

function confirmDelete(song) {
  openConfirm({
    title: 'Xóa bài hát?',
    message: `Bạn có chắc chắn muốn xóa bài hát "${song.title}" khỏi hệ thống? Dữ liệu không thể khôi phục.`,
    confirmText: 'Xóa bài hát',
    type: 'danger',
    action: async () => {
      try {
        await api.delete(`/admin/songs/${song.id}`);
        await store.fetchSongs();
        await store.fetchGroupsSummary();
        await store.fetchStatistics();
        toast.showToast('Xóa bài hát thành công!', 'success');
      } catch (err) {
        console.error('Lỗi khi xóa bài hát:', err);
        toast.showToast(err.response?.data?.message || 'Có lỗi khi xóa bài hát', 'error');
      }
    }
  });
}

function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

onMounted(() => {
  if (route.query.search) {
    store.filters.search = route.query.search;
  }
  store.fetchGroupsSummary();
  store.fetchSongs();
  store.fetchStatistics();
  fetchFormData();
  fetchMetadataIssues();
});
</script>

<style scoped>
.full-bleed {
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}
@media (min-width: 1024px) {
  .full-bleed {
    width: auto;
    margin-left: -1.5rem;
    margin-right: -1.5rem;
    margin-top: -1.5rem;
    margin-bottom: -1.5rem;
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
