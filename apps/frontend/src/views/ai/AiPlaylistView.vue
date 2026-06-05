<template>
  <div class="ai-page user-page-bg">
    <section class="ai-hero user-panel">
      <div class="hero-copy">
        <span class="eyebrow">AI Playlists</span>
        <h1>Design Your Soundscape</h1>
        <p>
          Describe your mood, activity, or a bizarre concept, and MusicFlow AI will
          curate a soundtrack tailored specifically for you.
        </p>
      </div>

      <div class="headphones-scene" aria-hidden="true">
        <div class="sound-rings">
          <span />
          <span />
          <span />
        </div>
        <div class="headphones-3d">
          <div class="headband" />
          <div class="earcup earcup--left">
            <i />
          </div>
          <div class="earcup earcup--right">
            <i />
          </div>
          <div class="shine" />
        </div>
        <div class="music-note note--one">♪</div>
        <div class="music-note note--two">♫</div>
      </div>
    </section>

    <section class="prompt-panel user-panel-soft">
      <div class="prompt-card">
        <svg class="spark-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3.5 10.7 8 15 9.7l-4.3 1.7L9 16l-1.7-4.6L3 9.7 7.3 8 9 3.5Zm8 7 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" />
        </svg>

        <input
          v-model="prompt"
          type="text"
          placeholder="Tạo playlist lofi để học bài..."
          aria-label="AI playlist prompt"
          @keyup.enter="generatePlaylist"
        />

        <button type="button" @click="generatePlaylist">Generate</button>
      </div>

      <div class="suggestion-row">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          type="button"
          @click="useSuggestion(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </section>

    <section class="generated-section user-panel" :class="{ 'is-visible': generated }">
      <div class="section-heading">
        <h2>{{ generatedTitle }}</h2>
        <RouterLink to="/library">Lưu vào thư viện</RouterLink>
      </div>

      <div class="generated-grid">
        <article class="playlist-preview">
          <div class="playlist-cover">
            <div class="cover-swirl" />
            <span>AI</span>
          </div>
          <div>
            <span class="mini-label">Generated mix</span>
            <h3>Neural Grooves</h3>
            <p>{{ generatedDescription }}</p>
          </div>
        </article>

        <div class="track-list">
          <button
            v-for="(track, index) in generatedTracks"
            :key="track.title"
            type="button"
            class="track-row"
            @click="selectTrack(track)"
          >
            <span>{{ index + 1 }}</span>
            <span>
              <strong>{{ track.title }}</strong>
              <small>{{ track.artist }}</small>
            </span>
            <em>{{ track.time }}</em>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const prompt = ref('')
const generated = ref(false)

const suggestions = [
  'Nhạc chill đêm khuya',
  'EDM chạy bộ',
  'Lofi coding',
  'Acoustic cafe sáng',
]

const generatedTracks = [
  { title: 'Neural Grooves', artist: 'AI generated', time: '3:42' },
  { title: 'Soft Circuit Rain', artist: 'MusicFlow AI', time: '2:58' },
  { title: 'Midnight Prompt', artist: 'Synthetica', time: '4:14' },
  { title: 'Cafe Algorithm', artist: 'Flow Studio', time: '3:26' },
]

const generatedTitle = computed(() => {
  if (!generated.value) return 'Playlist preview'
  return prompt.value.trim() || 'Neural Grooves'
})

const generatedDescription = computed(() => {
  const value = prompt.value.trim()
  if (!value) return 'A focused AI playlist with soft rhythm, clean transitions, and warm electronic texture.'
  return `A custom AI playlist for "${value}" with smooth pacing and fresh discovery tracks.`
})

function useSuggestion(suggestion) {
  prompt.value = suggestion
  generatePlaylist()
}

function generatePlaylist() {
  generated.value = true
  player.currentSong = {
    title: 'Neural Grooves',
    artist_name: 'AI generated',
  }
}

