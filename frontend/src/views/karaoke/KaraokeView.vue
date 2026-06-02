<template>
  <div class="karaoke-view user-page-bg">
    <div class="header-section">
      <h1 class="section-title">Karaoke AI</h1>
      <p class="section-subtitle">Tách lời bài hát thời gian thực bằng trí tuệ nhân tạo</p>
    </div>

    <div class="karaoke-grid">
      <!-- Left Panel: Stem Separator -->
      <div class="stem-panel">
        <div class="spotify-card stem-card user-panel-soft">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" class="icon-primary"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/></svg>
            <h2 class="card-title">AI Stem Separator</h2>
          </div>
          
          <div class="slider-group">
            <div class="slider-info">
              <span class="slider-label">Vocal (Giọng hát)</span>
              <span class="slider-value">{{ vocalVolume }}%</span>
            </div>
            <input type="range" min="0" max="100" v-model="vocalVolume" class="stem-slider vocal-slider" />
          </div>

          <div class="slider-group">
            <div class="slider-info">
              <span class="slider-label">Instrumental (Nhạc nền)</span>
              <span class="slider-value">{{ instVolume }}%</span>
            </div>
            <input type="range" min="0" max="100" v-model="instVolume" class="stem-slider inst-slider" />
          </div>

          <div class="info-box">
            <p>Hệ thống AI đang tách lời bài hát để mang lại trải nghiệm hát karaoke mượt mà nhất. Bạn có thể kéo thanh Vocal về 0% để lấy beat gốc.</p>
          </div>
          
          <button class="btn-download" @click="downloadBeat" :disabled="!isPremium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            Tải Beat Nhạc Nền
            <span v-if="!isPremium" class="badge-premium">Premium</span>
          </button>
        </div>

        <div class="spotify-card mic-card user-panel-soft">
          <div class="card-header space-between">
            <div class="flex-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="icon-pulse text-red-400"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
              <h3 class="card-title">Mic Input</h3>
            </div>
            <span class="mic-status">EXCELLENT</span>
          </div>
          <div class="visualizer">
            <div class="bar" style="height: 20%"></div>
            <div class="bar" style="height: 50%"></div>
            <div class="bar" style="height: 80%"></div>
            <div class="bar" style="height: 40%"></div>
            <div class="bar" style="height: 90%"></div>
            <div class="bar" style="height: 60%"></div>
            <div class="bar" style="height: 30%"></div>
            <div class="bar" style="height: 70%"></div>
            <div class="bar" style="height: 50%"></div>
            <div class="bar" style="height: 85%"></div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Lyrics -->
      <div class="lyrics-panel">
        <div class="spotify-card lyrics-card user-panel">
          <div class="lyrics-content">
            <p class="lyric-line past">Mùa xuân sang có hoa anh đào</p>
            <p class="lyric-line current">Màu hoa tôi trót yêu từ lâu</p>
            <p class="lyric-line future">Người đi xa có nhớ hoa anh đào</p>
            <p class="lyric-line future opacity-50">Để lòng tôi mãi vương sầu nhớ</p>
          </div>
          <div class="lyrics-controls">
            <div class="song-info">
              <div class="song-cover"></div>
              <div>
                <p class="song-title">Mùa Xuân Sang</p>
                <p class="song-artist">Đan Nguyên</p>
              </div>
            </div>
            <div class="player-actions">
              <button class="action-btn"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
              <button class="play-btn"><svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button>
              <button class="action-btn"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
            </div>
          </div>
        </div>

        <div class="suggestions-section">
          <h3 class="section-title text-xl mb-4">Gợi ý hát Karaoke</h3>
          <div class="suggestions-grid">
            <div class="spotify-card song-card user-card user-card-hover" v-for="i in 4" :key="i">
              <div class="card-image-wrap">
                <div class="card-image placeholder-bg"></div>
                <div class="play-overlay"><svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M8 5v14l11-7z"/></svg></div>
              </div>
              <h4 class="card-title mt-3">Bài Hát {{ i }}</h4>
              <p class="card-subtitle">Ca Sĩ {{ i }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isPremium = computed(() => auth.isPremium)

const vocalVolume = ref(20)
const instVolume = ref(85)

function downloadBeat() {
  if (!isPremium.value) {
    alert("Vui lòng nâng cấp Premium để sử dụng tính năng tải Beat!")
    return
  }
  // Implement download logic here
  alert("Đang tải beat nhạc nền...")
}
</script>

<style scoped>
.karaoke-view {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
  color: #ffffff;
  min-height: 100%;
}

.header-section {
  margin-bottom: 32px;
}
.section-title {
  font-size: 32px;
  font-weight: 900;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 8px;
}
.section-subtitle {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0;
  font-size: 15px;
}

.karaoke-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 24px;
}
@media (max-width: 1024px) {
  .karaoke-grid {
    grid-template-columns: 1fr;
  }
}

