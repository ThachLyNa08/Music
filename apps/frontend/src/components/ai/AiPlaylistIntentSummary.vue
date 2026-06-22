<template>
  <div class="flex flex-col gap-2 py-1">
    <div v-if="chips.length" class="flex flex-wrap items-center gap-2">
      <span
        v-for="chip in chips"
        :key="chip.key"
        :class="[
          'rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors',
          chip.negative
            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
            : chip.isArtist
              ? 'bg-[#1ed760]/20 text-[#1ed760] border-[#1ed760]/30 shadow-[0_0_8px_rgba(30,215,96,0.15)]'
              : 'bg-[#1ed760]/10 text-[#1ed760] border-[#1ed760]/10'
        ]"
      >
        {{ chip.label }}
      </span>
      <span v-if="lowConfidence" class="text-xs text-[#b3b3b3] italic ml-1">
        Yêu cầu chung chung, gợi ý theo gu nghe.
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  intent: { type: Object, default: null }
})

const labelMap = {
  VPOP: 'VPOP',
  KPOP: 'KPOP',
  USUK: 'USUK',
  ANY: 'mọi thị trường',
  sad: 'buồn',
  heartbreak: 'thất tình',
  chill: 'chill',
  calm: 'nhẹ nhàng',
  romantic: 'lãng mạn',
  happy: 'vui',
  energetic: 'năng lượng',
  party: 'party',
  focus: 'tập trung',
  nostalgic: 'hoài niệm',
  motivational: 'động lực',
  low: 'năng lượng thấp',
  medium: 'năng lượng vừa',
  high: 'năng lượng cao',
  slow: 'tempo chậm',
  fast: 'tempo nhanh',
  morning: 'buổi sáng',
  afternoon: 'buổi chiều',
  night: 'buổi tối',
  late_night: 'đêm khuya',
  rain: 'trời mưa',
  deadline: 'deadline',
  breakup: 'chia tay',
  lonely: 'cô đơn',
  love: 'tình yêu',
  nostalgia: 'hoài niệm',
  weekend: 'cuối tuần'
}

function nice(value) {
  return labelMap[value] || String(value || '').replaceAll('_', ' ')
}

const confidenceText = computed(() => {
  const value = Number(props.intent?.confidence || 0)
  if (!value) return 'đang cân bằng'
  return `${Math.round(value * 100)}% tự tin`
})

const lowConfidence = computed(() => Number(props.intent?.confidence || 0) < 0.45)

const chips = computed(() => {
  const intent = props.intent || {}
  const hard = intent.hardConstraints || {}
  const soft = intent.softPreferences || {}
  const negative = intent.negativeConstraints || {}
  const result = []

  if (hard.market && hard.market !== 'ANY') result.push({ key: `market-${hard.market}`, label: nice(hard.market) })
  ;(hard.genre_family || []).forEach((value) => result.push({ key: `genre-${value}`, label: nice(value) }))
  ;(hard.include_artists || []).forEach((value) => result.push({ key: `artist-${value}`, label: value, isArtist: true }))
  if (intent.seed?.seed_type === 'artist_seed' && intent.seed.artist) {
    result.push({ key: `seed-artist-${intent.seed.artist}`, label: `vibe ${intent.seed.artist}` })
  }
  ;(soft.mood || []).forEach((value) => result.push({ key: `mood-${value}`, label: nice(value) }))
  if (soft.activity) result.push({ key: `activity-${soft.activity}`, label: nice(soft.activity) })
  ;(soft.context || []).forEach((value) => result.push({ key: `context-${value}`, label: nice(value) }))
  if (soft.energy) result.push({ key: `energy-${soft.energy}`, label: nice(soft.energy) })
  if (soft.tempo) result.push({ key: `tempo-${soft.tempo}`, label: nice(soft.tempo) })
  ;(negative.mood || []).forEach((value) => result.push({ key: `neg-mood-${value}`, label: `tránh ${nice(value)}`, negative: true }))
  ;(negative.genre_family || []).forEach((value) => result.push({ key: `neg-genre-${value}`, label: `tránh ${nice(value)}`, negative: true }))
  ;(negative.energy || []).forEach((value) => result.push({ key: `neg-energy-${value}`, label: `tránh ${nice(value)}`, negative: true }))
  ;(negative.artists || []).forEach((value) => result.push({ key: `neg-artist-${value}`, label: `tránh ${value}`, negative: true }))

  return result.slice(0, 14)
})
</script>
