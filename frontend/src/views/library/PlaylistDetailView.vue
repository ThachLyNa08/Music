<template>
  <div class="flex flex-col user-page-bg pb-4" v-if="!loadingData && playlist">
    <!-- Header Hero -->
    <div class="relative m-6 flex items-end gap-6 overflow-hidden rounded-[28px] border border-white/10 px-8 py-10 pt-20 bg-gradient-to-br from-violet-900/45 via-slate-950/70 to-slate-950">
      <!-- Shadow and gradient overlay to blend with background -->
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>
      
      <div class="w-[232px] h-[232px] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex-shrink-0 relative z-10 bg-white/10 flex items-center justify-center">
        <CoverImage :src="getPlaylistCover(playlist)" class="w-full h-full object-cover rounded-lg shadow-2xl" />
      </div>

      <div class="flex flex-col gap-3 relative z-10 text-white mt-10 w-full">
        <div class="text-sm font-bold tracking-wider flex items-center gap-2">
          <span v-if="playlist.is_system" class="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md text-xs font-black uppercase tracking-widest border border-indigo-500/30">Playlist hệ thống</span>
          <span v-else>{{ playlist.is_public ? 'Playlist Công Khai' : 'Playlist Riêng Tư' }}</span>
        </div>
        <h1 class="text-5xl md:text-7xl font-black tracking-tighter m-0 leading-none py-2">{{ playlist.name }}</h1>
        <p class="text-gray-300 font-medium text-sm mt-2">{{ playlist.description || 'Không có mô tả.' }}</p>
        <div class="flex items-center gap-2 text-sm font-semibold text-gray-300 mt-2">
          <span>Tạo bởi <b class="text-white hover:underline cursor-pointer">{{ playlist.creator_name || 'MusicFlow' }}</b></span>
          <span class="w-1 h-1 bg-white rounded-full mx-1"></span>
          <span>{{ songs.length }} bài hát</span>
          <span class="w-1 h-1 bg-white rounded-full mx-1"></span>
          <span>Cập nhật: {{ new Date(playlist.updated_at).toLocaleDateString('vi-VN') }}</span>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex items-center gap-4 mt-6">
          <button class="w-14 h-14 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-105 hover:bg-emerald-400 transition-all duration-200 shadow-[0_8px_20px_rgba(16,185,129,0.3)] border-none cursor-pointer" @click="playPlaylist" v-if="songs.length > 0">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" class="ml-1"><path d="M8 5v14l11-7z"/></svg>
          </button>
          
          <template v-if="canEdit">
            <button class="bg-transparent border-none text-gray-400 font-bold px-4 py-2 hover:text-white hover:scale-105 transition-all cursor-pointer flex items-center gap-2" @click="editPlaylist">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Sửa
            </button>
            <button class="bg-transparent border-none text-gray-400 font-bold px-4 py-2 hover:text-red-400 hover:scale-105 transition-all cursor-pointer flex items-center gap-2" @click="deletePlaylist">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Xóa
            </button>
          </template>
          <template v-else-if="playlist.is_system">
            <button v-if="!playlist.is_saved" class="bg-indigo-600 border-none text-white font-bold px-5 py-2.5 rounded-full hover:bg-indigo-500 hover:scale-105 transition-all cursor-pointer flex items-center gap-2 shadow-[0_4px_15px_rgba(99,102,241,0.4)]" @click="toggleSavePlaylist" :disabled="isSaving">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              Lưu vào thư viện
            </button>
            <button v-else class="bg-transparent border border-indigo-500/50 text-indigo-300 font-bold px-5 py-2.5 rounded-full hover:bg-indigo-500/10 hover:text-white transition-all cursor-pointer flex items-center gap-2" @click="toggleSavePlaylist" :disabled="isSaving">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" class="text-indigo-400"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              Đã lưu trong thư viện
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Song List Section -->
    <div class="mx-6 px-6 py-4 user-panel-soft flex-1 relative">
      
      <!-- Table Header -->
      <div class="relative z-10 w-full mb-4 px-4 flex items-center text-sm font-semibold text-slate-400 border-b border-white/10 pb-2 mt-4 sticky top-0 bg-slate-950/80 backdrop-blur-md z-20 h-10">
        <div class="w-8 text-center mr-4">#</div>
        <div class="flex-1">Tiêu đề</div>
        <div class="w-32 hidden md:block">Album</div>
        <div class="w-24 flex items-center justify-end pr-10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/></svg>
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
        <SongRow
          v-for="(song, idx) in songs"
          :key="song.id"
          :song="song"
          :index="idx + 1"
          :showIndex="true"
          :showAlbum="true"
          :compact="true"
          :isPlaying="player.currentSong?.id === song.id"
          @play="playSong"
          @open-menu="handleOpenMenu"
          @toggle-like="toggleLike"
        />
      </div>

      <!-- Unified Recommendations & Search Section -->
      <div v-if="canEdit" class="relative z-10 mt-8 pt-8 pb-12 border-t border-white/10">
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
      @close="menuState.show = false"
      @add-to-playlist="handleAddToPlaylist"
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
  <div v-if="showEditModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]" @click.self="showEditModal = false">
    <div class="user-modal w-full max-w-md">
      <h2 class="m-0 mb-6 font-black text-2xl text-white">Sửa thông tin Playlist</h2>
      <form @submit.prevent="submitEdit" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">Tên Playlist</label>
          <input v-model="editForm.name" type="text" required placeholder="Nhập tên mới..." class="px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/50 text-white font-semibold outline-none focus:border-indigo-500 focus:bg-gray-800 transition-colors" />
        </div>
        
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">Mô tả</label>
          <input v-model="editForm.description" type="text" placeholder="Thêm mô tả..." class="px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/50 text-white font-semibold outline-none focus:border-indigo-500 focus:bg-gray-800 transition-colors" />
        </div>

        <div class="flex items-center justify-between mt-2">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">Quyền riêng tư</label>
          <select v-model="editForm.is_public" class="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white font-semibold outline-none cursor-pointer">
            <option :value="true">Công khai</option>
            <option :value="false">Riêng tư</option>
          </select>
        </div>

        <div class="mt-4" @click="$refs.editCoverInput.click()">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer">Ảnh bìa</label>
          <input type="file" ref="editCoverInput" accept="image/*" @change="handleEditFile" hidden />
          <div class="mt-2 p-4 border border-dashed border-indigo-500/50 rounded-xl text-center cursor-pointer font-bold text-sm bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500 transition-colors" :class="editForm.coverFile ? 'text-emerald-400' : 'text-indigo-400'">
            <span v-if="!editForm.coverFile">Nhấp để tải ảnh lên</span>
            <span v-else>🖼️ {{ editForm.coverFile.name }}</span>
          </div>
        </div>

        <div class="flex gap-3 mt-8">
          <button type="button" class="flex-1 py-3 rounded-xl font-bold bg-transparent border border-gray-700 text-gray-300 cursor-pointer hover:bg-gray-800 hover:text-white transition-colors" @click="showEditModal = false">Hủy</button>
          <button type="submit" class="flex-1 py-3 rounded-xl font-bold bg-white text-black border-none cursor-pointer hover:scale-105 transition-transform" :disabled="isSubmitting">Lưu thay đổi</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete Modal -->
  <div v-if="showDeleteModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]" @click.self="showDeleteModal = false">
    <div class="user-modal w-full max-w-sm">
      <h2 class="m-0 mb-4 font-black text-2xl text-white">Xóa Playlist?</h2>
      <p class="text-gray-400 text-sm font-medium mb-8 leading-relaxed">Bạn có chắc chắn muốn xóa playlist <strong class="text-white">{{ playlist?.name }}</strong> không? Hành động này không thể hoàn tác.</p>
      <div class="flex gap-3">
        <button type="button" class="flex-1 py-3 rounded-xl font-bold bg-transparent border border-gray-700 text-gray-300 cursor-pointer hover:bg-gray-800 hover:text-white transition-colors" @click="showDeleteModal = false">Hủy</button>
        <button type="button" class="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white border-none cursor-pointer hover:bg-red-600 hover:scale-105 transition-all" @click="confirmDelete" :disabled="isSubmitting">Xóa vĩnh viễn</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { playlistApi } from '@/api/playlist'
