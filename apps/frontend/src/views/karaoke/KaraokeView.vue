<template>
  <div class="karaoke-view user-page-bg">
    <div class="header-section">
      <h1 class="section-title">Karaoke</h1>
      <p class="section-subtitle">Trải nghiệm hát karaoke với lời nhạc đồng bộ</p>
    </div>

    <div class="karaoke-grid">
      <aside class="stem-panel">
        <div class="spotify-card stem-card user-panel-soft">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" class="icon-primary">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
            </svg>
            <h2 class="card-title">Stem Separator</h2>
          </div>

          <div class="slider-group">
            <div class="slider-info">
              <span class="slider-label">Vocal (Giọng hát)</span>
              <span class="slider-value">{{ vocalVolume }}%</span>
            </div>
            <input type="range" min="0" max="100" v-model="vocalVolume" class="stem-slider vocal-slider" />
          </div>

          <div class="slider-group">
            <div class="slider-info">
              <span class="slider-label">Instrumental (Nhạc nền)</span>
              <span class="slider-value">{{ instVolume }}%</span>
            </div>
            <input type="range" min="0" max="100" v-model="instVolume" class="stem-slider inst-slider" />
          </div>

          <div class="info-box">
            <p>Điều chỉnh giọng hát và nhạc nền để có trải nghiệm hát karaoke mượt mà. Bạn có thể kéo thanh Vocal về 0% để lấy beat gốc.</p>
          </div>

          <button class="btn-download" @click="downloadBeat" :disabled="!isPremium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
            </svg>
            Tải beat nhạc nền
            <span v-if="!isPremium" class="badge-premium">Premium</span>
          </button>
        </div>

        <div class="spotify-card mic-card user-panel-soft">
          <div class="card-header space-between">
            <div class="flex-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="icon-pulse text-red-400">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
              <h3 class="card-title">Mic Input</h3>
            </div>
            <span class="mic-status">Excellent</span>
          </div>
          <div class="mic-waveform" aria-hidden="true">
            <svg class="waveform-svg" viewBox="0 0 360 74" preserveAspectRatio="none">
              <defs>
                <linearGradient id="micWaveGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stop-color="#22d3ee" />
                  <stop offset="48%" stop-color="#34d399" />
                  <stop offset="100%" stop-color="#14b8a6" />
                </linearGradient>
                <filter id="micWaveGlow" x="-20%" y="-80%" width="140%" height="260%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path class="waveform-guide" d="M4 37 H356" />
              <path
                class="waveform-line waveform-line--ghost"
                d="M4 37 C18 37 18 28 32 28 S46 49 60 49 S74 19 88 19 S102 56 116 56 S130 32 144 32 S158 40 172 40 S186 14 200 14 S214 62 228 62 S242 26 256 26 S270 44 284 44 S298 22 312 22 S326 52 340 52 S350 37 356 37"
              />
              <path
                class="waveform-line waveform-line--main"
                d="M4 37 C18 37 18 28 32 28 S46 49 60 49 S74 19 88 19 S102 56 116 56 S130 32 144 32 S158 40 172 40 S186 14 200 14 S214 62 228 62 S242 26 256 26 S270 44 284 44 S298 22 312 22 S326 52 340 52 S350 37 356 37"
              />
            </svg>
          </div>
        </div>
      </aside>

      <main class="lyrics-column">
        <div class="spotify-card lyrics-card user-panel">
          <LyricsPanel :song="player.currentSong" :current-time="player.currentTime" />
          <div class="lyrics-controls">
            <div class="song-info">
              <img
                v-if="player.currentSong"
                class="song-cover"
                :src="coverUrl"
                alt="Current song cover"
                @error="event => event.target.src = '/images/default-cover.svg'"
              />
              <div v-else class="song-cover song-cover--empty"></div>
              <div class="song-meta">
                <p class="song-title">{{ player.currentSong?.title || 'Chưa phát bài nào' }}</p>
                <p class="song-artist">{{ player.currentSong?.artist_name || player.currentSong?.artist || 'Nghệ sĩ' }}</p>
              </div>
            </div>
            <div class="player-actions">
              <button class="action-btn" :disabled="!player.currentSong" @click="player.prev()" aria-label="Bài trước">
                <svg viewBox="0 0 24 24" fill="currentColor" width="23" height="23"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
              <button class="play-btn" :disabled="!player.currentSong" @click="player.togglePlay()" aria-label="Phát hoặc tạm dừng">
                <svg v-if="!player.isPlaying" viewBox="0 0 24 24" fill="currentColor" width="30" height="30"><path d="M8 5v14l11-7z"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" width="30" height="30"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </button>
              <button class="action-btn" :disabled="!player.currentSong" @click="player.next()" aria-label="Bài tiếp theo">
                <svg viewBox="0 0 24 24" fill="currentColor" width="23" height="23"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>

    <section class="suggestions-section">
      <h3 class="suggestions-title">Gợi ý hát Karaoke</h3>
      <div v-if="karaokeSuggestions.length" class="suggestions-carousel-shell">
        <button
          class="suggestions-nav suggestions-nav--left"
          type="button"
          aria-label="Cuộn gợi ý sang trái"
          :disabled="!canScrollSuggestionsLeft"
          @click="scrollSuggestions('left')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/>
          </svg>
        </button>

        <div ref="suggestionsScroller" class="suggestions-carousel" @scroll.passive="updateSuggestionsScrollState">
          <button
            v-for="item in karaokeSuggestions"
            :key="item.key"
            class="suggestion-card"
            type="button"
            @click="playSuggestion(item)"
          >
            <span class="suggestion-cover-wrap">
              <img
                class="suggestion-cover"
                :src="getSuggestionCover(item.song)"
                :alt="item.song?.title || 'Song cover'"
                @error="event => event.target.src = '/images/default-cover.svg'"
              />
              <span class="suggestion-play-overlay">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </span>
            </span>
            <span class="suggestion-title">{{ item.song?.title || 'Không rõ tên bài hát' }}</span>
            <span class="suggestion-artist">{{ getSuggestionArtist(item.song) }}</span>
          </button>
        </div>

        <button
          class="suggestions-nav suggestions-nav--right"
          type="button"
          aria-label="Cuộn gợi ý sang phải"
          :disabled="!canScrollSuggestionsRight"
          @click="scrollSuggestions('right')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
          </svg>
        </button>
      </div>
      <div v-else class="suggestions-empty spotify-card">
        Chưa có gợi ý phù hợp
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import LyricsPanel from '@/components/player/LyricsPanel.vue'
import { normalizeImageUrl } from '@/utils/imageUrl'

