<template>
  <div class="p-4 md:p-6 bg-gray-50 dark:bg-bg-base min-h-screen text-gray-800 dark:text-text-base font-sans">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Quản lý bài hát</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Quản lý kho nhạc, metadata, trạng thái hiển thị và hiệu suất nghe của từng bài hát.</p>
      </div>
      <div class="flex gap-2">
        <!-- Optional Bulk Upload Button -->
        <button class="flex items-center gap-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border hover:bg-gray-50 dark:hover:bg-bg-surface text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Upload hàng loạt
        </button>
        <button @click="openAddModal" class="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Thêm bài hát
        </button>
      </div>
    </div>

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

    <!-- Filters & Search -->
    <div class="flex flex-col md:flex-row gap-3 mb-5">
      <div class="relative flex-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
          <circle cx="11" cy="11" r="8" />
          <path stroke-linecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input v-model="store.filters.search" @keyup.enter="store.applyFilters" type="text" placeholder="Tìm theo tên bài hát, nghệ sĩ, album..." class="w-full pl-9 pr-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow shadow-sm" />
      </div>
      <div class="w-full md:w-40">
        <select v-model="store.filters.genreId" @change="store.applyFilters" class="w-full px-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="">Tất cả thể loại</option>
          <option v-for="g in formData.genres" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </div>
      <div class="w-full md:w-40">
        <select v-model="store.filters.status" @change="store.applyFilters" class="w-full px-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã ẩn</option>
        </select>
      </div>
      <div class="w-full md:w-40">
        <select v-model="store.filters.sortBy" @change="store.applyFilters" class="w-full px-3 py-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="created_at">Mới nhất</option>
          <option value="play_count">Lượt nghe</option>
          <option value="title">Tên bài hát</option>
          <option value="duration_sec">Thời lượng</option>
        </select>
      </div>
      <button @click="store.resetFilters" class="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        Reset
      </button>
    </div>

    <!-- Bulk Actions -->
    <div v-if="selectedSongIds.length > 0" class="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3 mb-5 flex items-center justify-between animate-fade-in-up">
      <div class="flex items-center gap-2">
        <span class="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{{ selectedSongIds.length }}</span>
        <span class="text-sm font-bold text-indigo-700 dark:text-indigo-400">bài hát được chọn</span>
      </div>
      <div class="flex gap-2">
        <button @click="handleBulkStatus('active')" class="px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30">Hiển thị</button>
        <button @click="handleBulkStatus('inactive')" class="px-3 py-1.5 text-xs font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Ẩn</button>
        <div class="h-6 w-px bg-indigo-200 dark:bg-indigo-500/30 mx-1"></div>
        <button @click="handleBulkMarket('VPOP')" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Gán VPOP</button>
        <button @click="handleBulkMarket('KPOP')" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Gán KPOP</button>
        <button @click="handleBulkMarket('USUK')" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Gán USUK</button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl shadow-sm overflow-hidden mb-8">
      <div v-if="store.loading.songs" class="p-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <div class="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p class="font-medium text-sm">Đang tải danh sách bài hát...</p>
      </div>

      <div v-else-if="store.songs.length === 0" class="p-16 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 0v5.25m0-5.25l-10.5 3m0 0v5.25m0-5.25L3 18v-5.25m0 0l10.5-3" />
        </svg>
        <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-1">Không tìm thấy bài hát nào</h3>
        <p class="text-sm dark:text-text-secondary">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50/50 dark:bg-bg-card/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-100 dark:border-bg-border">
              <th class="py-3 px-4 w-12 text-center">
                <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              </th>
              <th class="py-3 px-4 w-1/3">Tên Bài hát</th>
              <th class="py-3 px-4">Nghệ sĩ</th>
              <th class="py-3 px-4">Thị trường</th>
              <th class="py-3 px-4 text-center">Trạng thái</th>
              <th class="py-3 px-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr v-for="song in store.songs" :key="song.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
              <!-- Checkbox -->
              <td class="py-3 px-4 text-center">
                <input type="checkbox" :value="song.id" v-model="selectedSongIds" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              </td>
              <!-- Bài hát -->
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div class="relative w-10 h-10 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <img :src="$formatImageUrl(song.cover_url)" @error="e => e.target.src = '/default-cover.png'" class="w-full h-full rounded-md object-cover shadow-sm" />
                    <button @click="previewSong(song)" class="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                  </div>
                  <div class="flex flex-col overflow-hidden">
                    <span class="text-sm font-bold text-gray-900 dark:text-white truncate" :title="song.title">{{ song.title }}</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">{{ formatDuration(song.duration_sec) }} • {{ song.play_count }} lượt nghe</span>
                  </div>
                </div>
              </td>
              <!-- Nghệ sĩ -->
              <td class="py-3 px-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 truncate max-w-[150px]" :title="song.artist_name || song.artist">
                  {{ song.artist_name || song.artist || 'N/A' }}
                </span>
              </td>
              <!-- Thị trường -->
              <td class="py-3 px-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold" :class="{
                  'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400': song.market === 'KPOP',
                  'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400': song.market === 'VPOP',
                  'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400': song.market === 'USUK',
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400': song.market === 'OTHER' || !song.market
                }">
                  {{ song.market || 'OTHER' }}
                </span>
              </td>
              <!-- Trạng thái -->
              <td class="py-3 px-4 text-center">
                <label class="relative inline-flex items-center cursor-pointer" :title="song.is_active ? 'Đang hoạt động' : 'Đã ẩn'">
                  <input type="checkbox" class="sr-only peer" :checked="song.is_active" @change="toggleStatus(song)">
                  <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </td>
              <!-- Hành động -->
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openEditModal(song)" class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors focus:outline-none" title="Chỉnh sửa">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                  </button>
                  <button @click="confirmDelete(song)" class="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors focus:outline-none" title="Ẩn bài hát">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="store.pagination.totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Trang {{ store.pagination.page }} / {{ store.pagination.totalPages }}</span>
        <div class="flex gap-1">
          <!-- First page -->
          <button @click="store.setPage(1)" :disabled="store.pagination.page === 1" class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none" title="Trang đầu" aria-label="Trang đầu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M11 19.5 3.5 12 11 4.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M20.5 19.5 13 12l7.5-7.5" /></svg>
          </button>
          <!-- Previous page -->
          <button @click="store.setPage(store.pagination.page - 1)" :disabled="store.pagination.page === 1" class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none" title="Trang trước" aria-label="Trang trước">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <!-- Next page -->
          <button @click="store.setPage(store.pagination.page + 1)" :disabled="store.pagination.page === store.pagination.totalPages" class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none" title="Trang sau" aria-label="Trang sau">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
          <!-- Last page -->
          <button @click="store.setPage(store.pagination.totalPages)" :disabled="store.pagination.page === store.pagination.totalPages" class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none" title="Trang cuối" aria-label="Trang cuối">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13 4.5 20.5 12 13 19.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M3.5 4.5 11 12l-7.5 7.5" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Cảnh báo Metadata -->
    <MetadataIssuesPanel v-if="metadataIssues.length > 0" :issues="metadataIssues" />

    <!-- Thống kê bài hát -->
    <div v-if="store.statistics" class="mt-8">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Thống kê & Phân tích</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useAdminSongStore } from '@/store/adminSongStore';
