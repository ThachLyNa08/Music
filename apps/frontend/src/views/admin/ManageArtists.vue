<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10">
    <!-- Header -->
    <header class="sticky -top-6 z-30 py-6 bg-white dark:bg-bg-surface border-b border-gray-100 dark:border-bg-border flex flex-col md:flex-row justify-between items-start md:items-center px-6 shrink-0 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Quản lý Nghệ sĩ</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Quản lý danh sách ca sĩ, band nhạc và các nghệ sĩ trên hệ thống</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <AdminExportButton :loading="exportLoading" @click="handleExport" />
        <AdminAddButton title="Thêm nghệ sĩ mới" @click="openAddModal" />
      </div>
    </header>

    <div class="p-6 flex flex-col space-y-5">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 shrink-0">
        <AdminKpiCard
          v-for="item in artistKpiCards"
          :key="item.title"
          v-bind="item"
          :loading="summaryLoading"
          :show-icon="false"
          compact
        />
      </div>

      <!-- Filters & Search -->
    <AdminFilterBar>
      <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
        <div class="relative flex-1 min-w-[200px]">
          <MfIcon name="search" size="20" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input 
            v-model="searchQuery" 
            @keyup.enter="handleEnter"
            @focus="showHistory = true"
            @blur="handleBlur"
            type="text" 
            placeholder="Tìm theo tên nghệ sĩ..." 
            class="admin-input pl-11 pr-10 w-full" 
          />
        <button v-if="searchQuery" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <MfIcon name="close" size="18" />
        </button>
        <div v-if="showHistory && searchHistory.length > 0" class="absolute z-50 w-full mt-1 bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl shadow-lg overflow-hidden">
          <div class="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-bg-card border-b border-gray-100 dark:border-bg-border flex justify-between">
            Lịch sử tìm kiếm
          </div>
          <ul>
            <li v-for="item in searchHistory" :key="item" class="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-bg-card cursor-pointer group transition-colors" @mousedown.prevent="selectHistoryItem(item)">
              <span class="text-sm text-gray-700 dark:text-gray-200 flex-1 truncate font-medium"><MfIcon name="history" size="16" class="inline align-text-bottom mr-2 text-gray-400" /> {{ item }}</span>
              <button @mousedown.prevent.stop="removeHistoryItem(item)" class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition-all">
                <MfIcon name="close" size="16" />
              </button>
            </li>
          </ul>
        </div>
        </div>
        <div class="relative w-full xl:w-48 xl:shrink-0" ref="genreDropdownRef">
          <div class="relative cursor-pointer" @click="genreDropdownOpen = true">
            <input 
              v-model="genreSearchText" 
              @focus="genreDropdownOpen = true"
              placeholder="Tất cả thể loại" 
              class="admin-input pr-8 cursor-pointer text-sm w-full" 
              :class="{ 'text-emerald-600 font-bold': filterMainGenre !== '' }"
            />
            <MfIcon name="expand_more" size="20" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform duration-200" :class="{ 'rotate-180': genreDropdownOpen }" />
          </div>
        
        <div v-if="genreDropdownOpen" class="absolute z-50 w-full mt-1 bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl shadow-lg overflow-hidden flex flex-col">
          <ul class="max-h-[160px] overflow-y-auto custom-scrollbar py-1">
            <li 
              class="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-bg-card cursor-pointer transition-colors" 
              :class="{ 'font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400': filterMainGenre === '' }"
              @click="selectGenre('')"
            >
              Tất cả thể loại
            </li>
            <li 
              class="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-bg-card cursor-pointer transition-colors" 
              :class="{ 'font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400': filterMainGenre === 'unclassified' }"
              @click="selectGenre('unclassified')"
            >
              Chưa phân loại
            </li>
            <li 
              v-for="g in filteredGenresList" 
              :key="g"
              class="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-bg-card cursor-pointer transition-colors"
              :class="{ 'font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400': filterMainGenre === g }"
              @click="selectGenre(g)"
            >
              {{ g }}
            </li>
            <li v-if="filteredGenresList.length === 0" class="px-3 py-2 text-sm text-gray-400 italic text-center">
              Không tìm thấy
            </li>
          </ul>
        </div>
        </div>
        <div class="w-full xl:w-48 xl:shrink-0">
          <select v-model="filterSongCount" class="admin-input w-full cursor-pointer">
            <option value="all">Tất cả bài hát</option>
            <option value="0">Chưa có bài hát</option>
            <option value="1-10">1 - 10 bài</option>
            <option value="11-50">11 - 50 bài</option>
            <option value=">50">Trên 50 bài</option>
          </select>
        </div>
        <div class="w-full xl:w-48 xl:shrink-0">
          <select v-model="filterRegion" class="admin-input w-full cursor-pointer">
            <option value="">Tất cả khu vực</option>
            <option v-for="r in regionsList" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <AdminResetButton :disabled="loading" @click="resetFilters" class="xl:shrink-0" />
      </div>
    </AdminFilterBar>

    <!-- Data Table and Pagination Wrapper -->
    <div class="flex flex-col gap-3">
      <AdminTableShell 
        maxHeight="442px" 
        style="min-height: 442px;"
        :loading="loading" 
        :empty="!loading && paginatedArtists.length === 0" 
        emptyTitle="Không tìm thấy nghệ sĩ nào" 
        emptySubtitle="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
      >
        <table class="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr class="bg-gray-50 dark:bg-bg-card sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
                <th class="py-2.5 px-3 font-bold text-black dark:text-gray-300 w-48">Metadata</th>
                <th class="py-2.5 px-3 font-bold text-black dark:text-gray-300 min-w-[200px]">Nghệ sĩ</th>
                <th class="py-2.5 px-3 font-bold text-black dark:text-gray-300 text-center">Khu vực / Thế hệ</th>
                <th class="py-2.5 px-3 font-bold text-black dark:text-gray-300 text-center">Số bài hát</th>
                <th class="py-2.5 px-3 font-bold text-black dark:text-gray-300 text-center">Tổng lượt nghe</th>
                <th class="py-2.5 px-3 font-bold text-black dark:text-gray-300 text-right sticky right-0 bg-gray-50 dark:bg-bg-card w-24 z-30 shadow-[-1px_0_0_0_#e2e8f0] dark:shadow-[-1px_0_0_0_#334155]">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
              <tr v-for="artist in paginatedArtists" :key="artist.id" class="hover:bg-gray-50 dark:hover:bg-bg-card transition-colors group" :class="{ 'bg-emerald-50 dark:bg-emerald-500/10': route.query.focus == artist.id }">
                <td class="py-2.5 px-3">
                  <div class="flex flex-wrap gap-1.5 max-w-[260px]">
                    <span v-for="issue in getArtistMetadataIssues(artist)" :key="issue.key" :class="['inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', issue.class]">
                      {{ issue.label }}
                    </span>
                    <span v-if="getArtistMetadataIssues(artist).length === 0" class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Đủ dữ liệu
                    </span>
                  </div>
                </td>
                <td class="py-2.5 px-3">
                  <div @click="goToDetail(artist.id)" class="flex items-center gap-3 max-w-[300px] cursor-pointer hover:opacity-80">
                    <img :src="formatAvatarUrl(artist.avatar_url)" @error="handleImageError" class="w-9 h-9 rounded-full object-cover shadow-sm bg-gray-100" />
                    <div class="flex flex-col min-w-0">
                      <span class="font-bold text-gray-900 dark:text-white truncate" :title="artist.name">{{ artist.name }}</span>
                      <span class="text-xs text-gray-400 dark:text-gray-500 truncate" :title="artist.bio">{{ artist.bio || 'Chưa có tiểu sử' }}</span>
                    </div>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-center">
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase', getRegionBadgeClass(artist.region)]">
                    {{ artist.region || 'Khác' }}
                  </span>
                </td>
                <td class="py-2.5 px-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {{ artist.song_count }}
                </td>
                <td class="py-2.5 px-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {{ formatNumber(artist.total_plays ?? artist.totalPlays ?? 0) }}
                </td>
                <td class="py-2.5 px-3 text-right sticky right-0 z-10 bg-white dark:bg-bg-surface group-hover:bg-gray-50 dark:group-hover:bg-bg-card transition-colors shadow-[-1px_0_0_0_#f3f4f6] dark:shadow-[-1px_0_0_0_#1e293b]">
                  <div class="flex justify-end">
                    <AdminActionMenu :actions="getArtistActions(artist)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
      </AdminTableShell>

      <!-- Pagination -->
      <div class="flex items-center justify-between" v-if="totalPages > 1">
        <span class="text-sm text-slate-500 hidden md:block">Hiển thị {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredArtists.length) }} trong {{ filteredArtists.length }} nghệ sĩ</span>
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

    <ConfirmDialog 
      v-model:open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirmText="confirmState.confirmText"
      :type="confirmState.type"
      :loading="confirmState.loading"
      @confirm="handleConfirm"
    />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'
