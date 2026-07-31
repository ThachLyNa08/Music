<template>
  <div class="register-onboarding-wrap relative min-h-screen text-white font-sans overflow-x-hidden">
    <!-- Background is constant, never re-renders -->
    <FloatingMusicBackground />

    <!-- Container wrapper so z-index works on top of floating background -->
    <div class="relative z-10 w-full min-h-screen flex items-center justify-center p-4 sm:p-8">

      <!-- SCREEN 1: ACCOUNT INFO -->
      <div v-if="displayedStep === 1" class="register-screen register-screen--with-brand" :class="{ 'is-exiting': isScreenExiting }">
        
        <!-- Brand Panel (Left) -->
        <div class="brand-panel hidden lg:flex flex-col justify-center">
          <div class="brand-logo">
            <div class="logo-glyph">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-white relative z-10 drop-shadow-md">
                <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2-12v6a2 2 0 1 0 4 0V9a2 2 0 1 0-4 0z" />
              </svg>
            </div>
            MusicFlow
          </div>

          <h1 class="brand-title">
            <span class="line-1">Nghe nhạc</span>
            <span class="line-2">theo gu của bạn</span>
          </h1>
          
          <p class="brand-desc">
            Khám phá không gian âm nhạc được cá nhân hóa hoàn toàn với những bản nhạc và playlist dành riêng cho bạn.
          </p>
          
          <div class="feature-chips">
            <div class="chip">Gợi ý cá nhân hóa</div>
            <div class="chip">Weekly Mix</div>
            <div class="chip">AI Playlist</div>
          </div>
        </div>

        <!-- Form Card (Right) -->
        <AuthCard class="w-full max-w-[480px] mx-auto">
          <!-- Mobile Brand Header -->
          <div class="lg:hidden flex flex-col items-center mb-8">
             <div class="logo-glyph mb-3 w-12 h-12">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7 text-white relative z-10 drop-shadow-md">
                  <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm-2-12v6a2 2 0 1 0 4 0V9a2 2 0 1 0-4 0z" />
                </svg>
             </div>
             <h1 class="text-3xl font-bold text-white tracking-tight" style="font-family: 'Space Grotesk', sans-serif;">MusicFlow</h1>
          </div>

          <div v-if="accountSubStep === 1">
            <div class="mb-8 text-center lg:text-left">
              <h2 class="text-3xl font-bold text-white mb-2 tracking-tight">Tạo tài khoản</h2>
              <p class="text-[15px] font-medium text-white/50">Nhập email của bạn để bắt đầu</p>
            </div>

            <div v-if="errorMsg" class="mb-6 p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm animate-shake font-medium">
              {{ errorMsg }}
            </div>

            <div class="space-y-5">
              <AuthInput
                id="display_name"
                label="Tên hiển thị"
                v-model="form.display_name"
                placeholder="Tên của bạn"
                @enter="goToPasswordSubStep"
              >
                <template #icon>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                </template>
              </AuthInput>
              
              <div>
                <AuthInput
                  id="email"
                  label="Email"
                  v-model="form.email"
                  type="email"
                  placeholder="you@example.com"
                  @enter="goToPasswordSubStep"
                  @blur="checkEmailExistence"
                >
                  <template #icon>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                  </template>
                </AuthInput>
                <div v-if="emailError" class="text-[#ffb4ab] text-xs font-medium mt-1.5 pl-1">{{ emailError }}</div>
                <div v-else-if="isCheckingEmail" class="text-white/50 text-xs font-medium mt-1.5 pl-1 animate-pulse">Đang kiểm tra...</div>
              </div>

              <div class="pt-2">
                <AuthButton :loading="isCheckingEmail" @click="goToPasswordSubStep">
                  Tiếp theo
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" class="ml-1"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                </AuthButton>
              </div>
            </div>
          </div>

          <div v-else-if="accountSubStep === 2">
            <button class="text-white/50 hover:text-white mb-6 flex items-center gap-1.5 text-sm font-semibold transition-colors" @click="accountSubStep = 1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
              Thay đổi Email
            </button>

            <div class="mb-8 text-center lg:text-left">
              <h2 class="text-3xl font-bold text-white mb-2 tracking-tight">Tạo mật khẩu</h2>
              <p class="text-[15px] font-medium text-white/50">Thiết lập mật khẩu an toàn cho {{ form.email }}</p>
            </div>

            <div v-if="errorMsg" class="mb-6 p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm animate-shake font-medium">
              {{ errorMsg }}
            </div>

            <div class="space-y-5">
              <div>
                <PasswordInput
                  id="password"
                  label="Mật khẩu"
                  v-model="form.password"
                  placeholder="Tối thiểu 6 ký tự"
                  minlength="6"
                  @enter="validatePasswordAndGoStep2"
                  @blur="validatePasswordLength"
                  @input="validatePasswordLength"
                />
                <div v-if="passwordError" class="text-[#ffb4ab] text-xs font-medium mt-1.5 pl-1">{{ passwordError }}</div>
              </div>

              <div>
                <PasswordInput
                  id="confirm_password"
                  label="Nhập lại mật khẩu"
                  v-model="form.confirm_password"
                  placeholder="Nhập lại mật khẩu"
                  minlength="6"
                  @enter="validatePasswordAndGoStep2"
                  @blur="validateConfirmPassword"
                  @input="validateConfirmPassword"
                />
                <div v-if="confirmPasswordError" class="text-[#ffb4ab] text-xs font-medium mt-1.5 pl-1">{{ confirmPasswordError }}</div>
              </div>

              <div class="pt-2">
                <AuthButton 
                  @click="validatePasswordAndGoStep2"
                  :disabled="!!passwordError || !!confirmPasswordError || !form.password || !form.confirm_password"
                >
                  Tiếp tục
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" class="ml-1"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                </AuthButton>
              </div>
            </div>
          </div>

          <div class="mt-8 text-center">
            <p class="text-[14px] font-medium text-white/50">
              Đã có tài khoản? <RouterLink to="/login" class="text-[#30d158] hover:text-[#3ce666] font-bold transition-colors">Đăng nhập</RouterLink>
            </p>
          </div>
        </AuthCard>
      </div>

      <!-- SCREEN 2: CHOOSE YOUR VIBE -->
      <div v-if="displayedStep === 2" class="register-screen register-screen--centered" :class="{ 'is-exiting': isScreenExiting }">
        <div class="w-full max-w-[620px] mx-auto">
          <!-- Header / Steps Indicator -->
          <div class="flex items-center justify-between mb-8 px-2">
            <div class="flex gap-2">
              <div v-for="i in totalSteps" :key="i" class="h-1.5 w-8 rounded-full transition-colors duration-300" :class="i === 2 ? 'bg-[#30d158]' : i < 2 ? 'bg-[#30d158]/50' : 'bg-white/10'"></div>
            </div>
            <span class="text-[10px] font-bold tracking-widest text-white/40 uppercase">Bước 2/{{ totalSteps }}</span>
          </div>

          <AuthCard class="w-full">
            <div class="mb-8 text-center">
              <h2 class="text-3xl font-bold text-white mb-2 tracking-tight">Chọn gu của bạn</h2>
              <p class="text-[15px] font-medium text-white/50">Chọn nhóm nhạc bạn thích, sau đó chọn thêm thể loại con để MusicFlow gợi ý chính xác hơn.</p>
            </div>

            <div v-if="loadingData" class="flex justify-center items-center py-16 min-h-[200px]">
              <div class="w-10 h-10 border-4 border-[#30d158]/30 border-t-[#30d158] rounded-full animate-spin"></div>
            </div>

            <div v-else>
              <!-- Tầng 1: Chọn nhóm nhạc chính -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div v-for="group in mainGroups" :key="group.id"
                  class="main-group-card"
                  :class="{ selected: selectedMainGroups.includes(group.id) }"
                  @click="toggleMainGroup(group.id)">
                  <div class="genre-overlay" />
                  <div v-if="selectedMainGroups.includes(group.id)" class="genre-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  </div>
                  <span class="genre-name">{{ group.name }}</span>
                </div>
              </div>

              <!-- Tầng 2: Chọn thể loại con -->
              <Transition name="expand">
                <div v-if="selectedMainGroups.length > 0" class="subgenre-wrapper mb-8">
                  <div class="subgenre-container custom-scrollbar">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div v-for="g in displayedSubgenres" :key="g.id"
                        class="subgenre-pill"
                        :class="{ selected: form.genre_ids.includes(g.id) }"
                        @click="toggleGenre(g.id)">
                        <div v-if="form.genre_ids.includes(g.id)" class="subgenre-check">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        </div>
                        <span class="subgenre-name">{{ g.name }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <div class="flex items-center justify-between border-t border-white/5 pt-6 mt-auto">
              <div class="flex items-center gap-3">
                <button class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10" @click="goStepSmooth(1)" title="Quay lại">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                </button>
                <span class="text-sm font-bold text-white/50">Đã chọn {{ form.genre_ids.length }} thể loại</span>
              </div>
              <div class="w-36">
                <AuthButton :disabled="form.genre_ids.length < 3 || selectedMainGroups.length === 0" @click="goStep3">
                  Tiếp tục
                </AuthButton>
              </div>
            </div>
          </AuthCard>
        </div>
      </div>

      <!-- SCREEN 3: CHOOSE ARTISTS -->
      <div v-if="displayedStep === 3" class="register-screen register-screen--centered" :class="{ 'is-exiting': isScreenExiting }">
        <div class="w-full max-w-[680px] mx-auto">
          <!-- Header / Steps Indicator -->
          <div class="flex items-center justify-between mb-8 px-2">
            <div class="flex gap-2">
              <div v-for="i in totalSteps" :key="i" class="h-1.5 w-8 rounded-full transition-colors duration-300" :class="i === 3 ? 'bg-[#30d158]' : i < 3 ? 'bg-[#30d158]/50' : 'bg-white/10'"></div>
            </div>
            <span class="text-[10px] font-bold tracking-widest text-white/40 uppercase">Bước 3/{{ totalSteps }}</span>
          </div>

          <AuthCard class="w-full">
            <div class="mb-8 text-center">
              <h2 class="text-3xl font-bold text-white mb-2 tracking-tight">Nghệ sĩ yêu thích</h2>
              <p class="text-[15px] font-medium text-white/50">Chọn ít nhất 1 nghệ sĩ để tinh chỉnh gợi ý âm nhạc.</p>
            </div>

            <div v-if="loadingArtists" class="flex justify-center items-center py-16 min-h-[200px]">
              <div class="w-10 h-10 border-4 border-[#30d158]/30 border-t-[#30d158] rounded-full animate-spin"></div>
            </div>

            <div v-else-if="artistFetchCompleted && artists.length === 0" class="flex flex-col items-center justify-center py-12 text-center min-h-[200px]">
              <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-10 h-10 text-white/30"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
              </div>
              <p class="text-white/60 font-medium px-4 max-w-sm leading-relaxed">
                Chưa tìm thấy nghệ sĩ phù hợp với thể loại đã chọn. Bạn có thể quay lại để chọn thêm thể loại khác.
              </p>
            </div>

            <div v-else class="subgenre-container custom-scrollbar mb-8">
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <div v-for="a in artists" :key="a.id"
                  class="artist-chip"
                  :class="{ selected: form.artist_ids.includes(a.id) }"
                  @click="toggleArtist(a.id)">
                  <img v-if="getArtistImage(a)" :src="getArtistImage(a)" :alt="a.name" class="artist-img" @error="a.__imageError = true" />
                  <div v-else class="artist-initials-fallback">
                    {{ getInitials(a.name) }}
                  </div>
                  <div class="artist-overlay" />
                  <div v-if="form.artist_ids.includes(a.id)" class="artist-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  </div>
                  <span class="artist-name">{{ a.name }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-white/5 pt-6 mt-auto">
              <div class="flex items-center gap-3">
                <button class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10" @click="goBackToStep2" title="Quay lại">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                </button>
                <span class="text-sm font-bold text-white/50">{{ form.artist_ids.length }} nghệ sĩ đã chọn</span>
              </div>
              <div class="min-w-[180px] shrink-0">
                <AuthButton :loading="loading" :disabled="form.artist_ids.length < 1 || loading" @click="handleRegister">
                  <span class="whitespace-nowrap">Hoàn tất đăng ký</span>
                </AuthButton>
              </div>
            </div>
          </AuthCard>
        </div>
      </div>

      <!-- SCREEN 4: DONE -->
      <div v-if="displayedStep === 4" class="register-screen register-screen--centered" :class="{ 'is-exiting': isScreenExiting }">
        <div class="w-full max-w-[480px] mx-auto">
          <!-- Header / Steps Indicator -->
          <div class="flex items-center justify-between mb-8 px-2">
            <div class="flex gap-2">
              <div v-for="i in totalSteps" :key="i" class="h-1.5 w-8 rounded-full transition-colors duration-300" :class="i === 4 ? 'bg-[#30d158]' : i < 4 ? 'bg-[#30d158]/50' : 'bg-white/10'"></div>
            </div>
            <span class="text-[10px] font-bold tracking-widest text-white/40 uppercase">Bước 4/{{ totalSteps }}</span>
          </div>

          <AuthCard class="w-full text-center">
            <div class="w-24 h-24 rounded-full mx-auto mb-8 bg-[#30d158]/10 border border-[#30d158]/20 flex items-center justify-center text-[#30d158] shadow-[0_0_30px_rgba(48,209,88,0.2)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="48" height="48"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            </div>
            
            <h2 class="text-3xl font-bold text-white mb-2 tracking-tight">Tất cả đã sẵn sàng!</h2>
            <p class="text-[15px] font-medium text-white/50 mb-10">Tài khoản của bạn đã được tạo thành công. Khám phá vũ trụ âm nhạc ngay bây giờ.</p>
            
            <div v-if="errorMsg" class="mb-8 p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm animate-shake font-medium">
              {{ errorMsg }}
            </div>

            <AuthButton @click="finishOnboarding">
              Bắt đầu nghe nhạc
            </AuthButton>
          </AuthCard>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import FloatingMusicBackground from '@/components/auth/FloatingMusicBackground.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthInput from '@/components/auth/AuthInput.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import AuthButton from '@/components/auth/AuthButton.vue'
import { genreApi } from '@/api/genre'
import { artistApi } from '@/api/artist'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const displayedStep = ref(1)
const accountSubStep = ref(1)
const isScreenExiting = ref(false)
const totalSteps = 4
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({ display_name: '', email: '', password: '', confirm_password: '', genre_ids: [], artist_ids: [] })
const emailError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')
const isCheckingEmail = ref(false)
let emailCheckTimeout = null

const genres = ref([])
const artists = ref([])
const loadingData = ref(false)
const loadingArtists = ref(false)
const artistFetchCompleted = ref(false)
const artistCache = new Map()

function goStepSmooth(nextStep) {
  if (nextStep === displayedStep.value || isScreenExiting.value) return

  isScreenExiting.value = true

  // After exit animation (350ms), update displayed step to trigger enter animation
  window.setTimeout(() => {
    displayedStep.value = nextStep
    isScreenExiting.value = false
  }, 350)
}

function normalizeArtistResponse(res) {
  const payload = res?.data ?? res
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.artists)) return payload.artists
  if (Array.isArray(payload?.data?.artists)) return payload.data.artists
  return []
}

