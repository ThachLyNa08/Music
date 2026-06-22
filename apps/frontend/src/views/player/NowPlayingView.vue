<template>
  <Teleport to="body">
    <Transition name="fullscreen-slide" appear>
      <div
        v-if="player.isNowPlayingExpanded"
        class="now-playing-shell"
        :class="{ 'reduced-motion': reducedMotion }"
      >
        <!-- ===== A. BACKGROUND LAYER ===== -->
        <div class="fs-bg-layer">
          <div
            v-if="currentCover"
            class="fs-bg-cover"
            :style="{ backgroundImage: `url(${currentCover})` }"
          />
          <div v-else class="fs-bg-fallback" />
          <div class="fs-bg-overlay" />
        </div>

        <!-- ===== B. TOP BAR ===== -->
        <div class="fs-topbar">
          <button class="fs-btn-icon" @click="closeView" aria-label="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <div class="fs-source-label">
            <span class="fs-source-badge">{{ sourceLabel }}</span>
          </div>

          <button class="fs-btn-icon" aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
            </svg>
          </button>
        </div>

        <!-- ===== C. CENTER CAROUSEL ===== -->
        <div class="fs-carousel-wrap">
          <div class="fs-carousel" :class="[isSliding ? 'is-sliding' : '', 'slide-' + slideDirection]" :style="{ perspective: '1200px' }">
            <div
              v-for="item in carouselTracks"
              :key="'card-' + item.absoluteIndex + '-' + getSongId(item.track)"
              class="fs-card"
              :class="[
                `fs-card--pos-${item.offset}`,
                { 'fs-card--active': item.offset === 0 }
              ]"
              :style="getCardStyle(item.offset)"
            >
              <div class="fs-card-cover-wrap">
                <img
                  v-if="getTrackCover(item.track)"
                  :src="getTrackCover(item.track)"
                  :alt="getTrackTitle(item.track)"
                  class="fs-card-cover"
                  loading="lazy"
                  @error="e => e.target.style.display = 'none'"
                />
                <div v-else class="fs-card-cover fs-card-cover--fallback">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
              </div>

              <!-- Caption glass chỉ hiện trên card active -->
              <div v-if="item.offset === 0" class="fs-card-caption">
                <h2
                  class="fs-card-title cursor-pointer hover:underline"
                  title="Xem chi tiết bài hát"
                  @click.stop="goToSong"
                >{{ getTrackTitle(item.track) }}</h2>
                <p
                  class="fs-card-artist cursor-pointer hover:underline"
                  title="Xem nghệ sĩ"
                  @click.stop="goToArtist"
                >{{ getTrackArtist(item.track) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== D. BOTTOM CONTROL DOCK ===== -->
        <div class="fs-dock-wrap">
          <div class="fs-dock">
            <!-- Left: Info & Like -->
            <div class="fs-dock-left">
              <div class="flex items-center gap-3 overflow-hidden mr-1 flex-1">
                <img
                  v-if="currentCover"
                  :src="currentCover"
                  class="w-10 h-10 rounded-md object-cover flex-shrink-0 shadow-sm"
                  alt="cover"
                  @error="e => e.target.style.display = 'none'"
                />
                <div v-else class="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0 text-white/30 shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-[13px] font-bold text-white truncate cursor-pointer hover:underline"
                    title="Xem chi tiết bài hát"
                    @click.stop="goToSong"
                  >{{ getTrackTitle(currentSong) }}</span>
                  <span
                    class="text-[11px] font-medium text-white/60 truncate mt-0.5 cursor-pointer hover:underline"
                    title="Xem nghệ sĩ"
                    @click.stop="goToArtist"
                  >{{ getTrackArtist(currentSong) }}</span>
                </div>
              </div>

              <button
                class="fs-dock-btn fs-dock-btn--like flex-shrink-0"
                :class="{ liked: isCurrentLiked }"
                @click="toggleLike"
                aria-label="Like"
              >
                <svg viewBox="0 0 24 24" :fill="isCurrentLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </button>
            </div>

            <!-- Center: Transport + Progress -->
            <div class="fs-dock-center">
              <div class="fs-transport">
                <button class="fs-dock-btn fs-dock-btn--lg" @click="playPrev" aria-label="Previous">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>

                <button
                  class="fs-dock-btn fs-dock-btn--xl"
                  @click="player.togglePlay()"
                  :aria-label="player.isPlaying ? 'Pause' : 'Play'"
                >
                  <svg v-if="player.isPlaying" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>

                <button class="fs-dock-btn fs-dock-btn--lg" @click="playNext" aria-label="Next">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
              </div>

              <!-- Progress bar -->
              <div class="fs-progress-wrap">
                <span class="fs-progress-time">{{ formatTime(displayCurrentTime) }}</span>
                <div
                  class="fs-progress-track"
                  @click="seekFromClick"
                  @mousedown="startDrag"
                  @touchstart="startDrag"
                  ref="progressTrack"
                >
                  <div class="fs-progress-fill" :style="{ width: progressPercent + '%' }" />
                  <div class="fs-progress-thumb" :style="{ left: progressPercent + '%' }" />
                </div>
                <span class="fs-progress-time">{{ formatTime(player.duration) }}</span>
              </div>
            </div>

            <!-- Right: Extra controls -->
            <div class="fs-dock-right">
              <div class="fs-volume-wrap">
                <button class="fs-dock-btn" @click="toggleMute" aria-label="Volume">
                  <svg v-if="player.volume > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                </button>
                <div 
                  class="fs-volume-slider" 
                  @click="setVolumeFromClick" 
                  @mousedown="startVolumeDrag" 
                  @touchstart="startVolumeDrag" 
                  ref="volumeTrack"
                >
                  <div class="fs-volume-fill" :style="{ width: volumePercent + '%' }" />
                  <div class="fs-volume-thumb" :style="{ left: volumePercent + '%' }" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { normalizeImageUrl } from '@/utils/imageUrl'

const player = usePlayerStore()
const library = useLibraryStore()
const router = useRouter()

/* ============ REDUCED MOTION ============ */
const reducedMotion = ref(false)
onMounted(() => {
  reducedMotion.value = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
})

/* ============ KEYBOARD ============ */
function onKey(e) {
  if (!player.isNowPlayingExpanded) return
  if (e.code === 'Space') {
    e.preventDefault()
    player.togglePlay()
  } else if (e.code === 'ArrowRight') {
    player.next()
  } else if (e.code === 'ArrowLeft') {
    player.prev()
  } else if (e.code === 'Escape') {
    closeView()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

/* ============ VISIBLE BODY LOCK ============ */
watch(() => player.isNowPlayingExpanded, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

/* ============ SOURCE LABEL ============ */
const sourceLabel = computed(() => {
  const ctx = player.playbackContext?.value || {}
  const src = player.playbackSource?.value || ctx?.source || 'unknown'
  if (src === 'album') return 'ĐANG PHÁT TỪ ALBUM'
  if (src === 'playlist') return 'ĐANG PHÁT TỪ PLAYLIST'
  return 'ĐANG PHÁT TỪ SINGLE'
})

/* ============ DATA NORMALIZATION ============ */
function getTrackCover(track) {
  if (!track) return null
  const url = track.cover_url || track.cover || track.coverUrl || track.thumbnail || track.image_url
  return url ? normalizeImageUrl(url) : null
}

function getTrackTitle(track) {
  return track?.title || track?.name || 'Unknown Title'
}

function getTrackArtist(track) {
  return track?.artist_name || track?.artist || track?.artistName || 'Unknown Artist'
}

/* ============ COVER URL ============ */
const currentSong = computed(() => player.currentSong)
const currentCover = computed(() => {
  return getTrackCover(currentSong.value)
})

/* ============ LIKED STATE ============ */
const isCurrentLiked = computed(() => {
  if (!currentSong.value) return false
  return library.isLiked(currentSong.value)
})

function toggleLike() {
  if (!currentSong.value) return
  library.toggleLike(currentSong.value)
}

/* ============ CAROUSEL LOGIC ============ */
const MAX_CAROUSEL = 5

const slideDirection = ref('none')
const isSliding = ref(false)

let slideTimer = null
watch(() => player.queueIndex, (newVal, oldVal) => {
  if (newVal === oldVal + 1 || (oldVal === player.queue.length - 1 && newVal === 0)) {
    slideDirection.value = 'next'
  } else if (newVal === oldVal - 1 || (oldVal === 0 && newVal === player.queue.length - 1)) {
    slideDirection.value = 'prev'
  } else {
    slideDirection.value = 'next'
  }
  
  isSliding.value = true
  if (slideTimer) clearTimeout(slideTimer)
  slideTimer = setTimeout(() => {
    isSliding.value = false
    slideDirection.value = 'none'
  }, 600)
})

const carouselTracks = computed(() => {
  const q = player.queue || []
  const idx = player.queueIndex || 0
  const current = currentSong.value

  if (!q.length) {
    return current ? [{ track: current, offset: 0, absoluteIndex: -1 }] : []
  }

  const result = []
  for (let offset = -2; offset <= 2; offset++) {
    const i = idx + offset
    if (i >= 0 && i < q.length) {
      result.push({ track: q[i], offset, absoluteIndex: i })
    }
  }
  return result
})

function getCardStyle(offset) {
  const absOffset = Math.abs(offset)

  let translateX = 0
  let translateZ = 0
  let scale = 1
  let opacity = 1
  let zIndex = 10 - absOffset
  let filter = 'blur(0px)'

  if (offset === 0) {
    translateX = 0
    translateZ = 80
    scale = 1
    opacity = 1
    zIndex = 10
  } else if (offset === -1) {
    translateX = -180
    translateZ = -40
    scale = 0.8
    opacity = 0.5
    zIndex = 5
  } else if (offset === 1) {
    translateX = 180
    translateZ = -40
    scale = 0.8
    opacity = 0.5
    zIndex = 5
  } else if (offset === -2) {
    translateX = -300
    translateZ = -100
    scale = 0.65
    opacity = 0.25
    zIndex = 2
    filter = 'blur(2px)'
  } else if (offset === 2) {
    translateX = 300
    translateZ = -100
    scale = 0.65
    opacity = 0.25
    zIndex = 2
    filter = 'blur(2px)'
  }

  return {
    transform: `translateX(${translateX}px) translateZ(${translateZ}px) scale(${scale})`,
    opacity,
    zIndex,
    filter,
    transition: reducedMotion.value ? 'none' : 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease, filter 0.45s ease'
  }
}

/* ============ PROGRESS / SEEK ============ */
const progressTrack = ref(null)
const progressPercent = computed(() => {
  if (!player.duration || isNaN(player.duration)) return 0
  return Math.min(100, (player.currentTime / player.duration) * 100)
})

const displayCurrentTime = computed(() => player.currentTime)

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function seekFromClick(e) {
  if (!progressTrack.value || !player.duration || isNaN(player.duration)) return
  const rect = progressTrack.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(ratio * player.duration)
}

let dragging = false
function startDrag(e) {
  dragging = true
  const move = (ev) => {
    if (!dragging || !progressTrack.value || !player.duration || isNaN(player.duration)) return
    const rect = progressTrack.value.getBoundingClientRect()
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    player.seek(ratio * player.duration)
  }
  const end = () => {
    dragging = false
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', end)
    window.removeEventListener('touchmove', move)
    window.removeEventListener('touchend', end)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', end)
  window.addEventListener('touchmove', move, { passive: true })
  window.addEventListener('touchend', end)
}

/* ============ VOLUME ============ */
const volumeTrack = ref(null)
const volumePercent = computed(() => Math.max(0, Math.min(100, player.volume * 100)))

function setVolumeFromClick(e) {
  if (!volumeTrack.value) return
  const rect = volumeTrack.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.setVolume(ratio)
}

let volumeDragging = false
function startVolumeDrag(e) {
  volumeDragging = true
  const move = (ev) => {
    if (!volumeDragging || !volumeTrack.value) return
    const rect = volumeTrack.value.getBoundingClientRect()
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    player.setVolume(ratio)
  }
  const end = () => {
    volumeDragging = false
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', end)
    window.removeEventListener('touchmove', move)
    window.removeEventListener('touchend', end)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', end)
  window.addEventListener('touchmove', move, { passive: true })
  window.addEventListener('touchend', end)
  
  move(e)
}

function toggleMute() {
  player.setVolume(player.volume > 0 ? 0 : 0.8)
}

/* ============ CONTROLS ============ */
function playNext() {
  player.next()
}

function playPrev() {
  player.prev()
}

function closeView() {
  player.isNowPlayingExpanded = false
}

function getSongId(song) {
  if (!song) return null
  return song.id ?? song.song_id ?? song.track_id ?? null
}

function goToSong() {
  const id = getSongId(currentSong.value)
  if (!id) return
  closeView()
  router.push(`/song/${id}`)
}

function goToArtist() {
  const artistId = currentSong.value?.artist_id || currentSong.value?.artist?.id
  if (!artistId) return
  closeView()
  router.push(`/artist/${artistId}`)
}
</script>

<style scoped>
/* ============================================
   NOW PLAYING — CINEMATIC CAROUSEL
   MusicFlow Dark | Accent #1ED760
   ============================================ */

.now-playing-shell {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  background: #07080a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ---------- A. BACKGROUND ---------- */
.fs-bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.fs-bg-cover {
  position: absolute;
  inset: -60px;
  background-size: cover;
  background-position: center;
  filter: blur(60px) saturate(1.3);
  transform: scale(1.15);
  opacity: 0.4;
  transition: background-image 0.8s ease;
}

.fs-bg-fallback {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 20%, rgba(30, 215, 96, 0.15), transparent 60%),
              radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.1), transparent 60%),
              #07080a;
}

.fs-bg-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg,
      rgba(7, 12, 18, 0.82) 0%,
      rgba(10, 14, 20, 0.55) 40%,
      rgba(8, 8, 10, 0.92) 100%
    );
}

/* ---------- B. TOP BAR ---------- */
.fs-topbar {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.fs-topbar > * {
  pointer-events: auto;
}

.fs-btn-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.15); /* Nền tối nhẹ nhàng, tinh tế hơn */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: rgba(255, 255, 255, 0.75); /* Trắng dịu hơn */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.fs-btn-icon svg {
  width: 22px;
  height: 22px;
}

.fs-btn-icon:hover {
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  transform: scale(1.05);
}

.fs-btn-icon:active {
  transform: scale(0.96);
  background: rgba(0, 0, 0, 0.5);
}

.fs-source-label {
  text-align: center;
}

.fs-source-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  padding: 6px 14px;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* ---------- C. CAROUSEL ---------- */
.fs-carousel-wrap {
  position: relative;
  z-index: 5;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20px 0;
}

.fs-carousel {
  position: relative;
  width: 100%;
  max-width: 900px;
  height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
}

.fs-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  will-change: transform, opacity;
}

.fs-card-cover-wrap {
  width: 340px;
  height: 340px;
  border-radius: 26px;
  overflow: hidden;
  box-shadow: 0 15px 45px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
}

.fs-card--active .fs-card-cover-wrap {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.fs-card--active .fs-card-cover-wrap:hover {
  transform: translateY(-4px);
  box-shadow: 0 25px 75px rgba(0, 0, 0, 0.5), 0 0 40px rgba(30, 215, 96, 0.08);
}

.fs-card-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fs-card-cover--fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.25);
}

/* Caption glass */
.fs-card-caption {
  margin-top: 16px;
  padding: 12px 18px;
  background: rgba(20, 20, 20, 0.35);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 300px;
}

.fs-card-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs-card-artist {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- D. BOTTOM DOCK ---------- */
.fs-dock-wrap {
  position: relative;
  z-index: 10;
  width: 100%;
  padding: 0 24px 32px;
  display: flex;
  justify-content: center;
}

.fs-dock {
  width: min(920px, calc(100vw - 32px));
  min-height: 84px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Dock sections */
.fs-dock-left,
.fs-dock-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  width: 220px; /* Cố định width 2 bên để căn giữa hoàn hảo cho fs-dock-center */
}

.fs-dock-left {
  justify-content: flex-start;
}

.fs-dock-right {
  justify-content: flex-end;
}

.fs-dock-center {
  flex: 1;
  min-width: 0;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 8px; /* Khoảng cách giữa nút Play và Progress Bar */
  align-items: center;
  justify-content: center;
}

/* Dock buttons */
.fs-dock-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.fs-dock-btn svg {
  width: 20px;
  height: 20px;
}

.fs-dock-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  transform: scale(1.08);
}

.fs-dock-btn:active {
  transform: scale(0.95);
}

.fs-dock-btn.active {
  color: #1ED760;
}

.fs-dock-btn--lg {
  width: 42px;
  height: 42px;
}

.fs-dock-btn--xl {
  width: 56px;
  height: 56px;
  background: #fff;
  color: #000;
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15);
}

