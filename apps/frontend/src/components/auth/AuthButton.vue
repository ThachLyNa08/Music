<template>
  <button 
    class="btn-liquid" 
    :class="{ 'is-loading': loading }"
    :disabled="loading || disabled"
    @click="$emit('click')"
  >
    <div v-if="loading" class="loading-dots">
      <span></span><span></span><span></span>
    </div>
    <div v-else class="flex items-center justify-center gap-2 w-full h-full relative z-10">
      <slot></slot>
    </div>
  </button>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
defineEmits(['click'])
</script>

<style scoped>
.btn-liquid {
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #30d158, #0a84ff);
  border: none;
  border-radius: 16px;
  color: #000;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.01em;
  box-shadow: 0 4px 20px rgba(48,209,88,0.25);
  outline: none;
}

.btn-liquid:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 12px 40px rgba(48,209,88,0.4), 0 0 60px rgba(48,209,88,0.15);
}

.btn-liquid:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.btn-liquid:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Shimmer effect on button */
.btn-liquid::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transition: left 0.6s ease;
  z-index: 5;
}

.btn-liquid:hover:not(:disabled)::before {
  left: 100%;
}

.loading-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
  height: 24px;
  position: relative;
  z-index: 10;
}
.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #000;
  animation: ld 0.8s ease-in-out infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 0.15s; }
.loading-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes ld {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>
