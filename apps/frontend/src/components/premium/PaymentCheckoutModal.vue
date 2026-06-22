<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-8 bg-black/75 backdrop-blur-md">
        <!-- Click backdrop to close -->
        <div class="absolute inset-0" @click="closeModal" v-if="!isSuccess && !isChecking"></div>

        <transition name="scale-fade" mode="out-in">
          <div v-if="!isSuccess" class="relative w-full max-w-[1180px] bg-surface rounded-[24px] overflow-hidden flex flex-col lg:grid lg:grid-cols-[1fr_0.95fr] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/10 max-h-[calc(100vh-24px)] md:max-h-[calc(100vh-64px)] z-10">
            
            <!-- Close Button -->
            <button 
              @click="closeModal"
              class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/20 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors border border-white/10"
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

            <!-- Right Column: QR -->
            <div class="w-full p-6 overflow-y-auto hidden-scrollbar flex items-center justify-center bg-black/20">
              <PaymentQrCard 
                :qrCodeUrl="order?.qr_code_url"
                :expiredAt="order?.expired_at"
                :isChecking="isChecking"
                @check-status="checkPaymentStatus"
                @expired="handleExpired"
              />
            </div>
          </div>

          <!-- Success Celebration Overlay -->
          <PaymentSuccessCelebration 
            v-else
            :planName="plan?.name"
            :expiresAt="premiumExpiresAt"
            :amount="order?.amount"
            :userEmail="userEmail"
            @explore="handleExplore"
            @close="closeModal"
          />
        </transition>

      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import PaymentSummaryCard from './PaymentSummaryCard.vue'
import PaymentQrCard from './PaymentQrCard.vue'
import PaymentSuccessCelebration from './PaymentSuccessCelebration.vue'
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
const premiumExpiresAt = ref(null)
let autoPollingInterval = null
let modalOpenedAt = 0

const lockScroll = () => {
  document.body.style.overflow = 'hidden'
}

const unlockScroll = () => {
  document.body.style.overflow = ''
}

// Reset state when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    lockScroll()
    isSuccess.value = false
    isChecking.value = false
    isExpiredState.value = false
    setupSocket()
    startAutoPolling()
  } else {
    unlockScroll()
    teardownSocket()
    stopAutoPolling()
  }
})

// Clean up socket when component is unmounted
onUnmounted(() => {
  unlockScroll()
  teardownSocket()
  stopAutoPolling()
})

const handlePaymentSuccess = async (data) => {
  if (data.order_code === props.order?.order_code || !props.order?.order_code) {
    premiumExpiresAt.value = data.premium_expires_at || data.premium_expired_at || null
    isSuccess.value = true
    stopAutoPolling()
    
    // Reload user profile to get premium status updated
    try {
      if (authStore.fetchUser) {
        await authStore.fetchUser()
      }
    } catch (e) {
      console.warn('Could not fetch user', e)
    }
    
    // Modal will be auto-closed by PaymentSuccessCard after 5s or by user interaction
  } else {
    // Socket event arrived but for a different payment code. Refresh data anyway.
    try {
      if (authStore.fetchUser) {
        await authStore.fetchUser()
      }
    } catch (e) {}
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
  if (isChecking.value) {
    const confirmClose = window.confirm('Hệ thống đang kiểm tra giao dịch, bạn có chắc muốn đóng?');
    if (!confirmClose) return;
  }
  
  if (!isSuccess.value && props.order?.order_code) {
    paymentApi.cancelTransaction(props.order.order_code).catch(err => {
      console.warn('[PaymentModal] Failed to cancel transaction on close', err)
    })
  }
  emit('close')
}

const handleExplore = () => {
  closeModal()
  router.push('/') // or to some premium specific feature page
}

const handleExpired = () => {
  isExpiredState.value = true
  stopAutoPolling()
  notifStore.addNotification({
    type: 'warning',
    message: 'Mã QR đã hết hạn. Vui lòng tạo giao dịch mới.',
    timeout: 3000
  })
}

const checkPaymentStatus = async (isAuto = false) => {
  if (!props.order?.order_code || isChecking.value) return
  
  isChecking.value = true
  let statusPaid = false
  try {
    const res = await paymentApi.getTransactionStatus(props.order.order_code)
    if (res.data?.data?.status === 'PAID') {
       statusPaid = true
       handlePaymentSuccess(res.data.data)
    } else if (!isAuto) {
       notifStore.addNotification({
         type: 'info',
         message: 'Đang chờ ngân hàng xác nhận. Nếu bạn đã chuyển khoản, vui lòng đợi vài giây rồi thử lại.',
         timeout: 4000
       })
    }
  } catch (error) {
    console.error('Failed to check status', error)
    if (!isAuto) {
      notifStore.addNotification({
        type: 'error',
        message: 'Không thể kiểm tra trạng thái lúc này.',
        timeout: 3000
      })
    }
  } finally {
    isChecking.value = false
  }
  
  if (isAuto && !statusPaid && !isSuccess.value && !isExpiredState.value && props.show) {
    scheduleNextAutoPoll()
  }
}

const scheduleNextAutoPoll = () => {
  stopAutoPolling()
  
  if (!modalOpenedAt) modalOpenedAt = Date.now()
  const elapsed = Date.now() - modalOpenedAt
  
  let nextInterval = 5000
  if (elapsed < 60000) {
    nextInterval = 2000
  } else if (elapsed < 180000) {
    nextInterval = 5000
  } else {
    nextInterval = 10000
  }
  
  autoPollingInterval = setTimeout(() => {
    if (!isSuccess.value && !isChecking.value && !isExpiredState.value) {
      checkPaymentStatus(true)
    } else if (!isSuccess.value && !isExpiredState.value) {
      scheduleNextAutoPoll()
    }
  }, nextInterval)
}

const startAutoPolling = () => {
  modalOpenedAt = Date.now()
  scheduleNextAutoPoll()
}

const stopAutoPolling = () => {
  if (autoPollingInterval) {
    clearTimeout(autoPollingInterval)
    autoPollingInterval = null
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

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.scale-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}
</style>
