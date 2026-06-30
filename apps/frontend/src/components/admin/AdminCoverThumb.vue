<template>
  <div class="admin-cover-thumb relative flex items-center justify-center shrink-0 overflow-hidden bg-slate-100" :class="[sizeClass, roundedClass]">
    <img 
      v-if="coverUrl && !hasError" 
      :src="coverUrl" 
      :alt="alt || 'Cover'"
      @error="handleError"
      class="w-full h-full object-cover block"
      :class="imgClass"
    />
    <div v-else class="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
      <MfIcon :name="icon" :size="computedIconSize" :class="iconClass" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { normalizeCoverUrl } from '@/utils/imageUrl'

const props = defineProps({
  src: {
    type: String,
    default: null
  },
  alt: {
    type: String,
    default: 'Cover'
  },
  size: {
    type: String,
    default: 'md' // sm, md, lg, xl, full, custom
  },
  rounded: {
    type: String,
    default: 'lg' // none, sm, md, lg, full
  },
  icon: {
    type: String,
    default: 'queue_music'
  },
  imgClass: {
    type: [String, Array, Object],
    default: ''
  },
  iconClass: {
    type: [String, Array, Object],
    default: ''
  },
  iconSize: {
    type: [Number, String],
    default: null
  }
})

const hasError = ref(false)

const coverUrl = computed(() => {
  return normalizeCoverUrl(props.src)
})

watch(() => props.src, () => {
  hasError.value = false
})

function handleError() {
  hasError.value = true
}

const sizeClass = computed(() => {
  if (props.size === 'custom') return ''
  const map = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    full: 'w-full h-full'
  }
  return map[props.size] || map.md
})

const computedIconSize = computed(() => {
  if (props.iconSize) return Number(props.iconSize)
  if (props.size === 'custom') return 24 // default for custom
  const map = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    full: 24
  }
  return map[props.size] || 20
})

const roundedClass = computed(() => {
  const map = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  }
  return map[props.rounded] || 'rounded-lg'
})
</script>

<style scoped>
/* styles handled by tailwind */
</style>
