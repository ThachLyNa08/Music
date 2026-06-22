import { ref } from 'vue'

export const toasts = ref([])
let idCounter = 0

export const addToast = (message, type = 'success', duration = 3000) => {
  const id = idCounter++
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}
