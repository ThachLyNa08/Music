<template>
  <main class="min-h-screen bg-[#020807] text-white flex items-center justify-center px-4 py-10">
    <section class="w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-300/20 bg-[#07110d] shadow-2xl shadow-black/50">
      <header class="bg-gradient-to-r from-[#092315] via-[#0b2c1c] to-[#071927] px-6 py-6">
        <p class="text-xs font-black uppercase tracking-[0.26em] text-emerald-200">MusicFlow</p>
        <h1 class="mt-3 text-3xl font-black tracking-tight">Khiếu nại khóa tài khoản</h1>
        <p class="mt-2 text-sm font-medium leading-6 text-slate-300">
          Gửi nội dung giải thích cho quản trị viên. Bạn có thể đính kèm ảnh minh chứng nếu có.
        </p>
      </header>

      <div v-if="!token" class="m-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
        {{ copy.invalidLink }}
      </div>

      <form v-else class="space-y-5 px-6 py-6" @submit.prevent="submitAppeal">
        <label class="block" for="appeal-reason">
          <span class="text-sm font-bold text-slate-100">Lý do khiếu nại</span>
          <textarea
            id="appeal-reason"
            :value="reason"
            @input="reason = $event.target.value"
            rows="7"
            name="appeal_reason"
            autocomplete="off"
            autofocus
            class="mt-2 block w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white caret-emerald-300 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
            placeholder="Hãy mô tả vì sao bạn cho rằng tài khoản bị khóa nhầm..."
            :readonly="loading || Boolean(success)"
          ></textarea>
        </label>

        <label class="block">
          <span class="text-sm font-bold text-slate-100">Ảnh minh chứng <span class="font-medium text-slate-400">(không bắt buộc)</span></span>
          <div class="mt-2 rounded-xl border border-dashed border-white/15 bg-black/20 p-4">
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 hover:file:bg-emerald-300"
              :disabled="loading || Boolean(success)"
              @change="handleEvidenceChange"
            />
            <p class="mt-2 text-xs font-medium text-slate-500">Hỗ trợ JPG, PNG, WEBP. Tối đa 20MB.</p>
            <img
              v-if="evidencePreview"
              :src="evidencePreview"
              alt="Ảnh minh chứng"
              class="mt-4 max-h-56 w-full rounded-xl border border-white/10 object-contain"
            />
          </div>
        </label>

        <div v-if="error" class="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {{ error }}
        </div>
        <div v-if="success" class="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {{ success }}
        </div>

        <button
          type="submit"
          class="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || Boolean(success)"
        >
          {{ loading ? copy.submitting : copy.submit }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { accountApi } from '@/api/account'
import { useAuthStore } from '@/stores/auth'

const copy = {
  invalidLink: 'Liên kết khiếu nại không hợp lệ hoặc đã hết hạn.',
  submitting: 'Đang gửi...',
  submit: 'Gửi khiếu nại',
  shortReason: 'Vui lòng nhập lý do khiếu nại chi tiết hơn.',
  invalidImage: 'Vui lòng chọn file hình ảnh hợp lệ.',
  fallbackSuccess: 'Khiếu nại của bạn đã được gửi.',
  fallbackError: 'Không thể gửi khiếu nại. Vui lòng thử lại sau.',
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const token = computed(() => String(route.query.token || '').trim())
const reason = ref('')
const evidenceFile = ref(null)
const evidencePreview = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

onMounted(async () => {
  await nextTick()
  document.getElementById('appeal-reason')?.focus()
})

onBeforeUnmount(() => {
  revokeEvidencePreview()
})

function revokeEvidencePreview() {
  if (evidencePreview.value) URL.revokeObjectURL(evidencePreview.value)
  evidencePreview.value = ''
}

function handleEvidenceChange(event) {
  error.value = ''
  const file = event.target.files?.[0] || null
  revokeEvidencePreview()
  evidenceFile.value = null

  if (!file) return
  if (!file.type.startsWith('image/')) {
    event.target.value = ''
    error.value = copy.invalidImage
    return
  }

  evidenceFile.value = file
  evidencePreview.value = URL.createObjectURL(file)
}

async function submitAppeal() {
  error.value = ''
  success.value = ''

  if (reason.value.trim().length < 20) {
    error.value = copy.shortReason
    return
  }

  const formData = new FormData()
  formData.append('token', token.value)
  formData.append('reason', reason.value.trim())
  if (evidenceFile.value) formData.append('evidence', evidenceFile.value)

  loading.value = true
  try {
    const res = await accountApi.submitLockAppeal(formData)
    success.value = res.data?.message || copy.fallbackSuccess
    authStore.logoutSilently()
    await router.replace('/login')
  } catch (err) {
    error.value = err.response?.data?.message || copy.fallbackError
  } finally {
    loading.value = false
  }
}
</script>
