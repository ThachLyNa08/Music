<template>
  <div class="p-6 md:p-8 bg-gray-50 dark:bg-bg-base min-h-screen text-gray-800 dark:text-text-base font-sans">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Quản lý Nghệ sĩ</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Quản lý danh sách ca sĩ, band nhạc và các nghệ sĩ trên hệ thống</p>
      </div>
      <button @click="openAddModal" class="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Thêm nghệ sĩ mới
      </button>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="relative flex-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
          <circle cx="11" cy="11" r="8" />
          <path stroke-linecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input v-model="searchQuery" type="text" placeholder="Tìm theo tên nghệ sĩ..." class="w-full pl-11 pr-4 py-3 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow shadow-sm" />
      </div>
      <div class="w-full md:w-64">
        <select v-model="filterRegion" class="w-full px-4 py-3 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm appearance-none cursor-pointer">
          <option value="">Tất cả khu vực/thế hệ</option>
          <option v-for="r in regionsList" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl shadow-sm overflow-hidden">
      <div v-if="loading" class="p-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <div class="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
        <p class="font-medium text-sm">Đang tải danh sách nghệ sĩ...</p>
      </div>

      <div v-else-if="paginatedArtists.length === 0" class="p-16 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
        <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-1">Không tìm thấy nghệ sĩ nào</h3>
        <p class="text-sm dark:text-text-secondary">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50/50 dark:bg-bg-card/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-100 dark:border-bg-border">
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
                <div class="flex items-center gap-4 max-w-[300px]">
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
                {{ formatNumber(artist.total_plays) }}
              </td>
              <td class="py-4 px-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openViewModal(artist)" class="p-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors focus:outline-none" title="Xem chi tiết & Danh sách bài hát">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                  </button>
                  <button @click="openEditModal(artist)" class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors focus:outline-none" title="Chỉnh sửa">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                  </button>
                  <button @click="confirmDelete(artist)" class="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors focus:outline-none" title="Xóa nghệ sĩ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Hiển thị {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredArtists.length) }} trong {{ filteredArtists.length }} nghệ sĩ</span>
        <div class="flex gap-1">
          <button @click="prevPage" :disabled="currentPage === 1" class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <button v-for="p in visiblePages" :key="p" @click="goToPage(p)" :class="['px-3 py-1.5 rounded-lg text-sm font-bold transition-colors focus:outline-none', p === currentPage ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-bg-card border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800']">
            {{ p }}
          </button>
          <button @click="nextPage" :disabled="currentPage === totalPages" class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Slide-over Modal (Edit/Add/View) -->
    <Teleport to="body">
      <div v-if="isSlideOverOpen" class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900 bg-opacity-40 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
        <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div class="pointer-events-auto w-screen max-w-md md:max-w-xl transform transition duration-500 ease-in-out" :class="isSlideOverOpen ? 'translate-x-0' : 'translate-x-full'">
            <div class="flex h-full flex-col divide-y divide-gray-100 dark:divide-bg-border bg-white dark:bg-bg-surface shadow-2xl rounded-l-3xl overflow-hidden">
              <div class="flex min-h-0 flex-1 flex-col overflow-y-scroll py-6 px-6 sm:px-8">
                <div class="flex items-center justify-between mb-6">
                  <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white" id="slide-over-title">
                    <span v-if="mode === 'view'">Chi tiết Nghệ sĩ</span>
                    <span v-else-if="mode === 'edit'">Chỉnh sửa Nghệ sĩ</span>
                    <span v-else>Thêm Nghệ sĩ Mới</span>
                  </h2>
                  <button type="button" class="rounded-full p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none transition-colors" @click="closeModal">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
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
                      <svg v-if="!form.avatar" class="w-8 h-8 text-emerald-300 dark:text-emerald-500/50 group-hover:text-emerald-500 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
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
              <div v-if="mode !== 'view'" class="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-surface">
                <button type="button" @click="closeModal" class="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none shadow-sm">Hủy</button>
                <button type="button" @click="$refs.submitBtn.click()" :disabled="saving" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
                  <div v-if="saving" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  {{ saving ? 'Đang lưu...' : 'Lưu thông tin' }}
                </button>
              </div>
              <div v-else class="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-surface">
                 <button type="button" @click="closeModal" class="px-5 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none shadow-sm">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api/axios'

// State
const loading = ref(true)
const artists = ref([])
const searchQuery = ref('')
const filterRegion = ref('')

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

onMounted(() => {
  fetchArtists()
})

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

  return result
})

const totalPages = computed(() => Math.ceil(filteredArtists.value.length / pageSize.value) || 1)

const paginatedArtists = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredArtists.value.slice(start, start + pageSize.value)
})

const visiblePages = computed(() => {
  const pages = []
  for (let i = 1; i <= totalPages.value; i++) {
    if (i === 1 || i === totalPages.value || Math.abs(i - currentPage.value) <= 2) {
      pages.push(i)
    }
  }
  return [...new Set(pages)].sort((a,b)=>a-b)
})

function goToPage(p) { currentPage.value = p }
function prevPage() { if (currentPage.value > 1) currentPage.value-- }
function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++ }

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

async function confirmDelete(artist) {
  if (artist.song_count > 0) {
    alert(`Không thể xóa ${artist.name} vì nghệ sĩ này đang có ${artist.song_count} bài hát. Vui lòng xóa bài hát trước!`)
    return
  }

  if (confirm(`Bạn có chắc chắn muốn xóa nghệ sĩ "${artist.name}" khỏi hệ thống? Dữ liệu không thể khôi phục.`)) {
    try {
      await api.delete(`/admin/artists/${artist.id}`)
      fetchArtists()
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa nghệ sĩ này')
    }
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num || 0)
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
    case 'KPOP': return 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400'
    case 'VPOP': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    case 'US-UK': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}
</script>
