<template>
  <transition name="fade-up">
    <div v-if="isOpen" class="fullscreen-player">
      <!-- Background -->
      <div class="dynamic-bg"></div>
      
      <!-- Top Bar -->
      <div class="top-controls">
        <button class="btn-circle" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="brand">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="text-primary"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>MusicFlow AI</span>
        </div>
        <button class="btn-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
        </button>
      </div>

      <!-- Main Layout -->
      <div class="main-layout">
        <!-- Left: Album Art -->
        <div class="left-panel">
          <div class="album-container" :class="{ 'playing': player.isPlaying }">
            <img :src="coverUrl" alt="Cover" class="album-cover" />
            <div class="visualizer-overlay" v-if="player.isPlaying">
              <div class="v-bar"></div>
              <div class="v-bar"></div>
              <div class="v-bar"></div>
              <div class="v-bar"></div>
              <div class="v-bar"></div>
            </div>
          </div>
        </div>

        <!-- Right: Lyrics -->
        <div class="right-panel">
          <div class="lyrics-container lyrics-mask">
            <div class="lyrics-scroll">
              <p class="lyric-line past">Ta đã từng hứa sẽ bên nhau mãi mãi</p>
              <p class="lyric-line past">Mà cớ sao giờ đây chỉ còn lại nỗi đau</p>
              <p class="lyric-line active">
                Chạm khẽ tim anh một chút thôi
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" class="inline-block ml-2 text-primary animate-pulse"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>
              </p>
              <p class="lyric-line future">Gió mang em đi xa rời vòng tay anh</p>
              <p class="lyric-line future">Để lại kỷ niệm vương vấn trong đêm thâu</p>
              <p class="lyric-line future">Nơi tình yêu bắt đầu cũng là nơi kết thúc</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Controls -->
      <div class="bottom-bar">
        <div class="controls-wrapper">
          <!-- Song Info -->
          <div class="song-info">
            <div>
              <h2 class="song-title">{{ player.currentSong?.title || 'Chưa có bài hát' }}</h2>
              <p class="song-artist">{{ player.currentSong?.artist_name || 'Nghệ sĩ' }}</p>
            </div>
            <div class="actions">
              <button class="action-btn" @click="library.toggleLike(player.currentSong)" :class="{ 'text-pink-400': library.isLiked(player.currentSong) }">
                <svg v-if="!library.isLiked(player.currentSong)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24" style="color:#fd79a8"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </button>
            </div>
          </div>

          <!-- Progress -->
          <div class="progress-section">
            <span class="time">{{ formatTime(player.currentTime) }}</span>
            <div class="progress-bar" @click="seek">
              <div class="progress-fill" :style="{ width: pct + '%' }"></div>
              <div class="progress-thumb" :style="{ left: pct + '%' }"></div>
            </div>
            <span class="time">{{ formatTime(player.duration) }}</span>
          </div>

          <!-- Player Buttons -->
          <div class="player-btns">
            <div class="left-btns">
              <button class="ctrl-btn" @click="player.toggleShuffle()" :class="{ active: player.shuffle }"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg></button>
              <button class="ctrl-btn" @click="player.prev()"><svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
            </div>
            
            <button class="play-btn" @click="player.togglePlay()">
              <svg v-if="!player.isPlaying" viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M8 5v14l11-7z"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>

            <div class="right-btns">
              <button class="ctrl-btn" @click="player.next()"><svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
              <button class="ctrl-btn" @click="player.toggleRepeat()" :class="{ active: player.repeat !== 'none' }"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg></button>
            </div>

            <!-- Extra -->
            <div class="extra-controls">
              <button class="karaoke-badge" @click="$router.push('/karaoke'); $emit('close')">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>
                Karaoke AI
              </button>
              <div class="volume-slider">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="text-slate-400"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                <input type="range" min="0" max="100" :value="player.volume * 100" @input="player.setVolume($event.target.value / 100)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const player = usePlayerStore()
const library = useLibraryStore()

const pct = computed(() => player.duration ? (player.currentTime / player.duration) * 100 : 0)

