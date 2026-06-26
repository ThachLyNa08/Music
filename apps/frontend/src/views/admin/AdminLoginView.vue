<template>
  <div class="admin-login-wrapper">
    <div class="login-container">
      <div class="login-card">
        <div class="logo-section">
          <div class="logo-wrapper">
            <div class="logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
          </div>
          <h1>Đăng nhập quản trị</h1>
          <p>Vui lòng xác thực để truy cập bảng điều khiển</p>
        </div>

        <div class="error-message" :class="{ show: errorMsg }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round" class="error-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{{ errorMsg }}</span>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group floating">
            <input 
              type="email" 
              id="email" 
              class="form-input" 
              placeholder=" " 
              v-model="email"
              autocomplete="email"
              required
              :disabled="loading"
              @input="clearError"
            >
            <label class="form-label" for="email">Email quản trị</label>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round" class="input-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>

          <div class="form-group floating">
            <input 
              :type="showPassword ? 'text' : 'password'" 
              id="password" 
              class="form-input has-toggle" 
              placeholder=" "
              v-model="password"
              autocomplete="current-password"
              required
              :disabled="loading"
              @input="handlePasswordInput"
            >
            <label class="form-label" for="password">Mật khẩu</label>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round" class="input-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <button type="button" class="toggle-password" @click="togglePassword" title="Hiện/ẩn mật khẩu">
              <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
            
            <div class="password-strength" :class="{ show: password.length > 0 }">
              <div class="strength-bar" :style="{ width: strengthWidth, background: strengthColor }"></div>
            </div>
            <div class="strength-text" :class="{ show: password.length > 0 }" :style="{ color: strengthColor }">
              {{ strengthLabel }}
            </div>
          </div>

          <div class="options-row">
            <div class="remember-me">
              <input type="checkbox" id="remember" v-model="rememberMe">
              <label for="remember">Ghi nhớ đăng nhập</label>
            </div>
            <a href="#" class="forgot-link" @click.prevent="() => {}">Quên mật khẩu?</a>
          </div>

          <button type="submit" class="submit-btn" :class="{ loading: loading }" :disabled="loading || !email || !password">
            <span class="btn-text">Đăng nhập Admin</span>
            <div class="btn-loader">
              <div class="spinner"></div>
            </div>
          </button>
        </form>

        <div class="security-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Khu vực quản trị được bảo vệ bằng phân quyền hệ thống</span>
        </div>

        <router-link to="/login" class="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Quay lại ứng dụng người dùng</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const clearError = () => {
  errorMsg.value = ''
}

const handlePasswordInput = () => {
  clearError()
}

const passwordStrength = computed(() => {
  let strength = 0
  const p = password.value
  if (!p) return 0
  if (p.length >= 8) strength++
  if (p.match(/[a-z]/) && p.match(/[A-Z]/)) strength++
  if (p.match(/[0-9]/)) strength++
  if (p.match(/[^a-zA-Z0-9]/)) strength++
  return strength
})

const strengthWidth = computed(() => {
  const widths = ['25%', '50%', '75%', '100%']
  return widths[passwordStrength.value - 1] || '0'
})

const strengthColor = computed(() => {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
  return colors[passwordStrength.value - 1] || '#e2e8f0'
})

const strengthLabel = computed(() => {
  const labels = ['Yếu', 'Trung bình', 'Khá', 'Mạnh']
  return labels[passwordStrength.value - 1] || ''
})

async function handleLogin() {
  if (!email.value || !password.value) return
  
  errorMsg.value = ''
  loading.value = true

  // Gọi auth.login với cờ loginContext = 'admin'
  const res = await auth.login(email.value, password.value, 'admin')
  
  loading.value = false
  if (!res.success) {
    errorMsg.value = res.message || 'Tài khoản không có quyền quản trị.'
  }
}
</script>

<style scoped>
.admin-login-wrapper {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-light: #dbeafe;
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --danger-border: #fecaca;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --input-bg: #f8fafc;
  --input-border: #e2e8f0;
  --input-focus: #2563eb;
  --shadow: 0 10px 40px -10px rgba(0,0,0,0.08);
  --shadow-lg: 0 25px 50px -12px rgba(0,0,0,0.15);

  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 9999;
}

