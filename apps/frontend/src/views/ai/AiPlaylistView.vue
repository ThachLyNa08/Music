<template>
  <main class="relative min-h-screen bg-[#0b0d12] pb-24 text-white overflow-hidden">
    <!-- Subtle radial glow backgrounds -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#1ed760]/[0.025] blur-[120px]"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#7c3aed]/[0.025] blur-[120px]"></div>
    </div>

    <section class="relative z-10 overflow-hidden px-6 py-4 md:px-8 md:py-5 mb-5 border-b border-white/5 shadow-xl bg-[#0b0d12]/60 backdrop-blur-3xl">
      <!-- Blurred Background Cover -->
      <img
        :src="aiPlaylistCoverUrl"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-35 scale-[1.15] blur-[30px] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay with subtle purple/pink Tint -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/80 to-[#7c3aed]/20 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 md:gap-8 w-full max-w-[1360px] mx-auto">
        <!-- Foreground Cover -->
        <div class="w-[90px] h-[90px] lg:w-[120px] lg:h-[120px] rounded-2xl shadow-2xl border border-white/10 flex-shrink-0 overflow-hidden">
          <img :src="aiPlaylistCoverUrl" class="w-full h-full object-cover" />
        </div>
        
        <div class="flex flex-col gap-1.5 min-w-0 flex-1">
          <span class="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">MUSICFLOW AI</span>
          <h1 class="text-3xl lg:text-5xl font-black leading-[1.1] text-white tracking-tight mb-0.5 drop-shadow-lg">AI Playlist</h1>
          
          <p class="mt-2 text-xs leading-relaxed text-[#b3b3b3] md:text-sm max-w-2xl">
            Tạo playlist thông minh từ mô tả, tâm trạng và gu nghe của bạn.
          </p>
          <div class="flex items-center gap-2 text-[10px] md:text-xs text-[#b3b3b3] font-medium mt-1 mb-3">
            <span>Cá nhân hóa bằng BPR-MF</span>
            <span>•</span>
            <span>Audio features</span>
            <span>•</span>
            <span>Intent AI</span>
          </div>

          <div class="flex items-center gap-4 mt-2">
            <button 
              class="rounded-full bg-[#1ed760] px-5 py-2 text-[13px] font-bold text-black transition hover:scale-105 hover:bg-[#1fdf64] shadow-[0_0_20px_rgba(30,215,96,0.3)] shrink-0" 
              @click="scrollToPrompt"
            >
              Tạo playlist
            </button>
            <button
              v-if="savedPlaylist"
              type="button"
              class="rounded-full border border-white/20 bg-transparent px-5 py-2 text-[13px] font-bold text-white transition hover:border-white/40 hover:bg-white/5 shrink-0"
              @click="openSavedPlaylist"
            >
              Mở playlist
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="mx-auto grid max-w-[1360px] grid-cols-1 gap-6 px-4 py-6 md:px-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-10">
      <aside id="prompt-section" class="relative z-10 space-y-5 lg:sticky lg:top-6 lg:self-start">
        <AiPlaylistPromptBox
          v-model="prompt"
          v-model:target-count="targetCount"
          :use-l-l-m="useLLM"
          :loading="loading"
          :disabled="loading || saving || refining"
          :show-llm-toggle="showDebug"
          @update:useLLM="useLLM = $event"
          @submit="handlePreview"
        />

        <section class="mf-glass-panel p-5">
          <h2 class="mb-4 text-[11px] font-bold uppercase tracking-widest text-white/70">Gợi ý từ MusicFlow</h2>
          <PromptSuggestionChips
            :suggestions="suggestions"
            :disabled="loading || saving || refining"
            @select="selectSuggestion"
          />
        </section>

        <section v-if="previewData" class="mf-glass-panel p-5">
          <h2 class="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/70">Tinh chỉnh Playlist</h2>
          <textarea
            v-model="refinePrompt"
            :disabled="loading || saving || refining"
            class="min-h-[84px] w-full resize-y rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 hover:bg-black/30 focus:bg-black/40 focus:border-[#1ed760]/30 focus:ring-1 focus:ring-[#1ed760]/20"
            placeholder="Ví dụ: nhẹ hơn, bớt buồn, thêm vài bài tempo nhanh..."
          />
          <div class="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              :disabled="regenerating || loading || saving"
              class="h-10 rounded-full border border-white/10 bg-transparent text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              @click="handleRegenerate"
            >
              {{ regenerating ? 'Đang tạo...' : 'Tạo lại' }}
            </button>
            <button
              type="button"
              :disabled="!refinePrompt.trim() || refining || loading || saving"
              class="h-10 rounded-full bg-[#1ed760] text-sm font-bold text-black transition hover:bg-[#1ed760]/90 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              @click="handleRefine"
            >
              {{ refining ? 'Đang chỉnh...' : 'Tinh chỉnh' }}
            </button>
          </div>
        </section>
      </aside>

      <section class="relative z-10 min-w-0 space-y-5">
        <div v-if="errorMessage" class="mf-glass-panel !border-rose-500/20 px-4 py-3 text-sm text-rose-200">
          {{ errorMessage }}
        </div>

        <div v-if="loading && !previewData" class="flex flex-col items-center justify-center mf-glass-panel px-5 py-24 text-center">
          <div class="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#1ed760] shadow-[0_0_15px_rgba(30,215,96,0.3)]"></div>
          <h2 class="text-2xl font-bold text-white drop-shadow-sm">Đang tạo playlist preview</h2>
          <p class="mt-3 text-sm text-white/60">MusicFlow đang phân tích intent và ranking bài hát phù hợp...</p>
        </div>

        <template v-else-if="previewData">
          <AiPlaylistPreview
            :songs="previewData.songs"
            :meta="previewData.meta"
            :debug="showDebug"
            :title="generatedTitle"
            :covers="previewCovers"
            :fallbackCover="aiPlaylistCoverUrl"
            @play-song="handlePlaySong"
          >
            <template #intent-summary>
              <AiPlaylistIntentSummary :intent="previewData.intent" />
            </template>
            <template #actions>
              <button
                type="button"
                :disabled="!previewData.songs.length"
                class="flex h-14 w-14 items-center justify-center rounded-full bg-[#1ed760] text-black transition hover:scale-105 hover:bg-[#1fdf64] shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 shrink-0"
                @click="togglePreviewPlay"
              >
                <!-- Pause Icon -->
                <svg v-if="isPreviewPlaying" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7H5.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7h-2.6z"/>
                </svg>
                <!-- Play Icon -->
                <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/>
                </svg>
              </button>
              
              <button
                v-if="!savedPlaylist"
                type="button"
                :disabled="saving || !previewData.songs.length"
                class="rounded-full border border-white/20 bg-transparent px-6 py-2.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                @click="showSavePanel = !showSavePanel"
              >
                {{ saving ? 'Đang lưu...' : 'Lưu' }}
              </button>
              <button
                v-else
                type="button"
                class="rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
                @click="openSavedPlaylist"
              >
                Đã lưu
              </button>
            </template>
          </AiPlaylistPreview>

        </template>
        
        <div v-else class="flex flex-col items-center justify-center mf-glass-panel px-5 py-28 text-center">
          <div class="mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-inner relative">
            <div class="absolute inset-0 rounded-full bg-[#1ed760]/10 blur-xl pointer-events-none"></div>
            <span class="text-3xl font-black text-white/40 drop-shadow-sm relative z-10">AI</span>
          </div>
          <h2 class="text-[1.75rem] font-black text-white drop-shadow-sm">Chưa có preview</h2>
          <p class="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/50">
            Nhập một prompt hoặc chọn gợi ý để MusicFlow tạo danh sách bài hát thông minh.
          </p>
        </div>
      </section>
    </div>
    <!-- Fixed Modal Overlay cho form Lưu Playlist -->
    <Teleport to="body">
      <div v-if="showSavePanel" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 md:p-6">
        <section class="w-full max-w-[calc(100vw-32px)] md:max-w-xl max-h-[calc(100vh-120px)] overflow-y-auto rounded-3xl border border-white/10 bg-[#181818]/90 p-6 shadow-2xl backdrop-blur-xl transform transition-all">
          <div class="mb-6 flex items-center justify-between gap-3">
            <h2 class="text-xl font-black text-white">Lưu Playlist</h2>
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[#b3b3b3] hover:bg-white/10 hover:text-white transition" @click="showSavePanel = false">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.3 4.71a.75.75 0 0 0-1.06 0L12 10.94 5.76 4.7a.75.75 0 0 0-1.06 1.06l6.24 6.24-6.24 6.24a.75.75 0 1 0 1.06 1.06l6.24-6.24 6.24 6.24a.75.75 0 0 0 1.06-1.06L13.06 12l6.24-6.24a.75.75 0 0 0 0-1.06z"/></svg>
            </button>
          </div>
          
          <div class="flex flex-col gap-6">
            <div class="space-y-2">
              <label class="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">Tên playlist</label>
              <input
                v-model="saveName"
                class="h-11 w-full rounded-lg border border-white/5 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-[#1ed760] focus:bg-white/10 placeholder-[#b3b3b3]/50"
                placeholder="Ví dụ: Playlist Mới"
              />
            </div>
            
            <div class="space-y-2">
              <label class="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">Mô tả</label>
              <textarea
                v-model="saveDescription"
                class="min-h-[100px] w-full resize-y rounded-lg border border-white/5 bg-white/5 p-4 text-sm text-white outline-none transition focus:border-[#1ed760] focus:bg-white/10 placeholder-[#b3b3b3]/50"
                placeholder="Thêm mô tả cho playlist của bạn..."
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">Quyền riêng tư</label>
              <select
                v-model="visibility"
                class="h-11 w-full rounded-lg border border-white/5 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-[#1ed760] focus:bg-white/10 appearance-none"
              >
                <option value="private" class="bg-[#282828] text-white">Riêng tư</option>
                <option value="public" class="bg-[#282828] text-white">Công khai</option>
              </select>
            </div>
          </div>
          
          <div class="mt-8 flex flex-col-reverse md:flex-row justify-end gap-3">
            <button
              type="button"
              class="w-full md:w-auto rounded-full px-5 py-2.5 text-sm font-bold text-[#b3b3b3] hover:text-white hover:bg-white/5 transition"
              @click="showSavePanel = false"
            >
              Hủy
            </button>
            <button
              type="button"
              :disabled="saving || !saveName.trim() || !previewData.songs.length"
              class="w-full md:w-auto rounded-full bg-[#1ed760] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#1ed760]/90 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              @click="handleSave"
            >
              {{ saving ? 'Đang lưu...' : 'Lưu vào thư viện' }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { aiPlaylistApi } from '@/api/aiPlaylist'
import { useToastStore } from '@/stores/toast'
import { usePlayerStore } from '@/stores/player'
import { formatImageUrl } from '@/utils/formatters'
import AiPlaylistPromptBox from '@/components/ai/AiPlaylistPromptBox.vue'
import AiPlaylistIntentSummary from '@/components/ai/AiPlaylistIntentSummary.vue'
import AiPlaylistPreview from '@/components/ai/AiPlaylistPreview.vue'
import PromptSuggestionChips from '@/components/ai/PromptSuggestionChips.vue'

const router = useRouter()
const toast = useToastStore()
const playerStore = usePlayerStore()

const prompt = ref('')
const targetCount = ref(20)
const useLLM = ref(false)
const previewData = ref(null)
const errorMessage = ref('')
const loading = ref(false)
const regenerating = ref(false)
const refining = ref(false)
const saving = ref(false)
const refinePrompt = ref('')
const showSavePanel = ref(false)
const saveName = ref('')
const saveDescription = ref('Playlist được tạo từ AI Playlist.')
const visibility = ref('private')
const savedPlaylist = ref(null)

const aiPlaylistCoverUrl = computed(() => formatImageUrl('/uploads/playlist_cover/ai_playlist.png'))
const generatedTitle = computed(() => previewData.value ? suggestPlaylistName(previewData.value.intent, prompt.value, previewData.value.meta) : 'AI Playlist')

const previewCovers = computed(() => {
  if (!previewData.value?.songs?.length) return []
  const validCovers = previewData.value.songs
    .map(s => s.coverUrl || s.cover_url || s.image_url || s.album_cover)
    .filter(Boolean)
  return validCovers
})

const isPreviewPlaying = computed(() => {
  if (!playerStore.isPlaying || !playerStore.currentSong || !previewData.value?.songs?.length) return false
  return previewData.value.songs.some(s => s.id === playerStore.currentSong.id || s.song_id === playerStore.currentSong.id)
})

function togglePreviewPlay() {
  if (!previewData.value?.songs?.length) return
  if (isPreviewPlaying.value) {
    playerStore.togglePlay()
  } else {
    const currentId = playerStore.currentSong?.id || playerStore.currentSong?.song_id
    const isPausedOnPreview = !playerStore.isPlaying && currentId && previewData.value.songs.some(s => s.id === currentId || s.song_id === currentId)
    if (isPausedOnPreview) {
      playerStore.togglePlay()
    } else {
      handlePlaySong({ song: previewData.value.songs[0], index: 0 })
    }
  }
}

function scrollToPrompt() {
  const section = document.getElementById('prompt-section')
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const textarea = section.querySelector('textarea')
    if (textarea) {
      setTimeout(() => textarea.focus(), 500)
    }
  }
}

const showDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'true'

const suggestions = [
  'Nhạc Việt buồn nhẹ nghe buổi tối',
  'Kpop nhẹ nhàng để học bài',
  'USUK R&B đêm khuya',
  'Nhạc tập gym thật cháy',
  'Nhạc chill uống cà phê',
  'Nhạc trẻ trẻ nhưng không quá ồn',
  'Nhạc buồn nhưng đừng quá thảm',
  'Nhạc hoài niệm có chiều sâu',
  'Nhạc tập trung chạy deadline',
  'Nhạc tình yêu ngọt ngào'
]

watch(previewData, (value) => {
  if (!value) return
  saveName.value = suggestPlaylistName(value.intent, prompt.value, value.meta)
  savedPlaylist.value = null
})

function selectSuggestion(text) {
  prompt.value = text
}

function normalizeResponse(data) {
  const songs = Array.isArray(data?.songs) ? data.songs : []
  return {
    ...data,
    songs: songs.map((song) => ({
      ...song,
      coverUrl: song.coverUrl || song.cover_url,
      audioUrl: song.audioUrl || song.audio_url
    })),
    intent: data?.intent || {},
    meta: data?.meta || {}
  }
}

function suggestPlaylistName(intent, fallbackPrompt, meta) {
  // Ưu tiên 1: Backend gửi sẵn tên
  if (meta?.suggestedName || meta?.playlistTitle || meta?.title || meta?.name) {
    return meta.suggestedName || meta.playlistTitle || meta.title || meta.name
  }

  // Ưu tiên 2: Tạo từ prompt người dùng (xóa các cụm lệnh)
  if (fallbackPrompt && typeof fallbackPrompt === 'string' && fallbackPrompt.trim().length > 2) {
    let cleanName = fallbackPrompt.trim()
    const phrasesToRemove = [
      'tạo playlist', 'tạo cho tôi', 'cho tôi', 'tôi muốn nghe', 'tôi muốn',
      'tìm nhạc', 'mở nhạc', 'nghe nhạc', 'list nhạc', 'playlist'
    ]
    
    phrasesToRemove.forEach(phrase => {
      const regex = new RegExp(`(^|\\s)${phrase}(\\s|$)`, 'gi')
      cleanName = cleanName.replace(regex, ' ')
    })
    
    cleanName = cleanName.replace(/^[\s,;\-]+/, '').replace(/[\s,;\-]+$/, '').replace(/\s+/g, ' ')
    
    if (cleanName.length > 0) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).slice(0, 80)
    }
  }

  // Ưu tiên 3: Dùng intent ghép thành tiếng Việt tự nhiên
  const parts = []
  const hard = intent?.hardConstraints || {}
  const soft = intent?.softPreferences || {}
  if (hard.market && hard.market !== 'ANY') parts.push(hard.market)
  if (soft.mood?.[0]) parts.push(label(soft.mood[0]))
  if (soft.context?.[0]) parts.push(label(soft.context[0]))
  
  if (parts.length) {
    const fallbackName = parts.join(' ')
    return fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1).slice(0, 80)
  }
  
  return 'Playlist AI của bạn'
}