const mainGroups = [
  { id: 'vpop', name: 'V-Pop' },
  { id: 'kpop', name: 'K-Pop' },
  { id: 'usuk', name: 'US-UK' }
]

const selectedMainGroups = ref([])

function toggleMainGroup(id) {
  const i = selectedMainGroups.value.indexOf(id)
  if (i === -1) selectedMainGroups.value.push(id)
  else selectedMainGroups.value.splice(i, 1)
}

const REGISTER_GENRE_GROUPS = {
  vpop: ['VPOP-MAINSTREAM', 'VPOP-GENZ', 'VPOP-RAP-HIPHOP', 'VPOP-INDIE-CHILL', 'VPOP-BOLERO-FOLK'],
  kpop: ['KPOP-GEN2', 'KPOP-GEN3', 'KPOP-GEN4', 'KPOP-GEN5'],
  usuk: ['USUK-POP', 'USUK-RAP', 'USUK-RNB', 'USUK-ROCK-INDIE', 'USUK-EDM']
}

const categorizedGenres = computed(() => {
  const grouped = { vpop: [], kpop: [], usuk: [] }
  genres.value.forEach(g => {
    const code = (g.code || '').toUpperCase()
    const name = (g.name || '').toUpperCase()
    if (REGISTER_GENRE_GROUPS.vpop.includes(code) || REGISTER_GENRE_GROUPS.vpop.includes(name)) {
      grouped.vpop.push(g)
    } else if (REGISTER_GENRE_GROUPS.kpop.includes(code) || REGISTER_GENRE_GROUPS.kpop.includes(name)) {
      grouped.kpop.push(g)
    } else if (REGISTER_GENRE_GROUPS.usuk.includes(code) || REGISTER_GENRE_GROUPS.usuk.includes(name)) {
      grouped.usuk.push(g)
    }
  })
  return grouped
})

