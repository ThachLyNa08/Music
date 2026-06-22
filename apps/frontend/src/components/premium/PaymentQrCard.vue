<template>
  <div class="flex flex-col items-center justify-center h-full bg-surface-elevated p-6 rounded-[24px] relative overflow-hidden">
    <!-- Status Pill -->
    <div 
      class="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full flex items-center gap-2 text-xs font-bold shadow-lg"
      :class="isExpired ? 'bg-red-500/20 text-red-500' : 'bg-accent-green/20 text-accent-green'"
    >
      <div 
        v-if="!isExpired" 
        class="w-2 h-2 rounded-full bg-accent-green animate-pulse"
      ></div>
      {{ isExpired ? 'PAYMENT EXPIRED' : 'WAITING FOR PAYMENT' }}
    </div>

    <div class="mt-8 mb-4 w-[220px] h-[220px] bg-white rounded-2xl p-3 shadow-2xl relative">
      <img 
        v-if="qrCodeUrl" 
        :src="qrCodeUrl" 
        alt="VietQR" 
        class="w-full h-full object-contain"
        :class="{ 'opacity-30 grayscale': isExpired }"
      />
      <!-- Scan line animation for pending state -->
      <div v-if="!isExpired" class="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div class="w-full h-1 bg-accent-green/50 shadow-[0_0_15px_rgba(30,215,96,0.5)] animate-[scan_2s_linear_infinite]"></div>
      </div>
      
      <!-- Expired overlay -->
      <div v-if="isExpired" class="absolute inset-0 flex items-center justify-center flex-col p-4 text-center">
        <svg class="w-12 h-12 text-red-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span class="text-black font-bold">Mã QR đã hết hạn</span>
      </div>
    </div>

    <!-- Countdown -->
    <div class="text-center mb-6">
      <p class="text-text-secondary text-xs mb-1">Thời gian còn lại để thanh toán</p>
      <div class="text-[26px] font-mono font-bold text-white tracking-widest leading-none">
        {{ formatTime(timeLeft) }}
      </div>
    </div>

    <!-- Instructions -->
    <p class="text-center text-text-secondary text-sm mb-6 px-4">
      Mở ứng dụng ngân hàng và quét mã để thanh toán. Vui lòng chuyển khoản đúng số tiền và nội dung.
    </p>

    <!-- Check Status Button -->
    <div class="flex flex-col items-center w-full">
      <p v-if="!isExpired" class="text-xs text-accent-green mb-3 flex items-center gap-2 animate-pulse font-medium">
        <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Hệ thống đang tự động kiểm tra...
      </p>

      <button 
        @click="checkStatus"
        :disabled="isChecking || isExpired"
        class="w-full max-w-[280px] py-2.5 text-sm rounded-full font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
        :class="isChecking ? 'bg-white/5 text-white/50' : 'bg-transparent text-white hover:bg-white/10 hover:border-white/40'"
      >
        <span v-if="isChecking">Đang kiểm tra...</span>
        <span v-else>Kiểm tra ngay</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

const props = defineProps({
  qrCodeUrl: String,
  expiredAt: String,
  isChecking: Boolean
})

const emit = defineEmits(['check-status', 'expired'])

const timeLeft = ref(0)
let timerInterval = null

const isExpired = computed(() => timeLeft.value <= 0)

onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

function startTimer() {
  if (timerInterval) clearInterval(timerInterval)
  
  const updateTimer = () => {
    if (!props.expiredAt) return
    const expiredTime = new Date(props.expiredAt).getTime()
    const now = new Date().getTime()
    timeLeft.value = Math.max(0, Math.floor((expiredTime - now) / 1000))
    
    if (timeLeft.value <= 0) {
      clearInterval(timerInterval)
      emit('expired')
    }
  }
  
  updateTimer()
  timerInterval = setInterval(updateTimer, 1000)
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function checkStatus() {
  emit('check-status')
}
</script>

<style scoped>
.bg-surface-elevated {
  background: linear-gradient(135deg, rgba(76,29,149,0.12), rgba(15,23,42,0.78));
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
}
.text-text-secondary {
  color: #b3b3b3;
}
.text-accent-green {
  color: #1ed760;
}
.bg-accent-green {
  background-color: #1ed760;
}

@keyframes scan {
  0% { transform: translateY(0); }
  50% { transform: translateY(240px); }
  100% { transform: translateY(0); }
}
</style>