function label(value) {
  const labels = {
    sad: 'buồn nhẹ',
    chill: 'nhẹ nhàng',
    calm: 'êm dịu',
    romantic: 'lãng mạn',
    happy: 'vui vẻ',
    energetic: 'năng lượng',
    party: 'sôi động',
    focus: 'tập trung',
    nostalgic: 'hoài niệm',
    night: 'buổi tối',
    late_night: 'đêm khuya',
    rain: 'trời mưa',
    weekend: 'cuối tuần',
    study: 'học bài',
    workout: 'tập gym',
    work: 'làm việc'
  }
  return labels[value] || String(value || '').replaceAll('_', ' ')
}

async function handlePreview(extra = {}) {
  if (!prompt.value.trim()) return
  loading.value = true
  errorMessage.value = ''
  showSavePanel.value = false

  try {
    const { data } = await aiPlaylistApi.previewAiPlaylist({
      prompt: prompt.value,
      targetCount: targetCount.value,
      useLLM: useLLM.value,
      ...extra
    })
    previewData.value = normalizeResponse(data)
    toast.showToast('Đã tạo preview playlist', 'success')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Không thể tạo playlist preview'
    toast.showToast(errorMessage.value, 'error')
  } finally {
    loading.value = false
  }
}

async function handleRegenerate() {
  if (!previewData.value) return
  regenerating.value = true
  try {
    await handlePreview({
      previousSongIds: previewData.value.songs.map((song) => song.id)
    })
  } finally {
    regenerating.value = false
  }
}

