<template>
  <div class="premium-view user-page-bg relative overflow-hidden pb-4">
    <!-- Cinematic Background -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/15 via-slate-950/50 to-slate-950/80 pointer-events-none"></div>

    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20">
      
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

      <!-- Loading State -->
      <div v-if="loadingPlans" class="flex justify-center items-center py-20">
        <svg class="animate-spin h-10 w-10 text-accent-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Plans Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8 max-w-6xl mx-auto">
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
      <PremiumFeatureTable />

      <!-- FAQ Section -->
      <PremiumFAQ />

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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { paymentApi } from '@/api/payment'
import { useAuthStore } from '@/stores/auth'
import PremiumPlanCard from '@/components/premium/PremiumPlanCard.vue'
import PremiumFeatureTable from '@/components/premium/PremiumFeatureTable.vue'
import PremiumFAQ from '@/components/premium/PremiumFAQ.vue'
import PaymentCheckoutModal from '@/components/premium/PaymentCheckoutModal.vue'

const router = useRouter()
const authStore = useAuthStore()

const plans = ref([])
const loadingPlans = ref(true)
const selectedPlan = ref(null)
const isCreatingOrder = ref(false)

const showPayment = ref(false)
const currentOrder = ref(null)

const userEmail = computed(() => authStore.user?.email || '')

onMounted(async () => {
  try {
    const res = await paymentApi.getPlans()
    plans.value = res.data.data || []
  } catch (error) {
    console.error('Failed to load plans', error)
  } finally {
    loadingPlans.value = false
  }
})

async function handleSelectPlan(plan) {
  if (!authStore.isLoggedIn) {
    alert('Vui lòng đăng nhập để tiếp tục')
    router.push('/login')
    return
  }

  // Prevent multiple clicks
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
    alert(error.response?.data?.message || 'Đã có lỗi xảy ra khi tạo đơn hàng')
  } finally {
    isCreatingOrder.value = false
  }
}

function closePayment() {
  showPayment.value = false
  currentOrder.value = null
  selectedPlan.value = null
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
</style>
