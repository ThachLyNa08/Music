<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
    <div 
      v-for="group in summary" 
      :key="group.key"
      @click="$emit('select-group', group.key)"
      :class="[
        'relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1',
        selectedGroup === group.key 
          ? 'ring-2 ring-offset-2 ring-offset-gray-50 dark:ring-offset-bg-base ring-indigo-500 shadow-lg shadow-indigo-500/20' 
          : 'shadow-sm hover:shadow-md border border-gray-100 dark:border-bg-border hover:border-indigo-300 dark:hover:border-indigo-500/50'
      ]"
    >
      <!-- Background gradient for Selected state -->
      <div 
        v-if="selectedGroup === group.key" 
        class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20"
      ></div>
      <div v-else class="absolute inset-0 bg-white dark:bg-bg-surface"></div>

      <div class="relative p-4 flex items-start gap-3 h-full">
        <!-- Icon / Cover -->
        <div class="flex-shrink-0 relative">
          <img 
            v-if="group.topCoverUrl" 
            :src="$formatImageUrl(group.topCoverUrl)" 
            class="w-12 h-12 rounded-xl object-cover shadow-sm"
            @error="e => e.target.style.display = 'none'"
          />
          <div v-else class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
            <span class="text-xl font-bold text-indigo-500 dark:text-indigo-400">{{ group.key.charAt(0) }}</span>
          </div>
          <!-- Selected Check -->
          <div v-if="selectedGroup === group.key" class="absolute -top-2 -right-2 bg-indigo-500 text-white rounded-full p-1 shadow-md">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <h3 class="text-base font-bold text-gray-900 dark:text-white truncate">{{ group.label }}</h3>
          <div class="mt-1.5 space-y-0.5">
            <p class="text-[13px] font-medium text-gray-500 dark:text-gray-400 flex justify-between">
              <span>Số bài hát:</span>
              <span class="text-gray-900 dark:text-white font-bold">{{ formatNumber(group.totalSongs) }}</span>
            </p>
            <p class="text-[13px] font-medium text-gray-500 dark:text-gray-400 flex justify-between">
              <span>Đang active:</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-bold">{{ formatNumber(group.activeSongs) }}</span>
            </p>
            <p class="text-[13px] font-medium text-gray-500 dark:text-gray-400 flex justify-between">
              <span>Lượt nghe:</span>
              <span class="text-indigo-600 dark:text-indigo-400 font-bold">{{ formatNumber(group.totalListens) }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  summary: {
    type: Array,
    required: true
  },
  selectedGroup: {
    type: String,
    required: true
  }
});

defineEmits(['select-group']);

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
</script>
