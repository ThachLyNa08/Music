<template>
  <button 
    @click.stop="handleToggleLike"
    :class="[baseClass, library.isLiked(song) ? activeClass : inactiveClass]"
    :title="library.isLiked(song) ? 'Bỏ thích' : 'Yêu thích'"
  >
    <slot name="icon" :isLiked="library.isLiked(song)">
      <svg viewBox="0 0 24 24" :fill="library.isLiked(song) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
      </svg>
    </slot>
  </button>
</template>

<script setup>
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const props = defineProps({
  song: {
    type: Object,
    required: true
  },
  baseClass: {
    type: String,
    default: 'transition-all'
  },
  activeClass: {
    type: String,
    default: 'text-primary'
  },
  inactiveClass: {
    type: String,
    default: 'text-white hover:text-gray-300'
  }
})

const library = useLibraryStore()
const authStore = useAuthStore()
const router = useRouter()

async function handleToggleLike() {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }
  if (!props.song) return
  await library.toggleLike(props.song)
}
</script>
