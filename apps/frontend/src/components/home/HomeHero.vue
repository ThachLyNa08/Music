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

        <h1 class="hero-title" :class="{ 'home-hero-lobster-title': greetingTitle === 'Chiều nay nghe gì?' }">
          {{ greetingTitle }}
        </h1>

        <p class="hero-subtitle">
          {{ greetingSubtitle }}
        </p>

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
@import url('https://fonts.googleapis.com/css2?family=Lobster&display=swap');

.home-hero-lobster-title {
  font-family: 'Lobster', cursive !important;
  font-weight: 400 !important;
  letter-spacing: 0.01em;
  line-height: 1.05;
}

.home-hero {
  position: relative;
  width: 100%;
  min-height: 280px;
  padding: 32px 42px;
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
  gap: 7px;
  padding: 6px 14px;
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  background: rgba(255,255,255,0.13);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(18px);
  margin-bottom: 12px;
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
  font-size: clamp(36px, 4.5vw, 56px);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.055em;
}

.hero-subtitle {
  margin: 12px 0 0;
  color: rgba(255,255,255,0.72);
  font-size: clamp(15px, 1.3vw, 18px);
  line-height: 1.35;
  font-weight: 650;
}



@media (max-height: 780px) {
  .home-hero {
    min-height: 240px;
    padding: 24px 32px;
  }

  .hero-title {
    font-size: clamp(30px, 4vw, 46px);
  }


}

@media (max-width: 768px) {
  .home-hero {
    min-height: 240px;
    padding: 24px 16px;
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
    font-size: 32px;
  }

  .home-hero-lobster-title {
    line-height: 1.1;
    letter-spacing: 0;
  }

  .hero-subtitle {
    font-size: 15px;
  }


}
</style>
