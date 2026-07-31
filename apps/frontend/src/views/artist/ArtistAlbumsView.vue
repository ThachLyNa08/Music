<template>
  <section class="artist-page">
    <div v-if="initialLoading" class="artist-panel">Đang tải danh sách album...</div>
    <div v-else-if="errorMsg" class="artist-panel error">{{ errorMsg }}</div>

    <div v-else class="artist-page-content">
      <!-- Header -->
      <div class="page-header">
        <p class="eyebrow">ALBUM</p>
        <div class="header-main">
          <h1>Quản lý album</h1>
          <span class="badge-total">{{ albums.length }} album</span>
        </div>
        <p class="subtitle">Theo dõi và quản lý các album âm nhạc của bạn.</p>
      </div>

      <!-- Toolbar -->
      <div class="toolbar" style="align-items: center;">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm album..."
            class="input-dark"
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="clear-search-btn" title="Xóa">×</button>
        </div>

        <div class="status-filters">
          <select v-model="statusFilter" @change="filterByStatus(statusFilter)" class="select-dark" style="width: auto; min-width: 160px;">
            <option value="">Tất cả trạng thái</option>
            <option value="approved">Đã duyệt</option>
            <option value="pending">Chờ duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>

        <div class="filters">
          <button @click="openUploadModal" class="btn-primary">
            Tạo album mới
          </button>
        </div>
      </div>

      <!-- Album List -->
      <div class="songs-container">
        <div class="song-table-wrapper" :class="{ 'is-loading': loading }">
          <div class="table-scroll-area">
            <table class="song-table" style="table-layout: fixed; min-width: 1000px;">
              <colgroup>
                <col style="width: 30%;">
                <col style="width: 15%;">
                <col style="width: 15%;">
                <col style="width: 15%;">
                <col style="width: 25%;">
              </colgroup>
              <thead>
                <tr>
                  <th>ALBUM</th>
                  <th class="text-center">SỐ BÀI HÁT</th>
                  <th class="text-center">NGÀY PHÁT HÀNH</th>
                  <th class="text-center">TRẠNG THÁI</th>
                  <th class="text-right">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredAlbums.length === 0 && !loading">
                  <td colspan="5">
                    <div class="empty-state" style="border: none; background: transparent; padding: 100px 20px;">
                      <span class="empty-icon">💿</span>
                      <p>Không tìm thấy album nào.</p>
                    </div>
                  </td>
                </tr>
                <tr v-for="album in paginatedAlbums" :key="album.id">
                  <td>
                    <div class="song-info-cell">
                      <img :src="normalizeImageUrl(album.coverUrl) || fallbackCover" @error="onImageError" class="song-cover-sm" alt="" />
                      <span class="song-title-sm">{{ album.name }}</span>
                    </div>
                  </td>
                  <td class="text-center">{{ album.songCount }}</td>
                  <td class="text-center"><span class="muted">{{ formatDate(album.releaseDate) }}</span></td>
                  <td class="text-center">
                    <span class="status-badge" :class="getReviewStatusClass(album.reviewStatus)">
                      {{ formatReviewStatus(album.reviewStatus) }}
                    </span>
                  </td>
                  <td class="text-right actions-cell">
                    <button @click="openDetailModal(album.id)" class="btn-icon">Chi tiết</button>
                    <button v-if="album.reviewStatus === 'rejected'" @click="openResubmitModal(album)" class="btn-icon">Sửa lại</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination-wrapper">
            <div class="pagination-info">
              Hiển thị {{ (currentPage - 1) * itemsPerPage + 1 }} -
              {{ Math.min(currentPage * itemsPerPage, filteredAlbums.length) }}
              trong số {{ filteredAlbums.length }} album
            </div>
            <div class="pagination-controls">
              <button class="page-btn-icon" :disabled="currentPage === 1" @click="currentPage--">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div class="page-input-wrapper">
                <span>Trang</span>
                <input type="number" v-model.number="currentPageInput" @keyup.enter="goToPage" class="page-input" min="1" :max="totalPages" />
                <span>/ {{ totalPages }}</span>
              </div>
              <button class="page-btn-icon" :disabled="currentPage === totalPages" @click="currentPage++">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload/Create Modal -->
    <div v-if="showUploadModal" class="modal-overlay" @click.self="closeUploadModal">
      <div class="dark-modal">
        <div class="modal-header">
          <h2>Tạo Album Mới</h2>
          <button class="close-btn" @click="closeUploadModal">&times;</button>
        </div>

        <div class="modal-body">
          <div v-if="uploadError" class="artist-panel error" style="margin-bottom: 20px;">
            {{ uploadError }}
          </div>

          <form @submit.prevent="submitUpload" class="upload-form">
            <div class="form-section">
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>Tên album <span class="text-warning">*</span></label>
                  <input v-model="uploadForm.title" type="text" class="input-dark" required placeholder="Nhập tên album" />
                </div>

                <div class="form-group full-width">
                  <label>Ảnh bìa (Cover) <span class="text-warning">*</span></label>
                  <input type="file" @change="onCoverChange" accept="image/*" required />
                  <span class="file-info" v-if="uploadForm.coverFile">{{ uploadForm.coverFile.name }}</span>
                </div>

                <div class="form-group full-width">
                  <label>Ngày phát hành dự kiến</label>
                  <input v-model="uploadForm.releaseDate" type="date" class="input-dark" />
                </div>

                <div class="form-group full-width">
                  <label>Mô tả / Ghi chú</label>
                  <textarea v-model="uploadForm.description" class="input-dark textarea-dark" placeholder="Mô tả về album..."></textarea>
                </div>
              </div>
            </div>

            <div class="form-section" style="margin-top: 20px;">
              <h3 style="font-size: 15px; margin-bottom: 12px;">2. Chọn bài hát cho album <span class="text-warning">*</span></h3>
              <p class="muted" style="margin-bottom: 16px; font-size: 13px;">Chỉ hiển thị các bài hát đã được duyệt và chưa thuộc album nào.</p>

              <div v-if="songOptions.length === 0" class="empty-state" style="padding: 30px; border: 1px dashed rgba(255,255,255,0.1); background: transparent;">
                <p>Chưa có bài hát nào có thể thêm vào album. Vui lòng upload và chờ Admin duyệt bài hát trước.</p>
              </div>

              <div v-else>
                <div class="search-box" style="margin-bottom: 12px; width: 100%;">
                  <input v-model="songSearchQuery" type="text" placeholder="Tìm bài hát..." class="input-dark" style="width: 100%;" />
                </div>

                <div class="song-picker-list" style="max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                  <div v-for="song in filteredSongOptions" :key="song.id" class="song-picker-item" style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <input type="checkbox" :id="'song-' + song.id" :value="song.id" v-model="selectedSongs" class="custom-checkbox" />
                    <label :for="'song-' + song.id" style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1; margin: 0;">
                      <img :src="normalizeImageUrl(song.coverUrl) || fallbackCover" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" alt="" />
                      <div style="flex: 1;">
                        <div style="font-weight: 500; font-size: 14px;">{{ song.title }}</div>
                        <div class="muted" style="font-size: 12px;">{{ formatDuration(song.duration) }} • {{ song.playCount || 0 }} lượt nghe</div>
                      </div>
                    </label>
                  </div>
                  <div v-if="filteredSongOptions.length === 0" style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">
                    Không tìm thấy bài hát phù hợp.
                  </div>
                </div>

                <div style="margin-top: 12px; font-size: 13px; color: #1ed760;" v-if="selectedSongs.length > 0">
                  Đã chọn {{ selectedSongs.length }} bài hát.
                </div>
                <div style="margin-top: 12px; font-size: 13px; color: #f59e0b;" v-else>
                  Vui lòng chọn ít nhất 1 bài hát cho album trước khi gửi duyệt.
                </div>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" @click="closeUploadModal" :disabled="uploading">Hủy</button>
          <button type="button" class="btn-primary" @click="submitUpload" :disabled="uploading || !uploadForm.title || !uploadForm.coverFile || selectedSongs.length === 0">
            <span v-if="uploading">Đang tải lên...</span>
            <span v-else>Gửi duyệt</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal && selectedAlbum" class="modal-overlay" @click.self="closeDetailModal">
      <div class="dark-modal">
        <div class="modal-header">
          <h2>Chi tiết Album</h2>
          <button class="close-btn" @click="closeDetailModal">&times;</button>
        </div>

        <div class="modal-body">
          <div class="detail-hero">
            <img :src="normalizeImageUrl(selectedAlbum.coverUrl) || fallbackCover" class="detail-cover" alt="Cover" />
            <div class="detail-titles">
              <h3>{{ selectedAlbum.name }}</h3>
              <p>Trạng thái: <span :class="getReviewStatusClass(selectedAlbum.reviewStatus)">{{ formatReviewStatus(selectedAlbum.reviewStatus) }}</span></p>
            </div>
          </div>

          <div v-if="selectedAlbum.reviewStatus === 'rejected' && selectedAlbum.rejectionReason" class="artist-panel error" style="margin-bottom: 20px;">
            <strong>Lý do từ chối:</strong> {{ selectedAlbum.rejectionReason }}
          </div>
          <div v-if="selectedAlbum.reviewStatus === 'rejected'" class="artist-panel error" style="margin-bottom: 20px; background-color: var(--mf-bg-surface);">
            <strong>Số lần gửi lại:</strong> <span :class="{'text-warning': selectedAlbum.resubmissionCount >= 3}">{{ selectedAlbum.resubmissionCount || 0 }}/3</span>
          </div>
          <div v-if="selectedAlbum.reviewStatus === 'rejected' && (!selectedAlbum.canResubmit || selectedAlbum.resubmissionCount >= 3)" class="alert alert-danger" style="margin-bottom: 20px;">
            Nội dung này không thể gửi lại. Vui lòng liên hệ quản trị viên.
            <div v-if="selectedAlbum.resubmitLockedReason" style="margin-top: 4px;"><strong>Lý do khóa:</strong> {{ selectedAlbum.resubmitLockedReason }}</div>
          </div>

          <div class="detail-info-grid">
            <div class="info-item">
              <label>Metadata Score:</label>
              <span style="color: #1ed760; font-weight: 700;">{{ selectedAlbum.metadataScore || 0 }}/100</span>
            </div>
            <div class="info-item">
              <label>Risk Score:</label>
              <span :style="{ color: (selectedAlbum.riskScore > 30 ? '#ff4757' : (selectedAlbum.riskScore > 0 ? '#f59e0b' : '#1ed760')), fontWeight: '700' }">
                {{ selectedAlbum.riskScore > 0 ? '+' + selectedAlbum.riskScore : '0 (An toàn)' }}
              </span>
            </div>
            <div class="info-item full-width" v-if="selectedAlbum.moderationFlags && selectedAlbum.moderationFlags.length">
              <label>Cảnh báo kiểm duyệt:</label>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
                <span v-for="flag in selectedAlbum.moderationFlags" :key="flag" style="padding: 2px 8px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 11px; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.3);">
                  {{ formatFlagText(flag) }}
                </span>
              </div>
            </div>
            <div class="info-item">
              <label>Ngày phát hành:</label>
              <span>{{ formatDate(selectedAlbum.releaseDate) || '-' }}</span>
            </div>
            <div class="info-item">
              <label>Ngày gửi duyệt:</label>
              <span>{{ formatDate(selectedAlbum.submittedAt) || '-' }}</span>
            </div>
            <div class="info-item full-width" v-if="selectedAlbum.description">
              <label>Mô tả:</label>
              <span>{{ selectedAlbum.description }}</span>
            </div>
          </div>

          <h3 style="margin-top: 24px; font-size: 14px;">Danh sách bài hát ({{ selectedAlbum.songs?.length || 0 }})</h3>
          <div style="max-height: 200px; overflow-y: auto; margin-top: 12px; background: rgba(0,0,0,0.1); border-radius: 8px;">
            <table class="song-table">
              <tbody>
                <tr v-if="!selectedAlbum.songs || selectedAlbum.songs.length === 0">
                  <td class="text-center muted" style="padding: 20px;">Chưa có bài hát nào trong album này.</td>
                </tr>
                <tr v-for="song in selectedAlbum.songs" :key="song.id">
                  <td>{{ song.title }}</td>
                  <td class="text-center">
                    <span class="status-badge" :class="getReviewStatusClass(song.review_status)">{{ formatReviewStatus(song.review_status) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 12px;">
          <button @click="closeDetailModal" class="btn-secondary">Đóng</button>
          <button v-if="selectedAlbum && selectedAlbum.reviewStatus === 'rejected'" @click="openResubmitModal(selectedAlbum)" class="btn-primary">Chỉnh sửa và gửi lại</button>
        </div>
      </div>
    </div>

    <!-- Resubmit Modal -->
    <div v-if="showResubmitModal" class="modal-overlay" @click.self="closeResubmitModal">
      <div class="modal-content dark-modal" style="width: 100%; max-width: 800px; height: 90vh;">
        <div class="modal-header">
          <h2>Chỉnh sửa album bị từ chối</h2>
          <button type="button" class="close-btn" @click="closeResubmitModal">&times;</button>
        </div>
        <div class="modal-body" style="flex: 1; overflow-y: auto;">
          <div v-if="resubmitForm.rejectionReason" class="alert alert-danger mb-4">
            <strong>Lý do từ chối:</strong> {{ resubmitForm.rejectionReason }}
          </div>
          <form @submit.prevent="submitResubmit" class="upload-form">
            <div class="form-section">
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>Tên album <span class="text-warning">*</span></label>
                  <input v-model.trim="resubmitForm.title" type="text" class="input-dark" required placeholder="Nhập tên album" />
                </div>

                <div class="form-group full-width">
                  <label>Ảnh bìa (Cover) <span class="text-warning">*</span></label>
                  <div v-if="resubmitForm.coverUrl && !resubmitForm.coverFile" style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <img :src="normalizeImageUrl(resubmitForm.coverUrl) || fallbackCover" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;" alt="Cover" />
                    <div>
                      <div style="font-size: 14px; font-weight: 500; color: #fff;">Ảnh bìa hiện tại</div>
                      <div style="font-size: 12px; color: var(--text-muted);">Giữ nguyên ảnh bìa cũ nếu không chọn tệp mới</div>
                    </div>
                  </div>
                  <input type="file" @change="onResubmitCoverChange" accept="image/*" />
                  <span class="file-info" v-if="resubmitForm.coverFile">{{ resubmitForm.coverFile.name }}</span>
                </div>

                <div class="form-group full-width">
                  <label>Ngày phát hành dự kiến</label>
                  <input v-model="resubmitForm.releaseDate" type="date" class="input-dark" />
                </div>

                <div class="form-group full-width">
                  <label>Mô tả / Ghi chú</label>
                  <textarea v-model="resubmitForm.description" class="input-dark textarea-dark" placeholder="Mô tả về album..."></textarea>
                </div>

                <div class="form-group full-width">
                  <label>Ghi chú gửi Admin duyệt <span class="text-warning">*</span></label>
                  <textarea v-model="resubmitForm.submissionNote" class="input-dark textarea-dark" placeholder="Giải trình về các chỉnh sửa và lý do gửi duyệt lại..." rows="3" required></textarea>
                </div>
              </div>
            </div>

            <div class="form-section" style="margin-top: 20px;">
              <h3 style="font-size: 15px; margin-bottom: 12px;">2. Chọn bài hát cho album <span class="text-warning">*</span></h3>
              <p class="muted" style="margin-bottom: 16px; font-size: 13px;">Chỉ hiển thị các bài hát đã được duyệt và chưa thuộc album nào (hoặc đã thuộc album này).</p>

              <div v-if="songOptions.length === 0" class="empty-state" style="padding: 30px; border: 1px dashed rgba(255,255,255,0.1); background: transparent;">
                <p>Chưa có bài hát nào có thể thêm vào album. Vui lòng upload và chờ Admin duyệt bài hát trước.</p>
              </div>

              <div v-else>
                <div class="search-box" style="margin-bottom: 12px; width: 100%;">
                  <input v-model="songSearchQuery" type="text" placeholder="Tìm bài hát..." class="input-dark" style="width: 100%;" />
                </div>

                <div class="song-picker-list" style="max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                  <div v-for="song in filteredSongOptions" :key="song.id" class="song-picker-item" style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <input type="checkbox" :id="'resubmit-song-' + song.id" :value="song.id" v-model="resubmitSelectedSongs" class="custom-checkbox" />
                    <label :for="'resubmit-song-' + song.id" style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1; margin: 0;">
                      <img :src="normalizeImageUrl(song.coverUrl) || fallbackCover" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" alt="" />
                      <div style="flex: 1;">
                        <div style="font-weight: 500; font-size: 14px;">{{ song.title }}</div>
                        <div class="muted" style="font-size: 12px;">{{ formatDuration(song.duration) }} • {{ song.playCount || 0 }} lượt nghe</div>
                      </div>
                    </label>
                  </div>
                  <div v-if="filteredSongOptions.length === 0" style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">
                    Không tìm thấy bài hát phù hợp.
                  </div>
                </div>

                <div style="margin-top: 12px; font-size: 13px; color: #1ed760;" v-if="resubmitSelectedSongs.length > 0">
                  Đã chọn {{ resubmitSelectedSongs.length }} bài hát.
                </div>
                <div style="margin-top: 12px; font-size: 13px; color: #f59e0b;" v-else>
                  Vui lòng chọn ít nhất 1 bài hát cho album trước khi gửi duyệt.
                </div>
              </div>
            </div>

            <div v-if="resubmitError" class="alert alert-danger">{{ resubmitError }}</div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" @click="closeResubmitModal" :disabled="resubmitting">Hủy</button>
          <button type="button" class="btn-primary" @click="submitResubmit" :disabled="resubmitting || !resubmitForm.title || resubmitSelectedSongs.length === 0">
            <span v-if="resubmitting">Đang tải lên...</span>
            <span v-else>Gửi duyệt lại</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { artistStudioApi } from '@/api/artistStudio'
import { useToastStore } from '@/stores/toast'
import { normalizeImageUrl } from '@/utils/imageUrl'

const formatFlagText = (flag) => {
  const flagMap = {
    missing_cover: 'Thiếu ảnh bìa',
    missing_lyrics: 'Thiếu lời bài hát',
    new_artist: 'Nghệ sĩ mới',
    duplicate_title: 'Tên gần trùng',
    resubmitted_multiple_times: 'Gửi lại nhiều lần',
    incomplete_metadata: 'Thiếu metadata',
    unusual_duration: 'Thời lượng bất thường',
    few_album_songs: 'Album quá ít bài',
    unapproved_album_song: 'Chứa bài chưa duyệt',
    missing_description: 'Thiếu mô tả'
  }
  return flagMap[flag] || flag
}

const toast = useToastStore()
const fallbackCover = 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=100&q=80'

const albums = ref([])
const initialLoading = ref(true)
const loading = ref(false)
const errorMsg = ref('')

const searchQuery = ref('')
const statusFilter = ref('')

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10
const currentPageInput = ref(1)

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const filteredAlbums = computed(() => {
  let result = albums.value

  if (statusFilter.value === 'pending') {
    result = result.filter(a => a.reviewStatus === 'pending_review')
  } else if (statusFilter.value) {
    result = result.filter(a => a.reviewStatus === statusFilter.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(a => a.name.toLowerCase().includes(q))
  }

  return result
})

const totalPages = computed(() => Math.ceil(filteredAlbums.value.length / itemsPerPage) || 1)

const paginatedAlbums = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredAlbums.value.slice(start, start + itemsPerPage)
})

watch(filteredAlbums, () => {
  currentPage.value = 1
})

watch(currentPage, (val) => {
  currentPageInput.value = val
})

const goToPage = () => {
  let page = parseInt(currentPageInput.value)
  if (isNaN(page) || page < 1) page = 1
  if (page > totalPages.value) page = totalPages.value
  currentPage.value = page
  currentPageInput.value = page
}

const filterByStatus = (status) => {
  statusFilter.value = status
}

const fetchAlbums = async () => {
  try {
    loading.value = true
    const res = await artistStudioApi.getAlbums()
    if (res.data.success) {
      albums.value = res.data.albums || []
    } else {
      errorMsg.value = res.data.message || 'Lỗi tải danh sách album'
    }
  } catch (err) {
    errorMsg.value = 'Lỗi kết nối khi tải danh sách album'
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

const handleReviewStatusChanged = () => {
  fetchAlbums()
}

onMounted(() => {
  fetchAlbums()
  window.addEventListener('artist:review_status_changed', handleReviewStatusChanged)
})

onUnmounted(() => {
  window.removeEventListener('artist:review_status_changed', handleReviewStatusChanged)
})


const onImageError = (e) => {
  e.target.src = fallbackCover
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('vi-VN')
}

const formatReviewStatus = (status) => {
  switch (status) {
    case 'approved': return 'Đã duyệt'
    case 'pending_review': return 'Chờ duyệt'
    case 'rejected': return 'Từ chối'
    default: return status
  }
}

const getReviewStatusClass = (status) => {
  switch (status) {
    case 'approved': return 'approved'
    case 'pending_review': return 'pending'
    case 'rejected': return 'rejected'
    default: return ''
  }
}

// Upload Modal
const showUploadModal = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const uploadForm = ref({
  title: '',
  description: '',
  releaseDate: '',
  coverFile: null
})

const songOptions = ref([])
const selectedSongs = ref([])
const songSearchQuery = ref('')

const filteredSongOptions = computed(() => {
  if (!songSearchQuery.value) return songOptions.value
  const q = songSearchQuery.value.toLowerCase()
  return songOptions.value.filter(s => s.title.toLowerCase().includes(q))
})

const fetchAlbumSongOptions = async (albumId = null) => {
  try {
    const res = await artistStudioApi.getAlbumSongOptions(albumId ? { albumId } : {})
    if (res.data.success) {
      songOptions.value = res.data.songs || []
    }
  } catch (err) {
    console.error('Error fetching song options:', err)
  }
}

const openUploadModal = async () => {
  uploadForm.value = { title: '', description: '', releaseDate: '', coverFile: null }
  uploadError.value = ''
  selectedSongs.value = []
  songSearchQuery.value = ''
  songOptions.value = []
  showUploadModal.value = true

  // Fetch available songs
  await fetchAlbumSongOptions()
}

const closeUploadModal = () => {
  if (uploading.value) return
  showUploadModal.value = false
}

const onCoverChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    uploadForm.value.coverFile = file
  }
}

const submitUpload = async () => {
  if (!uploadForm.value.title.trim() || !uploadForm.value.coverFile) {
    uploadError.value = 'Vui lòng nhập tên album và chọn ảnh bìa'
    return
  }
  if (selectedSongs.value.length === 0) {
    uploadError.value = 'Vui lòng chọn ít nhất 1 bài hát cho album'
    return
  }

  uploadError.value = ''
  uploading.value = true

  try {
    const formData = new FormData()
    formData.append('title', uploadForm.value.title.trim())
    if (uploadForm.value.description.trim()) formData.append('description', uploadForm.value.description.trim())
    if (uploadForm.value.releaseDate) formData.append('releaseDate', uploadForm.value.releaseDate)
    formData.append('cover', uploadForm.value.coverFile)
    formData.append('songIds', JSON.stringify(selectedSongs.value))

    const res = await artistStudioApi.createAlbum(formData)
    if (res.data.success) {
      toast.showToast('Album đã được tạo và gửi duyệt.', 'success')
      uploading.value = false
      closeUploadModal()
      fetchAlbums()
    } else {
      uploadError.value = res.data.message || 'Lỗi khi tạo album'
    }
  } catch (err) {
    console.error(err)
    uploadError.value = err.response?.data?.message || 'Có lỗi xảy ra khi tạo album. Vui lòng thử lại.'
  } finally {
    uploading.value = false
  }
}

// Resubmit Logic
const showResubmitModal = ref(false)
const resubmitting = ref(false)
const resubmitError = ref('')
const resubmitForm = ref({
  id: null,
  title: '',
  coverUrl: '',
  description: '',
  releaseDate: '',
  submissionNote: '',
  rejectionReason: '',
  coverFile: null
})
const resubmitSelectedSongs = ref([])

const openResubmitModal = async (album) => {
  let targetAlbum = { ...album }
  try {
    const res = await artistStudioApi.getAlbumDetail(album.id)
    if (res.data.success && res.data.album) {
      targetAlbum = res.data.album
    }
  } catch (err) {
    console.error('Error fetching album detail for resubmit:', err)
  }

  resubmitForm.value = {
    id: targetAlbum.id,
    title: targetAlbum.name || targetAlbum.title || '',
    coverUrl: targetAlbum.coverUrl || targetAlbum.cover_url || '',
    description: targetAlbum.description || '',
    releaseDate: targetAlbum.releaseDate ? targetAlbum.releaseDate.split('T')[0] : (targetAlbum.release_date ? targetAlbum.release_date.split('T')[0] : ''),
    submissionNote: targetAlbum.submissionNote || targetAlbum.submission_note || '',
    rejectionReason: targetAlbum.rejectionReason || targetAlbum.rejection_reason || '',
    coverFile: null
  }
  resubmitSelectedSongs.value = []
  // Select songs that were in the album
  if (targetAlbum.songs && Array.isArray(targetAlbum.songs)) {
    resubmitSelectedSongs.value = targetAlbum.songs.map(s => s.id)
  }
  resubmitError.value = ''

  // Ensure we have latest song options including songs currently assigned to this album
  await fetchAlbumSongOptions(targetAlbum.id)

  showResubmitModal.value = true
}

const closeResubmitModal = () => {
  showResubmitModal.value = false
}

const onResubmitCoverChange = (e) => {
  resubmitForm.value.coverFile = e.target.files[0] || null
}

const submitResubmit = async () => {
  if (!resubmitForm.value.title.trim()) {
    resubmitError.value = 'Vui lòng nhập tên album.'
    return
  }
  if (resubmitSelectedSongs.value.length === 0) {
    resubmitError.value = 'Vui lòng chọn ít nhất 1 bài hát.'
    return
  }

  resubmitError.value = ''
  resubmitting.value = true

  try {
    const formData = new FormData()
    formData.append('title', resubmitForm.value.title.trim())
    if (resubmitForm.value.description) formData.append('description', resubmitForm.value.description)
    if (resubmitForm.value.releaseDate) formData.append('releaseDate', resubmitForm.value.releaseDate)
    if (resubmitForm.value.submissionNote) formData.append('submissionNote', resubmitForm.value.submissionNote)
    formData.append('songIds', JSON.stringify(resubmitSelectedSongs.value))

    if (resubmitForm.value.coverFile) {
      formData.append('cover', resubmitForm.value.coverFile)
    }

    const res = await artistStudioApi.resubmitAlbum(resubmitForm.value.id, formData)
    if (res.data.success) {
      toast.showToast('Album đã được gửi lại Admin duyệt.', 'success')
      closeResubmitModal()
      if (showDetailModal.value) closeDetailModal()
      fetchAlbums()
    } else {
      resubmitError.value = res.data.message || 'Lỗi khi gửi lại'
    }
  } catch (err) {
    console.error(err)
    resubmitError.value = err.response?.data?.message || 'Có lỗi xảy ra khi gửi lại.'
  } finally {
    resubmitting.value = false
  }
}


// Detail Modal
const showDetailModal = ref(false)
const selectedAlbum = ref(null)

const openDetailModal = async (id) => {
  try {
    const res = await artistStudioApi.getAlbumDetail(id)
    if (res.data.success) {
      selectedAlbum.value = res.data.album
      showDetailModal.value = true
    } else {
      toast.showToast(res.data.message || 'Không tìm thấy chi tiết album', 'error')
    }
  } catch (err) {
    toast.showToast('Lỗi khi tải chi tiết album', 'error')
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedAlbum.value = null
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
  border-radius: var(--radius-sm);
  outline: none;
  font-family: inherit;
  font-size: 13px;
  height: 36px;
  line-height: 34px;
  box-sizing: border-box;
}

.input-dark {
  padding: 0 32px 0 12px;
  width: 100%;
}

.select-dark {
  padding: 0 32px 0 12px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a0a0b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}

.input-dark:focus, .select-dark:focus {
  border-color: var(--accent);
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
  line-height: 1;
}

.clear-search-btn:hover {
  color: var(--text-primary);
}

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
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
  height: 36px;
  display: inline-flex;
  align-items: center;
}

.song-table-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  height: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.2s;
}

