<template>
  <div 
    class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <!-- Skeleton Loading -->
    <div v-if="loading" class="animate-pulse flex items-start justify-between gap-4">
      <div class="h-11 w-11 rounded-xl bg-slate-200"></div>
      <div class="min-w-0 flex-1 text-right flex flex-col items-end">
        <div class="h-4 w-24 bg-slate-200 rounded mb-2"></div>
        <div class="h-8 w-16 bg-slate-200 rounded mb-2"></div>
        <div class="h-3 w-32 bg-slate-200 rounded"></div>
      </div>
    </div>

    <!-- Actual Content -->
    <template v-else>
      <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r" :class="accentClass" />
      
      <div v-if="showIcon" class="flex items-start justify-between gap-4">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" :class="iconClass">
          <MfIcon :name="icon" size="20" />
        </div>

        <div class="min-w-0 text-right flex-1">
          <p class="text-sm font-medium text-black truncate" :title="title">{{ title }}</p>
          <p class="mt-1 text-2xl font-bold tracking-tight" :class="valueClass">{{ formattedValue }}</p>
          <p v-if="subtitle" class="mt-1 text-xs text-slate-400 truncate" :title="subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <div v-else class="space-y-1">
        <p class="text-sm font-semibold text-black line-clamp-1" :title="title">
          {{ title }}
        </p>
        <p class="text-3xl font-bold tracking-tight" :class="valueClass">
          {{ formattedValue }}
        </p>
        <p v-if="subtitle" class="text-xs text-slate-400 line-clamp-1" :title="subtitle">
          {{ subtitle }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  value: [String, Number],
  subtitle: String,
  icon: String,
  tone: {
    type: String,
    default: 'blue'
  },
  loading: Boolean,
  showIcon: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const toneClassMap = {
  blue: {
    accent: 'from-blue-500 to-blue-400',
    icon: 'bg-blue-50 text-blue-600',
    value: 'text-slate-900'
  },
  green: {
    accent: 'from-emerald-500 to-teal-400',
    icon: 'bg-emerald-50 text-emerald-600',
    value: 'text-emerald-600'
  },
  purple: {
    accent: 'from-violet-500 to-purple-400',
    icon: 'bg-violet-50 text-violet-600',
    value: 'text-violet-600'
  },
  amber: {
    accent: 'from-amber-500 to-yellow-400',
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-600'
  },
  cyan: {
    accent: 'from-cyan-500 to-sky-400',
    icon: 'bg-cyan-50 text-cyan-600',
    value: 'text-cyan-600'
  },
  rose: {
    accent: 'from-rose-500 to-pink-400',
    icon: 'bg-rose-50 text-rose-600',
    value: 'text-rose-600'
  },
  red: {
    accent: 'from-red-500 to-rose-400',
    icon: 'bg-red-50 text-red-600',
    value: 'text-red-600'
  },
  slate: {
    accent: 'from-slate-400 to-slate-300',
    icon: 'bg-slate-100 text-slate-600',
    value: 'text-slate-900'
  }
}

const currentTone = computed(() => toneClassMap[props.tone] || toneClassMap.blue)
const accentClass = computed(() => currentTone.value.accent)
const iconClass = computed(() => currentTone.value.icon)
const valueClass = computed(() => currentTone.value.value)

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})
</script>
