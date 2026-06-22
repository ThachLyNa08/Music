<template>
  <div 
    class="liquid-card"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    :style="cssVars"
  >
    <div class="specular"></div>
    <div class="depth-layer"></div>
    <div class="relative z-10 w-full h-full">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const mouseX = ref(50)
const mouseY = ref(30)
const isActive = ref(false)

function handleMouseMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  mouseX.value = ((e.clientX - rect.left) / rect.width) * 100
  mouseY.value = ((e.clientY - rect.top) / rect.height) * 100
  isActive.value = true
}

function handleMouseLeave() {
  isActive.value = false
  // Return to center
  mouseX.value = 50
  mouseY.value = 30
}

const cssVars = computed(() => {
  if (!isActive.value) return { '--mouse-x': '50%', '--mouse-y': '30%' }
  return { 
    '--mouse-x': `${mouseX.value}%`, 
    '--mouse-y': `${mouseY.value}%` 
  }
})
</script>

<style scoped>
.liquid-card {
  --glass-border: rgba(255,255,255,0.18);
  position: relative;
  background: linear-gradient(
      135deg,
      rgba(255,255,255,0.12) 0%,
      rgba(255,255,255,0.05) 40%,
      rgba(255,255,255,0.02) 100%
  );
  backdrop-filter: blur(40px) saturate(140%);
  -webkit-backdrop-filter: blur(40px) saturate(140%);
  border: 1px solid var(--glass-border);
  border-radius: 32px;
  padding: 2.5rem;
  box-shadow:
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 20px 60px rgba(0,0,0,0.5),
      0 0 80px rgba(48,209,88,0.08);
  overflow: hidden;
  z-index: 10;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.6s ease;
}

@media (max-width: 640px) {
  .liquid-card {
    padding: 1.5rem;
    border-radius: 24px;
  }
}

/* Liquid glass refraction edge — top highlight */
.liquid-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(255,255,255,0.4) 20%, 
      rgba(255,255,255,0.6) 50%, 
      rgba(255,255,255,0.4) 80%, 
      transparent 100%
  );
  opacity: 0.6;
}

/* Liquid glass refraction edge — inner glow */
.liquid-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 32px;
  padding: 1.5px;
  background: linear-gradient(
      180deg,
      rgba(255,255,255,0.25) 0%,
      rgba(255,255,255,0.05) 30%,
      transparent 60%,
      rgba(255,255,255,0.08) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  mix-blend-mode: overlay;
}

@media (max-width: 640px) {
  .liquid-card::after {
    border-radius: 24px;
  }
}

/* Specular highlight — the "wet" look */
.specular {
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(
      circle at var(--mouse-x, 50%) var(--mouse-y, 30%),
      rgba(255,255,255,0.15) 0%,
      transparent 50%
  );
  pointer-events: none;
  mix-blend-mode: soft-light;
  transition: background 0.1s ease-out;
}

/* Depth layer — makes glass feel thick */
.depth-layer {
  position: absolute;
  inset: 8px;
  border-radius: 24px;
  background: linear-gradient(
      180deg,
      rgba(255,255,255,0.03) 0%,
      transparent 50%,
      rgba(0,0,0,0.1) 100%
  );
  pointer-events: none;
  mix-blend-mode: overlay;
}

@media (max-width: 640px) {
  .depth-layer {
    border-radius: 16px;
  }
}
</style>
