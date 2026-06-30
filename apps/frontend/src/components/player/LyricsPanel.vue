<template>
  <section class="lyrics-panel" :class="[`lyrics-panel--${variant}`, { 'lyrics-panel--empty': !songId }]">
    <div v-if="showHeader" class="lyrics-panel__header">
      <div>
        <p class="lyrics-panel__eyebrow">Lyrics</p>
        <h2 class="lyrics-panel__title">{{ song?.title || 'Chưa chọn bài hát' }}</h2>
      </div>
      <div class="lyrics-panel__meta">
        <button
          v-if="!autoFollowLyrics && hasSyncedLyrics"
          type="button"
          class="lyrics-panel__follow-btn"
          @click="resumeAutoFollow"
        >
          Theo dõi lời
        </button>
        <span v-if="lyricsData?.provider" class="lyrics-panel__provider">{{ lyricsData.provider }}</span>
        <span v-if="showSyncBadge" class="lyrics-panel__sync-badge">{{ syncBadgeText }}</span>
      </div>
    </div>

    <div
      v-if="!showHeader && !autoFollowLyrics && hasSyncedLyrics"
      class="lyrics-panel__follow-cta"
    >
      <button type="button" class="lyrics-panel__follow-btn" @click="resumeAutoFollow">
        Theo dõi lời
      </button>
    </div>

    <div
      ref="scrollContainer"
      class="lyrics-panel__body"
      @scroll.passive="handleUserScroll"
      @wheel.passive="handleUserIntentScroll"
      @touchstart.passive="handleUserIntentScroll"
      @pointerdown="handleUserIntentScroll"
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

      <div v-else-if="isPlainLyrics" class="lyrics-panel__plain-wrap">
        <div v-if="showPlainLyricsNotice" class="lyrics-panel__notice">
          {{ plainLyricsNotice }}
        </div>
        <div class="lyrics-panel__plain">
          <p v-for="(line, index) in plainLyricsLines" :key="`${index}-${line.words}`" class="lyrics-panel__plain-line">
            {{ line.words }}
          </p>
        </div>
      </div>

      <div v-else class="lyrics-panel__synced">
        <p
          v-for="(line, index) in syncedLyricsLines"
          :key="`${line.time ?? index}-${line.words}`"
          :ref="(el) => setLineRef(el, index)"
          class="lyrics-panel__line"
          :class="{
            'lyrics-panel__line--active': index === currentLyricIndex,
            'lyrics-panel__line--past': index < currentLyricIndex,
            'lyrics-panel__line--future': index > currentLyricIndex || currentLyricIndex === -1,
          }"
        >
          {{ line.words }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, ref, watch } from 'vue'
import { getLyricsBySongId } from '@/api/lyrics'
import { parseLrcLyrics } from '@/utils/parseLrcLyrics'
import { checkLyricsQuality } from '@/utils/lyricsQuality'

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
  pauseAutoScroll: {
    type: Boolean,
    default: false,
  },
})

const lyricsLoading = ref(false)
const lyricsError = ref(false)
const lyricsData = ref(null)
const scrollContainer = ref(null)
const lineEls = ref([])
const autoFollowLyrics = ref(true)
const userScrolling = ref(false)
const lastUserScrollAt = ref(0)
let userScrollTimeout = null
let isProgrammaticScroll = false
let requestToken = 0
let lastScrollAt = 0

const songId = computed(() => props.song?.id ?? props.song?.song_id ?? props.song?.track_id ?? null)
const syncedLyricsRaw = computed(() => {
  const data = lyricsData.value || {}
  const fetched = data.syncedLyrics || data.synced_lyrics || data.lrcLyrics || data.lrc_lyrics || ''
  if (fetched) return fetched
  return props.song?.syncedLyrics ?? props.song?.synced_lyrics ?? ''
})
const plainLyricsRaw = computed(() => {
  const data = lyricsData.value || {}
  const fetched = data.plainLyrics || data.plain_lyrics || ''
  if (fetched) return fetched
  return props.song?.lyrics ?? props.song?.plainLyrics ?? props.song?.plain_lyrics ?? ''
})
const parsedSyncedLyrics = computed(() => parseLrcLyrics(syncedLyricsRaw.value))
const hasSyncedLyrics = computed(() => {
  const linesWithText = parsedSyncedLyrics.value.filter(l => l.text?.trim())
  return linesWithText.length >= 2
})
const currentLyricIndex = ref(-1)
const plainLyricsLines = computed(() => {
  if (Array.isArray(lyricsData.value?.lines) && lyricsData.value.lines.length && !hasSyncedLyrics.value) {
    return lyricsData.value.lines
      .map((line) => ({ words: String(line?.words || '').trim() }))
      .filter((line) => line.words)
  }

  return String(plainLyricsRaw.value || '')
    .split(/\r?\n/)
    .map((line) => ({ words: line.trim() }))
    .filter((line) => line.words)
})
const syncedLyricsLines = computed(() => parsedSyncedLyrics.value.map((line) => ({ time: line.time, words: line.text })))
const isInstrumental = computed(() => String(lyricsData.value?.syncType || '').toUpperCase() === 'INSTRUMENTAL')