const auth = useAuthStore()
const player = usePlayerStore()
const isPremium = computed(() => auth.isPremium)

const vocalVolume = ref(20)
const instVolume = ref(85)
const suggestionsScroller = ref(null)
const canScrollSuggestionsLeft = ref(false)
const canScrollSuggestionsRight = ref(false)
const coverUrl = computed(() => normalizeImageUrl(player.currentSong?.cover_url || player.currentSong?.cover))
const karaokeSuggestions = computed(() => {
  const songs = Array.isArray(player.queue) ? player.queue : []
  const seen = new Set()

  return songs
    .map((song, index) => ({ song, index, key: `${song?.id ?? song?.song_id ?? song?.track_id ?? index}-${index}` }))
    .filter((item) => {
      const id = item.song?.id ?? item.song?.song_id ?? item.song?.track_id ?? item.index
      const key = String(id)
      if (seen.has(key)) return false
      seen.add(key)
      return Boolean(item.song)
    })
    .slice(0, 12)
})

function downloadBeat() {
  if (!isPremium.value) {
    alert('Vui lòng nâng cấp Premium để sử dụng tính năng tải beat!')
    return
  }
  alert('Đang tải beat nhạc nền...')
}

function getSuggestionCover(song) {
  return normalizeImageUrl(song?.cover_url || song?.cover || song?.album_cover_url || '/images/default-cover.svg')
}

function getSuggestionArtist(song) {
  return song?.artist_name || song?.artist || song?.artists?.map((artist) => artist.name).filter(Boolean).join(', ') || 'Nghệ sĩ'
}

function playSuggestion(item) {
  if (Number.isInteger(item.index) && item.index >= 0) {
    player.playAtIndex(item.index)
    return
  }
  if (item.song) player.setSong(item.song, player.queue, 'karaoke')
}

function updateSuggestionsScrollState() {
  const scroller = suggestionsScroller.value
  if (!scroller) {
    canScrollSuggestionsLeft.value = false
    canScrollSuggestionsRight.value = false
    return
  }

  const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
  canScrollSuggestionsLeft.value = scroller.scrollLeft > 4
  canScrollSuggestionsRight.value = scroller.scrollLeft < maxScrollLeft - 4
}

function scrollSuggestions(direction) {
  const scroller = suggestionsScroller.value
  if (!scroller) return

  const cardStep = 180
  const amount = Math.min(Math.max(cardStep * 2, 320), Math.max(cardStep, scroller.clientWidth * 0.45))
  scroller.scrollBy({
    left: direction === 'left' ? -amount : amount,
    behavior: 'smooth',
  })

  window.setTimeout(updateSuggestionsScrollState, 360)
}

watch(karaokeSuggestions, async () => {
  await nextTick()
  updateSuggestionsScrollState()
})

