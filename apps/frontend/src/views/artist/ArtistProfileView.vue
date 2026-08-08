<template>
  <section class="artist-page">
    <div v-if="loading" class="artist-panel">Đang tải hồ sơ...</div>
    <div v-else-if="errorMsg" class="artist-panel error">{{ errorMsg }}</div>

    <div v-else class="artist-page-content">
      <div class="artist-hero">
        <div class="hero-bg" :style="{ backgroundImage: `url(${profile.coverUrl || fallbackCover})` }"></div>
        <div class="hero-content">
          <img :src="profile.avatarUrl || fallbackAvatar" @error="onImageError" class="artist-avatar" alt="">
          <div class="hero-info">
            <p class="eyebrow">Hồ sơ nghệ sĩ</p>
            <h1>{{ profile.name || 'Nghệ sĩ' }}</h1>
            <p v-if="profile.tagline" class="hero-tagline">{{ profile.tagline }}</p>
            <div class="meta-row">
              <span v-if="account.email" class="email">{{ account.email }}</span>
              <span v-for="item in profileMeta" :key="item" class="email">{{ item }}</span>
              <span class="status" :class="account.status">{{ account.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa' }}</span>
            </div>
          </div>
        </div>
      </div>

      <form class="artist-cards-grid two-cols profile-grid" @submit.prevent="saveProfile">
        <div class="profile-column">
          <div class="artist-card form-card">
            <h2 class="artist-card-title">Thông tin cơ bản</h2>

            <div class="form-grid">
              <div class="form-group wide">
                <label for="artist-name">Tên nghệ sĩ</label>
                <input id="artist-name" v-model.trim="form.name" maxlength="100" :class="{ invalid: errors.name }" />
                <small v-if="errors.name" class="error-text">{{ errors.name }}</small>
              </div>

              <div class="form-group">
                <label for="artist-market">Khu vực / Thị trường</label>
                <select id="artist-market" v-model="form.market" :class="{ invalid: errors.market }">
                  <option value="">Chưa cập nhật</option>
                  <option v-for="market in markets" :key="market" :value="market">{{ market }}</option>
                </select>
                <small v-if="errors.market" class="error-text">{{ errors.market }}</small>
              </div>

              <div class="form-group">
                <label for="primary-genre">Thể loại chính</label>
                <select id="primary-genre" v-model="form.primaryGenreId" :class="{ invalid: errors.primaryGenreId }">
                  <option value="">Chưa chọn</option>
                  <option v-for="genre in genres" :key="genre.id" :value="String(genre.id)">{{ genre.name }}</option>
                </select>
                <small v-if="errors.primaryGenreId" class="error-text">{{ errors.primaryGenreId }}</small>
              </div>

              <div class="form-group">
                <label for="debut-year">Năm ra mắt</label>
                <input id="debut-year" v-model.trim="form.debutYear" inputmode="numeric" placeholder="VD: 2016" :class="{ invalid: errors.debutYear }" />
                <small v-if="errors.debutYear" class="error-text">{{ errors.debutYear }}</small>
              </div>
            </div>
          </div>

          <div class="artist-card form-card">
            <h2 class="artist-card-title">Giới thiệu nghệ sĩ</h2>

            <div class="form-group">
              <label for="tagline">Câu giới thiệu ngắn</label>
              <input id="tagline" v-model.trim="form.tagline" maxlength="150" placeholder="VD: Nghệ sĩ với phong cách hiện đại và giàu năng lượng." :class="{ invalid: errors.tagline }" />
              <div class="field-footer">
                <small v-if="errors.tagline" class="error-text">{{ errors.tagline }}</small>
                <small>{{ form.tagline.length }}/150</small>
              </div>
            </div>

            <div class="form-group">
              <label for="artist-bio">Tiểu sử nghệ sĩ</label>
              <textarea id="artist-bio" v-model.trim="form.bio" rows="7" maxlength="1500" placeholder="Giới thiệu hành trình, phong cách âm nhạc và dấu ấn nổi bật..." :class="{ invalid: errors.bio }"></textarea>
              <div class="field-footer">
                <small v-if="errors.bio" class="error-text">{{ errors.bio }}</small>
                <small>{{ form.bio.length }}/1500</small>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-column">
          <div class="artist-card images-card">
            <h2 class="artist-card-title">Ảnh đại diện</h2>

            <div class="image-upload-group">
              <div class="image-preview">
                <img :src="avatarPreview || profile.avatarUrl || fallbackAvatar" @error="onImageError" class="preview-avatar" alt="">
              </div>
              <div class="upload-controls">
                <h3>Ảnh đại diện nghệ sĩ</h3>
                <p>Hỗ trợ JPG, PNG, WebP. Dung lượng tối đa 5MB. Ảnh sẽ cập nhật ngay sau khi chọn.</p>
                <label class="upload-btn" :class="{ disabled: uploadingAvatar }">
                  {{ uploadingAvatar ? 'Đang tải lên...' : 'Chọn ảnh mới' }}
                  <input type="file" accept="image/jpeg,image/png,image/webp" @change="onAvatarSelected" hidden :disabled="uploadingAvatar" />
                </label>
              </div>
            </div>
          </div>

          <div class="artist-card form-card">
            <h2 class="artist-card-title">Liên kết & liên hệ</h2>

            <div class="form-group">
              <label for="contact-email">Email liên hệ</label>
              <input id="contact-email" v-model.trim="form.contactEmail" type="email" placeholder="artist@musicflow.local" :class="{ invalid: errors.contactEmail }" />
              <small v-if="errors.contactEmail" class="error-text">{{ errors.contactEmail }}</small>
            </div>

            <div class="form-group" v-for="field in socialFields" :key="field.key">
              <label :for="field.key">{{ field.label }}</label>
              <input :id="field.key" v-model.trim="form[field.key]" type="url" :placeholder="field.placeholder" :class="{ invalid: errors[field.key] }" />
              <small v-if="errors[field.key]" class="error-text">{{ errors[field.key] }}</small>
            </div>
          </div>

          <div class="form-actions floating-actions">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Đang lưu...' : 'Lưu hồ sơ' }}
            </button>
            <span v-if="saveSuccess" class="success-text">Đã lưu thay đổi.</span>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { artistAccountApi } from '@/api/artistAccount'
import { genreApi } from '@/api/genre'

const fallbackAvatar = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80'
const fallbackCover = 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f401?w=800&q=80'
const currentYear = new Date().getFullYear()
const markets = ['VPOP', 'KPOP', 'USUK']

const socialFields = [
  { key: 'websiteUrl', label: 'Website', placeholder: 'https://example.com' },
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/artist' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/artist' },
  { key: 'youtubeUrl', label: 'YouTube', placeholder: 'https://youtube.com/@artist' },
  { key: 'tiktokUrl', label: 'TikTok', placeholder: 'https://tiktok.com/@artist' }
]

const loading = ref(true)
const errorMsg = ref('')
const profile = ref({})
const account = ref({})
const genres = ref([])
const errors = ref({})

const form = ref({
  name: '',
  market: '',
  primaryGenreId: '',
  debutYear: '',
  tagline: '',
  bio: '',
  contactEmail: '',
  websiteUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  tiktokUrl: ''
})

const saving = ref(false)
const saveSuccess = ref(false)
const avatarPreview = ref(null)
const uploadingAvatar = ref(false)

const profileMeta = computed(() => {
  const items = []
  if (profile.value.market) items.push(profile.value.market)
  if (profile.value.primaryGenreName) items.push(profile.value.primaryGenreName)
  if (profile.value.debutYear) items.push(`Hoạt động từ ${profile.value.debutYear}`)
  return items
})

function fillForm(nextProfile = {}) {
  form.value = {
    name: nextProfile.name || '',
    market: nextProfile.market || '',
    primaryGenreId: nextProfile.primaryGenreId ? String(nextProfile.primaryGenreId) : '',
    debutYear: nextProfile.debutYear ? String(nextProfile.debutYear) : '',
    tagline: nextProfile.tagline || '',
    bio: nextProfile.bio || '',
    contactEmail: nextProfile.contactEmail || '',
    websiteUrl: nextProfile.websiteUrl || '',
    facebookUrl: nextProfile.facebookUrl || '',
    instagramUrl: nextProfile.instagramUrl || '',
    youtubeUrl: nextProfile.youtubeUrl || '',
    tiktokUrl: nextProfile.tiktokUrl || ''
  }
}

function onImageError(event) {
  event.target.src = fallbackAvatar
}

function validateUrl(value) {
  if (!value) return true
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch (_err) {
    return false
  }
}

function validateForm() {
  const nextErrors = {}
  const nameLength = form.value.name.trim().length

  if (nameLength < 2 || nameLength > 100) nextErrors.name = 'Tên nghệ sĩ phải từ 2 đến 100 ký tự.'
  if (form.value.market && !markets.includes(form.value.market)) nextErrors.market = 'Thị trường không hợp lệ.'

  if (form.value.debutYear) {
    const year = Number(form.value.debutYear)
    if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
      nextErrors.debutYear = `Năm ra mắt phải từ 1900 đến ${currentYear}.`
    }
  }

  if (form.value.tagline.length > 150) nextErrors.tagline = 'Câu giới thiệu tối đa 150 ký tự.'
  if (form.value.bio.length > 1500) nextErrors.bio = 'Tiểu sử tối đa 1500 ký tự.'
  if (form.value.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.contactEmail)) {
    nextErrors.contactEmail = 'Email liên hệ không hợp lệ.'
  }

  socialFields.forEach(field => {
    if (!validateUrl(form.value[field.key])) {
      nextErrors[field.key] = 'URL phải bắt đầu bằng http:// hoặc https://.'
    }
  })

  errors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

