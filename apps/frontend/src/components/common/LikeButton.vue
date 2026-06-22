<template>
  <button
    type="button"
    :class="[baseClass, isLiked ? activeClass : inactiveClass, { 'opacity-60 cursor-wait': isPending }]"
    :title="buttonTitle"
    :aria-label="buttonTitle"
    :aria-pressed="isLiked"
    :disabled="disabled || isPending"
    @click.stop.prevent="handleToggleLike"
  >
    <slot name="icon" :isLiked="isLiked" :isPending="isPending" :size="size">
      <MfIcon name="favorite" :filled="isLiked" :size="size" />
    </slot>
    <span v-if="showLabel" class="ml-2">{{ isLiked ? 'Đã thích' : 'Yêu thích' }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'

const props = defineProps({
  song: {
    type: Object,
    default: null
  },
  songId: {
    type: [String, Number],
    default: null
  },
  size: {
    type: [String, Number],
    default: 20
  },
  showLabel: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  baseClass: {
    type: String,
    default: 'transition-all'
  },
  activeClass: {
    type: String,
    default: 'text-pink-500'
  },
  inactiveClass: {
    type: String,
    default: 'text-white hover:text-gray-300'
  }
})

const emit = defineEmits(['toggle-like'])
const library = useLibraryStore()

const likeTarget = computed(() => props.song || props.songId)
const isLiked = computed(() => library.isSongLiked(likeTarget.value))
const isPending = computed(() => library.isLikePending(likeTarget.value))
const buttonTitle = computed(() => (isLiked.value ? 'Bỏ thích' : 'Yêu thích'))

async function handleToggleLike() {
  if (props.disabled || isPending.value || !likeTarget.value) return
  const changed = await library.toggleSongLike(likeTarget.value)
  if (changed) emit('toggle-like', props.song || props.songId)
}
</script>
