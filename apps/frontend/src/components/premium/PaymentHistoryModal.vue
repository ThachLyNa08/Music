<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm" @click.self="close">
      <div class="bg-[#121212] border border-white/10 rounded-2xl w-full flex flex-col shadow-2xl animate-fade-in-up" style="max-width: min(900px, calc(100vw - 48px)); max-height: calc(100vh - 120px);">
        <!-- Header -->
        <div class="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0 rounded-t-2xl">
          <h3 class="text-xl font-bold text-white">Lịch sử thanh toán</h3>
          <button @click="close" class="text-text-secondary hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <!-- Body / Scrollable List -->
        <div class="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <div v-if="history.length === 0" class="text-center py-8 text-text-secondary">
            Không có giao dịch nào.
          </div>
          <div v-else class="space-y-4">
            <div v-for="tx in history" :key="tx.payment_code" class="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl bg-white/5 border border-white/5 gap-4 hover:bg-white/10 transition-colors">
              <div>
                <div class="font-medium text-white mb-1">{{ tx.plan_name || 'Gói Premium' }}</div>
                <div class="text-xs text-text-secondary space-y-1">
                  <div>Mã GD: <span class="text-gray-300 font-mono">{{ tx.payment_code }}</span></div>
                  <div>Ngày tạo: {{ formatDate(tx.created_at) }}</div>
                  <div v-if="tx.paid_at">Thanh toán lúc: {{ formatDate(tx.paid_at) }}</div>
                </div>
              </div>
              <div class="sm:text-right flex sm:block items-center justify-between mt-2 sm:mt-0">
                <div class="font-bold text-white">{{ formatPrice(tx.amount) }}</div>
                <div :class="['text-xs font-medium px-2.5 py-1 rounded-full inline-block mt-1 sm:mt-2', getStatusBadgeColor(tx.status)]">
                  {{ getStatusText(tx.status) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  show: Boolean,
  history: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:show', 'close'])

function close() {
  emit('update:show', false)
  emit('close')
}

function handleEscape(e) {
  if (e.key === 'Escape' && props.show) {
    close()
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('vi-VN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(date)
}

function formatPrice(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function getStatusText(status) {
  const map = {
    'PENDING': 'Đang chờ',
    'PAID': 'Thành công',
    'EXPIRED': 'Hết hạn',
    'FAILED': 'Thất bại',
    'CANCELLED': 'Đã hủy'
  }
  return map[status?.toUpperCase()] || status
}

function getStatusBadgeColor(status) {
  const st = status?.toUpperCase()
  if (st === 'PAID' || st === 'SUCCESS') return 'bg-green-500/10 text-green-400 border border-green-500/20'
  if (st === 'PENDING') return 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
  if (st === 'EXPIRED') return 'bg-orange-400/10 text-orange-300 border border-orange-400/20'
  if (st === 'CANCELLED') return 'bg-gray-400/10 text-gray-400 border border-gray-400/20'
  return 'bg-red-500/10 text-red-400 border border-red-500/20'
}
</script>

<style scoped>
.text-text-secondary {
  color: #b3b3b3;
}
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
