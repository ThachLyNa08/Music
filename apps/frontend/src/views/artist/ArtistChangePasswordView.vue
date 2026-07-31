<template>
  <section class="change-password-page">
    <article class="change-card">
      <p class="eyebrow">BẢO MẬT TÀI KHOẢN</p>
      <h1>Đổi mật khẩu lần đầu</h1>
      <p class="intro">Tài khoản đang sử dụng mật khẩu tạm thời. Vui lòng đổi mật khẩu để tiết tục vào Artist Studio.</p>

      <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

      <form class="password-form" @submit.prevent="submit">
        <label>
          Mật khẩu hiện tại
          <input v-model="form.currentPassword" type="password" autocomplete="current-password" required>
        </label>

        <label>
          Mật khẩu mới
          <input v-model="form.newPassword" type="password" autocomplete="new-password" required @input="validateNewPassword" @blur="validateNewPassword">
          <span v-if="newPasswordError" class="inline-error">{{ newPasswordError }}</span>
        </label>

        <label>
          Nhập lại mật khẩu mới
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" required @input="validateConfirmPassword" @blur="validateConfirmPassword">
          <span v-if="confirmPasswordError" class="inline-error">{{ confirmPasswordError }}</span>
        </label>

        <button type="submit" :disabled="loading || !!newPasswordError || !!confirmPasswordError || !form.newPassword || !form.confirmPassword">
          {{ loading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu' }}
        </button>
      </form>
    </article>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { artistAccountApi } from '@/api/artistAccount'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const loading = ref(false)
const errorMsg = ref('')
const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const newPasswordError = ref('')
const confirmPasswordError = ref('')

function validateNewPassword() {
  if (form.newPassword && form.newPassword.length < 6) {
    newPasswordError.value = 'Mật khẩu phải có ít nhất 6 ký tự.'
  } else {
    newPasswordError.value = ''
  }
}

function validateConfirmPassword() {
  if (form.confirmPassword && form.newPassword && form.confirmPassword !== form.newPassword) {
    confirmPasswordError.value = 'Mật khẩu nhập lại không khớp.'
  } else {
    confirmPasswordError.value = ''
  }
}

async function submit() {
  errorMsg.value = ''
  validateNewPassword()
  validateConfirmPassword()

  if (newPasswordError.value || confirmPasswordError.value) {
    return
  }

  if (form.newPassword.length < 6) {
    errorMsg.value = 'Mật khẩu phải có ít nhất 6 ký tự.'
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    errorMsg.value = 'Mật khẩu xác nhận không khớp.'
    return
  }

  loading.value = true
  try {
    const res = await artistAccountApi.changePassword({ ...form })
    auth.markArtistPasswordChanged()
    toast.showToast(res.data?.message || 'Đổi mật khẩu thành công.', 'success')
    await router.push(res.data?.redirectTo || '/artist/dashboard')
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Không thể đổi mật khẩu.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.change-password-page {
  min-height: calc(100vh - 56px);
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0f141e;
  color: #ffffff;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

.change-card {
  width: min(100%, 420px);
  background: #20293a;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.eyebrow {
  margin: 0 0 8px;
  color: #10b981;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

h1 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
}

.intro {
  margin: 0 0 32px;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.password-form {
  display: grid;
  gap: 20px;
}

label {
  display: grid;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  color: #f8fafc;
}

input {
  border: 1px solid #334155;
  background: #111827;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  color: #ffffff;
  transition: border-color 0.2s;
  outline: none;
}

input::placeholder {
  color: #64748b;
}

input:focus {
  border-color: #10b981;
}

button {
  border: 0;
  border-radius: 8px;
  background: #10b981;
  color: #ffffff;
  padding: 14px 16px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 8px;
}

button:hover:not(:disabled) {
  background: #059669;
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error-box {
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
}

.inline-error {
  color: #fca5a5;
  font-size: 12px;
  margin-top: -4px;
}
</style>
