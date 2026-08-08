<template>
  <section class="mf-glass-card overflow-hidden transition-all duration-300">
    <!-- Header Hero -->
    <header class="flex flex-col md:flex-row gap-6 p-6 pb-4">
      <div class="h-[140px] w-[140px] md:h-[180px] md:w-[180px] rounded-[18px] shadow-2xl overflow-hidden shrink-0 bg-black/40 border border-white/10 relative">
        <div class="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[18px] z-10 pointer-events-none"></div>
        <div v-if="covers && covers.length >= 4" class="grid grid-cols-2 grid-rows-2 h-full w-full">
          <img v-for="(c, i) in covers.slice(0, 4)" :key="i" :src="c" class="h-full w-full object-cover" alt="" />
        </div>
        <img v-else :src="covers?.[0] || fallbackCover" class="h-full w-full object-cover" alt="Playlist Cover" />
      </div>
      <div class="flex flex-col justify-end min-w-0 flex-1 relative z-10">
        <span class="text-[11px] md:text-xs font-bold uppercase tracking-[0.15em] text-white/80 mb-1.5">PLAYLIST</span>
        <h3 class="text-3xl md:text-[2.75rem] font-black text-white line-clamp-2 leading-[1.1] drop-shadow-sm" :title="title">{{ title }}</h3>
        <p class="mt-3 text-[13px] md:text-sm font-medium text-[#b3b3b3]">
          Playlist được tạo bởi AI • {{ songs.length }} bài hát
        </p>
        <div v-if="isSemanticRag" class="mt-2 inline-flex w-fit items-center rounded-full border border-[#1ed760]/25 bg-[#1ed760]/10 px-3 py-1 text-[11px] font-bold text-[#1ed760]">
          Semantic RAG
        </div>

        <p v-if="shortageMessage" class="mt-1 max-w-2xl text-[13px] leading-relaxed text-amber-400">
          {{ shortageMessage }}
        </p>
        <div class="mt-5 flex flex-wrap items-center gap-4">
          <slot name="actions" />
        </div>
      </div>
    </header>

    <!-- Intent Summary Area -->
    <div class="px-6 pb-3">
      <slot name="intent-summary" />
    </div>

    <!-- Divider -->
    <div class="mx-6 h-px bg-white/[0.04]"></div>

    <div v-if="!songs.length" class="px-6 py-16 text-center text-[#b3b3b3]">
      Chưa có bài hát nào trong preview.
    </div>

    <div v-else class="flex flex-col p-4 max-h-[340px] md:max-h-[440px] overflow-y-auto custom-scrollbar relative">
      <article
        v-for="(song, index) in songs"
        :key="song.id"
        class="group grid cursor-pointer grid-cols-[40px_50px_minmax(0,1fr)] items-center gap-4 rounded-xl px-3 py-2 transition-colors duration-200 hover:bg-white/[0.04] md:grid-cols-[40px_56px_minmax(0,1fr)_80px]"
        :class="{ 'bg-[#1ed760]/[0.08] hover:bg-[#1ed760]/[0.12]': playerStore.currentSong?.id === song.id }"
        @click="$emit('play-song', { song, index })"
      >
        <div class="flex items-center justify-center text-sm font-medium" :class="playerStore.currentSong?.id === song.id ? 'text-[#1ed760]' : 'text-[#b3b3b3]'">
          <span v-if="playerStore.currentSong?.id === song.id && playerStore.isPlaying">
             <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"></path></svg>
          </span>
          <span v-else-if="playerStore.currentSong?.id === song.id">
             <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"></path></svg>
          </span>
          <span v-else class="group-hover:hidden">{{ index + 1 }}</span>
          <span v-if="playerStore.currentSong?.id !== song.id" class="hidden group-hover:block text-white">
             <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"></path></svg>
          </span>
        </div>
        <img
          :src="song.cover_url || song.coverUrl || '/default-cover.png'"
          alt=""
          class="h-[50px] w-[50px] md:h-[56px] md:w-[56px] rounded-lg shadow-md object-cover border border-white/5"
        />
        <div class="flex flex-col justify-center min-w-0 pr-4">
          <div class="truncate text-[15px] font-semibold text-white" :class="{'text-[#1ed760]': playerStore.currentSong?.id === song.id}">{{ song.title }}</div>
          <div class="truncate text-[13px] text-[#b3b3b3] hover:text-white hover:underline transition-colors">{{ song.artist || song.artist_name || 'Unknown Artist' }}</div>
          <div v-if="song.tempoBucket || isHighEnergy(song) || isFallback(song)" class="mt-1 flex flex-wrap items-center gap-1.5">
            <span v-if="song.tempoBucket" class="tempo-pill">{{ formatTempoBucket(song.tempoBucket) }}</span>
            <span v-if="isFallback(song)" class="tempo-pill partial">Partial match</span>
            <span v-if="isHighEnergy(song)" class="tempo-pill energy">High energy</span>
          </div>
          <AiPlaylistSongReason class="mt-0.5 text-xs text-[#a7a7a7] line-clamp-1 md:line-clamp-2" :reason="song.reason" />
        </div>
        <div class="hidden items-center justify-end text-sm text-[#b3b3b3] md:flex">
          {{ formatDuration(song.duration || song.duration_sec) }}
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import AiPlaylistSongReason from './AiPlaylistSongReason.vue'

const props = defineProps({
  songs: { type: Array, default: () => [] },
  meta: { type: Object, default: null },
  warnings: { type: Array, default: () => [] },
  debug: { type: Boolean, default: false },
  title: { type: String, default: 'AI Playlist' },
  covers: { type: Array, default: () => [] },
  fallbackCover: { type: String, default: '/default-cover.png' }
})

defineEmits(['play-song'])

const playerStore = usePlayerStore()
const isSemanticRag = computed(() => props.meta?.retrieval?.strategy === 'semantic_rag_v1')
const shortageMessage = computed(() => {
  const warning = props.warnings.find(item => item?.type === 'SHORTAGE')
  return warning?.message || props.meta?.shortageReason || (props.meta?.shortage ? `MusicFlow chỉ tìm được ${props.songs.length} bài.` : '')
})

function formatDuration(value) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatTempoBucket(bucket) {
  if (bucket === 'fast') return 'Fast tempo'
  if (bucket === 'medium') return 'Medium tempo'
  if (bucket === 'slow') return 'Slow tempo'
  return ''
}

function isHighEnergy(song) {
  return Number(song.energyScore) >= 0.65
}

function isFallback(song) {
  return Boolean(song.fallbackUsed) || song.matchQuality === 'partial'
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.28);
}

.tempo-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.tempo-pill.energy {
  color: #fbbf24;
}

.tempo-pill.partial {
  color: #fcd34d;
  background: rgba(245, 158, 11, 0.12);
}
</style>
