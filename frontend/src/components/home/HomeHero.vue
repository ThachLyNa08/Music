<template>
  <section class="home-hero">
    <div class="hero-glow hero-glow-1"></div>
    <div class="hero-glow hero-glow-2"></div>

    <div class="hero-content">
      <div class="hero-text-side">
        <div class="hero-greeting">
          <span class="status-dot"></span>
          <span>Chào {{ timeOfDay }}, {{ displayName }}</span>
        </div>

        <h1 class="hero-title">
          {{ greetingTitle }}
        </h1>

        <p class="hero-subtitle">
          {{ greetingSubtitle }}
        </p>

        <div class="hero-actions">
          <button class="btn-primary home-primary-btn" @click="$emit('play', featuredItem)">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            <span>Phát ngay</span>
          </button>

          <button class="btn-secondary home-secondary-btn" @click="$emit('explore')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>Khám phá</span>
          </button>
        </div>
      </div>
      
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  displayName: {
    type: String,
    default: 'bạn'
  },
  featuredItem: {
    type: Object,
    default: null
  }
})

defineEmits(['play', 'explore'])

const hour = new Date().getHours()

const timeOfDay = computed(() => {
  if (hour < 12) return 'buổi sáng'
  if (hour < 18) return 'buổi chiều'
  return 'buổi tối'
})

const greetingTitle = computed(() => {
  if (hour < 12) return 'Ngày mới tốt lành!'
  if (hour < 18) return 'Chiều nay nghe gì?'
  return 'Tối nay thư giãn'
})

const greetingSubtitle = computed(() => {
  if (hour < 12) return 'Bắt đầu ngày mới với những giai điệu yêu thích của bạn'
  if (hour < 18) return 'Tiếp tục khám phá thế giới âm nhạc đa dạng'
  return 'Thư giãn với những bản nhạc smooth và ambient'
})
</script>

<style scoped>
.home-hero {
  position: relative;
  width: 100%;
  min-height: 280px;
  max-height: 320px;
  border-radius: 28px;
  padding: 34px 52px;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  background:
    radial-gradient(circle at 82% 20%, rgba(168, 85, 247, 0.28), transparent 32%),
    radial-gradient(circle at 12% 85%, rgba(59, 130, 246, 0.12), transparent 28%),
    linear-gradient(135deg, rgba(76,29,149,0.48), rgba(30,27,75,0.56), rgba(15,23,42,0.9));
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.10),
    0 24px 80px rgba(0,0,0,0.20);
}

.hero-glow {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(36px);
  z-index: 1;
}

.hero-glow-1 {
  width: 240px;
  height: 240px;
  right: 10%;
  top: -80px;
  background: rgba(168, 85, 247, 0.32);
}

.hero-glow-2 {
  width: 180px;
  height: 180px;
  left: 8%;
  bottom: -90px;
  background: rgba(30, 215, 96, 0.12);
}

.hero-content {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 860px;
}

.hero-greeting {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 16px;
  border-radius: 999px;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  background: rgba(255,255,255,0.13);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(18px);
  margin-bottom: 18px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #facc15;
  box-shadow: 0 0 18px rgba(250,204,21,0.55);
}

.hero-title {
  margin: 0;
  color: #fff;
  font-size: clamp(44px, 5.2vw, 72px);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.055em;
}

.hero-subtitle {
  margin: 18px 0 0;
  color: rgba(255,255,255,0.72);
  font-size: clamp(17px, 1.5vw, 22px);
  line-height: 1.35;
  font-weight: 650;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
}

.btn-primary,
.btn-secondary {
  height: 54px;
  border-radius: 999px;
  padding: 0 28px;
  border: 0;
  font-size: 17px;
  font-weight: 850;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.btn-primary:hover,
.btn-secondary:hover {
  transform: translateY(-2px) scale(1.015);
}

.btn-primary:active,
.btn-secondary:active {
  transform: scale(0.96);
}

@media (max-height: 780px) {
  .home-hero {
    min-height: 250px;
    max-height: 290px;
    padding: 30px 48px;
  }

  .hero-title {
    font-size: clamp(40px, 4.7vw, 62px);
  }

  .hero-actions {
    margin-top: 24px;
  }

  .btn-primary,
  .btn-secondary {
    height: 50px;
    padding: 0 24px;
    font-size: 16px;
  }
}

@media (max-width: 768px) {
  .home-hero {
    min-height: 260px;
    max-height: none;
    padding: 28px;
    border-radius: 22px;
  }

  .hero-title {
    font-size: 42px;
  }

  .hero-subtitle {
    font-size: 17px;
  }

  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
