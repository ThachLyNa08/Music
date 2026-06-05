<template>
  <article class="weekly-chart-card home-card">
    <header class="mb-4 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-xl font-black text-white">{{ title }}</h3>
        <p class="mt-1 text-xs font-semibold text-slate-400">Cập nhật theo lượt nghe 7 ngày</p>
      </div>

      <button
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg shadow-violet-950/30 transition hover:scale-105 hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        :disabled="songs.length === 0"
        :aria-label="`Phát bảng ${title}`"
        @click="$emit('play-list', songs)"
      >
        <svg viewBox="0 0 24 24" class="ml-0.5 h-4 w-4 fill-current">
          <polygon points="7 4 19 12 7 20 7 4" />
        </svg>
      </button>
    </header>

    <div v-if="loading" class="space-y-2">
      <div v-for="item in 5" :key="item" class="h-16 animate-pulse rounded-xl bg-white/[0.06]"></div>
    </div>

    <div v-else-if="songs.length === 0" class="flex h-[328px] items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-sm font-semibold text-slate-400">
      Chưa có dữ liệu bảng xếp hạng
    </div>

    <div v-else class="space-y-2">
      <WeeklyChartRow
        v-for="song in songs.slice(0, 5)"
        :key="song.id"
        :song="song"
        :rank="song.rank || songs.indexOf(song) + 1"
        @play="$emit('play-song', song, songs)"
        @open-menu="$emit('open-menu', $event)"
      />
    </div>

    <footer class="mt-5 flex justify-center">
      <button
        class="rounded-full border border-white/70 px-6 py-2 text-sm font-extrabold text-white transition hover:bg-white hover:text-black"
        type="button"
        @click="$emit('view-all', region)"
      >
        Xem tất cả
      </button>
    </footer>
  </article>
</template>

<script setup>
import WeeklyChartRow from './WeeklyChartRow.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  songs: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['play-song', 'play-list', 'view-all', 'open-menu'])
</script>

<style scoped>
.weekly-chart-card {
  position: relative;
  min-height: 430px;
  overflow: hidden;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(88, 28, 135, 0.25), rgba(15, 23, 42, 0.85)),
    radial-gradient(circle at 20% 0%, rgba(124, 58, 237, 0.32), transparent 34%),
    rgba(255, 255, 255, 0.06);
  padding: 24px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
}

@media (max-width: 640px) {
  .weekly-chart-card {
    min-height: 0;
    padding: 18px;
  }
}
</style>
