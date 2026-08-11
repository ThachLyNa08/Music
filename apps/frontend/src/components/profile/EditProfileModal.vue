<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
      
      <!-- Overlay (click to close) -->
      <div 
        class="absolute inset-0"
        @click="$emit('close')"
      ></div>

      <!-- Modal Content -->
      <div class="relative w-full max-w-[720px] max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#101014] p-8 shadow-2xl flex flex-col">
        
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-2xl font-bold text-white tracking-tight">Chỉnh sửa hồ sơ</h2>
          <button 
            @click="$emit('close')"
            class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex flex-col md:flex-row gap-8">
          
          <!-- Avatar Upload -->
          <div class="flex-shrink-0 flex justify-center md:justify-start">
            <div 
              class="relative w-48 h-48 rounded-full shadow-2xl bg-[#282828] flex items-center justify-center group cursor-pointer overflow-hidden border border-white/5"
              @click="triggerFileInput"
            >
              <img 
                v-if="previewUrl || user?.avatar_url" 
                :src="previewUrl || localFormatImageUrl(user?.avatar_url)" 
                class="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40" 
                @error="event => event.target.src = '/default-avatar.png'"
              />
              <span v-else class="text-6xl font-bold text-white/50 group-hover:opacity-40 transition-opacity duration-300">{{ user?.name?.charAt(0)?.toUpperCase() || 'U' }}</span>
              
              <!-- Hover Overlay -->
              <div class="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-black/40">
                <svg class="w-10 h-10 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span class="text-sm font-semibold text-white drop-shadow-md">Chọn ảnh</span>
              </div>
            </div>
            <input 
              ref="fileInput" 
              type="file" 
              accept="image/jpeg, image/png, image/webp" 
              class="hidden" 
              @change="handleAvatarChange"
            />
          </div>

          <!-- Form Fields -->
          <div class="flex-1 flex flex-col gap-5">
            <div>
              <input 
                v-model="formData.name" 
                type="text" 
                class="w-full bg-[#3E3E3E]/40 text-white text-sm font-semibold px-4 py-3 rounded-lg border border-transparent focus:border-white/30 focus:bg-[#3E3E3E]/60 outline-none transition-all placeholder:text-gray-500"
                placeholder="Tên hiển thị"
                maxlength="100"
              />
            </div>
            <div class="flex-1">
              <textarea 
                v-model="formData.bio" 
                rows="5" 
                class="w-full h-full bg-[#3E3E3E]/40 text-white text-sm font-medium px-4 py-3 rounded-lg border border-transparent focus:border-white/30 focus:bg-[#3E3E3E]/60 outline-none transition-all resize-none placeholder:text-gray-500"
                placeholder="Thêm một vài mô tả về bạn..."
                maxlength="500"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Change Password -->
        <form class="mt-8 border-t border-white/10 pt-6" @submit.prevent="changePassword">
          <div class="flex flex-col gap-1 mb-4">
            <h3 class="text-base font-bold text-white">Đổi mật khẩu</h3>
            <p class="text-xs text-gray-400 font-medium">Nhập mật khẩu hiện tại trước khi cập nhật mật khẩu mới.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="relative">
              <input
                v-model="passwordForm.currentPassword"
                type="password"
                autocomplete="current-password"
                class="w-full bg-[#3E3E3E]/40 text-white text-sm font-semibold px-4 py-3 pr-11 rounded-lg border border-transparent focus:border-white/30 focus:bg-[#3E3E3E]/60 outline-none transition-all placeholder:text-gray-500"
                :class="{ 'border-[#1ED760]/70': currentPasswordVerified, 'border-red-400/70': passwordError && !currentPasswordVerified }"
                placeholder="Mật khẩu hiện tại"
                @blur="verifyCurrentPassword"
                @keyup.enter.prevent="verifyCurrentPassword"
              />
              <div class="absolute inset-y-0 right-3 flex items-center">
                <div v-if="verifyingCurrentPassword" class="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></div>
                <span v-else-if="currentPasswordVerified" class="text-[#1ED760] text-sm font-black">✓</span>
              </div>
            </div>
            <input
              v-model="passwordForm.newPassword"
              type="password"
              autocomplete="new-password"
              class="w-full bg-[#3E3E3E]/40 text-white text-sm font-semibold px-4 py-3 rounded-lg border border-transparent focus:border-white/30 focus:bg-[#3E3E3E]/60 outline-none transition-all placeholder:text-gray-500 disabled:opacity-45 disabled:cursor-not-allowed"
              :class="{ 'border-red-400/70': isNewPasswordSameAsCurrent }"
              placeholder="Mật khẩu mới"
              :disabled="!currentPasswordVerified"
            />
            <input
              v-model="passwordForm.confirmPassword"
              type="password"
              autocomplete="new-password"
              class="w-full bg-[#3E3E3E]/40 text-white text-sm font-semibold px-4 py-3 rounded-lg border border-transparent focus:border-white/30 focus:bg-[#3E3E3E]/60 outline-none transition-all placeholder:text-gray-500 disabled:opacity-45 disabled:cursor-not-allowed"
              :class="{ 'border-red-400/70': isConfirmPasswordMismatch }"
              placeholder="Xác nhận mật khẩu mới"
              :disabled="!currentPasswordVerified"
            />
          </div>

          <div v-if="passwordValidationMessage" class="mt-3 text-red-400 text-sm font-medium">
            {{ passwordValidationMessage }}
          </div>
          <div v-if="passwordSuccess" class="mt-3 text-[#1ED760] text-sm font-bold">
            {{ passwordSuccess }}
          </div>

          <div class="mt-4 flex justify-end">
            <button
              type="submit"
              class="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:scale-105 transition-transform cursor-pointer disabled:opacity-50 disabled:hover:scale-100 min-w-[140px] flex items-center justify-center"
              :disabled="passwordLoading || verifyingCurrentPassword || !canChangePassword"
            >
              <div v-if="passwordLoading" class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span v-else>Đổi mật khẩu</span>
            </button>
          </div>
        </form>

        <!-- Error Message -->
        <div v-if="errorMsg" class="mt-4 text-red-400 text-sm font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          {{ errorMsg }}
        </div>

        <!-- Footer -->
        <div class="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p class="text-xs text-gray-400 max-w-sm text-center md:text-left font-medium leading-relaxed">
            Bằng cách tiếp tục, bạn đồng ý cho MusicFlow sử dụng tên và ảnh hồ sơ của bạn trong hệ thống.
          </p>
          <div class="flex gap-3 w-full md:w-auto shrink-0 justify-end">
            <button 
              @click="$emit('close')"
              class="px-6 py-3 bg-transparent text-white text-sm font-bold rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              :disabled="loading"
            >
              Hủy
            </button>
            <button 
              @click="saveProfile"
              class="px-8 py-3 bg-[#1ED760] text-black text-sm font-bold rounded-full hover:scale-105 transition-transform cursor-pointer disabled:opacity-50 disabled:hover:scale-100 min-w-[100px] flex items-center justify-center"
              :disabled="loading || !isChanged"
            >
              <div v-if="loading" class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span v-else>Lưu</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api/user'
