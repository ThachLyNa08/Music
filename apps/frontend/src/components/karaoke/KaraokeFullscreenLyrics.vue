<template>
  <Teleport to="body">
    <Transition name="slide-up" appear>
      <div v-if="isOpen" class="karaoke-fullscreen" role="dialog" aria-modal="true" aria-label="Karaoke lyrics fullscreen">
        <div class="karaoke-fullscreen__glow karaoke-fullscreen__glow--violet"></div>
        <div class="karaoke-fullscreen__glow karaoke-fullscreen__glow--cyan"></div>

      <header class="karaoke-fullscreen__header">
        <div class="karaoke-fullscreen__song">
          <p class="karaoke-fullscreen__status">{{ statusText }}</p>
          <h2>{{ song?.title || 'Karaoke' }}</h2>
          <p>{{ artistName }}</p>
        </div>

        <button
          type="button"
          class="karaoke-fullscreen__close"
          aria-label="Đóng fullscreen lyrics"
          title="Đóng"
          @click="$emit('close')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" width="22" height="22">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <main
        ref="scrollContainer"
        class="karaoke-fullscreen__lyrics"
        @scroll.passive="handleManualScroll"
        @wheel.passive="handleManualScroll"
        @touchstart.passive="handleManualScroll"
        @pointerdown="handleManualScroll"
      >
        <div v-if="!lyrics.length" class="karaoke-fullscreen__empty">
          Bài hát này chưa có lyrics đồng bộ
        </div>

        <div v-else class="karaoke-fullscreen__lyrics-inner">
          <p
            v-for="(line, index) in lyrics"
            :key="`${line.time ?? index}-${line.words}`"
            :ref="(el) => setLineRef(el, index)"
            class="karaoke-fullscreen__line"
            :class="{
              'karaoke-fullscreen__line--active': index === resolvedCurrentLyricIndex,
              'karaoke-fullscreen__line--past': index < resolvedCurrentLyricIndex,
              'karaoke-fullscreen__line--future': index > resolvedCurrentLyricIndex || resolvedCurrentLyricIndex === -1,
            }"
          >
            {{ line.words }}
          </p>
        </div>
      </main>

      <footer class="karaoke-fullscreen__controls">
        <button
          type="button"
          class="karaoke-fullscreen__play"
          :disabled="!song"
          :aria-label="isPlaying ? 'Tạm dừng' : 'Phát'"
          @click="$emit('toggle-play')"
        >
          <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>

        <div class="karaoke-fullscreen__timeline">
          <div class="karaoke-fullscreen__times">
            <span>{{ formatTime(seekPreviewTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
          <input
            class="karaoke-fullscreen__range"
            type="range"
            min="0"
            :max="duration || 0"
            :value="seekPreviewTime"
            step="0.1"
            :disabled="!duration"
            aria-label="Tua thời gian karaoke"
            @input="handleSeekInput"
            @change="handleSeekChange"
          />
        </div>
      </footer>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, ref, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  song: {
    type: Object,
    default: null,
  },
  lyrics: {
    type: Array,
    default: () => [],
  },
  currentLyricIndex: {
    type: Number,
    default: -1,
  },
  currentTime: {
    type: Number,
    default: 0,
  },
  duration: {
    type: Number,
    default: 0,
  },
  isPlaying: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'toggle-play', 'seek'])

const scrollContainer = ref(null)
const lineEls = ref([])
const isSeeking = ref(false)
const seekTime = ref(0)
let manualScrollPausedUntil = 0
let scrollFrame = 0
let lastScrollAt = 0

const artistName = computed(() => (
  props.song?.artist_name
  || props.song?.artist
  || props.song?.artists?.map((artist) => artist.name).filter(Boolean).join(', ')
  || 'Nghệ sĩ'
))
const statusText = computed(() => (props.lyrics.length ? 'Lyrics đồng bộ' : 'Chưa có lyrics đồng bộ'))

const seekPreviewTime = computed(() => {
  if (isSeeking.value) return seekTime.value
  return Math.max(0, Number(props.currentTime) || 0)
})

const resolvedCurrentLyricIndex = computed(() => {
  if (props.currentLyricIndex >= 0) return props.currentLyricIndex
  if (!props.lyrics.length) return -1

  const safeCurrentTime = Math.max(0, Number(props.currentTime) || 0)
  for (let index = props.lyrics.length - 1; index >= 0; index -= 1) {
    const time = Number(props.lyrics[index]?.time)
    if (Number.isFinite(time) && time <= safeCurrentTime) return index
  }

  return -1
})

watch(
  resolvedCurrentLyricIndex,
  async (index, previousIndex) => {
    if (index < 0 || index === previousIndex || Date.now() < manualScrollPausedUntil) return

    const now = Date.now()
    if (now - lastScrollAt < 420) return
    lastScrollAt = now

    await nextTick()
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = window.requestAnimationFrame(() => {
      const container = scrollContainer.value
      const activeEl = lineEls.value[index]
      if (!container || !activeEl) return
      
      const offsetTop = activeEl.offsetTop
      const clientHeight = container.clientHeight
      const elHeight = activeEl.clientHeight

      container.scrollTo({
        top: offsetTop - clientHeight / 2 + elHeight / 2,
        behavior: previousIndex === undefined ? 'auto' : 'smooth',
      })
    })
  },
  { immediate: true }
)

onBeforeUpdate(() => {
  lineEls.value = []
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(scrollFrame)
})

function setLineRef(el, index) {
  if (el) lineEls.value[index] = el
}

function handleManualScroll() {
  manualScrollPausedUntil = Date.now() + 2200
}

function handleSeekInput(event) {
  const nextTime = Number(event?.target?.value)
  if (!Number.isFinite(nextTime)) return
  seekTime.value = nextTime
  isSeeking.value = true
}

function handleSeekChange(event) {
  const nextTime = Number(event?.target?.value)
  isSeeking.value = false
  if (!Number.isFinite(nextTime)) return
  emit('seek', nextTime)
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Math.floor(Number(seconds)) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}
</script>

<style scoped>
.karaoke-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(124, 58, 237, 0.22), transparent 32%),
    radial-gradient(circle at 86% 78%, rgba(34, 211, 238, 0.14), transparent 34%),
    linear-gradient(145deg, #030712 0%, #080615 42%, #111827 100%);
  color: #ffffff;
}

