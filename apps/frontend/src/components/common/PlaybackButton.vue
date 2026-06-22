<template>
  <button
    type="button"
    class="playback-button"
    :class="[
      sizeClass,
      {
        'playback-button--disabled': disabled,
        'playback-button--subtle': variant === 'subtle'
      }
    ]"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
    @click="$emit('click')"
  >
    <svg v-if="isPlaying" viewBox="0 0 24 24" fill="currentColor" class="playback-button__icon">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="currentColor" class="playback-button__icon playback-button__icon--play">
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isPlaying: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  variant: { type: String, default: 'solid' }
})

defineEmits(['click'])

const label = computed(() => (props.isPlaying ? 'Tạm dừng' : 'Phát'))

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'playback-button--sm'
  if (props.size === 'lg') return 'playback-button--lg'
  return 'playback-button--md'
})
</script>

<style scoped>
.playback-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 0;
  border-radius: 9999px;
  background: #1ED760;
  color: #000000;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(30, 215, 96, 0.3);
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease,
    opacity 160ms ease;
}

.playback-button:hover:not(:disabled) {
  background: #1FDF64;
  box-shadow: 0 10px 25px rgba(30, 215, 96, 0.45);
  transform: scale(1.05);
}

.playback-button--sm {
  width: 42px;
  height: 42px;
}

.playback-button--md {
  width: 56px;
  height: 56px;
}

.playback-button--lg {
  width: 64px;
  height: 64px;
}

.playback-button--subtle {
  box-shadow: 0 6px 16px rgba(30, 215, 96, 0.24);
}

.playback-button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.playback-button__icon {
  width: 24px;
  height: 24px;
}

.playback-button--sm .playback-button__icon {
  width: 20px;
  height: 20px;
}

.playback-button--lg .playback-button__icon {
  width: 28px;
  height: 28px;
}

.playback-button__icon--play {
  margin-left: 2px;
}
</style>
