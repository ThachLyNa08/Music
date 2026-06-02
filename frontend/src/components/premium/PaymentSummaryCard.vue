<template>
  <div class="flex flex-col h-full">
    <h3 class="text-2xl font-bold text-white mb-2">Hoàn tất thanh toán</h3>
    <p class="text-text-secondary text-sm mb-6">Quét mã QR để nâng cấp tài khoản Premium.</p>

    <div class="flex-1 space-y-4">
      <div class="flex justify-between items-center border-b border-white/5 py-3">
        <span class="text-text-secondary">Gói đã chọn:</span>
        <span class="font-bold text-white text-lg">Premium {{ planName }}</span>
      </div>
      
      <div class="flex justify-between items-center border-b border-white/5 py-3">
        <span class="text-text-secondary text-sm">Tài khoản:</span>
        <span class="font-medium text-white text-sm">{{ email }}</span>
      </div>
      
      <div class="flex justify-between items-center border-b border-white/5 py-3">
        <span class="text-text-secondary text-sm">Mã đơn hàng:</span>
        <span class="font-medium text-white text-sm">{{ orderCode }}</span>
      </div>

      <div class="flex flex-col border-b border-white/5 py-3 gap-2">
        <span class="text-text-secondary text-sm">Nội dung chuyển khoản:</span>
        <div class="flex items-center justify-between bg-white/[0.06] rounded-lg p-3 border border-white/10">
          <span class="font-mono font-bold text-white tracking-wider">{{ transferContent }}</span>
          <button 
            @click="copyContent"
            class="text-accent-green hover:text-white transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            {{ copyText }}
          </button>
        </div>
      </div>

      <div class="flex justify-between items-center border-b border-white/5 py-3">
        <span class="text-text-secondary text-sm">Phương thức:</span>
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 bg-white/10 rounded text-xs font-semibold text-white">SePay</span>
          <span class="px-2 py-1 bg-white/10 rounded text-xs font-semibold text-white">VietQR</span>
        </div>
      </div>

      <div class="flex justify-between items-center pt-2">
        <span class="text-text-secondary text-base">Tổng tiền:</span>
        <span class="font-extrabold text-[28px] text-accent-green">{{ formatPrice(amount) }}đ</span>
      </div>
    </div>

    <button 
      @click="$emit('back')"
      class="mt-6 w-full py-3 rounded-full font-bold text-white bg-white/5 hover:bg-white/10 transition-colors text-sm"
    >
      Quay lại chọn gói
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  planName: String,
  email: String,
  orderCode: String,
  transferContent: String,
  amount: Number
})

defineEmits(['back'])

const copyText = ref('Copy')

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(props.transferContent)
    copyText.value = 'Đã copy!'
    setTimeout(() => {
      copyText.value = 'Copy'
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

function formatPrice(price) {
  if (!price) return '0'
  return new Intl.NumberFormat('vi-VN').format(price)
}
</script>

<style scoped>
.text-text-secondary {
  color: #b3b3b3;
}
.text-accent-green {
  color: #1ed760;
}
</style>
