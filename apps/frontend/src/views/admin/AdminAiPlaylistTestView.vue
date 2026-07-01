<template>
  <div class="space-y-6 pb-10">
    <!-- Header -->
    <header class="flex flex-col md:flex-row items-start md:items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">AI Playlist Test</h1>
        <p class="text-gray-500 mt-1 text-sm font-medium">Kiểm tra khả năng hiểu prompt, phân tích intent và tạo danh sách phát tự động</p>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Làm mới" @click="resetAll">
          <MfIcon name="sync" size="20" />
        </button>
        <button class="btn-secondary flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition" title="Xóa kết quả" @click="confirmClear">
          <MfIcon name="delete" size="20" />
        </button>
      </div>
    </header>

    <!-- Main Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Left Column: Input & Intent -->
      <div class="lg:col-span-2 flex flex-col gap-6">
        <!-- Input Card -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 class="text-lg font-bold text-slate-800 mb-4">Cấu hình Prompt</h2>
          
          <div class="mb-4">
            <label class="block text-sm font-semibold text-slate-700 mb-2">Nhập prompt tiếng Việt</label>
            <textarea 
              v-model="form.prompt" 
              rows="3" 
              class="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 resize-none"
              placeholder="Ví dụ: Tạo playlist VPOP chill nhẹ để học bài buổi tối"
            ></textarea>
            
            <div class="mt-3 flex flex-wrap gap-2 items-center">
              <span class="text-xs text-slate-500">Gợi ý nhanh:</span>
              <button 
                v-for="(suggestion, i) in quickPrompts" 
                :key="i"
                @click="form.prompt = suggestion"
                class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium transition-colors"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Số lượng bài</label>
              <select v-model="form.targetCount" class="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 text-sm text-slate-700 bg-white">
                <option value="10">10 bài</option>
                <option value="15">15 bài</option>
                <option value="20">20 bài (Mặc định)</option>
                <option value="30">30 bài</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">User ID (Tùy chọn)</label>
              <input 
                type="number" 
                v-model="form.userId" 
                class="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 text-sm text-slate-700" 
                placeholder="Để trống = Cold-start"
              />
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6">
            <div class="flex items-center gap-3 shrink-0">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="form.useLLM" :disabled="!hasLLMKey" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" :class="{ 'opacity-50 cursor-not-allowed': !hasLLMKey }"></div>
              </label>
              <div>
                <span class="text-sm font-semibold text-slate-700 block">Dùng LLM (Gemini)</span>
                <span v-if="!hasLLMKey" class="text-[10px] text-rose-500">Chưa cấu hình API Key</span>
              </div>
            </div>
  
            <button class="flex-1 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white justify-center h-11 text-sm font-semibold rounded-xl whitespace-nowrap transition-colors flex items-center gap-2" @click="runAnalysis" :disabled="loading">
              <span v-if="loading" class="animate-spin"><MfIcon name="sync" size="16" /></span>
              <span>{{ loading ? 'Đang phân tích...' : 'Phân tích & tạo preview' }}</span>
            </button>
          </div>
        </div>

        <!-- Intent Result Card -->
        <div v-if="result" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative">
          <div v-if="loading" class="absolute inset-0 bg-white/60 flex items-center justify-center rounded-2xl z-10 backdrop-blur-sm">
            <div class="spinner border-4 border-indigo-100 border-l-indigo-600 rounded-full w-8 h-8 animate-spin"></div>
          </div>
          
          <h2 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <MfIcon name="psychology" class="text-indigo-600" /> Intent được nhận diện
          </h2>
          
          <div v-if="result.intent" class="flex flex-col gap-3">
            <div v-if="result.intent.mood" class="flex flex-col">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mood</span>
              <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-semibold w-fit border border-blue-100">{{ result.intent.mood }}</span>
            </div>
            <div v-if="result.intent.activity" class="flex flex-col">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Context/Activity</span>
              <span class="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-sm font-semibold w-fit border border-emerald-100">{{ result.intent.activity }}</span>
            </div>
            <div v-if="result.intent.market" class="flex flex-col">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Market</span>
              <span class="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg text-sm font-semibold w-fit border border-purple-100">{{ result.intent.market }}</span>
            </div>
            <div v-if="result.intent.genres?.length" class="flex flex-col">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Genres</span>
              <div class="flex flex-wrap gap-2">
                <span class="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-lg text-sm font-semibold" v-for="g in result.intent.genres" :key="g">{{ g }}</span>
              </div>
            </div>
            <div v-if="result.intent.artists?.length" class="flex flex-col">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Artists</span>
              <div class="flex flex-wrap gap-2">
                <span class="bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1 rounded-lg text-sm font-semibold" v-for="a in result.intent.artists" :key="a">{{ a }}</span>
              </div>
            </div>
            <div v-if="result.intent.energy" class="flex flex-col">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Energy</span>
              <span class="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-lg text-sm font-semibold w-fit">{{ result.intent.energy }}</span>
            </div>
          </div>
          <div v-else class="text-sm text-slate-500 italic text-center py-4">
            Không có dữ liệu intent rõ ràng
          </div>
        </div>
      </div>

      <!-- Right Column: Preview & Diagnostics -->
      <div class="lg:col-span-3 flex flex-col gap-6">
        <!-- Empty State -->
        <div v-if="!result && !loading" class="bg-white p-10 rounded-2xl border border-slate-200 text-center shadow-sm flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <MfIcon name="ai" size="64" class="text-slate-300 mb-4" />
          <h3 class="text-xl font-bold text-slate-700 mb-2">Nhập prompt để kiểm tra pipeline AI Playlist</h3>
          <p class="text-slate-500 max-w-md mx-auto">Hệ thống sẽ phân tích intent và tạo preview danh sách bài hát mà không lưu vào cơ sở dữ liệu.</p>
        </div>

        <template v-if="result || loading">
          <!-- Preview Songs -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
            <div v-if="loading" class="absolute inset-0 bg-white/50 z-20 backdrop-blur-[1px]"></div>
            
            <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MfIcon name="queue_music" class="text-indigo-600" /> Preview danh sách
              </h2>
              <span class="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                {{ result?.items?.length || 0 }} / {{ form.targetCount }} bài
              </span>
            </div>
            
            <AdminTableShell :loading="false" :empty="!result?.items?.length && !loading" emptyTitle="Không có bài hát" emptySubtitle="Không tìm thấy bài hát nào phù hợp với Intent.">
              <div class="max-h-[500px] overflow-y-auto">
                <table class="w-full text-left border-collapse">
                  <thead class="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <tr class="text-xs text-slate-500 uppercase tracking-wider">
                      <th class="p-3 font-semibold text-center w-12">#</th>
                      <th class="p-3 font-semibold w-14">Ảnh</th>
                      <th class="p-3 font-semibold min-w-[200px]">Bài hát & Nghệ sĩ</th>
                      <th class="p-3 font-semibold w-24">Chiến lược</th>
                      <th class="p-3 font-semibold min-w-[200px]">Lý do</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(item, idx) in result?.items" :key="item.song_id" class="hover:bg-slate-50/80 transition-colors">
                      <td class="p-3 text-center text-sm font-medium text-slate-400">{{ idx + 1 }}</td>
                      <td class="p-3">
                        <img v-if="item.cover_url" :src="item.cover_url" class="w-10 h-10 rounded-lg object-cover shadow-sm" alt="" />
                        <div v-else class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <MfIcon name="music_note" class="text-slate-400" size="18" />
                        </div>
                      </td>
                      <td class="p-3">
                        <div class="font-bold text-slate-900 text-sm hover:text-indigo-600 cursor-pointer truncate max-w-[250px]" @click="goToSong(item.song_id)" :title="item.title">
                          {{ item.title }}
                        </div>
                        <div class="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]" :title="item.artist_name">
                          <span 
                            v-if="item.artist_id" 
                            class="hover:text-indigo-600 hover:underline cursor-pointer" 
                            @click="goToArtist(item.artist_id)"
                          >{{ item.artist_name }}</span>
                          <span v-else>{{ item.artist_name || 'Unknown' }}</span>
                        </div>
                      </td>
                      <td class="p-3">
                        <span class="inline-block px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                          {{ item.strategy }}
                        </span>
                      </td>
                      <td class="p-3 text-xs text-slate-600 leading-snug truncate max-w-[250px]" :title="item.reason">
                        {{ item.reason }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </AdminTableShell>
          </div>

          <!-- Diagnostics -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <button class="w-full p-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors text-left focus:outline-none" @click="showDiagnostics = !showDiagnostics">
              <h2 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                <MfIcon name="terminal" class="text-slate-500" size="18" /> Dữ liệu kỹ thuật (Diagnostics)
              </h2>
              <MfIcon :name="showDiagnostics ? 'expand_less' : 'expand_more'" class="text-slate-400" />
            </button>
            
            <div v-show="showDiagnostics" class="p-4 border-t border-slate-200 bg-slate-900 text-slate-300 font-mono text-xs overflow-x-auto relative rounded-b-2xl max-h-[300px] overflow-y-auto">
              <button class="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors flex items-center justify-center" @click="copyDiagnostics" title="Copy JSON">
                <MfIcon name="copy" size="16" />
              </button>
              <pre class="m-0 whitespace-pre-wrap">{{ JSON.stringify(result?.diagnostics, null, 2) }}</pre>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog 
      :open="confirmClearState.open"
      :title="confirmClearState.title"
      :message="confirmClearState.message"
      :confirmText="confirmClearState.confirmText"
      :type="confirmClearState.type"
      @confirm="handleClearConfirm"
      @cancel="confirmClearState.open = false"
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
import AdminTableShell from '@/components/admin/AdminTableShell.vue'

const router = useRouter()
const toast = useToastStore()

const loading = ref(false)
const result = ref(null)
const showDiagnostics = ref(false)
const hasLLMKey = ref(true)

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
  if (!result.value && form.prompt === '') return
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
