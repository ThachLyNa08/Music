<template>
  <section class="mb-5 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div class="min-w-0 flex-1">
        <slot />
      </div>

      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2 mt-2 xl:mt-0">
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>

<script setup>
// This is a simple wrapper for the filter bar to ensure consistent styling
</script>
