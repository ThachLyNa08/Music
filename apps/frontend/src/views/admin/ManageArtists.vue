<template>
  <div class="p-6 md:p-8 bg-gray-50 dark:bg-bg-base min-h-screen text-gray-800 dark:text-text-base font-sans">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Quản lý Nghệ sĩ</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Quản lý danh sách ca sĩ, band nhạc và các nghệ sĩ trên hệ thống</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <AdminAddButton title="Thêm nghệ sĩ mới" @click="openAddModal" />
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="relative flex-1">
        <MfIcon name="search" size="20" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input v-model="searchQuery" type="text" placeholder="Tìm theo tên nghệ sĩ..." class="w-full pl-11 pr-4 py-3 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow shadow-sm" />
      </div>
      <div class="w-full md:w-48">
        <select v-model="filterMainGenre" class="w-full px-4 py-3 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="">Tất cả thể loại</option>
          <option value="unclassified">Chưa phân loại</option>
          <option v-for="g in mainGenresList" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div class="w-full md:w-48">
        <select v-model="filterSongCount" class="w-full px-4 py-3 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="all">Tất cả bài hát</option>
          <option value="0">Chưa có bài hát</option>
          <option value="1-10">1 - 10 bài</option>
          <option value="11-50">11 - 50 bài</option>
          <option value=">50">Trên 50 bài</option>
        </select>
      </div>
      <div class="w-full md:w-48">
        <select v-model="filterRegion" class="w-full px-4 py-3 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="">Tất cả khu vực</option>
          <option v-for="r in regionsList" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <AdminResetButton :disabled="loading" @click="resetFilters" />
    </div>

    <!-- Data Table -->
    <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl shadow-sm overflow-hidden">
      <div v-if="loading" class="p-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <div class="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
        <p class="font-medium text-sm">Đang tải danh sách nghệ sĩ...</p>
      </div>

      <div v-else-if="paginatedArtists.length === 0" class="p-16 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <MfIcon name="person_off" size="64" className="mb-4 text-gray-300 dark:text-gray-600" />
        <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-1">Không tìm thấy nghệ sĩ nào</h3>
        <p class="text-sm dark:text-text-secondary">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50/50 dark:bg-bg-card/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-100 dark:border-bg-border">
              <th class="py-4 px-6">Metadata</th>
              <th class="py-4 px-6">Nghệ sĩ</th>
              <th class="py-4 px-6">Khu vực / Thế hệ</th>
              <th class="py-4 px-6 text-center">Số bài hát</th>
              <th class="py-4 px-6 text-center">Tổng lượt nghe</th>
              <th class="py-4 px-6 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr v-for="artist in paginatedArtists" :key="artist.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
              <td class="py-4 px-6">
                <div class="flex flex-wrap gap-1.5 max-w-[260px]">
                  <span v-for="issue in getArtistMetadataIssues(artist)" :key="issue.key" :class="['inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', issue.class]">
                    {{ issue.label }}
                  </span>
                  <span v-if="getArtistMetadataIssues(artist).length === 0" class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Đủ dữ liệu
                  </span>
                </div>
              </td>
              <td class="py-4 px-6">
                <div @click="goToDetail(artist.id)" class="flex items-center gap-4 max-w-[300px] cursor-pointer hover:opacity-80">
                  <img :src="formatAvatarUrl(artist.avatar_url)" @error="handleImageError" class="w-12 h-12 rounded-full object-cover shadow-sm group-hover:shadow transition-shadow border-2 border-white dark:border-gray-800" />
                  <div class="flex flex-col overflow-hidden">
                    <span class="font-bold text-gray-900 dark:text-white truncate" :title="artist.name">{{ artist.name }}</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500 font-medium truncate" :title="artist.bio">{{ artist.bio || 'Chưa có tiểu sử' }}</span>
                  </div>
                </div>
              </td>
              <td class="py-4 px-6">
                <span :class="['inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold', getRegionBadgeClass(artist.region)]">
                  {{ artist.region || 'Khác' }}
                </span>
              </td>
              <td class="py-4 px-6 text-center font-semibold text-gray-700 dark:text-gray-300">
                {{ artist.song_count }}
              </td>
              <td class="py-4 px-6 text-center font-semibold text-gray-700 dark:text-gray-300">
                {{ formatNumber(artist.total_plays ?? artist.totalPlays ?? 0) }}
              </td>
              <td class="py-4 px-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="goToDetail(artist.id)" class="p-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors focus:outline-none" title="Xem chi tiết & Danh sách bài hát">
                    <MfIcon name="visibility" size="20" />
                  </button>
                  <button @click="openEditModal(artist)" class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors focus:outline-none" title="Chỉnh sửa">
                    <MfIcon name="edit" size="20" />
                  </button>
                  <button @click="confirmDelete(artist)" class="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors focus:outline-none" title="Xóa nghệ sĩ">
                    <MfIcon name="delete" size="20" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium hidden md:inline">Hiển thị {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredArtists.length) }} trong {{ filteredArtists.length }} nghệ sĩ</span>
        <AdminPagination v-model:currentPage="currentPage" :totalPages="totalPages" />
      </div>
    </div>

    <!-- Centered Modal (Edit/Add/View) -->
    <Teleport to="body">
      <div v-if="isSlideOverOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
        
        <div class="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-bg-surface rounded-2xl shadow-2xl overflow-hidden transform transition-all">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/50">
            <h2 class="text-xl font-extrabold text-gray-900 dark:text-white" id="modal-title">
              <span v-if="mode === 'view'">Chi tiết Nghệ sĩ</span>
              <span v-else-if="mode === 'edit'">Chỉnh sửa Nghệ sĩ</span>
              <span v-else>Thêm Nghệ sĩ Mới</span>
            </h2>
            <button type="button" class="rounded-full p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 focus:outline-none transition-colors" @click="closeModal">
              <MfIcon name="close" size="24" />
            </button>
          </div>
          
          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-6 sm:px-8 custom-scrollbar">
                
                <!-- View Mode (Artist details + Songs) -->
                <div v-if="mode === 'view' && currentViewArtist" class="space-y-6">
                  <div class="flex items-center gap-6 pb-6 border-b border-gray-100 dark:border-bg-border">
                    <img :src="formatAvatarUrl(currentViewArtist.avatar_url)" @error="handleImageError" class="w-24 h-24 rounded-full object-cover shadow-md border-4 border-white dark:border-gray-800" />
                    <div>
                      <h3 class="text-2xl font-bold text-gray-900 dark:text-white">{{ currentViewArtist.name }}</h3>
                      <span :class="['inline-flex items-center px-2.5 py-1 mt-1 rounded-full text-xs font-bold', getRegionBadgeClass(currentViewArtist.region)]">
                        {{ currentViewArtist.region || 'Khác' }}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Tiểu sử</h4>
                    <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{{ currentViewArtist.bio || 'Chưa có thông tin tiểu sử về nghệ sĩ này.' }}</p>
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-3">
                      <h4 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Danh sách Bài hát ({{ currentViewArtistSongs.length }})</h4>
                    </div>
                    
                    <div v-if="loadingSongs" class="py-8 flex justify-center">
                      <div class="w-8 h-8 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                    
                    <div v-else-if="currentViewArtistSongs.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400 text-sm bg-gray-50 dark:bg-bg-card rounded-xl">
                      Nghệ sĩ này hiện chưa có bài hát nào trên hệ thống.
                    </div>
                    
                    <div v-else class="space-y-3">
                      <div v-for="(song, idx) in currentViewArtistSongs" :key="song.id" class="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-bg-card dark:hover:bg-gray-800 transition-colors">
                        <span class="text-gray-400 dark:text-gray-500 font-bold w-4 text-right text-sm">{{ idx + 1 }}</span>
                        <img :src="$formatImageUrl(song.cover_url)" @error="event => event.target.src = '/default-cover.png'" class="w-10 h-10 rounded-lg object-cover shadow-sm" />
                        <div class="flex-1 min-w-0">
                          <p class="font-bold text-gray-900 dark:text-white text-sm truncate" :title="song.title">{{ song.title }}</p>
                          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                            <RouterLink v-if="song.album_id" :to="'/album/' + song.album_id" class="text-gray-500 hover:text-white hover:underline no-underline" @click.stop>{{ song.album }}</RouterLink>
                            <span v-else>{{ song.album || 'Độc lập' }}</span> 
                            • {{ formatNumber(song.play_count) }} lượt nghe
                          </p>
                        </div>
                        <span v-if="!song.is_active" class="px-2 py-1 text-[10px] font-bold bg-rose-50 text-rose-600 rounded uppercase">Đã ẩn</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Edit / Add Mode (Form) -->
                <form v-else @submit.prevent="submitForm" class="space-y-5 h-full flex flex-col">
                  <!-- Name -->
                  <div>
                    <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Tên nghệ sĩ <span class="text-rose-500">*</span></label>
                    <input v-model="form.name" type="text" required placeholder="Nhập tên nghệ sĩ hoặc nhóm nhạc" class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" />
                  </div>

                  <!-- Region -->
                  <div>
                    <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Khu vực / Thế hệ <span class="text-rose-500">*</span></label>
                    <select v-model="form.region" required class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm appearance-none cursor-pointer">
                      <option v-for="r in regionsList" :key="r" :value="r">{{ r }}</option>
                    </select>
                  </div>

                  <!-- Bio -->
                  <div>
                    <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Tiểu sử</label>
                    <textarea v-model="form.bio" rows="4" placeholder="Vài nét về nghệ sĩ này..." class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm resize-none"></textarea>
                  </div>

                  <!-- Avatar Upload -->
                  <div>
                    <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Ảnh đại diện (Avatar)</label>
                    <div @click="$refs.avatarInput.click()" class="border-2 border-dashed border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400 transition-colors group" :class="{ 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30': form.avatar }">
                      <input type="file" ref="avatarInput" accept="image/*" @change="handleAvatar" hidden />
                      <MfIcon v-if="!form.avatar" name="account_circle" size="32" className="text-emerald-300 dark:text-emerald-500/50 group-hover:text-emerald-500 mb-2 transition-colors" />
                      <span v-if="!form.avatar" class="text-xs font-semibold text-gray-500 dark:text-gray-400">{{ mode === 'edit' ? 'Tải lên ảnh mới để thay thế' : 'Click để chọn JPG/PNG' }}</span>
                      <span v-else class="text-sm font-bold text-teal-600 dark:text-teal-400 text-center break-all">🖼️ {{ form.avatar.name }}</span>
                    </div>
                  </div>

                  <div v-if="statusMessage" :class="['p-3 rounded-xl text-sm font-bold text-center mt-auto', isError ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400']">
                    {{ statusMessage }}
                  </div>
                  
                  <button type="submit" hidden ref="submitBtn"></button>
                </form>
              </div>
              <div v-if="mode !== 'view'" class="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/50">
                <button type="button" @click="closeModal" class="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none shadow-sm">Hủy</button>
                <button type="button" @click="$refs.submitBtn.click()" :disabled="saving" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
                  <div v-if="saving" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  {{ saving ? 'Đang lưu...' : 'Lưu thông tin' }}
                </button>
              </div>
              <div v-else class="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/50">
                 <button type="button" @click="closeModal" class="px-5 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none shadow-sm">Đóng</button>
              </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Delete Modal -->
    <Teleport to="body">
      <div v-if="deleteModalOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm transition-opacity" @click="closeDeleteModal"></div>
        <div class="relative w-full max-w-md flex flex-col bg-white dark:bg-bg-surface rounded-2xl shadow-2xl overflow-hidden transform transition-all p-6 text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 dark:bg-rose-900/30 mb-4">
            <MfIcon name="warning" size="32" className="text-rose-600 dark:text-rose-400" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3" id="modal-title">Xác nhận xóa nghệ sĩ</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Bạn có chắc chắn muốn xóa nghệ sĩ "<span class="font-bold text-gray-800 dark:text-gray-200">{{ artistToDelete?.name }}</span>" khỏi hệ thống? Dữ liệu không thể khôi phục.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center w-full">
            <button type="button" class="w-full sm:w-1/2 inline-flex justify-center rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-bg-card text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none transition-colors shadow-sm" @click="closeDeleteModal">
              Hủy bỏ
            </button>
            <button type="button" class="w-full sm:w-1/2 inline-flex justify-center items-center rounded-xl border border-transparent px-4 py-3 bg-rose-600 text-sm font-bold text-white shadow-sm hover:bg-rose-700 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" @click="executeDelete" :disabled="deleting">
              <div v-if="deleting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              {{ deleting ? 'Đang xóa...' : 'Xóa nghệ sĩ' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'
