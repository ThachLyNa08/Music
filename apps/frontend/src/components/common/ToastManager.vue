<template>
  <div class="fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
    <div 
      v-for="toast in toasts" 
      :key="toast.id"
      class="bg-white text-[#2d3436] px-8 py-3.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-gray-100/50 font-bold text-sm tracking-wide transition-all duration-300 transform translate-y-0 opacity-100 flex items-center justify-center min-w-[200px]"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { toasts } from '@/utils/toast'
</script>
