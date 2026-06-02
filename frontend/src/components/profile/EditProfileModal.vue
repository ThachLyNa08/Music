<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Overlay -->
    <div 
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      @click="$emit('close')"
    ></div>

    <!-- Modal Content -->
    <div class="relative w-full max-w-2xl user-modal overflow-hidden flex flex-col z-10">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-6 pb-4">
        <h2 class="text-2xl font-bold text-white">Chỉnh sửa hồ sơ</h2>
        <button 
          @click="$emit('close')"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 pt-2 flex flex-col md:flex-row gap-6">
        
        <!-- Avatar Upload -->
        <div class="flex-shrink-0 flex justify-center">
          <div 
            class="relative w-48 h-48 rounded-full overflow-hidden shadow-xl bg-white/10 flex items-center justify-center group cursor-pointer"
            @click="triggerFileInput"
          >
            <img 
              v-if="previewUrl || user?.avatar_url" 
              :src="previewUrl || localFormatImageUrl(user?.avatar_url)" 
              class="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40" 
              @error="event => event.target.src = '/default-avatar.png'"
            />
            <span v-else class="text-6xl font-bold text-white group-hover:opacity-40">{{ user?.name?.charAt(0)?.toUpperCase() || 'U' }}</span>
            
            <!-- Hover Overlay -->
            <div class="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <svg class="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span class="text-sm font-medium text-white">Chọn ảnh</span>
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
        <div class="flex-1 flex flex-col gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Tên hiển thị</label>
            <input 
              v-model="formData.name" 
              type="text" 
              class="user-input"
              placeholder="Thêm tên hiển thị"
              maxlength="100"
            />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Giới thiệu (Bio)</label>
            <textarea 
              v-model="formData.bio" 
              rows="4" 
              class="user-input resize-none"
              placeholder="Thêm một vài mô tả về bạn..."
              maxlength="500"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="errorMsg" class="px-6 text-red-400 text-sm font-medium">
        {{ errorMsg }}
      </div>

      <!-- Footer -->
      <div class="p-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
        <p class="text-xs text-gray-400 max-w-sm text-center sm:text-left">
          Bằng cách tiếp tục, bạn đồng ý cho MusicFlow sử dụng tên và ảnh hồ sơ của bạn trong hệ thống.
        </p>
        <div class="flex gap-4">
          <button 
            @click="$emit('close')"
            class="user-secondary-btn"
            :disabled="loading"
          >
            Hủy
          </button>
          <button 
            @click="saveProfile"
            class="user-primary-btn min-w-[100px] disabled:opacity-50 disabled:hover:scale-100"
            :disabled="loading || !isChanged"
          >
            <div v-if="loading" class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span v-else>Lưu</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'

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

const formData = reactive({
  name: '',
  bio: ''
})

// Update form data when modal opens
watch(() => props.show, (newVal) => {
  if (newVal && props.user) {
    formData.name = props.user.name || props.user.display_name || ''
    formData.bio = props.user.bio || ''
    previewUrl.value = null
    selectedFile.value = null
    errorMsg.value = ''
  }
})

const isChanged = computed(() => {
  return formData.name !== (props.user?.name || props.user?.display_name || '') ||
         formData.bio !== (props.user?.bio || '') ||
         selectedFile.value !== null
})

const localFormatImageUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('blob:')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
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
      const res = await api.post('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data.success) {
        newAvatarUrl = res.data.data.avatar_url
      }
    }

    // 2. Update Profile Text
    const res2 = await api.put('/users/me/profile', {
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