import { spotifyApi } from '@/api/spotify'
import api from '@/api/axios'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import PlaylistRecommendations from '@/components/playlist/PlaylistRecommendations.vue'
import PlaylistInlineSearch from '@/components/playlist/PlaylistInlineSearch.vue'
import { getPlaylistCover } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
const auth = useAuthStore()

const playlist = ref(null)
const error = ref('')
const loadingData = ref(true)

const showEditModal = ref(false)
const showDeleteModal = ref(false)
const isSubmitting = ref(false)
const editForm = ref({ name: '', description: '', is_public: true, coverFile: null })

const addingSongIds = ref(new Set())

const canEdit = computed(() => {
  if (!playlist.value) return false
  if (playlist.value.can_edit !== undefined) return !!playlist.value.can_edit
  return false
})

const songs = computed(() => Array.isArray(playlist.value?.songs) ? playlist.value.songs : [])

const existingSongIds = computed(() => {
  return new Set(songs.value.map(s => s.id || s.song_id))
})

async function handleAddSong(song) {
  if (!song || existingSongIds.value.has(song.id)) return
  
  addingSongIds.value.add(song.id)
  try {
    const res = await playlistApi.addSong(playlist.value.id, song.id)
    if (res.data?.success || res.status === 200 || res.status === 201) {
      await fetchDetail() // Reload playlist details
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Đã có lỗi xảy ra'
    if (msg.includes('exist') || msg.includes('tồn tại')) {
      alert('Bài hát đã có trong playlist')
    } else {
      alert(msg)
    }
  } finally {
    addingSongIds.value.delete(song.id)
  }
}

async function fetchDetail() {
  loadingData.value = true
  error.value = ''
  try {
    const id = route.params.id
    if (typeof id === 'string' && id.startsWith('spotify:')) {
      const cleanId = String(id).replace('spotify:playlist:', '').replace('spotify:', '')
      const res = await spotifyApi.getPlaylist(cleanId)
      if (res.data?.success) {
        playlist.value = res.data.data
      }
    } else {
      const res = await playlistApi.getDetail(id)
      if (res.data?.success) {
        playlist.value = res.data.data
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
      }
    } else {
      const res = await playlistApi.savePlaylist(playlist.value.id)
      if (res.data?.success) {
        playlist.value.is_saved = true
      }
    }
    if (library.fetchPlaylists) {
      library.fetchPlaylists() // refresh library sidebar
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Có lỗi xảy ra khi lưu playlist')
  } finally {
    isSaving.value = false
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

async function removeSong(songId) {
  if(!confirm('Xóa bài này khỏi playlist?')) return;
  try {
    await playlistApi.removeSong(playlist.value.id, songId);
    await fetchDetail();
  } catch (e) {
    alert('Lỗi xóa bài hát');
  }
}

function deletePlaylist() {
  showDeleteModal.value = true;
}

async function confirmDelete() {
  isSubmitting.value = true;
  try {
    const res = await playlistApi.deletePlaylist(playlist.value.id);
    if (res.data?.success) {
      showDeleteModal.value = false;
      router.push('/library');
    }
  } catch (e) {
    alert(e.response?.data?.message || 'Lỗi khi xóa playlist');
  } finally {
    isSubmitting.value = false;
  }
}

function editPlaylist() {
  editForm.value.name = playlist.value.name;
  editForm.value.description = playlist.value.description || '';
  editForm.value.is_public = playlist.value.is_public;
  editForm.value.coverFile = null;
  showEditModal.value = true;
}

function handleEditFile(e) {
  if (e.target.files && e.target.files.length > 0) {
    editForm.value.coverFile = e.target.files[0];
  }
}

async function submitEdit() {
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
    await fetchDetail();
    showEditModal.value = false;
  } catch (e) {
    alert('Lỗi cập nhật playlist');
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
