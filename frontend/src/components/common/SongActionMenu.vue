<template>
  <div v-if="show" class="fixed z-50 w-56 user-dropdown text-slate-300 text-sm font-medium"
       :style="{ top: `${position.y}px`, left: `${position.x}px` }"
       ref="menuRef">
    <button @click="handle('add-to-playlist')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition">Thêm vào danh sách phát</button>
    
    <button @click="handle('toggle-like')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition flex justify-between items-center">
      <span :class="{ 'text-[#1ed760]': isLiked }">{{ isLiked ? 'Xóa khỏi Bài hát đã thích' : 'Lưu vào Bài hát đã thích' }}</span>
      <svg v-if="isLiked" viewBox="0 0 24 24" class="w-4 h-4 fill-[#1ed760]"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </button>
    
    <button @click="handle('add-to-queue')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition">Thêm vào hàng đợi</button>
    
    <div class="border-t border-white/10 my-1"></div>
    <button @click="handle('go-to-song')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition">Đi tới bài hát</button>
    <button v-if="song?.artist_id || song?.artists" @click="handle('go-to-artist')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition">Đi tới nghệ sĩ</button>
    <button v-if="song?.album_id" @click="handle('go-to-album')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition">Đi tới album</button>
    
    <div class="border-t border-white/10 my-1"></div>
    <button @click="handle('share')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition">Sao chép liên kết bài hát</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  show: Boolean,
  position: Object, // { x, y }
  song: Object,
  isLiked: Boolean
})

const emit = defineEmits(['close', 'add-to-playlist', 'toggle-like', 'add-to-queue', 'go-to-song', 'go-to-artist', 'go-to-album', 'share'])
const menuRef = ref(null)

// Calculate safe position to avoid overflowing viewport
watch(() => props.show, async (newVal) => {
  if (newVal) {
    await nextTick()
    if (menuRef.value) {
      const rect = menuRef.value.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      
      let newX = props.position.x
      let newY = props.position.y

      // Right overflow
      if (newX + rect.width > vw - 16) {
        newX = vw - rect.width - 16
      }
      // Bottom overflow
      if (newY + rect.height > vh - 16) {
        newY = newY - rect.height - 24 // Render above the click point
      }

      menuRef.value.style.left = `${newX}px`
      menuRef.value.style.top = `${newY}px`
    }
  }
})

const handle = (action) => {
  emit(action, props.song)
  emit('close')
}

const handleClickOutside = (event) => {
  if (props.show && menuRef.value && !menuRef.value.contains(event.target)) {
    emit('close')
  }
}

const handleScroll = () => {
  if (props.show) emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
})
</script>
