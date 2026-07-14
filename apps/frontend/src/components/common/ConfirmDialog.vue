<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 transition-opacity" :class="themeClasses.overlay" @click="handleOverlayClick">
      <div class="mx-auto flex w-full max-w-md max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col rounded-2xl overflow-hidden shadow-2xl transition-all transform" :class="themeClasses.panel" @click.stop>
        <div class="px-6 pt-6 pb-4 flex justify-between items-center">
          <h3 class="text-lg font-bold m-0" :class="themeClasses.title">{{ title }}</h3>
          <button v-if="!loading" class="w-8 h-8 flex items-center justify-center rounded-full text-2xl leading-none transition-colors border-none bg-transparent cursor-pointer" :class="themeClasses.close" @click="close">&times;</button>
        </div>
        
        <div class="flex-1 overflow-y-auto px-6 pb-6">
          <slot>
            <p class="m-0 text-[15px] leading-relaxed" :class="themeClasses.message">{{ message }}</p>
          </slot>
        </div>
        
        <div class="shrink-0 px-6 py-4 flex justify-end gap-3" :class="themeClasses.footer">
          <button class="px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer border" :class="themeClasses.cancel" @click="close" :disabled="loading">
            {{ cancelText }}
          </button>
          <button class="px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer border-none text-white disabled:opacity-60 disabled:cursor-not-allowed" :class="themeClasses.confirm(type)" @click="confirmAction" :disabled="loading">
            <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></span>
            {{ loading ? 'Đang xử lý...' : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Xác nhận'
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: 'Xác nhận'
  },
  cancelText: {
    type: String,
    default: 'Hủy'
  },
  type: {
    type: String,
    default: 'default', // default, danger, warning
    validator: (val) => ['default', 'danger', 'warning'].includes(val)
  },
  loading: {
    type: Boolean,
    default: false
  },
  theme: {
    type: String,
    default: 'light', // light | dark
    validator: (val) => ['light', 'dark'].includes(val)
  }
})

const emit = defineEmits(['update:open', 'confirm', 'cancel'])

const themeClasses = computed(() => {
  if (props.theme === 'dark') {
    return {
      overlay: 'bg-black/60 backdrop-blur-sm',
      panel: 'bg-zinc-900 border border-white/10',
      title: 'text-white',
      message: 'text-zinc-300',
      close: 'text-zinc-400 hover:text-white hover:bg-white/10',
      cancel: 'bg-white/5 border-white/10 text-white hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed',
      footer: 'border-t border-white/10 bg-zinc-900/50',
      confirm: (type) => {
        if (type === 'danger') return 'bg-rose-500 hover:bg-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
        if (type === 'warning') return 'bg-amber-500 hover:bg-amber-600'
        return 'bg-violet-600 hover:bg-violet-700'
      }
    }
  }

  // Light theme
  return {
    overlay: 'bg-slate-900/40 backdrop-blur-sm',
    panel: 'bg-white border border-slate-200',
    title: 'text-slate-900',
    message: 'text-slate-600',
    close: 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
    cancel: 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed',
    footer: 'bg-slate-50 border-t border-slate-100',
    confirm: (type) => {
      if (type === 'danger') return 'bg-rose-500 hover:bg-rose-600'
      if (type === 'warning') return 'bg-amber-500 hover:bg-amber-600'
      return 'bg-blue-600 hover:bg-blue-700'
    }
  }
})

function close() {
  if (props.loading) return
  emit('update:open', false)
  emit('cancel')
}

function handleOverlayClick() {
  if (props.loading) return
  close()
}

function confirmAction() {
  if (props.loading) return
  emit('confirm')
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.open) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

watch(() => props.open, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
/* Scoped styles are mostly removed since we use Tailwind. Keep only custom animations if needed, though Tailwind covers transitions well. */
</style>
