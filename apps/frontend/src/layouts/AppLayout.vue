<template>
  <div class="user-layout-surface min-h-screen w-full overflow-x-hidden text-gray-200 font-sans">
    <!-- SIDEBAR DRAWER OVERLAY -->
    <div 
      v-if="isLeftSidebarOpen"
      class="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm md:hidden"
      @click="isLeftSidebarOpen = false"
    ></div>

    <!-- SIDEBAR -->
    <aside class="sidebar-scroll fixed left-0 top-0 bottom-0 z-[90] flex w-[280px] md:w-[220px] flex-col overflow-y-auto border-r border-white/10 bg-[#080b14]/95 p-4 pb-28 backdrop-blur-xl transition-transform duration-300 md:translate-x-0"
           :class="isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full'">
      <!-- Brand -->
      <div class="mb-5 flex h-20 items-center gap-3 px-2">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/20 shadow-lg shadow-violet-950/30">
          <img src="/logo.png" alt="MusicFlow" class="h-8 w-8 object-contain opacity-95" />
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-lg font-extrabold text-white">MusicFlow</h1>
          <p class="text-xs font-semibold text-slate-400">Premium Audio</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex flex-col gap-1.5" @click="isLeftSidebarOpen = false">
        <RouterLink 
          v-for="item in navItems" 
          :key="item.to" 
          :to="item.to" 
          class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm no-underline transition-all duration-200 group"
          :class="isActive(item.to) ? 'border border-white/10 bg-white/[0.10] font-bold text-white shadow-lg shadow-black/10' : 'border border-transparent font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white'"
        >
          <MfIcon :name="item.icon" size="20" className="shrink-0 transition-colors" :class="isActive(item.to) ? 'text-white' : 'text-slate-500 group-hover:text-white'" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span
            v-if="item.to === '/messages' && messageUnreadCount > 0"
            class="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-pink-500 px-1.5 text-[10px] font-black leading-none text-white shadow-sm shadow-pink-950/30"
          >
            {{ messageUnreadLabel }}
          </span>
        </RouterLink>

        <div class="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      </nav>

      <div class="flex-1" />

      <!-- Playlists section -->
      <div class="py-4" @click="isLeftSidebarOpen = false">
        <div class="px-4 pb-2 pt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Thư viện</div>
        
        <RouterLink to="/liked-songs" class="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-all duration-200 no-underline group" :class="isActive('/liked-songs') ? 'border border-white/10 bg-white/[0.10]' : 'border border-transparent hover:bg-white/[0.06]'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md transition-transform group-hover:scale-105">
            <MfIcon name="favorite" filled size="18" />
          </div>
          <span class="truncate text-sm font-semibold" :class="isActive('/liked-songs') ? 'text-white' : 'text-slate-400 group-hover:text-white'">Bài hát yêu thích</span>
        </RouterLink>
        
        <RouterLink to="/recently-played" class="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-all duration-200 no-underline group" :class="isActive('/recently-played') ? 'border border-white/10 bg-white/[0.10]' : 'border border-transparent hover:bg-white/[0.06]'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md transition-transform group-hover:scale-105">
            <MfIcon name="history" size="18" />
          </div>
          <span class="truncate text-sm font-semibold" :class="isActive('/recently-played') ? 'text-white' : 'text-slate-400 group-hover:text-white'">Nghe gần đây</span>
        </RouterLink>
        
        <RouterLink to="/me/followed-artists" class="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-all duration-200 no-underline group" :class="isActive('/me/followed-artists') ? 'border border-white/10 bg-white/[0.10]' : 'border border-transparent hover:bg-white/[0.06]'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md transition-transform group-hover:scale-105">
            <MfIcon name="group" filled size="18" />
          </div>
          <span class="truncate text-sm font-semibold" :class="isActive('/me/followed-artists') ? 'text-white' : 'text-slate-400 group-hover:text-white'">Nghệ sĩ đã follow</span>
        </RouterLink>
      </div>

      <!-- Create playlist -->
      <button class="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-sm font-extrabold text-white transition hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-950/40" @click="$router.push('/library')">
        <MfIcon name="add" size="18" />
        Tạo Playlist
      </button>
    </aside>

    <!-- MAIN AREA -->
    <div
      class="relative flex min-h-screen flex-col user-layout-surface overflow-hidden md:ml-[220px]"
      :class="isRightSidebarOpen ? '2xl:mr-[320px]' : '2xl:mr-0'"
    >
      <UserTopbar :is-queue-open="isRightSidebarOpen" />

      <!-- Page content -->
      <main class="relative z-10 flex-1 pt-16" :class="isActive('/messages') ? 'pb-[80px]' : 'pb-[96px]'">
        <RouterView />
      </main>
    </div>

    <!-- QUEUE OVERLAY (for < 2xl) -->
    <div
      v-if="isRightSidebarOpen"
      class="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[1px] 2xl:hidden"
      @click="isRightSidebarOpen = false"
    ></div>

    <!-- RIGHT SIDEBAR -->
    <aside
      class="fixed inset-x-0 bottom-[80px] z-[90] flex flex-col w-full max-h-[75vh] md:max-h-none md:inset-auto md:right-0 md:top-0 md:bottom-[80px] md:w-[320px] overflow-hidden md:border-l border-t md:border-t-0 border-white/10 rounded-t-2xl md:rounded-none bg-[#070a12]/95 backdrop-blur-xl shadow-[0_-18px_45px_rgba(0,0,0,0.38)] md:shadow-[0_18px_45px_rgba(0,0,0,0.38)] transition-transform duration-300 ease-out will-change-transform"
      :class="isRightSidebarOpen ? 'translate-y-0 md:translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <h3 class="text-sm font-bold text-white m-0">Danh sách chờ</h3>
        <button class="bg-transparent border-none text-gray-500 cursor-pointer p-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors" @click="isRightSidebarOpen = false">
          <MfIcon name="close" size="18" />
        </button>
      </div>
      
      <div class="sidebar-scroll flex-1 overflow-y-auto p-5">
        <div class="mb-6" v-if="player.currentSong">
          <div class="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-3">Đang phát</div>
          <div class="flex items-center gap-3 rounded-xl border border-violet-400/40 bg-violet-500/10 p-3">
            <img :src="$formatImageUrl(player.currentSong.cover_url)" @error="event => event.target.src = '/default-cover.png'" class="w-14 h-14 rounded-lg object-cover shadow-md shrink-0" />
            <div class="flex flex-col gap-1 overflow-hidden">
              <div class="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{{ player.currentSong.title }}</div>
              <div class="text-xs font-semibold text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{{ player.currentSong.artist_name || player.currentSong.artist }}</div>
            </div>
          </div>
        </div>

        <div>
          <div class="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">Tiếp theo</div>
          <div class="text-xs text-gray-600 font-medium text-center py-8" v-if="upcomingSongs.length === 0">Chưa có bài hát nào.</div>
          <div v-else-if="player.shuffle" class="text-[11px] text-[#1ED760] font-medium text-center py-2 mb-2 bg-[#1ED760]/10 rounded-lg border border-[#1ED760]/20">
            Đang bật phát ngẫu nhiên, tắt Shuffle để sắp xếp hàng chờ.
          </div>
          <draggable
            v-if="canReorderQueue"
            v-model="upcomingQueueModel"
            item-key="id"
            tag="div"
            class="flex flex-col gap-1.5"
            handle=".queue-drag-handle"
            ghost-class="queue-row--ghost"
            chosen-class="queue-row--dragging"
            :animation="160"
          >
            <template #item="{ element: song, index }">
              <div
                class="queue-row user-row flex items-center gap-3 p-2.5 cursor-pointer group border border-transparent hover:border-white/10"
                @click="player.setSong(song)"
              >
                <button
                  class="queue-drag-handle flex h-10 w-7 shrink-0 cursor-grab items-center justify-center text-slate-500 transition active:cursor-grabbing group-hover:text-slate-300"
                  title="Keo de sap xep"
                  aria-label="Keo de sap xep"
                  @click.stop
                >
                  <MfIcon name="drag_indicator" size="18" />
                </button>
                <img :src="$formatImageUrl(song.cover_url || song.cover)" @error="event => event.target.src = '/default-cover.png'" class="w-11 h-11 rounded-md object-cover shadow-sm shrink-0" />
                <div class="flex min-w-0 flex-col overflow-hidden">
                  <div class="text-sm font-semibold text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-white">{{ song.title }}</div>
                  <div class="text-xs font-medium text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ song.artist_name || song.artist }}</div>
                </div>
                <button
                  class="ml-auto opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  title="Xóa khỏi danh sách chờ"
                  @click.stop="player.removeFromQueue(player.queueIndex + 1 + index)"
                >
                  <MfIcon name="close" size="18" />
                </button>
              </div>
            </template>
          </draggable>
          <div class="flex flex-col gap-1.5" v-else>
            <div 
              v-for="(song, idx) in upcomingSongs" 
              :key="song.id + '-' + idx" 
              class="queue-row user-row flex items-center gap-3 p-2.5 cursor-pointer group border border-transparent hover:border-white/10"
              @click="player.setSong(song)"
            >
              <img :src="$formatImageUrl(song.cover_url || song.cover)" @error="event => event.target.src = '/default-cover.png'" class="w-11 h-11 rounded-md object-cover shadow-sm shrink-0" />
              <div class="flex min-w-0 flex-col overflow-hidden">
                <div class="text-sm font-semibold text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-white">{{ song.title }}</div>
                <div class="text-xs font-medium text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ song.artist_name || song.artist }}</div>
              </div>
              <button
                class="ml-auto opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                title="Xóa khỏi danh sách chờ"
                @click.stop="player.removeFromQueue(player.queueIndex + 1 + idx)"
              >
                <MfIcon name="close" size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- PLAYER BAR -->
    <footer class="fixed bottom-0 left-0 right-0 z-[999] flex h-[64px] md:h-[80px] items-center justify-between border-t border-white/10 bg-[#05070d]/95 px-3 md:px-4 shadow-[0_-18px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <!-- Now playing -->
      <div class="flex items-center gap-2 md:gap-3 min-w-0 md:min-w-[200px] flex-1">
        <div class="w-10 h-10 md:w-[52px] md:h-[52px] rounded-[4px] bg-white/10 flex items-center justify-center shrink-0 overflow-hidden group shadow-lg">
          <img v-if="player.currentSong?.cover_url" :src="$formatImageUrl(player.currentSong.cover_url)" @error="event => event.target.src = '/default-cover.png'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <MfIcon v-else name="music_note" size="24" className="text-gray-600" />
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis hover:underline cursor-pointer" @click="player.currentSong && $router.push(`/song/${player.currentSong.id}`)">{{ player.currentSong?.title || 'Chưa phát gì' }}</span>
          <div class="flex items-center gap-1 text-xs font-medium text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
            <span class="hover:underline hover:text-white cursor-pointer truncate" @click="player.currentSong?.artist_id && $router.push(`/artist/${player.currentSong.artist_id}`)">{{ player.currentSong?.artist_name || player.currentSong?.artist || '---' }}</span>
            <span class="md:hidden shrink-0" v-if="player.currentSong">· {{ formatTime(displayCurrentTime) }} / {{ formatTime(player.duration) }}</span>
          </div>
        </div>
        <LikeButton
          v-if="player.currentSong"
          :song="player.currentSong"
          baseClass="bg-transparent border-none cursor-pointer p-2 shrink-0 rounded-full transition-all duration-200 hover:bg-white/10"
          activeClass="text-pink-500 hover:!bg-pink-500/10"
          inactiveClass="text-gray-400 hover:text-white"
          :size="20"
        />
      </div>

      <!-- Controls -->
      <div class="flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:flex-[2] md:max-w-[640px] shrink-0">
        <div class="flex items-center gap-1 md:gap-4">
          <!-- Shuffle -->
          <button class="hidden sm:block bg-transparent border-none cursor-pointer p-1 md:p-1.5 rounded-full transition-all duration-200" 
            :class="player.shuffle ? 'text-[#1ed760] hover:text-[#1fdf64]' : 'text-gray-500 hover:text-white'" 
            @click="player.toggleShuffle()" 
            :title="player.shuffle ? 'Tắt phát ngẫu nhiên' : 'Bật phát ngẫu nhiên'">
            <MfIcon name="shuffle" size="20" />
          </button>
          
          <!-- Previous -->
          <button class="hidden sm:block bg-transparent border-none cursor-pointer p-1 md:p-1.5 rounded-full transition-all duration-200 text-gray-400 hover:text-white" @click="player.prev()" title="Previous">
            <MfIcon name="skip_previous" size="20" />
          </button>
          
          <!-- Play/Pause -->
          <button class="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg border-none cursor-pointer mx-1" @click="player.togglePlay()" title="Play/Pause">
            <MfIcon v-if="!player.isPlaying" name="play_arrow" filled size="24" className="ml-0.5" />
            <MfIcon v-else name="pause" filled size="24" />
          </button>
          
          <!-- Next -->
          <button class="bg-transparent border-none cursor-pointer p-1 md:p-1.5 rounded-full transition-all duration-200 text-gray-400 hover:text-white" @click="player.next()" title="Next">
            <MfIcon name="skip_next" size="20" />
          </button>
          
          <!-- Repeat -->
          <button class="hidden sm:block bg-transparent border-none cursor-pointer p-1 md:p-1.5 rounded-full transition-all duration-200 relative" 
            :class="player.repeat !== 'none' ? 'text-[#1ed760] hover:text-[#1fdf64]' : 'text-gray-500 hover:text-white'" 
            :title="player.repeat === 'none' ? 'Bật lặp lại' : player.repeat === 'all' ? 'Đang lặp danh sách' : 'Đang lặp một bài'"
            @click="player.toggleRepeat()">
            <MfIcon name="repeat" size="20" />
            <span v-if="player.repeat === 'one'" class="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#1ed760] text-[8px] font-bold text-black">
              1
            </span>
          </button>
        </div>
        
        <!-- Progress -->
        <div class="absolute top-[-8px] left-0 right-0 h-[16px] md:relative md:top-auto md:left-auto md:right-auto md:h-1 flex items-center gap-2 w-full md:max-w-[500px] z-50">
          <span class="hidden md:block text-[11px] font-semibold text-gray-400 min-w-[36px] text-right">{{ formatTime(displayCurrentTime) }}</span>
          <div
            ref="progressBarRef"
            class="flex-1 h-full cursor-pointer relative group flex items-center touch-none select-none"
            @pointerdown="startSeekDrag"
          >
            <!-- Track -->
            <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] md:h-1 bg-white/15 md:rounded-full"></div>
            <!-- Fill -->
            <div class="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] md:h-1 bg-[#1ed760] md:bg-white md:rounded-full transition-colors group-hover:bg-[#1ed760] z-10" :style="`width:${displayPct}%`">
              <div class="hidden md:block absolute -right-1.5 -translate-y-1/2 top-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md transition-opacity"></div>
            </div>
          </div>
          <span class="hidden md:block text-[11px] font-semibold text-gray-400 min-w-[36px]">{{ formatTime(player.duration) }}</span>
        </div>
      </div>

      <!-- Right controls -->
      <div class="flex items-center gap-1 md:gap-3 flex-none md:flex-1 justify-end shrink-0">
        <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white" :class="{ 'text-[#1ed760]': isRightSidebarOpen }" @click="isRightSidebarOpen = !isRightSidebarOpen" title="Danh sách chờ">
          <MfIcon name="queue_music" size="20" />
        </button>
        
        <button
          class="hidden sm:block bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white"
          :class="{ 'text-[#1ed760]': isActive('/karaoke') }"
          title="Mở Karaoke"
          aria-label="Mở Karaoke"
          @click="router.push('/karaoke')"
        >
          <MfIcon name="mic_external_on" size="20" />
        </button>
        
        <div class="hidden md:flex items-center gap-1 group relative">
          <MfIcon :name="player.volume === 0 ? 'volume_off' : 'volume_up'" size="20" className="text-gray-500 group-hover:text-white transition-colors" />
          <div class="w-[80px] lg:w-[96px] h-1 bg-white/15 rounded-full relative cursor-pointer group-hover:bg-white/30">
            <input type="range" min="0" max="100" :value="player.volume * 100" @input="player.setVolume($event.target.value / 100)" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div class="absolute left-0 h-full bg-white rounded-full group-hover:bg-[#1ed760] transition-colors" :style="`width:${player.volume * 100}%`"></div>
          </div>
        </div>
        
        <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white" @click="player.isNowPlayingExpanded = true" title="Mở rộng">
          <MfIcon name="open_in_full" size="20" />
        </button>
      </div>
    </footer>

    <!-- Add To Playlist Modal -->
    <AddToPlaylistModal @success="msg => addToast(msg)" @error="msg => addToast(msg)" />

    <!-- Now Playing Overlay -->
    <NowPlayingView />

    <!-- Toast Manager -->
    <ToastManager />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useMessagesStore } from '@/stores/messages'
