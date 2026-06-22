<template>
  <div 
    class="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 transition-opacity duration-300"
    :class="{ 'opacity-50 pointer-events-none': loading || disabled }"
  >
    <!-- Left: Total Status -->
    <div v-if="showTotal && !compact" class="text-sm text-white/60 px-2 font-medium flex items-center gap-2">
      <span v-if="total > 0">Hiển thị <span class="text-white">{{ fromItem }}</span>–<span class="text-white">{{ toItem }}</span> trong <span class="text-white">{{ total }}</span></span>
      <span v-else>Không có dữ liệu</span>
      <svg v-if="loading" class="animate-spin h-4 w-4 text-[#1ED760]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </div>

    <!-- Center: Navigation -->
    <div class="flex items-center gap-1 sm:gap-2">
      <button v-if="!compact" @click="goToPage(1)" :disabled="!canGoPrev" class="pagination-btn" aria-label="Trang đầu" title="Trang đầu">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" /></svg>
      </button>
      <button @click="goToPage(page - 1)" :disabled="!canGoPrev" class="pagination-btn" aria-label="Trang trước" title="Trang trước">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      
      <div class="flex items-center gap-2 px-1 sm:px-2">
        <input 
          v-if="!compact"
          type="number" 
          v-model.number="inputPage"
          @keyup.enter="applyInputPage"
          @blur="applyInputPage"
          class="w-12 h-8 bg-black/40 border border-white/10 rounded-md text-center text-sm text-white font-bold focus:outline-none focus:border-[#1ED760] transition-colors hide-arrows"
          aria-label="Nhập trang"
          title="Nhập trang và nhấn Enter"
        />
        <span v-else class="text-sm font-bold text-white px-2">{{ page }}</span>
        <span class="text-sm text-white/50 font-medium">/ {{ computedTotalPages }}</span>
      </div>

      <button @click="goToPage(page + 1)" :disabled="!canGoNext" class="pagination-btn" aria-label="Trang sau" title="Trang sau">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <button v-if="!compact" @click="goToPage(computedTotalPages)" :disabled="!canGoNext" class="pagination-btn" aria-label="Trang cuối" title="Trang cuối">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
      </button>
    </div>

    <!-- Right: Page Size -->
    <div v-if="showPageSize && !compact" class="flex items-center gap-2 px-2">
      <span class="text-sm text-white/60">Hiển thị</span>
      <select 
        v-model.number="localLimit"
        @change="handleLimitChange"
        class="bg-black/40 border border-white/10 text-white text-sm rounded-md h-8 px-2 outline-none focus:border-[#1ED760] transition-colors cursor-pointer"
        aria-label="Số dòng hiển thị"
      >
        <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  limit: { type: Number, default: 10 },
  total: { type: Number, default: 0 },
  totalPages: { type: Number, default: undefined },
  loading: { type: Boolean, default: false },
  pageSizeOptions: { type: Array, default: () => [10, 20, 30, 50] },
  showPageSize: { type: Boolean, default: true },
  showTotal: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:page', 'update:limit', 'change'])

const inputPage = ref(props.page)
const localLimit = ref(props.limit)

watch(() => props.page, (val) => {
  inputPage.value = val
})

watch(() => props.limit, (val) => {
  localLimit.value = val
})

const computedTotalPages = computed(() => {
  if (props.total === 0) return 1
  if (props.totalPages !== undefined) return props.totalPages
  return Math.ceil(props.total / props.limit) || 1
})

const fromItem = computed(() => {
  if (props.total === 0) return 0
  return (props.page - 1) * props.limit + 1
})

const toItem = computed(() => {
  if (props.total === 0) return 0
  return Math.min(props.page * props.limit, props.total)
})

const canGoPrev = computed(() => props.page > 1 && props.total > 0)
const canGoNext = computed(() => props.page < computedTotalPages.value && props.total > 0)

function goToPage(p) {
  if (p < 1) p = 1
  if (p > computedTotalPages.value) p = computedTotalPages.value
  
  if (p !== props.page) {
    emit('update:page', p)
    emit('change', { page: p, limit: props.limit })
  }
}

function applyInputPage() {
  let p = parseInt(inputPage.value)
  if (isNaN(p)) {
    inputPage.value = props.page
    return
  }
  if (p < 1) p = 1
  if (p > computedTotalPages.value) p = computedTotalPages.value
  inputPage.value = p
  goToPage(p)
}

function handleLimitChange() {
  emit('update:limit', localLimit.value)
  emit('update:page', 1)
  emit('change', { page: 1, limit: localLimit.value })
}
</script>

<style scoped>
.pagination-btn {
  @apply w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 transition-all duration-200 cursor-pointer flex-shrink-0;
}
.pagination-btn:hover:not(:disabled) {
  @apply bg-white/15 text-white border-white/20 transform -translate-y-px shadow-lg;
}
.pagination-btn:active:not(:disabled) {
  @apply bg-[#1ED760]/20 text-[#1ED760] border-[#1ED760]/50 transform translate-y-0 shadow-none;
}
.pagination-btn:disabled {
  @apply opacity-30 cursor-not-allowed;
}

/* Hide number input arrows */
.hide-arrows::-webkit-outer-spin-button,
.hide-arrows::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.hide-arrows[type=number] {
  -moz-appearance: textfield;
}

/* Custom scrollbar for select if needed (mostly browser native) */
select option {
  background-color: #181818;
  color: white;
}
</style>
