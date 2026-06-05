<template>
  <div class="flex flex-col items-center justify-center h-full bg-surface-elevated p-6 rounded-[24px] text-center">
    <!-- Success Icon -->
    <div class="w-24 h-24 bg-accent-green/10 rounded-full flex items-center justify-center mb-8 relative">
      <div class="absolute inset-0 bg-accent-green/20 rounded-full animate-ping"></div>
      <svg class="w-12 h-12 text-accent-green relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>

    <h2 class="text-2xl font-bold text-white mb-4">Thanh toán thành công!</h2>
    <p class="text-white text-base font-medium mb-2">Tài khoản của bạn đã được nâng cấp Premium.</p>
    
    <div class="bg-accent-green/10 text-accent-green px-4 py-3 rounded-lg text-sm mb-10 max-w-[300px]">
      Email xác nhận thanh toán đã được gửi đến tài khoản của bạn.
    </div>

    <button 
      @click="$emit('explore')"
      class="w-full max-w-[280px] py-3 text-sm rounded-full font-bold bg-accent-green text-black hover:bg-[#4cf479] hover:shadow-[0_0_20px_rgba(30,215,96,0.3)] transition-all duration-300"
    >
      Khám phá Premium
    </button>
  </div>
</template>

<script setup>
defineEmits(['explore'])
</script>

<style scoped>
.bg-surface-elevated {
  background: linear-gradient(135deg, rgba(76,29,149,0.12), rgba(15,23,42,0.78));
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
}
.text-accent-green {
  color: #1ed760;
}
.bg-accent-green {
  background-color: #1ed760;
}
</style>