const displayedSubgenres = computed(() => {
  let list = []
  selectedMainGroups.value.forEach(groupId => {
    list = list.concat(categorizedGenres.value[groupId] || [])
  })
  return list
})

const selectedMarketsForArtist = computed(() => {
  return selectedMainGroups.value.map(group => {
    const g = group.toLowerCase()
    if (g === 'v-pop' || g === 'vpop') return 'VPOP'
    if (g === 'k-pop' || g === 'kpop') return 'KPOP'
    if (g === 'us-uk' || g === 'usuk') return 'USUK'
    return group.toUpperCase()
  }).filter(Boolean)
})

watch(selectedMainGroups, () => {
  const validIds = displayedSubgenres.value.map(g => g.id)
  form.genre_ids = form.genre_ids.filter(id => validIds.includes(id))
}, { deep: true })

watch(() => form.email, (newVal) => {
  if (emailError.value) emailError.value = ''
  if (!newVal) {
    isCheckingEmail.value = false
    return
  }
  
  if (emailCheckTimeout) clearTimeout(emailCheckTimeout)
  isCheckingEmail.value = true
  
  emailCheckTimeout = setTimeout(() => {
    checkEmailExistence()
  }, 500)
})

watch(() => form.confirm_password, (newVal) => {
  validateConfirmPassword()
})

