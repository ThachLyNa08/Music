<template>
  <button
    type="button"
    :title="title"
    :aria-label="ariaLabel || title"
    :disabled="disabled || loading"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-bg-border dark:bg-bg-card dark:text-slate-300 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
    @click="$emit('click', $event)"
  >
    <MfIcon name="refresh" size="18" :className="loading ? 'animate-spin' : ''" />
  </button>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Reset bộ lọc'
  },
  ariaLabel: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])
</script>
