import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import router from '@/router'
import { usePlayerStore } from '@/stores/player'

export const useAuthStore = defineStore('auth', () => {
  const user         = ref(null)
  const accessToken  = ref(localStorage.getItem('accessToken') || null)
  const refreshToken = ref(localStorage.getItem('refreshToken') || null)
  const loading      = ref(false)

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin    = computed(() => user.value?.role === 'admin')
  const isPremium  = computed(() => {
    const expiresAt = user.value?.premium_expires_at || user.value?.premium_expired_at
    if (!expiresAt) return false
    return new Date(expiresAt) > new Date()
  })

  async function login(email, password) {
    loading.value = true
    try {
      console.log('[AUTH] Gửi request đăng nhập:', email)
      const { data } = await authApi.login({ email, password })
      console.log('[AUTH] Đăng nhập thành công, nhận token:', !!data.data.accessToken)
      setAuth(data.data)
      await fetchMe()
      
      // Restore player session for this user
      const player = usePlayerStore()
      player.restorePlayerSession(user.value?.id)
      
      console.log('[AUTH] Bắt đầu chuyển hướng (isAdmin:', isAdmin.value, ')')
      if (isAdmin.value) {
        await router.push('/admin')
      } else {
        await router.push('/')
      }
      console.log('[AUTH] Đã chuyển hướng xong')
      return { success: true }
    } catch (err) {
      console.error('[AUTH] Lỗi đăng nhập:', err)
      return { success: false, message: err.response?.data?.message || 'Đăng nhập thất bại' }
    } finally {
      loading.value = false
    }
  }

  async function register(payload) {
    loading.value = true
    try {
      const { data } = await authApi.register(payload)
      setAuth(data.data)
      await fetchMe()
      if (isAdmin.value) {
        router.push('/admin')
      } else {
        router.push('/')
      }
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Đăng ký thất bại' }
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    try {
      console.log('[AUTH] Đang fetch thông tin user mới nhất...')
      const { data } = await authApi.getMe()
      user.value = data.data
      console.log('[AUTH] Đã set user state thành công:', user.value?.id)
    } catch (err) {
      console.error('[AUTH] Lỗi fetchMe, tiến hành logout:', err)
      logout() 
    }
  }

  async function logout() {
    try { await authApi.logout() } catch {}
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    
    // Pause music and clear runtime without deleting session history
    const player = usePlayerStore()
    player.stopPlayback()
    player.clearRuntimePlayer()
    
    router.push('/login')
  }

  function setAuth({ accessToken: at, refreshToken: rt }) {
    accessToken.value  = at
    refreshToken.value = rt
    localStorage.setItem('accessToken', at)
    localStorage.setItem('refreshToken', rt)
  }

  function upgradeToPremium(expiredAt) {
    if (user.value) {
      user.value.is_premium = 1
      user.value.premium_expired_at = expiredAt
    }
  }

  return { user, accessToken, isLoggedIn, isAdmin, isPremium, loading,
           login, register, logout, fetchMe, upgradeToPremium }
})