watch(() => form.password, (newVal) => {
  validatePasswordLength()
  validateConfirmPassword()
})

function validatePasswordLength() {
  if (form.password && form.password.length < 6) {
    passwordError.value = 'Mật khẩu phải có ít nhất 6 ký tự.'
  } else {
    passwordError.value = ''
  }
}

function validateConfirmPassword() {
  if (form.confirm_password && form.password && form.confirm_password !== form.password) {
    confirmPasswordError.value = 'Mật khẩu nhập lại không khớp.'
  } else {
    confirmPasswordError.value = ''
  }
}

async function checkEmailExistence() {
  if (!form.email) {
    isCheckingEmail.value = false
    return false
  }
  form.email = form.email.trim().toLowerCase()
  isCheckingEmail.value = true
  try {
    const res = await authApi.checkEmail(form.email)
    if (res.data?.exists) {
      emailError.value = 'Email đã được sử dụng'
      return true
    } else {
      emailError.value = ''
      return false
    }
  } catch (err) {
    console.error('Lỗi khi kiểm tra email:', err)
    return false
  } finally {
    isCheckingEmail.value = false
  }
}

onMounted(async () => {
  try {
    loadingData.value = true;
    const gRes = await genreApi.getAll();
    genres.value = gRes.data?.data || [];
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu onboarding:", err);
  } finally {
    loadingData.value = false;
  }
});