import { toBackendAssetUrl } from '@/config/runtime'

const props = defineProps({
  show: Boolean,
  user: Object
})

const emit = defineEmits(['close', 'updated'])
const authStore = useAuthStore()

const fileInput = ref(null)
const previewUrl = ref(null)
const selectedFile = ref(null)

const loading = ref(false)
const errorMsg = ref('')
const passwordLoading = ref(false)
const verifyingCurrentPassword = ref(false)
const currentPasswordVerified = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

const formData = reactive({
  name: '',
  bio: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Update form data when modal opens
watch(() => props.show, (newVal) => {
  if (newVal && props.user) {
    formData.name = props.user.name || props.user.display_name || ''
    formData.bio = props.user.bio || ''
    previewUrl.value = null
    selectedFile.value = null
    errorMsg.value = ''
    resetPasswordForm()
  }
})

watch(() => passwordForm.currentPassword, () => {
  currentPasswordVerified.value = false
  passwordSuccess.value = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
})

const isChanged = computed(() => {
  return formData.name !== (props.user?.name || props.user?.display_name || '') ||
         formData.bio !== (props.user?.bio || '') ||
         selectedFile.value !== null
})

const canChangePassword = computed(() => {
  return Boolean(
    currentPasswordVerified.value &&
    passwordForm.currentPassword &&
    passwordForm.newPassword &&
    passwordForm.confirmPassword &&
    !isNewPasswordSameAsCurrent.value &&
    !isConfirmPasswordMismatch.value
  )
})

const isNewPasswordSameAsCurrent = computed(() => {
  return Boolean(
    currentPasswordVerified.value &&
    passwordForm.newPassword &&
    passwordForm.newPassword === passwordForm.currentPassword
  )
})

const isConfirmPasswordMismatch = computed(() => {
  return Boolean(
    currentPasswordVerified.value &&
    passwordForm.newPassword &&
    passwordForm.confirmPassword &&
    passwordForm.newPassword !== passwordForm.confirmPassword
  )
})

const passwordValidationMessage = computed(() => {
  if (passwordError.value) return passwordError.value
  if (isNewPasswordSameAsCurrent.value) return 'Mật khẩu mới không được trùng với mật khẩu hiện tại'
  if (isConfirmPasswordMismatch.value) return 'Mật khẩu xác nhận không khớp với mật khẩu mới'
  return ''
})

const localFormatImageUrl = (url) => {
  if (!url) return ''
  return toBackendAssetUrl(url)
}

function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

function handleAvatarChange(event) {
  const file = event.target.files[0]
  if (!file) return

  // Validate size < 5MB
  if (file.size > 5 * 1024 * 1024) {
    errorMsg.value = 'Ảnh không được vượt quá 5MB'
    return
  }
  
  errorMsg.value = ''
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function resetPasswordForm() {
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  currentPasswordVerified.value = false
  verifyingCurrentPassword.value = false
  passwordError.value = ''
  passwordSuccess.value = ''
  passwordLoading.value = false
}

async function verifyCurrentPassword() {
  if (!passwordForm.currentPassword || verifyingCurrentPassword.value || currentPasswordVerified.value) return

  passwordError.value = ''
  passwordSuccess.value = ''
  verifyingCurrentPassword.value = true

  try {
    await userApi.verifyCurrentPassword({
      currentPassword: passwordForm.currentPassword
    })
    currentPasswordVerified.value = true
  } catch (err) {
    console.error('Verify current password error:', err)
    currentPasswordVerified.value = false
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordError.value = err.response?.data?.message || 'Mật khẩu hiện tại không đúng'
  } finally {
    verifyingCurrentPassword.value = false
  }
}

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!currentPasswordVerified.value) {
    await verifyCurrentPassword()
  }

  if (!currentPasswordVerified.value) {
    return
  }

  if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
    passwordError.value = 'Vui lòng nhập mật khẩu mới và xác nhận mật khẩu mới'
    return
  }

  if (passwordForm.newPassword.length < 6) {
    passwordError.value = 'Mật khẩu mới tối thiểu 6 ký tự'
    return
  }

  if (isNewPasswordSameAsCurrent.value) {
    passwordError.value = 'Mật khẩu mới không được trùng với mật khẩu hiện tại'
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Mật khẩu xác nhận không khớp'
    return
  }

  passwordLoading.value = true
  try {
    const res = await userApi.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword
    })

    passwordSuccess.value = res.data?.message || 'Đổi mật khẩu thành công'
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (err) {
    console.error('Change password error:', err)
    passwordError.value = err.response?.data?.message || 'Không thể đổi mật khẩu'
  } finally {
    passwordLoading.value = false
  }
}

