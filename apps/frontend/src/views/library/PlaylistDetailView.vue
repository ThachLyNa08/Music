<template>
  <div class="flex flex-col user-page-bg pb-4" v-if="!loadingData && playlist">
    <!-- Header Hero Section -->
    <section class="relative overflow-hidden w-full px-6 py-6 md:px-12 md:py-8 mb-8 border-b border-white/5 shadow-xl bg-[#090B14]">
      <!-- Blurred Background Cover -->
      <img 
        :src="getPlaylistCover(playlist)"
        alt=""
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.38] scale-[1.18] blur-[34px] saturate-[1.15] pointer-events-none"
        @error="event => event.target.style.display = 'none'"
      />
      <!-- Dark Overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,20,0.88),rgba(9,11,20,0.68),rgba(9,11,20,0.95))] z-0 pointer-events-none"></div>
      <!-- Indigo Tint Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-transparent to-indigo-500/10 z-0 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row items-center lg:items-center gap-6 md:gap-8 max-w-[1400px] mx-auto">
        <!-- Foreground Cover -->
        <div class="w-[160px] h-[160px] lg:w-[200px] lg:h-[200px] rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0 overflow-hidden">
          <CoverImage :src="getPlaylistCover(playlist)" class="w-full h-full object-cover" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 flex-1 text-center lg:text-left w-full">
          <div class="hidden lg:flex items-center gap-2 mb-0.5 w-max text-xs font-bold uppercase tracking-wider text-white/70">
            <span v-if="isSystemPlaylist" class="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md font-black uppercase tracking-widest border border-indigo-500/30">Playlist hệ thống</span>
            <span v-else-if="isAiPlaylist" class="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-md font-black uppercase tracking-widest border border-purple-500/30">AI Playlist</span>
            <span v-else class="opacity-80">{{ playlist.is_public ? 'Playlist Công Khai' : 'Playlist Riêng Tư' }}</span>
          </div>

          <h1 class="text-4xl md:text-5xl lg:text-[64px] font-black leading-[1.1] text-white tracking-tight drop-shadow-lg truncate pb-1">{{ playlist.name }}</h1>
          
          <p class="text-gray-300 font-medium text-sm lg:text-base mt-1 line-clamp-2 max-w-3xl">
            {{ playlist.description || (isSystemPlaylist ? 'Playlist được tạo tự động bởi MusicFlow.' : 'Không có mô tả.') }}
          </p>

          <div class="flex items-center justify-center lg:justify-start gap-2 text-sm md:text-base font-semibold text-gray-300 mt-2 flex-wrap">
            <span>Tạo bởi <b class="text-white hover:underline cursor-pointer">{{ playlist.creator_name || 'MusicFlow' }}</b></span>
            
            <span class="w-1 h-1 bg-white/30 rounded-full mx-1 hidden lg:block"></span>
            <span class="hidden lg:block">{{ songs.length }} bài hát</span>
            
            <template v-if="!isSystemPlaylist && playlist.updated_at">
              <span class="w-1 h-1 bg-white/30 rounded-full mx-1 hidden lg:block"></span>
              <span class="hidden lg:block">Cập nhật: {{ new Date(playlist.updated_at).toLocaleDateString('vi-VN') }}</span>
            </template>
          </div>

          <!-- Mobile only metadata -->
          <div class="flex lg:hidden items-center justify-center gap-2 text-xs font-semibold text-white/60 mt-1">
            <span>{{ songs.length }} bài hát</span>
            <template v-if="!isSystemPlaylist && playlist.updated_at">
              <span class="w-1 h-1 bg-white/30 rounded-full mx-1"></span>
              <span>Cập nhật: {{ new Date(playlist.updated_at).toLocaleDateString('vi-VN') }}</span>
            </template>
          </div>
          
          <!-- Action Buttons -->
          <div class="playlist-actions mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <PlaybackButton v-if="songs.length > 0" class="mr-2" :is-playing="isCurrentPlaylistPlaying" @click="togglePlaylistPlayback" />
            
            <template v-if="canEditMetadata">
              <button class="bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold px-4 py-2.5 rounded-full hover:bg-white/20 hover:scale-105 transition-all shadow-lg cursor-pointer flex items-center gap-2" @click="editPlaylist">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Sửa
              </button>
              <button class="bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-400 font-bold px-4 py-2.5 rounded-full hover:bg-red-500 hover:text-white hover:scale-105 transition-all shadow-lg cursor-pointer flex items-center gap-2" @click="deletePlaylist">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Xóa
              </button>
            </template>
            
            <button v-if="canCloneForEditing" class="w-14 h-14 rounded-full bg-indigo-500/10 backdrop-blur-md border border-indigo-500/30 text-indigo-300 flex items-center justify-center hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:scale-105 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" @click="handleClone" :disabled="isCloning" title="Tạo bản sao để chỉnh sửa">
              <svg v-if="isCloning" class="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
            </button>
            <template v-else-if="isSystemPlaylist">
              <button 
                type="button"
                class="w-14 h-14 rounded-full border border-white/10 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all shadow-lg backdrop-blur-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isSaving"
                @click="toggleSavePlaylist"
                :title="playlist.is_saved ? 'Đã lưu vào thư viện' : 'Lưu vào thư viện'"
              >
                <!-- Check icon if saved -->
                <svg v-if="playlist.is_saved" viewBox="0 0 24 24" fill="currentColor" width="24" height="24" class="text-[#1ed760]">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <!-- Plus icon if not saved -->
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Song List Section -->
    <div class="mx-6 px-6 py-4 user-panel-soft flex-1 relative">
      
      <!-- Table Header -->
      <div class="relative z-10 w-full mb-4 px-4 flex items-center gap-4 text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 mt-4 h-10">
        <div class="w-8 text-center shrink-0">#</div>
        <div class="flex-1 pr-4">Tiêu đề</div>
        <div v-if="!isSystemPlaylist" class="flex-1 hidden md:block pr-4">Album</div>
        <div class="flex-1 hidden md:block pr-4">{{ isSystemPlaylist ? 'Album' : 'Ngày thêm' }}</div>
        <div class="w-auto min-w-[80px] flex justify-end shrink-0 pr-8">
          <!-- Removed duration clock icon -->
        </div>
      </div>

      <!-- Empty State -->
      <div class="relative z-10" v-if="songs.length === 0">
        <div class="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="64" height="64" class="mb-4 text-gray-600"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
          <p class="font-bold text-lg text-white mb-2">Playlist này chưa có bài hát nào</p>
        </div>
      </div>

      <!-- Song Rows -->
      <div class="relative z-10 flex flex-col gap-1 pb-8" v-else>
        <draggable
          v-if="canReorderSongs"
          v-model="playlistSongsModel"
          item-key="id"
          tag="div"
          class="flex flex-col gap-1"
          handle=".playlist-drag-handle"
          ghost-class="playlist-row-ghost"
          chosen-class="playlist-row-chosen"
          :disabled="isReorderingSongs"
          :animation="160"
          @start="handlePlaylistDragStart"
          @end="handlePlaylistDragEnd"
        >
          <template #item="{ element: song, index: idx }">
            <div class="playlist-row-shell group/drag flex min-w-0 items-center rounded-lg border border-transparent transition-colors hover:border-white/10 hover:bg-white/[0.03]">
              <button
                class="playlist-drag-handle flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-slate-500 transition active:cursor-grabbing group-hover/drag:text-slate-300"
                title="Keo de sap xep"
                aria-label="Keo de sap xep"
                @click.stop
              >
                <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
                  <path d="M8 6.5A1.5 1.5 0 116.5 5 1.5 1.5 0 018 6.5zm0 7A1.5 1.5 0 116.5 12 1.5 1.5 0 018 13.5zm0 7A1.5 1.5 0 116.5 19 1.5 1.5 0 018 20.5zm8-14A1.5 1.5 0 1114.5 5 1.5 1.5 0 0116 6.5zm0 7a1.5 1.5 0 11-1.5-1.5A1.5 1.5 0 0116 13.5zm0 7a1.5 1.5 0 11-1.5-1.5A1.5 1.5 0 0116 20.5z"/>
                </svg>
              </button>
              <SongRow
                class="min-w-0 flex-1"
                :song="song"
                :index="idx + 1"
                :showIndex="true"
                :showAlbum="!isSystemPlaylist"
                :showDateAdded="true"
                :date-column-mode="isSystemPlaylist ? 'album' : 'date'"
                :compact="false"
                :isPlaying="player.currentSong?.id === song.id"
                @play="playSong"
                @open-menu="handleOpenMenu"
                @toggle-like="toggleLike"
              />
            </div>
          </template>
        </draggable>
        <SongRow
          v-else
          v-for="(song, idx) in songs"
          :key="song.id"
          :song="song"
          :index="idx + 1"
          :showIndex="true"
          :showAlbum="!isSystemPlaylist"
          :showDateAdded="true"
          :date-column-mode="isSystemPlaylist ? 'album' : 'date'"
          :compact="false"
          :isPlaying="player.currentSong?.id === song.id"
          @play="playSong"
          @open-menu="handleOpenMenu"
          @toggle-like="toggleLike"
        />
      </div>

      <!-- Unified Recommendations & Search Section -->
      <div v-if="canEditSongs" class="relative z-10 mt-8 pt-8 pb-12 border-t border-white/10">
        <PlaylistRecommendations 
          :playlistId="playlist.id"
          :existingSongIds="existingSongIds"
          :addingSongIds="addingSongIds"
          :isEmpty="songs.length === 0"
          @add-song="handleAddSong"
        />
      </div>
    </div>
    <!-- Action Menu -->
    <SongActionMenu
      :show="menuState.show"
      :position="menuState.position"
      :song="menuState.song"
      :isLiked="library.isLiked(menuState.song)"
      :playlistId="playlist?.id"
      :canRemove="canEditSongs"
      @close="menuState.show = false"
      @add-to-playlist="handleAddToPlaylist"
      @remove-from-playlist="removeSong"
      @toggle-like="toggleLike"
      @add-to-queue="handleAddToQueue"
      @go-to-song="handleGoToSong"
      @go-to-artist="handleGoToArtist"
      @go-to-album="handleGoToAlbum"
      @share="handleShare"
    />
  </div>
  
  <div v-else-if="loadingData" class="flex flex-col items-center justify-center h-full user-page-bg">
    <svg class="animate-spin h-8 w-8 text-emerald-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p class="text-sm text-gray-400 font-bold">Đang tải playlist...</p>
  </div>

  <div v-else-if="error" class="flex flex-col items-center justify-center h-full text-red-400 font-bold user-page-bg">
    <p class="mb-4">{{ error }}</p>
    <button @click="fetchDetail" class="px-6 py-2 bg-white text-black rounded-full hover:scale-105 transition-transform">Thử lại</button>
  </div>

  <!-- Edit Modal -->
  <Teleport to="body">
    <div v-if="showEditModal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4" @click.self="closeEditModal">
      <div class="w-full max-w-[720px] rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white m-0">Sửa thông tin Playlist</h2>
          <button @click="closeEditModal" class="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors" title="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="submitEdit" class="flex flex-col gap-6">
          <!-- Body -->
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Cover -->
            <div 
              class="w-full md:w-[240px] h-[240px] shrink-0 bg-[#282828] rounded-xl flex items-center justify-center cursor-pointer group relative overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-transparent hover:border-white/20 transition-all"
              @click="$refs.editCoverInput.click()"
            >
              <input type="file" ref="editCoverInput" accept="image/*" @change="handleEditFile" hidden />
              
              <!-- Preview -->
              <img v-if="editPreviewUrl || getPlaylistCover(playlist)" :src="editPreviewUrl || getPlaylistCover(playlist)" class="w-full h-full object-cover absolute inset-0 z-0" />
              
              <!-- Empty state -->
              <div v-else class="flex flex-col items-center gap-4 text-gray-400 group-hover:text-white z-10 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-16 h-16 opacity-50 group-hover:opacity-100 transition-opacity">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span class="font-medium text-sm">Thêm ảnh bìa</span>
              </div>
              
              <!-- Hover Overlay for preview -->
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-10 h-10 mb-2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span class="font-medium text-sm">Đổi ảnh</span>
              </div>
            </div>

            <!-- Form -->
            <div class="flex-1 flex flex-col gap-4">
              <input 
                v-model="editForm.name" 
                type="text" 
                required 
                placeholder="Tên playlist" 
                class="w-full bg-[#2a2a2a] text-white text-sm font-semibold px-4 py-3 rounded-md outline-none focus:border-white/30 border border-transparent placeholder-gray-400 transition-colors"
              />
              <textarea 
                v-model="editForm.description" 
                placeholder="Thêm mô tả tùy chọn" 
                class="w-full bg-[#2a2a2a] text-white text-sm px-4 py-3 rounded-md outline-none focus:border-white/30 border border-transparent placeholder-gray-400 resize-none flex-1 min-h-[120px] transition-colors"
              ></textarea>
            </div>
          </div>

          <!-- Footer Options -->
          <div class="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div class="flex items-center gap-4 w-full md:w-auto">
              <!-- Privacy Pill -->
              <button type="button" @click="editForm.is_public = !editForm.is_public" class="flex items-center justify-center gap-2 px-3 py-1.5 w-[115px] rounded-full bg-[#2a2a2a] hover:bg-[#333] border border-white/10 text-xs font-semibold text-white transition-colors" :title="editForm.is_public ? 'Chuyển sang riêng tư' : 'Chuyển sang công khai'">
                <svg v-if="editForm.is_public" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0110 0v4"></path>
                </svg>
                <span class="whitespace-nowrap">{{ editForm.is_public ? 'Công khai' : 'Riêng tư' }}</span>
              </button>
            </div>

            <!-- Note & Submit -->
            <div class="flex items-center gap-4 ml-auto w-full md:w-auto justify-end">
              <span v-if="editForm.coverFile" class="text-[11px] text-gray-500 hidden md:inline">Hãy đảm bảo bạn có quyền sử dụng ảnh.</span>
              <button type="button" class="text-sm font-bold text-gray-400 hover:text-white hover:scale-105 transition-transform px-4 py-2" @click="closeEditModal">Hủy</button>
              <button type="submit" class="text-sm font-bold bg-[#1ed760] text-black px-6 py-2 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" :disabled="isSubmitting || !editForm.name.trim()">
                {{ isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- Delete Modal -->
  <Teleport to="body">
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" @click.self="showDeleteModal = false">
      <div class="user-modal w-full max-w-sm">
        <h2 class="m-0 mb-4 font-black text-2xl text-white">Xóa Playlist?</h2>
        <p class="text-gray-400 text-sm font-medium mb-8 leading-relaxed">Bạn có chắc chắn muốn xóa playlist <strong class="text-white">{{ playlist?.name }}</strong> không? Hành động này không thể hoàn tác.</p>
        <div class="flex gap-3">
          <button type="button" class="flex-1 py-3 rounded-xl font-bold bg-transparent border border-gray-700 text-gray-300 cursor-pointer hover:bg-gray-800 hover:text-white transition-colors" @click="showDeleteModal = false">Hủy</button>
          <button type="button" class="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white border-none cursor-pointer hover:bg-red-600 hover:scale-105 transition-all" @click="confirmDelete" :disabled="isSubmitting">Xóa vĩnh viễn</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { playlistApi } from '@/api/playlist'
import { spotifyApi } from '@/api/spotify'
import api from '@/api/axios'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import PlaybackButton from '@/components/common/PlaybackButton.vue'
import PlaylistRecommendations from '@/components/playlist/PlaylistRecommendations.vue'
import PlaylistInlineSearch from '@/components/playlist/PlaylistInlineSearch.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
const auth = useAuthStore()
const toast = useToastStore()

const playlist = ref(null)
const error = ref('')
const loadingData = ref(true)

const showEditModal = ref(false)
const showDeleteModal = ref(false)
const isSubmitting = ref(false)
const isCloning = ref(false)
const editForm = ref({ name: '', description: '', is_public: true, coverFile: null })
const editPreviewUrl = ref(null)

const addingSongIds = ref(new Set())
const isReorderingSongs = ref(false)
const playlistSongsBeforeDrag = ref([])

function isTruthyFlag(value) {
  return value === true || value === 1 || value === '1'
}

const isSystemPlaylist = computed(() => {
  const item = playlist.value
  if (!item) return false
  return item.type === 'system' || isTruthyFlag(item.is_system) || !!item.system_key
})

const isAiPlaylist = computed(() => {
  const item = playlist.value
  if (!item) return false
  return item.type === 'ai' || item.generated_by === 'ai' || item.source === 'ai'
})

const isManualPlaylist = computed(() => {
  if (!playlist.value) return false
  return !isSystemPlaylist.value && !isAiPlaylist.value && (playlist.value.type || 'manual') === 'manual'
})

const isOwner = computed(() => {
  const item = playlist.value
  if (!item) return false
  const currentUserId = auth.user?.id
  const ownerId = item.owner_id ?? item.created_by ?? item.user_id
  return !!item.is_owner || (currentUserId != null && ownerId != null && String(ownerId) === String(currentUserId))
})

const canEditPlaylist = computed(() => isManualPlaylist.value && isOwner.value)
const canEditMetadata = computed(() => canEditPlaylist.value)
const canEditSongs = computed(() => canEditPlaylist.value)
const canCloneForEditing = computed(() => isAiPlaylist.value && !isSystemPlaylist.value)

const songs = computed(() => Array.isArray(playlist.value?.songs) ? playlist.value.songs : [])

const canReorderSongs = computed(() => {
  if (!playlist.value || songs.value.length <= 1) return false
  if (!canEditSongs.value) return false
  if (playlist.value.is_system || playlist.value.system_key) return false
  return (playlist.value.type || 'manual') === 'manual'
})

const playlistSongsModel = computed({
  get: () => songs.value,
  set: (value) => {
    if (!playlist.value || !Array.isArray(value)) return
    playlist.value.songs = value
  }
})

const existingSongIds = computed(() => {
  return new Set(songs.value.map(s => s.id || s.song_id))
})

const isCurrentPlaylistTrack = computed(() => {
  const currentId = getSongId(player.currentSong)
  if (!currentId) return false
  return songs.value.some(song => String(getSongId(song)) === String(currentId))
})

const isCurrentPlaylistPlaying = computed(() => {
  return isCurrentPlaylistTrack.value && player.isPlaying
})

async function handleAddSong(song) {
  if (!canEditSongs.value) return
  if (!song || existingSongIds.value.has(song.id)) return
  
  addingSongIds.value.add(song.id)
  try {
    const res = await playlistApi.addSong(playlist.value.id, song.id)
    if (res.data?.success || res.status === 200 || res.status === 201) {
      await fetchDetail(true) // Reload playlist details silently
      toast.showToast('Đã thêm bài hát vào danh sách phát!')
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Đã có lỗi xảy ra'
    if (msg.includes('exist') || msg.includes('tồn tại')) {
      toast.showToast('Bài hát đã có trong playlist', 'warning')
    } else {
      toast.showToast(msg, 'error')
    }
  } finally {
    addingSongIds.value.delete(song.id)
  }
}

async function fetchDetail(silent = false) {
  if (!silent) loadingData.value = true
  error.value = ''
  try {
    const id = route.params.id
    if (typeof id === 'string' && id.startsWith('spotify:')) {
      const cleanId = String(id).replace('spotify:playlist:', '').replace('spotify:', '')
      const res = await spotifyApi.getPlaylist(cleanId)
      if (res.data?.success) {
        playlist.value = res.data.data
        if (Array.isArray(playlist.value?.songs)) {
          playlist.value.songs = library.applyLikedStateToSongs(playlist.value.songs)
        }
      }
    } else {
      const res = await playlistApi.getDetail(id)
      if (res.data?.success) {
        playlist.value = res.data.data
        if (Array.isArray(playlist.value?.songs)) {
          playlist.value.songs = library.applyLikedStateToSongs(playlist.value.songs)
        }
      }
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Không thể tải playlist'
  } finally {
    loadingData.value = false
  }
}

const isSaving = ref(false)
async function toggleSavePlaylist() {
  if (isSaving.value || !playlist.value) return
  isSaving.value = true
  try {
    if (playlist.value.is_saved) {
      const res = await playlistApi.unsavePlaylist(playlist.value.id)
      if (res.data?.success) {
        playlist.value.is_saved = false
        toast.showToast('Đã xóa khỏi thư viện', 'info')
      }
    } else {
      const res = await playlistApi.savePlaylist(playlist.value.id)
      if (res.data?.success) {
        playlist.value.is_saved = true
        toast.showToast('Đã lưu vào thư viện', 'success')
      }
    }
    if (library.fetchPlaylists) {
      library.fetchPlaylists() // refresh library sidebar
    }
  } catch (err) {
    toast.showToast(err.response?.data?.message || 'Có lỗi xảy ra khi lưu playlist', 'error')
  } finally {
    isSaving.value = false
  }
}

async function handleClone() {
  if (!playlist.value || isCloning.value) return
  if (!canCloneForEditing.value) return
  isCloning.value = true
  try {
    const res = await playlistApi.clonePlaylist(playlist.value.id)
    if (res.data?.success) {
      toast.showToast('Đã tạo bản sao thành công!', 'success')
      router.push(`/playlist/${res.data.playlist_id}`)
      if (library.fetchPlaylists) {
        library.fetchPlaylists() // refresh library sidebar
      }
    }
  } catch (err) {
    toast.showToast(err.response?.data?.message || 'Có lỗi xảy ra khi tạo bản sao', 'error')
  } finally {
    isCloning.value = false
  }
}


onMounted(() => {
  fetchDetail()
  library.fetchLikedSongs()
})

function formatDuration(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function playSong(song) {
  if(player.setSong) {
    player.playbackSource = 'playlist'
    player.setSong(song, songs.value)
    if (!player.isPlaying) player.togglePlay()
  }
}

function playPlaylist() {
  if (playlist.value && songs.value.length > 0) {
    player.playbackSource = 'playlist';
    player.setSong(songs.value[0], songs.value);
    if (!player.isPlaying) player.togglePlay();
  }
}

function togglePlaylistPlayback() {
  if (!songs.value.length) return
  if (isCurrentPlaylistTrack.value) {
    player.togglePlay()
    return
  }
  playPlaylist()
}

function getSongId(song) {
  return song?.id ?? song?.song_id ?? null
}

function handlePlaylistDragStart() {
  if (!canReorderSongs.value) return
  playlistSongsBeforeDrag.value = [...songs.value]
}

async function handlePlaylistDragEnd(event) {
  if (!canReorderSongs.value) return
  if (event?.oldIndex === event?.newIndex) return

  const previousSongs = [...playlistSongsBeforeDrag.value]
  const nextSongs = [...songs.value]
  isReorderingSongs.value = true

  try {
    const songIds = nextSongs.map(getSongId).filter(Boolean)
    const res = await playlistApi.reorderSongs(playlist.value.id, songIds)
    const reorderedSongs = res.data?.data?.songs
    const returnedIds = Array.isArray(reorderedSongs)
      ? reorderedSongs.map(getSongId).filter(Boolean)
      : []
    if (returnedIds.length && returnedIds.join('|') !== songIds.join('|')) {
      playlist.value.songs = reorderedSongs
    }
  } catch (err) {
    playlist.value.songs = previousSongs
    toast.showToast(err.response?.data?.message || 'Khong the sap xep playlist', 'error')
  } finally {
    isReorderingSongs.value = false
    playlistSongsBeforeDrag.value = []
  }
}

async function removeSong(songId) {
  if (!canEditSongs.value) return;
  if(!confirm('Xóa bài này khỏi playlist?')) return;
  try {
    await playlistApi.removeSong(playlist.value.id, songId);
    await fetchDetail(true);
    toast.showToast('Đã xóa bài hát khỏi danh sách phát', 'danger');
  } catch (e) {
    toast.showToast('Lỗi xóa bài hát', 'error');
  }
}

function deletePlaylist() {
  if (!canEditMetadata.value) return;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!canEditMetadata.value) return;
  isSubmitting.value = true;
  try {
    const res = await playlistApi.deletePlaylist(playlist.value.id);
    if (res.data?.success) {
      showDeleteModal.value = false;
      toast.showToast('Đã xóa danh sách phát', 'danger');
      router.push('/library');
    }
  } catch (e) {
    toast.showToast(e.response?.data?.message || 'Lỗi khi xóa playlist', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

function editPlaylist() {
  if (!canEditMetadata.value) return;
  editForm.value.name = playlist.value.name;
  editForm.value.description = playlist.value.description || '';
  editForm.value.is_public = playlist.value.is_public;
  editForm.value.coverFile = null;
  editPreviewUrl.value = null;
  showEditModal.value = true;
  document.body.style.overflow = 'hidden';
}

function handleEditFile(e) {
  if (e.target.files && e.target.files.length > 0) {
    const file = e.target.files[0];
    editForm.value.coverFile = file;
    if (editPreviewUrl.value) URL.revokeObjectURL(editPreviewUrl.value);
    editPreviewUrl.value = URL.createObjectURL(file);
  }
}

function closeEditModal() {
  showEditModal.value = false;
  document.body.style.overflow = '';
  if (editPreviewUrl.value) URL.revokeObjectURL(editPreviewUrl.value);
}

async function submitEdit() {
  if (!canEditMetadata.value) return;
  if (!editForm.value.name) return;
  
  isSubmitting.value = true;
  const fd = new FormData();
  fd.append('name', editForm.value.name);
  fd.append('description', editForm.value.description);
  fd.append('is_public', editForm.value.is_public);
  if (editForm.value.coverFile) {
    fd.append('cover', editForm.value.coverFile);
  }

  try {
    await playlistApi.update(playlist.value.id, fd);
    await fetchDetail(true);
    closeEditModal();
    toast.showToast('Đã cập nhật danh sách phát');
  } catch (e) {
    toast.showToast('Lỗi cập nhật playlist', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

// Menu logic for songs
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}
async function toggleLike(song) {
  if (!song) return;
  await library.toggleLike(song)
}
function handleAddToPlaylist(song) { library.openPlaylistModal(song) }
function handleAddToQueue(song) { player.addToQueue(song) }
function handleGoToSong(song) { router.push(`/song/${song.id || song.song_id}`) }
function handleGoToArtist(song) { if (song.artist_id) router.push(`/artist/${song.artist_id}`) }
function handleGoToAlbum(song) { if (song.album_id) router.push(`/album/${song.album_id}`) }
function handleShare(song) { 
  navigator.clipboard.writeText(`${window.location.origin}/song/${song.id || song.song_id}`) 
}
</script>

<style scoped>
.playlist-row-ghost,
.playlist-row-chosen {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
  opacity: 0.72;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22);
}

.playlist-drag-handle {
  touch-action: none;
}

@media (hover: hover) {
  .playlist-drag-handle {
    opacity: 0;
  }

  .playlist-row-shell:hover .playlist-drag-handle,
  .playlist-drag-handle:focus-visible {
    opacity: 1;
  }
}
</style>