import AdminAddButton from '@/components/admin/AdminAddButton.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminExportButton from '@/components/admin/AdminExportButton.vue'
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const route = useRoute()
const toastStore = useToastStore()

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
})

function getArtistActions(artist) {
  return [
    {
      label: 'Xem chi tiết',
      icon: 'visibility',
      onClick: () => goToDetail(artist.id)
    },
    {
      label: 'Chỉnh sửa',
      icon: 'edit',
      onClick: () => openEditModal(artist)
    },
    {
      label: 'Xóa nghệ sĩ',
      icon: 'delete',
      danger: true,
      onClick: () => confirmDelete(artist)
    }
  ]
}

function openConfirm(options) {
  confirmState.value = { ...confirmState.value, ...options, open: true, loading: false }
}

async function handleConfirm() {
  if (!confirmState.value.action) return
  confirmState.value.loading = true
  try {
    await confirmState.value.action()
  } finally {
    confirmState.value.open = false
    confirmState.value.loading = false
  }
}

// State
const summary = ref({
  totalArtists: 0,
  artistsWithImage: 0,
  artistsMissingImage: 0,
  artistsWithBio: 0,
  artistsMissingBio: 0,
  artistsWithSongs: 0
})
const summaryLoading = ref(false)

const loading = ref(true)
const artists = ref([])
const searchQuery = ref('')
const searchHistory = ref(JSON.parse(localStorage.getItem('adminArtistsSearchHistory') || '[]'))
const showHistory = ref(false)
const filterRegion = ref('')
const filterMainGenre = ref('')
const filterSongCount = ref('all')
const syncingMissing = ref(false)
const syncingMissingBioState = ref(false)
const syncingArtistId = ref(null)
const syncingBioArtistId = ref(null)