.stem-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.spotify-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.stem-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
}
.space-between {
  justify-content: space-between;
}
.flex-center {
  display: flex;
  align-items: center;
}

.icon-primary {
  color: #7C3AED;
}
.icon-pulse {
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.slider-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.slider-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
}
.slider-value {
  font-weight: 700;
  color: #7C3AED;
}
.slider-group:last-of-type .slider-value {
  color: #3B82F6;
}

.stem-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  outline: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.08);
}
.vocal-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #7C3AED;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.5);
}
.inst-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3B82F6;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
}

.info-box {
  background: rgba(255, 255, 255, 0.02);
  padding: 16px;
  border-radius: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  text-align: center;
  border: 1px dashed rgba(124, 58, 237, 0.3);
}

.btn-download {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  color: white;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);
}
.btn-download:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 25px rgba(124, 58, 237, 0.5);
}
.btn-download:disabled {
  opacity: 0.5;
  filter: grayscale(50%);
  cursor: not-allowed;
}
.badge-premium {
  background: #ec4899;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mic-card {
  padding: 24px;
}
.mic-status {
  font-size: 12px;
  font-weight: 800;
  color: #10B981;
}
.visualizer {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60px;
  margin-top: 16px;
}
.bar {
  flex: 1;
  background: linear-gradient(180deg, #10B981, #059669);
  border-radius: 4px;
  transition: height 0.1s ease;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
}

.lyrics-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lyrics-card {
  flex: 1;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.lyrics-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 24px;
  padding: 40px;
  z-index: 10;
}
.lyric-line {
  font-size: 28px;
  font-weight: 700;
  transition: all 0.3s;
}
.lyric-line.past {
  color: rgba(255, 255, 255, 0.3);
  font-size: 20px;
}
.lyric-line.current {
  background: linear-gradient(135deg, #7C3AED, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 38px;
  font-weight: 900;
  text-shadow: 0 0 25px rgba(124, 58, 237, 0.4);
}
.lyric-line.future {
  color: rgba(255, 255, 255, 0.65);
  font-size: 20px;
}

.lyrics-controls {
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(17, 24, 39, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
}
.song-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
.song-info .song-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
}
.song-info .song-artist {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
.song-cover {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  box-shadow: 0 8px 16px rgba(124, 58, 237, 0.25);
}
.player-actions {
  display: flex;
  align-items: center;
  gap: 24px;
}
.action-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.2s;
}
.action-btn:hover {
  color: #ffffff;
}
.play-btn {
  background: linear-gradient(135deg, #7C3AED, #6c5ce7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.4);
  transition: transform 0.2s;
}
.play-btn:hover {
  transform: scale(1.05);
}

.suggestions-section .section-title {
  font-size: 20px;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 16px;
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.song-card {
  cursor: pointer;
  padding: 12px;
}
.song-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(124, 58, 237, 0.3);
}
.song-card .card-title {
  margin: 12px 0 4px;
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
}
.song-card .card-subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
.card-image-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 1;
}
.placeholder-bg {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(11, 15, 25, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  color: #7C3AED;
}
.song-card:hover .play-overlay {
  opacity: 1;
}
</style>
