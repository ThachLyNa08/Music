<template>
  <div class="register-root relative overflow-hidden">
    <FloatingMusicBackground />
    <div class="relative z-10 w-full h-full flex flex-col">
    <!-- Header -->
    <header class="reg-header">
      <div class="brand-logo">
        <span class="brand-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
        </span>
        <span class="brand-name">MusicFlow</span>
      </div>
      <div class="step-indicator">
        <div class="step-bars">
          <div v-for="i in totalSteps" :key="i" class="step-bar" :class="{ active: i <= step, done: i < step }" />
        </div>
        <span class="step-label">STEP {{ step }} OF {{ totalSteps }}</span>
      </div>
    </header>

    <!-- Step 1: Account info -->
    <div v-if="step === 1" class="step-wrapper">
      <div class="step-card">
        <h1 class="step-title">Tạo tài khoản</h1>
        <p class="step-desc">Bắt đầu hành trình âm nhạc của bạn ngay hôm nay</p>

        <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

        <div class="field-group">
          <label class="field-label">Tên hiển thị</label>
          <div class="input-wrap">
            <span class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg></span>
            <input v-model="form.display_name" type="text" class="field-input" placeholder="Tên của bạn" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Email</label>
          <div class="input-wrap">
            <span class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg></span>
            <input v-model="form.email" type="email" class="field-input" placeholder="you@example.com" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Mật khẩu</label>
          <div class="input-wrap">
            <span class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg></span>
            <input v-model="form.password" type="password" class="field-input" placeholder="Tối thiểu 6 ký tự" minlength="6" />
          </div>
        </div>

        <button class="btn-next" @click="goStep2">
          <span>Tiếp theo</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
        </button>

        <p class="login-hint">Đã có tài khoản? <RouterLink to="/login" class="login-link">Đăng nhập</RouterLink></p>
      </div>
    </div>

    <!-- Step 2: Choose your vibe -->
    <div v-else-if="step === 2" class="step-wrapper step-wrapper--wide">
      <div class="vibe-header">
        <h1 class="vibe-title">Choose your vibe</h1>
        <p class="vibe-desc">Select 3 or more genres to build your personalized library. We'll use these to curate your initial listening experience.</p>
      </div>

      <div class="genre-grid">
        <div v-for="g in genres" :key="g.id"
          class="genre-card"
          :class="{ selected: form.genre_ids.includes(g.id) }"
          @click="toggleGenre(g.id)">
          <img :src="getImageUrl(g, 'genre')" :alt="g.name" class="genre-img" @error="$event.target.src='https://ui-avatars.com/api/?name=' + encodeURIComponent(g.name) + '&background=random&color=fff&size=150'" />
          <div class="genre-overlay" />
          <div v-if="form.genre_ids.includes(g.id)" class="genre-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          </div>
          <span class="genre-name">{{ g.name }}</span>
        </div>
      </div>

      <div class="vibe-footer">
        <span class="selected-count">{{ form.genre_ids.length }} genres selected</span>
        <button class="btn-continue" :disabled="form.genre_ids.length < 3" @click="goStep3">Continue</button>
      </div>
    </div>

    <!-- Step 3: Choose artists -->
    <div v-else-if="step === 3" class="step-wrapper step-wrapper--wide">
      <div class="vibe-header">
        <h1 class="vibe-title">Pick your artists</h1>
        <p class="vibe-desc">Select at least 1 artist you love. We'll use this to fine-tune your recommendations.</p>
      </div>

      <div class="genre-grid">
        <div v-for="a in artists" :key="a.id"
          class="genre-card artist-card"
          :class="{ selected: form.artist_ids.includes(a.id) }"
          @click="toggleArtist(a.id)">
          <img :src="getImageUrl(a, 'artist')" :alt="a.name" class="genre-img" @error="$event.target.src='https://ui-avatars.com/api/?name=' + encodeURIComponent(a.name) + '&background=random&color=fff&size=150'" />
          <div class="genre-overlay" />
          <div v-if="form.artist_ids.includes(a.id)" class="genre-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          </div>
          <span class="genre-name">{{ a.name }}</span>
        </div>
      </div>

      <div class="vibe-footer">
        <span class="selected-count">{{ form.artist_ids.length }} artists selected</span>
        <button class="btn-continue" :disabled="form.artist_ids.length < 1" @click="goStep4">Continue</button>
      </div>
    </div>

    <!-- Step 4: Done -->
    <div v-else-if="step === 4" class="step-wrapper">
      <div class="step-card done-card">
        <div class="done-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="40" height="40"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        </div>
        <h1 class="step-title">Tất cả đã sẵn sàng!</h1>
        <p class="step-desc">Tài khoản của bạn đã được tạo. Khám phá vũ trụ âm nhạc ngay bây giờ.</p>
        <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>
        <button class="btn-next" :disabled="loading" @click="handleRegister">
          <span v-if="loading" class="loading-dots"><span/><span/><span/></span>
          <template v-else>
            <span>Bắt đầu nghe nhạc</span>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </template>
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import FloatingMusicBackground from '@/components/auth/FloatingMusicBackground.vue'
import { genreApi } from '@/api/genre'
import { artistApi } from '@/api/artist'