let artistLoadSeq = 0

async function fetchArtistsByGenres() {
  const requestId = ++artistLoadSeq;
  const genreIds = form.genre_ids || [];
  const markets = selectedMarketsForArtist.value || [];
  const cacheKey = `${genreIds.slice().sort().join(',')}|${markets.slice().sort().join(',')}`;
  
  if (artistCache.has(cacheKey)) {
    artists.value = artistCache.get(cacheKey);
    artistFetchCompleted.value = true;
    loadingArtists.value = false;
    if (artists.value.length > 0) {
      const validArtistIds = artists.value.map(a => a.id);
      form.artist_ids = form.artist_ids.filter(id => validArtistIds.includes(id));
    } else {
      form.artist_ids = [];
    }
    return;
  }

  loadingArtists.value = true;
  artistFetchCompleted.value = false;
  artists.value = [];
  
  try {
    const genrePromise = genreIds.length > 0
      ? artistApi.getArtistsByGenres(genreIds, 24).then(res => ({ type: 'genre', artists: normalizeArtistResponse(res) })).catch(() => ({ type: 'genre', artists: [] }))
      : Promise.resolve({ type: 'genre', artists: [] });

    const marketPromise = markets.length > 0
      ? artistApi.getArtistsByMarket(markets, 24).then(res => ({ type: 'market', artists: normalizeArtistResponse(res) })).catch(() => ({ type: 'market', artists: [] }))
      : Promise.resolve({ type: 'market', artists: [] });

    const globalPromise = markets.length === 0
      ? artistApi.getPopularArtistsGlobal(24).then(res => ({ type: 'global', artists: normalizeArtistResponse(res) })).catch(() => ({ type: 'global', artists: [] }))
      : Promise.resolve({ type: 'global', artists: [] });

    const [genreRes, marketRes, globalRes] = await Promise.all([genrePromise, marketPromise, globalPromise]);

    if (requestId !== artistLoadSeq) return;

    let finalArtists = [];
    if (genreRes.artists.length > 0) finalArtists = genreRes.artists;
    else if (marketRes.artists.length > 0) finalArtists = marketRes.artists;
    else if (globalRes.artists.length > 0) finalArtists = globalRes.artists;

    const slicedArtists = finalArtists.slice(0, 24);
    artists.value = slicedArtists;
    artistCache.set(cacheKey, slicedArtists);

    if (artists.value.length > 0) {
      const validArtistIds = artists.value.map(a => a.id);
      form.artist_ids = form.artist_ids.filter(id => validArtistIds.includes(id));
    } else {
      form.artist_ids = [];
    }
  } catch (err) {
    if (requestId !== artistLoadSeq) return;
  } finally {
    if (requestId === artistLoadSeq) {
      loadingArtists.value = false;
      artistFetchCompleted.value = true;
    }
  }
}