async function loadGenres() {
  try {
    const res = await genreApi.getAll()
    genres.value = Array.isArray(res.data?.data) ? res.data.data : []
  } catch (err) {
    console.warn('Không thể tải danh sách thể loại:', err)
    genres.value = []
  }
}

async function loadProfile() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [profileRes] = await Promise.all([
      artistAccountApi.getArtistProfile(),
      loadGenres()
    ])
    profile.value = profileRes.data?.profile || {}
    account.value = profileRes.data?.account || {}
    fillForm(profile.value)
  } catch (err) {
    errorMsg.value = 'Không thể tải hồ sơ nghệ sĩ. Vui lòng thử lại.'
    console.error('Error loadProfile:', err)
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (!validateForm()) return

  saving.value = true
  saveSuccess.value = false
  try {
    const payload = {
      name: form.value.name.trim(),
      market: form.value.market || null,
      primary_genre_id: form.value.primaryGenreId || null,
      debut_year: form.value.debutYear || null,
      tagline: form.value.tagline || null,
      bio: form.value.bio || null,
      contact_email: form.value.contactEmail || null,
      website_url: form.value.websiteUrl || null,
      facebook_url: form.value.facebookUrl || null,
      instagram_url: form.value.instagramUrl || null,
      youtube_url: form.value.youtubeUrl || null,
      tiktok_url: form.value.tiktokUrl || null
    }
    const res = await artistAccountApi.updateArtistProfile(payload)
    profile.value = res.data?.profile || profile.value
    fillForm(profile.value)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    alert('Lỗi lưu hồ sơ: ' + (err.response?.data?.message || err.message))
  } finally {
    saving.value = false
  }
}

