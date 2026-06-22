<template>
  <article 
    :class="['group user-card user-card-hover overflow-hidden p-3 cursor-pointer flex flex-col', $attrs.class]"
    @click="$emit('click', playlist)"
  >
    <!-- Cover -->
    <div class="user-card-cover relative shadow-lg mb-3">
      <CoverImage 
        :src="getPlaylistCover(playlist)" 
        class="user-card-cover-img"
      />
      
      <!-- Play Button Overlay (Spotify Style) -->
      <div class="absolute bottom-2 right-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-10">
        <button 
          class="home-play-btn h-12 w-12 cursor-pointer border-none"
          @click.stop="$emit('play', playlist)"
        >
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-black ml-1">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Info -->
    <h3 class="line-clamp-1 text-sm font-extrabold text-white transition-colors">
      {{ playlist.name }}
    </h3>
    <p class="mt-1 line-clamp-2 text-xs font-medium text-slate-400 leading-snug">
      {{ playlist.desc || playlist.description || (playlist.total_songs ? `${playlist.total_songs} bài hát` : 'Danh sách phát') }}
    </p>
    <p v-if="playlist.updated_at || playlist.updatedAt" class="mt-1 text-[11px] font-medium text-slate-500">
      Cập nhật: {{ new Date(playlist.updated_at || playlist.updatedAt).toLocaleDateString('vi-VN') }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import CoverImage from '@/components/common/CoverImage.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  playlist: {
    type: Object,
    required: true
  }
})

defineEmits(['click', 'play'])

const gradients = {
  weekly: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  morning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  evening: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  daily: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  default: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)'
}

const gradientBackground = computed(() => {
  const name = props.playlist.name?.toLowerCase() || ''
  if (name.includes('weekly')) return gradients.weekly
  if (name.includes('morning')) return gradients.morning
  if (name.includes('evening')) return gradients.evening
  if (name.includes('daily')) return gradients.daily
  return gradients.default
})
</script>
