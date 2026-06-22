<template>
  <div class="auth-wrapper relative text-white min-h-screen flex selection:bg-[#30d158] selection:text-[#000] overflow-x-hidden font-sans">
    
    <!-- Unified Fullscreen Background -->
    <slot name="background"></slot>
    
    <!-- Content Layer -->
    <div class="app-container relative z-10 w-full min-h-screen" :class="centerCard ? 'centered' : 'with-brand'">
      
      <!-- Left Split: Branding -->
      <Transition name="fade">
        <div v-if="!centerCard" class="brand-panel hidden lg:flex flex-col justify-center">
          <div class="brand-logo">
            <div class="logo-glyph">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-white relative z-10 drop-shadow-md">
                <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2-12v6a2 2 0 1 0 4 0V9a2 2 0 1 0-4 0z" />
              </svg>
            </div>
            MusicFlow
          </div>

          <h1 class="brand-title">
            <span class="line-1">Nghe nhạc</span>
            <span class="line-2">theo gu của bạn</span>
          </h1>
          
          <p class="brand-desc">
            Khám phá không gian âm nhạc được cá nhân hóa hoàn toàn với những bản nhạc và playlist dành riêng cho bạn.
          </p>
          
          <div class="feature-chips">
            <div class="chip">Gợi ý cá nhân hóa</div>
            <div class="chip">Weekly Mix</div>
            <div class="chip">AI Playlist</div>
          </div>
        </div>
      </Transition>
      
      <!-- Right Split: Form Container -->
      <div 
        class="flex items-center justify-center form-container"
        :class="centerCard ? 'w-full' : 'w-full lg:w-1/2'"
      >
        <!-- Content slot -->
        <div class="auth-card-panel flex flex-col justify-center py-6 sm:py-10" :class="centerCard ? 'w-full mx-auto max-w-[640px]' : 'w-full max-w-[480px] mx-auto'">
          <!-- Mobile Brand Header -->
          <div class="lg:hidden flex flex-col items-center mb-8" v-if="!centerCard">
             <div class="logo-glyph mb-3 w-12 h-12">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7 text-white relative z-10 drop-shadow-md">
                  <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2-12v6a2 2 0 1 0 4 0V9a2 2 0 1 0-4 0z" />
                </svg>
             </div>
             <h1 class="text-3xl font-bold text-white tracking-tight" style="font-family: 'Space Grotesk', sans-serif;">MusicFlow</h1>
          </div>
          
          <slot></slot>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
defineProps({
  centerCard: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.fade-enter-active {
  transition: opacity 0.3s ease;
}
.fade-leave-active {
  transition: opacity 220ms ease, transform 260ms cubic-bezier(0.22,1,0.36,1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.app-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  width: 100%;
  margin: 0 auto;
  transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-container.with-brand {
  max-width: 1200px;
  gap: 4rem;
}

.app-container.centered {
  max-width: 720px;
  gap: 0;
}

@media (max-width: 1024px) {
  .app-container {
    padding: 1rem;
    gap: 0;
  }
}

.brand-panel {
  flex: 1;
  max-width: 480px;
  animation: brand-enter 1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
}

@keyframes brand-enter {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2.5rem;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}

.logo-glyph {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #30d158, #0a84ff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(48,209,88,0.4);
  position: relative;
  overflow: hidden;
}

.logo-glyph::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 100%);
}

.brand-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 4.5rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 1.5rem;
}

.brand-title .line-1 {
  display: block;
  background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-title .line-2 {
  display: block;
  background: linear-gradient(135deg, #30d158 0%, #0a84ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-desc {
  font-size: 1.125rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.7;
  margin-bottom: 2.5rem;
  font-weight: 400;
}

.feature-chips {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.chip {
  padding: 0.6rem 1.2rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 100px;
  font-size: 0.875rem;
  color: rgba(255,255,255,0.55);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  cursor: default;
}

.chip:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.25);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}

.form-container {
  width: 100%;
}

@media (min-width: 1024px) {
  .form-container.w-full {
    width: 100%;
  }
  .form-container.lg\:w-1\/2 {
    width: 50%;
  }
}
</style>
