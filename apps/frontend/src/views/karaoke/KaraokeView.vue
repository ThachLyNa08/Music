<template>
  <div class="karaoke-view user-page-bg">
    <section class="karaoke-hero relative overflow-hidden px-8 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img
        :src="apiMediaUrl('/uploads/playlist_cover/karaoke.png')"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-40 scale-[1.15] blur-[32px] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay -->
      <div class="absolute inset-0 bg-[#090B14]/60 z-0 pointer-events-none"></div>

      <div class="karaoke-hero-glow karaoke-hero-glow-1 z-0"></div>
      <div class="karaoke-hero-glow karaoke-hero-glow-2 z-0"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-8">
        <img
          :src="apiMediaUrl('/uploads/playlist_cover/karaoke.png')"
          alt="Karaoke"
          class="karaoke-cover w-[200px] h-[130px] lg:w-[280px] lg:h-[180px] object-cover rounded-2xl shadow-2xl border border-white/10 flex-shrink-0"
        />

        <div class="karaoke-hero-content min-w-0">
          <div class="karaoke-label">Karaoke AI</div>
          <h1 class="karaoke-title">Karaoke</h1>
          <p class="karaoke-subtitle">Trải nghiệm hát karaoke với lời nhạc đồng bộ</p>
          <p class="karaoke-meta">Tách vocal • Nhạc nền instrumental • Lyrics sync realtime</p>

          <div class="karaoke-actions">
            <button type="button" class="karaoke-primary-btn">
              Chọn bài hát
            </button>
            <button type="button" class="karaoke-secondary-btn">
              Xem bài đã tách
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="karaoke-grid">
      <aside class="stem-panel">
        <div class="spotify-card stem-card user-panel-soft">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" class="icon-primary">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
            </svg>
            <h2 class="card-title">Stem Separator</h2>
          </div>

          <div class="stem-job-status" :class="`stem-job-status--${stemStatus}`">
            <span class="status-dot"></span>
            <span>{{ stemStatusText }}</span>
            <strong v-if="stemJob && stemStatus !== 'completed' && stemStatus !== 'failed'">{{ stemJob.progress || 0 }}%</strong>
          </div>

          <button
            v-if="showSeparateButton"
            class="btn-separate"
            type="button"
            :disabled="stemLoading || !currentSongId"
            @click="requestStemSeparation"
          >
            {{ stemLoading ? 'Đang gửi yêu cầu...' : 'Tách giọng bài hát này' }}
          </button>

          <button
            v-if="stemStatus === 'failed'"
            class="btn-separate"
            type="button"
            :disabled="stemLoading || !currentSongId"
            @click="requestStemSeparation"
          >
            Thử lại
          </button>

          <div class="slider-group">
            <div class="slider-info">
              <span class="slider-label">Vocal (Giọng hát)</span>
              <span class="slider-value">{{ vocalVolume }}%</span>
            </div>
            <input type="range" min="0" max="100" v-model="vocalVolume" class="stem-slider vocal-slider" :disabled="!isStemCompleted" />
          </div>

          <div class="slider-group">
            <div class="slider-info">
              <span class="slider-label">Instrumental (Nhạc nền)</span>
              <span class="slider-value">{{ instVolume }}%</span>
            </div>
            <input type="range" min="0" max="100" v-model="instVolume" class="stem-slider inst-slider" :disabled="!isStemCompleted" />
          </div>

          <div class="info-box">
            <p>{{ stemInfoText }}</p>
          </div>

          <button class="btn-download" @click="downloadBeat" :disabled="!isStemCompleted || downloadingBeat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
            </svg>
            {{ downloadingBeat ? 'Đang tải...' : 'Tải beat nhạc nền' }}
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
          <LyricsPanel
            ref="lyricsPanelRef"
            :song="player.currentSong"
            :current-time="lyricsCurrentTime"
            :pause-auto-scroll="isHoveringSuggestions || isInteractingGlobally"
          />
          <div class="lyrics-controls">
            <div class="karaoke-mini-player">
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
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
                <button class="play-btn" :disabled="!player.currentSong" @click="toggleKaraokePlay" aria-label="Phát hoặc tạm dừng">
                  <svg v-if="!karaokeIsPlaying" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                <button class="action-btn" :disabled="!player.currentSong" @click="player.next()" aria-label="Bài tiếp theo">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
              </div>
              <div class="seekbar-wrapper">
                <div class="karaoke-seekbar" :class="{ 'is-disabled': !isStemCompleted }">
                  <span class="karaoke-time">{{ formattedStemCurrentTime }}</span>
                  <input
                    class="karaoke-range"
                    type="range"
                    min="0"
                    :max="stemDuration"
                    :value="stemSeekValue"
                    step="0.1"
                    :disabled="!isStemCompleted || !stemDuration"
                    aria-label="Tua thời gian karaoke"
                    @input="handleStemSeekInput"
                    @change="handleStemSeekChange"
                  />
                  <span class="karaoke-time">{{ formattedStemDuration }}</span>
                </div>
                <button
                  class="action-btn action-btn--expand"
                  :disabled="!player.currentSong"
                  type="button"
                  title="Mở rộng lời bài hát"
                  aria-label="Mở rộng lời bài hát"
                  @click="openKaraokeFullscreen"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" width="19" height="19">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>

    <section
      class="suggestions-section"
      @mouseenter="isHoveringSuggestions = true"
      @mouseleave="isHoveringSuggestions = false"
    >
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

    <KaraokeFullscreenLyrics
      :is-open="isKaraokeFullscreenOpen"
      :song="player.currentSong"
      :lyrics="fullscreenLyrics"
      :current-lyric-index="fullscreenCurrentLyricIndex"
      :current-time="lyricsCurrentTime"
      :duration="karaokeDuration"
      :is-playing="karaokeIsPlaying"
      @close="closeKaraokeFullscreen"
      @toggle-play="toggleKaraokePlay"
      @seek="handleKaraokeFullscreenSeek"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { stemApi } from '@/api/stem'
