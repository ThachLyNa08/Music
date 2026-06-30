<template>
  <div class="mic-card flex-1 flex flex-col justify-center rounded-[24px] border border-white/10 bg-[#111827]/80 shadow-xl p-4 backdrop-blur-md">
    <div
      class="flex items-end justify-center gap-1 h-full min-h-[96px] w-full relative overflow-hidden"
    >
      <div
        v-for="i in barCount"
        :key="i"
        :ref="el => setBarRef(el, i - 1)"
        class="w-[6px] min-h-[4px] rounded-full relative transition-[height] duration-75 ease-out"
      >
        <div class="absolute inset-0 rounded-full opacity-30 blur-[4px] bg-inherit"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'idle'
  }
})

const barRefs = ref([])
const setBarRef = (el, index) => {
  if (el) {
    barRefs.value[index] = el
  }
}

const statusText = computed(() => {
  switch (props.status) {
    case 'idle': return 'Chưa bật'
    case 'connecting': return 'Đang kết nối'
    case 'good': return 'Tốt'
    case 'excellent': return 'Rất tốt'
    case 'none': return 'Không có tín hiệu'
    case 'denied': return 'Chưa cấp quyền'
    case 'error': return 'Lỗi micro'
    default: return 'Chưa bật'
  }
})

const statusColor = computed(() => {
  switch (props.status) {
    case 'idle':
    case 'none':
      return 'text-slate-400'
    case 'connecting': return 'text-amber-400'
    case 'good': return 'text-cyan-400'
    case 'excellent': return 'text-emerald-400'
    case 'denied':
    case 'error':
      return 'text-rose-400'
    default: return 'text-slate-400'
  }
})

const barCount = 35
const barsData = Array.from({ length: barCount }, () => ({
  targetHeight: 4,
  currentHeight: 4
}))

let animationFrameId = null
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function getColor(height) {
  const pct = height / 100
  if (pct < 0.3) return '#00d9a3' // emerald
  if (pct < 0.5) return '#00b8d9' // cyan
  if (pct < 0.75) return '#f0c040' // amber
  return '#ff4d6d' // rose
}

function animate() {
  if (prefersReducedMotion) return

  const time = Date.now() / 1000

  barsData.forEach((bar, i) => {
    // Simulated active animation for idle/demo purposes
    const centerStart = Math.floor(barCount / 2) - 4
    const centerEnd = Math.floor(barCount / 2) + 4
    const isBass = (i >= centerStart && i <= centerEnd)
    let beat = 0
    
    if (isBass) {
      beat = Math.max(0, Math.sin(time * 12) * Math.sin(time * 3))
      beat = Math.pow(beat, 3) * 120
    } else {
      beat = Math.random() * 25 + Math.sin(time * 20 + i) * 15
    }
    
    const wave = Math.sin(time * 4 + i * 0.5) * 12 + 20
    
    // Calculate target height using the simulated beat
    let target = Math.max(4, Math.min(100, wave + beat))

    bar.targetHeight = target

    bar.currentHeight += (bar.targetHeight - bar.currentHeight) * 0.25
    const h = bar.currentHeight
    
    const el = barRefs.value[i]
    if (el) {
      el.style.height = `${h}px`
      el.style.backgroundColor = getColor(h)
    }
  })

  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  animationFrameId = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>
