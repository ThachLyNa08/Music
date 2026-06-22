<template>
  <div class="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
    <button
      v-for="suggestion in suggestions"
      :key="suggestion"
      type="button"
      :disabled="disabled"
      class="mf-glass-pill px-4 py-2 text-[13px] font-medium text-white/90 transition-all hover:bg-white/10 hover:border-white/20 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      @click="$emit('select', suggestion)"
    >
      {{ suggestion }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  suggestions: { type: Array, required: true },
  disabled: { type: Boolean, default: false }
})

defineEmits(['select'])
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
}
</style>
