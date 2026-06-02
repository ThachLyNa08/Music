<template>
  <div class="login-wrapper bg-[#0B0F19] text-white font-sans min-h-screen flex selection:bg-primary selection:text-white">
    <!-- Left Split: Abstract Visual -->
    <div class="hidden lg:block lg:w-1/2 relative overflow-hidden bg-[#070A13]">
      <div class="absolute inset-0 z-10 bg-gradient-to-r from-transparent to-[#0B0F19]"></div>
      
      <!-- Animated Background Image -->
      <img alt="MusicFlow Background" class="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-80 animate-bg-zoom" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKPJIIoOr-ZkSgt5F1rUcuyPf1zPifU5Ti0mTIgnlWSmCfWZbY0fpsO1eSeoaUP1X3El2I6wCvJB3goYBjnUIf-xP-uD9QcowSD0PCow1i827FvfIoYrvTHgEg1MxOewOAEXQTaf7KbVPh4WzSBJgi0rQJol2UoAA1UAC7I1wBlYQ89IGd9WN9a-T1SaMsrlesm9yPlYv8Xzlc-ZDSzZupeZPsYHlSErENO8e6EF3TPxMcmaGiI7Ga8wYys3f3o9DCICFOxUoSGwY"/>
      
      <FloatingMusicBackground />
      
      <!-- Brand overlay on visual -->
      <div class="absolute top-10 left-10 z-20 flex items-center gap-3 animate-fade-in-up">
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-[#7C3AED] filter drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
          <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2-12v6a2 2 0 1 0 4 0V9a2 2 0 1 0-4 0z" />
        </svg>
        <div class="flex flex-col">
          <span class="text-2xl font-bold text-white tracking-tight">MusicFlow</span>
          <span class="text-xs text-[#06B6D4] uppercase tracking-widest font-medium">Onboarding</span>
        </div>
      </div>
    </div>
    
    <!-- Right Split: Login Form Container -->
    <div class="w-full lg:w-1/2 flex items-center justify-center relative p-6 sm:p-10 lg:p-16 z-20">
      <!-- Ambient Background Glows -->
      <div class="absolute top-1/4 -left-32 w-96 h-96 bg-[#7C3AED]/10 rounded-full mix-blend-screen blur-[100px] pointer-events-none animate-pulse-slow"></div>
      <div class="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#06B6D4]/5 rounded-full mix-blend-screen blur-[120px] pointer-events-none animate-pulse-slow-alt"></div>
      
      <!-- Glassmorphic Login Card -->
      <div class="glass-panel w-full max-w-md rounded-[24px] p-8 sm:p-10 shadow-2xl relative z-10 animate-fade-in-up-delay">
        
        <!-- Mobile Brand Header (Hidden on Desktop) -->
        <div class="lg:hidden flex flex-col items-center mb-8">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-[#7C3AED] mb-2 filter drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
            <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2-12v6a2 2 0 1 0 4 0V9a2 2 0 1 0-4 0z" />
          </svg>
          <h1 class="text-3xl font-bold text-white">MusicFlow</h1>
        </div>
        
        <div class="mb-10 text-center lg:text-left">
          <h2 class="text-3xl font-bold text-white mb-2">Chào mừng trở lại</h2>
          <p class="text-base text-white/70">Đăng nhập để tiếp tục hành trình âm nhạc của bạn.</p>
        </div>

        <!-- Error Banner -->
        <div v-if="errorMsg" class="mb-6 p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm animate-shake">
          {{ errorMsg }}
        </div>
        
        <!-- Social Login -->
        <div class="relative group">
          <button disabled class="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-full bg-white/4 border border-white/8 text-white/50 text-base mb-8 cursor-not-allowed">
            <svg class="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"></path>
            </svg>
            Continue with Google
          </button>
          <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Sắp ra mắt</div>
        </div>
        
        <!-- Divider -->
        <div class="flex items-center gap-4 mb-8">
          <div class="h-px bg-white/10 flex-1"></div>
          <span class="text-xs text-white/50 uppercase tracking-widest font-medium">Hoặc</span>
          <div class="h-px bg-white/10 flex-1"></div>
        </div>
        
        <!-- Form -->
        <div class="space-y-5">
          <div>
            <label class="block text-xs font-medium text-white/70 mb-2 ml-4" for="email">Email</label>
            <div class="relative group">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#7C3AED] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
              </span>
              <input v-model="form.email" class="w-full bg-white/3 border border-white/8 rounded-full py-3.5 pl-11 pr-5 text-white text-base placeholder:text-white/30 focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] focus:outline-none transition-all" id="email" type="email" placeholder="Tên đăng nhập hoặc email" @keyup.enter="handleLogin"/>
            </div>
          </div>
          
          <div>
            <div class="flex justify-between items-center mb-2 px-4">
              <label class="text-xs font-medium text-white/70" for="password">Mật khẩu</label>
              <a class="text-xs text-[#06B6D4] hover:text-[#06B6D4]/80 transition-colors font-medium" href="#">Quên mật khẩu?</a>
            </div>
            <div class="relative group">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#7C3AED] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
              </span>
              <input v-model="form.password" :type="showPass ? 'text' : 'password'" class="w-full bg-white/3 border border-white/8 rounded-full py-3.5 pl-11 pr-12 text-white text-base placeholder:text-white/30 focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] focus:outline-none transition-all" id="password" placeholder="••••••••" @keyup.enter="handleLogin"/>
              <button class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#7C3AED] transition-colors" type="button" @click="showPass = !showPass">
                <svg v-if="!showPass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </button>
            </div>
          </div>
          
          <button class="glow-button w-full mt-8 py-4 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] text-white text-lg font-bold transition-all duration-300 relative overflow-hidden flex justify-center items-center gap-2 group" type="button" :disabled="loading" @click="handleLogin">
            <span v-if="loading" class="loading-dots"><span/><span/><span/></span>
            <template v-else>
              Đăng nhập
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="group-hover:translate-x-1 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </template>
          </button>
        </div>
        
        <div class="mt-8 text-center">
          <p class="text-base text-white/70">
            Bạn chưa có tài khoản? 
            <RouterLink to="/register" class="text-[#7C3AED] hover:text-[#7C3AED]/80 font-medium transition-colors border-b border-transparent hover:border-white/20 pb-0.5">Đăng ký ngay</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import FloatingMusicBackground from '@/components/auth/FloatingMusicBackground.vue'

const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
const showPass = ref(false)
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.login-wrapper {
  font-family: 'Inter', sans-serif;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.glow-button:hover:not(:disabled) {
  box-shadow: 0 0 30px rgba(124, 58, 237, 0.4), 0 0 20px rgba(59, 130, 246, 0.2);
}
.glow-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Animations */
.animate-bg-zoom {
  animation: bgZoom 20s infinite alternate ease-in-out;
}
@keyframes bgZoom {
  0% { transform: scale(1); }
  100% { transform: scale(1.1); }
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
}
.animate-fade-in-up-delay {
  opacity: 0;
  animation: fadeInUp 0.8s ease-out 0.3s forwards;
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-pulse-slow {
  animation: pulseSlow 8s infinite alternate;
}
.animate-pulse-slow-alt {
  animation: pulseSlow 10s infinite alternate-reverse;
}
@keyframes pulseSlow {
  0% { opacity: 0.3; transform: scale(0.9); }
  100% { opacity: 0.7; transform: scale(1.1); }
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

/* Loading Dots */
.loading-dots { display: flex; gap: 6px; }
.loading-dots span { width: 6px; height: 6px; border-radius: 50%; background: #ffffff; animation: ld 0.8s ease-in-out infinite; }
.loading-dots span:nth-child(2){animation-delay:0.15s}.loading-dots span:nth-child(3){animation-delay:0.3s}
@keyframes ld { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
</style>