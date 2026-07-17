<template>
  <section class="mf-glass-panel p-6">
    <label class="mb-4 block text-xs font-bold uppercase tracking-widest text-white/70">Bạn muốn nghe gì?</label>
    <textarea
      :value="modelValue"
      :disabled="disabled"
      class="min-h-[120px] w-full resize-y rounded-xl border border-white/5 bg-black/20 px-5 py-4 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/30 hover:bg-black/30 focus:bg-black/40 focus:border-[#1ed760]/40 focus:ring-1 focus:ring-[#1ed760]/20 disabled:cursor-not-allowed disabled:opacity-60"
      placeholder="Ví dụ: Nhạc buồn nhưng đừng quá thảm, nghe buổi tối..."
      @input="$emit('update:modelValue', $event.target.value)"
    />

    <div class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="inline-flex items-center gap-3">
        <span class="text-[13px] font-medium text-white/60">Số lượng:</span>
        <div class="flex rounded-full bg-black/30 p-1 border border-white/5 shadow-inner">
          <button
            v-for="count in [10, 20, 30]"
            :key="count"
            type="button"
            :class="[
              'rounded-full px-5 py-1.5 text-xs font-bold transition-all duration-200',
              targetCount === count ? 'bg-white/10 text-white shadow-md border border-white/10' : 'text-white/50 hover:text-white border border-transparent'
            ]"
            @click="$emit('update:targetCount', count)"
          >
            {{ count }}
          </button>
        </div>
      </div>

      <label v-if="showLlmToggle" class="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#b3b3b3] transition hover:text-white">
        <input
          :checked="useLLM"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-600 bg-gray-700 text-[#1ed760] focus:ring-[#1ed760]"
          @change="$emit('update:useLLM', $event.target.checked)"
        />
        Dùng LLM
      </label>
    </div>

    <div v-if="quota" class="mt-4 flex flex-col gap-2 rounded-lg bg-black/20 p-3 text-xs border border-white/5">
      <span v-if="quota.isPremium" class="text-amber-400 font-medium flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>
        Premium: Không giới hạn lượt tạo AI Playlist
      </span>
      <span v-else-if="quota.remaining > 0" class="text-white/80 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Còn {{ quota.remaining }}/{{ quota.limit }} lượt tạo AI Playlist miễn phí hôm nay
      </span>
      <span v-else class="text-rose-400 font-medium leading-relaxed">
        Bạn đã dùng hết {{ quota.limit }} lượt tạo AI Playlist miễn phí hôm nay. Nâng cấp Premium để tạo không giới hạn hoặc quay lại vào ngày mai.
      </span>
    </div>

    <button
      type="button"
      :disabled="disabled || !modelValue.trim() || (quota && !quota.isPremium && quota.remaining <= 0)"
      class="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#1ed760] px-6 text-sm font-bold text-black transition-all hover:bg-[#1fdf64] hover:shadow-[0_4px_15px_rgba(30,215,96,0.25)] hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none disabled:hover:translate-y-0"
      @click="$emit('submit')"
    >
      <span v-if="loading">Đang tạo playlist...</span>
      <span v-else>Tạo playlist</span>
    </button>
  </section>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  targetCount: { type: Number, default: 20 },
  useLLM: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  showLlmToggle: { type: Boolean, default: false },
  quota: { type: Object, default: null }
})

defineEmits(['update:modelValue', 'update:targetCount', 'update:useLLM', 'submit'])
</script>
