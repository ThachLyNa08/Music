<template>
  <div class="premium-view user-page-bg relative overflow-hidden pb-4">
    <!-- Cinematic Background -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/15 via-slate-950/50 to-slate-950/80 pointer-events-none"></div>

    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20">
      
      <!-- LOADING STATE -->
      <div v-if="loading" class="flex justify-center items-center py-20">
        <svg class="animate-spin h-10 w-10 text-accent-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- PREMIUM DASHBOARD (For existing Premium users) -->
      <template v-else-if="isCurrentUserPremium && !isRenewing">
        <!-- Header section -->
        <div class="text-center mb-12">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-accent-green tracking-widest uppercase mb-6 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            Premium đang hoạt động
          </div>
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Tài khoản MusicFlow Premium
          </h1>
          <p class="text-lg text-text-secondary max-w-2xl mx-auto font-medium">
            Quản lý gói Premium, quyền lợi và lịch sử thanh toán của bạn.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column: Current Plan & History -->
          <div class="lg:col-span-2 space-y-8">
            <!-- Current Plan Card -->
            <div class="bg-[#121212] border border-white/5 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden">
              <!-- Decorative element -->
              <div class="absolute top-0 right-0 w-64 h-64 bg-accent-green/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div class="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div>
                  <h2 class="text-2xl font-bold text-white mb-2">{{ premiumInfo?.plan?.name || 'Gói Premium' }}</h2>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                    Trạng thái: {{ premiumInfo?.status === 'active' ? 'Đang hoạt động' : (premiumInfo?.status || 'Đang hoạt động') }}
                  </span>
                </div>
                <div class="mt-4 sm:mt-0 text-right">
                  <div class="text-sm text-text-secondary">Hết hạn vào</div>
                  <div class="text-lg font-semibold text-white">{{ formatDate(premiumInfo?.expiresAt || authStore.user?.premium_expires_at) || 'Chưa rõ' }}</div>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="mb-6">
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-text-secondary">Bắt đầu: {{ formatDate(premiumInfo?.startedAt) || 'Chưa có thông tin' }}</span>
                  <span class="font-medium text-white" v-if="premiumInfo?.daysRemaining != null">Còn {{ premiumInfo?.daysRemaining }} ngày</span>
                </div>
                <div class="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                  <div class="bg-gradient-to-r from-accent-green to-emerald-400 h-2.5 rounded-full transition-all duration-500" :style="{ width: calculateProgress() + '%' }"></div>
                </div>
              </div>

              <div class="flex flex-wrap gap-4 mt-8">
                <button v-if="premiumInfo?.daysRemaining <= 7 && premiumInfo?.daysRemaining != null" @click="handleRenew" class="px-6 py-2.5 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform duration-200 shadow-lg shadow-white/10">
                  Gia hạn ngay
                </button>
                <button v-else @click="handleRenew" class="px-6 py-2.5 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors duration-200 border border-white/5">
                  Gia hạn gói
                </button>
                <button @click="showHistory = true" class="px-6 py-2.5 bg-transparent text-text-secondary font-medium rounded-full hover:text-white transition-colors duration-200 border border-white/10 hover:border-white/30">
                  Xem lịch sử
                </button>
              </div>
            </div>

            <!-- Payment History Preview -->
            <div class="bg-[#121212] border border-white/5 rounded-2xl p-6 sm:p-8">
              <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white">Giao dịch gần đây</h3>
                <button v-if="history.length > 3" @click="showHistory = true" class="text-sm font-medium text-accent-green hover:underline">
                  Xem tất cả
                </button>
              </div>
              
              <div v-if="history.length === 0" class="text-center py-8">
                <div class="text-text-secondary">Chưa có thông tin giao dịch.</div>
              </div>
              <div v-else class="space-y-4">
                <div v-for="tx in history.slice(0, 3)" :key="tx.payment_code" class="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div>
                      <div class="font-medium text-white line-clamp-1">{{ tx.plan_name || 'Gói Premium' }}</div>
                      <div class="text-xs text-text-secondary mt-0.5">{{ formatDate(tx.created_at) }} &bull; {{ tx.provider }}</div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="font-bold text-white">{{ formatPrice(tx.amount) }}</div>
                    <div :class="['text-xs font-medium mt-1', getStatusColor(tx.status)]">{{ getStatusText(tx.status) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Benefits & Usage (If any) -->
          <div class="space-y-8">
            <div class="bg-[#121212] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-b from-accent-green/5 to-transparent pointer-events-none"></div>
              <h3 class="text-lg font-bold text-white mb-6 relative z-10 flex items-center gap-2">
                <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Quyền lợi hiện có
              </h3>
              <ul class="space-y-4 relative z-10">
                <li v-for="(benefit, index) in premiumInfo?.benefits || []" :key="index" class="flex items-start gap-3">
                  <div class="mt-1 bg-accent-green/20 rounded-full p-0.5 text-accent-green shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                  </div>
                  <span class="text-sm font-medium text-gray-300 leading-snug">{{ benefit }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <!-- Modal: Full History -->
        <PaymentHistoryModal v-model:show="showHistory" :history="history" />
      </template>

      <!-- BUY PREMIUM (For Free users or Renew flow) -->
      <template v-else>
        <!-- Back button for renewing users -->
        <div v-if="isRenewing" class="mb-8">
          <button @click="isRenewing = false" class="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Quay lại bảng điều khiển
          </button>
        </div>

        <!-- Hero Section -->
        <div class="text-center mb-16 sm:mb-24">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-accent-green tracking-widest uppercase mb-6 shadow-sm">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            Premium Audio
          </div>
          <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Nâng cấp trải nghiệm với <br class="hidden sm:block" />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-accent-green to-[#4cf479]">MusicFlow Premium</span>
          </h1>
          <p class="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto font-medium">
            Âm nhạc chất lượng cao, playlist AI cá nhân hóa và các tính năng Premium dành riêng cho bạn.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8 max-w-6xl mx-auto">
          <PremiumPlanCard 
            v-for="(plan, index) in plans" 
            :key="plan.id"
            :plan="plan"
            :isPopular="index === 1"
            :isCreating="isCreatingOrder && selectedPlan?.id === plan.id"
            @select="handleSelectPlan"
          />
        </div>

        <!-- Compare Features -->
        <PremiumFeatureTable v-if="!isRenewing" />

        <!-- FAQ Section -->
        <PremiumFAQ v-if="!isRenewing" />
      </template>
    </div>

    <!-- Checkout Modal -->
    <PaymentCheckoutModal 
      :show="showPayment"
      :plan="selectedPlan"
      :order="currentOrder"
      :userEmail="userEmail"
      @close="closePayment"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { paymentApi } from '@/api/payment'
import { useAuthStore } from '@/stores/auth'
import PremiumPlanCard from '@/components/premium/PremiumPlanCard.vue'
import PremiumFeatureTable from '@/components/premium/PremiumFeatureTable.vue'
import PremiumFAQ from '@/components/premium/PremiumFAQ.vue'
import PaymentCheckoutModal from '@/components/premium/PaymentCheckoutModal.vue'
import PaymentHistoryModal from '@/components/premium/PaymentHistoryModal.vue'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToastStore()

const plans = ref([])
const loading = ref(true)
const selectedPlan = ref(null)
const isCreatingOrder = ref(false)

const showPayment = ref(false)
const currentOrder = ref(null)
const isRenewing = ref(false)

const userEmail = computed(() => authStore.user?.email || '')

// Premium Dashboard States
const premiumInfo = ref(null)
const history = ref([])
const showHistory = ref(false)

const isCurrentUserPremium = computed(() => {
  const user = authStore.user
  const premium = premiumInfo.value

  const isPremiumFlag =
    user?.isPremium === true ||
    user?.is_premium === true ||
    user?.is_premium === 1 ||
    user?.premium === true ||
    premium?.isPremium === true

  const statusActive =
    user?.premium_status === 'active' ||
    premium?.status === 'active'

  const expiresAt =
    premium?.expiresAt ||
    premium?.premium_expires_at ||
    user?.premium_expires_at

  const notExpired = expiresAt ? new Date(expiresAt) > new Date() : false

  return Boolean((isPremiumFlag || statusActive) && notExpired)
})

onMounted(async () => {
  try {
    loading.value = true
    await authStore.fetchMe?.()
    
    // Always fetch premium data to check actual status
    await fetchPremiumData()
  } catch (error) {
    console.error('Failed to load data', error)
  } finally {
    loading.value = false
  }
})

watch(() => authStore.isPremium, async (isPremium) => {
  if (isPremium && !premiumInfo.value) {
    loading.value = true
    await fetchPremiumData()
    loading.value = false
  }
})

async function fetchPlans() {
  const res = await paymentApi.getPlans()
  plans.value = res.data.data || []
}

async function fetchPremiumData() {
  try {
    const [premRes, histRes] = await Promise.all([
      paymentApi.getMyPremium(),
      paymentApi.getTransactionHistory()
    ])
    
    if (premRes.data.success && premRes.data.data.isPremium) {
      premiumInfo.value = premRes.data.data
    }
    
    // If not premium according to the computed value after fetching, we need plans
    if (!isCurrentUserPremium.value) {
      await fetchPlans()
    }
    
    if (histRes.data.success) {
      history.value = histRes.data.data
    }
  } catch (err) {
    console.error("Error fetching premium details", err)
    await fetchPlans()
  }
}

async function handleRenew() {
  isRenewing.value = true
  if (plans.value.length === 0) {
    loading.value = true
    await fetchPlans()
    loading.value = false
  }
}

async function handleSelectPlan(plan) {
  if (!authStore.isLoggedIn) {
    toast.showToast('Vui lòng đăng nhập để tiếp tục', 'warning')
    router.push('/login')
    return
  }

  if (isCreatingOrder.value) return

  selectedPlan.value = plan
  isCreatingOrder.value = true
  
  try {
    const res = await paymentApi.createTransaction(plan.id)
    if (res.data.success) {
      currentOrder.value = res.data.data
      showPayment.value = true
    }
  } catch (error) {
    toast.showToast(error.response?.data?.message || 'Đã có lỗi xảy ra khi tạo đơn hàng', 'error')
  } finally {
    isCreatingOrder.value = false
  }
}

function closePayment() {
  showPayment.value = false
  currentOrder.value = null
  selectedPlan.value = null
  
  // Refresh history after a short delay to allow cancelTransaction to complete
  setTimeout(() => {
    if (authStore.isPremium) {
      fetchPremiumData()
    } else {
      paymentApi.getTransactionHistory().then(res => {
        if (res.data.success) history.value = res.data.data
      })
    }
  }, 500)
}

// Helpers
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

function calculateProgress() {
  if (!premiumInfo.value || !premiumInfo.value.startedAt || !premiumInfo.value.expiresAt) return 0
  
  const start = new Date(premiumInfo.value.startedAt).getTime()
  const end = new Date(premiumInfo.value.expiresAt).getTime()
  const now = new Date().getTime()
  
  if (now <= start) return 0
  if (now >= end) return 100
  
  return ((now - start) / (end - start)) * 100
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

function getStatusColor(status) {
  const st = status?.toUpperCase()
  if (st === 'PAID' || st === 'SUCCESS') return 'text-green-400'
  if (st === 'PENDING') return 'text-yellow-400'
  if (st === 'EXPIRED') return 'text-orange-300'
  if (st === 'CANCELLED') return 'text-gray-400'
  return 'text-red-400'
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
.text-accent-green {
  color: #1ed760;
}
.from-accent-green {
  --tw-gradient-from: #1ed760;
  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(30, 215, 96, 0));
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
