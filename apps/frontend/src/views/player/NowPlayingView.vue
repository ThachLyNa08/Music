<template>
  <Teleport to="body">
    <Transition name="now-playing-slide" appear>
      <div
        v-if="player.isNowPlayingExpanded"
        class="now-playing-shell fixed inset-0 z-[99999] flex h-[100dvh] flex-col overflow-hidden bg-[#071018] text-white"
      >
        <div class="ambient-cover" :style="{ backgroundImage: `url(${getCoverUrl(currentSong)})` }"></div>
        <div class="ambient-glow"></div>

        <div class="relative z-10 flex shrink-0 items-center justify-between px-5 py-5 sm:px-7">
          <button class="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 transition-colors" @click="closeView">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-8 w-8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div class="min-w-0 px-4 text-center text-xs font-bold uppercase tracking-widest text-gray-300">
            Đang phát từ <span class="text-white">{{ currentSong?.album_title || 'Thư viện' }}</span>
          </div>
          <button class="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6">
              <path d="M4.5 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
          </button>
        </div>

        <div class="relative z-10 mx-auto flex min-h-0 w-full max-w-screen-md flex-1 flex-col px-6 pb-6 sm:px-8">
          <TransitionGroup
            :name="slideDirection === 'next' ? 'slide-left' : 'slide-right'"
            tag="div"
            class="relative mb-5 min-h-0 w-full flex-1"
          >
            <div v-for="song in [currentSong]" :key="song?.id || 'none'" class="absolute inset-0 flex flex-col">
              <div class="flex min-h-0 flex-1 items-center justify-center px-5 sm:px-10">
                <img
                  :src="getCoverUrl(song)"
                  alt="Cover"
                  class="aspect-square h-full max-h-[43vh] w-auto rounded-xl object-cover shadow-[0_22px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
                  @error="e => e.target.src = '/default-cover.png'"
                />
              </div>

              <div class="mt-7 flex h-20 shrink-0 items-end justify-between gap-4 px-2">
                <div class="min-w-0">
                  <h1 class="truncate text-2xl font-bold text-white sm:text-3xl">{{ song?.title || 'Chưa có bài hát' }}</h1>
                  <p class="mt-1 truncate text-base font-medium text-gray-400 sm:text-lg">{{ song?.artist_name || song?.artist || 'Nghệ sĩ' }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <button
                    class="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-bold text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    title="Mở Karaoke AI"
                    aria-label="Mở Karaoke AI"
                    @click="openKaraoke"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
                    </svg>
                    <span class="hidden sm:inline">Karaoke</span>
                  </button>
                  <button
                    v-if="song"
                    class="flex h-12 w-12 items-center justify-center transition-colors hover:scale-105"
                    :class="{ 'text-pink-500': library.isLiked(song), 'text-gray-400 hover:text-white': !library.isLiked(song) }"
                    @click="library.toggleLike(song)"
                  >
                    <svg v-if="!library.isLiked(song)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-8 w-8">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-8 w-8">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </TransitionGroup>

          <div class="mb-5 shrink-0 px-2">
            <div class="relative mb-2 flex h-1.5 cursor-pointer items-center rounded-full bg-gray-600/50 group" @click="seek">
              <div class="absolute left-0 h-full rounded-full bg-white transition-colors group-hover:bg-green-500" :style="`width:${pct}%`">
                <div class="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"></div>
              </div>
            </div>
            <div class="flex justify-between text-xs font-medium text-gray-400">
              <span>{{ formatTime(player.currentTime) }}</span>
              <span>{{ formatTime(player.duration) }}</span>
            </div>
          </div>

          <div class="mb-4 flex shrink-0 items-center justify-between px-2">
            <button class="flex h-12 w-12 items-center justify-center transition-colors" :class="player.shuffle ? 'text-green-500' : 'text-gray-400 hover:text-white'" @click="player.toggleShuffle()">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
            </button>

            <button class="flex h-12 w-12 items-center justify-center text-gray-200 transition-colors hover:text-white" @click="playPrev">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-10 w-10">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            <button class="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105" @click="player.togglePlay()">
              <svg v-if="!player.isPlaying" viewBox="0 0 24 24" fill="currentColor" class="ml-1 h-10 w-10">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-10 w-10">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>

            <button class="flex h-12 w-12 items-center justify-center text-gray-200 transition-colors hover:text-white" @click="playNext">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-10 w-10">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            <button class="flex h-12 w-12 items-center justify-center transition-colors" :class="player.repeat !== 'none' ? 'text-green-500' : 'text-gray-400 hover:text-white'" @click="player.toggleRepeat()">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
              </svg>
            </button>
          </div>

          <div class="mt-1 flex shrink-0 items-center justify-end gap-2 px-2 pb-2">
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5 text-gray-400">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <div class="relative flex h-1.5 w-32 cursor-pointer items-center rounded-full bg-gray-600/50 group">
              <input type="range" min="0" max="100" :value="player.volume * 100" @input="player.setVolume($event.target.value / 100)" class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
              <div class="absolute left-0 h-full rounded-full bg-white transition-colors group-hover:bg-green-500" :style="`width:${player.volume * 100}%`"></div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { normalizeImageUrl } from '@/utils/imageUrl'

const player = usePlayerStore()
const library = useLibraryStore()
const router = useRouter()

const slideDirection = ref('next')

const currentSong = computed(() => player.currentSong)
const pct = computed(() => player.duration ? (player.currentTime / player.duration) * 100 : 0)

function getCoverUrl(songItem) {
  return normalizeImageUrl(songItem?.cover_url || songItem?.cover || '/default-cover.png')
}

function formatTime(s) {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function seek(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  player.seek(((e.clientX - rect.left) / rect.width) * player.duration)
}

function playNext() {
  slideDirection.value = 'next'
  player.next()
}

function playPrev() {
  slideDirection.value = 'prev'
  player.prev()
}

function closeView() {
  player.isNowPlayingExpanded = false
}

function openKaraoke() {
  player.isNowPlayingExpanded = false
  router.push('/karaoke')
}
</script>

<style scoped>
.now-playing-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(24, 42, 58, 0.76), rgba(0, 0, 0, 0.95));
  pointer-events: none;
}

.ambient-cover {
  position: absolute;
  inset: -10%;
  background-position: center;
  background-size: cover;
  filter: blur(72px) saturate(1.15);
  opacity: 0.14;
  transform: scale(1.04);
}

.ambient-glow {
  position: absolute;
  left: 50%;
  top: 18%;
  width: min(520px, 72vw);
  height: min(520px, 72vw);
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.2), transparent 64%);
  filter: blur(80px);
  opacity: 0.45;
  transform: translateX(-50%);
  pointer-events: none;
}

.now-playing-slide-enter-active,
.now-playing-slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.4s ease;
}

.now-playing-slide-enter-from,
.now-playing-slide-leave-to {
  transform: translateY(100%);
  opacity: 0.5;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30%);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30%);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30%);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(30%);
}

@media (prefers-reduced-motion: reduce) {
  .now-playing-slide-enter-active,
  .now-playing-slide-leave-active,
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active {
    transition: none;
  }
}
</style>
