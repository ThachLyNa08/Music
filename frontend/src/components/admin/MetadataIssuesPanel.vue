<template>
  <div class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 shadow-sm mb-8">
    <div class="flex items-start gap-4">
      <div class="p-3 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-bold text-amber-800 dark:text-amber-400">Cảnh báo Metadata ({{ issues.length }} bài hát)</h3>
        <p class="text-sm font-medium text-amber-700 dark:text-amber-300/80 mt-1">Các bài hát dưới đây đang bị thiếu thông tin quan trọng. Vui lòng cập nhật để hệ thống hoạt động tốt nhất.</p>
        
        <div v-if="issues.length > 0" class="mt-4 bg-white/50 dark:bg-bg-card/50 rounded-xl max-h-60 overflow-y-auto border border-amber-100 dark:border-amber-500/20">
          <ul class="divide-y divide-amber-100 dark:divide-amber-500/10">
            <li v-for="issue in issues" :key="issue.id" class="p-3 flex items-center justify-between hover:bg-white dark:hover:bg-bg-surface transition-colors">
              <span class="font-bold text-sm text-gray-800 dark:text-white">{{ issue.title }}</span>
              <div class="flex gap-2">
                <span v-if="issue.missingAudio" class="px-2 py-1 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg">Thiếu Audio</span>
                <span v-if="issue.missingCover" class="px-2 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg">Thiếu Cover</span>
                <span v-if="issue.missingArtist" class="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg">Thiếu Nghệ sĩ</span>
                <span v-if="issue.missingGenre" class="px-2 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-lg">Thiếu Thể loại</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  issues: {
    type: Array,
    default: () => []
  }
});
</script>
