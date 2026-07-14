<template>
  <main class="artist-auth-page">
    <section class="login-panel">
      <div class="panel-heading">
        <div class="logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <h1>MusicFlow Artist Studio</h1>
        <p>Đăng nhập bằng tài khoản được Admin cấp</p>
      </div>

      <div v-if="errorMsg" class="error-box">
        {{ errorMsg }}
        <RouterLink v-if="redirectTo" :to="redirectTo">Đi đến trang phù hợp</RouterLink>
      </div>
      <div v-if="tempPasswordNotice" class="notice-box">
        Tài khoản đang sử dụng mật khẩu tạm thời. Vui lòng đổi mật khẩu để tiếp tục.
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <label class="input-label">
          Email
          <input v-model.trim="form.email" type="email" autocomplete="email" placeholder="blackpink@artist.musicflow.local" required>
        </label>

        <label class="input-label">
          Mật khẩu
          <input v-model="form.password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required>
        </label>

        <div class="form-actions">
          <label class="remember-me">
            <input type="checkbox" v-model="form.remember">
            Ghi nhớ đăng nhập
          </label>
          <a href="#" class="forgot-password">Quên mật khẩu?</a>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading || !form.email || !form.password">
          {{ loading ? 'Đang đăng nhập...' : 'Vào Artist Studio' }}
        </button>
      </form>

    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const form = reactive({ email: '', password: '', remember: false })
const loading = ref(false)
const errorMsg = ref('')
const redirectTo = ref('')
const tempPasswordNotice = ref(false)

async function handleLogin() {
  if (!form.email || !form.password) return
  loading.value = true
  errorMsg.value = ''
  redirectTo.value = ''
  tempPasswordNotice.value = false
  const result = await auth.login(form.email, form.password, 'artist')
  loading.value = false
  if (!result.success) {
    errorMsg.value = result.message
    redirectTo.value = result.redirectTo || ''
  } else if (auth.user?.mustChangePassword || auth.user?.must_change_password) {
    tempPasswordNotice.value = true
  }
}
</script>

<style scoped>
.artist-auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0f141e;
  color: #ffffff;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

.login-panel {
  width: min(100%, 420px);
  background: #20293a;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.panel-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 32px;
}

.logo-box {
  width: 56px;
  height: 56px;
  background: #10b981;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: white;
}

.logo-box svg {
  width: 28px;
  height: 28px;
}

h1 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
}

.panel-heading p {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
}

.login-form {
  display: grid;
  gap: 20px;
}

.input-label {
  display: grid;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  color: #f8fafc;
}

input[type="email"],
input[type="password"] {
  border: 1px solid #334155;
  background: #111827;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  color: #ffffff;
  transition: border-color 0.2s;
  outline: none;
}

input[type="email"]::placeholder,
input[type="password"]::placeholder {
  color: #64748b;
}

input[type="email"]:focus,
input[type="password"]:focus {
  border-color: #10b981;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: -4px;
  margin-bottom: 4px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
  font-weight: 400;
  cursor: pointer;
}

.remember-me input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #10b981;
  background: transparent;
  border: 1px solid #475569;
  border-radius: 4px;
  cursor: pointer;
}

.forgot-password {
  font-size: 13px;
  color: #10b981;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.forgot-password:hover {
  color: #34d399;
}

.submit-btn {
  border: 0;
  border-radius: 8px;
  background: #10b981;
  color: #ffffff;
  padding: 14px 16px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #059669;
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Error/Notice Styles */
.error-box {
  display: grid;
  gap: 8px;
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
}

.error-box a {
  color: #f87171;
}

.notice-box {
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(245, 158, 11, 0.1);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
}
</style>