onMounted(() => {
  nextTick(updateSuggestionsScrollState)
  window.addEventListener('resize', updateSuggestionsScrollState)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSuggestionsScrollState)
})
</script>

<style scoped>
.karaoke-view {
  width: min(100%, 1320px);
  min-height: 100%;
  margin: 0 auto;
  padding: 24px 24px 128px;
  color: #ffffff;
}

.header-section {
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 6px;
  color: #ffffff;
  font-size: 32px;
  font-weight: 900;
  letter-spacing: 0;
}

.section-subtitle {
  margin: 0;
  color: rgba(179, 179, 179, 0.95);
  font-size: 15px;
}

.karaoke-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}

.stem-panel {
  flex: 1 1 320px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.spotify-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.24);
}

.stem-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-title {
  margin: 0;
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
}

.space-between {
  justify-content: space-between;
}

.flex-center {
  display: flex;
  align-items: center;
}

.icon-primary {
  color: #8b5cf6;
}

.icon-pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.72; }
  100% { transform: scale(1); opacity: 1; }
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slider-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slider-label {
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.slider-value {
  color: #a78bfa;
  font-weight: 800;
}

.slider-group:last-of-type .slider-value {
  color: #60a5fa;
}

.stem-slider {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  outline: none;
  background: rgba(255, 255, 255, 0.09);
  -webkit-appearance: none;
}

.vocal-slider::-webkit-slider-thumb,
.inst-slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  -webkit-appearance: none;
}

.vocal-slider::-webkit-slider-thumb {
  background: #8b5cf6;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.45);
}

.inst-slider::-webkit-slider-thumb {
  background: #60a5fa;
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.42);
}

.info-box {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  padding: 13px 14px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  line-height: 1.55;
}

.info-box p {
  margin: 0;
}