async function onAvatarSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    alert('Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.')
    event.target.value = ''
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Ảnh đại diện tối đa 5MB.')
    event.target.value = ''
    return
  }

  avatarPreview.value = URL.createObjectURL(file)
  uploadingAvatar.value = true

  const formData = new FormData()
  formData.append('avatar', file)

  try {
    const res = await artistAccountApi.uploadArtistAvatar(formData)
    profile.value.avatarUrl = res.data.avatarUrl
    avatarPreview.value = null
    alert('Đã cập nhật ảnh đại diện thành công.')
  } catch (err) {
    alert('Lỗi tải lên ảnh: ' + (err.response?.data?.message || err.message))
    avatarPreview.value = null
  } finally {
    uploadingAvatar.value = false
    event.target.value = ''
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(30px);
  opacity: 0.36;
  pointer-events: none;
  transform: scale(1.15);
  z-index: 0;
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 2;
}

.artist-avatar {
  width: 128px;
  height: 128px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  background: #1e293b;
}

.hero-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(34px, 5vw, 56px);
  font-weight: 900;
  line-height: 0.95;
}

.hero-tagline {
  max-width: 760px;
  margin: 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 16px;
  font-weight: 600;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-top: 2px;
}

.email {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.status {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 12px;
  background: rgba(46, 213, 115, 0.15);
  color: var(--success);
  font-weight: 800;
  font-size: 12px;
  border: 1px solid rgba(46, 213, 115, 0.3);
}

.profile-grid {
  align-items: start;
}

.profile-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

@media (min-width: 720px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-group.wide {
    grid-column: 1 / -1;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group textarea {
  resize: vertical;
  line-height: 1.6;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.12);
}

.form-group .invalid {
  border-color: var(--danger);
}

.field-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
}

.error-text {
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
}

.image-upload-group {
  display: flex;
  gap: 22px;
  align-items: center;
}

.image-preview {
  flex-shrink: 0;
}

.preview-avatar {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  object-fit: cover;
  background: #1e293b;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.32);
}

.upload-controls {
  flex: 1;
  min-width: 0;
}

.upload-controls h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--text-primary);
}

.upload-controls p {
  margin: 0 0 16px;
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
  border-radius: 999px;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover:not(.disabled) {
  border-color: rgba(255,255,255,0.16);
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.upload-btn.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.floating-actions {
  position: sticky;
  bottom: 20px;
  z-index: 5;
  justify-content: flex-end;
  padding: 0;
}

.btn-primary {
  background: var(--accent);
  color: #0f0f1a;
  border: none;
  border-radius: 999px;
  padding: 12px 28px;
  font-weight: 900;
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
  font-weight: 800;
  font-size: 14px;
}

@media (max-width: 760px) {
  .hero-content,
  .image-upload-group {
    align-items: flex-start;
    flex-direction: column;
  }

  .artist-avatar {
    width: 104px;
    height: 104px;
  }

  .floating-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .btn-primary {
    width: 100%;
  }
}
</style>