const artistKpiCards = computed(() => [
  {
    title: 'Tổng nghệ sĩ',
    value: summary.value.totalArtists,
    subtitle: 'Trong thư viện',
    icon: 'users',
    tone: 'blue'
  },
  {
    title: 'Có ảnh',
    value: summary.value.artistsWithImage,
    subtitle: 'Đã có avatar/cover',
    icon: 'image',
    tone: 'green'
  },
  {
    title: 'Thiếu ảnh',
    value: summary.value.artistsMissingImage,
    subtitle: 'Cần bổ sung hình ảnh',
    icon: 'alert-triangle',
    tone: 'rose'
  },
  {
    title: 'Có tiểu sử',
    value: summary.value.artistsWithBio,
    subtitle: 'Đã có mô tả',
    icon: 'file-text',
    tone: 'purple'
  },
  {
    title: 'Thiếu tiểu sử',
    value: summary.value.artistsMissingBio,
    subtitle: 'Cần crawl/bổ sung',
    icon: 'edit',
    tone: 'amber'
  },
  {
    title: 'Có bài hát',
    value: summary.value.artistsWithSongs,
    subtitle: 'Đã gắn dữ liệu nhạc',
    icon: 'music',
    tone: 'cyan'
  }
])

const regionsList = [
  'VPOP', 'KPOP', 'US-UK', 'Khác'
]

// Pagination
const currentPage = ref(1)
const pageSize = ref(20)

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
async function fetchArtistSummary() {
  summaryLoading.value = true
  try {
    const res = await api.get('/admin/artists/summary')
    summary.value = res.data?.data || res.data || summary.value
  } catch (err) {
    console.error('Lỗi khi tải summary:', err)
  } finally {
    summaryLoading.value = false
  }
}

async function fetchArtists() {
  loading.value = true
  fetchArtistSummary()
  try {
    const res = await api.get('/admin/artists')
    artists.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải danh sách nghệ sĩ:', err)
  } finally {
    loading.value = false
  }
}

const exportLoading = ref(false)
async function handleExport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/artists/export', {
      params: {
        search: searchQuery.value,
        region: filterRegion.value
      },
      responseType: 'blob'
    })
    
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'musicflow-artists.csv'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    toastStore.showToast('Không thể xuất báo cáo. Vui lòng thử lại.', 'error')
  } finally {
    exportLoading.value = false
  }
}

async function syncArtistMetadata(artist) {
  if (!artist?.id || syncingArtistId.value) return

  syncingArtistId.value = artist.id
  try {
    const res = await api.post(`/admin/artists/${artist.id}/sync-metadata`)
    if (!res.data?.success) {
      toastStore.showToast(res.data?.message || 'Không thể đồng bộ thông tin nghệ sĩ', 'error')
    }
    await fetchArtists()
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Không thể đồng bộ thông tin nghệ sĩ', 'error')
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
    toastStore.showToast(`Đã xử lý ${data.processed || 0} nghệ sĩ. Thành công: ${data.succeeded || 0}, lỗi: ${data.failed || 0}.`, 'info')
    await fetchArtists()
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Không thể đồng bộ metadata nghệ sĩ', 'error')
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
    toastStore.showToast(`Đã xử lý xong. Thành công: ${data.synced || 0}, lỗi: ${data.failed || 0}, bỏ qua: ${data.skipped || 0}.`, 'info')
    await fetchArtists()
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Không thể đồng bộ bio nghệ sĩ', 'error')
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
      toastStore.showToast(res.data?.message || 'Không thể đồng bộ bio nghệ sĩ', 'error')
    } else {
      toastStore.showToast(res.data.message || 'Đồng bộ bio thành công', 'success')
    }
    await fetchArtists()
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Không thể đồng bộ bio nghệ sĩ', 'error')
  } finally {
    syncingBioArtistId.value = null
  }
}