.table-scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
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

.song-table th {
  color: #fff;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: #141528;
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

.text-right { text-align: right !important; }
.text-center { text-align: center !important; }
.muted { color: var(--text-muted); }
.text-warning { color: var(--warning); }

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}
.status-badge.approved, .status-badge.complete {
  background: rgba(46, 213, 115, 0.12);
  color: #2ed573;
  border: 1px solid rgba(46, 213, 115, 0.25);
  box-shadow: 0 0 12px rgba(46, 213, 115, 0.1);
}
.status-badge.pending, .status-badge.missing_genre {
  background: rgba(255, 165, 2, 0.12);
  color: #ffa502;
  border: 1px solid rgba(255, 165, 2, 0.25);
  box-shadow: 0 0 12px rgba(255, 165, 2, 0.1);
}
.status-badge.rejected, .status-badge.missing_audio {
  background: rgba(255, 71, 87, 0.15);
  color: #ff4757;
  border: 1px solid rgba(255, 71, 87, 0.3);
  box-shadow: 0 0 12px rgba(255, 71, 87, 0.15);
}

.btn-icon {
  background: rgba(255,255,255,0.05);
  border: none;
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-icon:hover { background: rgba(255,255,255,0.1); }
.btn-secondary { background: rgba(255,255,255,0.1); color: var(--text-primary); border: none; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; cursor: pointer;}

.empty-state {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}
.empty-icon { font-size: 40px; display: block; margin-bottom: 16px; }

/* Pagination */
.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #141528;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.pagination-info { font-size: 13px; color: var(--text-muted); }
.pagination-controls { display: flex; align-items: center; gap: 8px; }
.page-btn-icon { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; }
.page-btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
.page-input-wrapper { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.page-input { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); width: 50px; height: 32px; text-align: center; border-radius: 6px; }

/* Modal */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
  backdrop-filter: blur(4px);
}
.dark-modal {
  background: #141528 !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  width: 100%; max-width: 680px; max-height: 90vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex; flex-direction: column; overflow: hidden; opacity: 1 !important;
}
.modal-header { padding: 20px 24px; background: #141528 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 18px; }
.close-btn { background: none; border: none; color: var(--text-muted); font-size: 24px; cursor: pointer; }
.modal-body { padding: 24px; overflow-y: auto; background: #141528 !important; }
.modal-footer { padding: 16px 24px; background: #141528 !important; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: flex-end; gap: 12px; }

.detail-hero { display: flex; gap: 20px; margin-bottom: 24px; }
.detail-cover { width: 100px; height: 100px; border-radius: 8px; object-fit: cover; }
.detail-titles h3 { margin: 8px 0 4px 0; font-size: 20px; }
.detail-titles p { margin: 0; font-size: 13px; }
.detail-info-grid { display: grid; gap: 16px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; }
.info-item { display: flex; justify-content: space-between; font-size: 14px; }
.info-item label { color: var(--text-muted); }
.full-width { grid-column: 1 / -1; }

.upload-form { display: flex; flex-direction: column; gap: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-size: 14px; font-weight: 500; }
.textarea-dark { width: 100%; min-height: 86px; padding: 10px 12px; resize: vertical; }
.form-group input[type="file"] { padding: 10px 12px; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.2); border-radius: 8px; cursor: pointer; }
</style>
