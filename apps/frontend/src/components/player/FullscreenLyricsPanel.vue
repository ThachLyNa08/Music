<template>
  <section class="flex h-full min-h-0 flex-col" aria-label="Lyrics">
    <div class="mb-4 hidden items-center justify-between gap-3 lg:flex">
      <div>
        <p class="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200/70">Lyrics</p>
        <h2 class="m-0 mt-1 text-xl font-black text-white/95">Karaoke Sync</h2>
      </div>
      <span v-if="lyricsData?.provider" class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase text-white/60">
        {{ lyricsData.provider }}
      </span>
    </div>

    <div ref="scrollContainer" class="lyrics-scroll min-h-0 flex-1 overflow-y-auto py-3 pr-1" @scroll="handleManualScroll">
      <div v-if="!songId" class="lyrics-state">
        Chưa có bài hát đang phát
      </div>

      <div v-else-if="lyricsLoading" class="lyrics-state">
        <div class="h-7 w-4/5 max-w-[520px] animate-pulse rounded-full bg-white/10"></div>
        <div class="h-7 w-3/5 max-w-[420px] animate-pulse rounded-full bg-white/5"></div>
        <p class="m-0 text-sm font-bold text-white/50">Đang tải lời bài hát...</p>
      </div>

      <div v-else-if="lyricsError" class="lyrics-state">
        Không thể tải lời bài hát
      </div>

      <div v-else-if="emptyLyricsMessage" class="lyrics-state">
        {{ emptyLyricsMessage }}
      </div>

      <div v-else-if="isPlainText" class="space-y-4 pb-6">
        <p
          v-for="(line, index) in displayLines"
          :key="`${index}-${line.words}`"
          class="m-0 text-lg font-semibold leading-relaxed text-white/72 sm:text-xl lg:text-2xl"
        >
          {{ line.words }}
        </p>
      </div>

      <div v-else class="flex min-h-full flex-col justify-center gap-3 py-6">
        <p
          v-for="line in visibleSyncedLines"
          :key="`${line.index}-${line.words}`"
          :ref="(el) => setLineRef(el, line.index)"
          class="lyrics-line"
          :class="{
            'lyrics-line--active': line.index === activeLineIndex,
            'lyrics-line--past': line.index < activeLineIndex,
            'lyrics-line--future': line.index > activeLineIndex || activeLineIndex === -1,
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
  songId: {
    type: [Number, String],
    default: null,
  },
  currentTime: {
    type: Number,
    default: 0,
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
})

const lyricsLoading = ref(false)
const lyricsError = ref(false)
const lyricsData = ref(null)
const lineEls = ref([])
const scrollContainer = ref(null)
let requestToken = 0
let lastScrollAt = 0
let manualScrollPausedUntil = 0
let scrollFrame = 0

const syncType = computed(() => lyricsData.value?.syncType || 'NONE')
const currentTimeMs = computed(() => Math.floor(Math.max(0, props.currentTime || 0) * 1000))

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

const normalizedLines = computed(() => {
  return displayLines.value.map((line, index, lines) => {
    const nextStart = lines[index + 1]?.startTimeMs
    const fallbackEnd = typeof nextStart === 'number' && nextStart > (line.startTimeMs ?? 0)
      ? nextStart
      : Infinity
    const startTimeMs = line.startTimeMs ?? 0
    const rawEndTimeMs = line.endTimeMs
    const endTimeMs = rawEndTimeMs && rawEndTimeMs > startTimeMs ? rawEndTimeMs : fallbackEnd

    return {
      ...line,
      startTimeMs,
      endTimeMs,
    }
  })
})

const isPlainText = computed(() => syncType.value === 'PLAIN_TEXT')

const emptyLyricsMessage = computed(() => {
  if (syncType.value === 'INSTRUMENTAL') return 'Bài hát không lời'
  if (lyricsData.value?.error || syncType.value === 'NONE') return 'Chưa có lời bài hát cho bài này'
  if (!displayLines.value.length) return 'Chưa có lời bài hát cho bài này'
  return ''
})

const activeLineIndex = computed(() => {
  if (syncType.value !== 'LINE_SYNCED' || !normalizedLines.value.length) return -1

  const exactIndex = normalizedLines.value.findIndex((line) => (
    currentTimeMs.value >= line.startTimeMs &&
    currentTimeMs.value < line.endTimeMs
  ))

  if (exactIndex >= 0) return exactIndex

  for (let index = normalizedLines.value.length - 1; index >= 0; index -= 1) {
    if (normalizedLines.value[index].startTimeMs <= currentTimeMs.value) return index
  }

  return 0
})

const visibleSyncedLines = computed(() => {
  const lines = normalizedLines.value
  if (!lines.length) return []

  const active = activeLineIndex.value >= 0 ? activeLineIndex.value : 0
  const start = Math.max(0, active - 1)
  const end = Math.min(lines.length, active + 3)

  return lines.slice(start, end).map((line, offset) => ({
    ...line,
    index: start + offset,
  }))
})

watch(
  () => props.songId,
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
  if (!props.isVisible || index < 0 || syncType.value !== 'LINE_SYNCED') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (Date.now() < manualScrollPausedUntil) return

  const now = Date.now()
  if (now - lastScrollAt < 650) return
  lastScrollAt = now

  await nextTick()
  window.cancelAnimationFrame(scrollFrame)
  scrollFrame = window.requestAnimationFrame(() => {
    lineEls.value[index]?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
  })

  if (import.meta.env.DEV) {
    console.debug('[fullscreen-lyrics]', {
      currentTimeMs: currentTimeMs.value,
      activeLineIndex: index,
      activeWords: normalizedLines.value[index]?.words,
    })
  }
})

onBeforeUpdate(() => {
  lineEls.value = []
})

function setLineRef(el, index) {
  if (el) lineEls.value[index] = el
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function handleManualScroll() {
  manualScrollPausedUntil = Date.now() + 2500
}
</script>

<style scoped>
.lyrics-scroll {
  mask-image: linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);
  scrollbar-width: none;
}

.lyrics-scroll::-webkit-scrollbar {
  display: none;
}

.lyrics-state {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.58);
  font-size: 17px;
  font-weight: 800;
}

.lyrics-line {
  margin: 0;
  overflow-wrap: anywhere;
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  border-radius: 16px;
  padding: 6px 12px;
  font-size: clamp(24px, 2.55vw, 34px);
  font-weight: 800;
  line-height: 1.42;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.24);
  transition: color 180ms ease, opacity 180ms ease, background-color 180ms ease, border-color 180ms ease;
}

.lyrics-line--active {
  color: #ffffff;
  background: rgba(124, 58, 237, 0.34);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  opacity: 1;
  font-weight: 950;
}

.lyrics-line--past {
  color: rgba(255, 255, 255, 0.22);
}

.lyrics-line--future {
  color: rgba(226, 232, 240, 0.45);
}

@media (max-width: 767px) {
  .lyrics-state {
    min-height: 180px;
    font-size: 15px;
  }

  .lyrics-line {
    padding: 5px 9px;
    font-size: clamp(19px, 5.4vw, 24px);
    line-height: 1.45;
  }

}
</style>
