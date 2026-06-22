<template>
  <section class="home-hero">
    <img
      class="home-hero-bg-img"
      :src="normalizeAssetUrl('/uploads/playlist_cover/home.png')"
      alt="Home Background"
      loading="eager"
      decoding="async"
      fetchpriority="high"
    />

    <div class="home-hero-video-overlay"></div>
    <div class="home-hero-dark-vignette"></div>

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
        </div>
      </div>
      
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeAssetUrl } from '@/utils/imageUrl'

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
  min-height: 380px;
  padding: 40px 52px;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  background: #0b0b0f;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 24px 80px rgba(0,0,0,0.30);
}

.home-hero-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  z-index: 0;
}

.home-hero-video-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      rgba(8, 8, 18, 0.92) 0%,
      rgba(15, 12, 36, 0.82) 28%,
      rgba(20, 16, 50, 0.48) 58%,
      rgba(10, 10, 20, 0.18) 100%
    );
}

.home-hero-dark-vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      rgba(5, 5, 12, 0.28) 0%,
      rgba(5, 5, 12, 0.08) 45%,
      rgba(5, 5, 12, 0.42) 100%
    );
}

.hero-content {
  position: relative;
  z-index: 3;
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
    min-height: 320px;
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
    min-height: 420px;
    padding: 28px;
  }

  .home-hero-video-overlay {
    background:
      linear-gradient(
        90deg,
        rgba(8, 8, 18, 0.95) 0%,
        rgba(15, 12, 36, 0.82) 55%,
        rgba(10, 10, 20, 0.35) 100%
      );
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