function getArtistImage(artist) {
  if (artist.__imageError) return null;
  return artist.avatar_url || artist.image_url || artist.cover_url || artist.thumbnail || null;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
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

async function goToPasswordSubStep() {
  errorMsg.value = ''
  if (!form.display_name?.trim()) {
    errorMsg.value = 'Vui lòng nhập tên hiển thị'
    return
  }
  if (!form.email?.trim()) {
    errorMsg.value = 'Vui lòng nhập email'
    return
  }

  form.email = form.email.trim().toLowerCase()
  if (!/\S+@\S+\.\S+/.test(form.email)) {
    emailError.value = 'Email không hợp lệ'
    return
  }

  const exists = await checkEmailExistence()
  if (exists || emailError.value) return

  errorMsg.value = ''
  accountSubStep.value = 2
}

function validatePasswordAndGoStep2() {
  errorMsg.value = ''
  validatePasswordLength()
  validateConfirmPassword()

  if (!form.password) {
    errorMsg.value = 'Vui lòng nhập mật khẩu'
    return
  }
  if (passwordError.value) {
    return
  }
  if (!form.confirm_password) {
    confirmPasswordError.value = 'Vui lòng nhập lại mật khẩu'
    return
  }
  if (confirmPasswordError.value) {
    return
  }

  errorMsg.value = ''
  goStepSmooth(2)
}

function goStep3() { 
  // Trigger API immediately
  fetchArtistsByGenres();
  // Animate to step 3 smoothly without blocking
  goStepSmooth(3);
}

function goBackToStep2() {
  artistLoadSeq++;
  artists.value = [];
  artistFetchCompleted.value = false;
  goStepSmooth(2);
}

async function handleRegister() {
  loading.value = true
  errorMsg.value = ''
  const res = await auth.register(form)
  loading.value = false

  if (!res.success) {
    if (res.code === 'EMAIL_EXISTS') {
      emailError.value = 'Email đã được sử dụng'
      accountSubStep.value = 1
      goStepSmooth(1)
    } else {
      errorMsg.value = res.message || 'Đăng ký thất bại'
    }
  } else {
    goStepSmooth(4)
  }
}

function finishOnboarding() {
  if (auth.isAdmin) {
    router.push('/admin')
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
/* =====================
   SCREEN ARCHITECTURE
   ===================== */
.register-onboarding-wrap {
  width: 100%;
  position: relative;
}

.register-screen {
  width: 100%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: register-screen-enter 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.register-screen.is-exiting {
  animation: register-screen-exit 0.4s ease forwards;
}

@keyframes register-screen-enter {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 30px)) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes register-screen-exit {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 20px)) scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .register-screen,
  .register-screen.is-exiting {
    animation: none !important;
  }
}

/* Screen Layout Variants */
.register-screen--with-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  max-width: 1200px;
  width: 100%;
  padding: 0 1rem;
}

