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
            <span>Cá nhân hóa bằng LightGCN</span>
            <span>•</span>
            <span>Audio features</span>
            <span>•</span>
            <span>Intent AI</span>
          </div>

          <div class="flex flex-wrap items-center gap-3 mt-2">
            <button 
              class="rounded-full bg-[#1ed760] px-5 py-2 text-[13px] font-bold text-black transition hover:scale-105 hover:bg-[#1fdf64] shadow-[0_0_20px_rgba(30,215,96,0.3)] shrink-0" 
              @click="scrollToPrompt"
            >
              Tạo playlist
            </button>
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-[13px] font-bold text-white/80 transition hover:bg-white/[0.1] hover:text-white shrink-0"
              @click="openHistoryModal"
            >
              Lịch sử tạo
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
          :quota="quota"
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
            :warnings="previewData.warnings"
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
                v-if="isUnsavedHistoryPreview"
                type="button"
                :disabled="saving || !previewData.songs.length"
                class="rounded-full border border-white/20 bg-transparent px-6 py-2.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                @click="handleSaveHistory"
              >
                {{ saving ? 'Đang lưu...' : 'Lưu playlist' }}
              </button>
              <button
                v-else-if="!savedPlaylist"
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

    <!-- Fixed Modal Overlay cho Lịch sử tạo AI Playlist -->
    <Teleport to="body">
      <div
        v-if="isHistoryOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md transition-all sm:p-4 md:p-6"
        @click.self="closeHistoryModal"
      >
        <section class="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#14151d]/95 text-white shadow-[0_25px_70px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl transform transition-all">
          <!-- Header -->
          <header class="flex flex-col gap-4 border-b border-white/10 bg-white/[0.025] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div class="flex items-center gap-3.5 min-w-0">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-emerald-500/20 border border-white/10 text-purple-300 shadow-inner">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Lịch sử tạo AI Playlist
                </h2>
                <p class="text-xs text-white/50 truncate">Xem lại các preview AI Playlist đã tạo</p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                :disabled="historyLoading"
                class="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                @click="loadHistory"
              >
                <svg
                  class="h-3.5 w-3.5"
                  :class="{ 'animate-spin': historyLoading }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
                  <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1 1A10 10 0 0 0 22 12.5"/>
                </svg>
                <span>Làm mới</span>
              </button>

              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/15 hover:text-white"
                @click="closeHistoryModal"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M19.3 4.71a.75.75 0 0 0-1.06 0L12 10.94 5.76 4.7a.75.75 0 0 0-1.06 1.06l6.24 6.24-6.24 6.24a.75.75 0 1 0 1.06 1.06l6.24-6.24 6.24 6.24a.75.75 0 0 0 1.06-1.06L13.06 12l6.24-6.24a.75.75 0 0 0 0-1.06z"/>
                </svg>
              </button>
            </div>
          </header>

          <!-- Content Body -->
          <div class="custom-scrollbar flex-1 space-y-3.5 overflow-y-auto p-5 sm:p-6">
            <!-- Loading state -->
            <div v-if="historyLoading && !historyItems.length" class="flex flex-col items-center justify-center py-14 px-6 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
              <div class="mb-4 h-9 w-9 animate-spin rounded-full border-3 border-white/10 border-t-[#1ed760]"></div>
              <p class="text-sm font-medium text-white/60">Đang tải lịch sử tạo...</p>
            </div>

            <!-- Error state -->
            <div v-else-if="historyError" class="flex flex-col items-center justify-center py-10 px-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] text-center">
              <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 class="text-sm font-bold text-rose-200">Không thể tải lịch sử tạo</h3>
              <p class="mt-1 text-xs text-rose-300/70 max-w-sm">{{ historyError }}</p>
              <button
                type="button"
                class="mt-4 rounded-full bg-rose-500/20 border border-rose-500/30 px-4 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/30"
                @click="loadHistory"
              >
                Thử lại
              </button>
            </div>

            <!-- Empty state -->
            <div v-else-if="!historyItems.length" class="flex flex-col items-center justify-center py-14 px-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] text-center">
              <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 via-emerald-500/10 to-transparent border border-white/10 text-purple-300/70 shadow-inner">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 class="text-base font-bold text-white">Chưa có lịch sử tạo</h3>
              <p class="mt-1 text-xs text-white/50 max-w-sm leading-relaxed">
                Các preview AI Playlist bạn tạo sẽ xuất hiện tại đây.
              </p>
            </div>

            <!-- History Items list -->
            <template v-else>
              <article
                v-for="item in historyItems"
                :key="item.id"
                class="group relative rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-all duration-200 hover:bg-white/[0.06] hover:border-white/20 shadow-sm hover:shadow-md"
              >
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="flex items-start gap-3.5 min-w-0 flex-1">
                    <img
                      :src="item.cover_url || aiPlaylistCoverUrl"
                      alt=""
                      class="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover shadow-md group-hover:scale-105 transition-transform duration-300"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-bold text-white group-hover:text-[#1ed760] transition-colors" :title="item.prompt">
                        {{ item.prompt }}
                      </div>
                      
                      <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span class="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/70 border border-white/5">
                          {{ item.target_count }} bài • {{ item.actual_count }} bài phù hợp
                        </span>
                        <span :class="historyStatusClass(item.status)">
                          {{ historyStatusLabel(item.status) }}
                        </span>
                        <span class="text-white/30">•</span>
                        <span class="text-white/45 text-[11px]">{{ formatHistoryDate(item.created_at) }}</span>
                      </div>

                      <p v-if="item.status === 'failed' && item.error_message" class="mt-2 line-clamp-2 text-xs text-rose-300/80 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                        {{ item.error_message }}
                      </p>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex flex-wrap items-center gap-2 shrink-0 sm:self-center">
                    <button
                      v-if="item.status === 'preview'"
                      type="button"
                      :disabled="saving"
                      class="rounded-full bg-[#1ed760] px-4 py-1.5 text-xs font-bold text-black transition hover:scale-105 hover:bg-[#1fdf64] shadow-[0_0_15px_rgba(30,215,96,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                      @click="saveHistoryItem(item)"
                    >
                      Lưu playlist
                    </button>

                    <button
                      v-if="item.status === 'saved' && item.playlist_id"
                      type="button"
                      class="rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-white/20 hover:scale-105"
                      @click="openHistoryPlaylist(item)"
                    >
                      Mở playlist
                    </button>

                    <button
                      type="button"
                      class="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/90 transition hover:border-white/30 hover:bg-white/10"
                      @click="viewHistory(item)"
                    >
                      {{ item.status === 'failed' ? 'Xem lỗi' : 'Xem lại' }}
                    </button>

                    <button
                      type="button"
                      class="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
                      @click="reusePrompt(item)"
                    >
                      Dùng lại prompt
                    </button>
                  </div>
                </div>
              </article>
            </template>
          </div>
        </section>
      </div>
    </Teleport>
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
import { computed, ref, watch, onMounted } from 'vue'
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
const useLLM = ref(true)
const previewData = ref(null)
const errorMessage = ref('')
const loading = ref(false)
const refining = ref(false)
const saving = ref(false)
const refinePrompt = ref('')
const showSavePanel = ref(false)
const saveName = ref('')
const saveDescription = ref('Playlist được tạo từ AI Playlist.')
const visibility = ref('private')
const savedPlaylist = ref(null)
const quota = ref(null)
const isHistoryOpen = ref(false)
const historyItems = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const currentPreviewHistoryId = ref(null)
const currentPreviewStatus = ref(null)
const currentPreviewPrompt = ref('')
const currentPreviewFromHistory = ref(false)

onMounted(async () => {
  try {
    const res = await aiPlaylistApi.getQuota()
    if (res.data?.success) {
      quota.value = res.data.quota
    }
  } catch (err) {
    console.error('Failed to load quota', err)
  }
})

const aiPlaylistCoverUrl = computed(() => formatImageUrl('/uploads/playlist_cover/ai_playlist.png'))
const generatedTitle = computed(() => {
  if (!previewData.value) return 'AI Playlist'
  return previewData.value.title || previewData.value.playlistTitle || suggestPlaylistName(previewData.value.intent, currentPreviewPrompt.value || prompt.value, previewData.value.meta)
})
const isUnsavedHistoryPreview = computed(() => currentPreviewFromHistory.value && currentPreviewHistoryId.value && currentPreviewStatus.value === 'preview' && !savedPlaylist.value)

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
  saveName.value = value.title || value.playlistTitle || suggestPlaylistName(value.intent, currentPreviewPrompt.value || prompt.value, value.meta)
})