function selectTrack(track) {
  player.currentSong = {
    title: track.title,
    artist_name: track.artist,
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap');

* {
  box-sizing: border-box;
}

.ai-page {
  min-height: 100%;
  padding: 38px 36px 140px;
  color: #ffffff;
  font-family: 'Be Vietnam Pro', sans-serif;
  overflow: hidden;
}

.ai-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 38px;
  align-items: center;
  max-width: 1120px;
  min-height: 330px;
  margin: 0 auto 28px;
  padding: 34px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 42px;
  background: rgba(255, 255, 255, 0.055);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}

.eyebrow,
.mini-label {
  display: block;
  color: #a29bfe;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.hero-copy h1 {
  max-width: 640px;
  margin: 10px 0 16px;
  color: #ffffff;
  font-size: clamp(42px, 5vw, 68px);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #ffffff, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-copy p {
  max-width: 660px;
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 17px;
  line-height: 1.7;
}

.headphones-scene {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 260px;
  perspective: 900px;
}

.sound-rings {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.sound-rings span {
  position: absolute;
  width: 160px;
  height: 160px;
  border: 1px solid rgba(162, 155, 254, .3);
  border-radius: 50%;
  animation: soundPulse 3s ease-out infinite;
}

.sound-rings span:nth-child(2) {
  animation-delay: .7s;
}

.sound-rings span:nth-child(3) {
  animation-delay: 1.4s;
}

.headphones-3d {
  position: relative;
  width: 210px;
  height: 210px;
  transform: rotateX(58deg) rotateZ(-12deg);
  transform-style: preserve-3d;
  animation: headphoneFloat 5.5s ease-in-out infinite;
}

.headband {
  position: absolute;
  left: 26px;
  top: 12px;
  width: 158px;
  height: 132px;
  border: 22px solid transparent;
  border-top-color: #1f2937;
  border-left-color: #1f2937;
  border-right-color: #1f2937;
  border-radius: 92px 92px 34px 34px;
  box-shadow:
    inset 0 18px 0 rgba(255, 255, 255, 0.08),
    0 22px 34px rgba(124, 58, 237, 0.25);
  transform: translateZ(34px);
}

.headband::after {
  position: absolute;
  inset: -16px;
  border-top: 6px solid #7C3AED;
  border-radius: 88px 88px 30px 30px;
  content: "";
}

.earcup {
  position: absolute;
  top: 96px;
  width: 62px;
  height: 86px;
  border-radius: 28px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, .15), transparent 26%),
    linear-gradient(160deg, #7C3AED, #3B82F6 62%, #111827);
  box-shadow:
    inset -10px -10px 20px rgba(0, 0, 0, .5),
    0 24px 38px rgba(124, 58, 237, 0.25);
  transform-style: preserve-3d;
}

.earcup--left {
  left: 18px;
  transform: rotateZ(9deg) translateZ(56px);
}

.earcup--right {
  right: 18px;
  transform: rotateZ(-9deg) translateZ(56px);
}

.earcup i {
  position: absolute;
  inset: 13px 11px;
  border-radius: 20px;
  background:
    radial-gradient(circle at 35% 28%, rgba(255, 255, 255, .2), transparent 20%),
    linear-gradient(145deg, #111827, #1f2937 46%, #374151);
  box-shadow: inset 0 0 18px rgba(124, 58, 237, 0.3);
}

.shine {
  position: absolute;
  left: 76px;
  top: 82px;
  width: 60px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .2);
  filter: blur(5px);
  transform: translateZ(80px) rotateZ(-14deg);
}

.music-note {
  position: absolute;
  color: #3B82F6;
  font-size: 30px;
  font-weight: 900;
  text-shadow: 0 12px 24px rgba(59, 130, 246, .3);
  animation: noteFloat 4s ease-in-out infinite;
}

.note--one {
  left: 26px;
  top: 34px;
}

.note--two {
  right: 34px;
  bottom: 42px;
  animation-delay: -1.4s;
  color: #ec4899;
  text-shadow: 0 12px 24px rgba(236, 72, 153, .3);
}

.prompt-panel {
  max-width: 930px;
  margin: 0 auto;
}

.prompt-card {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 10px 12px 10px 26px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 32px;
  background: rgba(17, 24, 39, 0.7);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, .4),
    0 0 0 8px rgba(124, 58, 237, 0.15);
  backdrop-filter: blur(20px);
  transition: all 0.3s;
}
.prompt-card:focus-within {
  transform: translateY(-2px);
  border-color: rgba(124, 58, 237, 0.5);
  box-shadow: 0 25px 60px rgba(124, 58, 237, 0.25), 0 0 0 8px rgba(124, 58, 237, 0.3);
}

.spark-icon {
  width: 26px;
  height: 26px;
  fill: #7C3AED;
  filter: drop-shadow(0 0 8px rgba(124, 58, 237, 0.6));
}

.prompt-card input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #ffffff;
  font: 800 18px/1 'Be Vietnam Pro', sans-serif;
}

.prompt-card input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.prompt-card button {
  min-height: 58px;
  padding: 0 38px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  color: #ffffff;
  cursor: pointer;
  font: 900 16px/1 'Be Vietnam Pro', sans-serif;
  box-shadow: 0 10px 25px rgba(124, 58, 237, .4);
  transition: transform .3s ease, box-shadow .3s ease;
}