import AdminAddButton from '@/components/admin/AdminAddButton.vue'
import MfIcon from '@/components/common/MfIcon.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'

const router = useRouter()
const route = useRoute()
const toastStore = useToastStore()

// State
const loading = ref(true)
const artists = ref([])
const searchQuery = ref('')
const filterRegion = ref('')
const filterMainGenre = ref('')
const filterSongCount = ref('all')
const syncingMissing = ref(false)
const syncingMissingBioState = ref(false)
const syncingArtistId = ref(null)
const syncingBioArtistId = ref(null)

const regionsList = [
  'VPOP', 'KPOP', 'US-UK', 'Khác'
]

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Modal State
const isSlideOverOpen = ref(false)
const mode = ref('view') // 'view', 'edit', 'add'
const selectedArtistId = ref(null)
const saving = ref(false)
const statusMessage = ref('')
const isError = ref(false)

// Delete Modal State
const deleteModalOpen = ref(false)
const artistToDelete = ref(null)
const deleting = ref(false)

// View State
const currentViewArtist = ref(null)
const currentViewArtistSongs = ref([])
const loadingSongs = ref(false)

const form = reactive({
  name: '',
  bio: '',
  region: 'Khác',
  avatar: null
})

// Fetch Data
async function fetchArtists() {
  loading.value = true
  try {
    const res = await api.get('/admin/artists')
    artists.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải danh sách nghệ sĩ:', err)
  } finally {
    loading.value = false
  }
}

