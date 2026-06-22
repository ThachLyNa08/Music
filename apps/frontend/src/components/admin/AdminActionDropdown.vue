<template>
  <div class="relative" ref="dropdownRef">
    <button @click.stop="toggle" class="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white dark:bg-bg-card dark:border-bg-border hover:bg-gray-50 dark:hover:bg-bg-surface text-gray-500 transition-colors" title="Thao tác">
      <MfIcon name="more_vert" size="20" />
    </button>
    
    <Teleport to="body">
      <div v-if="isOpen" 
           ref="menuRef"
           class="fixed w-48 bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl shadow-xl z-[80] overflow-hidden" 
           :style="menuStyle">
        <div class="py-1">
          <button v-for="(action, index) in actions" :key="index" 
                  @click.stop="handleAction(action)" 
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  :class="colorClasses(action.variant)"
                  :disabled="action.disabled">
            <MfIcon :name="action.icon" size="18" />
            {{ action.label }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  actions: {
    type: Array,
    required: true,
  }
})

const isOpen = ref(false)
const dropdownRef = ref(null)
const menuRef = ref(null)
const menuStyle = ref({})

function colorClasses(variant) {
  if (variant === 'danger') return 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10'
  if (variant === 'success') return 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
  if (variant === 'warning') return 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
  return 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-bg-card hover:text-indigo-600'
}

function toggle() {
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  
  isOpen.value = true
  
  nextTick(() => {
    if (!dropdownRef.value || !menuRef.value) return
    const buttonRect = dropdownRef.value.getBoundingClientRect()
    const menuRect = menuRef.value.getBoundingClientRect()
    
    let top = buttonRect.bottom + 4
    let left = buttonRect.right - menuRect.width
    
    if (top + menuRect.height > window.innerHeight) {
      top = buttonRect.top - menuRect.height - 4
    }
    
    menuStyle.value = {
      top: `${top}px`,
      left: `${left}px`
    }
  })
}

function handleAction(action) {
  if (action.disabled) return
  isOpen.value = false
  if (action.onClick) action.onClick()
}

function closeDropdown() {
  isOpen.value = false
}

function handleClickOutside(e) {
  if (!isOpen.value) return
  if (dropdownRef.value && dropdownRef.value.contains(e.target)) return
  if (menuRef.value && menuRef.value.contains(e.target)) return
  closeDropdown()
}

function handleEscape(e) {
  if (e.key === 'Escape' && isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  window.addEventListener('scroll', closeDropdown, true) // capture phase for scroll
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
  window.removeEventListener('scroll', closeDropdown, true)
})
</script>
