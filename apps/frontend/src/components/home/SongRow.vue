<template>
  <div 
    class="song-row flex items-center gap-4 p-3 rounded-lg transition-all duration-200 hover:bg-white/10 cursor-pointer group"
    @click="$router.push({ name: 'SongDetail', params: { id: song.id } })"
  >
    <!-- Index / Play Button -->
    <div class="w-8 text-center shrink-0">
      <span class="text-lg font-bold text-gray-400 group-hover:hidden">{{ index + 1 }}</span>
      <button 
        class="hidden group-hover:flex w-8 h-8 rounded-full bg-[#1ed760] items-center justify-center mx-auto shadow-md hover:scale-110 transition-transform"
        @click.stop="$emit('play', song)"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-black ml-0.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
      </button>
    </div>
    
    <!-- Cover -->
    <div class="w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-md">
      <img 
        v-if="song.cover_url"
        :src="formatImageUrl(song.cover_url)" 
        class="w-full h-full object-cover"
        @error="event => event.target.src = '/default-cover.png'"
        referrerpolicy="no-referrer"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="white" class="w-5 h-5 opacity-50">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    </div>
    
    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="text-base font-medium text-white truncate group-hover:text-[#1ed760] transition-colors">
        {{ song.title }}
      </div>
      <div class="text-sm text-gray-400 truncate flex items-center gap-2">
        <span v-if="showArtist" class="hover:text-white cursor-pointer" @click.stop="$router.push(`/artist/${song.artist_id}`)">
          {{ song.artist_name || song.artist }}
        </span>
        <span v-if="showAlbum && song.album_title" class="text-gray-500 hover:text-white cursor-pointer" @click.stop="$router.push(`/album/${song.album_id}`)">
          • {{ song.album_title }}
        </span>
      </div>
    </div>
    
    <!-- Duration -->
    <div v-if="showDuration" class="text-sm font-medium text-gray-400 shrink-0">
      {{ formatDuration(song.duration_sec) }}
    </div>
    
    <!-- Actions -->
    <div class="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <LikeButton
        v-if="showLike"
        :song="song"
        baseClass="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        activeClass="text-[#ec4899]"
        inactiveClass="text-gray-400 hover:text-white"
        :size="20"
      >
        <template #icon="{ isLiked }">
          <svg viewBox="0 0 24 24" :fill="isLiked ? '#ec4899' : 'none'" stroke="#ec4899" stroke-width="2" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
          </svg>
        </template>
      </LikeButton>
      <button 
        v-if="showMenu"
        class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        @click.stop="$emit('menu', { song, x: $event.clientX, y: $event.clientY })"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import LikeButton from '@/components/common/LikeButton.vue'

defineProps({
  song: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    default: 0
  },
  showArtist: {
    type: Boolean,
    default: true
  },
  showAlbum: {
    type: Boolean,
    default: false
  },
  showDuration: {
    type: Boolean,
    default: true
  },
  showLike: {
    type: Boolean,
    default: false
  },
  showMenu: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click', 'play', 'toggleLike', 'menu'])

function formatImageUrl(url) {
  if (!url) return '/default-cover.png'
  if (url.startsWith('http')) return url
  return `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${url}`
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

<style scoped>
.song-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.song-row:last-child {
  border-bottom: none;
}
</style>