.btn-download {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #ffffff;
  cursor: pointer;
  font-weight: 800;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.btn-download:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-download:disabled {
  cursor: not-allowed;
  filter: grayscale(35%);
  opacity: 0.58;
}

.badge-premium {
  border-radius: 999px;
  background: rgba(236, 72, 153, 0.9);
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mic-card {
  padding: 18px 20px 20px;
}

.mic-status {
  color: #34d399;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.mic-waveform {
  position: relative;
  height: 58px;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 16px;
  background:
    radial-gradient(circle at 18% 50%, rgba(34, 211, 238, 0.14), transparent 34%),
    radial-gradient(circle at 78% 50%, rgba(52, 211, 153, 0.16), transparent 36%),
    rgba(255, 255, 255, 0.025);
}

.mic-waveform::before {
  content: '';
  position: absolute;
  inset: 50% 14px auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
}

.waveform-svg {
  position: absolute;
  inset: 6px 10px;
  width: calc(100% - 20px);
  height: calc(100% - 12px);
}

.waveform-guide,
.waveform-line {
  fill: none;
  vector-effect: non-scaling-stroke;
}

.waveform-guide {
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1;
}

.waveform-line {
  stroke: url(#micWaveGradient);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.waveform-line--ghost {
  filter: url(#micWaveGlow);
  opacity: 0.28;
  stroke-width: 7;
}

.waveform-line--main {
  stroke-dasharray: 80 24;
  stroke-dashoffset: 0;
  stroke-width: 2.8;
  animation: waveform-flow 3.8s ease-in-out infinite;
}

@keyframes waveform-flow {
  0% {
    stroke-dashoffset: 0;
    opacity: 0.76;
  }
  50% {
    stroke-dashoffset: -52;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -104;
    opacity: 0.76;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waveform-line--main {
    animation: none;
  }
}

.lyrics-column {
  flex: 2 1 450px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.lyrics-card {
  display: flex;
  min-height: 520px;
  max-height: calc(100vh - 230px);
  flex-direction: column;
  overflow: hidden;
}

.lyrics-card :deep(.lyrics-panel) {
  flex: 1;
  min-height: 0;
  padding: 24px 26px 6px;
}

.lyrics-card :deep(.lyrics-panel__body) {
  min-height: 0;
  max-height: calc(100vh - 365px);
  overflow-y: auto;
}

.lyrics-card :deep(.lyrics-panel__header) {
  padding-bottom: 14px;
}

.lyrics-card :deep(.lyrics-panel__eyebrow) {
  color: #a78bfa;
}

.lyrics-card :deep(.lyrics-panel__title) {
  font-size: 20px;
}

.lyrics-card :deep(.lyrics-panel__synced),
.lyrics-card :deep(.lyrics-panel__plain) {
  gap: 14px;
  padding: 14px 0 20px;
}

.lyrics-card :deep(.lyrics-panel__line) {
  color: rgba(255, 255, 255, 0.45);
  font-size: clamp(20px, 2.4vw, 30px);
}

.lyrics-card :deep(.lyrics-panel__line--active) {
  color: #ffffff;
  font-weight: 900;
  text-shadow: 0 0 22px rgba(139, 92, 246, 0.34);
}

.lyrics-card :deep(.lyrics-panel__line--past) {
  color: rgba(255, 255, 255, 0.32);
}

.lyrics-card :deep(.lyrics-panel__line--future) {
  color: rgba(255, 255, 255, 0.48);
}

.lyrics-card :deep(.lyrics-panel__plain-line) {
  color: rgba(255, 255, 255, 0.72);
  font-size: clamp(16px, 1.7vw, 21px);
  line-height: 1.5;
}

.lyrics-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(18, 18, 18, 0.82);
  padding: 16px 20px;
}

.song-info {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 13px;
}

.song-meta {
  min-width: 0;
}

.song-title {
  margin: 0 0 4px;
  overflow: hidden;
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  margin: 0;
  overflow: hidden;
  color: rgba(179, 179, 179, 0.92);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-cover {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  object-fit: cover;
}

.song-cover--empty {
  display: block;
}

.player-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.action-btn,
.play-btn {
  border: none;
  cursor: pointer;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  color: rgba(255, 255, 255, 0.58);
  transition: color 0.18s ease;
}

.action-btn:hover {
  color: #ffffff;
}

.play-btn {
  display: flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b5cf6, #2563eb);
  color: #ffffff;
  transition: transform 0.18s ease;
}

.play-btn:hover {
  transform: scale(1.04);
}

.action-btn:disabled,
.play-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
}

.suggestions-section {
  margin: 24px 0 0;
  min-width: 0;
}

.suggestions-title {
  margin: 0 0 12px;
  color: #ffffff;
  font-size: 19px;
  font-weight: 850;
}

.suggestions-carousel-shell {
  position: relative;
  min-width: 0;
}

.suggestions-carousel {
  display: flex;
  gap: 16px;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  padding: 2px 2px 12px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.suggestions-carousel::-webkit-scrollbar {
  height: 6px;
}

.suggestions-carousel::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.suggestions-nav {
  position: absolute;
  top: 50%;
  z-index: 3;
  display: none;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(18, 18, 18, 0.88);
  color: #ffffff;
  cursor: pointer;
  transform: translateY(-50%);
  transition: opacity 0.18s ease, background 0.18s ease, border-color 0.18s ease;
  backdrop-filter: blur(14px);
}

.suggestions-nav--left {
  left: 8px;
}

.suggestions-nav--right {
  right: 8px;
}

.suggestions-nav:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(30, 215, 96, 0.88);
  color: #06110a;
}

.suggestions-nav:disabled {
  cursor: default;
  opacity: 0.42;
}

.suggestion-card {
  width: 164px;
  flex: 0 0 164px;
  scroll-snap-align: start;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  padding: 12px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.suggestion-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.075);
  transform: translateY(-2px);
}

.suggestion-cover-wrap {
  position: relative;
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
}

.suggestion-cover {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transition: transform 0.22s ease;
}

.suggestion-card:hover .suggestion-cover {
  transform: scale(1.04);
}

.suggestion-play-overlay {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #1ed760;
  color: #06110a;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.suggestion-card:hover .suggestion-play-overlay {
  opacity: 1;
  transform: translateY(0);
}

.suggestion-title,
.suggestion-artist {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-title {
  margin-top: 10px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
}

.suggestion-artist {
  margin-top: 3px;
  color: rgba(179, 179, 179, 0.9);
  font-size: 12px;
  font-weight: 600;
}

.suggestions-empty {
  padding: 18px 20px;
  color: rgba(179, 179, 179, 0.92);
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .karaoke-grid {
    grid-template-columns: 1fr;
  }

  .lyrics-card {
    max-height: none;
  }

  .lyrics-card :deep(.lyrics-panel__body) {
    max-height: 560px;
  }
}

@media (max-width: 640px) {
  .karaoke-view {
    padding: 20px 14px 128px;
  }

  .section-title {
    font-size: 28px;
  }

  .stem-card,
  .mic-card {
    padding: 16px;
  }

  .lyrics-card {
    min-height: 500px;
  }

  .lyrics-card :deep(.lyrics-panel) {
    padding: 20px 16px 4px;
  }

  .lyrics-card :deep(.lyrics-panel__body) {
    max-height: 420px;
  }

  .lyrics-controls {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 16px 16px;
  }

  .player-actions {
    width: 100%;
    justify-content: center;
  }

  .suggestions-carousel {
    gap: 12px;
    padding-bottom: 10px;
  }

  .suggestion-card {
    width: 150px;
    flex-basis: 150px;
    padding: 10px;
  }
}

@media (min-width: 768px) {
  .suggestions-nav {
    display: flex;
  }
}
</style>

