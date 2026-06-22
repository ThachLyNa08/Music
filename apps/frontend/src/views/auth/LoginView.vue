<template>
  <AuthShell>
    <template #background>
      <FloatingMusicBackground />
    </template>

    <AuthCard class="animate-fade-in-up-delay relative z-10 mx-auto w-full max-w-md">
      <div class="mb-10 text-center lg:text-left">
        <h2 class="text-3xl font-bold text-white mb-2 tracking-tight">Chào mừng trở lại</h2>
        <p class="text-[15px] font-medium text-white/50">Đăng nhập để tiếp tục nghe nhạc theo gu của bạn</p>
      </div>

      <!-- Error Banner -->
      <div v-if="errorMsg" class="mb-8 p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm animate-shake font-medium">
        {{ errorMsg }}
      </div>
      
      <!-- Form -->
      <div class="space-y-6">
        <AuthInput
          id="email"
          label="Email"
          v-model="form.email"
          type="email"
          placeholder="Tên đăng nhập hoặc email"
          @enter="handleLogin"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
          </template>
        </AuthInput>
        
        <PasswordInput
          id="password"
          label="Mật khẩu"
          v-model="form.password"
          placeholder="••••••••"
          @enter="handleLogin"
        />
        
        <div class="pt-4">
          <AuthButton :loading="loading" @click="handleLogin">
            Đăng nhập
          </AuthButton>
        </div>
      </div>
      
      <div class="mt-8 text-center">
        <p class="text-[14px] font-medium text-white/50">
          Bạn chưa có tài khoản? 
          <RouterLink to="/register" class="text-[#1ed760] hover:text-[#25e96a] font-bold transition-colors">Đăng ký ngay</RouterLink>
        </p>
      </div>
    </AuthCard>
  </AuthShell>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import FloatingMusicBackground from '@/components/auth/FloatingMusicBackground.vue'
import AuthShell from '@/components/auth/AuthShell.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthInput from '@/components/auth/AuthInput.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import AuthButton from '@/components/auth/AuthButton.vue'

const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
const loading  = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!form.email || !form.password) return
  errorMsg.value = ''; loading.value = true
  const res = await auth.login(form.email, form.password)
  loading.value = false
  if (!res.success) errorMsg.value = res.message
}
</script>

<style scoped>
.animate-fade-in-up-delay {
  opacity: 0;
  animation: fadeInUp 0.8s ease-out 0.1s forwards;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-shake {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
</style>