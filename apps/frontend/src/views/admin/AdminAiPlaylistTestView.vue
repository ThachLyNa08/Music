<template>
  <div class="admin-ai-playlist-test">
    <!-- Header -->
    <div class="header-section">
      <div>
        <h1 class="page-title">AI Playlist Test</h1>
        <p class="page-subtitle">Kiểm tra khả năng hiểu prompt, phân tích intent và tạo danh sách phát tự động</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary btn-icon" title="Làm mới" @click="resetAll">
          <MfIcon name="sync" size="20" />
        </button>
        <button class="btn-secondary text-rose-600 btn-icon" title="Xóa kết quả" @click="confirmClear">
          <MfIcon name="delete" size="20" />
        </button>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="test-layout">
      <!-- Left Column: Input & Intent -->
      <div class="left-col">
        <!-- Input Card -->
        <div class="card p-5 mb-5 shadow-sm bg-white rounded-2xl border border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 mb-4">Cấu hình Prompt</h2>
          
          <div class="form-group mb-4">
            <label class="block text-sm font-semibold text-slate-700 mb-2">Nhập prompt tiếng Việt</label>
            <textarea 
              v-model="form.prompt" 
              rows="3" 
              class="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 resize-none"
              placeholder="Ví dụ: Tạo playlist VPOP chill nhẹ để học bài buổi tối"
            ></textarea>
            
            <div class="quick-prompts mt-3 flex flex-wrap gap-2">
              <span class="text-xs text-slate-500 mt-1 mr-1">Gợi ý nhanh:</span>
              <button 
                v-for="(suggestion, i) in quickPrompts" 
                :key="i"
                @click="form.prompt = suggestion"
                class="pill-btn"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="form-group">
              <label class="block text-sm font-semibold text-slate-700 mb-2">Số lượng bài</label>
              <select v-model="form.targetCount" class="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 text-sm text-slate-700 bg-white">
                <option value="10">10 bài</option>
                <option value="15">15 bài</option>
                <option value="20">20 bài (Mặc định)</option>
                <option value="30">30 bài</option>
              </select>
            </div>
            <div class="form-group">
              <label class="block text-sm font-semibold text-slate-700 mb-2">User ID (Tùy chọn)</label>
              <input 
                type="number" 
                v-model="form.userId" 
                class="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 text-sm text-slate-700" 
                placeholder="Để trống = Cold-start"
              />
            </div>
          </div>

          <div class="flex items-center gap-4 mt-5">
            <div class="form-group flex items-center gap-3 shrink-0">
              <label class="toggle-switch">
                <input type="checkbox" v-model="form.useLLM" :disabled="!hasLLMKey">
                <span class="slider round"></span>
              </label>
              <div>
                <span class="text-sm font-semibold text-slate-700">Dùng LLM (Gemini)</span>
                <p v-if="!hasLLMKey" class="text-xs text-rose-500">Chưa cấu hình API Key ở Backend</p>
              </div>
            </div>
  
            <button class="btn-primary flex-1 justify-center h-11 text-base font-semibold rounded-xl whitespace-nowrap" @click="runAnalysis" :disabled="loading">
              {{ loading ? 'Đang phân tích...' : 'Phân tích & tạo preview' }}
            </button>
          </div>
        </div>

        <!-- Intent Result Card -->
        <div v-if="result" class="card p-5 shadow-sm bg-white rounded-2xl border border-slate-100 relative">
          <div v-if="loading" class="absolute inset-0 bg-white/60 flex items-center justify-center rounded-2xl z-10 backdrop-blur-sm">
            <div class="spinner"></div>
          </div>
          
          <h2 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <MfIcon name="psychology" class="text-indigo-600" /> Intent được nhận diện
          </h2>
          
          <div v-if="result.intent" class="intent-grid">
            <div class="intent-item" v-if="result.intent.mood">
              <span class="lbl">Mood</span>
              <span class="val bg-blue-100 text-blue-800">{{ result.intent.mood }}</span>
            </div>
            <div class="intent-item" v-if="result.intent.activity">
              <span class="lbl">Context/Activity</span>
              <span class="val bg-emerald-100 text-emerald-800">{{ result.intent.activity }}</span>
            </div>
            <div class="intent-item" v-if="result.intent.market">
              <span class="lbl">Market</span>
              <span class="val bg-purple-100 text-purple-800">{{ result.intent.market }}</span>
            </div>
            <div class="intent-item" v-if="result.intent.genres?.length">
              <span class="lbl">Genres</span>
              <div class="flex flex-wrap gap-1">
                <span class="val bg-amber-100 text-amber-800" v-for="g in result.intent.genres" :key="g">{{ g }}</span>
              </div>
            </div>
            <div class="intent-item" v-if="result.intent.artists?.length">
              <span class="lbl">Artists</span>
              <div class="flex flex-wrap gap-1">
                <span class="val bg-rose-100 text-rose-800" v-for="a in result.intent.artists" :key="a">{{ a }}</span>
              </div>
            </div>
            <div class="intent-item" v-if="result.intent.energy">
              <span class="lbl">Energy</span>
              <span class="val bg-slate-100 text-slate-800">{{ result.intent.energy }}</span>
            </div>
          </div>
          <div v-else class="text-sm text-slate-500 italic text-center py-4">
            Không có dữ liệu intent rõ ràng
          </div>
        </div>
      </div>

      <!-- Right Column: Preview & Diagnostics -->
      <div class="right-col">
        <!-- Empty State -->
        <div v-if="!result && !loading" class="empty-state card p-10 bg-white rounded-2xl border border-slate-100 text-center shadow-sm">
          <MfIcon name="ai" size="64" class="text-slate-300 mx-auto mb-4" />
          <h3 class="text-xl font-bold text-slate-700 mb-2">Nhập prompt để kiểm tra pipeline AI Playlist</h3>
          <p class="text-slate-500">Hệ thống sẽ phân tích intent và tạo preview danh sách bài hát mà không lưu vào CSDL.</p>
        </div>

        <template v-if="result || loading">
          <!-- Preview Songs -->
          <div class="card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5 relative">
            <div v-if="loading" class="absolute inset-0 bg-white/50 z-10"></div>
            
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MfIcon name="queue_music" class="text-indigo-600" /> Preview danh sách bài hát
              </h2>
              <span class="text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {{ result?.items?.length || 0 }} / {{ form.targetCount }} bài
              </span>
            </div>
            
            <div class="table-container p-0">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                    <th class="p-3 font-semibold text-center w-10">#</th>
                    <th class="p-3 font-semibold w-14">Ảnh</th>
                    <th class="p-3 font-semibold">Bài hát & Nghệ sĩ</th>
                    <th class="p-3 font-semibold">Chiến lược</th>
                    <th class="p-3 font-semibold w-1/3">Lý do (Reason)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!result?.items?.length && !loading">
                    <td colspan="5" class="p-8 text-center text-slate-500">Không tìm thấy bài hát nào phù hợp với Intent.</td>
                  </tr>
                  <tr v-for="(item, idx) in result?.items" :key="item.song_id" class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td class="p-3 text-center text-sm font-medium text-slate-400">{{ idx + 1 }}</td>
                    <td class="p-3">
                      <img :src="item.cover_url" class="w-10 h-10 rounded-lg object-cover shadow-sm" alt="" v-if="item.cover_url" />
                      <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center" v-else>
                        <MfIcon name="music_note" class="text-slate-400" size="18" />
                      </div>
                    </td>
                    <td class="p-3">
                      <div class="font-semibold text-slate-800 text-sm hover:text-indigo-600 cursor-pointer truncate max-w-[200px]" @click="goToSong(item.song_id)">
                        {{ item.title }}
                      </div>
                      <div class="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                        <span 
                          v-if="item.artist_id" 
                          class="hover:text-indigo-600 hover:underline cursor-pointer" 
                          @click="goToArtist(item.artist_id)"
                        >{{ item.artist_name }}</span>
                        <span v-else>{{ item.artist_name || 'Unknown' }}</span>
                      </div>
                    </td>
                    <td class="p-3">
                      <span class="inline-block px-2 py-1 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 uppercase border border-slate-200">
                        {{ item.strategy }}
                      </span>
                    </td>
                    <td class="p-3 text-xs text-slate-600 leading-snug">
                      {{ item.reason }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Diagnostics -->
          <div class="card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
            <button class="w-full p-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors text-left" @click="showDiagnostics = !showDiagnostics">
              <h2 class="text-base font-bold text-slate-700 flex items-center gap-2">
                <MfIcon name="terminal" class="text-slate-500" size="18" /> Dữ liệu kỹ thuật (Diagnostics)
              </h2>
              <MfIcon :name="showDiagnostics ? 'expand_less' : 'expand_more'" class="text-slate-400" />
            </button>
            
            <div v-show="showDiagnostics" class="p-4 border-t border-slate-100 bg-slate-900 text-slate-300 font-mono text-xs overflow-x-auto relative rounded-b-2xl">
              <button class="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors" @click="copyDiagnostics" title="Copy JSON">
                <MfIcon name="content_copy" size="16" />
              </button>
              <pre class="m-0">{{ JSON.stringify(result?.diagnostics, null, 2) }}</pre>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog 
      v-model:open="confirmClearState.open"
      :title="confirmClearState.title"
      :message="confirmClearState.message"
      :confirmText="confirmClearState.confirmText"
      :type="confirmClearState.type"
      @confirm="handleClearConfirm"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import MfIcon from '@/components/common/MfIcon.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const toast = useToastStore()

const loading = ref(false)
const result = ref(null)
const showDiagnostics = ref(false)
const hasLLMKey = ref(true) // Should technically check backend config, assume true or toggle-able for now.

const form = reactive({
  prompt: '',
  targetCount: 20,
  userId: '',
  useLLM: false
})

const confirmClearState = reactive({
  open: false,
  title: 'Xác nhận xóa kết quả',
  message: 'Bạn có chắc chắn muốn xóa toàn bộ kết quả phân tích hiện tại không?',
  confirmText: 'Xóa',
  type: 'danger'
})

const quickPrompts = [
  "Nhạc Kpop Gen 3 sôi động để tập gym",
  "VPOP buồn nhẹ nghe ban đêm",
  "USUK pop chill làm việc",
  "Nhạc Sơn Tùng M-TP nhiều năng lượng",
  "Playlist bolero nhẹ cho buổi sáng"
]

onMounted(async () => {
  // Check if LLM is enabled globally in backend if possible, or just leave it.
})

async function runAnalysis() {
  if (!form.prompt.trim()) {
    toast.showToast('Vui lòng nhập prompt để tạo playlist thử nghiệm', 'warning')
    return
  }

  loading.value = true
  try {
    const payload = {
      prompt: form.prompt.trim(),
      targetCount: form.targetCount,
      userId: form.userId || null,
      useLLM: form.useLLM
    }

    const res = await api.post('/admin/ai-playlist-test/preview', payload)
    
    if (res.data?.success) {
      result.value = res.data.data
      toast.showToast('Phân tích thành công!', 'success')
      
      if (!result.value.diagnostics?.useLLMApplied && form.useLLM) {
        toast.showToast('LLM không khả dụng, đã dùng Rule-based Fallback.', 'info')
      }
    } else {
      toast.showToast(res.data?.message || 'Có lỗi xảy ra', 'error')
    }
  } catch (err) {
    console.error('Lỗi khi phân tích:', err)
    if (err.response?.status === 404 && form.userId) {
       toast.showToast('User ID không tồn tại!', 'error')
    } else {
       toast.showToast(err.response?.data?.message || 'Không thể kết nối đến máy chủ AI', 'error')
    }
  } finally {
    loading.value = false
  }
}

function clearResults() {
  result.value = null
  showDiagnostics.value = false
}

function confirmClear() {
  if (!result.value && form.prompt === '') return // Không có gì để xóa
  confirmClearState.open = true
}

function handleClearConfirm() {
  clearResults()
  form.prompt = ''
  confirmClearState.open = false
  toast.showToast('Đã xóa kết quả thành công', 'success')
}

function resetAll() {
  form.prompt = ''
  form.targetCount = 20
  form.userId = ''
  form.useLLM = false
  clearResults()
}

function copyDiagnostics() {
  if (result.value?.diagnostics) {
    navigator.clipboard.writeText(JSON.stringify(result.value.diagnostics, null, 2))
    toast.showToast('Đã copy dữ liệu kỹ thuật', 'success')
  }
}

function goToSong(id) {
  router.push(`/admin/songs/${id}`)
}

function goToArtist(id) {
  router.push(`/admin/artists/${id}/detail`)
}
</script>

<style scoped>
.admin-ai-playlist-test {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.page-title {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 4px;
}
.page-subtitle {
  color: #64748b;
  font-size: 14px;
}
.header-actions {
  display: flex;
  gap: 12px;
}

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  height: 40px;
}
.btn-primary {
  background: #6c5ce7;
  color: white;
  border: none;
}
.btn-primary:hover:not(:disabled) { background: #5a4bcf; }
.btn-primary:disabled { background: #a5a5a5; cursor: not-allowed; }

.btn-secondary {
  background: white;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:hover:not(:disabled) { background: #f8fafc; }
.btn-icon {
  padding: 0;
  width: 40px;
  justify-content: center;
}

.test-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 1024px) {
  .test-layout {
    grid-template-columns: 4fr 6fr;
  }
}

.pill-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.pill-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: .3s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
}
input:checked + .slider {
  background-color: #6c5ce7;
}
input:checked + .slider:before {
  transform: translateX(20px);
}
input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}
.slider.round {
  border-radius: 24px;
}
.slider.round:before {
  border-radius: 50%;
}

.intent-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.intent-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.intent-item .lbl {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.intent-item .val {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  width: fit-content;
}

.table-container {
  max-height: 380px; /* Hiển thị khoảng 4-5 bài */
  overflow-y: auto;
}
.table-container thead th {
  position: sticky;
  top: 0;
  background-color: #f8fafc; /* bg-slate-50 */
  z-index: 10;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

/* Spinner */
.spinner {
  border: 3px solid rgba(108, 92, 231, 0.1);
  border-left-color: #6c5ce7;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
