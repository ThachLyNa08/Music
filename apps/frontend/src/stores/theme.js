import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Spotify-styled theme store
 * Spotify uses dark-first design - always dark theme
 */
export const useThemeStore = defineStore('theme', () => {
  // Spotify is always dark - no light mode
  const isDark = ref(true)

  // Keep dark theme always
  function applyTheme() {
    document.documentElement.classList.add('dark')
  }

  // Apply on init
  applyTheme()

  return { isDark, applyTheme }
})
