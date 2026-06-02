<template>
  <div
    class="relative flex flex-col p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] transition-all duration-300 shadow-xl"
    :class="[
      isPopular
        ? 'bg-surface-elevated border-2 border-premium-orange/40 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(255,165,133,0.3)] hover:border-premium-orange'
        : 'bg-surface border border-white/10 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_15px_30px_-15px_rgba(255,255,255,0.1)]'
    ]"
  >
    <!-- Popular Badge -->
    <div
      v-if="isPopular"
      class="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-premium-orange to-yellow-500 text-black px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-lg"
    >
      Phổ biến nhất
    </div>

    <!-- Header -->
    <div class="text-center pb-6 border-b border-white/5 mb-6">
      <h3 class="text-xl sm:text-2xl font-bold text-white mb-2">{{ plan.name }}</h3>
      <div class="flex items-baseline justify-center gap-1">
        <span class="text-3xl sm:text-4xl font-extrabold text-white">{{ formatPrice(plan.price) }}đ</span>
        <span class="text-text-secondary text-sm">/ {{ plan.duration_days }} ngày</span>
      </div>
      <p class="mt-3 text-sm text-text-secondary line-clamp-2 min-h-[40px]">{{ plan.description }}</p>
    </div>

    <!-- Features -->
    <ul class="flex-1 flex flex-col gap-4 mb-8">
      <li
        v-for="(feature, i) in parsedFeatures"
        :key="i"
        class="flex items-start gap-3 text-sm font-medium text-text-primary"
      >
        <svg class="w-5 h-5 text-accent-green shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span class="leading-relaxed">{{ feature }}</span>
      </li>
    </ul>

    <!-- CTA Button -->
    <button
      @click="$emit('select', plan)"
      :disabled="isCreating"
      class="w-full py-3.5 sm:py-4 rounded-full font-bold text-sm sm:text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      :class="[
        isPopular
          ? 'bg-accent-green text-black hover:bg-[#4cf479] hover:shadow-[0_0_20px_rgba(30,215,96,0.4)]'
          : 'bg-white/10 text-white hover:bg-white/20'
      ]"
    >
      <span v-if="isCreating">Đang xử lý...</span>
      <span v-else>Nâng cấp ngay</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  plan: {
    type: Object,
    required: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isCreating: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])

const parsedFeatures = computed(() => {
  if (Array.isArray(props.plan.features)) return props.plan.features
  if (typeof props.plan.features === 'string') {
    try {
      return JSON.parse(props.plan.features)
    } catch {
      return [props.plan.features]
    }
  }
  return []
})

function formatPrice(price) {
  if (!price) return '0'
  return new Intl.NumberFormat('vi-VN').format(price)
}
</script>

<style scoped>
/* Scoped styles kept minimal, mostly relies on Tailwind */
.bg-surface {
  background: linear-gradient(135deg, rgba(76,29,149,0.12), rgba(15,23,42,0.78));
  backdrop-filter: blur(16px);
}
.bg-surface-elevated {
  background: linear-gradient(135deg, rgba(76,29,149,0.2), rgba(30,27,75,0.38), rgba(15,23,42,0.88));
  backdrop-filter: blur(16px);
}
.text-text-primary {
  color: #ffffff;
}
.text-text-secondary {
  color: #b3b3b3;
}
.text-accent-green {
  color: #1ed760;
}
.bg-accent-green {
  background-color: #1ed760;
}
.text-premium-orange {
  color: #ffa585;
}
.border-premium-orange {
  border-color: #ffa585;
}
.from-premium-orange {
  --tw-gradient-from: #ffa585;
  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(255, 165, 133, 0));
}
</style>
