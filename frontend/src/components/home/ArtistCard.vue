<template>
  <ArtistCard
    :artist="artist"
    :size="size"
    :show-stats="showStats"
    :meta="meta"
    :clickable="clickable"
  />
</template>

<script setup>
import ArtistCard from '@/components/common/ArtistCard.vue'

defineProps({
  artist: {
    type: Object,
    required: true
  },
  size: {
    type: String,
    default: 'md'
  },
  showStats: {
    type: Boolean,
    default: true
  },
  meta: {
    type: String,
    default: ''
  },
  clickable: {
    type: Boolean,
    default: true
  }
})
</script>
