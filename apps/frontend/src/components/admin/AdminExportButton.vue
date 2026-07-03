<template>
  <button
    class="admin-export-button"
    :class="{ 'is-loading': loading, 'is-disabled': disabled }"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <div class="btn-content" :class="{ 'opacity-0': loading }">
      <MfIcon :name="icon" size="18" class="mr-1.5" />
      <span>{{ label }}</span>
    </div>
    <div v-if="loading" class="loading-overlay">
      <MfIcon name="sync" size="16" class="animate-spin mr-1.5" />
      <span>Đang xuất...</span>
    </div>
  </button>
</template>

<script setup>
import MfIcon from '@/components/common/MfIcon.vue'

defineProps({
  label: {
    type: String,
    default: 'Xuất báo cáo'
  },
  loading: Boolean,
  disabled: Boolean,
  icon: {
    type: String,
    default: 'download'
  }
})

defineEmits(['click'])
</script>

<style scoped>
.admin-export-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: white;
  color: #475569; /* text-slate-600 */
  border: 1px solid #e2e8f0; /* border-slate-200 */
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  height: 40px;
  min-width: 130px;
  overflow: hidden;
  white-space: nowrap;
}

.admin-export-button:hover:not(:disabled) {
  background-color: #f8fafc; /* bg-slate-50 */
  color: #334155; /* text-slate-700 */
  border-color: #cbd5e1; /* border-slate-300 */
}

.admin-export-button:active:not(:disabled) {
  background-color: #f1f5f9; /* bg-slate-100 */
}

.admin-export-button.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #f8fafc;
}

.btn-content {
  display: flex;
  align-items: center;
  transition: opacity 0.2s;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1; /* text-indigo-500 */
  background-color: #e0e7ff; /* bg-indigo-50 */
  font-weight: 600;
}
</style>