import api from '@/api/axios';
import SongFormModal from '@/components/admin/SongFormModal.vue';
import SongGroupCards from '@/components/admin/SongGroupCards.vue';
import TopSongsChart from '@/components/admin/charts/TopSongsChart.vue';
import GenreDistributionChart from '@/components/admin/charts/GenreDistributionChart.vue';
import MetadataIssuesPanel from '@/components/admin/MetadataIssuesPanel.vue';

const store = useAdminSongStore();

// Bulk Selection State
const selectedSongIds = ref([]);
const isAllSelected = computed(() => {
  return store.songs.length > 0 && selectedSongIds.value.length === store.songs.length;
});

function toggleSelectAll(e) {
  if (e.target.checked) {
    selectedSongIds.value = store.songs.map(s => s.id);
  } else {
    selectedSongIds.value = [];
  }
}

async function handleBulkStatus(status) {
  if (confirm(`Bạn có chắc muốn ${status === 'active' ? 'hiển thị' : 'ẩn'} ${selectedSongIds.value.length} bài hát?`)) {
    await store.bulkUpdateStatus(selectedSongIds.value, status);
    selectedSongIds.value = [];
  }
}

async function handleBulkMarket(market) {
  if (confirm(`Bạn có chắc muốn gán nhóm ${market} cho ${selectedSongIds.value.length} bài hát?`)) {
    await store.bulkUpdateMarket(selectedSongIds.value, market);
    selectedSongIds.value = [];
  }
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
    } else {
      await api.post('/songs/upload', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      statusMessage.value = 'Tải lên thành công!';
    }
    
    // Re-fetch data from store
    await store.fetchGroupsSummary();
    await store.fetchSongs();
    
    isError.value = false;
    setTimeout(() => { closeModal(); }, 1000);
    
  } catch (err) {
    statusMessage.value = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu.';
    isError.value = true;
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
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái:', err);
    alert('Không thể cập nhật trạng thái bài hát');
  }
}

async function confirmDelete(song) {
  if (confirm(`Bạn có chắc chắn muốn ẩn bài hát "${song.title}" khỏi hệ thống?`)) {
    try {
      await api.delete(`/admin/songs/${song.id}`);
      store.fetchSongs();
      store.fetchGroupsSummary();
    } catch (err) {
      console.error('Lỗi khi ẩn bài hát:', err);
      alert('Không thể ẩn bài hát này');
    }
  }
}

function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

onMounted(() => {
  store.fetchGroupsSummary();
  store.fetchSongs();
  store.fetchStatistics();
  fetchFormData();
  fetchMetadataIssues();
});
</script>

<style scoped>
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