async function syncArtistMetadata(artist) {
  if (!artist?.id || syncingArtistId.value) return

  syncingArtistId.value = artist.id
  try {
    const res = await api.post(`/admin/artists/${artist.id}/sync-metadata`)
    if (!res.data?.success) {
      alert(res.data?.message || 'Không thể đồng bộ thông tin nghệ sĩ')
    }
    await fetchArtists()
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể đồng bộ thông tin nghệ sĩ')
  } finally {
    syncingArtistId.value = null
  }
}

async function syncMissingMetadata() {
  if (syncingMissing.value) return

  syncingMissing.value = true
  try {
    const res = await api.post('/admin/artists/sync-missing-metadata', { limit: 10 })
    const data = res.data || {}
    alert(`Đã xử lý ${data.processed || 0} nghệ sĩ. Thành công: ${data.succeeded || 0}, lỗi: ${data.failed || 0}.`)
    await fetchArtists()
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể đồng bộ metadata nghệ sĩ')
  } finally {
    syncingMissing.value = false
  }
}

async function syncMissingBio() {
  if (syncingMissingBioState.value) return

  syncingMissingBioState.value = true
  try {
    const res = await api.post('/admin/artists/sync-missing-bio', { limit: 20 })
    const data = res.data || {}
    alert(`Đã xử lý xong. Thành công: ${data.synced || 0}, lỗi: ${data.failed || 0}, bỏ qua: ${data.skipped || 0}.`)
    await fetchArtists()
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể đồng bộ bio nghệ sĩ')
  } finally {
    syncingMissingBioState.value = false
  }
}

