<template>
  <div class="relative rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" :style="maxHeight ? { maxHeight } : {}" :class="[maxHeight ? 'flex-1 min-h-0' : '']">
    <!-- Loading Overlay -->
    <div v-if="loading" class="absolute inset-0 bg-white/60 dark:bg-slate-900/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
      <div class="w-8 h-8 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>

    <!-- Error State -->
    <div v-if="error && !loading" class="p-12 text-center text-rose-500 flex-1 flex flex-col items-center justify-center">
      <MfIcon name="error" size="48" class="mb-4 opacity-50 mx-auto" />
      <slot name="error">
        <p class="text-lg font-bold">Lỗi tải dữ liệu</p>
        <p class="text-sm mt-1 opacity-80">{{ error }}</p>
      </slot>
    </div>

    <!-- Empty State -->
    <div v-else-if="empty && !loading" class="p-12 text-center text-slate-400 flex-1 flex flex-col items-center justify-center">
      <MfIcon name="info" size="48" class="mb-4 opacity-30 mx-auto" />
      <slot name="empty">
        <p class="text-lg font-bold text-slate-500">{{ emptyTitle }}</p>
        <p class="text-sm mt-1">{{ emptyDescription }}</p>
      </slot>
    </div>

    <!-- Table Content -->
    <div v-show="!error && !empty" class="w-full relative rounded-2xl" :class="[maxHeight ? 'overflow-auto flex-1 min-h-0' : 'overflow-x-auto overflow-y-visible']">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import MfIcon from '@/components/common/MfIcon.vue'

defineProps({
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  error: { type: [String, Object, Boolean], default: false },
  emptyTitle: { type: String, default: 'Không có dữ liệu' },
  emptyDescription: { type: String, default: 'Hiện tại chưa có dữ liệu nào được tìm thấy.' },
  maxHeight: { type: String, default: '' }
})
</script>
