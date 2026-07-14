<template>
  <div v-if="shouldShowBanner" class="relative bg-indigo-600 rounded-md pl-4 pr-10 py-1.5 text-white flex items-center justify-center w-max max-w-full">
    <div class="flex items-center justify-center gap-4 flex-wrap">
      <div class="flex items-center gap-2">
        <MfIcon name="info" class="text-white" size="16" />
        <p class="text-xs font-medium truncate">
          Premium của bạn sắp hết hạn trong {{ daysLeft }} ngày nữa. Gia hạn ngay để tiếp tục nghe nhạc không gián đoạn.
        </p>
      </div>
      <router-link
        to="/premium"
        class="rounded bg-white px-3 py-1 text-xs font-bold text-indigo-600 shadow-sm hover:bg-indigo-50 whitespace-nowrap shrink-0"
      >
        Gia hạn ngay
      </router-link>
    </div>
    
    <button @click="showConfirmDismiss" class="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-indigo-200 flex items-center justify-center p-1">
      <MfIcon name="close" size="18" />
    </button>
  </div>

  <ConfirmDialog
    v-model:open="isConfirmOpen"
    title="Ẩn thông báo"
    message="Bạn có chắc muốn ẩn thông báo này? Hệ thống sẽ không nhắc lại nữa trừ khi có nhắc nhở mới."
    confirmText="Đồng ý ẩn"
    cancelText="Để tôi xem lại"
    type="danger"
    theme="dark"
    @confirm="confirmDismissBanner"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import MfIcon from '@/components/common/MfIcon.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const isDismissedSession = ref(false)
const isConfirmOpen = ref(false)

const daysLeft = computed(() => {
  const expiresAt = authStore.user?.premium_expires_at || authStore.user?.premium_expired_at
  if (!expiresAt) return null
  
  const now = new Date()
  const expiry = new Date(expiresAt)
  now.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  
  const diffTime = expiry - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

const shouldShowBanner = computed(() => {
  if (!authStore.isLoggedIn) return false
  if (isDismissedSession.value) return false
  
  const days = daysLeft.value
  if (days === null || days < 0 || days > 7) return false
  
  const key = `premium_banner_dismissed_${authStore.user.id}`
  const dismissedAtStr = localStorage.getItem(key)
  if (!dismissedAtStr) return true // Never dismissed
  
  const dismissedAt = new Date(dismissedAtStr).getTime()
  
  // Find the latest premium notification
  const premiumNotis = notificationStore.notifications.filter(n => n.type === 'premium')
  if (premiumNotis.length === 0) {
    // If no premium notification exists but it was dismissed, keep it hidden
    return false
  }
  
  // Check if the latest notification was created AFTER the dismissal
  const latestNoti = premiumNotis[0]
  const notiTime = new Date(latestNoti.created_at).getTime()
  
  return notiTime > dismissedAt
})

function showConfirmDismiss() {
  isConfirmOpen.value = true
}

function confirmDismissBanner() {
  isDismissedSession.value = true
  const key = `premium_banner_dismissed_${authStore.user.id}`
  localStorage.setItem(key, new Date().toISOString())
  isConfirmOpen.value = false
}
</script>