function selectSuggestion(text) {
  prompt.value = text
}

function normalizeResponse(data) {
  const songs = Array.isArray(data?.songs) ? data.songs : []
  return {
    ...data,
    title: data?.title || data?.playlistTitle || data?.meta?.playlistTitle,
    songs: songs.map((song) => ({
      ...song,
      id: song.id || song.song_id,
      song_id: song.song_id || song.id,
      artist: song.artist || song.artist_name,
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
    currentPreviewHistoryId.value = data.history_id || data.historyId || null
    currentPreviewStatus.value = 'preview'
    currentPreviewPrompt.value = prompt.value
    currentPreviewFromHistory.value = false
    savedPlaylist.value = null
    if (data.quota) {
      quota.value = data.quota
    }
    if (isHistoryOpen.value) await loadHistory()
    toast.showToast('Đã tạo preview playlist', 'success')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Không thể tạo playlist preview'
    if (error.response?.data?.quota) {
      quota.value = error.response.data.quota
    }
    toast.showToast(errorMessage.value, 'error')
  } finally {
    loading.value = false
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
    currentPreviewHistoryId.value = data.history_id || data.historyId || null
    currentPreviewStatus.value = 'preview'
    currentPreviewPrompt.value = prompt.value
    currentPreviewFromHistory.value = false
    savedPlaylist.value = null
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
      visibility: visibility.value,
      history_id: currentPreviewHistoryId.value
    })
    savedPlaylist.value = data.playlist
    currentPreviewStatus.value = 'saved'
    if (isHistoryOpen.value) await loadHistory()
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

async function openHistoryModal() {
  isHistoryOpen.value = true
  await loadHistory()
}

function closeHistoryModal() {
  isHistoryOpen.value = false
}

async function loadHistory() {
  historyLoading.value = true
  historyError.value = ''
  try {
    const { data } = await aiPlaylistApi.getHistory(10)
    historyItems.value = Array.isArray(data?.items) ? data.items : []
  } catch (error) {
    console.error('Failed to load AI playlist history', error)
    historyError.value = error.response?.data?.message || 'Không thể tải lịch sử tạo. Vui lòng thử lại.'
  } finally {
    historyLoading.value = false
  }
}

async function viewHistory(item) {
  errorMessage.value = ''
  showSavePanel.value = false
  try {
    const { data } = await aiPlaylistApi.getHistoryDetail(item.id)
    const detail = data?.item
    currentPreviewHistoryId.value = detail?.id || item.id
    currentPreviewStatus.value = detail?.status || item.status
    currentPreviewPrompt.value = detail?.prompt || item.prompt
    currentPreviewFromHistory.value = true
    targetCount.value = Number(detail?.target_count || item.target_count || targetCount.value)

    if (detail?.status === 'failed') {
      previewData.value = null
      savedPlaylist.value = null
      errorMessage.value = detail.error_message || 'Preview này đã lỗi khi tạo.'
      closeHistoryModal()
      return
    }

    previewData.value = normalizeResponse({
      ...(detail?.preview || {}),
      intent: detail?.intent || detail?.preview?.intent || {},
      meta: detail?.preview?.meta || {},
      warnings: detail?.preview?.warnings || []
    })
    savedPlaylist.value = detail?.status === 'saved' && detail?.playlist_id
      ? { id: detail.playlist_id }
      : null
    closeHistoryModal()
    toast.showToast('Đã mở lại preview cũ', 'success')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Không thể xem lại preview cũ'
    toast.showToast(errorMessage.value, 'error')
  }
}

function reusePrompt(item) {
  prompt.value = item.prompt || ''
  targetCount.value = Number(item.target_count || 20)
  closeHistoryModal()
  scrollToPrompt()
}

async function handleSaveHistory() {
  if (!currentPreviewHistoryId.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const { data } = await aiPlaylistApi.saveHistory(currentPreviewHistoryId.value, { visibility: visibility.value })
    savedPlaylist.value = data.playlist || { id: data.playlist_id || data.playlistId }
    currentPreviewStatus.value = 'saved'
    if (isHistoryOpen.value) await loadHistory()
    toast.showToast(data.message || 'Đã lưu playlist từ preview cũ', 'success')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Không thể lưu playlist từ preview cũ'
    toast.showToast(errorMessage.value, 'error')
  } finally {
    saving.value = false
  }
}

async function saveHistoryItem(item) {
  if (!item?.id) return
  saving.value = true
  historyError.value = ''
  try {
    const { data } = await aiPlaylistApi.saveHistory(item.id, { visibility: visibility.value })
    const playlistId = data.playlist_id || data.playlistId || data.playlist?.id
    item.status = 'saved'
    item.playlist_id = playlistId
    historyItems.value = historyItems.value.map((historyItem) => (
      historyItem.id === item.id
        ? { ...historyItem, status: 'saved', playlist_id: playlistId }
        : historyItem
    ))
    if (currentPreviewHistoryId.value === item.id) {
      savedPlaylist.value = data.playlist || { id: playlistId }
      currentPreviewStatus.value = 'saved'
    }
    toast.showToast(data.message || 'Đã lưu playlist từ preview cũ', 'success')
  } catch (error) {
    historyError.value = error.response?.data?.message || 'Không thể lưu playlist từ preview cũ'
    toast.showToast(historyError.value, 'error')
  } finally {
    saving.value = false
  }
}

function openHistoryPlaylist(item) {
  const id = item?.playlist_id
  if (id) {
    closeHistoryModal()
    router.push(`/playlist/${id}`)
  }
}

function historyStatusLabel(status) {
  if (status === 'saved') return 'Đã lưu'
  if (status === 'failed') return 'Lỗi'
  return 'Chưa lưu'
}

function historyStatusClass(status) {
  if (status === 'saved') return 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-[#1ed760] border border-emerald-500/20'
  if (status === 'failed') return 'inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-500/20'
  return 'inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/20'
}

function formatHistoryDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
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
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.28);
}
</style>