const lyricsState = computed(() => {
  if (lyricsLoading.value) return 'loading'
  if (hasSyncedLyrics.value) return 'synced'
  if (plainLyricsLines.value.length > 0) return 'plain'
  return 'empty'
})

const isPlainLyrics = computed(() => lyricsState.value === 'plain')
const showPlainLyricsNotice = computed(() => isPlainLyrics.value)
const plainLyricsNotice = 'Bài hát này chưa có lời đồng bộ theo thời gian.'

const syncBadgeText = computed(() => {
  switch (lyricsState.value) {
    case 'loading': return 'Đang tải lyrics...'
    case 'synced': return 'Lyrics đồng bộ'
    case 'plain': return 'Lyrics thường'
    default: return 'Chưa có lyrics'
  }
})
const showSyncBadge = computed(() => Boolean(syncBadgeText.value))

const activeLineText = computed(() => {
  if (lyricsState.value !== 'synced' || currentLyricIndex.value < 0) return ''
  return syncedLyricsLines.value[currentLyricIndex.value]?.words || ''
})

const emptyLyricsMessage = computed(() => {
  if (lyricsState.value === 'loading') return ''
  if (isInstrumental.value) return 'Bài hát không lời'
  if (lyricsData.value?.error) return 'Bài hát này chưa có lyrics.'
  if (lyricsState.value === 'empty') return 'Bài hát này chưa có lyrics.'
  return ''
})

const activeLineIndex = computed(() => currentLyricIndex.value)

watch(
  () => lyricsState.value,
  (newState) => {
    if (import.meta.env.DEV) {
      console.log('[LyricsState]', {
        songId: songId.value,
        hasPlainLyrics: plainLyricsLines.value.length > 0,
        hasSyncedLyrics: hasSyncedLyrics.value,
        parsedSyncedLines: syncedLyricsLines.value.length,
        state: newState,
      })
    }
  },
  { immediate: true }
)

defineExpose({
  syncedLyricsLines,
  plainLyricsLines,
  currentLyricIndex,
  hasSyncedLyrics,
  isPlainLyrics,
  emptyLyricsMessage,
  syncBadgeText,
  lyricsLoading,
})

const lyricsCache = new Map()

watch(
  () => props.song,
  async (newSong) => {
    const nextSongId = newSong?.id ?? newSong?.song_id ?? newSong?.track_id ?? null
    
    requestToken += 1
    const token = requestToken
    lineEls.value = []
    lastScrollAt = 0
    autoFollowLyrics.value = true
    userScrolling.value = false
    lastUserScrollAt.value = 0
    isProgrammaticScroll = false
    clearUserScrollTimeout()
    currentLyricIndex.value = -1

    if (!nextSongId) {
      lyricsData.value = null
      lyricsError.value = false
      lyricsLoading.value = false
      return
    }

    if (lyricsCache.has(nextSongId)) {
      lyricsData.value = lyricsCache.get(nextSongId)
      lyricsError.value = false
      lyricsLoading.value = false
      return
    }

    lyricsData.value = null
    lyricsError.value = false
    lyricsLoading.value = true

    try {
      const response = await getLyricsBySongId(nextSongId)
      if (token !== requestToken) return
      
      const payload = response?.data || null
      lyricsData.value = payload
      
      if (payload) {
        lyricsCache.set(nextSongId, payload)
      }

      if (import.meta.env.DEV) {
        const syncedValue = payload?.syncedLyrics ?? payload?.synced_lyrics ?? newSong?.syncedLyrics ?? newSong?.synced_lyrics ?? ''
        const plainValue = payload?.plainLyrics ?? payload?.plain_lyrics ?? newSong?.lyrics ?? newSong?.plainLyrics ?? newSong?.plain_lyrics ?? ''
        
        console.log('[UserLyricsDebug]', {
          songId: nextSongId,
          title: newSong?.title,
          artist: newSong?.artistName || newSong?.artist_name || newSong?.artist,
          hasPlainLyrics: Boolean(plainValue),
          plainLength: plainValue?.length || 0,
          hasSyncedLyrics: Boolean(syncedValue),
          syncedLength: syncedValue?.length || 0,
          provider: payload?.provider || payload?.lyricsProvider,
          syncType: payload?.syncType || payload?.lyricsSyncType,
          state: lyricsState.value
        })
      }
    } catch {
      if (token !== requestToken) return
      lyricsError.value = true
      lyricsData.value = null
    } finally {
      if (token === requestToken) lyricsLoading.value = false
    }
  },
  { immediate: true }
)