.karaoke-fullscreen__glow {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  filter: blur(74px);
  opacity: 0.42;
}

.karaoke-fullscreen__glow--violet {
  width: 320px;
  height: 320px;
  left: -90px;
  top: 14%;
  background: rgba(139, 92, 246, 0.42);
}

.karaoke-fullscreen__glow--cyan {
  width: 260px;
  height: 260px;
  right: -80px;
  bottom: 8%;
  background: rgba(59, 130, 246, 0.28);
}

.karaoke-fullscreen__header,
.karaoke-fullscreen__controls {
  position: relative;
  z-index: 2;
}

.karaoke-fullscreen__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: max(22px, env(safe-area-inset-top)) clamp(18px, 4vw, 56px) 14px;
}

.karaoke-fullscreen__song {
  min-width: 0;
}

.karaoke-fullscreen__status {
  margin: 0 0 8px;
  color: rgba(196, 181, 253, 0.86);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.karaoke-fullscreen__song h2 {
  margin: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.96);
  font-size: clamp(22px, 3vw, 38px);
  font-weight: 950;
  line-height: 1.08;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.karaoke-fullscreen__song p:last-child {
  margin: 8px 0 0;
  overflow: hidden;
  color: rgba(226, 232, 240, 0.58);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.karaoke-fullscreen__close {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  backdrop-filter: blur(18px);
}

.karaoke-fullscreen__close:hover {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.04);
}

.karaoke-fullscreen__lyrics {
  position: relative;
  z-index: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 22px clamp(18px, 8vw, 120px) 150px;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent, black 9%, black 82%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 9%, black 82%, transparent);
}

