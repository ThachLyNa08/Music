<template>
  <div class="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'flex items-center gap-2.5 px-5 py-3 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.35)] font-bold text-sm tracking-wide transition-all duration-300',
          toast.type === 'error' || toast.type === 'danger' ? 'bg-red-500 text-white' :
          toast.type === 'warning' ? 'bg-yellow-500 text-white' :
          toast.type === 'info' ? 'bg-blue-500 text-white' :
          'bg-[#1ed760] text-black'
        ]"
      >
        <!-- Error Icon -->
        <svg v-if="toast.type === 'error' || toast.type === 'danger'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        <!-- Warning Icon -->
        <svg v-else-if="toast.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <!-- Info Icon -->
        <svg v-else-if="toast.type === 'info'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <!-- Success Icon -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>

        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { toasts, addToast } from '@/utils/toast'

defineExpose({ addToast })
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
</style>
