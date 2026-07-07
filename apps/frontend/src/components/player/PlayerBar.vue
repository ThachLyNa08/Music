<template>
  <div class="h-14 flex items-center px-4 gap-4 border-t flex-shrink-0"
       :class="isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'">

    <!-- Bài hát đang phát -->
    <div class="flex items-center gap-3 w-56 min-w-0">
      <div class="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
           :class="[isDark ? 'bg-dark-surface' : 'bg-light-card', currentSong ? 'cursor-pointer hover:opacity-80 transition' : '']"
           @click="currentSong && $router.push(`/song/${currentSong.id}`)">
        <MfIcon v-if="!currentSong" name="music_note" :className="isDark ? 'text-gray-600' : 'text-gray-300'" size="24" />
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
          :title="player.shuffle ? 'Tắt phát ngẫu nhiên' : 'Bật phát ngẫu nhiên'"
          class="transition-colors" :class="player.shuffle ? 'text-[#1ed760] hover:text-[#1fdf64]' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
          <MfIcon name="shuffle" size="18" />
        </button>
        <!-- Prev -->
        <button @click="player.prev()" class="transition-colors" :class="isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'">
          <MfIcon name="skip_previous" size="22" />
        </button>
        <!-- Play/Pause -->
        <button @click="player.togglePlay()"
          class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-all hover:scale-105">
          <MfIcon v-if="!player.isPlaying" name="play_arrow" filled className="ml-0.5" size="22" />
          <MfIcon v-else name="pause" filled size="22" />
        </button>
        <!-- Next -->
        <button @click="player.next()" class="transition-colors" :class="isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'">
          <MfIcon name="skip_next" size="22" />
        </button>
        <!-- Repeat -->
        <button @click="player.toggleRepeat()"
          :title="player.repeat === 'none' ? 'Bật lặp lại' : player.repeat === 'all' ? 'Đang lặp danh sách' : 'Đang lặp một bài'"
          class="transition-colors relative" :class="player.repeat !== 'none' ? 'text-[#1ed760] hover:text-[#1fdf64]' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
          <MfIcon name="repeat" size="18" />
          <span v-if="player.repeat === 'one'" class="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#1ed760] text-[8px] font-bold text-black">
            1
          </span>
        </button>
      </div>
      <!-- Progress bar -->
      <div class="flex items-center gap-2 w-full">
        <span class="text-xs w-8 text-right" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
          {{ formatTime(displayCurrentTime) }}
        </span>
        <div ref="progressBarRef"
             class="flex-1 h-1 rounded-full cursor-pointer group relative touch-none select-none"
             :class="isDark ? 'bg-dark-border' : 'bg-light-border'"
             @pointerdown="startSeekDrag">
          <div class="h-full rounded-full bg-primary transition-all relative"
               :style="`width: ${displayProgressPercent}%`">
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
      <MfIcon :name="player.volume === 0 ? 'volume_off' : 'volume_up'" size="20" :className="isDark ? 'text-gray-400 flex-shrink-0' : 'text-gray-500 flex-shrink-0'" />
      <input type="range" min="0" max="100" :value="player.volume * 100"
        @input="player.setVolume($event.target.value / 100)"
        class="flex-1 h-1 appearance-none rounded-full cursor-pointer accent-primary"
        :class="isDark ? 'bg-dark-border' : 'bg-light-border'" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
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
const progressBarRef = ref(null)
const isSeeking = ref(false)
const seekPreviewTime = ref(0)

const progressPercent = computed(() => {
  if (!player.duration) return 0
  return (player.currentTime / player.duration) * 100
})
const displayCurrentTime = computed(() => isSeeking.value ? seekPreviewTime.value : player.currentTime)
const displayProgressPercent = computed(() => {
  if (!player.duration) return 0
  return isSeeking.value ? (seekPreviewTime.value / player.duration) * 100 : progressPercent.value
})

function formatTime(sec) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function seekFromClientX(clientX) {
  const el = progressBarRef.value
  if (!el || !player.duration) return
  const rect = el.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  seekPreviewTime.value = ratio * player.duration
  player.seek(seekPreviewTime.value)
}

function startSeekDrag(e) {
  if (!player.duration) return
  e.preventDefault()
  isSeeking.value = true
  seekFromClientX(e.clientX)
  window.addEventListener('pointermove', handleSeekDrag)
  window.addEventListener('pointerup', stopSeekDrag, { once: true })
  window.addEventListener('pointercancel', stopSeekDrag, { once: true })
}

function handleSeekDrag(e) {
  seekFromClientX(e.clientX)
}

function stopSeekDrag() {
  isSeeking.value = false
  window.removeEventListener('pointermove', handleSeekDrag)
}

onBeforeUnmount(stopSeekDrag)

</script>
