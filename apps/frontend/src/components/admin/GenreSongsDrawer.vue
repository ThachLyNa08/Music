<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex justify-end">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
      
      <!-- Drawer panel -->
      <div class="relative w-full max-w-md bg-white dark:bg-bg-surface border-l border-gray-100 dark:border-bg-border shadow-2xl h-full flex flex-col animate-slide-in-right">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-card">
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span class="text-indigo-600 dark:text-indigo-400">🎶</span>
              {{ genre.name }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Danh sách bài hát</p>
          </div>
          <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors focus:outline-none">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-100 dark:border-bg-border bg-white dark:bg-bg-surface">
          <div class="relative">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              v-model="search"
              @keyup.enter="fetchSongs"
              type="text" 
              placeholder="Tìm theo tên bài hoặc nghệ sĩ..."
              class="w-full bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl pl-9 pr-4 py-2 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-4 relative">
          <div v-if="loading" class="absolute inset-0 z-10 bg-white/50 dark:bg-bg-surface/50 flex flex-col items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-2"></div>
            <span class="text-xs text-gray-500">Đang tải...</span>
          </div>

          <div v-if="songs.length === 0 && !loading" class="text-center text-gray-500 dark:text-gray-400 mt-10">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
            <p class="font-medium text-gray-700 dark:text-gray-300">Không có bài hát nào</p>
          </div>

          <div v-else class="space-y-3">
            <div v-for="song in songs" :key="song.id" class="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors group">
              <div class="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                <img v-if="song.cover_url" :src="song.cover_url" class="w-full h-full object-cover">
                <svg v-else class="w-full h-full p-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-900 dark:text-white text-sm truncate" :title="song.title">{{ song.title }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5" :title="song.artist_name">{{ song.artist_name }}</div>
                <div class="mt-1 flex gap-2">
                  <span v-if="song.is_active === 0 || song.is_active === false" class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">Đã ẩn</span>
                  <span v-if="song.release_status !== 'published'" class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 capitalize">{{ song.release_status }}</span>
                </div>
              </div>
              <router-link 
                :to="{ name: 'admin-song-detail', params: { id: song.id } }" 
                class="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Xem chi tiết"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </router-link>
            </div>
          </div>
        </div>

        <!-- Footer / Pagination -->
        <div v-if="pagination.totalPages > 1" class="p-4 border-t border-gray-100 dark:border-bg-border flex justify-between items-center bg-gray-50 dark:bg-bg-card">
          <button 
            @click="changePage(pagination.page - 1)"
            :disabled="pagination.page === 1"
            class="p-1.5 bg-white dark:bg-bg-surface border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ pagination.page }} / {{ pagination.totalPages }}</span>
          <button 
            @click="changePage(pagination.page + 1)"
            :disabled="pagination.page === pagination.totalPages"
            class="p-1.5 bg-white dark:bg-bg-surface border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        
        <div class="p-4 border-t border-gray-100 dark:border-bg-border text-center bg-white dark:bg-bg-surface">
          <router-link :to="{ name: 'AdminSongs', query: { genreId: genre.id } }" class="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
            Đi đến Quản lý Bài Hát <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </router-link>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';

const props = defineProps({
  genre: {
    type: Object,
    required: true
  }
});

defineEmits(['close']);

const toast = useToastStore();

const loading = ref(false);
const songs = ref([]);
const search = ref('');
const pagination = reactive({ page: 1, limit: 15, totalPages: 1 });

onMounted(() => {
  fetchSongs();
});

const fetchSongs = async () => {
  loading.value = true;
  try {
    const { data } = await api.get(`/admin/genres/${props.genre.id}/songs`, {
      params: {
        page: pagination.page,
        limit: pagination.limit,
        search: search.value || undefined
      }
    });
    songs.value = data.data;
    Object.assign(pagination, data.pagination);
  } catch (error) {
    toast.showToast('Lỗi khi tải danh sách bài hát', 'error');
  } finally {
    loading.value = false;
  }
};

const changePage = (page) => {
  pagination.page = page;
  fetchSongs();
};
</script>

<style scoped>
.animate-slide-in-right {
  animation: slideInRight 0.3s ease-out forwards;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 10px;
}
:deep(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
}
</style>
