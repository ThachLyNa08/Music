<template>
  <header
    :class="[
      'fixed top-0 left-0 right-0 z-[70] h-16 border-b border-white/10 bg-[#090b12]/82 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl md:left-[260px]',
      isQueueOpen ? '2xl:right-[400px]' : '2xl:right-0'
    ]"
  >
    <div class="flex h-full items-center justify-between px-4 md:px-8">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex gap-1.5">
          <button
            class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.10] hover:text-white"
            type="button"
            @click="goBack"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.10] hover:text-white"
            type="button"
            @click="goForward"
            aria-label="Forward"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative" ref="notiMenuRef">
          <button
            class="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            type="button"
            title="Thông báo"
            @click.stop="toggleNotiDropdown"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span
              v-if="notification.unreadCount > 0"
              class="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#090b12] bg-pink-500 text-[10px] font-black text-white"
            >
              {{ notification.unreadCount > 9 ? '9+' : notification.unreadCount }}
            </span>
          </button>

          <Transition name="dropdown">
            <div
              v-if="isNotiOpen"
              class="user-dropdown absolute right-0 top-full mt-3 max-h-[420px] w-[360px] overflow-y-auto p-0"
            >
              <div class="sticky top-0 z-10 border-b border-white/10 bg-[#090b12]/95 p-4 backdrop-blur-md">
                <div class="flex items-center justify-between">
                  <h4 class="m-0 text-sm font-bold text-white">Thông báo</h4>
                  <button
                    v-if="notification.unreadCount > 0"
                    class="border-none bg-transparent p-1 text-xs font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
                    type="button"
                    @click="notification.markAsRead('all')"
                  >
                    Đánh dấu đã đọc
                  </button>
                </div>
              </div>

              <div v-if="notification.notifications.length > 0" class="flex flex-col">
                <div
                  v-for="noti in notification.notifications"
                  :key="noti.id"
                  class="relative flex cursor-pointer items-start gap-3 border-b border-white/5 p-4 transition-colors hover:bg-white/5"
                  :class="{ 'bg-indigo-500/5': !noti.is_read }"
                  @click="handleNotiClick(noti)"
                >
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="noti.type === 'new_song' ? 'bg-gradient-to-br from-indigo-500 to-blue-500 text-white' : 'bg-white/10 text-slate-400'">
                    <svg v-if="noti.type === 'new_song'" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold leading-snug text-white">{{ noti.title }}</div>
                    <div class="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-400">{{ noti.message }}</div>
                    <div class="mt-1.5 text-[10px] font-semibold text-slate-500">{{ formatNotiTime(noti.created_at) }}</div>
                  </div>
                  <div v-if="!noti.is_read" class="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-indigo-500"></div>
                </div>
              </div>

              <div v-else class="p-10 text-center text-sm font-medium text-slate-500">
                Không có thông báo nào
              </div>
            </div>
          </Transition>
        </div>

        <button
          class="flex h-10 w-10 items-center justify-center rounded-full text-yellow-500 transition hover:bg-white/[0.08] hover:text-yellow-400"
          type="button"
          title="Premium"
          @click="$router.push('/premium')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
            <path d="M5 21h14"/>
          </svg>
        </button>

        <div class="relative" ref="userMenuRef">
          <button
            class="flex items-center gap-3 rounded-full px-2 py-1.5 transition hover:bg-white/[0.08]"
            type="button"
            title="Tài khoản"
            @click.stop="toggleUserMenu"
          >
            <div v-if="user?.avatar_url" class="h-10 w-10 shrink-0 rounded-full overflow-hidden shadow-lg border border-white/10">
              <img :src="getAvatarUrl(user.avatar_url)" alt="Avatar" class="h-full w-full object-cover" @error="e => e.target.style.display = 'none'" />
            </div>
            <div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-extrabold text-white shadow-lg shadow-violet-950/40">
              {{ avatarText }}
            </div>
          </button>

          <Transition name="dropdown">
            <div
              v-if="isUserMenuOpen"
              class="user-dropdown absolute right-0 top-full mt-3 w-48 overflow-hidden p-1 bg-[#282828] rounded-md shadow-[0_16px_24px_rgba(0,0,0,0.3),0_6px_8px_rgba(0,0,0,0.2)] z-[100]"
            >
              <button
                class="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors rounded-sm text-left"
                @click="goProfile"
              >
                Thông tin cá nhân
              </button>
              <div class="h-px bg-white/10 my-1"></div>
              <button
                class="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors rounded-sm text-left"
                @click="confirmLogout"
              >
                Đăng xuất
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>

  <!-- Logout Confirmation Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isLogoutModalOpen" class="fixed inset-0 z-[999999] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="isLogoutModalOpen = false"></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-sm rounded-2xl bg-[#1e1e1e] border border-white/10 p-6 shadow-2xl transform transition-all">
          <div class="mb-5 flex flex-col items-center text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-6 w-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-white">Đăng xuất</h3>
            <p class="text-sm text-slate-400 font-medium">Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?</p>
          </div>
          
          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              class="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              @click="isLogoutModalOpen = false"
            >
              Hủy
            </button>
            <button
              class="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400 hover:shadow-red-400/40"
              @click="executeLogout"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'

defineProps({
  isQueueOpen: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const authStore = useAuthStore()
const notification = useNotificationStore()

const isNotiOpen = ref(false)
const notiMenuRef = ref(null)

const isUserMenuOpen = ref(false)
const userMenuRef = ref(null)

const isLogoutModalOpen = ref(false)

const user = computed(() => authStore.user)
const displayName = computed(() => user.value?.display_name || user.value?.username || user.value?.name || 'User')
const avatarText = computed(() => displayName.value?.charAt(0)?.toUpperCase() || 'U')

function getAvatarUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}

function goBack() {
  router.back()
}

function goForward() {
  router.forward()
}

function goProfile() {
  isUserMenuOpen.value = false
  router.push('/profile')
}

async function executeLogout() {
  isLogoutModalOpen.value = false
  if (authStore.logout) {
    await authStore.logout()
  }
  router.push('/login')
}

function confirmLogout() {
  isUserMenuOpen.value = false
  isLogoutModalOpen.value = true
}

function toggleNotiDropdown() {
  isNotiOpen.value = !isNotiOpen.value
  if (isNotiOpen.value) isUserMenuOpen.value = false
}

function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value
  if (isUserMenuOpen.value) isNotiOpen.value = false
}

function handleNotiClick(noti) {
  if (!noti.is_read) {
    notification.markAsRead(noti.id)
  }
  if (noti.link) {
    router.push(noti.link)
  }
  isNotiOpen.value = false
}

function closeDropdown(event) {
  if (notiMenuRef.value && !notiMenuRef.value.contains(event.target)) {
    isNotiOpen.value = false
  }
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    isUserMenuOpen.value = false
  }
}

function formatNotiTime(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active > div:nth-child(2),
.fade-leave-active > div:nth-child(2) {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-enter-from > div:nth-child(2),
.fade-leave-to > div:nth-child(2) {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>
