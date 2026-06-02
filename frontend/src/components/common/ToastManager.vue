<template>
  <div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
    <div 
      v-for="toast in toasts" 
      :key="toast.id"
      class="bg-[#2e77d0] text-white px-6 py-3 rounded-md shadow-2xl font-bold text-sm tracking-wide transition-all duration-300 transform translate-y-0 opacity-100"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const toasts = ref([])
let idCounter = 0

const addToast = (message, duration = 3000) => {
  const id = idCounter++
  toasts.value.push({ id, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

defineExpose({ addToast })
</script>