import { songApi } from '@/api/song'
import KaraokeFullscreenLyrics from '@/components/karaoke/KaraokeFullscreenLyrics.vue'
import LyricsPanel from '@/components/player/LyricsPanel.vue'
import { normalizeImageUrl } from '@/utils/imageUrl'

const auth = useAuthStore()
const player = usePlayerStore()
const isPremium = computed(() => auth.isPremium)

const vocalVolume = ref(20)
const instVolume = ref(85)
const stemJob = ref(null)
const stemLoading = ref(false)
const stemError = ref('')
const stemAudioLoading = ref(false)
const isSeekingStem = ref(false)
const stemSeekPosition = ref(0)
const downloadingBeat = ref(false)
const suggestionsScroller = ref(null)
const lyricsPanelRef = ref(null)
const isKaraokeFullscreenOpen = ref(false)
const canScrollSuggestionsLeft = ref(false)
const canScrollSuggestionsRight = ref(false)
const isHoveringSuggestions = ref(false)
const isInteractingGlobally = ref(false)
let globalInteractionTimeout = null
const extraSuggestions = ref([])
const vocalsAudio = new Audio()
const instrumentalAudio = new Audio()
let pollTimer = null

vocalsAudio.preload = 'metadata'
instrumentalAudio.preload = 'metadata'

const coverUrl = computed(() => normalizeImageUrl(player.currentSong?.cover_url || player.currentSong?.cover))
const currentSongId = computed(() => player.currentSong?.id ?? player.currentSong?.song_id ?? player.currentSong?.track_id ?? null)
const stemStatus = computed(() => stemJob.value?.status || (currentSongId.value ? 'idle' : 'empty'))
const isStemCompleted = computed(() => stemStatus.value === 'completed' && stemJob.value?.vocals_url && stemJob.value?.instrumental_url)
const karaokeIsPlaying = computed(() => player.isPlaying)
const lyricsCurrentTime = computed(() => player.currentTime || 0)