onMounted(async () => {
  if (route.query.search) {
    searchQuery.value = route.query.search;
  }
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

const genreDropdownRef = ref(null)
const genreDropdownOpen = ref(false)
const genreSearchText = ref('')

onClickOutside(genreDropdownRef, () => {
  genreDropdownOpen.value = false
  if (filterMainGenre.value === '') genreSearchText.value = ''
  else if (filterMainGenre.value === 'unclassified') genreSearchText.value = 'Chưa phân loại'
  else genreSearchText.value = filterMainGenre.value
})

const filteredGenresList = computed(() => {
  if (!genreSearchText.value) return mainGenresList.value
  const query = genreSearchText.value.toLowerCase()
  if (
    (filterMainGenre.value === '' && query === '') ||
    (filterMainGenre.value === 'unclassified' && query === 'chưa phân loại') ||
    (filterMainGenre.value && filterMainGenre.value.toLowerCase() === query)
  ) {
    return mainGenresList.value
  }
  return mainGenresList.value.filter(g => g.toLowerCase().includes(query))
})

function selectGenre(val) {
  filterMainGenre.value = val
  if (val === '') genreSearchText.value = ''
  else if (val === 'unclassified') genreSearchText.value = 'Chưa phân loại'
  else genreSearchText.value = val
  genreDropdownOpen.value = false
}

// Watch filters to reset page
watch([searchQuery, filterRegion, filterMainGenre, filterSongCount], () => {
  currentPage.value = 1
})

function handleEnter() {
  const term = searchQuery.value.trim()
  if (term && !searchHistory.value.includes(term)) {
    searchHistory.value.unshift(term)
    if (searchHistory.value.length > 5) searchHistory.value.pop()
    localStorage.setItem('adminArtistsSearchHistory', JSON.stringify(searchHistory.value))
  }
  showHistory.value = false
}

function handleBlur() {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

function clearSearch() {
  searchQuery.value = ''
  showHistory.value = false
}

function selectHistoryItem(item) {
  searchQuery.value = item
  showHistory.value = false
  handleEnter()
}

function removeHistoryItem(item) {
  searchHistory.value = searchHistory.value.filter(i => i !== item)
  localStorage.setItem('adminArtistsSearchHistory', JSON.stringify(searchHistory.value))
}

function resetFilters() {
  searchQuery.value = ''
  filterRegion.value = ''
  filterMainGenre.value = ''
  genreSearchText.value = ''
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
    let successMsg = ''
    if (mode.value === 'edit') {
      await api.put(`/admin/artists/${selectedArtistId.value}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      successMsg = 'Đã cập nhật nghệ sĩ thành công!'
    } else {
      await api.post('/admin/artists', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      successMsg = 'Đã thêm nghệ sĩ mới!'
    }
    
    isError.value = false
    closeModal()
    
    // Show toast after modal closes
    setTimeout(() => {
      toastStore.showToast(successMsg, 'success')
    }, 300)
    
    fetchArtists() // Reload list
    
  } catch (err) {
    statusMessage.value = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu.'
    isError.value = true
  } finally {
    saving.value = false
  }
}

function confirmDelete(artist) {
  if (artist.song_count > 0) {
    toastStore.showToast(`Không thể xóa ${artist.name} vì nghệ sĩ này đang có ${artist.song_count} bài hát. Vui lòng xóa bài hát trước!`, 'warning')
    return
  }
  openConfirm({
    title: 'Xóa nghệ sĩ?',
    message: `Bạn có chắc chắn muốn xóa nghệ sĩ "${artist.name}" khỏi hệ thống? Dữ liệu không thể khôi phục.`,
    confirmText: 'Xóa nghệ sĩ',
    type: 'danger',
    action: async () => {
      try {
        await api.delete(`/admin/artists/${artist.id}`)
        fetchArtists()
        toastStore.showToast('Đã xóa nghệ sĩ thành công', 'success')
      } catch (err) {
        toastStore.showToast(err.response?.data?.message || 'Không thể xóa nghệ sĩ này', 'error')
      }
    }
  })
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
