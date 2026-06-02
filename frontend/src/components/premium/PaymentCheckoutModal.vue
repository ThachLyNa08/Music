<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
    <div class="relative w-full max-w-[940px] w-[calc(100vw-48px)] bg-surface rounded-[28px] overflow-hidden flex flex-col lg:grid lg:grid-cols-[1fr_0.95fr] shadow-2xl border border-white/10 max-h-[calc(100vh-40px)]">
      
      <!-- Close Button -->
      <button 
        v-if="!isSuccess"
        @click="closeModal"
        class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/15 transition-colors"
      >
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- Left Column: Summary -->
      <div class="w-full p-6 overflow-y-auto hidden-scrollbar border-b lg:border-b-0 lg:border-r border-white/5">
        <PaymentSummaryCard 
          :planName="plan?.name"
          :email="userEmail"
          :orderCode="order?.order_code"
          :transferContent="order?.transfer_content"
          :amount="order?.amount"
          @back="closeModal"
        />
      </div>

      <!-- Right Column: QR or Success -->
      <div class="w-full p-6 overflow-y-auto hidden-scrollbar flex items-center justify-center">
        <transition name="fade" mode="out-in">
          <PaymentSuccessCard 
            v-if="isSuccess"
            @explore="handleExplore"
          />
          <PaymentQrCard 
            v-else
            :qrCodeUrl="order?.qr_code_url"
            :expiredAt="order?.expired_at"
            :isChecking="isChecking"
            @check-status="checkPaymentStatus"
            @expired="handleExpired"
          />
        </transition>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import PaymentSummaryCard from './PaymentSummaryCard.vue'
import PaymentQrCard from './PaymentQrCard.vue'
import PaymentSuccessCard from './PaymentSuccessCard.vue'
import { paymentApi } from '@/api/payment'
import { useNotificationStore } from '@/stores/notification'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const props = defineProps({
  show: Boolean,
  plan: Object,
  order: Object,
  userEmail: String
})

const emit = defineEmits(['close'])

const notifStore = useNotificationStore()
const authStore = useAuthStore()
const router = useRouter()

const isSuccess = ref(false)
const isChecking = ref(false)
const isExpiredState = ref(false)

// Reset state when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    isSuccess.value = false
    isChecking.value = false
    isExpiredState.value = false
    setupSocket()
  } else {
    teardownSocket()
  }
})

// Clean up socket when component is unmounted
onUnmounted(() => {
  teardownSocket()
})

const handlePaymentSuccess = (data) => {
  if (data.order_code === props.order?.order_code || !props.order?.order_code) {
    authStore.upgradeToPremium(data.expired_at)
    isSuccess.value = true
  }
}

const setupSocket = () => {
  if (notifStore.socket) {
    notifStore.socket.on('payment:success', handlePaymentSuccess)
  }
}

const teardownSocket = () => {
  if (notifStore.socket) {
    notifStore.socket.off('payment:success', handlePaymentSuccess)
  }
}

const closeModal = () => {
  emit('close')
}

const handleExplore = () => {
  closeModal()
  router.push('/') // or to some premium specific feature page
}

const handleExpired = () => {
  isExpiredState.value = true
}

const checkPaymentStatus = async () => {
  if (!props.order?.order_code || isChecking.value) return
  
  isChecking.value = true
  try {
    const res = await paymentApi.getTransactionStatus(props.order.order_code)
    if (res.data?.data?.status === 'PAID') {
      authStore.upgradeToPremium(res.data.data.premium_expired_at) // Assuming API returns this
      isSuccess.value = true
    } else {
      // Show some toast if not paid, for now just alert or silent
      alert('Giao dịch chưa được thanh toán hoặc đang được xử lý.')
    }
  } catch (error) {
    console.error('Failed to check status', error)
    alert('Không thể kiểm tra trạng thái lúc này.')
  } finally {
    isChecking.value = false
  }
}
</script>

<style scoped>
.bg-surface {
  background: linear-gradient(135deg, rgba(76,29,149,0.18), rgba(15,23,42,0.96));
  backdrop-filter: blur(20px);
}
.text-text-secondary {
  color: #b3b3b3;
}
.hidden-scrollbar::-webkit-scrollbar {
  display: none;
}
.hidden-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
