<template>
  <div class="relative group/row w-full min-w-0">
    <!-- Left Scroll Button -->
    <button
      v-if="canScrollLeft"
      type="button"
      @click="scroll('left')"
      :class="[
        'absolute left-1 sm:-left-3.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/75 text-white shadow-2xl flex items-center justify-center transition-all duration-200 opacity-90 sm:opacity-0 group-hover/row:opacity-100 hover:bg-[#1ED760] hover:text-black hover:scale-110 active:scale-95 cursor-pointer',
        { 'lg:hidden': mobileOnly }
      ]"
      aria-label="Cuộn sang trái"
    >
      <svg class="w-5 h-5 ml-0.5 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>

    <!-- Scrollable Container -->
    <div
      ref="rowRef"
      class="user-horizontal-row"
      @scroll="checkScroll"
    >
      <slot></slot>
    </div>

    <!-- Right Scroll Button -->
    <button
      v-if="canScrollRight"
      type="button"
      @click="scroll('right')"
      :class="[
        'absolute right-1 sm:-right-3.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/75 text-white shadow-2xl flex items-center justify-center transition-all duration-200 opacity-90 sm:opacity-0 group-hover/row:opacity-100 hover:bg-[#1ED760] hover:text-black hover:scale-110 active:scale-95 cursor-pointer',
        { 'lg:hidden': mobileOnly }
      ]"
      aria-label="Cuộn sang phải"
    >
      <svg class="w-5 h-5 mr-0.5 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUpdated, nextTick } from 'vue'

defineProps({
  mobileOnly: {
    type: Boolean,
    default: true
  }
})

const rowRef = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function checkScroll() {
  const el = rowRef.value
  if (!el) return
  const maxScrollLeft = el.scrollWidth - el.clientWidth
  canScrollLeft.value = el.scrollLeft > 6
  canScrollRight.value = maxScrollLeft > 6 && el.scrollLeft < maxScrollLeft - 6
}

function scroll(direction) {
  const el = rowRef.value
  if (!el) return
  const distance = Math.max(220, Math.floor(el.clientWidth * 0.75))
  el.scrollBy({
    left: direction === 'left' ? -distance : distance,
    behavior: 'smooth'
  })
}

let resizeObserver = null

onMounted(() => {
  nextTick(() => {
    checkScroll()
    setTimeout(checkScroll, 200)
    setTimeout(checkScroll, 600)
    setTimeout(checkScroll, 1200)
  })

  if (typeof ResizeObserver !== 'undefined' && rowRef.value) {
    resizeObserver = new ResizeObserver(() => checkScroll())
    resizeObserver.observe(rowRef.value)
  }
  window.addEventListener('resize', checkScroll)
})

onUpdated(() => {
  nextTick(checkScroll)
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', checkScroll)
})
</script>
