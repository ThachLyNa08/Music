<template>
  <div class="flex items-center justify-center my-0.5 px-4">
    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 backdrop-blur-sm border border-white/5 shadow-sm max-w-[85%] sm:max-w-md mx-auto">
      <!-- Show avatar if available, otherwise show icon -->
      <img
        v-if="message.sender?.avatar_url"
        :src="normalizeImageUrl(message.sender.avatar_url)"
        alt=""
        class="w-5 h-5 rounded-full object-cover flex-shrink-0"
      />
      <div v-else class="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-700/50 text-slate-300">
        <!-- Listen Together icon -->
        <svg v-if="isListenTogether" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.536l8-1.6v5.178A4.369 4.369 0 0015 11c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
        <!-- Pinned icon -->
        <svg v-else-if="isPinned" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <!-- Info icon -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
      </div>
      <span class="text-xs font-medium text-slate-400 break-words line-clamp-2 leading-tight">
        {{ displayText }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeImageUrl } from '@/utils/imageUrl'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  message: {
    type: Object,
    required: true
  }
})

const auth = useAuthStore()

const isListenTogether = computed(() => {
  return props.message.system_event_type === 'listen_together_started' || 
         props.message.system_event_type === 'listen_together_ended'
})

const isPinned = computed(() => {
  return props.message.system_event_type === 'message_pinned'
})

const displayText = computed(() => {
  let text = props.message.body
  const isMe = props.message.sender?.id === auth.user?.id

  if (isMe) {
    if (props.message.system_event_type === 'listen_together_started') {
      return 'Bạn đã bắt đầu phiên nghe cùng nhau'
    }
    if (props.message.system_event_type === 'message_pinned') {
      return text.replace(/^.*? đã ghim /, 'Bạn đã ghim ')
    }
  }
  
  return text
})
</script>