.karaoke-fullscreen__lyrics::-webkit-scrollbar {
  display: none;
}

.karaoke-fullscreen__lyrics-inner {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: center;
  gap: clamp(14px, 2vh, 24px);
  padding: 10vh 0 18vh;
}

.karaoke-fullscreen__line {
  margin: 0 auto;
  max-width: min(1120px, 100%);
  color: rgba(226, 232, 240, 0.46);
  font-size: clamp(25px, 4vw, 62px);
  font-weight: 850;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
  opacity: 0.48;
  transform: scale(0.98);
  transition: color 180ms ease, opacity 180ms ease, transform 180ms ease, text-shadow 180ms ease;
}

.karaoke-fullscreen__line--active {
  color: #ffffff;
  opacity: 1;
  transform: scale(1.035);
  text-shadow: 0 0 32px rgba(129, 140, 248, 0.44), 0 0 12px rgba(34, 211, 238, 0.18);
}

.karaoke-fullscreen__line--past {
  opacity: 0.36;
}

.karaoke-fullscreen__line--future {
  opacity: 0.52;
}

.karaoke-fullscreen__empty {
  display: flex;
  min-height: 46vh;
  align-items: center;
  justify-content: center;
  color: rgba(226, 232, 240, 0.62);
  font-size: clamp(18px, 2.4vw, 28px);
  font-weight: 850;
  text-align: center;
}

.karaoke-fullscreen__controls {
  display: grid;
  grid-template-columns: auto minmax(0, 760px);
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 18px clamp(18px, 4vw, 56px) max(24px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(3, 7, 18, 0.62);
  box-shadow: 0 -20px 50px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(22px);
}

.karaoke-fullscreen__play {
  display: inline-flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #8b5cf6, #2563eb);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(79, 70, 229, 0.34);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.karaoke-fullscreen__play:hover:not(:disabled) {
  transform: scale(1.04);
  box-shadow: 0 16px 34px rgba(79, 70, 229, 0.42);
}

.karaoke-fullscreen__play:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.karaoke-fullscreen__timeline {
  min-width: 0;
}

.karaoke-fullscreen__times {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: rgba(226, 232, 240, 0.7);
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.karaoke-fullscreen__range {
  width: 100%;
  height: 5px;
  border-radius: 999px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}

.karaoke-fullscreen__range:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.karaoke-fullscreen__range::-webkit-slider-runnable-track {
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.94), rgba(167, 139, 250, 0.96));
}

.karaoke-fullscreen__range::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  margin-top: -4px;
  border: 2px solid #050816;
  border-radius: 999px;
  background: #ffffff;
  appearance: none;
  -webkit-appearance: none;
}

.karaoke-fullscreen__range::-moz-range-track {
  height: 5px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.94), rgba(167, 139, 250, 0.96));
}

.karaoke-fullscreen__range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 2px solid #050816;
  border-radius: 999px;
  background: #ffffff;
}

@media (max-width: 767px) {
  .karaoke-fullscreen__header {
    padding: max(16px, env(safe-area-inset-top)) 16px 8px;
  }

  .karaoke-fullscreen__song h2 {
    max-width: calc(100vw - 86px);
    font-size: 22px;
  }

  .karaoke-fullscreen__close {
    width: 46px;
    height: 46px;
  }

  .karaoke-fullscreen__lyrics {
    padding: 16px 18px 136px;
  }

  .karaoke-fullscreen__lyrics-inner {
    gap: 14px;
    padding: 7vh 0 16vh;
  }

  .karaoke-fullscreen__line {
    font-size: clamp(24px, 8vw, 36px);
    line-height: 1.26;
  }

  .karaoke-fullscreen__controls {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    padding: 14px 16px max(18px, env(safe-area-inset-bottom));
  }

  .karaoke-fullscreen__play {
    width: 48px;
    height: 48px;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
