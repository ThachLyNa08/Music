<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-glass">
      <h2>Danh sách phát mới</h2>
      <form @submit.prevent="handleCreate">
        
        <div class="input-line">
          <input 
            v-model="form.name" 
            type="text" 
            required 
            placeholder="Tiêu đề" 
            class="line-input title-input" 
          />
        </div>
        
        <div class="input-line">
          <input 
            v-model="form.description" 
            type="text" 
            placeholder="Thông tin mô tả" 
            class="line-input desc-input" 
          />
        </div>

        <div class="privacy-section">
          <label>Quyền riêng tư</label>
          <div class="privacy-dropdown-container">
            <svg class="globe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <select v-model="form.is_public" class="privacy-select">
              <option :value="true">Công khai</option>
              <option :value="false">Riêng tư</option>
            </select>
          </div>
        </div>

        <div class="toggle-section">
          <label>Cộng tác</label>
          <label class="switch">
            <input type="checkbox" v-model="form.is_collaborative">
            <span class="slider round"></span>
          </label>
        </div>

        <div class="cover-section" @click="$refs.coverInput.click()">
          <input type="file" ref="coverInput" accept="image/*" @change="handleFile" hidden />
          <div class="cover-box" :class="{ 'has-file': form.coverFile }">
            <span v-if="!form.coverFile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="margin-right: 8px; vertical-align: middle;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Thêm ảnh bìa (Tùy chọn)
            </span>
            <span v-else class="file-selected">🖼️ {{ form.coverFile.name }}</span>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">Hủy</button>
          <button type="submit" class="btn-submit" :disabled="creating">
            {{ creating ? 'Đang tạo...' : 'Tạo' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
  creating: Boolean
})

const emit = defineEmits(['close', 'create'])

const coverInput = ref(null)

const form = reactive({
  name: '',
  description: '',
  is_public: true,
  is_collaborative: false,
  coverFile: null
})

function handleFile(e) {
  if (e.target.files && e.target.files.length > 0) {
    form.coverFile = e.target.files[0]
  }
}

function handleCreate() {
  if (!form.name) return
  emit('create', form)
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.modal-glass {
  background:
    linear-gradient(135deg, rgba(76,29,149,0.18), rgba(15,23,42,0.96));
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(20px);
  padding: 32px;
  border-radius: 8px;
  width: 100%; max-width: 450px;
  color: #ffffff;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.modal-glass h2 { 
  margin: 0 0 40px; 
  font-weight: 700; 
  font-size: 22px;
  color: #ffffff; 
}

/* Line Inputs */
.input-line {
  margin-bottom: 32px;
}

.line-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 15px;
  padding: 8px 0;
  outline: none;
  transition: border-color 0.2s;
}
.line-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}
.line-input.title-input:focus {
  border-bottom: 1px solid #3B82F6;
}
.line-input.desc-input:focus {
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}

/* Privacy Dropdown */
.privacy-section {
  margin-bottom: 24px;
}
.privacy-section label {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}
.privacy-dropdown-container {
  display: inline-flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
  position: relative;
}
.globe-icon {
  color: #ffffff;
  margin-right: 8px;
}
.privacy-select {
  background: transparent;
  color: #ffffff;
  border: none;
  font-size: 15px;
  font-weight: 600;
  outline: none;
  appearance: none;
  padding-right: 20px;
  cursor: pointer;
}
.privacy-select option {
  background: #020617;
  color: #ffffff;
}
.privacy-dropdown-container::after {
  content: "⌄";
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-70%);
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}

/* Toggle switch */
.toggle-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
.toggle-section label:first-child {
  font-size: 15px;
  color: #ffffff;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}
.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #555;
  transition: .4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}
input:checked + .slider {
  background-color: #ffffff;
}
input:checked + .slider:before {
  transform: translateX(20px);
  background-color: #020617;
}
.slider.round {
  border-radius: 24px;
}
.slider.round:before {
  border-radius: 50%;
}

/* Cover Image */
.cover-section {
  margin-bottom: 32px;
}
.cover-box {
  padding: 16px; 
  border: 1px dashed rgba(255, 255, 255, 0.3); 
  border-radius: 8px;
  text-align: center; 
  cursor: pointer; 
  color: rgba(255, 255, 255, 0.6); 
  font-weight: 500;
  font-size: 14px;
  transition: all 0.2s;
}
.cover-box:hover {
  border-color: rgba(255, 255, 255, 0.6);
  color: #ffffff;
}
.cover-box.has-file {
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}
.file-selected { color: #ffffff; }

/* Actions */
.modal-actions { 
  display: flex; 
  justify-content: flex-end;
  gap: 16px; 
}
.modal-actions button {
  padding: 10px 24px; 
  border-radius: 24px; 
  font-weight: 700; 
  font-size: 15px;
  border: none; 
  cursor: pointer; 
  transition: all 0.2s;
}
.btn-cancel { 
  background: transparent; 
  color: #ffffff; 
}
.btn-cancel:hover { 
  opacity: 0.8; 
}
.btn-submit { 
  background: #ffffff; 
  color: #000000; 
}
.btn-submit:hover:not(:disabled) { 
  transform: scale(1.05); 
}
.btn-submit:disabled { 
  opacity: 0.5; 
  cursor: not-allowed; 
}
</style>