.login-container {
  width: 100%;
  max-width: 440px;
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-card {
  background: var(--card-bg);
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: var(--shadow);
  transition: all 0.3s ease;
  border: 1px solid var(--input-border);
}

.login-card:hover {
  box-shadow: var(--shadow-lg);
}

/* Logo Area */
.logo-section {
  text-align: center;
  margin-bottom: 40px;
}

.logo-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.logo {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
  position: relative;
  overflow: hidden;
}

.logo::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(255,255,255,0.2) 50%,
      transparent 70%
  );
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%) rotate(45deg); }
  100% { transform: translateX(100%) rotate(45deg); }
}

.logo-section h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.logo-section p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

/* Form Elements */
.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-group.floating .form-label {
  position: absolute;
  left: 48px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  color: var(--text-muted);
  pointer-events: none;
  transition: all 0.2s ease;
  background: transparent;
  padding: 0 4px;
  z-index: 1;
  font-weight: 500;
}

.form-group.floating .form-input:focus ~ .form-label,
.form-group.floating .form-input:not(:placeholder-shown) ~ .form-label,
.form-group.floating .form-input:-webkit-autofill ~ .form-label {
  top: -8px;
  transform: translateY(0);
  left: 12px;
  font-size: 12px;
  background: var(--card-bg);
  font-weight: 600;
}

.form-group.floating .form-input:focus ~ .form-label {
  color: var(--primary);
}

.form-group.floating .form-input:not(:placeholder-shown):not(:focus) ~ .form-label,
.form-group.floating .form-input:-webkit-autofill:not(:focus) ~ .form-label {
  color: var(--text-muted);
}

.form-input {
  width: 100%;
  padding: 16px 16px 16px 48px;
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 14px;
  font-size: 15px;
  color: var(--text-primary);
  font-family: inherit;
  transition: all 0.2s ease;
  outline: none;
}

.form-input:focus {
  border-color: var(--input-focus);
  background: var(--card-bg);
  box-shadow: 0 0 0 4px var(--primary-light);
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 20px;
  transition: color 0.2s;
  pointer-events: none;
}

.form-input:focus ~ .input-icon {
  color: var(--primary);
}

.toggle-password {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-password:hover {
  color: var(--primary);
}

.form-input.has-toggle {
  padding-right: 48px;
}

/* Error Message */
.error-message {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 12px;
  margin-bottom: 20px;
}

.error-message.show {
  display: flex;
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

.error-message .error-icon {
  color: var(--danger);
  flex-shrink: 0;
}

.error-message span {
  color: var(--danger);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

/* Options Row */
.options-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.remember-me input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}

.remember-me input[type="checkbox"]:checked {
  background: var(--primary);
  border-color: var(--primary);
}

.remember-me input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 6px;
  width: 4px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.remember-me label {
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  font-weight: 500;
}

.forgot-link {
  font-size: 14px;
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

/* Submit Button */
.submit-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px -3px rgba(37, 99, 235, 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.btn-text {
  display: inline-block;
  transition: opacity 0.2s, transform 0.2s;
}

.btn-loader {
  display: none;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.submit-btn.loading .btn-text {
  opacity: 0;
  transform: scale(0.9);
}

.submit-btn.loading .btn-loader {
  display: block;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Back Link */
.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  padding: 12px;
  border-radius: 12px;
}

.back-link:hover {
  color: var(--primary);
  background: var(--primary-light);
}

/* Password Strength */
.password-strength {
  margin-top: 8px;
  height: 4px;
  background: var(--input-border);
  border-radius: 2px;
  overflow: hidden;
  display: none;
}

.password-strength.show {
  display: block;
}

.strength-bar {
  height: 100%;
  width: 0;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.strength-text {
  font-size: 12px;
  margin-top: 6px;
  font-weight: 500;
  display: none;
}

.strength-text.show {
  display: block;
}

/* Security Badge */
.security-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  padding: 12px;
  background: var(--input-bg);
  border-radius: 12px;
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
  border: 1px dashed var(--input-border);
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 36px 24px;
    border-radius: 20px;
  }

  .logo-section h1 {
    font-size: 20px;
  }
}
</style>