.register-screen--centered {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 1rem;
}

/* =====================
   BRAND PANEL CSS (Copied from old AuthShell)
   ===================== */
.brand-panel {
  flex: 1;
  max-width: 480px;
}
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2.5rem;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}
.logo-glyph {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #30d158, #0a84ff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(48,209,88,0.4);
  position: relative;
  overflow: hidden;
}
.logo-glyph::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 100%);
}
.brand-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 4.5rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 1.5rem;
}
.brand-title .line-1 {
  display: block;
  background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-title .line-2 {
  display: block;
  background: linear-gradient(135deg, #30d158 0%, #0a84ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-desc {
  font-size: 1.125rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.7;
  margin-bottom: 2.5rem;
  font-weight: 400;
}
.feature-chips {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.chip {
  padding: 0.6rem 1.2rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 100px;
  font-size: 0.875rem;
  color: rgba(255,255,255,0.55);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: default;
}

/* =====================
   COMPONENTS CSS
   ===================== */
.animate-shake {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 400px;
  opacity: 1;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
}

.main-group-card {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
}
.main-group-card:hover {
  border-color: rgba(48, 209, 88, 0.45);
  transform: translateY(-2px);
}
.main-group-card.selected {
  background: rgba(48, 209, 88, 0.14);
  border-color: #30d158;
  box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.4), inset -4px -4px 10px rgba(255, 255, 255, 0.02);
}

.genre-check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #30d158;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
}

.genre-name {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  z-index: 10;
}

.subgenre-container {
  max-height: 260px;
  overflow-y: auto;
  padding-right: 8px;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.subgenre-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.subgenre-pill:hover {
  border-color: rgba(48, 209, 88, 0.45);
}
.subgenre-pill.selected {
  background: rgba(48, 209, 88, 0.14);
  border-color: #30d158;
  box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.4);
}
.subgenre-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #30d158;
  color: #000;
}
.subgenre-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
}

.artist-chip {
  position: relative;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: #141418;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 8px 8px 16px rgba(0, 0, 0, 0.4), -4px -4px 12px rgba(255, 255, 255, 0.02);
}
.artist-chip:hover {
  transform: translateY(-4px);
  box-shadow: 12px 12px 24px rgba(0, 0, 0, 0.5), -4px -4px 12px rgba(255, 255, 255, 0.03);
}
.artist-chip.selected {
  border-color: #30d158;
  transform: scale(0.98);
  box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.4), inset -4px -4px 10px rgba(255, 255, 255, 0.02);
}
.artist-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.6;
  transition: opacity 0.3s;
}
.artist-initials-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: rgba(48, 209, 88, 0.7);
  background: rgba(255, 255, 255, 0.02);
  text-transform: uppercase;
  opacity: 0.6;
}
.artist-chip.selected .artist-img,
.artist-chip.selected .artist-initials-fallback {
  opacity: 0.85;
}
.artist-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(11, 11, 15, 0.9) 0%, transparent 60%);
}
.artist-chip.selected .artist-overlay {
  background: linear-gradient(to top, rgba(48, 209, 88, 0.4) 0%, transparent 80%);
}
.artist-check {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #30d158;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
}
.artist-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  text-align: center;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  line-height: 1.2;
}
</style>