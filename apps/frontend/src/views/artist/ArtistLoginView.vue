<template>
  <main class="artist-auth-page">
    <section class="login-panel">
      <div class="panel-heading">
        <p class="eyebrow">MusicFlow Artist Studio</p>
        <h1>Dang nhap nghe si</h1>
        <p>Su dung tai khoan Artist Studio do Admin cap.</p>
      </div>

      <div v-if="errorMsg" class="error-box">
        {{ errorMsg }}
        <RouterLink v-if="redirectTo" :to="redirectTo">Di den trang phu hop</RouterLink>
      </div>
      <div v-if="tempPasswordNotice" class="notice-box">
        Tai khoan dang su dung mat khau tam thoi. Vui long doi mat khau de tiep tuc.
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <label>
          Email
          <input v-model.trim="form.email" type="email" autocomplete="email" required>
        </label>

        <label>
          Mat khau
          <input v-model="form.password" type="password" autocomplete="current-password" required>
        </label>

        <button type="submit" :disabled="loading || !form.email || !form.password">
          {{ loading ? 'Dang dang nhap...' : 'Vao Artist Studio' }}
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
const form = reactive({ email: '', password: '' })
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
  background: #101827;
  color: #ffffff;
}

.login-panel {
  width: min(100%, 430px);
  background: #ffffff;
  color: #111827;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
}

.panel-heading {
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #16a34a;
  font-weight: 900;
  font-size: 12px;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.panel-heading p:last-child {
  margin: 0;
  color: #64748b;
}

.login-form {
  display: grid;
  gap: 16px;
}

label {
  display: grid;
  gap: 7px;
  font-weight: 800;
  font-size: 13px;
}

input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 13px;
  font-size: 15px;
}

button {
  border: 0;
  border-radius: 8px;
  background: #16a34a;
  color: #ffffff;
  padding: 13px 16px;
  font-weight: 900;
  cursor: pointer;
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error-box {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
  padding: 12px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
}

.error-box a {
  color: #166534;
}

.notice-box {
  margin-bottom: 18px;
  padding: 12px;
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
}
</style>
