<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import MfIcon from '@/components/common/MfIcon.vue'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const songId = route.params.songId
const currentSong = ref(null)
const loading = ref(true)
const currentTab = ref('plain')
const isConfirmOpen = ref(false)

const editForm = ref({
  plain_lyrics: '',
  synced_lyrics: '',
  sync_type: 'NONE'
})

const plainStats = computed(() => {
  const text = editForm.value.plain_lyrics || ''
  return `${text.length} ký tự · ${text.split('\n').length} dòng`
})

const syncedStats = computed(() => {
  const text = editForm.value.synced_lyrics || ''
  return `${text.length} ký tự · ${text.split('\n').length} dòng`
})

const isSyncedValid = computed(() => {
  const text = editForm.value.synced_lyrics || ''
  if (!text.trim()) return true
  const lines = text.split('\n').filter(l => l.trim())
  // Basic validation for [mm:ss.xx] or [mm:ss]
  const regex = /^\[\d{2}:\d{2}(\.\d{1,3})?\]/
  return lines.every(l => regex.test(l.trim()))
})

const safeRawMetadata = computed(() => {
  if (!currentSong.value) return {}
  const clone = { ...currentSong.value }
  return clone.lyrics || {}
})

const fetchSongDetail = async () => {
  try {
    loading.value = true
    const res = await api.get(`/admin/lyrics/${songId}`)
    if (res.data?.success) {
      currentSong.value = res.data.data
      editForm.value = {
        plain_lyrics: currentSong.value.lyrics?.plain_lyrics || '',
        synced_lyrics: currentSong.value.lyrics?.synced_lyrics || '',
        sync_type: currentSong.value.lyrics?.sync_type || 'NONE'
      }
    } else {
      toast.showToast('Không tìm thấy bài hát', 'error')
      router.push('/admin/lyrics')
    }
  } catch (err) {
    console.error('Failed to fetch song detail:', err)
    toast.showToast('Không thể tải dữ liệu bài hát', 'error')
    router.push('/admin/lyrics')
  } finally {
    loading.value = false
  }
}

const confirmSave = () => {
  if (!isSyncedValid.value) {
    toast.showToast('Timestamp synced lyrics không hợp lệ. Vui lòng kiểm tra lại định dạng [mm:ss.xx]', 'error')
    return
  }
  isConfirmOpen.value = true
}

const doSave = async () => {
  try {
    const payload = { ...editForm.value }
    payload.provider = 'MANUAL'
    if (payload.synced_lyrics && payload.synced_lyrics.trim()) {
      payload.sync_type = 'LINE_SYNCED'
    } else if (payload.plain_lyrics && payload.plain_lyrics.trim()) {
      payload.sync_type = 'PLAIN_TEXT'
    } else {
      payload.sync_type = 'NONE'
    }

    const res = await api.put(`/admin/lyrics/${songId}`, payload)
    if (res.data?.success) {
      isConfirmOpen.value = false
      toast.showToast('Đã cập nhật lyrics thành công (Provider: MANUAL)', 'success')
      fetchSongDetail()
    }
  } catch (err) {
    console.error('Save failed:', err)
    toast.showToast('Lỗi khi lưu lyrics', 'error')
    isConfirmOpen.value = false
  }
}

const copyToClipboard = (text) => {
  if (text) {
    navigator.clipboard.writeText(text)
    toast.showToast('Đã copy!', 'success')
  }
}

const resetChanges = () => {
  if (currentSong.value) {
    editForm.value = {
      plain_lyrics: currentSong.value.lyrics?.plain_lyrics || '',
      synced_lyrics: currentSong.value.lyrics?.synced_lyrics || '',
      sync_type: currentSong.value.lyrics?.sync_type || 'NONE'
    }
  }
}

