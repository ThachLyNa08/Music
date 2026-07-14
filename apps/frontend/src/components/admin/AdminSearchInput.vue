<template>
  <div class="relative min-w-[200px] flex-1" ref="containerRef">
    <MfIcon :name="icon" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
    <input 
      ref="inputRef"
      type="text" 
      v-model="internalValue"
      :placeholder="placeholder" 
      class="admin-input pl-9 pr-8 w-full"
      :class="[compact ? '!h-8 text-[11px]' : '']"
      @input="onInput"
      @focus="onFocus"
      @keydown.enter="saveToHistoryAndSearch"
      @keydown.esc="showHistory = false"
    >
    <button 
      v-if="internalValue" 
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none"
      @click="clearInput"
    >
      <MfIcon name="close" size="14" />
    </button>

    <!-- History Dropdown -->
    <div 
      v-if="showHistory && history.length > 0" 
      class="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl shadow-lg overflow-hidden"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-bg-border">
        <span class="text-xs font-semibold text-slate-500">Lịch sử tìm kiếm</span>
        <button type="button" @click.stop="clearHistory" class="text-xs text-rose-500 hover:text-rose-600">Xóa</button>
      </div>
      <ul class="max-h-48 overflow-y-auto py-1">
        <li 
          v-for="item in history" 
          :key="item"
          class="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-bg-surface flex items-center justify-between group"
          @click="selectHistory(item)"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <MfIcon name="history" size="14" className="text-slate-400 shrink-0" />
            <span class="truncate">{{ item }}</span>
          </div>
          <button 
            type="button"
            class="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 p-1"
            @click.stop="removeHistoryItem(item)"
          >
            <MfIcon name="close" size="14" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Tìm kiếm...' },
  icon: { type: String, default: 'search' },
  historyKey: { type: String, default: 'admin-search-history' },
  maxHistory: { type: Number, default: 5 },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'search', 'input'])

const internalValue = ref(props.modelValue)
const showHistory = ref(false)
const history = ref([])
const containerRef = ref(null)
const inputRef = ref(null)

// Sync from parent
watch(() => props.modelValue, (val) => {
  if (val !== internalValue.value) {
    internalValue.value = val
  }
})

// Load history
const loadHistory = () => {
  if (!props.historyKey) return
  try {
    const saved = localStorage.getItem(props.historyKey)
    if (saved) {
      history.value = JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load search history', e)
  }
}

// Save history
const saveHistory = () => {
  if (!props.historyKey || !internalValue.value.trim()) return
  try {
    const val = internalValue.value.trim()
    let newHistory = history.value.filter(item => item !== val)
    newHistory.unshift(val)
    if (newHistory.length > props.maxHistory) {
      newHistory = newHistory.slice(0, props.maxHistory)
    }
    history.value = newHistory
    localStorage.setItem(props.historyKey, JSON.stringify(newHistory))
  } catch (e) {
    console.error('Failed to save search history', e)
  }
}

const clearHistory = () => {
  history.value = []
  if (props.historyKey) localStorage.removeItem(props.historyKey)
  inputRef.value?.focus()
}

const removeHistoryItem = (item) => {
  history.value = history.value.filter(i => i !== item)
  if (props.historyKey) localStorage.setItem(props.historyKey, JSON.stringify(history.value))
  inputRef.value?.focus()
}

let timeout = null
const onInput = () => {
  emit('update:modelValue', internalValue.value)
  emit('input', internalValue.value)
  
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => {
    emit('search', internalValue.value)
  }, 400)
  
  // Hide history if user is typing
  showHistory.value = false
}

const onFocus = () => {
  loadHistory()
  if (history.value.length > 0 && !internalValue.value) {
    showHistory.value = true
  }
}

const saveToHistoryAndSearch = () => {
  showHistory.value = false
  saveHistory()
  emit('search', internalValue.value)
}

const selectHistory = (item) => {
  internalValue.value = item
  showHistory.value = false
  emit('update:modelValue', item)
  emit('search', item)
}

const clearInput = () => {
  internalValue.value = ''
  emit('update:modelValue', '')
  emit('input', '')
  emit('search', '')
  showHistory.value = true
  inputRef.value?.focus()
}

const handleClickOutside = (e) => {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    showHistory.value = false
    // Also save history on blur if there's a valid search
    if (internalValue.value.trim()) {
      saveHistory()
    }
  }
}

onMounted(() => {
  loadHistory()
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>
