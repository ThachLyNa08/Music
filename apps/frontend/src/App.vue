<template>
  <GlobalToast />
  <RouterView />
  <AccountLockedNotice
    v-if="auth.lockedAccount && !isAppealRoute && !isLoginRoute"
    :account="auth.lockedAccount"
    @logout="auth.logout()"
  />
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useNotificationStore } from '@/stores/notification'
import { useMessagesStore } from '@/stores/messages'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import GlobalToast from '@/components/common/GlobalToast.vue'
import AccountLockedNotice from '@/components/account/AccountLockedNotice.vue'

const auth  = useAuthStore()
const route = useRoute()
const theme = useThemeStore()
const notification = useNotificationStore()
const messages = useMessagesStore()
const player = usePlayerStore()
const library = useLibraryStore()
const isAppealRoute = computed(() => route.path === '/account/appeal')
const isLoginRoute = computed(() => ['/login', '/admin/login', '/artist/login'].includes(route.path))
let sessionCheckTimer = null

async function checkCurrentSession() {
  if (!auth.isLoggedIn || auth.lockedAccount || isAppealRoute.value || isLoginRoute.value) return
  try {
    await auth.fetchMe()
  } catch {}
}

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
  sessionCheckTimer = window.setInterval(checkCurrentSession, 20000)
  window.addEventListener('focus', checkCurrentSession)
})

onUnmounted(() => {
  if (sessionCheckTimer) window.clearInterval(sessionCheckTimer)
  window.removeEventListener('focus', checkCurrentSession)
  notification.disconnectSocket()
  messages.disconnectSocket()
})
</script>
