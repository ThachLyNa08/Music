<template>
  <div v-if="totalPages > 1" class="flex items-center gap-2" :class="{ 'opacity-50 pointer-events-none': disabled }">
    <!-- First Page -->
    <button 
      @click="changePage(1)" 
      :disabled="disabled || currentPage === 1"
      class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      aria-label="Go to first page"
      title="Trang đầu"
    >
      <MfIcon name="first_page" size="18" />
    </button>

    <!-- Previous Page -->
    <button 
      @click="changePage(currentPage - 1)" 
      :disabled="disabled || currentPage === 1"
      class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      aria-label="Go to previous page"
      title="Trang trước"
    >
      <MfIcon name="chevron_left" size="18" />
    </button>

    <!-- Page Input -->
    <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
      <span>Trang</span>
      <input 
        v-model="pageInput" 
        @blur="commitPageInput"
        @keyup.enter="commitPageInput"
        :disabled="disabled"
        type="text"
        inputmode="numeric"
        class="h-9 w-16 px-2 text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      />
      <span>/ {{ totalPages }}</span>
    </div>

    <!-- Next Page -->
    <button 
      @click="changePage(currentPage + 1)" 
      :disabled="disabled || currentPage === totalPages"
      class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      aria-label="Go to next page"
      title="Trang sau"
    >
      <MfIcon name="chevron_right" size="18" />
    </button>

    <!-- Last Page -->
    <button 
      @click="changePage(totalPages)" 
      :disabled="disabled || currentPage === totalPages"
      class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      aria-label="Go to last page"
      title="Trang cuối"
    >
      <MfIcon name="last_page" size="18" />
    </button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:currentPage', 'change'])

const pageInput = ref(String(props.currentPage))

watch(() => props.currentPage, (newVal) => {
  pageInput.value = String(newVal)
})

const changePage = (page) => {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('update:currentPage', page)
    emit('change', page)
  }
}

const commitPageInput = () => {
  let val = parseInt(pageInput.value, 10)
  
  if (isNaN(val)) {
    pageInput.value = String(props.currentPage)
    return
  }
  
  if (val < 1) val = 1
  if (val > props.totalPages) val = props.totalPages
  
  if (val !== props.currentPage) {
    changePage(val)
  } else {
    pageInput.value = String(props.currentPage)
  }
}
</script>
