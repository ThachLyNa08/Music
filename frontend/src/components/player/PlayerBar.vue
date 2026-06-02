<template>
  <div class="h-20 flex items-center px-4 gap-4 border-t flex-shrink-0"
       :class="isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'">

    <!-- Bài hát đang phát -->
    <div class="flex items-center gap-3 w-56 min-w-0">
      <div class="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
           :class="[isDark ? 'bg-dark-surface' : 'bg-light-card', currentSong ? 'cursor-pointer hover:opacity-80 transition' : '']"
           @click="currentSong && $router.push(`/song/${currentSong.id}`)">
        <svg v-if="!currentSong" class="w-6 h-6" :class="isDark ? 'text-gray-600' : 'text-gray-300'"
             fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <img v-else :src="$formatImageUrl(currentSong.cover_url)" @error="event => event.target.src = '/default-cover.png'" class="w-full h-full object-cover rounded-lg" />
      </div>
      <div class="min-w-0">
        <p class="text-sm font-medium truncate"
           :class="currentSong ? 'cursor-pointer hover:underline hover:text-primary transition-colors' : ''"
           @click="currentSong && $router.push(`/song/${currentSong.id}`)">
          {{ currentSong?.title || 'Chưa phát bài nào' }}
        </p>
        <p class="text-xs truncate" 
           :class="[isDark ? 'text-gray-400' : 'text-gray-500', currentSong?.artist_id ? 'cursor-pointer hover:underline hover:text-primary transition-colors' : '']"
           @click="currentSong?.artist_id && $router.push(`/artist/${currentSong.artist_id}`)">
          {{ currentSong?.artist_name || '—' }}
        </p>
      </div>
      <!-- Like button -->
      <LikeButton v-if="currentSong" 
        :song="currentSong"
        baseClass="flex-shrink-0 transition-colors"
        activeClass="text-primary"
        :inactiveClass="isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'"
      >
        <template #icon="{ isLiked }">
          <svg class="w-4 h-4" :fill="isLiked ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </template>
      </LikeButton>
    </div>

    <!-- Controls giữa -->
    <div class="flex-1 flex flex-col items-center gap-1.5 max-w-lg mx-auto">
      <!-- Buttons -->
      <div class="flex items-center gap-4">
        <!-- Shuffle -->
        <button @click="player.toggleShuffle()"
          class="transition-colors" :class="player.shuffle ? 'text-primary' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
          </svg>
        </button>
        <!-- Prev -->
        <button @click="player.prev()" class="transition-colors" :class="isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <!-- Play/Pause -->
        <button @click="player.togglePlay()"
          class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-all hover:scale-105">
          <svg v-if="!player.isPlaying" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>
        <!-- Next -->
        <button @click="player.next()" class="transition-colors" :class="isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
        <!-- Repeat -->
        <button @click="player.toggleRepeat()"
          class="transition-colors" :class="player.repeat !== 'none' ? 'text-primary' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        </button>
      </div>
      <!-- Progress bar -->
      <div class="flex items-center gap-2 w-full">
        <span class="text-xs w-8 text-right" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
          {{ formatTime(player.currentTime) }}
        </span>
        <div class="flex-1 h-1 rounded-full cursor-pointer group relative"
             :class="isDark ? 'bg-dark-border' : 'bg-light-border'"
             @click="seekTo($event)">
          <div class="h-full rounded-full bg-primary transition-all relative"
               :style="`width: ${progressPercent}%`">
            <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white
                        opacity-0 group-hover:opacity-100 transition-all shadow-md" />
          </div>
        </div>
        <span class="text-xs w-8" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
          {{ formatTime(player.duration) }}
        </span>
      </div>
    </div>

    <!-- Volume -->
    <div class="flex items-center gap-2 w-36 justify-end">
      <svg class="w-4 h-4 flex-shrink-0" :class="isDark ? 'text-gray-400' : 'text-gray-500'"
           fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      </svg>
      <input type="range" min="0" max="100" :value="player.volume * 100"
        @input="player.setVolume($event.target.value / 100)"
        class="flex-1 h-1 appearance-none rounded-full cursor-pointer accent-primary"
        :class="isDark ? 'bg-dark-border' : 'bg-light-border'" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useThemeStore }  from '@/stores/theme'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import LikeButton from '@/components/common/LikeButton.vue'

const theme  = useThemeStore()
const player = usePlayerStore()
const library = useLibraryStore()
const isDark = computed(() => theme.isDark)

const currentSong = computed(() => player.currentSong)
const isLiked     = computed(() => library.isLiked(currentSong.value))

const progressPercent = computed(() => {
  if (!player.duration) return 0
  return (player.currentTime / player.duration) * 100
})

function formatTime(sec) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function seekTo(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  player.seek(ratio * player.duration)
}


</script>
