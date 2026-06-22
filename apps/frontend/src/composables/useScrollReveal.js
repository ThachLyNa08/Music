// useScrollReveal.js
// Vue 3 composable ported from musicflow-animations.js.
// Reveal animation reusable, scope đến rootRef, supports:
//   .reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-blur
//   .workflow-progress-fill (delay 400ms)
//   .ai-playlist-item (--item-index), .workflow-step (--step-index)
//
// Reduced-motion safe: nếu user bật reduce-motion, show tất cả element ngay
// và skip animation. IntersectionObserver chỉ observe trong rootRef, không
// query toàn document. Cleanup on unmount.

import { onBeforeUnmount, onMounted, watch } from 'vue'

const REVEAL_SELECTOR =
  '.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-blur'

function isReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function showAll(root) {
  if (!root) return
  const nodes = root.querySelectorAll(REVEAL_SELECTOR)
  nodes.forEach((el) => el.classList.add('is-visible'))
  const fills = root.querySelectorAll('.workflow-progress-fill')
  fills.forEach((el) => el.classList.add('is-visible'))
}

function setStagger(root) {
  if (!root) return
  const items = root.querySelectorAll('.ai-playlist-item')
  items.forEach((el, i) => el.style.setProperty('--item-index', String(i)))
  const steps = root.querySelectorAll('.workflow-step')
  steps.forEach((el, i) => el.style.setProperty('--step-index', String(i)))
}

function applyReveal(root) {
  if (!root) return null
  if (isReducedMotion()) {
    showAll(root)
    setStagger(root)
    return null
  }
  setStagger(root)

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          obs.unobserve(entry.target)
        }
      })
    },
    { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.1 },
  )
  root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => observer.observe(el))

  const progressObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('is-visible')
          }, 400)
          obs.unobserve(entry.target)
        }
      })
    },
    { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.3 },
  )
  root.querySelectorAll('.workflow-progress-fill').forEach((el) => progressObserver.observe(el))

  return { observer, progressObserver }
}

export function useScrollReveal(rootRef) {
  let handles = null

  function init() {
    if (handles) {
      handles.observer?.disconnect()
      handles.progressObserver?.disconnect()
      handles = null
    }
    if (!rootRef || !rootRef.value) return
    handles = applyReveal(rootRef.value)
  }

  onMounted(() => {
    // Đợi next tick để chắc chắn DOM đã render reveal classes.
    setTimeout(init, 50)
  })

  watch(
    () => rootRef?.value,
    () => init(),
  )

  onBeforeUnmount(() => {
    if (!handles) return
    handles.observer?.disconnect()
    handles.progressObserver?.disconnect()
    handles = null
  })
}
