<template>
  <div class="flex items-end justify-between mb-5">
    <div>
      <h2 class="home-section-title cursor-pointer hover:underline" :class="{ 'cursor-default': !clickable }">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="home-section-subtitle">{{ subtitle }}</p>
    </div>
    <button 
      v-if="showViewAll"
      @click="$emit('viewAll')"
      class="home-view-all hover:underline"
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
