<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="user-modal w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
        <h2 class="text-xl font-bold">Thêm vào danh sách phát</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white transition">
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-2 overflow-y-auto flex-1">
        <div v-if="loading" class="flex justify-center py-10">
          <div class="w-8 h-8 border-4 border-[#1ed760] border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <div v-else-if="error" class="text-center py-10 text-red-400">
          {{ error }}
        </div>
        
        <div v-else-if="playlists.length === 0" class="text-center py-10 text-gray-400 px-4">
          Bạn chưa có danh sách phát nào.
        </div>
        
        <div v-else class="flex flex-col gap-1">
          <button 
            v-for="pl in playlists" 
            :key="pl.id"
            @click="addToPlaylist(pl.id)"
            class="user-row flex items-center gap-4 px-4 py-3 text-left group"
          >
            <div class="w-12 h-12 bg-white/10 rounded-lg shrink-0 flex items-center justify-center overflow-hidden">
              <img :src="getPlaylistCover(pl)" class="w-full h-full object-cover" @error="e => { e.target.onerror = null; e.target.src = '/images/default-cover.svg' }" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-base font-bold text-white truncate">{{ pl.name }}</div>
              <div class="text-sm text-gray-400 truncate">{{ pl.total_songs || 0 }} bài hát</div>
            </div>
          </button>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import api from '@/api/axios'
import { getPlaylistCover } from '@/utils/imageUrl'
import { useToastStore } from '@/stores/toast'
import { toBackendAssetUrl } from '@/config/runtime'

const toastStore = useToastStore()

const props = defineProps({
  show: Boolean,
  song: Object
})

const emit = defineEmits(['close', 'success'])

const loading = ref(false)
const error = ref('')
const playlists = ref([])

const localFormatImageUrl = (url) => {
  if (!url) return '' 
  return toBackendAssetUrl(url)
}

watch(() => props.show, async (newVal) => {
  if (newVal) {
    loading.value = true
    error.value = ''
    try {
      const res = await api.get('/playlists')
      if (res.data.success) {
        // Only show user's own editable playlists
        playlists.value = res.data.data.filter(p => p.can_edit)
      }
    } catch (err) {
      if (err.response?.status === 401) {
        error.value = 'Vui lòng đăng nhập để sử dụng chức năng này'
      } else {
        error.value = 'Lỗi tải danh sách phát'
      }
    } finally {
      loading.value = false
    }
  }
})

const addToPlaylist = async (playlistId) => {
  if (!props.song) return
  try {
    const res = await api.post(`/playlists/${playlistId}/songs`, { song_id: props.song.id })
    if (res.data.success) {
      toastStore.showToast(`Đã thêm vào "${res.data.playlist?.name || 'danh sách phát'}"`, 'success')
      emit('success', 'Đã thêm vào danh sách phát')
      emit('close')
    } else {
      toastStore.showToast(res.data.message || 'Lỗi thêm bài hát', 'error')
    }
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error')
  }
}
</script>