.fs-dock-btn--xl svg {
  width: 26px;
  height: 26px;
}

.fs-dock-btn--xl:hover {
  background: #1ED760;
  color: #000;
  box-shadow: 0 6px 24px rgba(30, 215, 96, 0.3);
}

.fs-dock-btn--like.liked {
  color: #1ED760;
}

/* Transport Controls */
.fs-transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

/* Progress */
.fs-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.fs-progress-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 32px;
}

.fs-progress-track {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  overflow: visible;
}

.fs-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1ED760, #3b82f6);
  border-radius: 2px;
  transition: width 0.1s linear;
  position: relative;
}

.fs-progress-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
  pointer-events: none;
}

.fs-progress-track:hover .fs-progress-thumb {
  transform: translate(-50%, -50%) scale(1);
}

/* Volume */
.fs-volume-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

.fs-volume-slider {
  width: 110px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.fs-volume-fill {
  height: 100%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.15s ease, background-color 0.2s ease;
}

.fs-volume-slider:hover .fs-volume-fill {
  background: #1ED760;
}

.fs-volume-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
  pointer-events: none;
}

.fs-volume-slider:hover .fs-volume-thumb {
  transform: translate(-50%, -50%) scale(1);
}

/* ---------- TRANSITIONS ---------- */
.fullscreen-slide-enter-active,
.fullscreen-slide-leave-active {
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1), 
              opacity 320ms ease, 
              filter 420ms ease, 
              border-radius 420ms ease;
  will-change: transform, opacity, filter, border-radius;
}