watch(
  [syncedLyricsLines, () => props.currentTime],
  ([lines, currentTime]) => {
    if (lyricsState.value !== 'synced') return;
    currentLyricIndex.value = resolveCurrentLyricIndex(lines, currentTime)

    if (import.meta.env.DEV && hasSyncedLyrics.value && false) {
      console.debug('[lyrics-panel] sync', {
        currentTime: Number(currentTime) || 0,
        currentLyricIndex: currentLyricIndex.value,
        activeLineText: activeLineText.value,
        parsedLyricsLength: lines.length,
      })
    }
  },
  { immediate: true }
)

watch(activeLineIndex, async (index, previousIndex) => {
  if (index < 0 || !hasSyncedLyrics.value || index === previousIndex) return
  if (!autoFollowLyrics.value || userScrolling.value || props.pauseAutoScroll) return

  const now = Date.now()
  if (now - lastScrollAt < 300) return
  lastScrollAt = now

  await nextTick()
  scrollActiveLineIntoContainer(index)
})

watch(hasSyncedLyrics, async (enabled) => {
  if (!enabled || !autoFollowLyrics.value || props.pauseAutoScroll) return
  await nextTick()
  if (activeLineIndex.value >= 0) scrollActiveLineIntoContainer(activeLineIndex.value, 'auto')
})

watch(() => props.pauseAutoScroll, async (paused) => {
  if (!paused && autoFollowLyrics.value && activeLineIndex.value >= 0) {
    await nextTick()
    scrollActiveLineIntoContainer(activeLineIndex.value, 'smooth')
  }
})

onBeforeUpdate(() => {
  lineEls.value = []
})

onBeforeUnmount(() => {
  clearUserScrollTimeout()
})

function setLineRef(el, index) {
  if (el) lineEls.value[index] = el
}

function handleUserIntentScroll() {
  if (isProgrammaticScroll) return
  autoFollowLyrics.value = false
  userScrolling.value = true
  lastUserScrollAt.value = Date.now()
  scheduleUserScrollReset()
}

function handleUserScroll() {
  if (isProgrammaticScroll) return
  autoFollowLyrics.value = false
  userScrolling.value = true
  lastUserScrollAt.value = Date.now()
  scheduleUserScrollReset()
}

function clearUserScrollTimeout() {
  if (userScrollTimeout) {
    window.clearTimeout(userScrollTimeout)
    userScrollTimeout = null
  }
}

function scheduleUserScrollReset() {
  clearUserScrollTimeout()
  userScrollTimeout = window.setTimeout(() => {
    userScrolling.value = false
    autoFollowLyrics.value = true
  }, 5000)
}

async function resumeAutoFollow() {
  autoFollowLyrics.value = true
  userScrolling.value = false
  clearUserScrollTimeout()
  await nextTick()
  if (activeLineIndex.value >= 0) {
    scrollActiveLineIntoContainer(activeLineIndex.value)
  }
}

function scrollActiveLineIntoContainer(index, behavior = 'smooth') {
  const container = scrollContainer.value
  const activeEl = lineEls.value[index]
  if (!container || !activeEl) return

  isProgrammaticScroll = true
  
  const offsetTop = activeEl.offsetTop
  const clientHeight = container.clientHeight
  const elHeight = activeEl.clientHeight
  
  container.scrollTo({
    top: offsetTop - clientHeight / 2 + elHeight / 2,
    behavior,
  })

  window.setTimeout(() => {
    isProgrammaticScroll = false
  }, 300)
}

