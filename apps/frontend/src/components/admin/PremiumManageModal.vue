<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="close">
      <div class="mx-auto flex w-full max-w-2xl max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col bg-white rounded-3xl shadow-2xl overflow-hidden slide-up">
        <header class="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h3 class="text-lg font-semibold text-slate-900">{{ title }}</h3>
          <button @click="close" class="text-slate-400 hover:text-slate-600 transition flex items-center justify-center rounded-full">
            <MfIcon name="close" size="20" />
          </button>
        </header>
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-white">
        <div class="bg-slate-50 rounded-xl p-4 space-y-1">
          <p class="text-sm font-medium text-slate-900">{{ user?.name }}</p>
          <p class="text-xs text-slate-500">{{ user?.email }}</p>
          <p class="text-xs text-slate-500">Gói hiện tại: <span class="font-medium text-slate-700">{{ user?.plan_name && user?.plan_name !== '—' ? user.plan_name : 'Không có' }}</span></p>
          <p class="text-xs text-slate-500">Hạn hiện tại: <span class="font-medium text-slate-700">{{ formattedExpiry }}</span></p>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Chọn gói Premium</label>
          <select v-model="form.planId" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
            <option value="">Chọn gói...</option>
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="radio" value="months" v-model="form.mode" class="accent-slate-900" /> Gia hạn theo tháng
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="radio" value="date" v-model="form.mode" class="accent-slate-900" /> Chọn ngày cụ thể
          </label>
        </div>
        <div v-if="form.mode === 'months'">
          <label class="block text-sm font-medium text-slate-700 mb-2">Số tháng</label>
          <div class="flex gap-2 mb-2">
            <button v-for="m in [1,3,6,12]" :key="m" @click="form.months = m" type="button"
              :class="form.months === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'"
              class="px-3 py-1.5 rounded-lg text-sm border transition">
              {{ m }} tháng
            </button>
          </div>
          <input type="number" min="1" v-model.number="form.months" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="Hoặc nhập số tháng" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Ngày hết hạn mới</label>
          <input type="date" v-model="calculatedDate" :readonly="form.mode === 'months'" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none" />
          <p v-if="form.mode === 'months'" class="text-xs text-slate-500 mt-1">Tự động tính: {{ formattedCalculatedDate }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Ghi chú admin</label>
          <textarea v-model="form.note" rows="2" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none resize-none" placeholder="Không bắt buộc..."></textarea>
        </div>
        </div>
        <footer class="shrink-0 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
        <button @click="close" type="button" class="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-white transition" :disabled="loading">Hủy</button>
        <button @click="submit" type="button" class="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2" :disabled="loading">
          <span v-if="loading" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
          Cập nhật Premium
        </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'

const props = defineProps({
  isOpen: Boolean,
  user: Object,
  plans: Array,
  actionType: String // 'extend', 'change', 'activate'
})

const emit = defineEmits(['close', 'refresh'])
const toast = useToastStore()

const loading = ref(false)

const form = ref({
  planId: '',
  mode: 'months',
  months: 1,
  manualDate: '',
  note: ''
})

const title = computed(() => {
  if (props.actionType === 'extend') return 'Gia hạn Premium'
  return 'Kích hoạt Premium'
})

const formattedExpiry = computed(() => {
  if (!props.user?.premium_expires_at) return '—'
  return new Date(props.user.premium_expires_at).toLocaleDateString('vi-VN')
})

const autoCalculatedDate = computed(() => {
  const base = (props.user?.premium_expires_at && new Date(props.user.premium_expires_at) > new Date())
    ? new Date(props.user.premium_expires_at)
    : new Date()
  
  const m = Number.isInteger(form.value.months) && form.value.months > 0 ? form.value.months : 1
  base.setMonth(base.getMonth() + m)
  return base
})

const calculatedDate = computed({
  get: () => {
    if (form.value.mode === 'months') {
      const offset = autoCalculatedDate.value.getTimezoneOffset() * 60000;
      return new Date(autoCalculatedDate.value.getTime() - offset).toISOString().split('T')[0]
    }
    return form.value.manualDate
  },
  set: (val) => {
    if (form.value.mode === 'date') {
      form.value.manualDate = val
    }
  }
})

const formattedCalculatedDate = computed(() => {
  return autoCalculatedDate.value.toLocaleDateString('vi-VN')
})

function handleKeydown(e) {
  if (e.key === 'Escape' && props.isOpen) {
    close()
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    document.body.classList.add('overflow-hidden')
    document.addEventListener('keydown', handleKeydown)
    form.value = {
      planId: props.user?.plan_id || (props.plans?.length ? props.plans[0].id : ''),
      mode: 'months',
      months: 1,
      manualDate: '',
      note: ''
    }
  } else {
    document.body.classList.remove('overflow-hidden')
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.body.classList.remove('overflow-hidden')
  document.removeEventListener('keydown', handleKeydown)
})

function close() {
  if (loading.value) return
  emit('close')
}

async function submit() {
  if (!form.value.planId) {
    toast.showToast('Vui lòng chọn gói Premium', 'error')
    return
  }
  
  if (form.value.mode === 'months' && (!form.value.months || form.value.months < 1)) {
    toast.showToast('Số tháng phải lớn hơn 0', 'error')
    return
  }

  if (!calculatedDate.value) {
    toast.showToast('Ngày hết hạn không hợp lệ', 'error')
    return
  }
  
  const selectedDate = new Date(calculatedDate.value)
  if (selectedDate <= new Date()) {
    toast.showToast('Ngày hết hạn mới không được ở trong quá khứ', 'error')
    return
  }

  loading.value = true
  try {
    await api.post(`/admin/premium/users/${props.user.user_id}/update`, {
      planId: form.value.planId,
      expiresAt: calculatedDate.value,
      months: form.value.mode === 'months' ? form.value.months : null,
      note: form.value.note
    })
    
    toast.showToast('Cập nhật Premium thành công', 'success')
    emit('refresh')
    close()
  } catch (error) {
    console.error('Lỗi khi cập nhật Premium:', error)
    toast.showToast(error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.slide-up {
  animation: slideUp 0.25s ease-out;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
