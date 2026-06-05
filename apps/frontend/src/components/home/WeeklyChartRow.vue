<template>
  <div
    class="home-row group flex h-16 items-center gap-3 px-2.5"
    role="button"
    tabindex="0"
    @click="$emit('play', song)"
    @keydown.enter="$emit('play', song)"
  >
    <div class="w-8 shrink-0 text-center">
      <div class="text-2xl font-black leading-none" :class="rankTone">{{ rank }}</div>
      <div class="mt-1 flex justify-center text-[10px]" :class="changeTone">
        <span v-if="rankChange > 0">▲</span>
        <span v-else-if="rankChange < 0">▼</span>
        <span v-else>━</span>
      </div>
    </div>

    <img
      :src="coverSrc"
      :alt="song.title || 'Song cover'"
      class="h-12 w-12 shrink-0 rounded-lg object-cover shadow-md"
      loading="lazy"
      @error="event => event.target.src = DEFAULT_COVER"
    />

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="truncate text-sm font-bold text-white">{{ song.title || 'Chưa có tên bài hát' }}</p>
        <span
          v-if="song.is_premium"
          class="shrink-0 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-black text-violet-200"
        >
          PREMIUM
        </span>
      </div>
      <p class="truncate text-xs font-semibold text-slate-400">{{ song.artist_name || song.artist || 'Nghệ sĩ chưa cập nhật' }}</p>
    </div>

    <span class="hidden shrink-0 text-xs font-semibold text-slate-400 sm:block">{{ formatPlays(song.weekly_plays ?? song.listen_count ?? song.play_count ?? song.plays ?? 0) }} lượt nghe</span>

    <button
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
      type="button"
      aria-label="Mở menu bài hát"
      @click.stop="$emit('open-menu', { song, x: $event.clientX, y: $event.clientY })"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { DEFAULT_COVER, normalizeImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  song: {
    type: Object,
    required: true
  },
  rank: {
    type: Number,
    required: true
  }
})

defineEmits(['play', 'open-menu'])

const coverSrc = computed(() => normalizeImageUrl(props.song.cover_url || props.song.album_cover_url))
const rankChange = computed(() => Number(props.song.rank_change || 0))
const rankTone = computed(() => {
  if (props.rank === 1) return 'text-violet-300'
  if (props.rank === 2) return 'text-sky-300'
  if (props.rank === 3) return 'text-emerald-300'
  return 'text-slate-500'
})
const changeTone = computed(() => {
  if (rankChange.value > 0) return 'text-emerald-400'
  if (rankChange.value < 0) return 'text-rose-400'
  return 'text-slate-500'
})

function formatPlays(num) {
  return new Intl.NumberFormat('vi-VN').format(Number(num || 0))
}
</script>
