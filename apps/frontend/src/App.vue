<template>
  <GlobalToast />
  <RouterView />
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useNotificationStore } from '@/stores/notification'
import { useMessagesStore } from '@/stores/messages'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import GlobalToast from '@/components/common/GlobalToast.vue'

const auth  = useAuthStore()
const theme = useThemeStore()
const notification = useNotificationStore()
const messages = useMessagesStore()
const player = usePlayerStore()
const library = useLibraryStore()

watch(() => auth.user, (newUser) => {
  if (newUser) {
    notification.fetchNotifications()
    notification.initSocket(newUser.id)
    messages.fetchUnreadCount()
    messages.initSocket(newUser.id)
    library.fetchLikedSongs(true)
  } else {
    notification.disconnectSocket()
    messages.disconnectSocket()
    library.clearLikedState()
  }
}, { immediate: true })

onMounted(async () => {
  theme.applyTheme()
  if (auth.isLoggedIn && !auth.user) {
    await auth.fetchMe()
  }
  if (auth.isLoggedIn) {
    await library.fetchLikedSongs()
  }
  player.restorePlayerSession(auth.user?.id)
})

onUnmounted(() => {
  notification.disconnectSocket()
  messages.disconnectSocket()
})
</script>
