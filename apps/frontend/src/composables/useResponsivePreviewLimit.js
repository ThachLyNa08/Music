import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '@/stores/player'

export function useResponsivePreviewLimit() {
  const windowWidth = ref(window.innerWidth)
  const playerStore = usePlayerStore()

  const handleResize = () => {
    windowWidth.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
  })

  const previewLimit = computed(() => {
    const width = windowWidth.value
    const queueOpen = playerStore.isQueueOpen

    if (queueOpen) {
      // Khi mở danh sách chờ, responsive tối đa 4 card 1 hàng
      if (width >= 1280) return 4
      if (width >= 1024) return 3
      if (width >= 768) return 2
      return 1
    }

    if (width >= 1536) return 7
    if (width >= 1280) return 6
    if (width >= 1024) return 5
    if (width >= 768) return 4
    if (width >= 640) return 3
    return 2
  })

  return { previewLimit, windowWidth }
}
