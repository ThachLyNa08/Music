<template>
  <section class="lyrics-panel" :class="[`lyrics-panel--${variant}`, { 'lyrics-panel--empty': !songId }]">
    <div v-if="showHeader" class="lyrics-panel__header">
      <div>
        <p class="lyrics-panel__eyebrow">Lyrics</p>
        <h2 class="lyrics-panel__title">{{ song?.title || 'Chưa chọn bài hát' }}</h2>
      </div>
      <span v-if="lyricsData?.provider" class="lyrics-panel__provider">{{ lyricsData.provider }}</span>
    </div>

    <div
      ref="scrollContainer"
      class="lyrics-panel__body"
      @wheel.passive="pauseAutoScroll"
      @touchstart.passive="pauseAutoScroll"
      @pointerdown="pauseAutoScroll"
    >
      <div v-if="!songId" class="lyrics-panel__state">
        Chưa có bài hát đang phát
      </div>

      <div v-else-if="lyricsLoading" class="lyrics-panel__loading">
        <div class="lyrics-panel__skeleton lyrics-panel__skeleton--wide"></div>
        <div class="lyrics-panel__skeleton"></div>
        <p>Đang tải lời bài hát...</p>
      </div>

      <div v-else-if="lyricsError" class="lyrics-panel__state">
        Không thể tải lời bài hát
      </div>

      <div v-else-if="emptyLyricsMessage" class="lyrics-panel__state">
        {{ emptyLyricsMessage }}
      </div>

      <div v-else-if="isPlainText" class="lyrics-panel__plain">
        <p v-for="(line, index) in displayLines" :key="`${index}-${line.words}`" class="lyrics-panel__plain-line">
          {{ line.words }}
        </p>
      </div>

      <div v-else class="lyrics-panel__synced">
        <p
          v-for="(line, index) in displayLines"
          :key="`${line.startTimeMs ?? index}-${line.words}`"
          :ref="(el) => setLineRef(el, index)"
          class="lyrics-panel__line"
          :class="{
            'lyrics-panel__line--active': index === activeLineIndex,
            'lyrics-panel__line--past': index < activeLineIndex,
            'lyrics-panel__line--future': index > activeLineIndex || activeLineIndex === -1,
          }"
        >
          {{ line.words }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUpdate, ref, watch } from 'vue'
import { getLyricsBySongId } from '@/api/lyrics'

const props = defineProps({
  song: {
    type: Object,
    default: null,
  },
  currentTime: {
    type: Number,
    default: 0,
  },
  variant: {
    type: String,
    default: 'card',
  },
  showHeader: {
    type: Boolean,
    default: true,
  },
})

const lyricsLoading = ref(false)
const lyricsError = ref(false)
const lyricsData = ref(null)
const scrollContainer = ref(null)
const lineEls = ref([])
let requestToken = 0
let lastScrollAt = 0
let autoScrollPausedUntil = 0

const songId = computed(() => props.song?.id ?? props.song?.song_id ?? props.song?.track_id ?? null)
const syncType = computed(() => lyricsData.value?.syncType || 'NONE')

const displayLines = computed(() => {
  const lines = Array.isArray(lyricsData.value?.lines) ? lyricsData.value.lines : []
  return lines
    .map((line) => ({
      startTimeMs: toNumberOrNull(line?.startTimeMs),
      endTimeMs: toNumberOrNull(line?.endTimeMs),
      words: String(line?.words || '').trim(),
    }))
    .filter((line) => line.words)
})

const isPlainText = computed(() => syncType.value === 'PLAIN_TEXT')

const emptyLyricsMessage = computed(() => {
  if (syncType.value === 'INSTRUMENTAL') return 'Bài hát không lời'
  if (lyricsData.value?.error || syncType.value === 'NONE') return 'Chưa có lời bài hát cho bài này'
  if (!displayLines.value.length) return 'Chưa có lời bài hát cho bài này'
  return ''
})

const activeLineIndex = computed(() => {
  if (syncType.value !== 'LINE_SYNCED' || !displayLines.value.length) return -1

  const currentTimeMs = Math.max(0, props.currentTime || 0) * 1000

  return displayLines.value.findIndex((line, index, lines) => {
    const start = line.startTimeMs ?? 0
    const end = line.endTimeMs ?? 0

    if (currentTimeMs < start) return false
    if (end > start) return currentTimeMs < end

    const nextLine = lines.slice(index + 1).find((item) => item.startTimeMs !== null && item.startTimeMs > start)
    return nextLine ? currentTimeMs < nextLine.startTimeMs : currentTimeMs >= start
  })
})