import AddToPlaylistModal from '@/components/playlist/AddToPlaylistModal.vue'
import UserTopbar from '@/components/layout/UserTopbar.vue'
import NowPlayingView from '@/views/player/NowPlayingView.vue'
import ToastManager from '@/components/common/ToastManager.vue'
import LikeButton from '@/components/common/LikeButton.vue'
import { addToast } from '@/utils/toast'

const player = usePlayerStore()
const library = useLibraryStore()
const messagesStore = useMessagesStore()
const router = useRouter()

const pct = computed(() => player.duration ? (player.currentTime / player.duration) * 100 : 0)
const progressBarRef = ref(null)
const isSeeking = ref(false)
const seekPreviewTime = ref(0)
const displayCurrentTime = computed(() => isSeeking.value ? seekPreviewTime.value : player.currentTime)
const displayPct = computed(() => {
  if (!player.duration) return 0
  return isSeeking.value ? (seekPreviewTime.value / player.duration) * 100 : pct.value
})
const messageUnreadCount = computed(() => messagesStore.unreadCount)
const messageUnreadLabel = computed(() => messageUnreadCount.value > 99 ? '99+' : String(messageUnreadCount.value))

const isLeftSidebarOpen = ref(false)
const isRightSidebarOpen = ref(false)

function onToggleQueueEvent() {
  isRightSidebarOpen.value = !isRightSidebarOpen.value
}
function onToggleSidebarEvent() {
  isLeftSidebarOpen.value = !isLeftSidebarOpen.value
}
window.addEventListener('mf:toggle-queue', onToggleQueueEvent)
window.addEventListener('mf:toggle-sidebar', onToggleSidebarEvent)

