<template>
  <div 
    class="home-row group relative flex cursor-pointer items-center gap-4 px-4 py-2"
    :class="{ 'bg-white/5': isPlaying || active }"
    @click="$router.push(`/song/${normalizedSong.id}`)"
  >
    <!-- Left side -->
    <!-- Index / Play Icon -->
    <div v-if="showIndex" class="text-center text-gray-400 group-hover:text-white flex justify-center items-center font-medium w-8 shrink-0">
      <span class="group-hover:hidden" v-if="!isPlaying">{{ index }}</span>
      <div class="hidden group-hover:flex items-center justify-center w-full h-full" v-if="!isPlaying" @click.stop="$emit('play', normalizedSong)">
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
      </div>
      <div v-if="isPlaying" @click.stop="$emit('play', normalizedSong)" class="flex items-center justify-center w-full h-full">
        <!-- Pause / Playing Indicator -->
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-[#1ed760]"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      </div>
    </div>
    <div v-else class="text-center text-gray-400 group-hover:text-white flex justify-center items-center font-medium w-8 shrink-0">
      <div class="hidden group-hover:flex items-center justify-center w-full h-full" v-if="!isPlaying" @click.stop="$emit('play', normalizedSong)">
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
      </div>
      <div v-if="isPlaying" @click.stop="$emit('play', normalizedSong)" class="flex items-center justify-center w-full h-full">
        <!-- Pause / Playing Indicator -->
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-[#1ed760]"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      </div>
    </div>

    <!-- Title & Cover -->
    <div class="flex items-center flex-1 min-w-0 pr-4 gap-3">
      <CoverImage v-if="showCover" :src="getItemCover(normalizedSong)" class="!w-10 !h-10 md:!w-11 md:!h-11 !rounded shrink-0 shadow" />
      <div class="flex-1 min-w-0 flex flex-col justify-center">
        <div class="text-base font-normal truncate transition" :class="isPlaying ? 'text-[#1ed760]' : 'text-white group-hover:underline'">
          {{ normalizedSong.title }}
        </div>
        <div class="text-sm text-gray-400 truncate mt-0.5">
          <span 
            class="hover:text-white hover:underline transition" 
            @click.stop="normalizedSong.artist_id && $router.push(`/artist/${normalizedSong.artist_id}`)"
          >
            {{ normalizedSong.artist }}
          </span>
        </div>
      </div>
    </div>

    <!-- Middle side -->
    <!-- Album -->
    <div v-if="showAlbum && !compact" class="flex-1 text-sm text-gray-400 truncate hidden md:block pr-4">
      <span 
        class="hover:text-white hover:underline transition"
        @click.stop="normalizedSong.album_id && $router.push(`/album/${normalizedSong.album_id}`)"
      >
        {{ normalizedSong.album }}
      </span>
    </div>

    <!-- Plays -->
    <div v-if="showPlays && !compact" class="w-24 text-sm text-gray-400 truncate hidden lg:block text-right pr-4 font-variant-numeric: tabular-nums">
      {{ formatNumber(normalizedSong.plays) }}
    </div>

    <!-- Right side -->
    <!-- Duration and Actions -->
    <div class="w-auto flex justify-end items-center gap-3 md:gap-4 text-sm text-gray-400 shrink-0">
      <!-- Like Button -->
      <LikeButton 
        :song="song"
        baseClass="song-like-button"
        activeClass="song-like-button--active"
        inactiveClass=""
      >
        <template #icon="{ isLiked }">
          <svg
            viewBox="0 0 24 24"
            class="song-like-icon"
            :fill="isLiked ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </template>
      </LikeButton>

      <!-- Duration -->
      <span class="w-10 text-right font-variant-numeric: tabular-nums">{{ formatDuration(normalizedSong.duration) }}</span>

      <!-- Action Menu Button -->
      <button @click.stop="openMenu" class="opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-white transition p-2" title="Khác">
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-currentColor"><path d="M4.5 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CoverImage from '@/components/common/CoverImage.vue'
import { getItemCover } from '@/utils/imageUrl'
import { useLibraryStore } from '@/stores/library'
import LikeButton from '@/components/common/LikeButton.vue'

const props = defineProps({
  song: { type: Object, required: true },
  index: { type: Number, default: 1 },
  showIndex: { type: Boolean, default: true },
  showCover: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: false },
  showPlays: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  isPlaying: { type: Boolean, default: false }
})

const emit = defineEmits(['play', 'open-menu', 'toggle-like'])
const library = useLibraryStore()

// Normalize different song formats from API
const normalizedSong = computed(() => {
  const s = props.song || {}
  return {
    ...s,
    id: s.song_id || s.id,
    title: s.title || s.name || 'Unknown Title',
    artist: s.artist_name || s.artist || s.artists || 'Unknown Artist',
    artist_id: s.artist_id,
    cover: s.cover_url || s.image_url || s.thumbnail || s.cover,
    duration: s.duration_sec || s.duration || 0,
    album: s.album_title || s.album || 'Single',
    album_id: s.album_id,
    is_liked: isSongLiked(s),
    plays: s.play_count || s.listen_count || s.plays || 0
  }
})

const localFormatImageUrl = (url) => {
  if (!url) return '/default-cover.png' 
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}

function formatDuration(seconds) {
  const s = Number(seconds || 0)
  if (isNaN(s) || s <= 0) return '--:--'
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatNumber(num) {
  if (!num) return '0'
  return new Intl.NumberFormat('vi-VN').format(num)
}

function openMenu(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  emit('open-menu', {
    song: normalizedSong.value,
    x: rect.left,
    y: rect.bottom + 8
  })
}

function isSongLiked(song) {
  const id = song?.id ?? song?.song_id ?? song?.songId ?? null
  return Boolean(
    song?.is_liked === true ||
    song?.is_liked === 1 ||
    song?.isLiked === true ||
    song?.isLiked === 1 ||
    song?.liked === true ||
    song?.liked === 1 ||
    song?.is_favorite === true ||
    song?.is_favorite === 1 ||
    song?.isFavorite === true ||
    song?.isFavorite === 1 ||
    (id !== null && id !== undefined && library.likedSongIds?.has?.(String(id)))
  )
}

function toggleSongLike() {
  emit('toggle-like', props.song)
}
</script>

<style scoped>
.song-like-button {
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  color: #ffffff;
  opacity: 1;
  visibility: visible;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition:
    color 160ms ease,
    transform 160ms ease,
    opacity 160ms ease;
}
.song-like-button:hover {
  color: #ec4899;
  transform: scale(1.08);
}
.song-like-button--active {
  opacity: 1 !important;
  visibility: visible !important;
  color: #ec4899 !important;
}
.song-like-button--active:hover {
  color: #f472b6 !important;
}
.song-like-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}
.song-like-button--active .song-like-icon {
  fill: currentColor;
  stroke: currentColor;
}
</style>