.fullscreen-slide-enter-from,
.fullscreen-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
  filter: blur(8px);
  border-radius: 28px 28px 0 0;
}

/* ---------- REDUCED MOTION ---------- */
.reduced-motion.fullscreen-slide-enter-active,
.reduced-motion.fullscreen-slide-leave-active {
  transition: none !important;
}

.reduced-motion .fs-card {
  transition: none !important;
}
.reduced-motion .fs-bg-cover {
  transition: none !important;
}
.reduced-motion .fs-dock {
  transition: none !important;
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 1024px) {
  .fs-card-cover-wrap {
    width: 280px;
    height: 280px;
  }
}

@media (max-width: 768px) {
  .fs-carousel {
    height: 380px;
  }

  .fs-card-cover-wrap {
    width: 240px;
    height: 240px;
    border-radius: 22px;
  }

  .fs-card-title {
    font-size: 1.1rem;
  }

  .fs-card-artist {
    font-size: 0.85rem;
  }

  .fs-dock {
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 24px;
  }

  .fs-dock-left,
  .fs-dock-right {
    gap: 4px;
  }

  .fs-dock-center {
    order: -1;
    width: 100%;
  }

  .fs-now-mini {
    max-width: 100%;
  }

  .fs-progress-wrap {
    max-width: 100%;
  }

  .fs-volume-slider {
    width: 60px;
  }

  .fs-topbar {
    padding: 16px 16px 0;
  }

  .fs-dock-wrap {
    padding: 0 16px 24px;
  }
}

@media (max-width: 640px) {
  .fs-card:not(.fs-card--active) {
    display: none;
  }
  
  .fs-volume-wrap {
    display: none;
  }
  
  .fs-dock {
    padding: 12px 14px;
    border-radius: 24px;
  }
  
  .fs-dock-left {
    order: 2;
    width: 100%;
    justify-content: center;
    gap: 12px;
  }
  
  .fs-dock-center {
    order: 1;
    width: 100%;
  }
  
  .fs-dock-right {
    order: 3;
  }
  
  .fs-dock-btn--xl {
    width: 48px;
    height: 48px;
  }
  
  .fs-dock-btn--xl svg {
    width: 24px;
    height: 24px;
  }
}

@media (max-width: 480px) {
  .fs-carousel {
    height: 320px;
  }

  .fs-card-cover-wrap {
    width: 220px;
    height: 220px;
    border-radius: 18px;
  }

  .fs-card-caption {
    padding: 10px 18px;
    margin-top: 14px;
  }
}
</style>
