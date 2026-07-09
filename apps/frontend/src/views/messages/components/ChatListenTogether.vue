<template>
  <div v-if="conversationId && isListenTogetherActive" class="w-full bg-[#1f232e] border-b border-indigo-500/30 flex items-center justify-between px-4 py-2 shrink-0 animate-fade-in shadow-[0_4px_20px_-5px_rgba(99,102,241,0.3)] z-10 relative">
    <div class="flex items-center gap-3 overflow-hidden">
      <!-- Animated equalizer icon -->
      <div class="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/50 border border-white/10 flex items-center justify-center">
        <img v-if="sessionSong?.cover_url" :src="normalizeImageUrl(sessionSong.cover_url)" alt="" class="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div v-if="listenSession?.is_playing" class="flex items-end justify-center gap-[2px] h-4 z-10">
          <div class="w-[3px] bg-[#6366f1] rounded-t-sm animate-[bounce_1s_ease-in-out_infinite_0.1s]"></div>
          <div class="w-[3px] bg-[#6366f1] rounded-t-sm animate-[bounce_1s_ease-in-out_infinite_0.3s]"></div>
          <div class="w-[3px] bg-[#6366f1] rounded-t-sm animate-[bounce_1s_ease-in-out_infinite_0.2s]"></div>
        </div>
        <MfIcon v-else name="pause" size="18" className="text-white z-10 drop-shadow-md" />
      </div>

      <div class="flex flex-col min-w-0">
        <div class="text-[13px] font-bold text-white flex items-center gap-1.5 truncate">
          <span class="truncate">{{ listenSession?.host_name || 'Đang tải...' }}</span>
          <span class="text-[#6366f1] shrink-0 font-medium text-[11px] px-1.5 py-0.5 bg-[#6366f1]/10 rounded-md">Host</span>
        </div>
        <div class="text-[12px] text-gray-400 truncate flex items-center gap-1">
          <span v-if="sessionSong" class="truncate">{{ sessionSong.title }} • {{ sessionSong.artist_name }}</span>
          <span v-else>Đang chọn bài...</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0 ml-4">
      <template v-if="isHost">
        <button @click="endSession" class="px-3 py-1.5 text-[12px] font-bold text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition">
          Kết thúc
        </button>
      </template>
      <template v-else>
        <button v-if="!isParticipant" @click="joinSession" class="px-4 py-1.5 text-[12px] font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] rounded-lg shadow-md transition whitespace-nowrap">
          Tham gia
        </button>
        <button v-else @click="leaveSession" class="px-3 py-1.5 text-[12px] font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition whitespace-nowrap border border-white/5">
          Rời phiên
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { messagesApi } from '@/api/messages'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useMessagesStore } from '@/stores/messages'
import { useToastStore } from '@/stores/toast'
import { normalizeImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  conversationId: {
    type: [Number, String],
    required: true
  }
})

const emit = defineEmits(['session-updated'])

const authStore = useAuthStore()
const playerStore = usePlayerStore()
const messagesStore = useMessagesStore()
const toast = useToastStore()

const listenSession = ref(null)
const isParticipant = ref(false)
const syncingFromRemote = ref(false)

const isListenTogetherActive = computed(() => !!listenSession.value && listenSession.value.status === 'active')
const isHost = computed(() => listenSession.value?.host_user_id === authStore.user?.id)
const sessionSong = computed(() => listenSession.value?.song)

let socketEventsBound = false
let positionUpdateInterval = null

function getSocket() {
  return messagesStore.socket
}