async function handleRefine() {
  if (!previewData.value || !refinePrompt.value.trim()) return
  refining.value = true
  errorMessage.value = ''
  showSavePanel.value = false

  try {
    const { data } = await aiPlaylistApi.refineAiPlaylist({
      originalPrompt: prompt.value,
      refinePrompt: refinePrompt.value,
      previousIntent: previewData.value.intent,
      previousSongIds: previewData.value.songs.map((song) => song.id),
      targetCount: targetCount.value,
      useLLM: useLLM.value
    })
    previewData.value = normalizeResponse(data)
    prompt.value = `${prompt.value}. ${refinePrompt.value}`
    refinePrompt.value = ''
    toast.showToast('Đã tinh chỉnh playlist', 'success')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Không thể tinh chỉnh playlist'
    toast.showToast(errorMessage.value, 'error')
  } finally {
    refining.value = false
  }
}

async function handleSave() {
  if (!previewData.value?.songs?.length || !saveName.value.trim()) return
  saving.value = true
  errorMessage.value = ''

  try {
    const { data } = await aiPlaylistApi.saveAiPlaylist({
      name: saveName.value,
      description: saveDescription.value,
      sourcePrompt: prompt.value,
      intent: previewData.value.intent,
      songIds: previewData.value.songs.map((song) => song.id || song.song_id),
      visibility: visibility.value
    })
    savedPlaylist.value = data.playlist
    toast.showToast('Đã lưu playlist vào thư viện', 'success')
    showSavePanel.value = false
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Không thể lưu playlist'
    toast.showToast(errorMessage.value, 'error')
  } finally {
    saving.value = false
  }
}

function openSavedPlaylist() {
  const id = savedPlaylist.value?.id
  if (id) router.push(`/playlist/${id}`)
}

function handlePlaySong({ song, index }) {
  if (!song.audio_url && !song.audioUrl && !song.stream_url) {
    toast.showToast('Bài hát này chưa có link audio để nghe thử.', 'warning')
    return
  }
  
  const queue = previewData.value.songs.map(s => ({ ...s }))
  playerStore.playSong(song, queue, index, { source: 'ai_playlist_preview' })
}
</script>

<style>
/* Utilities for Glassmorphism UI */
.mf-glass-card {
  background: rgba(20, 20, 24, 0.45);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 10px 30px rgba(0, 0, 0, 0.3);
  border-radius: 24px;
}
.mf-glass-panel {
  background: rgba(28, 28, 34, 0.58);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 8px 24px rgba(0, 0, 0, 0.25);
  border-radius: 20px;
}
.mf-glass-pill {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
</style>