const auth = useAuthStore()
const step = ref(1)
const totalSteps = 4
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({ display_name: '', email: '', password: '', genre_ids: [], artist_ids: [] })

const genres = ref([])
const artists = ref([])
const loadingData = ref(false)

onMounted(async () => {
  try {
    loadingData.value = true;
    const [gRes, aRes] = await Promise.all([
      genreApi.getAll(),
      artistApi.getAll({ popular: true, limit: 12 })
    ]);
    genres.value = gRes.data?.data || [];
    artists.value = aRes.data?.data || [];
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu onboarding:", err);
  } finally {
    loadingData.value = false;
  }
});

function getImageUrl(item, type) {
  if (item.avatar_url) return item.avatar_url;
  if (item.image_url) return item.image_url;
  // Fallback
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&size=150`;
}

function toggleGenre(id) {
  const i = form.genre_ids.indexOf(id)
  if (i === -1) form.genre_ids.push(id)
  else form.genre_ids.splice(i, 1)
}

function toggleArtist(id) {
  const i = form.artist_ids.indexOf(id)
  if (i === -1) form.artist_ids.push(id)
  else form.artist_ids.splice(i, 1)
}

function goStep2() {
  if (!form.display_name || !form.email || !form.password) {
    errorMsg.value = 'Vui lòng điền đầy đủ thông tin'; return
  }
  errorMsg.value = ''; step.value = 2
}
function goStep3() { step.value = 3 }
function goStep4() { step.value = 4 }

async function handleRegister() {
  loading.value = true; errorMsg.value = ''
  const res = await auth.register(form)
  loading.value = false
  if (!res.success) errorMsg.value = res.message
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap');

* { box-sizing: border-box; }
.register-root { min-height: 100vh; background: #070A12; color: #ffffff; font-family: 'Be Vietnam Pro', sans-serif; }

/* Header */
.reg-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 40px; background: rgba(11, 15, 25, 0.75); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.brand-logo { display: flex; align-items: center; gap: 8px; }
.brand-icon { color: #7C3AED; display: flex; filter: drop-shadow(0 0 8px rgba(124,58,237,0.5)); }
.brand-name { font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em; background: linear-gradient(135deg, #7C3AED, #3B82F6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.step-indicator { display: flex; align-items: center; gap: 16px; }
.step-bars { display: flex; gap: 6px; }
.step-bar { width: 32px; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.05); transition: background .3s; }
.step-bar.active { background: #7C3AED; box-shadow: 0 0 10px rgba(124,58,237,0.5); }
.step-bar.done { background: #3B82F6; }
.step-label { font-size: 11px; font-weight: 800; letter-spacing: .05em; color: rgba(255, 255, 255, 0.4); white-space: nowrap; }

/* Step wrapper */
.step-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; }
.step-wrapper--wide { justify-content: flex-start; padding-top: 40px; }

/* Step card */
.step-card { width: 100%; max-width: 480px; background: rgba(255, 255, 255, 0.03); padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08);}
.step-title { font-size: 32px; font-weight: 900; line-height: 1.2; letter-spacing: -.02em; margin-bottom: 8px; color: #ffffff; }
.step-desc { font-size: 15px; color: rgba(255, 255, 255, 0.7); line-height: 1.6; margin-bottom: 32px; font-weight: 500; }
.error-banner { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: .75rem; padding: 12px 16px; font-size: 14px; margin-bottom: 20px; }

/* Fields */
.field-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.field-label { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: rgba(255, 255, 255, 0.6); padding-left: 4px; }
.input-wrap { position: relative; }
.input-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #7C3AED; display: flex; pointer-events: none; }
.field-input { width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); color: #ffffff; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; font-weight: 600; border-radius: 9999px; padding: 16px 16px 16px 48px; outline: none; transition: all .3s; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
.field-input::placeholder { color: rgba(255, 255, 255, 0.35); font-weight: 500; }
.field-input:focus { background: rgba(255, 255, 255, 0.05); border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2); }

.btn-next { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #7C3AED, #3B82F6); color: #ffffff; font-family: 'Be Vietnam Pro', sans-serif; font-size: 16px; font-weight: 800; border: none; border-radius: 9999px; padding: 16px; cursor: pointer; margin-top: 8px; transition: all .3s; box-shadow: 0 10px 25px rgba(124, 58, 237, 0.3); }
.btn-next:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(124, 58, 237, 0.4); }
.btn-next:disabled { opacity: .6; cursor: not-allowed; }
.loading-dots { display: flex; gap: 6px; }
.loading-dots span { width: 7px; height: 7px; border-radius: 50%; background: #ffffff; animation: ld .8s ease-in-out infinite; }
.loading-dots span:nth-child(2){animation-delay:.15s}.loading-dots span:nth-child(3){animation-delay:.3s}
@keyframes ld { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
.login-hint { text-align: center; font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-top: 24px; font-weight: 500; }
.login-link { color: #7C3AED; font-weight: 800; text-decoration: none; }
.login-link:hover { color: #5B21B6; }

/* Vibe / Genre picker */
.vibe-header { text-align: center; margin-bottom: 40px; max-width: 600px; }
.vibe-title { font-size: 48px; font-weight: 900; letter-spacing: -.02em; margin-bottom: 12px; color: #ffffff; }
.vibe-desc { font-size: 16px; color: rgba(255, 255, 255, 0.7); line-height: 1.6; max-width: 480px; margin: 0 auto; font-weight: 500;}

.genre-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; max-width: 900px; margin-bottom: 40px; }
@media (max-width: 768px) { .genre-grid { grid-template-columns: repeat(2, 1fr); } }

.genre-card {
  position: relative; border-radius: 20px; overflow: hidden;
  cursor: pointer; border: 3px solid transparent;
  transition: all .3s cubic-bezier(0.175, 0.885, 0.32, 1.275); aspect-ratio: 1;
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
  background: rgba(255, 255, 255, 0.03);
}
.artist-card { border-radius: 50%; }
.genre-card:hover { transform: scale(1.05) translateY(-5px); box-shadow: 0 15px 30px rgba(124, 58, 237, 0.2); }
.genre-card.selected { border-color: #7C3AED; transform: scale(1.02); box-shadow: 0 10px 25px rgba(124, 58, 237, 0.3); }
.genre-img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.6; }
.genre-card.selected .genre-img { opacity: 0.85; }
.genre-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%); }
.genre-card.selected .genre-overlay { background: linear-gradient(to top, rgba(124,58,237,.8) 0%, rgba(59,130,246,0.4) 100%); }
.genre-check {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px; border-radius: 50%;
  background: #ffffff; display: flex; align-items: center; justify-content: center;
  color: #7C3AED; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.genre-name { position: absolute; bottom: 16px; left: 16px; font-size: 18px; font-weight: 800; letter-spacing: .01em; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }

.vibe-footer { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 900px; padding: 0 4px; }
.selected-count { font-size: 15px; color: rgba(255, 255, 255, 0.7); font-weight: 700; }
.btn-continue { background: linear-gradient(135deg, #7C3AED, #3B82F6); color: #ffffff; font-family: 'Be Vietnam Pro', sans-serif; font-size: 16px; font-weight: 800; border: none; border-radius: 9999px; padding: 14px 36px; cursor: pointer; transition: all .3s; box-shadow: 0 10px 25px rgba(124, 58, 237, 0.3); }
.btn-continue:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(124, 58, 237, 0.4); }
.btn-continue:disabled { opacity: .3; cursor: not-allowed; box-shadow: none; }

/* Done */
.done-card { text-align: center; }
.done-icon { width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2)); border: 3px solid #7C3AED; display: flex; align-items: center; justify-content: center; color: #7C3AED; margin: 0 auto 32px; box-shadow: 0 10px 30px rgba(124, 58, 237, 0.3); }
</style>