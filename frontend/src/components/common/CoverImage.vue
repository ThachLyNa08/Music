<template>
  <div class="cover-box" :class="{ 'is-loaded': isLoaded }">
    <div v-if="!isLoaded" class="cover-skeleton"></div>

    <img
      class="cover-img"
      :src="displaySrc"
      :alt="alt"
      loading="lazy"
      decoding="async"
      @load="handleLoad"
      @error="handleError"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { normalizeImageUrl, DEFAULT_COVER } from '@/utils/imageUrl'

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: 'cover'
  }
})

const isLoaded = ref(false)
const failed = ref(false)

const displaySrc = computed(() => {
  if (failed.value) return DEFAULT_COVER
  return normalizeImageUrl(props.src)
})

watch(
  () => props.src,
  () => {
    isLoaded.value = false
    failed.value = false
  }
)

function handleLoad() {
  isLoaded.value = true
}

function handleError(event) {
  if (failed.value) return

  failed.value = true
  isLoaded.value = false

  event.target.onerror = null
  event.target.src = DEFAULT_COVER
}
</script>

<style scoped>
.cover-box {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: rgba(255, 255, 255, 0.06);
  isolation: isolate;
}

.cover-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.cover-box.is-loaded .cover-img {
  opacity: 1;
}

.cover-skeleton {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(124, 58, 237, 0.16) 48%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 220% 100%;
  animation: coverShimmer 1.2s linear infinite;
}

@keyframes coverShimmer {
  from {
    background-position: 220% 0;
  }
  to {
    background-position: -220% 0;
  }
}
</style>
