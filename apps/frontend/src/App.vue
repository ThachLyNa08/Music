<template>
  <GlobalToast />
  <RouterView />
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useNotificationStore } from '@/stores/notification'
import { usePlayerStore } from '@/stores/player'
import GlobalToast from '@/components/common/GlobalToast.vue'

const auth  = useAuthStore()
const theme = useThemeStore()
const notification = useNotificationStore()
const player = usePlayerStore()

watch(() => auth.user, (newUser) => {
  if (newUser) {
    notification.fetchNotifications()
    notification.initSocket(newUser.id)
  } else {
    notification.disconnectSocket()
  }
})

onMounted(async () => {
  theme.applyTheme()
  if (auth.isLoggedIn) {
    await auth.fetchMe()
  }
  player.restorePlayerSession(auth.user?.id)
})

onUnmounted(() => {
  notification.disconnectSocket()
})
</script>