const stemSeekValue = computed(() => {
  if (isSeekingStem.value) return Math.min(stemSeekPosition.value, player.duration || 0)
  return Math.min(player.currentTime || 0, player.duration || 0)
})
const karaokeDuration = computed(() => player.duration || 0)
const stemDuration = computed(() => player.duration || 0)
const fullscreenLyrics = computed(() => {
  const lines = lyricsPanelRef.value?.syncedLyricsLines
  return Array.isArray(lines) ? lines : []
})
const fullscreenCurrentLyricIndex = computed(() => {
  const index = Number(lyricsPanelRef.value?.currentLyricIndex)
  return Number.isFinite(index) ? index : -1
})
const formattedStemCurrentTime = computed(() => formatTime(stemSeekValue.value))
const formattedStemDuration = computed(() => formatTime(stemDuration.value))
const showSeparateButton = computed(() => Boolean(currentSongId.value) && !stemJob.value && !stemLoading.value)
const stemStatusText = computed(() => {
  if (!currentSongId.value) return 'Chưa có bài hát'
  if (stemLoading.value && !stemJob.value) return 'Đang kiểm tra stem'
  if (stemStatus.value === 'pending') return 'Đang xếp hàng xử lý'
  if (stemStatus.value === 'processing') return 'Đang tách giọng'
  if (stemStatus.value === 'completed') return stemAudioLoading.value ? 'Đang nạp karaoke player' : 'Stem đã sẵn sàng'
  if (stemStatus.value === 'failed') return 'Tách stem thất bại'
  return 'Chưa tách stem'
})
const stemInfoText = computed(() => {
  if (stemError.value) return stemError.value
  if (!currentSongId.value) return 'Hãy phát một bài hát để bắt đầu tách giọng.'
  if (stemStatus.value === 'pending') return 'Job đã được tạo và đang chờ AI service xử lý.'
  if (stemStatus.value === 'processing') return 'Demucs đang xử lý bài hát này. Bạn có thể tiếp tục dùng ứng dụng.'
  if (stemStatus.value === 'completed') return 'Slider Vocal và Instrumental đang điều khiển âm lượng thật của từng track.'
  if (stemStatus.value === 'failed') return stemJob.value?.error_message || 'Có lỗi khi tách stem. Vui lòng thử lại.'
  return 'Tách stem chỉ chạy cho bài hát hiện tại khi bạn yêu cầu.'
})
const karaokeSuggestions = computed(() => {
  const queueSongs = Array.isArray(player.queue) ? player.queue : []
  const seen = new Set()

  const mappedQueue = queueSongs
    .map((song, index) => ({ song, index, key: `queue-${song?.id ?? song?.song_id ?? song?.track_id ?? index}-${index}` }))

  const mappedExtra = (extraSuggestions.value || [])
    .map((song, i) => ({ song, index: null, key: `extra-${song?.id ?? song?.song_id ?? song?.track_id ?? i}-${i}` }))

  const combined = [...mappedQueue, ...mappedExtra]

  return combined
    .filter((item) => {
      const id = item.song?.id ?? item.song?.song_id ?? item.song?.track_id ?? item.key
      const key = String(id)
      if (seen.has(key)) return false
      seen.add(key)
      return Boolean(item.song)
    })
    .slice(0, 20)
})

function apiMediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'
  return `${baseUrl.replace(/\/api\/?$/, '')}${url}`
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Math.floor(Number(seconds)) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function clearPollTimer() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function resetStemAudio() {
  for (const audio of [vocalsAudio, instrumentalAudio]) {
    audio.pause()
    audio.removeAttribute('src')
    try { audio.load() } catch {}
  }
  stemAudioLoading.value = false
  isSeekingStem.value = false
  stemSeekPosition.value = 0
}

function applyStemVolumes() {
  vocalsAudio.volume = Math.max(0, Math.min(1, Number(vocalVolume.value) / 100))
  instrumentalAudio.volume = Math.max(0, Math.min(1, Number(instVolume.value) / 100))
}

function loadStemAudio(job) {
  if (!job?.vocals_url || !job?.instrumental_url) return
  const nextVocals = apiMediaUrl(job.vocals_url)
  const nextInstrumental = apiMediaUrl(job.instrumental_url)
  if (vocalsAudio.src !== nextVocals) vocalsAudio.src = nextVocals
  if (instrumentalAudio.src !== nextInstrumental) instrumentalAudio.src = nextInstrumental
  applyStemVolumes()
  vocalsAudio.load()
  instrumentalAudio.load()
}

function startPolling(jobId) {
  clearPollTimer()
  if (!jobId) return
  pollTimer = window.setInterval(() => refreshStemJob(jobId), 4000)
}

function handleStemJob(job) {
  stemJob.value = job || null
  stemError.value = job?.error_message || ''
  if (job?.status === 'pending' || job?.status === 'processing') {
    startPolling(job.id)
  } else {
    clearPollTimer()
  }
  if (job?.status === 'completed') loadStemAudio(job)
}

async function refreshLatestStem() {
  clearPollTimer()
  resetStemAudio()
  stemJob.value = null
  stemError.value = ''

  if (!currentSongId.value) return
  stemLoading.value = true
  try {
    const { data } = await stemApi.getLatestForSong(currentSongId.value)
    handleStemJob(data.data)
  } catch (err) {
    stemError.value = err.response?.data?.message || 'Không thể tải trạng thái stem.'
  } finally {
    stemLoading.value = false
  }
}

