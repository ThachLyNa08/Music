<template>
  <div class="floating-bg">
    <!-- Nền mờ sâu -->
    <div class="bg-gradient"></div>
    
    <!-- Các khối hình lơ lửng -->
    <div class="shape sphere sphere-1"></div>
    <div class="shape sphere sphere-2"></div>
    <div class="shape cube cube-1"></div>
    <div class="shape ring ring-1"></div>
    
    <!-- Các hạt lấp lánh (particles) -->
    <div class="particle p-1"></div>
    <div class="particle p-2"></div>
    <div class="particle p-3"></div>
    <div class="particle p-4"></div>
  </div>
</template>

<style scoped>
.floating-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 20%, rgba(30, 20, 60, 0.8) 0%, #070A12 60%);
}

.shape {
  position: absolute;
  filter: blur(4px);
  opacity: 0.7;
}

.sphere {
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.8), rgba(59, 130, 246, 0.2));
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.4);
}

.sphere-1 {
  width: 150px;
  height: 150px;
  top: 15%;
  left: 10%;
  animation: float 12s ease-in-out infinite alternate;
}

.sphere-2 {
  width: 250px;
  height: 250px;
  bottom: 10%;
  right: 5%;
  background: radial-gradient(circle at 70% 70%, rgba(6, 182, 212, 0.6), rgba(59, 130, 246, 0.1));
  box-shadow: 0 0 60px rgba(6, 182, 212, 0.3);
  animation: float-reverse 15s ease-in-out infinite alternate;
  filter: blur(8px);
}

.cube {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.5), rgba(139, 92, 246, 0.2));
  border-radius: 24px;
  top: 60%;
  left: 15%;
  transform: rotate(45deg);
  animation: rotate-float 20s linear infinite;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ring {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 15px solid rgba(59, 130, 246, 0.15);
  top: 25%;
  right: 20%;
  animation: rotate-float 25s linear infinite reverse;
}

.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 10px #fff;
  opacity: 0.4;
}

.p-1 { top: 20%; left: 30%; animation: twinkle 4s infinite; }
.p-2 { top: 70%; left: 50%; animation: twinkle 5s infinite 1s; }
.p-3 { top: 40%; right: 30%; animation: twinkle 3s infinite 2s; }
.p-4 { bottom: 30%; right: 40%; animation: twinkle 6s infinite 0.5s; }

@keyframes float {
  0% { transform: translateY(0) translateX(0) rotate(0deg); }
  100% { transform: translateY(-40px) translateX(20px) rotate(10deg); }
}

@keyframes float-reverse {
  0% { transform: translateY(0) translateX(0); }
  100% { transform: translateY(50px) translateX(-30px); }
}

@keyframes rotate-float {
  0% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-30px) rotate(180deg); }
  100% { transform: translateY(0) rotate(360deg); }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 0.8; transform: scale(1.5); }
}

@media (prefers-reduced-motion: reduce) {
  .sphere-1, .sphere-2, .cube, .ring, .particle {
    animation: none;
  }
}
</style>