const coverUrl = computed(() => {
  if (player.currentSong?.cover) {
    if (player.currentSong.cover.startsWith('http')) return player.currentSong.cover
  }
  return 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=500&auto=format&fit=crop'
})

function formatTime(s) {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function seek(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  player.seek(((e.clientX - rect.left) / rect.width) * player.duration)
}
</script>

<style scoped>
.fullscreen-player {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #0f172a;
  color: white;
  display: flex;
  flex-direction: column;
}

.dynamic-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 20% 30%, rgba(162, 155, 254, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(116, 185, 255, 0.1) 0%, transparent 50%),
              linear-gradient(to bottom, #1e293b, #0f172a);
  z-index: -1;
}

/* Animations */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.top-controls {
  position: absolute;
  top: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}
.btn-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-circle:hover {
  background: rgba(255,255,255,0.15);
  transform: scale(1.05);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-size: 14px;
}
.text-primary { color: #a29bfe; }

.main-layout {
  flex: 1;
  display: flex;
  padding: 80px 40px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.left-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.album-container {
  width: 400px;
  height: 400px;
  border-radius: 24px;
  position: relative;
  box-shadow: 0 0 60px rgba(162, 155, 254, 0.2);
  transition: transform 0.5s;
}
.album-container.playing {
  animation: pulse-glow 4s infinite alternate;
}
@keyframes pulse-glow {
  0% { box-shadow: 0 0 60px rgba(162, 155, 254, 0.2); }
  100% { box-shadow: 0 0 100px rgba(116, 185, 255, 0.4); }
}
.album-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 24px;
}
.visualizer-overlay {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 6px;
  height: 40px;
}
.v-bar {
  width: 6px;
  background: white;
  border-radius: 3px;
  animation: bounce 1.2s ease-in-out infinite alternate;
}
.v-bar:nth-child(1) { animation-delay: 0.1s; background: #a29bfe; }
.v-bar:nth-child(2) { animation-delay: 0.3s; background: #74b9ff; }
.v-bar:nth-child(3) { animation-delay: 0.5s; background: white; }
.v-bar:nth-child(4) { animation-delay: 0.2s; background: #55efc4; }
.v-bar:nth-child(5) { animation-delay: 0.4s; background: #fd79a8; }
@keyframes bounce {
  0% { height: 10px; }
  100% { height: 40px; }
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 60px;
}
.lyrics-mask {
  mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
  height: 500px;
  overflow-y: auto;
  padding: 100px 0;
}
.lyrics-mask::-webkit-scrollbar { display: none; }
.lyric-line {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 32px;
  transition: all 0.3s;
}
.lyric-line.past {
  color: rgba(255,255,255,0.3);
}
.lyric-line.active {
  color: white;
  font-size: 40px;
  transform: scale(1.02);
  transform-origin: left;
}
.lyric-line.future {
  color: rgba(255,255,255,0.5);
}

.bottom-bar {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 24px 40px;
}
.controls-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.song-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.song-title {
  font-size: 24px;
  font-weight: 700;
}
.song-artist {
  font-size: 16px;
  color: #94a3b8;
}
.action-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
}
.action-btn:hover { color: white; }

.progress-section {
  display: flex;
  align-items: center;
  gap: 16px;
}
.time {
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  min-width: 40px;
}
.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(to right, #a29bfe, #74b9ff);
  border-radius: 3px;
}
.progress-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s;
}
.progress-bar:hover .progress-thumb { opacity: 1; }

.player-btns {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.left-btns, .right-btns {
  display: flex;
  gap: 24px;
  align-items: center;
}
.ctrl-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.2s;
}
.ctrl-btn:hover, .ctrl-btn.active { color: white; }

.play-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #a29bfe;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: 0 0 20px rgba(162, 155, 254, 0.4);
}
.play-btn:hover { transform: scale(1.05); }

.extra-controls {
  display: flex;
  align-items: center;
  gap: 24px;
}
.karaoke-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(116, 185, 255, 0.1);
  border: 1px solid rgba(116, 185, 255, 0.2);
  color: #74b9ff;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.karaoke-badge:hover { background: rgba(116, 185, 255, 0.2); }
.volume-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}
.volume-slider input {
  width: 100px;
  height: 4px;
  accent-color: white;
}
</style>
