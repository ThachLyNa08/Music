<template>
  <div v-if="library.showPlaylistModal" class="modal-backdrop" @click.self="library.closePlaylistModal">
    <div class="modal-glass">
      <div class="modal-header">
        <h2>Thêm vào Playlist</h2>
        <button class="btn-close" @click="library.closePlaylistModal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="song-preview" v-if="library.songToAdd">
        <img :src="library.songToAdd.cover || library.songToAdd.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100'" class="preview-img" />
        <div class="preview-info">
          <div class="preview-title">{{ library.songToAdd.title }}</div>
          <div class="preview-artist">{{ library.songToAdd.artist_name || library.songToAdd.artist }}</div>
        </div>
      </div>

      <div class="playlists-list" v-if="loading">
        <div class="loading-state">Đang tải danh sách playlist...</div>
      </div>
      <div class="playlists-list" v-else-if="playlists.length === 0">
        <div class="empty-state">Bạn chưa có playlist nào. Hãy tạo mới một playlist ở Thư viện.</div>
      </div>
      <div class="playlists-list" v-else>
        <button v-for="p in playlists" :key="p.id" class="playlist-row" @click="addToPlaylist(p.id)">
          <div class="playlist-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <div class="playlist-info">
            <div class="playlist-name">{{ p.name }}</div>
            <div class="playlist-count">{{ p.total_songs }} bài hát</div>
          </div>
          <div class="add-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { playlistApi } from '@/api/playlist'

const library = useLibraryStore()
const playlists = ref([])
const loading = ref(false)

watch(() => library.showPlaylistModal, async (newVal) => {
  if (newVal) {
    await fetchPlaylists()
  }
})

async function fetchPlaylists() {
  loading.value = true
  try {
    const res = await playlistApi.getMyPlaylists()
    if (res.data?.success) {
      // Only show user's own editable playlists
      playlists.value = res.data.data.filter(p => p.can_edit)
    }
  } catch (err) {
    console.error('Failed to load playlists', err)
  } finally {
    loading.value = false
  }
}

async function addToPlaylist(playlistId) {
  const songId = library.songToAdd?.id
  if (!songId) {
    alert('Dữ liệu bài hát không hợp lệ (Mock data thiếu ID)')
    return
  }
  try {
    const res = await playlistApi.addSong(playlistId, songId)
    if (res.data?.success) {
      alert('Đã thêm bài hát vào playlist thành công!')
      library.closePlaylistModal()
    }
  } catch (e) {
    alert(e.response?.data?.message || 'Lỗi khi thêm bài hát')
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}

.modal-glass {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #fff;
  border-radius: 24px;
  width: 100%; max-width: 420px;
  max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 50px rgba(0,0,0,0.1);
  backdrop-filter: blur(20px);
  overflow: hidden;
}

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.modal-header h2 { margin: 0; font-size: 20px; font-weight: 900; color: #2d3436; }
.btn-close {
  background: rgba(0,0,0,0.05); border: none; padding: 6px; border-radius: 50%;
  color: #636e72; cursor: pointer; transition: all 0.2s; display: flex;
}
.btn-close:hover { background: #ff7675; color: white; transform: rotate(90deg); }
.btn-close svg { width: 20px; height: 20px; }

.song-preview {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 24px;
  background: rgba(162, 155, 254, 0.1);
}
.preview-img { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.preview-info { flex: 1; min-width: 0; }
.preview-title { font-weight: 800; font-size: 15px; color: #2d3436; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-artist { font-size: 13px; font-weight: 600; color: #636e72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.playlists-list {
  flex: 1; overflow-y: auto;
  padding: 12px 16px 24px;
  display: flex; flex-direction: column; gap: 8px;
}
.loading-state, .empty-state { padding: 32px; text-align: center; color: #636e72; font-weight: 600; font-size: 14px; }

.playlist-row {
  display: flex; align-items: center; gap: 16px;
  padding: 12px 16px; border-radius: 16px;
  background: rgba(255, 255, 255, 0.5); border: 1px solid transparent;
  cursor: pointer; transition: all 0.2s; text-align: left;
}
.playlist-row:hover {
  background: #ffffff; border-color: rgba(162, 155, 254, 0.5);
  transform: translateX(4px); box-shadow: 0 8px 20px rgba(162, 155, 254, 0.15);
}
.playlist-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: linear-gradient(135deg, #a29bfe, #74b9ff); color: white;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(162, 155, 254, 0.3);
}
.playlist-info { flex: 1; min-width: 0; }
.playlist-name { font-weight: 800; font-size: 14px; color: #2d3436; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.playlist-count { font-size: 12px; font-weight: 500; color: #636e72; }
.add-icon { color: #a29bfe; opacity: 0; transform: translateX(-10px); transition: all 0.2s; display: flex; }
.playlist-row:hover .add-icon { opacity: 1; transform: translateX(0); }
</style>