async function saveProfile() {
  if (!formData.name.trim()) {
    errorMsg.value = 'Tên hiển thị không được để trống'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    let newAvatarUrl = props.user?.avatar_url
    
    // 1. Upload Avatar if selected
    if (selectedFile.value) {
      const form = new FormData()
      form.append('avatar', selectedFile.value)
      const res = await userApi.uploadAvatar(form)
      if (res.data.success) {
        newAvatarUrl = res.data.data.avatar_url
      }
    }

    // 2. Update Profile Text
    const res2 = await userApi.updateProfile({
      name: formData.name,
      bio: formData.bio
    })
    
    let updatedUser = {}
    if (res2.data.success) {
      updatedUser = res2.data.data
    }

    // 3. Update Auth Store
    if (authStore.user) {
      authStore.user.display_name = updatedUser.name || formData.name
      authStore.user.avatar_url = newAvatarUrl
    }

    emit('updated', {
      ...props.user,
      name: formData.name,
      bio: formData.bio,
      avatar_url: newAvatarUrl
    })
    emit('close')

  } catch (err) {
    console.error('Save profile error:', err)
    errorMsg.value = err.response?.data?.message || 'Có lỗi xảy ra khi lưu hồ sơ'
  } finally {
    loading.value = false
  }
}
</script>
