<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4" @click.self="$emit('close')">
      <div class="w-full max-w-[720px] rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white m-0">Danh sách phát mới</h2>
          <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors" title="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="flex flex-col gap-6">
          <!-- Body -->
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Cover -->
            <div 
              class="w-full md:w-[240px] h-[240px] shrink-0 bg-[#282828] rounded-xl flex items-center justify-center cursor-pointer group relative overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-transparent hover:border-white/20 transition-all"
              @click="$refs.coverInput.click()"
            >
              <input type="file" ref="coverInput" accept="image/*" @change="handleFile" hidden />
              
              <!-- Preview -->
              <img v-if="previewUrl" :src="previewUrl" class="w-full h-full object-cover absolute inset-0 z-0" />
              
              <!-- Empty state -->
              <div v-if="!previewUrl" class="flex flex-col items-center gap-4 text-gray-400 group-hover:text-white z-10 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-16 h-16 opacity-50 group-hover:opacity-100 transition-opacity">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span class="font-medium text-sm">Thêm ảnh bìa</span>
              </div>
              
              <!-- Hover Overlay for preview -->
              <div v-if="previewUrl" class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-10 h-10 mb-2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span class="font-medium text-sm">Đổi ảnh</span>
              </div>
            </div>

            <!-- Form -->
            <div class="flex-1 flex flex-col gap-4">
              <input 
                ref="nameInput"
                v-model="form.name" 
                type="text" 
                required 
                placeholder="Tên danh sách phát" 
                class="w-full bg-[#2a2a2a] text-white text-sm font-semibold px-4 py-3 rounded-md outline-none focus:border-white/30 border border-transparent placeholder-gray-400 transition-colors"
              />
              <textarea 
                v-model="form.description" 
                placeholder="Thêm mô tả tùy chọn" 
                class="w-full bg-[#2a2a2a] text-white text-sm px-4 py-3 rounded-md outline-none focus:border-white/30 border border-transparent placeholder-gray-400 resize-none flex-1 min-h-[120px] transition-colors"
              ></textarea>
            </div>
          </div>

          <!-- Footer Options -->
          <div class="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div class="flex items-center gap-4 w-full md:w-auto">
              <!-- Privacy Pill -->
              <button type="button" @click="form.is_public = !form.is_public" class="flex items-center justify-center gap-2 px-3 py-1.5 w-[115px] rounded-full bg-[#2a2a2a] hover:bg-[#333] border border-white/10 text-xs font-semibold text-white transition-colors" :title="form.is_public ? 'Chuyển sang riêng tư' : 'Chuyển sang công khai'">
                <svg v-if="form.is_public" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0110 0v4"></path>
                </svg>
                <span class="whitespace-nowrap">{{ form.is_public ? 'Công khai' : 'Riêng tư' }}</span>
              </button>


            </div>

            <!-- Note & Submit -->
            <div class="flex items-center gap-4 ml-auto w-full md:w-auto justify-end">
              <span v-if="form.coverFile" class="text-[11px] text-gray-500 hidden md:inline">Hãy đảm bảo bạn có quyền sử dụng ảnh.</span>
              <button type="button" class="text-sm font-bold text-gray-400 hover:text-white hover:scale-105 transition-transform px-4 py-2" @click="$emit('close')">Hủy</button>
              <button type="submit" class="text-sm font-bold bg-[#1ed760] text-black px-6 py-2 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" :disabled="creating || !form.name.trim()">
                {{ creating ? 'Đang tạo...' : 'Tạo' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  creating: Boolean
})

const emit = defineEmits(['close', 'create'])

const coverInput = ref(null)
const nameInput = ref(null)
const previewUrl = ref(null)

const form = reactive({
  name: '',
  description: '',
  is_public: true,
  is_collaborative: false,
  coverFile: null
})

function handleFile(e) {
  if (e.target.files && e.target.files.length > 0) {
    const file = e.target.files[0]
    form.coverFile = file
    previewUrl.value = URL.createObjectURL(file)
  }
}

function handleCreate() {
  if (!form.name.trim()) return
  emit('create', form)
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', handleEsc)
  form.name = 'Danh sách phát của tôi'
  
  setTimeout(() => {
    if (nameInput.value) {
      nameInput.value.focus()
      nameInput.value.select()
    }
  }, 100)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleEsc)
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

function handleEsc(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}
</script>
