<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
      
      <div class="relative w-full max-w-md bg-white dark:bg-bg-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col transform transition-all text-center p-6">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <svg class="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        </div>
        
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3" id="modal-title">Gộp thể loại</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          Đưa tất cả bài hát từ thể loại <strong class="text-gray-900 dark:text-gray-200">{{ sourceGenre.name }}</strong> sang một thể loại khác. Thể loại cũ sẽ bị ẩn hoặc xoá (tuỳ chọn).
        </p>

        <form @submit.prevent="handleMerge" class="text-left mb-8">
          <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
            Chọn thể loại đích
          </label>
          <select 
            v-model="targetGenreId" 
            required
            class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all shadow-sm"
          >
            <option value="" disabled>-- Chọn thể loại --</option>
            <option v-for="g in validTargetGenres" :key="g.id" :value="g.id">
              {{ g.name }} ({{ g.song_count }} bài)
            </option>
          </select>
        </form>

        <div class="flex flex-col sm:flex-row gap-3 justify-center w-full">
          <button type="button" @click="$emit('close')" class="w-full sm:w-1/2 inline-flex justify-center rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-bg-card text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none transition-colors shadow-sm">
            Hủy bỏ
          </button>
          <button type="button" @click="handleMerge" :disabled="!targetGenreId || loading" class="w-full sm:w-1/2 inline-flex justify-center items-center rounded-xl border border-transparent px-4 py-3 bg-amber-500 text-sm font-bold text-white shadow-sm hover:bg-amber-600 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <div v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            {{ loading ? 'Đang gộp...' : 'Xác nhận gộp' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';

const props = defineProps({
  sourceGenre: {
    type: Object,
    required: true
  },
  genres: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['close', 'success']);

const toast = useToastStore();

const loading = ref(false);
const targetGenreId = ref('');

const validTargetGenres = computed(() => {
  return props.genres.filter(g => g.id !== props.sourceGenre.id);
});

const handleMerge = async () => {
  if (!targetGenreId.value) {
    toast.showToast('Vui lòng chọn thể loại đích', 'error');
    return;
  }
  
  loading.value = true;
  try {
    const response = await api.post(`/admin/genres/${props.sourceGenre.id}/merge`, {
      targetGenreId: targetGenreId.value
    });
    
    toast.showToast(`Đã gộp thành công! Chuyển ${response.data.data.songsMoved} bài hát.`, 'success');
    emit('success');
  } catch (error) {
    toast.showToast(error.response?.data?.message || 'Có lỗi xảy ra khi gộp', 'error');
  } finally {
    loading.value = false;
  }
};
</script>
