<template>
  <div class="upload-page">
    <div class="header-3d" @mousemove="onHeaderMove" @mouseleave="onHeaderLeave" ref="headerRef">
      <h1 class="title-3d">Admin Center</h1>
      <p>Upload new tracks to MusicFlow universe</p>
    </div>

    <form class="upload-box" @submit.prevent="submitUpload" @mousemove="onFormMove" @mouseleave="onFormLeave" ref="formRef">
      <div class="box-content">
        <div class="form-row">
          <div class="input-group">
            <label>Song Title</label>
            <input v-model="form.title" type="text" required placeholder="e.g. Blinding Lights" />
          </div>
          <div class="input-group">
            <label>Artist Name</label>
            <input v-model="form.artist_name" type="text" required placeholder="e.g. The Weeknd" />
          </div>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Album (Optional)</label>
            <input v-model="form.album_title" type="text" placeholder="e.g. After Hours" />
          </div>
          <div class="input-group">
            <label>Genre</label>
            <select v-model="form.genre_id" required>
              <option value="1">Lo-fi</option>
              <option value="2">Ballad</option>
              <option value="3">EDM</option>
              <option value="4">Pop</option>
              <option value="5">R&B</option>
              <option value="6">Jazz</option>
              <option value="7">Rock</option>
              <option value="8">Hip-hop</option>
              <option value="9">Classical</option>
              <option value="10">V-pop</option>
              <option value="11">K-pop</option>
              <option value="12">Indie</option>
            </select>
          </div>
        </div>

        <div class="file-drop-zone" :class="{ 'has-file': audioFile }" @click="$refs.audioInput.click()">
          <input type="file" ref="audioInput" accept="audio/*" @change="handleAudio" hidden />
          <MfIcon v-if="!audioFile" name="upload_file" size="48" />
          <div v-else class="file-success">🎵 {{ audioFile.name }}</div>
          <span>{{ audioFile ? 'Click to change audio' : 'Click to select Audio File (MP3/WAV)' }}</span>
        </div>

        <div class="file-drop-zone image-zone" :class="{ 'has-file': coverFile }" @click="$refs.coverInput.click()">
          <input type="file" ref="coverInput" accept="image/*" @change="handleCover" hidden />
          <MfIcon v-if="!coverFile" name="image" size="48" />
          <div v-else class="file-success">🖼️ {{ coverFile.name }}</div>
          <span>{{ coverFile ? 'Click to change cover' : 'Optional: Select Cover Image (JPG/PNG)' }}</span>
        </div>

        <div v-if="status" :class="['status-message', isError ? 'error' : 'success']">
          {{ status }}
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Uploading...' : 'Launch Track 🚀' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import api from '@/api/axios'

const audioInput = ref(null)
const coverInput = ref(null)
const audioFile = ref(null)
const coverFile = ref(null)
const headerRef = ref(null)
const formRef = ref(null)

const loading = ref(false)
const status = ref('')
const isError = ref(false)

const form = reactive({
  title: '',
  artist_name: '',
  album_title: '',
  genre_id: '4'
})

function handleAudio(e) {
  if (e.target.files.length) audioFile.value = e.target.files[0]
}
function handleCover(e) {
  if (e.target.files.length) coverFile.value = e.target.files[0]
}

async function submitUpload() {
  if (!audioFile.value) {
    status.value = 'Please select an audio file!'
    isError.value = true
    return
  }
  
  loading.value = true
  status.value = ''
  
  const formData = new FormData()
  formData.append('title', form.title)
  formData.append('artist_name', form.artist_name)
  formData.append('album_title', form.album_title)
  formData.append('genre_id', form.genre_id)
  formData.append('audio', audioFile.value)
  if (coverFile.value) formData.append('cover', coverFile.value)

  try {
    const res = await api.post('/songs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    status.value = 'Upload successful! Track is live.'
    isError.value = false
    
    // Reset form
    form.title = ''; form.album_title = '';
    audioFile.value = null; coverFile.value = null;
  } catch (err) {
    status.value = err.response?.data?.message || 'Upload failed. Are you an Admin?'
    isError.value = true
  } finally {
    loading.value = false
  }
}

// 3D Tilt Logics
function onHeaderMove(e) { applyTilt(e, headerRef.value, 10) }
function onHeaderLeave() { resetTilt(headerRef.value) }
function onFormMove(e) { applyTilt(e, formRef.value, 5) }
function onFormLeave() { resetTilt(formRef.value) }

function applyTilt(e, el, maxDeg) {
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const rotateX = ((y - centerY) / centerY) * -maxDeg
  const rotateY = ((x - centerX) / centerX) * maxDeg
  el.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`
}

function resetTilt(el) {
  if (!el) return
  el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0)'
}
</script>

<style scoped>
.upload-page {
  padding: 60px 40px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: radial-gradient(circle at 50% 0%, rgba(162, 155, 254, 0.1), transparent 70%);
}

.header-3d {
  text-align: center;
  margin-bottom: 40px;
  transform-style: preserve-3d;
  transition: transform 0.1s ease-out;
}
.title-3d {
  font-size: 48px;
  font-weight: 900;
  color: #2d3436;
  margin: 0;
  transform: translateZ(30px);
  text-shadow: 0 10px 20px rgba(162, 155, 254, 0.2);
}
.header-3d p {
  color: #636e72;
  font-size: 18px;
  transform: translateZ(15px);
}

.upload-box {
  width: 100%;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(12px);
  transform-style: preserve-3d;
  transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
}
.upload-box:hover {
  box-shadow: 0 30px 60px rgba(162, 155, 254, 0.15);
}

.box-content {
  transform: translateZ(40px);
}

.form-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 13px;
  font-weight: 800;
  color: #a29bfe;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.input-group input, .input-group select {
  padding: 14px 16px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  font-weight: 600;
  color: #2d3436;
  outline: none;
  transition: all 0.2s;
  box-shadow: 0 5px 15px rgba(0,0,0,0.02);
}
.input-group input:focus, .input-group select:focus {
  border-color: #a29bfe;
  background: #fff;
  box-shadow: 0 5px 20px rgba(162, 155, 254, 0.2);
}

.file-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 30px;
  margin-bottom: 20px;
  border: 2px dashed rgba(162, 155, 254, 0.4);
  border-radius: 16px;
  background: rgba(162, 155, 254, 0.05);
  cursor: pointer;
  transition: all 0.2s;
  color: #a29bfe;
}
.file-drop-zone:hover {
  background: rgba(162, 155, 254, 0.1);
  border-color: #a29bfe;
  transform: translateY(-2px);
}
.file-drop-zone.has-file {
  border-style: solid;
  background: rgba(85, 239, 196, 0.1);
  border-color: #55efc4;
  color: #00b894;
}
.file-success {
  font-size: 18px;
  font-weight: 800;
}
.file-drop-zone span {
  font-size: 14px;
  font-weight: 600;
}

.submit-btn {
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  color: white;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(162, 155, 254, 0.3);
  transition: all 0.2s;
  transform: translateZ(20px);
}
.submit-btn:hover:not(:disabled) {
  transform: translateZ(20px) translateY(-2px);
  box-shadow: 0 15px 30px rgba(162, 155, 254, 0.4);
}
.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.status-message {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 600;
}
.status-message.success {
  background: rgba(85, 239, 196, 0.2);
  color: #00b894;
}
.status-message.error {
  background: rgba(255, 118, 117, 0.2);
  color: #d63031;
}
</style>
