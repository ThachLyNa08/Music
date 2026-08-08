<template>
  <div class="mb-3.5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <h2
        class="home-section-title cursor-pointer hover:underline"
        :class="{ 'cursor-default': !clickable }"
        @click="clickable && $emit('viewAll')"
      >
        {{ title }}
      </h2>
      <p v-if="subtitle" class="home-section-subtitle text-xs sm:text-sm text-white/60 line-clamp-1 mt-0.5">{{ subtitle }}</p>
    </div>
    <button
      v-if="showViewAll"
      @click="$emit('viewAll')"
      class="home-view-all shrink-0 hover:underline text-xs sm:text-sm font-semibold text-white/60 hover:text-white self-start sm:self-auto mt-1 sm:mt-0"
    >
      Xem tất cả
    </button>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  showViewAll: {
    type: Boolean,
    default: true
  },
  clickable: {
    type: Boolean,
    default: true
  }
})

defineEmits(['viewAll'])
</script>
