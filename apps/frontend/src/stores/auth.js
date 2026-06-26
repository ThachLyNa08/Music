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
  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin    = computed(() => user.value?.role === 'admin')
  const userRole   = computed(() => user.value?.role || 'guest')
  const isPremium  = computed(() => {
    const expiresAt = user.value?.premium_expires_at || user.value?.premium_expired_at
    if (!expiresAt) return false
    return new Date(expiresAt) > new Date()
  })

  async function login(email, password, loginContext = 'user') {
    loading.value = true
    try {
      console.log('[AUTH] Gửi request đăng nhập:', email)
      const { data } = await authApi.login({ email, password })
      console.log('[AUTH] Đăng nhập thành công, nhận token:', !!data.data.accessToken)
      
      // Tạm lưu token vào localStorage để axios interceptor có thể gọi getMe()
      // KHÔNG gọi setAuth() hay gán user.value ngay để tránh trigger watchers (App.vue, v.v.)
      localStorage.setItem('accessToken', data.data.accessToken)
      localStorage.setItem('refreshToken', data.data.refreshToken)
      
      let fetchedUser = null
      try {
        const meRes = await authApi.getMe()
        fetchedUser = meRes.data.data
      } catch (err) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        throw err
      }
      
      // Kiểm tra luồng Admin
      if (loginContext === 'admin') {
        if (fetchedUser?.role !== 'admin') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          return { success: false, message: 'Tài khoản không có quyền quản trị.' }
        }
        
        // Hợp lệ -> Cập nhật Pinia state chính thức
        setAuth(data.data)
        user.value = fetchedUser
        await router.push('/admin/dashboard')
      } 
      // Kiểm tra luồng User
      else {
        if (fetchedUser?.role === 'admin') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          return { success: false, message: 'Đây là tài khoản quản trị. Vui lòng đăng nhập tại trang Admin.', redirectTo: '/admin/login' }
        }
        
        // Hợp lệ -> Cập nhật Pinia state chính thức
        setAuth(data.data)
        user.value = fetchedUser
        
        // Restore player session cho user
        const player = usePlayerStore()
        player.restorePlayerSession(user.value?.id)
        
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

  function logoutSilently() {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
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
    const currentRoute = router.currentRoute.value.path
    const wasAdminPath = currentRoute.startsWith('/admin')

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
    
    if (wasAdminPath) {
      router.push('/admin/login')
    } else {
      router.push('/login')
    }
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

  return { user, accessToken, isLoggedIn, isAuthenticated, isAdmin, userRole, isPremium, loading,
           login, register, logout, fetchMe, upgradeToPremium }
})
