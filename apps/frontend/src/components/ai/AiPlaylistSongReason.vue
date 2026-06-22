<template>
  <p class="line-clamp-2 text-xs leading-5 text-white/48">
    {{ reason || 'Được chọn vì phù hợp với yêu cầu tổng thể.' }}
  </p>
</template>

<script setup>
defineProps({
  reason: { type: String, default: '' }
})
</script>
