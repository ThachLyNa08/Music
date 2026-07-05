<template>
  <div 
    class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    :class="compact && showIcon ? 'p-3.5' : 'p-5'"
  >
    <!-- Skeleton Loading -->
    <div v-if="loading" class="animate-pulse flex items-center gap-4">
      <div class="h-11 w-11 rounded-xl bg-slate-200 shrink-0"></div>
      <div class="min-w-0 flex-1 flex flex-col items-start">
        <div class="h-4 w-24 bg-slate-200 rounded mb-1.5"></div>
        <div class="h-7 w-16 bg-slate-200 rounded mb-1"></div>
        <div class="h-3 w-32 bg-slate-200 rounded"></div>
      </div>
    </div>

    <!-- Actual Content -->
    <template v-else>
      <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r" :class="accentClass" />
      
      <div v-if="showIcon" class="flex items-center gap-4">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" :class="iconClass">
          <MfIcon :name="icon || 'info'" size="20" />
        </div>

        <div class="min-w-0 flex-1 text-left">
          <p class="text-sm font-medium text-slate-600 truncate" :title="title">{{ title }}</p>
          <p class="mt-0.5 text-2xl font-bold tracking-tight" :class="valueClass">{{ formattedValue }}</p>
          <p v-if="subtitle" class="mt-1 text-xs truncate" :class="subtitleColorClass" :title="subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <div v-else class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold text-slate-500 line-clamp-1">
            {{ title }}
          </p>

          <p class="mt-1.5 leading-tight font-black tracking-tight truncate" 
             :class="[
               valueClass,
               String(formattedValue).length > 18 ? 'text-lg' :
               String(formattedValue).length > 12 ? 'text-xl' :
               String(formattedValue).length > 8 ? 'text-2xl' : 'text-[28px]'
             ]" 
             :title="String(formattedValue)">
            {{ formattedValue }}
          </p>

          <p v-if="subtitle" class="mt-1 text-xs font-medium line-clamp-1" :class="subtitleColorClass">
            {{ subtitle }}
          </p>
        </div>

        <div v-if="trendText" class="shrink-0 mt-0.5">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide" 
            :class="[
              trendDirection === 'down' ? 'bg-rose-50 text-rose-600' : 
              trendDirection === 'none' ? iconClass : 
              'bg-emerald-50 text-emerald-600'
            ]">
            <MfIcon v-if="trendDirection === 'down'" name="arrow_downward" size="14" />
            <MfIcon v-else-if="trendDirection === 'up'" name="arrow_upward" size="14" />
            {{ trendText }}
          </span>
        </div>
        <div
          v-else-if="meta"
          class="shrink-0 rounded-2xl px-4 py-3 text-right"
          :class="metaBoxClass"
        >
          <p class="text-[11px] font-bold uppercase tracking-wide opacity-70">
            Tỷ lệ
          </p>
          <p class="mt-1 text-xl font-black tracking-tight">
            {{ meta }}
          </p>
        </div>
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
  meta: {
    type: String,
    default: ''
  },
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
  },
  trendText: String,
  trendDirection: {
    type: String,
    default: 'up'
  }
})

const subtitleColorClass = computed(() => {
  if (!props.subtitle) return 'text-slate-400'
  const text = props.subtitle.trim()
  if (text.startsWith('↑') || text.startsWith('+')) return 'text-emerald-500 font-medium'
  if (text.startsWith('↓') || text.startsWith('-')) return 'text-rose-500 font-medium'
  return 'text-slate-400'
})

const toneClassMap = {
  blue: {
    accent: 'from-blue-500 to-blue-400',
    icon: 'bg-blue-50 text-blue-600',
    value: 'text-slate-900',
    metaBox: 'bg-blue-50 text-blue-700'
  },
  green: {
    accent: 'from-emerald-500 to-teal-400',
    icon: 'bg-emerald-50 text-emerald-600',
    value: 'text-emerald-600',
    metaBox: 'bg-emerald-50 text-emerald-700'
  },
  purple: {
    accent: 'from-violet-500 to-purple-400',
    icon: 'bg-violet-50 text-violet-600',
    value: 'text-violet-600',
    metaBox: 'bg-violet-50 text-violet-700'
  },
  amber: {
    accent: 'from-amber-500 to-yellow-400',
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-600',
    metaBox: 'bg-amber-50 text-amber-700'
  },
  cyan: {
    accent: 'from-cyan-500 to-sky-400',
    icon: 'bg-cyan-50 text-cyan-600',
    value: 'text-cyan-600',
    metaBox: 'bg-cyan-50 text-cyan-700'
  },
  rose: {
    accent: 'from-rose-500 to-pink-400',
    icon: 'bg-rose-50 text-rose-600',
    value: 'text-rose-600',
    metaBox: 'bg-rose-50 text-rose-700'
  },
  red: {
    accent: 'from-red-500 to-rose-400',
    icon: 'bg-red-50 text-red-600',
    value: 'text-red-600',
    metaBox: 'bg-red-50 text-red-700'
  },
  slate: {
    accent: 'from-slate-400 to-slate-300',
    icon: 'bg-slate-100 text-slate-600',
    value: 'text-slate-900',
    metaBox: 'bg-slate-100 text-slate-600'
  }
}

const currentTone = computed(() => toneClassMap[props.tone] || toneClassMap.blue)
const accentClass = computed(() => currentTone.value.accent)
const iconClass = computed(() => currentTone.value.icon)
const valueClass = computed(() => currentTone.value.value)
const metaBoxClass = computed(() => currentTone.value.metaBox || 'bg-slate-100 text-slate-600')

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})
</script>
