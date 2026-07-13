<template>
  <section class="artist-page">
    <div v-if="initialLoading" class="artist-panel">Đang tải danh sách bài hát...</div>
    <div v-else-if="errorMsg" class="artist-panel error">{{ errorMsg }}</div>

    <div v-else class="artist-page-content">
      <!-- Header -->
      <div class="page-header">
        <p class="eyebrow">BÀI HÁT</p>
        <div class="header-main">
          <h1>Quản lý bài hát</h1>
          <span class="badge-total">{{ summary.totalSongs }} bài hát</span>
        </div>
        <p class="subtitle">Theo dõi và quản lý các bài hát thuộc hồ sơ nghệ sĩ của bạn.</p>
      </div>

      <!-- KPI Summary -->
      <div class="stats-grid">
        <div class="artist-stat-card">
          <div class="artist-stat-label">Tổng bài hát</div>
          <div class="artist-stat-value">{{ formatNumber(summary.totalSongs) }}</div>
        </div>
        <div class="artist-stat-card">
          <div class="artist-stat-label">Tổng lượt nghe</div>
          <div class="artist-stat-value">{{ formatNumber(summary.totalPlays) }}</div>
        </div>
        <div class="artist-stat-card">
          <div class="artist-stat-label text-success">Đủ metadata</div>
          <div class="artist-stat-value">{{ formatNumber(summary.completeMetadata) }}</div>
        </div>
        <div class="artist-stat-card">
          <div class="artist-stat-label text-warning">Thiếu dữ liệu</div>
          <div class="artist-stat-value">{{ formatNumber(summary.missingAudio + summary.missingCover) }}</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar" style="align-items: center;">
        <div class="search-box">
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            @keyup.enter="onSearchEnter"
            @focus="showSearchHistory = true"
            @blur="hideSearchHistory"
            type="text"
            placeholder="Tìm bài hát..."
            class="input-dark"
          />
          <button v-if="searchQuery" @mousedown.prevent="clearSearch" class="clear-search-btn" title="Xóa">×</button>

          <div v-if="showSearchHistory && searchHistory.length > 0" class="search-history-dropdown">
            <div class="history-header">
              <span class="muted">Lịch sử tìm kiếm</span>
              <button @mousedown.prevent="clearSearchHistory" class="clear-history-btn">Xóa</button>
            </div>
            <ul>
              <li v-for="(item, index) in searchHistory" :key="index" @mousedown.prevent="selectHistoryItem(item)">
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <div class="status-filters flex items-center gap-2 overflow-x-auto pb-1 -mb-1" style="flex: 1;">
          <button @click="filterByStatus('')" :class="['whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors border', statusFilter === '' ? 'bg-white text-black border-transparent' : 'bg-transparent text-white border-white/20 hover:border-white']">
            Tất cả ({{ summary.totalSongs || 0 }})
          </button>
          <button @click="filterByStatus('approved')" :class="['whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors border', statusFilter === 'approved' ? 'bg-[#1ed760] text-black border-transparent' : 'bg-transparent text-white border-white/20 hover:border-[#1ed760] hover:text-[#1ed760]']">
            Đã duyệt ({{ summary.approvedCount || 0 }})
          </button>
          <button @click="filterByStatus('pending')" :class="['whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors border', statusFilter === 'pending' ? 'bg-yellow-500 text-black border-transparent' : 'bg-transparent text-white border-white/20 hover:border-yellow-500 hover:text-yellow-500']">
            Chờ duyệt ({{ summary.pendingCount || 0 }})
          </button>
          <button @click="filterByStatus('rejected')" :class="['whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors border', statusFilter === 'rejected' ? 'bg-red-500 text-white border-transparent' : 'bg-transparent text-white border-white/20 hover:border-red-500 hover:text-red-500']">
            Từ chối ({{ summary.rejectedCount || 0 }})
          </button>
        </div>
        <div class="filters">
          <select v-model="sortOption" @change="handleSearch" class="select-dark">
            <option value="newest">Mới nhất</option>
            <option value="most_played">Nghe nhiều nhất</option>
            <option value="most_liked">Thích nhiều nhất</option>
            <option value="title_asc">Tên (A-Z)</option>
            <option value="title_desc">Tên (Z-A)</option>
          </select>
          <button @click="openUploadModal" class="btn-primary">
            Upload bài hát mới
          </button>
        </div>
      </div>

      <!-- Song List -->
      <div class="songs-container">
        <div class="song-table-wrapper" :class="{ 'is-loading': loading }">
          <table class="song-table" style="table-layout: fixed; min-width: 1000px;">
            <colgroup>
              <col style="width: 25%;">
              <col style="width: 15%;">
              <col style="width: 12%;">
              <col style="width: 9%;">
              <col style="width: 9%;">
              <col style="width: 9%;">
              <col style="width: 9%;">
              <col style="width: 12%;">
            </colgroup>
            <thead>
              <tr>
                <th>BÀI HÁT</th>
                <th>ALBUM</th>
                <th>THỂ LOẠI</th>
                <th class="text-right">THỜI LƯỢNG</th>
                <th class="text-right">LƯỢT NGHE</th>
                <th class="text-center">METADATA</th>
                <th class="text-center">TRẠNG THÁI</th>
                <th class="text-right">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="songs.length === 0 && !loading">
                <td colspan="8">
                  <div class="empty-state" style="border: none; background: transparent; padding: 100px 20px;">
                    <span class="empty-icon">🎵</span>
                    <p>Không tìm thấy bài hát nào.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="song in songs" :key="song.id">
                <td>
                  <div class="song-info-cell">
                    <img :src="normalizeImageUrl(song.coverUrl) || fallbackCover" @error="onImageError" class="song-cover-sm" alt="" />
                    <span class="song-title-sm">{{ song.title }}</span>
                  </div>
                </td>
                <td><span class="muted">{{ song.album?.title || '-' }}</span></td>
                <td><span class="muted">{{ song.genre?.name || '-' }}</span></td>
                <td class="text-right"><span class="muted">{{ formatDuration(song.duration) }}</span></td>
                <td class="text-right">{{ formatNumber(song.playCount) }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="song.metadataStatus">
                    {{ formatMetadataStatus(song.metadataStatus) }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="status-badge" :class="getReviewStatusClass(song.reviewStatus)">
                    {{ formatReviewStatus(song.reviewStatus) }}
                  </span>
                </td>
                <td class="text-right actions-cell">
                  <button @click="openDetailModal(song.id)" class="btn-icon">Chi tiết</button>
                  <button class="btn-icon disabled" title="Giai đoạn sau">Sửa</button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="pagination-wrapper" v-if="pagination.totalPages > 1 || songs.length > 0">
            <div class="pagination-info" v-if="pagination.total > 0">
              Hiển thị {{ (pagination.page - 1) * pagination.limit + 1 }}–{{ Math.min(pagination.page * pagination.limit, pagination.total) }} trong {{ formatNumber(pagination.total) }} bài hát
            </div>

            <div class="pagination-controls" v-if="pagination.totalPages > 1">
              <button
                @click="changePage(1)"
                :disabled="pagination.page === 1"
                class="page-btn-icon" title="Trang đầu"
              >
                &laquo;
              </button>
              <button
                @click="changePage(pagination.page - 1)"
                :disabled="pagination.page === 1"
                class="page-btn-icon" title="Trang trước"
              >
                &lsaquo;
              </button>

              <div class="page-input-wrapper">
                <span class="muted">Trang</span>
                <input
                  type="number"
                  v-model="pageInputValue"
                  @blur="handlePageInput"
                  @keyup.enter="handlePageInput"
                  class="page-input"
                  min="1"
                  :max="pagination.totalPages"
                />
                <span class="muted">/ {{ pagination.totalPages }}</span>
              </div>

              <button
                @click="changePage(pagination.page + 1)"
                :disabled="pagination.page === pagination.totalPages"
                class="page-btn-icon" title="Trang sau"
              >
                &rsaquo;
              </button>
              <button
                @click="changePage(pagination.totalPages)"
                :disabled="pagination.page === pagination.totalPages"
                class="page-btn-icon" title="Trang cuối"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Song Detail Modal -->
    <div v-if="showModal && selectedSong" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content dark-modal">
        <div class="modal-header">
          <h2>Chi tiết bài hát</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-hero">
            <img :src="normalizeImageUrl(selectedSong.coverUrl) || fallbackCover" @error="onImageError" class="detail-cover" alt="" />
            <div class="detail-titles">
              <span class="status-badge" :class="selectedSong.metadataStatus">{{ formatMetadataStatus(selectedSong.metadataStatus) }}</span>
              <span class="status-badge" :class="getReviewStatusClass(selectedSong.reviewStatus)" style="margin-left: 8px;">{{ formatReviewStatus(selectedSong.reviewStatus) }}</span>
              <h3>{{ selectedSong.title }}</h3>
              <p class="muted">{{ formatDuration(selectedSong.duration) }} • {{ formatNumber(selectedSong.playCount) }} lượt nghe • {{ formatNumber(selectedSong.likeCount) }} lượt thích</p>
            </div>
          </div>

          <div class="detail-info-grid">
            <div class="info-item">
              <label>Album</label>
              <span>{{ selectedSong.album?.title || 'Chưa thuộc album nào' }}</span>
            </div>
            <div class="info-item">
              <label>Thể loại</label>
              <span>{{ selectedSong.genre?.name || 'Chưa xác định' }}</span>
            </div>
            <div class="info-item">
              <label>File Audio</label>
              <span :class="{'text-success': !!selectedSong.audioUrl, 'text-warning': !selectedSong.audioUrl}">
                {{ selectedSong.audioUrl ? 'Đã tải lên' : 'Chưa có file audio' }}
              </span>
            </div>
            <div class="info-item">
              <label>Ảnh bìa</label>
              <span :class="{'text-success': !!selectedSong.coverUrl, 'text-warning': !selectedSong.coverUrl}">
                {{ selectedSong.coverUrl ? 'Đã tải lên' : 'Chưa có ảnh bìa' }}
              </span>
            </div>
            <div class="info-item">
              <label>Lời bài hát</label>
              <span>{{ selectedSong.lyricsStatus === 'available' ? 'Đã có' : 'Chưa có' }}</span>
            </div>
            <div class="info-item" v-if="selectedSong.reviewStatus === 'rejected' && selectedSong.rejectionReason">
              <label>Lý do từ chối</label>
              <span class="text-warning">{{ selectedSong.rejectionReason }}</span>
            </div>
            <div class="info-item">
              <label>Ngày tạo</label>
              <span>{{ formatDate(selectedSong.createdAt) }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn-secondary">Đóng</button>
          <button class="btn-primary disabled" title="Giai đoạn sau">Chỉnh sửa</button>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="modal-overlay" @click.self="closeUploadModal">
      <div class="modal-content dark-modal">
        <div class="modal-header">
          <h2>Upload bài hát mới</h2>
          <button @click="closeUploadModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleUpload" class="upload-form">
            <div class="form-section">
              <h3>Th&ocirc;ng tin b&agrave;i h&aacute;t</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label>T&ecirc;n b&agrave;i h&aacute;t <span class="text-danger">*</span></label>
                  <input type="text" v-model.trim="uploadForm.title" class="input-dark" placeholder="Nhập tên bài hát" required />
                </div>
                <div class="form-group">
                  <label>Th&#7875; lo&#7841;i <span class="text-danger">*</span></label>
                  <input
                    type="text"
                    class="input-dark readonly-field"
                    :value="uploadArtistGenreName"
                    readonly
                    disabled
                  />
                  <div class="helper-text">&#272;&#432;&#7907;c g&aacute;n theo h&#7891; s&#417; ngh&#7879; s&#297;</div>
                  <div v-if="!uploadArtistGenreId" class="warning-text">T&agrave;i kho&#7843;n ngh&#7879; s&#297; ch&#432;a &#273;&#432;&#7907;c Admin g&aacute;n th&#7875; lo&#7841;i, ch&#432;a th&#7875; g&#7917;i b&agrave;i h&aacute;t.</div>
                </div>
                <div class="form-group full-width">
                  <label>Album / EP <span class="muted">(tu&#7923; ch&#7885;n)</span></label>
                  <select v-model="uploadForm.albumId" class="select-dark">
                    <option value="">Single / Không thuộc album</option>
                    <option v-for="album in uploadOptions.albums" :key="album.id" :value="album.id">
                      {{ album.title }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>T&#7879;p t&#7843;i l&ecirc;n</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label>File Audio <span class="text-danger">*</span> <span class="muted">(mp3, wav, m4a)</span></label>
                  <input type="file" @change="onAudioFileChange" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a" class="input-dark" required />
                  <div v-if="uploadForm.audioFile" class="file-info text-success">{{ uploadForm.audioFile.name }} - {{ formatFileSize(uploadForm.audioFile.size) }}</div>
                </div>
                <div class="form-group">
                  <label>&#7842;nh b&igrave;a <span class="muted">(jpg, jpeg, png, webp)</span></label>
                  <input type="file" @change="onCoverFileChange" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="input-dark" />
                  <div v-if="uploadForm.coverFile" class="file-info text-success">{{ uploadForm.coverFile.name }} - {{ formatFileSize(uploadForm.coverFile.size) }}</div>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>Th&ocirc;ng tin b&#7893; sung</h3>
              <div class="form-group">
                <label>Lyrics <span class="muted">(tu&#7923; ch&#7885;n)</span></label>
                <textarea v-model="uploadForm.lyrics" class="input-dark textarea-dark" rows="4" placeholder="Dán lyrics nếu đã có"></textarea>
              </div>
              <div class="form-group">
                <label>Ghi ch&uacute; g&#7917;i Admin duy&#7879;t <span class="muted">(tu&#7923; ch&#7885;n)</span></label>
                <textarea v-model="uploadForm.submissionNote" class="input-dark textarea-dark" rows="3" placeholder="Ví dụ: bản acoustic, demo, hoặc ghi chú bản quyền..."></textarea>
              </div>
            </div>
            <div v-if="uploadError" class="alert alert-danger">{{ uploadError }}</div>
          </form>
        </div>
        <div class="modal-footer">
          <button @click="closeUploadModal" class="btn-secondary" :disabled="uploading">Hủy</button>
          <button @click="handleUpload" class="btn-primary" :disabled="uploading || !canSubmitUpload">
            {{ uploading ? 'Đang tải lên...' : 'Gửi duyệt' }}
          </button>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { artistStudioApi } from '@/api/artistStudio'
import { useToastStore } from '@/stores/toast'
import { normalizeImageUrl } from '@/utils/imageUrl'

const fallbackCover = 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=100&q=80'
const initialLoading = ref(true)
const loading = ref(false)
const errorMsg = ref('')
const toast = useToastStore()

const songs = ref([])
const summary = ref({ totalSongs: 0, totalPlays: 0, completeMetadata: 0, missingAudio: 0, missingCover: 0 })
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

const searchQuery = ref('')
const sortOption = ref('newest')
const searchHistory = ref([])
const showSearchHistory = ref(false)
let searchTimeout = null

const showModal = ref(false)
const selectedSong = ref(null)

const pageInputValue = ref(1)

watch(() => pagination.value.page, (val) => {
  pageInputValue.value = val
})

onMounted(() => {
  const saved = localStorage.getItem('artist_search_history')
  if (saved) {
    try {
      searchHistory.value = JSON.parse(saved)
    } catch(e) {}
  }
  fetchSongs()
})

const saveSearchHistory = (query) => {
  const q = query.trim()
  if (!q) return
  let current = searchHistory.value.filter(item => item !== q)
  current.unshift(q)
  if (current.length > 5) current.pop()
  searchHistory.value = current
  localStorage.setItem('artist_search_history', JSON.stringify(current))
}

const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchSongs(1)
  }, 200)
}

const onSearchEnter = () => {
  if (searchQuery.value) saveSearchHistory(searchQuery.value)
  showSearchHistory.value = false
  fetchSongs(1)
}

const clearSearch = () => {
  searchQuery.value = ''
  fetchSongs(1)
}

const hideSearchHistory = () => {
  showSearchHistory.value = false
}

const selectHistoryItem = (item) => {
  searchQuery.value = item
  saveSearchHistory(item)
  showSearchHistory.value = false
  fetchSongs(1)
}

const clearSearchHistory = () => {
  searchHistory.value = []
  localStorage.removeItem('artist_search_history')
  showSearchHistory.value = false
}

const handleSearch = () => {
  fetchSongs(1)
}

const statusFilter = ref('')

const filterByStatus = (status) => {
  statusFilter.value = status
  fetchSongs(1)
}

const scrollToTableTop = () => {
  const tableWrapper = document.querySelector('.song-table-wrapper')
  if (tableWrapper) {
    tableWrapper.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const fetchSongs = async (page = 1) => {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await artistStudioApi.getSongs({
      q: searchQuery.value,
      sort: sortOption.value,
      status: statusFilter.value,
      page: page,
      limit: 20
    })
    if (res.data.success) {
      songs.value = res.data.songs
      summary.value = res.data.summary
      pagination.value = res.data.pagination
    } else {
      errorMsg.value = res.data.message || 'Lỗi khi tải danh sách'
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'Không thể tải danh sách bài hát. Vui lòng thử lại.'
  } finally {
    loading.value = false
    initialLoading.value = false
    setTimeout(scrollToTableTop, 100)
  }
}



const changePage = (newPage) => {
  if (newPage > 0 && newPage <= pagination.value.totalPages && newPage !== pagination.value.page) {
    fetchSongs(newPage)
  }
}

const handlePageInput = () => {
  let val = parseInt(pageInputValue.value, 10)
  if (isNaN(val) || val < 1) val = 1
  if (val > pagination.value.totalPages) val = pagination.value.totalPages

  pageInputValue.value = val
  if (val !== pagination.value.page) {
    changePage(val)
  }
}

const openDetailModal = async (id) => {
  try {
    const res = await artistStudioApi.getSongDetail(id)
    if (res.data.success) {
      selectedSong.value = res.data.song
      showModal.value = true
    }
  } catch (err) {
    console.error(err)
    alert('Không thể tải chi tiết bài hát.')
  }
}

const closeModal = () => {
  showModal.value = false
  selectedSong.value = null
}

const formatNumber = (val) => new Intl.NumberFormat('vi-VN').format(Number(val || 0))

const formatDuration = (sec) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

const formatMetadataStatus = (status) => {
  switch (status) {
    case 'complete': return 'Đầy đủ'
    case 'missing_audio': return 'Thiếu audio'
    case 'missing_cover': return 'Thiếu cover'
    case 'missing_genre': return 'Thiếu thể loại'
    case 'incomplete': return 'Chưa hoàn thiện'
    default: return status
  }
}

const getReviewStatusClass = (status) => {
  switch (status) {
    case 'approved': return 'text-success'
    case 'pending_review': return 'text-warning'
    case 'rejected': return 'text-danger'
    default: return ''
  }
}

const formatReviewStatus = (status) => {
  switch (status) {
    case 'approved': return 'Đã duyệt'
    case 'pending_review': return 'Chờ duyệt'
    case 'rejected': return 'Từ chối'
    default: return status
  }
}

const onImageError = (e) => {
  e.target.src = fallbackCover
}

// Upload Modal Logic
const showUploadModal = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const uploadOptionsLoading = ref(false)
const uploadOptions = ref({ artist: null, albums: [] })
const uploadForm = ref({
  title: '',
  albumId: '',
  lyrics: '',
  submissionNote: '',
  audioFile: null,
  coverFile: null
})

const canSubmitUpload = computed(() => {
  return !!uploadForm.value.title.trim() && !!uploadArtistGenreId.value && !!uploadForm.value.audioFile
})

const uploadArtistGenreId = computed(() => uploadOptions.value.artist?.genreId || null)
const uploadArtistGenreName = computed(() => uploadOptions.value.artist?.genreName || 'Chưa được gán thể loại')

const fetchUploadOptions = async () => {
  uploadOptionsLoading.value = true
  try {
    const res = await artistStudioApi.getUploadOptions()
    if (res.data.success) {
      uploadOptions.value = {
        artist: res.data.artist || null,
        albums: res.data.albums || []
      }
    }
  } catch (err) {
    console.error(err)
    toast.showToast('Không thể tải danh sách thể loại/album', 'error')
  } finally {
    uploadOptionsLoading.value = false
  }
}

const resetUploadForm = () => {
  uploadForm.value = {
    title: '',
    albumId: '',
    lyrics: '',
    submissionNote: '',
    audioFile: null,
    coverFile: null
  }
}

const openUploadModal = async () => {
  resetUploadForm()
  uploadError.value = ''
  showUploadModal.value = true
  await fetchUploadOptions()
}

const closeUploadModal = () => {
  showUploadModal.value = false
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  else return (bytes / 1048576).toFixed(1) + ' MB'
}

const hasAllowedExtension = (file, exts) => {
  const name = file?.name || ''
  return exts.some(ext => name.toLowerCase().endsWith(ext))
}

const onAudioFileChange = (e) => {
  const file = e.target.files[0]
  if (!file) {
    uploadForm.value.audioFile = null
    return
  }
  if (!hasAllowedExtension(file, ['.mp3', '.wav', '.m4a'])) {
    uploadError.value = 'File audio chỉ nhận mp3, wav, m4a.'
    e.target.value = ''
    uploadForm.value.audioFile = null
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    uploadError.value = 'File âm thanh quá lớn (tối đa 20MB).'
    e.target.value = ''
    uploadForm.value.audioFile = null
    return
  }
  uploadError.value = ''
  uploadForm.value.audioFile = file
}

const onCoverFileChange = (e) => {
  const file = e.target.files[0]
  if (!file) {
    uploadForm.value.coverFile = null
    return
  }
  if (!hasAllowedExtension(file, ['.jpg', '.jpeg', '.png', '.webp'])) {
    uploadError.value = 'Ảnh bìa chỉ nhận jpg, jpeg, png, webp.'
    e.target.value = ''
    uploadForm.value.coverFile = null
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = 'Ảnh bìa quá lớn (tối đa 5MB).'
    e.target.value = ''
    uploadForm.value.coverFile = null
    return
  }
  uploadError.value = ''
  uploadForm.value.coverFile = file
}

const handleUpload = async () => {
  if (!uploadForm.value.title.trim()) {
    uploadError.value = 'Vui lòng nhập tên bài hát.'
    return
  }
  if (!uploadArtistGenreId.value) {
    uploadError.value = 'Nghệ sĩ chưa được gán thể loại. Vui lòng liên hệ Admin.'
    return
  }
  if (!uploadForm.value.audioFile) {
    uploadError.value = 'Vui lòng chọn file audio.'
    return
  }

  uploadError.value = ''
  uploading.value = true

  try {
    const formData = new FormData()
    formData.append('title', uploadForm.value.title.trim())
    if (uploadForm.value.albumId) formData.append('albumId', uploadForm.value.albumId)
    if (uploadForm.value.lyrics.trim()) formData.append('lyrics', uploadForm.value.lyrics.trim())
    if (uploadForm.value.submissionNote.trim()) formData.append('submissionNote', uploadForm.value.submissionNote.trim())
    formData.append('audio', uploadForm.value.audioFile)
    if (uploadForm.value.coverFile) formData.append('cover', uploadForm.value.coverFile)

    const res = await artistStudioApi.uploadArtistSong(formData)
    if (res.data.success) {
      toast.showToast('Bài hát đã được gửi Admin duyệt.', 'success')
      closeUploadModal()
      fetchSongs(1)
    } else {
      uploadError.value = res.data.message || 'Lỗi khi tải lên'
    }
  } catch (err) {
    console.error(err)
    uploadError.value = err.response?.data?.message || 'Có lỗi xảy ra khi tải lên. Vui lòng thử lại.'
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.artist-page {
  padding: 0;
}

.page-header {
  margin-bottom: 32px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
}

.badge-total {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.artist-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.artist-stat-value {
  font-size: 36px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.toolbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  max-width: 400px;
  min-width: 200px;
  position: relative;
}

.input-dark, .select-dark {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0 12px;
  border-radius: var(--radius-sm);
  outline: none;
  font-family: inherit;
  font-size: 13px;
  height: 36px;
  line-height: 34px;
  box-sizing: border-box;
}

.input-dark {
  width: 100%;
  padding-right: 32px;
}

.select-dark {
  width: auto;
  min-width: 150px;
  cursor: pointer;
}

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filters .btn-primary {
  height: 36px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  white-space: nowrap;
  box-sizing: border-box;
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.clear-search-btn:hover {
  color: var(--text-primary);
}

.search-history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-top: 4px;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.history-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
}

.clear-history-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.clear-history-btn:hover {
  color: var(--accent);
}

.search-history-dropdown ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.search-history-dropdown li {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-primary);
}

.search-history-dropdown li:hover {
  background: var(--bg-card-hover);
}

.input-dark:focus, .select-dark:focus {
  border-color: var(--accent);
}

.filters {
  display: flex;
  gap: 12px;
}

.song-table-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  height: 450px;
  overflow-y: auto;
  overflow-x: auto;
  transition: opacity 0.2s;
}

.song-table-wrapper.is-loading {
  opacity: 0.5;
  pointer-events: none;
}

.song-table {
  width: 100%;
  border-collapse: collapse;
}

.song-table th, .song-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.actions-cell {
  white-space: nowrap;
}

.song-table th {
  color: #fff;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-card);
}

.song-table tr:hover {
  background: var(--bg-card-hover);
}

.song-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.song-cover-sm {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
}

.song-title-sm {
  font-weight: 600;
  color: var(--text-primary);
}

.muted {
  color: var(--text-muted);
}

.text-right {
  text-align: right !important;
}

.text-center {
  text-align: center !important;
}

.text-success { color: var(--success); }
.text-warning { color: var(--warning); }

.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255,255,255,0.05);
}
.status-badge.complete { background: rgba(46, 213, 115, 0.15); color: var(--success); }
.status-badge.missing_audio, .status-badge.missing_cover, .status-badge.missing_genre, .status-badge.incomplete { background: rgba(255, 165, 2, 0.15); color: var(--warning); }

.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-icon {
  background: rgba(255,255,255,0.05);
  border: none;
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-icon:hover:not(.disabled) {
  background: rgba(255,255,255,0.1);
}

.btn-primary {
  background: var(--accent);
  color: #000;
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.btn-secondary {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary);
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
}

.empty-state {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 16px;
}

.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 16px;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.pagination-info {
  font-size: 13px;
  color: var(--text-muted);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn-icon {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.page-btn-icon:hover:not(:disabled) {
  background: rgba(255,255,255,0.05);
  border-color: var(--accent);
}

.page-btn-icon:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.page-btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin: 0 8px;
}

.page-input {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  width: 50px;
  height: 32px;
  text-align: center;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.page-input:focus {
  border-color: var(--accent);
}

.page-input::-webkit-outer-spin-button,
.page-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.dark-modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  cursor: pointer;
}

.close-btn:hover { color: #fff; }

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.detail-hero {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
}

.detail-cover {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  object-fit: cover;
}

.detail-titles {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.detail-titles h3 {
  margin: 8px 0 4px 0;
  font-size: 20px;
}

.detail-titles p {
  margin: 0;
  font-size: 13px;
}

.detail-info-grid {
  display: grid;
  gap: 16px;
  background: rgba(0,0,0,0.2);
  padding: 16px;
  border-radius: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.info-item label {
  color: var(--text-muted);
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-section h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.full-width {
  grid-column: 1 / -1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
}

.textarea-dark {
  width: 100%;
  height: auto;
  min-height: 86px;
  padding: 10px 12px;
  line-height: 1.45;
  resize: vertical;
}

.form-group input[type="file"] {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  height: auto;
  line-height: 1.5;
}

.form-group input[type="file"]:hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
}

.form-group input[type="file"]::file-selector-button {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  margin-right: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.form-group input[type="file"]::file-selector-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.file-info {
  font-size: 13px;
  margin-top: 4px;
}

.readonly-field {
  opacity: 0.85;
  cursor: not-allowed;
}

.helper-text {
  color: var(--text-muted);
  font-size: 12px;
}

.warning-text {
  color: var(--warning);
  font-size: 12px;
  line-height: 1.4;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
