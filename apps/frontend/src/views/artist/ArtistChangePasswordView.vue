<template>
  <section class="change-password-page">
    <article class="change-card">
      <p class="eyebrow">Bao mat tai khoan</p>
      <h1>Doi mat khau lan dau</h1>
      <p class="intro">Tai khoan dang su dung mat khau tam thoi. Vui long doi mat khau de tiep tuc vao Artist Studio.</p>

      <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

      <form class="password-form" @submit.prevent="submit">
        <label>
          Mat khau hien tai
          <input v-model="form.currentPassword" type="password" autocomplete="current-password" required>
        </label>

        <label>
          Mat khau moi
          <input v-model="form.newPassword" type="password" autocomplete="new-password" required>
        </label>

        <label>
          Nhap lai mat khau moi
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" required>
        </label>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Dang doi mat khau...' : 'Doi mat khau' }}
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

async function submit() {
  errorMsg.value = ''
  if (form.newPassword !== form.confirmPassword) {
    errorMsg.value = 'Mat khau xac nhan khong khop.'
    return
  }

  loading.value = true
  try {
    const res = await artistAccountApi.changePassword({ ...form })
    auth.markArtistPasswordChanged()
    toast.showToast(res.data?.message || 'Doi mat khau thanh cong.', 'success')
    await router.push(res.data?.redirectTo || '/artist/dashboard')
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Khong the doi mat khau.'
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
}

.change-card {
  width: min(100%, 480px);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 28px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
}

.eyebrow {
  margin: 0 0 8px;
  color: #16a34a;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 10px;
  font-size: 26px;
}

.intro {
  margin: 0 0 22px;
  color: #64748b;
  line-height: 1.6;
}

.password-form {
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
  margin-bottom: 16px;
  padding: 12px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-weight: 700;
}
</style>