.prompt-card button:hover {
  box-shadow: 0 15px 35px rgba(124, 58, 237, .6);
  transform: translateY(-2px) scale(1.02);
}

.suggestion-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
}

.suggestion-row button {
  min-height: 42px;
  padding: 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  background: rgba(255, 255, 255, .03);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font: 700 14px/1 'Be Vietnam Pro', sans-serif;
  box-shadow: 0 8px 20px rgba(0, 0, 0, .2);
  transition: all 0.2s;
}
.suggestion-row button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #a29bfe;
  transform: translateY(-2px);
  border-color: rgba(124, 58, 237, 0.3);
  box-shadow: 0 10px 25px rgba(124, 58, 237, 0.2);
}

.generated-section {
  max-width: 1040px;
  margin: 54px auto 0;
  opacity: .78;
  transition: opacity .25s ease, transform .25s ease;
}

.generated-section.is-visible {
  opacity: 1;
  transform: translateY(-4px);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0;
  color: #ffffff;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.section-heading a {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  transition: color 0.2s;
}
.section-heading a:hover { color: #7C3AED; }

.generated-grid {
  display: grid;
  grid-template-columns: minmax(260px, .8fr) minmax(0, 1.2fr);
  gap: 24px;
}

.playlist-preview,
.track-list {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.03);
  box-shadow: 0 15px 40px rgba(0, 0, 0, .4);
  backdrop-filter: blur(20px);
}

.playlist-preview {
  display: grid;
  gap: 18px;
  padding: 24px;
}

.playlist-cover {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 24px;
  background: linear-gradient(145deg, #7C3AED, #ec4899);
  box-shadow: 0 15px 30px rgba(124, 58, 237, 0.3);
}

.playlist-cover span {
  position: relative;
  z-index: 1;
  color: #ffffff;
  font-size: 54px;
  font-weight: 900;
}

.cover-swirl {
  position: absolute;
  inset: -30%;
  background:
    conic-gradient(from 0deg, #7C3AED, #3B82F6, #ec4899, #7C3AED);
  filter: blur(16px);
  animation: coverSpin 10s linear infinite;
  opacity: 0.8;
}

.playlist-preview h3 {
  margin: 8px 0 8px;
  font-size: 28px;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.playlist-preview p {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  font-weight: 500;
}

.track-list {
  overflow: hidden;
}

.track-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 58px;
  align-items: center;
  width: 100%;
  min-height: 74px;
  padding: 0 20px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  font-family: 'Be Vietnam Pro', sans-serif;
  text-align: left;
  transition: all 0.2s;
}

.track-row:last-child {
  border-bottom: 0;
}

.track-row:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: scale(1.01);
  box-shadow: 0 5px 15px rgba(124, 58, 237, 0.15);
  border-radius: 12px;
  border-bottom-color: transparent;
}

.track-row > span:first-child,
.track-row em,
.track-row small {
  color: rgba(255, 255, 255, 0.4);
  font-style: normal;
  font-weight: 600;
}

.track-row strong,
.track-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row strong {
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
}

.track-row small {
  margin-top: 3px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

@keyframes headphoneFloat {
  0%,
  100% {
    transform: rotateX(58deg) rotateZ(-12deg) translateY(0);
  }
  50% {
    transform: rotateX(58deg) rotateZ(-5deg) translateY(-14px);
  }
}

@keyframes soundPulse {
  0% {
    opacity: .55;
    transform: scale(.72);
  }
  100% {
    opacity: 0;
    transform: scale(1.7);
  }
}

@keyframes noteFloat {
  0%,
  100% {
    transform: translateY(0) rotate(-8deg);
  }
  50% {
    transform: translateY(-16px) rotate(8deg);
  }
}

@keyframes coverSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}

@media (max-width: 920px) {
  .ai-hero,
  .generated-grid {
    grid-template-columns: 1fr;
  }

  .headphones-scene {
    order: -1;
  }
}

@media (max-width: 620px) {
  .ai-page {
    padding: 24px 18px 120px;
  }

  .ai-hero {
    padding: 24px;
    border-radius: 30px;
  }

  .prompt-card {
    grid-template-columns: 30px 1fr;
    border-radius: 26px;
  }

  .prompt-card button {
    grid-column: 1 / -1;
    width: 100%;
  }

  .headphones-3d {
    width: 180px;
    height: 180px;
  }
}
</style>