async function refreshStemJob(jobId) {
  try {
    const { data } = await stemApi.getJob(jobId)
    handleStemJob(data.data)
  } catch (err) {
    clearPollTimer()
    stemError.value = err.response?.data?.message || 'Không thể cập nhật stem job.'
  }
}

async function fetchExtraSuggestions() {
  try {
    const { data } = await songApi.getTrending()
    if (data && data.data) {
      extraSuggestions.value = Array.isArray(data.data) ? data.data : (data.data.songs || [])
    }
  } catch (err) {
    console.warn('Cannot fetch extra suggestions', err)
  }
}

async function requestStemSeparation() {
  if (!currentSongId.value) return
  pauseStemAudio()
  stemLoading.value = true
  stemError.value = ''
  try {
    const { data } = await stemApi.separateSong(currentSongId.value)
    handleStemJob(data.data)
  } catch (err) {
    stemError.value = err.response?.data?.message || 'Không thể tạo stem job.'
  } finally {
    stemLoading.value = false
  }
}

function pauseStemAudio() {
  vocalsAudio.pause()
  instrumentalAudio.pause()
}

function handleStemSeekInput(event) {
  const nextTime = Number(event?.target?.value)
  if (!Number.isFinite(nextTime)) return
  stemSeekPosition.value = nextTime
  isSeekingStem.value = true
}

function handleStemSeekChange(event) {
  const nextTime = Number(event?.target?.value)
  isSeekingStem.value = false
  if (!Number.isFinite(nextTime)) return
  player.seek(nextTime)
}

function openKaraokeFullscreen() {
  if (!player.currentSong) return
  isKaraokeFullscreenOpen.value = true
}

function closeKaraokeFullscreen() {
  isKaraokeFullscreenOpen.value = false
}

function handleKaraokeFullscreenKeydown(event) {
  if (event.key === 'Escape' && isKaraokeFullscreenOpen.value) {
    closeKaraokeFullscreen()
  }
}

function handleKaraokeFullscreenSeek(nextTime) {
  const safeTime = Number(nextTime)
  if (!Number.isFinite(safeTime)) return
  player.seek(safeTime)
}

async function playStemAudio() {
  applyStemVolumes()
  if (Math.abs(vocalsAudio.currentTime - player.currentTime) > 0.5) {
    vocalsAudio.currentTime = player.currentTime
    instrumentalAudio.currentTime = player.currentTime
  }
  try {
    await Promise.all([instrumentalAudio.play(), vocalsAudio.play()])
  } catch {
    pauseStemAudio()
    stemError.value = 'Trình duyệt chưa thể phát stem audio. Vui lòng thử lại.'
  }
}

async function toggleKaraokePlay() {
  await player.togglePlay()
}