// ----------------------------------------------------------------------------
// API Fetching & State Management
// ----------------------------------------------------------------------------
async function fetchSession() {
  if (!props.conversationId) return
  try {
    const res = await messagesApi.getListenSession(props.conversationId)
    listenSession.value = res.data?.data || null
    emit('session-updated', listenSession.value)
    
    // Auto-participant logic if needed, but MVP requires explicit join
    if (!listenSession.value || listenSession.value.status !== 'active') {
      isParticipant.value = false
    }
  } catch (err) {
    console.error('Lỗi khi lấy phiên nghe chung:', err)
  }
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------
async function joinSession() {
  try {
    const res = await messagesApi.joinListenSession(props.conversationId)
    listenSession.value = res.data?.data
    isParticipant.value = true
    toast.showToast(`Đã tham gia nghe chung với ${listenSession.value.host_name}`, 'success')
    syncPlayerWithSession(listenSession.value)
  } catch (err) {
    toast.showToast('Không thể tham gia phiên nghe chung', 'error')
  }
}

async function leaveSession() {
  try {
    await messagesApi.leaveListenSession(props.conversationId)
    isParticipant.value = false
    toast.showToast('Đã rời phiên nghe chung', 'info')
  } catch (err) {
    console.error('Error leaving session', err)
  }
}

async function endSession() {
  try {
    await messagesApi.endListenSession(props.conversationId)
    listenSession.value = null
    isParticipant.value = false
  } catch (err) {
    toast.showToast('Lỗi kết thúc phiên nghe chung', 'error')
  }
}

// ----------------------------------------------------------------------------
// Sync Logic
// ----------------------------------------------------------------------------
function syncPlayerWithSession(session) {
  if (!session || !isParticipant.value || isHost.value) return
  
  syncingFromRemote.value = true
  
  try {
    if (session.song && session.song.id) {
      // Check if need to change song
      if (!playerStore.currentSong || playerStore.currentSong.id !== session.song.id) {
        playerStore.setSong(session.song)
      }
      
      // Calculate real position based on updated_at
      let targetPos = session.position_seconds
      if (session.is_playing && session.updated_at) {
        const elapsed = (Date.now() - new Date(session.updated_at).getTime()) / 1000
        targetPos += elapsed
      }
      
      // Apply play/pause and seek
      if (session.is_playing) {
        if (!playerStore.isPlaying) playerStore.togglePlay()
        // Wait a bit for audio to start before seeking to be safe
        setTimeout(() => {
          playerStore.seek(targetPos)
        }, 100)
      } else {
        if (playerStore.isPlaying) playerStore.togglePlay()
        playerStore.seek(targetPos)
      }
    }
  } catch (e) {
    console.error('Error syncing player', e)
  } finally {
    // Release lock after a short delay to prevent immediate watch trigger
    setTimeout(() => {
      syncingFromRemote.value = false
    }, 500)
  }
}

function emitControlUpdate(action) {
  if (!isHost.value || syncingFromRemote.value) return
  
  const socket = getSocket()
  if (!socket) return
  
  const payload = {
    conversationId: props.conversationId,
    action,
    currentSongId: playerStore.currentSong?.id || null,
    positionSeconds: playerStore.currentTime || 0,
    isPlaying: playerStore.isPlaying,
    clientTimestamp: Date.now()
  }
  
  socket.emit('listen_together:control', payload)
}

// ----------------------------------------------------------------------------
// Watchers for Host to Emit Control
// ----------------------------------------------------------------------------
watch(() => playerStore.isPlaying, (newVal) => {
  if (isHost.value && !syncingFromRemote.value) {
    emitControlUpdate(newVal ? 'play' : 'pause')
  }
})

watch(() => playerStore.currentSong?.id, (newVal, oldVal) => {
  if (isHost.value && !syncingFromRemote.value && newVal !== oldVal) {
    emitControlUpdate('change_song')
  }
})

// We shouldn't watch progress deeply every second, we expose a public method for parent or player to call when seeking
// For MVP, if they seek, we can detect large jumps but playerStore doesn't expose a clean 'onSeek' event.
// We can set an interval to sync state occasionally to ensure it's fresh for late joiners
function startHostSyncInterval() {
  stopHostSyncInterval()
  positionUpdateInterval = setInterval(() => {
    if (isHost.value && playerStore.isPlaying && !syncingFromRemote.value) {
      emitControlUpdate('sync')
    }
  }, 10000) // sync every 10s just to update DB position
}

function stopHostSyncInterval() {
  if (positionUpdateInterval) {
    clearInterval(positionUpdateInterval)
    positionUpdateInterval = null
  }
}

// ----------------------------------------------------------------------------
// Socket Handlers
// ----------------------------------------------------------------------------
function handleSessionStarted(data) {
  if (Number(data.conversation_id) !== Number(props.conversationId)) return
  listenSession.value = data
  isParticipant.value = false
  emit('session-updated', listenSession.value)
  if (!isHost.value) {
    toast.showToast(`${data.host_name} đã bắt đầu phiên nghe cùng nhau`, 'info')
  } else {
    startHostSyncInterval()
  }
}

function handleSessionEnded({ conversationId }) {
  if (Number(conversationId) !== Number(props.conversationId)) return
  listenSession.value = null
  isParticipant.value = false
  emit('session-updated', null)
  stopHostSyncInterval()
  toast.showToast('Phiên nghe cùng nhau đã kết thúc', 'info')
}

function handleControlUpdated({ conversationId, session, action }) {
  if (Number(conversationId) !== Number(props.conversationId)) return
  listenSession.value = session
  if (isParticipant.value && !isHost.value) {
    syncPlayerWithSession(session)
  }
}

function bindSocketEvents() {
  const socket = getSocket()
  if (!socket || socketEventsBound) return
  socket.on('listen_together:session_started', handleSessionStarted)
  socket.on('listen_together:session_ended', handleSessionEnded)
  socket.on('listen_together:control_updated', handleControlUpdated)
  socketEventsBound = true
}

function unbindSocketEvents() {
  const socket = getSocket()
  if (!socket || !socketEventsBound) return
  socket.off('listen_together:session_started', handleSessionStarted)
  socket.off('listen_together:session_ended', handleSessionEnded)
  socket.off('listen_together:control_updated', handleControlUpdated)
  socketEventsBound = false
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------
watch(() => props.conversationId, () => {
  listenSession.value = null
  isParticipant.value = false
  fetchSession()
})

onMounted(() => {
  fetchSession()
  bindSocketEvents()
  // Wait a bit for socket to connect if it hasn't
  setTimeout(bindSocketEvents, 2000)
})

onBeforeUnmount(() => {
  unbindSocketEvents()
  stopHostSyncInterval()
})

// Expose start method for parent
defineExpose({
  async startListenTogether() {
    try {
      const payload = {
        currentSongId: playerStore.currentSong?.id || null,
        isPlaying: playerStore.isPlaying,
        positionSeconds: playerStore.currentTime || 0
      }
      const res = await messagesApi.startListenSession(props.conversationId, payload)
      listenSession.value = res.data?.data
      isParticipant.value = true // Host is always participant
      startHostSyncInterval()
    } catch (err) {
      toast.showToast('Lỗi khi bắt đầu nghe cùng nhau', 'error')
    }
  }
})
</script>
