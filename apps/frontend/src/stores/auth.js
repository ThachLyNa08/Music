import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import router from '@/router'
import { usePlayerStore } from '@/stores/player'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const accessToken = ref(localStorage.getItem('accessToken') || null)
  const refreshToken = ref(localStorage.getItem('refreshToken') || null)
  const loading = ref(false)
  const lockedAccount = ref(null)

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isArtist = computed(() => user.value?.role === 'artist')
  const userRole = computed(() => user.value?.role || 'guest')
  const isPremium = computed(() => {
    const expiresAt = user.value?.premium_expires_at || user.value?.premium_expired_at || user.value?.premiumExpiresAt
    if (!expiresAt) return false
    return new Date(expiresAt) > new Date()
  })

  function setAuth({ accessToken: at, refreshToken: rt }) {
    accessToken.value = at
    refreshToken.value = rt
    localStorage.setItem('accessToken', at)
    if (rt) localStorage.setItem('refreshToken', rt)
  }

  function clearAuth() {
    user.value = null
    lockedAccount.value = null
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  async function login(email, password, loginContext = 'user') {
    loading.value = true
    try {
      const { data } = loginContext === 'artist'
        ? await authApi.artistLogin({ email, password })
        : await authApi.login({ email, password })

      const payload = data.data || data
      setAuth(payload)

      let fetchedUser = payload.user || data.user || null
      if (!fetchedUser) {
        const meRes = await authApi.getMe()
        fetchedUser = meRes.data.data
      }

      if (loginContext === 'admin') {
        if (fetchedUser?.role !== 'admin') {
          clearAuth()
          return { success: false, message: 'Tài khoản không có quyền quản trị.' }
        }
        user.value = fetchedUser
        await router.push('/admin/dashboard')
        return { success: true }
      }

      if (loginContext === 'artist') {
        if (fetchedUser?.role !== 'artist') {
          clearAuth()
          const message = fetchedUser?.role === 'admin'
            ? 'Vui lòng đăng nhập tại trang quản trị.'
            : 'Đây không phải là tài khoản nghệ sĩ.'
          return { success: false, message, redirectTo: fetchedUser?.role === 'admin' ? '/admin/login' : '/login' }
        }
        user.value = fetchedUser
        await router.push(payload.redirectTo || data.redirectTo || '/artist/dashboard')
        return { success: true }
      }

      if (fetchedUser?.role === 'admin') {
        clearAuth()
        return {
          success: false,
          message: 'Đây là tài khoản quản trị. Vui lòng đăng nhập tại trang Admin.',
          redirectTo: '/admin/login',
        }
      }
      if (fetchedUser?.role === 'artist') {
        clearAuth()
        return {
          success: false,
          message: 'Đây là tài khoản Nghệ sĩ. Vui lòng đăng nhập vào Artist Studio.',
          redirectTo: '/artist/login',
        }
      }

      user.value = fetchedUser
      const player = usePlayerStore()
      player.restorePlayerSession(user.value?.id)
      await router.push('/')
      return { success: true }
    } catch (err) {
      clearAuth()
      return {
        success: false,
        code: err.response?.data?.code,
        message: err.response?.data?.message || 'Đăng nhập không thành công.',
        redirectTo: err.response?.data?.redirectTo,
      }
    } finally {
      loading.value = false
    }
  }

  function logoutSilently() {
    clearAuth()
  }

  async function register(payload) {
    loading.value = true
    try {
      const { data } = await authApi.register(payload)
      setAuth(data.data)
      await fetchMe()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Đăng ký không thành công.',
        code: err.response?.data?.code
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    try {
      const { data } = await authApi.getMe()
      user.value = data.data
    } catch (err) {
      if (err.response?.data?.code === 'ACCOUNT_LOCKED') {
        handleAccountLocked(err.response.data.data || {})
        return
      }
      logout()
    }
  }

  async function logout() {
    const currentRoute = router.currentRoute.value.path
    const wasAdminPath = currentRoute.startsWith('/admin')
    const wasArtistPath = currentRoute.startsWith('/artist')

    try { await authApi.logout() } catch { }
    clearAuth()

    const player = usePlayerStore()
    player.stopPlayback()
    player.clearRuntimePlayer()

    if (wasAdminPath) router.push('/admin/login')
    else if (wasArtistPath) router.push('/artist/login')
    else router.push('/login')
  }

  function upgradeToPremium(expiredAt) {
    if (user.value) {
      user.value.is_premium = 1
      user.value.premium_expired_at = expiredAt
    }
  }

  function markArtistPasswordChanged() {
    if (user.value) {
      user.value.mustChangePassword = false
      user.value.must_change_password = false
    }
  }

  function handleAccountLocked(payload = {}) {
    lockedAccount.value = {
      message: 'Tài khoản của bạn đã bị khóa.',
      ...payload,
    }
    if (user.value) {
      user.value.status = 'locked'
      user.value.locked_reason = payload.locked_reason || user.value.locked_reason
    }
    const player = usePlayerStore()
    player.stopPlayback()
    player.clearRuntimePlayer()
  }

  return {
    user,
    lockedAccount,
    accessToken,
    refreshToken,
    isLoggedIn,
    isAuthenticated,
    isAdmin,
    isArtist,
    userRole,
    isPremium,
    loading,
    login,
    register,
    logout,
    logoutSilently,
    fetchMe,
    handleAccountLocked,
    upgradeToPremium,
    markArtistPasswordChanged,
  }
})