async function downloadBeat() {
  if (!isPremium.value) {
    alert('Vui lòng nâng cấp Premium để tải beat nhạc nền.')
    return
  }
  if (!stemJob.value?.id || !isStemCompleted.value) return
  downloadingBeat.value = true
  try {
    const response = await stemApi.downloadInstrumental(stemJob.value.id)
    const blobUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `${player.currentSong?.title || 'instrumental'}-instrumental.mp3`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể tải beat.')
  } finally {
    downloadingBeat.value = false
  }
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
  
  // Nếu khoảng cuộn quá nhỏ (dưới 20px), vô hiệu hóa cả 2 nút
  if (maxScrollLeft < 20) {
    canScrollSuggestionsLeft.value = false
    canScrollSuggestionsRight.value = false
    return
  }

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

function handleGlobalInteraction() {
  isInteractingGlobally.value = true
  if (globalInteractionTimeout) clearTimeout(globalInteractionTimeout)
  globalInteractionTimeout = setTimeout(() => {
    isInteractingGlobally.value = false
  }, 3000)
}

function handleStemWaiting() {
  stemAudioLoading.value = true
}

function handleStemReady() {
  stemAudioLoading.value = false
}

function attachStemAudioEvents() {
  instrumentalAudio.addEventListener('waiting', handleStemWaiting)
  instrumentalAudio.addEventListener('canplay', handleStemReady)
  vocalsAudio.addEventListener('waiting', handleStemWaiting)
  vocalsAudio.addEventListener('canplay', handleStemReady)
}

function detachStemAudioEvents() {
  instrumentalAudio.removeEventListener('waiting', handleStemWaiting)
  instrumentalAudio.removeEventListener('canplay', handleStemReady)
  vocalsAudio.removeEventListener('waiting', handleStemWaiting)
  vocalsAudio.removeEventListener('canplay', handleStemReady)
}

watch(currentSongId, () => {
  refreshLatestStem()
})

watch([vocalVolume, instVolume], applyStemVolumes)

watch(karaokeSuggestions, async () => {
  await nextTick()
  updateSuggestionsScrollState()
})

watch(() => player.isPlaying, (playing) => {
  if (!isStemCompleted.value) return
  if (playing) {
    playStemAudio()
  } else {
    pauseStemAudio()
  }
})

watch(() => player.currentTime, (time) => {
  if (!isStemCompleted.value) return
  if (player.isPlaying) {
    if (Math.abs(vocalsAudio.currentTime - time) > 0.5) {
      vocalsAudio.currentTime = time
      instrumentalAudio.currentTime = time
    }
  } else {
    vocalsAudio.currentTime = time
    instrumentalAudio.currentTime = time
  }
})

watch(isStemCompleted, (completed) => {
  player.setOriginalMuted(completed)
  if (completed && player.isPlaying) {
    playStemAudio()
  } else {
    pauseStemAudio()
  }
})

onMounted(() => {
  attachStemAudioEvents()
  refreshLatestStem()
  fetchExtraSuggestions()
  nextTick(updateSuggestionsScrollState)
  window.addEventListener('resize', updateSuggestionsScrollState)
  window.addEventListener('keydown', handleKaraokeFullscreenKeydown)
  window.addEventListener('wheel', handleGlobalInteraction, { passive: true })
  window.addEventListener('touchstart', handleGlobalInteraction, { passive: true })
  window.addEventListener('scroll', handleGlobalInteraction, { passive: true })
})

onBeforeUnmount(() => {
  if (globalInteractionTimeout) clearTimeout(globalInteractionTimeout)
  player.setOriginalMuted(false)
  clearPollTimer()
  detachStemAudioEvents()
  resetStemAudio()
  window.removeEventListener('resize', updateSuggestionsScrollState)
  window.removeEventListener('keydown', handleKaraokeFullscreenKeydown)
  window.removeEventListener('wheel', handleGlobalInteraction)
  window.removeEventListener('touchstart', handleGlobalInteraction)
  window.removeEventListener('scroll', handleGlobalInteraction)
})
</script>

<style scoped>
.karaoke-view {
  width: 100%;
  min-height: 100%;
  margin: 0 auto;
  padding: 24px 24px 128px;
  color: #ffffff;
}

.karaoke-hero {
  margin-top: -24px;
  margin-left: -24px;
  margin-right: -24px;
  margin-bottom: 32px;
}

.karaoke-hero-glow {
  position: absolute;
  pointer-events: none;
  border-radius: 9999px;
  filter: blur(70px);
  opacity: 0.32;
}

.karaoke-hero-glow-1 {
  width: 280px;
  height: 280px;
  right: 12%;
  top: -80px;
  background: rgba(139, 92, 246, 0.45);
}

.karaoke-hero-glow-2 {
  width: 220px;
  height: 220px;
  right: -40px;
  bottom: -60px;
  background: rgba(34, 211, 238, 0.22);
}

.karaoke-label {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 6px 12px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
}

.karaoke-title {
  color: #ffffff;
  font-weight: 900;
  letter-spacing: -0.06em;
  line-height: 0.95;
  font-size: clamp(2.75rem, 6vw, 5.5rem);
}

.karaoke-subtitle {
  margin-top: 16px;
  color: rgba(255, 255, 255, 0.75);
  font-size: clamp(1rem, 2vw, 1.35rem);
  font-weight: 600;
}

.karaoke-meta {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.95rem;
}

.karaoke-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.karaoke-primary-btn {
  border-radius: 9999px;
  background: #1ed760;
  color: #020617;
  font-weight: 800;
  padding: 12px 22px;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.karaoke-primary-btn:hover {
  background: #1fdf64;
  transform: scale(1.03);
}

.karaoke-secondary-btn {
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-weight: 700;
  padding: 12px 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.karaoke-secondary-btn:hover {
  background: rgba(255, 255, 255, 0.13);
  transform: scale(1.03);
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

.stem-job-status {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  padding: 9px 11px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
  font-weight: 750;
}

.stem-job-status strong {
  margin-left: auto;
  color: #a78bfa;
  font-size: 12px;
}

.status-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.36);
}

.stem-job-status--pending .status-dot,
.stem-job-status--processing .status-dot {
  background: #60a5fa;
  box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.12);
}

.stem-job-status--completed .status-dot {
  background: #34d399;
  box-shadow: 0 0 0 5px rgba(52, 211, 153, 0.12);
}

.stem-job-status--failed .status-dot {
  background: #fb7185;
  box-shadow: 0 0 0 5px rgba(251, 113, 133, 0.12);
}

.btn-separate {
  min-height: 42px;
  border: 1px solid rgba(139, 92, 246, 0.36);
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.14);
  color: #ffffff;
  cursor: pointer;
  font-weight: 850;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.btn-separate:hover:not(:disabled) {
  border-color: rgba(167, 139, 250, 0.58);
  background: rgba(139, 92, 246, 0.22);
}

.btn-separate:disabled {
  cursor: not-allowed;
  opacity: 0.56;
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

.stem-slider:disabled {
  cursor: not-allowed;
  opacity: 0.45;
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
  padding: 0 !important;
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
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 14, 18, 0.88);
  padding: 16px 24px;
}

.karaoke-mini-player {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  min-height: 78px;
}

.seekbar-wrapper {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.karaoke-seekbar {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex: 1;
}

.karaoke-seekbar.is-disabled {
  opacity: 0.62;
}

.karaoke-time {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.karaoke-time:last-child {
  text-align: right;
}

.karaoke-range {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: transparent;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.karaoke-range:disabled {
  cursor: not-allowed;
  filter: grayscale(0.18);
}

.karaoke-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.92), rgba(139, 92, 246, 0.92));
}

.karaoke-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: -3px;
  border: 0;
  background: linear-gradient(135deg, #93c5fd, #8b5cf6);
  box-shadow: 0 0 0 2px rgba(10, 10, 14, 0.96);
}

.karaoke-range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  border: 0;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.92), rgba(139, 92, 246, 0.92));
}

