<template>
  <section class="artist-page">
    <div v-if="loading" class="artist-panel">Đang tải hồ sơ...</div>
    <div v-else-if="errorMsg" class="artist-panel error">{{ errorMsg }}</div>

    <div v-else class="artist-page-content">
      <!-- Hero Section -->
      <div class="artist-hero">
        <div class="hero-bg" :style="{ backgroundImage: profile.coverUrl ? `url(${profile.coverUrl})` : '' }"></div>
        <div class="hero-content">
          <img :src="profile.avatarUrl || fallbackAvatar" @error="onImageError" class="artist-avatar" alt="">
          <div class="hero-info">
            <p class="eyebrow">Hồ sơ nghệ sĩ</p>
            <h1>{{ profile.name }}</h1>
            <div class="meta-row">
              <span class="email">{{ account.email }}</span>
              <span class="status" :class="account.status">{{ account.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="artist-cards-grid two-cols">
        <!-- Thông tin hồ sơ -->
        <div class="artist-card form-card">
          <h2 class="artist-card-title">Thông tin chung</h2>
          <form @submit.prevent="saveProfile" class="form">
            <div class="form-group">
              <label>Tên nghệ sĩ</label>
              <input type="text" :value="profile.name" disabled class="input-disabled" title="Tên nghệ sĩ do Admin quản lý" />
            </div>

            <div class="form-group">
              <label>Khu vực / Thị trường</label>
              <input type="text" :value="profile.market || 'Chưa cập nhật'" disabled class="input-disabled" />
            </div>

            <div class="form-group">
              <label>Tiểu sử nghệ sĩ</label>
              <textarea v-model="form.bio" rows="6" placeholder="Giới thiệu về nghệ sĩ..."></textarea>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}
              </button>
              <span v-if="saveSuccess" class="success-text">Đã lưu!</span>
            </div>
          </form>
        </div>

        <!-- Ảnh hiển thị -->
        <div class="artist-card images-card">
          <h2 class="artist-card-title">Ảnh hiển thị</h2>

          <div class="image-upload-group">
            <div class="image-preview">
              <img :src="avatarPreview || profile.avatarUrl || fallbackAvatar" @error="onImageError" class="preview-avatar" />
            </div>
            <div class="upload-controls">
              <h3>Ảnh đại diện</h3>
              <p>Khuyến nghị kích thước 500x500px, dung lượng dưới 5MB. Định dạng JPG, PNG.</p>
              <label class="upload-btn" :class="{ disabled: uploadingAvatar }">
                {{ uploadingAvatar ? 'Đang tải lên...' : 'Chọn ảnh mới' }}
                <input type="file" accept="image/*" @change="onAvatarSelected" hidden :disabled="uploadingAvatar" />
              </label>
            </div>
          </div>

          <hr class="divider" />

          <div class="image-upload-group">
            <div class="image-preview cover">
              <div class="preview-cover" :style="{ backgroundImage: `url(${profile.coverUrl || fallbackCover})` }"></div>
            </div>
            <div class="upload-controls">
              <h3>Ảnh bìa</h3>
              <p>Tính năng cập nhật ảnh bìa sẽ ra mắt trong giai đoạn sau.</p>
              <button type="button" class="upload-btn disabled" disabled>Giai đoạn sau</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { artistAccountApi } from '@/api/artistAccount'

const fallbackAvatar = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80'
const fallbackCover = 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f401?w=800&q=80'

const loading = ref(true)
const errorMsg = ref('')
const profile = ref({})
const account = ref({})

const form = ref({
  bio: ''
})

const saving = ref(false)
const saveSuccess = ref(false)

const avatarPreview = ref(null)
const avatarFile = ref(null)
const uploadingAvatar = ref(false)

function onImageError(event) {
  event.target.src = fallbackAvatar
}

async function loadProfile() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await artistAccountApi.getArtistProfile()
    profile.value = res.data?.profile || {}
    account.value = res.data?.account || {}
    form.value.bio = profile.value.bio || ''
  } catch (err) {
    errorMsg.value = 'Không thể tải hồ sơ nghệ sĩ. Vui lòng thử lại.'
    console.error('Error loadProfile:', err)
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  saving.value = true
  saveSuccess.value = false
  try {
    const res = await artistAccountApi.updateArtistProfile({ bio: form.value.bio })
    profile.value = res.data?.profile || profile.value
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    alert('Lỗi lưu hồ sơ: ' + (err.response?.data?.message || err.message))
  } finally {
    saving.value = false
  }
}

async function onAvatarSelected(e) {
  const file = e.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Vui lòng chọn file hình ảnh hợp lệ.')
    return
  }

  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)

  // Tự động upload ngay sau khi chọn
  uploadingAvatar.value = true
  const formData = new FormData()
  formData.append('avatar', file)

  try {
    const res = await artistAccountApi.uploadArtistAvatar(formData)
    profile.value.avatarUrl = res.data.avatarUrl
    alert('Đã cập nhật ảnh đại diện thành công.')
  } catch (err) {
    alert('Lỗi tải lên ảnh: ' + (err.response?.data?.message || err.message))
    avatarPreview.value = null // reset
  } finally {
    uploadingAvatar.value = false
    e.target.value = ''
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.hero-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.4;
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 1;
}

.artist-avatar {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  background: #1e293b;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
}

h1 {
  margin: 0;
  font-size: 48px;
  font-weight: 900;
  color: var(--text-primary);
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.email {
  color: var(--text-secondary);
  font-size: 14px;
}

.status {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 12px;
  background: rgba(46, 213, 115, 0.15);
  color: var(--success);
  font-weight: 700;
  font-size: 12px;
  border: 1px solid rgba(46, 213, 115, 0.3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input,
.form-group textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.input-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.btn-primary {
  background: var(--accent);
  color: #0f0f1a;
  border: none;
  border-radius: var(--radius-sm);
  padding: 12px 28px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #00e6b8;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.success-text {
  color: var(--success);
  font-weight: 500;
  font-size: 14px;
}

.image-upload-group {
  display: flex;
  gap: 24px;
  align-items: center;
}

.image-preview {
  flex-shrink: 0;
}

.preview-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  background: #1e293b;
}

.preview-cover {
  width: 160px;
  height: 90px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-color: #1e293b;
}

.upload-controls {
  flex: 1;
}

.upload-controls h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.upload-controls p {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover:not(.disabled) {
  border-color: rgba(255,255,255,0.1);
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.upload-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.divider {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 24px 0;
}
</style>