async function syncArtistBio(artist) {
  if (!artist?.id || syncingBioArtistId.value) return

  syncingBioArtistId.value = artist.id
  try {
    const res = await api.post(`/admin/artists/${artist.id}/sync-bio`)
    if (!res.data?.success) {
      alert(res.data?.message || 'Không thể đồng bộ bio nghệ sĩ')
    } else {
      alert(res.data.message || 'Đồng bộ bio thành công')
    }
    await fetchArtists()
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể đồng bộ bio nghệ sĩ')
  } finally {
    syncingBioArtistId.value = null
  }
}

onMounted(async () => {
  await fetchArtists()
  
  if (route.query.edit) {
    const editId = parseInt(route.query.edit)
    let artistToEdit = artists.value.find(a => a.id === editId)
    
    if (!artistToEdit) {
      try {
        const res = await api.get(`/admin/artists/${editId}`)
        if (res.data?.success) {
          artistToEdit = res.data.data
        }
      } catch (e) {
        console.error('Không thể lấy chi tiết nghệ sĩ để sửa:', e)
      }
    }

    if (artistToEdit) {
      if (artistToEdit.id === undefined && artistToEdit.artist?.id) {
         artistToEdit = artistToEdit.artist
      }
      openEditModal(artistToEdit)
    }
    router.replace({ path: '/admin/artists' })
  }
})

// Extract dynamic list of genres
const mainGenresList = computed(() => {
  const genres = new Set()
  artists.value.forEach(a => {
    if (a.main_genre) genres.add(a.main_genre)
  })
  return Array.from(genres).sort()
})

// Watch filters to reset page
watch([searchQuery, filterRegion, filterMainGenre, filterSongCount], () => {
  currentPage.value = 1
})

function resetFilters() {
  searchQuery.value = ''
  filterRegion.value = ''
  filterMainGenre.value = ''
  filterSongCount.value = 'all'
  currentPage.value = 1
}

// Computed Filters & Pagination
const filteredArtists = computed(() => {
  let result = artists.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(artist => 
      artist.name.toLowerCase().includes(q)
    )
  }

  if (filterRegion.value) {
    result = result.filter(artist => artist.region === filterRegion.value)
  }

  if (filterMainGenre.value) {
    if (filterMainGenre.value === 'unclassified') {
      result = result.filter(artist => !artist.main_genre)
    } else {
      result = result.filter(artist => artist.main_genre === filterMainGenre.value)
    }
  }

  if (filterSongCount.value !== 'all') {
    result = result.filter(artist => {
      const c = artist.song_count || 0
      if (filterSongCount.value === '0') return c === 0
      if (filterSongCount.value === '1-10') return c >= 1 && c <= 10
      if (filterSongCount.value === '11-50') return c >= 11 && c <= 50
      if (filterSongCount.value === '>50') return c > 50
      return true
    })
  }

  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredArtists.value.length / pageSize.value)))

watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) {
    currentPage.value = newTotal
  }
})

const paginatedArtists = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredArtists.value.slice(start, start + pageSize.value)
})



function goToDetail(id) {
  router.push({ name: 'AdminArtistDetail', params: { id } })
}

// Modal Logic
function openAddModal() {
  mode.value = 'add'
  selectedArtistId.value = null
  resetForm()
  isSlideOverOpen.value = true
}

function openEditModal(artist) {
  mode.value = 'edit'
  selectedArtistId.value = artist.id
  form.name = artist.name
  form.bio = artist.bio || ''
  form.region = artist.region || 'Khác'
  form.avatar = null
  statusMessage.value = ''
  isError.value = false
  isSlideOverOpen.value = true
}

async function openViewModal(artist) {
  mode.value = 'view'
  currentViewArtist.value = artist
  currentViewArtistSongs.value = []
  isSlideOverOpen.value = true

  try {
    const res = await api.get(`/admin/artists/${artist.id}`)

    console.log('Artist detail response:', res.data)

    currentViewArtist.value = res.data.data
    currentViewArtistSongs.value = res.data.data?.songs || []
  } catch (error) {
    console.error('Lỗi khi tải chi tiết nghệ sĩ:', error)

    currentViewArtist.value = artist
    currentViewArtistSongs.value = []
  }
}

function closeModal() {
  isSlideOverOpen.value = false
}

function resetForm() {
  form.name = ''
  form.bio = ''
  form.region = 'Khác'
  form.avatar = null
  statusMessage.value = ''
  isError.value = false
}

function handleAvatar(e) {
  if (e.target.files.length) form.avatar = e.target.files[0]
}

async function submitForm() {
  if (!form.name) return

  saving.value = true
  statusMessage.value = ''

  const formData = new FormData()
  formData.append('name', form.name)
  formData.append('bio', form.bio)
  formData.append('region', form.region)
  if (form.avatar) formData.append('avatar', form.avatar)

  try {
    if (mode.value === 'edit') {
      await api.put(`/admin/artists/${selectedArtistId.value}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      statusMessage.value = 'Đã cập nhật nghệ sĩ thành công!'
    } else {
      await api.post('/admin/artists', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      statusMessage.value = 'Đã thêm nghệ sĩ mới!'
    }
    
    isError.value = false
    fetchArtists() // Reload list
    
    setTimeout(() => {
      closeModal()
    }, 1000)
    
  } catch (err) {
    statusMessage.value = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu.'
    isError.value = true
  } finally {
    saving.value = false
  }
}

function confirmDelete(artist) {
  if (artist.song_count > 0) {
    alert(`Không thể xóa ${artist.name} vì nghệ sĩ này đang có ${artist.song_count} bài hát. Vui lòng xóa bài hát trước!`)
    return
  }
  artistToDelete.value = artist
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  artistToDelete.value = null
}

async function executeDelete() {
  if (!artistToDelete.value) return
  deleting.value = true
  try {
    await api.delete(`/admin/artists/${artistToDelete.value.id}`)
    fetchArtists()
    closeDeleteModal()
    toastStore.showToast('Đã xóa nghệ sĩ thành công', 'success')
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể xóa nghệ sĩ này')
  } finally {
    deleting.value = false
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num || 0)
}

function getArtistMetadataIssues(artist) {
  const issues = []
  if (artist.missing_avatar || !artist.avatar_url) {
    issues.push({ key: 'avatar', label: 'Thiếu avatar', class: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' })
  }
  if (artist.missing_bio || (!artist.bio && !artist.short_bio)) {
    issues.push({ key: 'bio', label: 'Thiếu bio', class: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' })
  }
  if (artist.missing_spotify_id || !artist.spotify_artist_id) {
    issues.push({ key: 'spotify', label: 'Thiếu Spotify ID', class: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' })
  }
  return issues
}

function handleImageError(e) {
  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80'
}

function formatAvatarUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80'
  return url.startsWith('http') ? url : `http://localhost:3000${url}`
}

function getRegionBadgeClass(region) {
  switch (region) {
    case 'KPOP': return 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400'
    case 'VPOP': return 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400'
    case 'US-UK': 
    case 'USUK': return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}
</script>