onUnmounted(() => {
  window.removeEventListener('mf:toggle-queue', onToggleQueueEvent)
  window.removeEventListener('mf:toggle-sidebar', onToggleSidebarEvent)
})

const upcomingSongs = computed(() => {
  return player.upcomingQueue || []
})

const canReorderQueue = computed(() => !player.shuffle && upcomingSongs.value.length > 1)

const upcomingQueueModel = computed({
  get: () => upcomingSongs.value,
  set: (nextUpcoming) => {
    if (!Array.isArray(nextUpcoming)) return
    const lockedQueue = player.queue.slice(0, player.queueIndex + 1)
    player.reorderQueue([...lockedQueue, ...nextUpcoming])
  }
})

function isActive(path) {
  return router.currentRoute.value.path === path
}

onMounted(() => {
  library.fetchLikedSongs()
  messagesStore.fetchUnreadCount()
})

function formatTime(s) {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function seekFromClientX(clientX) {
  const el = progressBarRef.value
  if (!el || !player.duration) return
  const rect = el.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  seekPreviewTime.value = ratio * player.duration
  player.seek(seekPreviewTime.value)
}

function startSeekDrag(e) {
  if (!player.duration) return
  e.preventDefault()
  isSeeking.value = true
  seekFromClientX(e.clientX)
  window.addEventListener('pointermove', handleSeekDrag)
  window.addEventListener('pointerup', stopSeekDrag, { once: true })
  window.addEventListener('pointercancel', stopSeekDrag, { once: true })
}

function handleSeekDrag(e) {
  seekFromClientX(e.clientX)
}

function stopSeekDrag() {
  isSeeking.value = false
  window.removeEventListener('pointermove', handleSeekDrag)
}

onBeforeUnmount(stopSeekDrag)

const navItems = [
  { to: '/', label: 'Trang chủ', icon: 'home' },
  { to: '/search', label: 'Tìm kiếm', icon: 'search' },
  { to: '/library', label: 'Thư viện', icon: 'library_music' },
  { to: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { to: '/ai', label: 'AI Playlist', icon: 'auto_awesome' },
  { to: '/karaoke', label: 'Karaoke', icon: 'mic_external_on' },
]
</script>

<style>
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.queue-row--dragging,
.queue-row--ghost {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
  opacity: 0.72;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
}

.queue-drag-handle {
  touch-action: none;
}

@media (hover: hover) {
  .queue-drag-handle {
    opacity: 0;
  }

  .queue-row:hover .queue-drag-handle,
  .queue-drag-handle:focus-visible {
    opacity: 1;
  }
}
</style>
