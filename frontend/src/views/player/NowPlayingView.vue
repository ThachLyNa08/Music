<template>
  <Teleport to="body">
    <Transition name="now-playing-slide" appear>
      <div v-if="player.isNowPlayingExpanded" class="fixed inset-0 z-[99999] flex flex-col bg-gradient-to-b from-[#182a3a] to-black text-white overflow-hidden h-[100dvh]">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-6 py-6 shrink-0">
        <button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" @click="closeView">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div class="text-xs font-bold tracking-widest uppercase text-gray-300">
          Đang phát từ <span class="text-white">{{ currentSong?.album_title || 'Thư viện' }}</span>
        </div>
        <button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path d="M4.5 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
          </svg>
        </button>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col px-6 sm:px-8 pb-8 max-w-screen-md mx-auto w-full min-h-0">
        
        <!-- Track Content Wrapper (Animated) -->
        <TransitionGroup 
          :name="slideDirection === 'next' ? 'slide-left' : 'slide-right'"
          tag="div"
          class="relative flex-1 min-h-0 w-full mb-6"
        >
          <div v-for="song in [currentSong]" :key="song?.id || 'none'" class="absolute inset-0 flex flex-col">
            <!-- Cover Art -->
            <div class="flex-1 min-h-0 flex items-center justify-center w-full px-4 sm:px-10">
              <img 
                :src="getCoverUrl(song)" 
                alt="Cover" 
                class="h-full max-h-[45vh] w-auto aspect-square object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-500"
                @error="e => e.target.src = '/default-cover.png'"
              />
            </div>

            <!-- Song Info & Like Button -->
            <div class="flex items-end justify-between mt-8 shrink-0 px-2 h-20">
              <div class="flex flex-col overflow-hidden mr-4">
                <h1 class="text-2xl sm:text-3xl font-bold text-white truncate">{{ song?.title || 'Chưa có bài hát' }}</h1>
                <p class="text-base sm:text-lg text-gray-400 font-medium truncate mt-1">{{ song?.artist_name || song?.artist || 'Nghệ sĩ' }}</p>
              </div>
              <button 
                v-if="song"
                class="w-12 h-12 flex items-center justify-center shrink-0 transition-colors hover:scale-105"
                :class="{ 'text-pink-500': library.isLiked(song), 'text-gray-400 hover:text-white': !library.isLiked(song) }"
                @click="library.toggleLike(song)"
              >
                <svg v-if="!library.isLiked(song)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-8 h-8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
            </div>
          </div>
        </TransitionGroup>

        <!-- Progress Bar -->
        <div class="shrink-0 mb-6 px-2">
          <div class="h-1.5 bg-gray-600/50 rounded-full cursor-pointer relative group flex items-center mb-2" @click="seek">
            <div class="absolute left-0 h-full bg-white rounded-full group-hover:bg-green-500 transition-colors" :style="`width:${pct}%`">
              <div class="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
          <div class="flex justify-between text-xs font-medium text-gray-400">
            <span>{{ formatTime(player.currentTime) }}</span>
            <span>{{ formatTime(player.duration) }}</span>
          </div>
        </div>

        <!-- Player Controls -->
        <div class="shrink-0 flex items-center justify-between px-2 mb-4">
          <!-- Shuffle -->
          <button class="w-12 h-12 flex items-center justify-center transition-colors" :class="player.shuffle ? 'text-green-500' : 'text-gray-400 hover:text-white'" @click="player.toggleShuffle()">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </button>

          <!-- Prev -->
          <button class="w-12 h-12 flex items-center justify-center text-gray-200 hover:text-white transition-colors" @click="playPrev">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <!-- Play/Pause -->
          <button class="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform" @click="player.togglePlay()">
            <svg v-if="!player.isPlaying" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 ml-1">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>

          <!-- Next -->
          <button class="w-12 h-12 flex items-center justify-center text-gray-200 hover:text-white transition-colors" @click="playNext">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>

          <!-- Repeat -->
          <button class="w-12 h-12 flex items-center justify-center transition-colors" :class="player.repeat !== 'none' ? 'text-green-500' : 'text-gray-400 hover:text-white'" @click="player.toggleRepeat()">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
          </button>
        </div>

        <!-- Extra Controls (Volume) -->
        <div class="shrink-0 flex items-center justify-end gap-2 px-2 pb-2 mt-2">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <div class="w-32 h-1.5 bg-gray-600/50 rounded-full relative cursor-pointer group flex items-center">
            <input type="range" min="0" max="100" :value="player.volume * 100" @input="player.setVolume($event.target.value / 100)" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div class="absolute left-0 h-full bg-white rounded-full group-hover:bg-green-500 transition-colors" :style="`width:${player.volume * 100}%`"></div>
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
const player = usePlayerStore()
const library = useLibraryStore()

const slideDirection = ref('next')

const currentSong = computed(() => player.currentSong)

const pct = computed(() => player.duration ? (player.currentTime / player.duration) * 100 : 0)

function getCoverUrl(songItem) {
  if (songItem?.cover_url) {
    if (songItem.cover_url.startsWith('http')) return songItem.cover_url;
  }
  if (songItem?.cover) {
    if (songItem.cover.startsWith('http')) return songItem.cover;
  }
  return '/default-cover.png'
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
</script>

<style scoped>
/* Slide transition */
.now-playing-slide-enter-active,
.now-playing-slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.4s ease;
}

.now-playing-slide-enter-from,
.now-playing-slide-leave-to {
  transform: translateY(100%);
  opacity: 0.5;
}

/* Horizontal slide transition for songs */
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
</style>
