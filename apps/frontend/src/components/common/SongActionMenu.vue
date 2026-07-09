<template>
  <div v-if="show" class="fixed z-[9999] user-dropdown text-slate-300 overflow-y-auto overscroll-contain max-h-[80vh] shadow-[0_8px_40px_rgba(0,0,0,0.8)]"
       :class="[compact ? 'w-52 text-[13px] font-medium p-1' : 'w-56 text-sm font-medium']"
       :style="{ top: `${adjustedPosition.y}px`, left: `${adjustedPosition.x}px` }"
       ref="menuRef"
       @mouseenter="isHovering = true"
       @mouseleave="isHovering = false">
    <button @click="handle('add-to-playlist')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Thêm vào danh sách phát</button>
    
    <button @click="handle('toggle-like')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition flex justify-between items-center" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">
      <span :class="{ 'text-[#1ed760]': isLiked }">{{ isLiked ? 'Xóa khỏi Bài hát đã thích' : 'Lưu vào Bài hát đã thích' }}</span>
      <svg v-if="isLiked" viewBox="0 0 24 24" class="w-4 h-4 fill-[#1ed760]"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </button>
    
    <button @click="handle('add-to-queue')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Thêm vào hàng đợi</button>
    <button v-if="playlistId && canRemove" @click="handle('remove-from-playlist')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-red-400 transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Xóa khỏi danh sách phát</button>
    
    <div class="border-t border-white/10 my-1"></div>
    <button @click="handle('go-to-song')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Đi tới bài hát</button>
    <button v-if="song?.artist_id || song?.artists" @click="handle('go-to-artist')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Đi tới nghệ sĩ</button>
    <button v-if="song?.album_id" @click="handle('go-to-album')" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Đi tới album</button>
    
    <div class="border-t border-white/10 my-1"></div>
    <button @click="openShareModal" class="w-full text-left rounded-xl hover:bg-white/10 hover:text-white transition" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2.5'">Chia sẻ với bạn bè</button>
  </div>

  <ShareEntityModal v-model:open="isShareModalOpen" :entity="shareSong" entityType="song" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import ShareEntityModal from '@/components/common/ShareEntityModal.vue'

const props = defineProps({
  show: Boolean,
  position: Object, // { x, y }
  song: Object,
  isLiked: Boolean,
  playlistId: [String, Number],
  canRemove: Boolean,
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'add-to-playlist', 'toggle-like', 'add-to-queue', 'go-to-song', 'go-to-artist', 'go-to-album', 'share', 'remove-from-playlist'])
const menuRef = ref(null)
const adjustedPosition = ref({ x: 0, y: 0 })
const isHovering = ref(false)
const isShareModalOpen = ref(false)
const shareSong = ref(null)

// Calculate safe position to avoid overflowing viewport
watch(() => props.show, async (newVal) => {
  if (newVal) {
    isHovering.value = false // Reset hovering state when opening
    adjustedPosition.value = { ...props.position }
    
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
      
      // Top overflow (if it was pushed too high)
      if (newY < 16) {
        newY = 16
      }

      adjustedPosition.value = { x: newX, y: newY }
    }
  }
})

// Add watch to update position dynamically if props.position changes while open
watch(() => props.position, (newPos) => {
  if (props.show) {
    adjustedPosition.value = { ...newPos }
  }
}, { deep: true })

const handle = (action) => {
  emit(action, props.song)
  emit('close')
}

const openShareModal = () => {
  shareSong.value = props.song
  isShareModalOpen.value = true
  emit('close')
}

const handleClickOutside = (event) => {
  if (props.show && menuRef.value && !menuRef.value.contains(event.target)) {
    emit('close')
  }
}

const handleScroll = (event) => {
  if (props.show && menuRef.value) {
    // If hovering over the menu, allow scrolling without closing
    if (isHovering.value || event.target === menuRef.value || menuRef.value.contains(event.target)) {
      return
    }
    emit('close')
  }
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