.karaoke-range::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 0;
  background: linear-gradient(135deg, #93c5fd, #8b5cf6);
  box-shadow: 0 0 0 2px rgba(10, 10, 14, 0.96);
}

.song-info {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.song-meta {
  min-width: 0;
}

.song-title {
  margin: 0 0 3px;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  margin: 0;
  overflow: hidden;
  color: rgba(179, 179, 179, 0.86);
  font-size: 12px;
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
  justify-content: center;
  gap: 10px;
}

.action-btn,
.play-btn {
  border: none;
  cursor: pointer;
}

.action-btn {
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.58);
  transition: color 0.18s ease, background-color 0.18s ease;
}

.action-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.06);
}

.action-btn--expand {
  margin-left: 2px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  background: rgba(139, 92, 246, 0.14);
  color: rgba(237, 233, 254, 0.82);
  backdrop-filter: blur(12px);
}

.action-btn--expand:hover {
  border-color: rgba(196, 181, 253, 0.42);
  background: rgba(167, 139, 250, 0.24);
  color: #ffffff;
}

.play-btn {
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #1ED760;
  color: #000000;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  box-shadow: 0 10px 22px rgba(30, 215, 96, 0.24);
}

.play-btn:hover {
  transform: scale(1.04);
  box-shadow: 0 12px 24px rgba(30, 215, 96, 0.35);
  background: #1FDF64;
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

  .karaoke-mini-player {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'info actions'
      'seek seek';
    gap: 12px 14px;
    min-height: 96px;
  }

  .song-info {
    grid-area: info;
  }

  .player-actions {
    grid-area: actions;
  }

  .seekbar-wrapper {
    grid-area: seek;
  }
}

@media (max-width: 640px) {
  .karaoke-view {
    padding: 20px 14px 128px;
  }

  .karaoke-hero {
    margin-top: -20px;
    margin-left: -14px;
    margin-right: -14px;
  }

  .karaoke-title {
    font-size: 42px;
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
    padding: 12px 14px 14px;
  }

  .karaoke-mini-player {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'info actions'
      'seek seek';
    gap: 10px 12px;
    min-height: 98px;
  }

  .song-cover {
    width: 48px;
    height: 48px;
  }

  .song-title {
    font-size: 13px;
  }

  .song-artist {
    font-size: 11px;
  }

  .seekbar-wrapper {
    gap: 10px;
  }

  .karaoke-seekbar {
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    gap: 8px;
  }

  .karaoke-time {
    font-size: 11px;
  }

  .player-actions {
    gap: 8px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
  }

  .play-btn {
    width: 42px;
    height: 42px;
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