function resolveCurrentLyricIndex(lines, currentTime) {
  if (!Array.isArray(lines) || !lines.length) return -1

  const safeCurrentTime = Math.max(0, Number(currentTime) || 0)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const lineTime = Number(lines[index]?.time)
    if (!Number.isFinite(lineTime)) continue

    const nextLineTime = Number(lines[index + 1]?.time)
    const isBeforeNext = !Number.isFinite(nextLineTime) || nextLineTime > safeCurrentTime

    if (lineTime <= safeCurrentTime && isBeforeNext) {
      return index
    }
  }

  return safeCurrentTime < Number(lines[0]?.time || 0) ? -1 : lines.length - 1
}
</script>

<style scoped>
.lyrics-panel {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  color: #ffffff;
  position: relative;
}

.lyrics-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 18px;
}

.lyrics-panel__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.lyrics-panel__provider,
.lyrics-panel__sync-badge {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.lyrics-panel__provider {
  border: 1px solid rgba(34, 197, 94, 0.25);
  color: #86efac;
  background: rgba(34, 197, 94, 0.08);
}

.lyrics-panel__sync-badge {
  border: 1px solid rgba(167, 139, 250, 0.25);
  color: #ddd6fe;
  background: rgba(167, 139, 250, 0.12);
}

.lyrics-panel__follow-cta {
  position: absolute;
  top: 64px;
  right: 0;
  z-index: 3;
  pointer-events: none;
}

.lyrics-panel__follow-btn {
  pointer-events: auto;
  border: 1px solid rgba(167, 139, 250, 0.28);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #ede9fe;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 8px 24px rgba(2, 6, 23, 0.24);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, color 0.2s ease;
}

.lyrics-panel__follow-btn:hover {
  background: rgba(76, 29, 149, 0.28);
  border-color: rgba(196, 181, 253, 0.52);
  transform: translateY(-1px);
}

.lyrics-panel__follow-btn:active {
  transform: translateY(0);
}

.lyrics-panel__body {
  min-height: 220px;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 12px 8px 12px;
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

.lyrics-panel__plain-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
}

.lyrics-panel__notice {
  align-self: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
}

.lyrics-panel__synced,
.lyrics-panel__plain {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0 20px;
}

.lyrics-panel__line,
.lyrics-panel__plain-line {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.38;
  transition: color 0.22s ease, transform 0.22s ease, opacity 0.22s ease, filter 0.22s ease, text-decoration-color 0.22s ease;
  transform-origin: left center;
}

.lyrics-panel__line {
  color: rgba(161, 161, 170, 0.94);
  opacity: 0.6;
  font-size: clamp(18px, 1.8vw, 26px);
  font-weight: 700;
  text-decoration: none;
  text-decoration-thickness: 2px;
  text-underline-offset: 6px;
}

.lyrics-panel__line--active {
  color: #ffffff;
  opacity: 1;
  font-weight: 850;
  transform: scale(1.01);
  text-shadow: 0 0 14px rgba(167, 139, 250, 0.16);
  background: linear-gradient(90deg, #ffffff 0%, #faf5ff 52%, #c4b5fd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-decoration-line: underline;
  text-decoration-color: #a78bfa;
}

.lyrics-panel__line--past {
  color: rgba(113, 113, 122, 0.92);
  opacity: 0.56;
}

.lyrics-panel__line--future {
  color: rgba(161, 161, 170, 0.96);
  opacity: 0.64;
}

.lyrics-panel__plain-line {
  color: rgba(228, 228, 231, 0.8);
  font-size: clamp(16px, 1.6vw, 22px);
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
  font-size: clamp(22px, 3.5vw, 36px);
}

@keyframes lyrics-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 640px) {
  .lyrics-panel__body {
    min-height: 240px;
    padding-right: 2px;
  }

  .lyrics-panel__synced,
  .lyrics-panel__plain {
    gap: 10px;
    padding: 12px 0 16px;
  }

  .lyrics-panel__line {
    font-size: clamp(16px, 5vw, 20px);
    line-height: 1.4;
  }

  .lyrics-panel__plain-line {
    font-size: clamp(14px, 4vw, 18px);
    line-height: 1.4;
  }

  .lyrics-panel__line--active {
    transform: none;
  }
}
</style>
