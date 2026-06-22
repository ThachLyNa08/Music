<template>
  <button 
    @click="$emit('click', $event)" 
    :title="title" 
    :aria-label="ariaLabel || title"
    :disabled="disabled"
    class="flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white w-[46px] h-[46px] rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-bg-base"
  >
    <MfIcon name="add" size="24" />
  </button>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Thêm mới'
  },
  ariaLabel: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])
</script>
