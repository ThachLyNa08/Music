<template>
  <div class="relative w-full max-w-[760px] max-h-[calc(100vh-32px)] lg:max-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-6 md:p-10 bg-surface-elevated rounded-[24px] md:rounded-[32px] overflow-y-auto hidden-scrollbar text-center z-10 shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
    
    <!-- Confetti Canvas (Fixed to cover whole viewport behind the card but in front of backdrop) -->
    <Teleport to="body">
      <canvas ref="confettiCanvas" class="fixed inset-0 w-full h-full pointer-events-none z-[10000]"></canvas>
    </Teleport>

    <!-- Close Button -->
    <button 
      @click="$emit('close')"
      class="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/15 transition-colors border border-white/10"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div class="relative z-10 w-full flex flex-col items-center mt-4">
      <!-- Sound Wave Visual -->
      <div class="flex justify-center items-end gap-1.5 h-12 mb-6">
        <div v-for="n in 7" :key="n" class="wave-bar"></div>
      </div>

      <!-- Success Icon -->
      <div class="relative inline-flex items-center justify-center w-28 h-28 mb-6">
        <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600/30 to-pink-500/30 blur-2xl"></div>
        <div class="relative w-24 h-24 rounded-full glass-icon flex items-center justify-center shadow-lg">
          <svg class="w-12 h-12 text-accent-green" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none" stroke="currentColor" stroke-width="2"/>
            <path class="checkmark-check" fill="none" stroke="currentColor" stroke-width="3" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
      </div>

      <!-- Badge -->
      <div class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white text-xs md:text-sm font-bold mb-6 premium-glow uppercase tracking-wide">
        <svg class="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
        PREMIUM ĐÃ KÍCH HOẠT
      </div>

      <!-- Title & Message -->
      <h2 class="text-3xl md:text-4xl font-extrabold mb-3 text-white tracking-tight">Thanh toán thành công!</h2>
      <p class="text-text-secondary text-base md:text-lg mb-10 leading-relaxed max-w-[480px]">
        Tài khoản của bạn đã được nâng cấp Premium. Trải nghiệm âm nhạc không giới hạn ngay bây giờ.
      </p>

      <!-- Unlock Features (Responsive Grid) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 w-full text-left">
        <div 
          v-for="(feature, index) in features" 
          :key="index"
          class="feature-card glass-panel rounded-xl p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors"
          :style="{ animationDelay: (0.8 + index * 0.15) + 's' }"
        >
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="feature.icon"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-sm md:text-base text-white mb-1">{{ feature.title }}</h3>
            <p class="text-xs md:text-sm text-text-secondary leading-snug">{{ feature.desc }}</p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <button 
        @click="$emit('explore')"
        class="w-full max-w-[400px] py-4 rounded-full bg-accent-green text-black font-bold text-lg shadow-lg btn-pulse hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
      >
        Trải nghiệm Premium
      </button>
      
      <p class="mt-5 text-xs md:text-sm text-text-secondary font-medium">
        Gói: {{ planName || 'Premium' }} <span v-if="formattedExpireDate">&bull; Hết hạn: {{ formattedExpireDate }}</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

const props = defineProps({
  planName: String,
  expiresAt: String,
  amount: [String, Number],
  userEmail: String
})

const emit = defineEmits(['close', 'explore'])

const features = [
  {
    title: 'Karaoke AI Premium',
    desc: 'Tách giọng, chỉnh vocal/instrumental và luyện hát mượt mà.',
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3'
  },
  {
    title: 'AI Playlist nâng cao',
    desc: 'Tạo danh sách phát cá nhân hóa theo tâm trạng và thói quen nghe.',
    icon: 'M4 6h16M4 12h16m-7 6h7'
  },
  {
    title: 'Trải nghiệm không giới hạn',
    desc: 'Mở khóa toàn bộ quyền lợi Premium trong MusicFlow.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z'
  }
]

const confettiCanvas = ref(null)
let animationId = null

const formattedExpireDate = computed(() => {
  if (!props.expiresAt) return null
  const date = new Date(props.expiresAt)
  return new Intl.DateTimeFormat('vi-VN', { 
    year: 'numeric', month: '2-digit', day: '2-digit' 
  }).format(date)
})

