<template>
  <div class="env">
    <div class="aurora aurora-1"></div>
    <div class="aurora aurora-2"></div>
    <div class="aurora aurora-3"></div>
    <div class="particles">
      <div v-for="i in 20" :key="i" class="particle" :style="getParticleStyle(i)"></div>
    </div>
  </div>
</template>

<script setup>
function getParticleStyle(i) {
  return {
    left: `${Math.random() * 100}vw`,
    animationDelay: `${Math.random() * 20}s`,
    animationDuration: `${15 + Math.random() * 10}s`
  }
}
</script>

<style scoped>
.env {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #000;
}

.aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.6;
  mix-blend-mode: screen;
  animation: aurora-breathe 15s ease-in-out infinite;
}

.aurora-1 {
  width: 70vw; height: 70vw;
  background: radial-gradient(circle, rgba(48,209,88,0.5), transparent 65%);
  top: -20%; left: -15%;
  animation-delay: 0s;
}
.aurora-2 {
  width: 60vw; height: 60vw;
  background: radial-gradient(circle, rgba(10,132,255,0.45), transparent 60%);
  bottom: -25%; right: -20%;
  animation-delay: -5s;
}
.aurora-3 {
  width: 50vw; height: 50vw;
  background: radial-gradient(circle, rgba(175,82,222,0.35), transparent 55%);
  top: 35%; left: 30%;
  animation-delay: -10s;
  opacity: 0.4;
}

@keyframes aurora-breathe {
  0%, 100% { transform: translate(0,0) scale(1); opacity: 0.5; }
  33% { transform: translate(40px,-60px) scale(1.15); opacity: 0.65; }
  66% { transform: translate(-30px,30px) scale(0.9); opacity: 0.45; }
}

.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 2px; height: 2px;
  background: rgba(255,255,255,0.6);
  border-radius: 50%;
  box-shadow: 0 0 6px 2px rgba(255,255,255,0.3);
  animation: particle-float 20s infinite linear;
}

@keyframes particle-float {
  0% { transform: translateY(110vh) translateX(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-10vh) translateX(50px); opacity: 0; }
}
</style>