onMounted(() => {
  if (songId) {
    fetchSongDetail()
  } else {
    router.push('/admin/lyrics')
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col bg-slate-50 relative overflow-hidden full-bleed">
    <!-- Header -->
    <header class="py-6 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <div class="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <router-link to="/admin/lyrics" class="hover:text-primary transition">Quản lý lời bài hát</router-link>
          <span>/</span>
          <span>Chi tiết lyrics</span>
        </div>
        <h1 class="text-2xl font-bold text-slate-900 leading-none">Chi tiết lời bài hát</h1>
      </div>

    </header>

    <div class="flex-1 overflow-y-auto p-6" v-if="loading">
      <div class="animate-pulse flex items-center justify-center h-full">
        <span class="text-slate-400">Đang tải dữ liệu...</span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6" v-else-if="currentSong">
      <div class="flex flex-col lg:flex-row gap-6 h-full max-w-[1400px] mx-auto">
        <!-- Left: Info -->
        <div class="w-full lg:w-[320px] shrink-0 space-y-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="aspect-square rounded-xl bg-slate-100 overflow-hidden border border-slate-200 mb-4">
              <img :src="currentSong.cover_url" class="w-full h-full object-cover">
            </div>
            <div>
              <h3 class="font-bold text-slate-900 text-lg leading-tight">{{ currentSong.title }}</h3>
              <p class="text-sm text-slate-500 mt-1">{{ currentSong.artist_name }}</p>
            </div>
            <div class="space-y-3 mt-5 text-sm pt-4 border-t border-slate-100">
              <div class="flex justify-between items-center"><span class="text-slate-500">Album</span><span class="text-slate-900 font-medium truncate max-w-[150px]" :title="currentSong.album_title">{{ currentSong.album_name || currentSong.album_title || '-' }}</span></div>
              <div class="flex justify-between items-center"><span class="text-slate-500">Thể loại</span><span class="text-slate-900 font-medium">{{ currentSong.genre_name || '-' }}</span></div>
              <div class="flex justify-between items-center"><span class="text-slate-500">Thời lượng</span><span class="text-slate-900 font-medium">{{ currentSong.duration }}s</span></div>
              <div class="flex justify-between items-center"><span class="text-slate-500">Provider</span><span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{{ currentSong.lyrics?.provider || 'NONE' }}</span></div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500">Loại lyrics</span>
                <span v-if="currentSong.lyrics?.lyrics_status === 'synced' || currentSong.lyrics?.sync_type === 'LINE_SYNCED'" class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">Đồng bộ</span>
                <span v-else-if="currentSong.lyrics?.lyrics_status === 'plain' || currentSong.lyrics?.sync_type === 'PLAIN_TEXT'" class="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Thường</span>
                <span v-else class="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700">Thiếu</span>
              </div>
              <div class="flex justify-between items-center"><span class="text-slate-500">Sync type DB</span><span class="text-slate-900 font-medium">{{ currentSong.lyrics?.sync_type || 'NONE' }}</span></div>
            </div>
          </div>
        </div>

        <!-- Right: Editor -->
        <div class="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[600px] min-w-0">
          <div class="flex border-b border-slate-200 shrink-0 px-2 pt-2">
            <button @click="currentTab = 'plain'" :class="currentTab === 'plain' ? 'border-primary text-primary font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'" class="px-4 py-3 text-sm font-medium border-b-2 transition">Plain Lyrics</button>
            <button @click="currentTab = 'synced'" :class="currentTab === 'synced' ? 'border-primary text-primary font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'" class="px-4 py-3 text-sm font-medium border-b-2 transition">Synced Lyrics</button>
            <button @click="currentTab = 'preview'" :class="currentTab === 'preview' ? 'border-primary text-primary font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'" class="px-4 py-3 text-sm font-medium border-b-2 transition">Preview</button>
            <button @click="currentTab = 'raw'" :class="currentTab === 'raw' ? 'border-primary text-primary font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'" class="px-4 py-3 text-sm font-medium border-b-2 transition">Raw Metadata</button>
          </div>

          <div class="flex-1 relative flex flex-col min-h-0 p-5">
            <div v-show="currentTab === 'plain'" class="flex-1 flex flex-col min-h-0">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-slate-500 font-medium">{{ plainStats }}</span>
                <button @click="copyToClipboard(editForm.plain_lyrics)" class="inline-flex items-center text-sm font-medium text-primary hover:text-primary-dark transition">
                  <MfIcon name="content_copy" size="16" class="mr-1" /> Copy
                </button>
              </div>
              <textarea v-model="editForm.plain_lyrics" class="flex-1 w-full p-4 text-sm font-mono leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white resize-none shadow-inner" placeholder="Nhập plain lyrics..."></textarea>
            </div>

            <div v-show="currentTab === 'synced'" class="flex-1 flex flex-col min-h-0">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-slate-500 font-medium">{{ syncedStats }}</span>
                <div class="flex items-center gap-4">
                  <span v-if="isSyncedValid && editForm.synced_lyrics.trim()" class="inline-flex items-center text-sm text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md">
                    <MfIcon name="check_circle" size="16" class="mr-1.5" /> Hợp lệ
                  </span>
                  <span v-if="!isSyncedValid" class="inline-flex items-center text-sm text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-md">
                    <MfIcon name="error" size="16" class="mr-1.5" /> Lỗi format timestamp
                  </span>
                  <button @click="copyToClipboard(editForm.synced_lyrics)" class="inline-flex items-center text-sm font-medium text-primary hover:text-primary-dark transition">
                    <MfIcon name="content_copy" size="16" class="mr-1" /> Copy
                  </button>
                </div>
              </div>
              <textarea v-model="editForm.synced_lyrics" class="flex-1 w-full p-4 text-sm font-mono leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white resize-none shadow-inner" placeholder="[00:00.00] Nhập synced lyrics..."></textarea>
              <p class="text-sm text-slate-500 mt-3 flex items-center gap-2">
                <MfIcon name="info" size="16" class="text-slate-400" />
                Định dạng timestamp chuẩn: <code class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold border border-slate-200">[mm:ss.xx]</code> hoặc <code class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold border border-slate-200">[mm:ss]</code>
              </p>
            </div>

            <div v-show="currentTab === 'preview'" class="flex-1 overflow-y-auto bg-slate-50 p-6 border border-slate-200 rounded-xl shadow-inner">
              <div v-if="editForm.synced_lyrics.trim()">
                <div v-for="(line, i) in editForm.synced_lyrics.split('\n')" :key="'sync'+i" class="text-[15px] py-1 whitespace-pre-wrap font-mono text-slate-800">{{ line }}</div>
              </div>
              <div v-else-if="editForm.plain_lyrics.trim()">
                <div v-for="(line, i) in editForm.plain_lyrics.split('\n')" :key="'plain'+i" class="text-[15px] py-1 whitespace-pre-wrap text-slate-800">{{ line }}</div>
              </div>
              <div v-else class="h-full flex items-center justify-center">
                <p class="text-slate-400 text-lg flex items-center gap-2"><MfIcon name="article" size="24" /> Chưa có lyrics...</p>
              </div>
            </div>

            <div v-show="currentTab === 'raw'" class="flex-1 overflow-y-auto bg-[#1e1e2e] text-[#a6e3a1] p-6 border border-slate-200 rounded-xl shadow-inner">
              <pre class="text-sm font-mono whitespace-pre-wrap">{{ JSON.stringify(safeRawMetadata, null, 2) }}</pre>
            </div>
          </div>
          
          <!-- Actions Footer -->
          <div class="border-t border-slate-200 p-5 bg-slate-50/50 rounded-b-2xl flex items-center justify-end gap-3">
            <button @click="resetChanges" class="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition shadow-sm">
              Reset thay đổi
            </button>
            <button @click="confirmSave" class="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-dark transition shadow-sm">
              <MfIcon name="save" size="18" class="mr-2" /> Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :open="isConfirmOpen"
      title="Xác nhận lưu"
      message="Bạn có chắc muốn cập nhật lyrics cho bài hát này? Thay đổi sẽ ghi đè dữ liệu hiện tại."
      confirmText="Lưu thay đổi"
      type="default"
      @confirm="doSave"
      @cancel="isConfirmOpen = false"
    />
  </div>
</template>

<style scoped>
.full-bleed {
  margin: -24px;
  height: calc(100% + 48px);
}
@media (max-width: 900px) {
  .full-bleed {
    margin: -18px;
    height: calc(100% + 36px);
  }
}
</style>