watch(
  songId,
  async (nextSongId) => {
    requestToken += 1
    const token = requestToken
    lyricsData.value = null
    lyricsError.value = false

    if (!nextSongId) {
      lyricsLoading.value = false
      return
    }

    lyricsLoading.value = true

    try {
      const response = await getLyricsBySongId(nextSongId)
      if (token !== requestToken) return
      lyricsData.value = response?.data || null
    } catch (error) {
      if (token !== requestToken) return
      lyricsError.value = true
      lyricsData.value = null
    } finally {
      if (token === requestToken) lyricsLoading.value = false
    }
  },
  { immediate: true }
)

watch(activeLineIndex, async (index) => {
  if (index < 0 || syncType.value !== 'LINE_SYNCED') return
  if (Date.now() < autoScrollPausedUntil) return

  const now = Date.now()
  if (now - lastScrollAt < 450) return
  lastScrollAt = now

  await nextTick()
  scrollActiveLineIntoContainer(index)
})

onBeforeUpdate(() => {
  lineEls.value = []
})

function setLineRef(el, index) {
  if (el) lineEls.value[index] = el
}

function pauseAutoScroll() {
  autoScrollPausedUntil = Date.now() + 3000
}

function scrollActiveLineIntoContainer(index) {
  const container = scrollContainer.value
  const activeEl = lineEls.value[index]
  if (!container || !activeEl) return

  const containerRect = container.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()
  const offset =
    activeRect.top -
    containerRect.top +
    container.scrollTop -
    container.clientHeight / 2 +
    activeEl.clientHeight / 2

  container.scrollTo({
    top: Math.max(0, offset),
    behavior: 'smooth',
  })
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
</script>

<style scoped>
.lyrics-panel {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  color: #ffffff;
}

.lyrics-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 18px;
}

.lyrics-panel__eyebrow {
  margin: 0 0 4px;
  color: #22c55e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lyrics-panel__title {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.15;
}

.lyrics-panel__provider {
  flex-shrink: 0;
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 999px;
  padding: 5px 10px;
  color: #86efac;
  background: rgba(34, 197, 94, 0.08);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.lyrics-panel__body {
  min-height: 260px;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 8px 12px 0;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}

.lyrics-panel__body::-webkit-scrollbar {
  width: 6px;
}

.lyrics-panel__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.lyrics-panel__state,
.lyrics-panel__loading {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.58);
  font-size: 16px;
  font-weight: 700;
}

.lyrics-panel__skeleton {
  width: min(420px, 80%);
  height: 24px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
  background-size: 200% 100%;
  animation: lyrics-shimmer 1.4s ease-in-out infinite;
}

.lyrics-panel__skeleton--wide {
  width: min(560px, 92%);
}

.lyrics-panel__synced,
.lyrics-panel__plain {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px 0;
}

.lyrics-panel__line,
.lyrics-panel__plain-line {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.28;
  transition: color 0.22s ease, transform 0.22s ease, opacity 0.22s ease;
}

.lyrics-panel__line {
  color: rgba(255, 255, 255, 0.45);
  font-size: clamp(20px, 3vw, 34px);
  font-weight: 800;
}

.lyrics-panel__line--active {
  color: #ffffff;
  transform: translateX(6px);
  text-shadow: 0 0 24px rgba(34, 197, 94, 0.3);
}

.lyrics-panel__line--past {
  color: rgba(255, 255, 255, 0.3);
}

.lyrics-panel__line--future {
  color: rgba(255, 255, 255, 0.52);
}

.lyrics-panel__plain-line {
  color: rgba(255, 255, 255, 0.72);
  font-size: clamp(17px, 2.1vw, 24px);
  font-weight: 650;
}

.lyrics-panel--fullscreen .lyrics-panel__header {
  display: none;
}

.lyrics-panel--fullscreen .lyrics-panel__body {
  min-height: 500px;
  padding: 96px 8px;
  mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
}

.lyrics-panel--fullscreen .lyrics-panel__line {
  font-size: clamp(26px, 4vw, 42px);
}

@keyframes lyrics-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 640px) {
  .lyrics-panel__body {
    min-height: 300px;
    padding-right: 2px;
  }

  .lyrics-panel__synced,
  .lyrics-panel__plain {
    gap: 14px;
  }

  .lyrics-panel__line--active {
    transform: none;
  }
}
</style>
