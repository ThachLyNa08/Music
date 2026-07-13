<template>
  <main class="activate-page">
    <section class="activate-panel">
      <p class="eyebrow">Artist Studio</p>
      <h1>Kich hoat tai khoan</h1>

      <div v-if="state === 'loading'" class="state-box">Dang kiem tra lien ket...</div>

      <div v-else-if="state === 'valid'" class="content">
        <div class="artist-box">
          <strong>{{ invitation.artistName }}</strong>
          <span>{{ invitation.email || invitation.maskedEmail }}</span>
        </div>

        <form class="activate-form" @submit.prevent="activate">
          <label>
            Mat khau moi
            <div class="password-row">
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required>
              <button type="button" class="toggle" @click="showPassword = !showPassword">
                {{ showPassword ? 'An' : 'Hien' }}
              </button>
            </div>
          </label>

          <label>
            Nhap lai mat khau
            <input v-model="form.confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required>
          </label>

          <p v-if="errorMsg" class="inline-error">{{ errorMsg }}</p>

          <button type="submit" :disabled="submitting">
            {{ submitting ? 'Dang kich hoat...' : 'Kich hoat tai khoan' }}
          </button>
        </form>
      </div>

      <div v-else class="state-box error">
        {{ errorMsg }}
        <RouterLink to="/artist/login">Quay lai dang nhap nghe si</RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const state = ref('loading')
const errorMsg = ref('')
const invitation = ref({})
const submitting = ref(false)
const showPassword = ref(false)
const form = reactive({ password: '', confirmPassword: '' })
const token = ref('')

async function verify() {
  token.value = String(route.query.token || '')
  if (!token.value) {
    state.value = 'error'
    errorMsg.value = 'Lien ket kich hoat khong hop le.'
    return
  }

  try {
    const res = await authApi.verifyArtistInvitation(token.value)
    invitation.value = res.data?.data || {}
    state.value = 'valid'
  } catch (err) {
    state.value = 'error'
    errorMsg.value = err.response?.data?.message || 'Khong the xac minh lien ket kich hoat.'
  }
}

async function activate() {
  if (form.password !== form.confirmPassword) {
    errorMsg.value = 'Mat khau xac nhan khong khop.'
    return
  }
  submitting.value = true
  try {
    await authApi.activateArtistInvitation({
      token: token.value,
      password: form.password,
      confirmPassword: form.confirmPassword,
    })
    await router.replace('/artist/login')
    toast.showToast('Kich hoat tai khoan nghe si thanh cong.', 'success')
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Khong the kich hoat tai khoan.'
    state.value = 'error'
  } finally {
    submitting.value = false
  }
}

onMounted(verify)
</script>

<style scoped>
.activate-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #f7f8fb;
  color: #111827;
}

.activate-panel {
  width: min(100%, 520px);
  background: #ffffff;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1);
}

.eyebrow {
  margin: 0 0 8px;
  color: #16a34a;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 22px;
  font-size: 28px;
}

.content,
.activate-form {
  display: grid;
  gap: 16px;
}

.artist-box,
.state-box {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.artist-box span {
  color: #64748b;
  font-size: 14px;
}

.state-box.error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.inline-error {
  margin: 0;
  color: #b91c1c;
  font-weight: 800;
  font-size: 13px;
}

label {
  display: grid;
  gap: 7px;
  font-weight: 800;
  font-size: 13px;
}

input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 13px;
  font-size: 15px;
}

.password-row {
  display: flex;
  gap: 8px;
}

.toggle {
  width: 74px;
  background: #e5e7eb;
  color: #111827;
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
}
</style>