const initConfetti = () => {
  if (!confettiCanvas.value) return
  const canvas = confettiCanvas.value
  const ctx = canvas.getContext('2d')

  const resizeCanvas = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  canvas._resizeHandler = resizeCanvas

  // Check prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let particleCount = prefersReducedMotion ? 20 : 120

  const colors = ['#1ED760', '#a855f7', '#ec4899', '#fbbf24', '#60a5fa']
  const particles = []

  // Tỏa từ giữa màn hình
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16 - 6,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 10,
      opacity: 1,
      decay: 0.005 + Math.random() * 0.01
    })
  }

  const animate = () => {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let activeParticles = 0

    particles.forEach(p => {
      if (p.opacity <= 0) return
      activeParticles++

      p.x += p.vx
      p.y += p.vy
      p.vy += 0.15 // gravity
      p.vx *= 0.99 // damping
      p.rotation += p.rotationSpeed
      p.opacity -= p.decay

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.globalAlpha = Math.max(0, p.opacity)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
    })

    if (activeParticles > 0) {
      animationId = requestAnimationFrame(animate)
    }
  }

  setTimeout(() => {
    animate()
  }, 300)
}

onMounted(() => {
  initConfetti()
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (confettiCanvas.value && confettiCanvas.value._resizeHandler) {
    window.removeEventListener('resize', confettiCanvas.value._resizeHandler)
  }
})
</script>

<style scoped>
.hidden-scrollbar::-webkit-scrollbar {
  display: none;
}
.hidden-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.bg-surface-elevated {
  background: rgba(14, 14, 22, 0.94);
  background-image: radial-gradient(circle at center, rgba(30, 215, 96, 0.05) 0%, rgba(168, 85, 247, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(24px);
}
.text-accent-green {
  color: #1ed760;
}
.bg-accent-green {
  background-color: #1ed760;
}
.text-text-secondary {
  color: #b3b3b3;
}
.glass-icon {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
}

/* ===== Sound Wave Animation ===== */
.wave-bar {
  width: 4px;
  background: linear-gradient(to top, #1ED760, #a855f7);
  border-radius: 999px;
  animation: wave 1.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .wave-bar { animation: none; height: 50%; }
}
.wave-bar:nth-child(1) { height: 20%; animation-delay: 0s; }
.wave-bar:nth-child(2) { height: 40%; animation-delay: 0.1s; }
.wave-bar:nth-child(3) { height: 60%; animation-delay: 0.2s; }
.wave-bar:nth-child(4) { height: 80%; animation-delay: 0.3s; }
.wave-bar:nth-child(5) { height: 50%; animation-delay: 0.15s; }
.wave-bar:nth-child(6) { height: 70%; animation-delay: 0.25s; }
.wave-bar:nth-child(7) { height: 30%; animation-delay: 0.05s; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
  50% { transform: scaleY(1); opacity: 1; }
}

/* ===== Checkmark Draw Animation ===== */
.checkmark-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}
.checkmark-check {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
}
@keyframes stroke {
  100% { stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .checkmark-circle, .checkmark-check { stroke-dashoffset: 0; animation: none; }
}

/* ===== Premium Badge Glow ===== */
.premium-glow {
  box-shadow: 0 0 15px rgba(168, 85, 247, 0.3), 0 0 30px rgba(236, 72, 153, 0.15);
  animation: pulse-glow 2.5s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 15px rgba(168, 85, 247, 0.3), 0 0 30px rgba(236, 72, 153, 0.15); }
  50% { box-shadow: 0 0 25px rgba(168, 85, 247, 0.5), 0 0 45px rgba(236, 72, 153, 0.3); }
}
@media (prefers-reduced-motion: reduce) {
  .premium-glow { animation: none; box-shadow: 0 0 10px rgba(168, 85, 247, 0.3); }
}

/* ===== Feature Cards Stagger ===== */
.feature-card {
  opacity: 0;
  transform: translateY(20px);
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp {
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .feature-card { opacity: 1; transform: none; animation: none !important; }
}

/* ===== Button Pulse ===== */
.btn-pulse {
  animation: btnPulse 2.5s infinite;
}
@keyframes btnPulse {
  0% { box-shadow: 0 0 0 0 rgba(30, 215, 96, 0.5); }
  70% { box-shadow: 0 0 0 15px rgba(30, 215, 96, 0); }
  100% { box-shadow: 0 0 0 0 rgba(30, 215, 96, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .btn-pulse { animation: none; }
}
</style>
