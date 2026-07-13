<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10 font-sans text-gray-800 dark:text-text-base">
    <!-- Header -->
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur dark:bg-bg-card/95 border-b border-gray-200 dark:border-bg-border flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Duyệt nội dung nghệ sĩ</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Kiểm tra, nghe thử và phê duyệt các bài hát và album do nghệ sĩ gửi lên hệ thống.</p>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <button class="flex items-center gap-2 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border hover:bg-gray-50 dark:hover:bg-bg-surface text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm" @click="fetchReviews(1)">
          <MfIcon name="refresh" size="16" /> Làm mới
        </button>
      </div>
    </header>

    <div class="px-6 pt-4 border-b border-gray-200 dark:border-bg-border">
      <div class="flex gap-6 -mb-px">
        <button
          @click="currentTab = 'songs'"
          class="pb-3 text-sm font-bold border-b-2 transition-colors"
          :class="currentTab === 'songs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
        >
          Bài hát
        </button>
        <button
          @click="currentTab = 'albums'"
          class="pb-3 text-sm font-bold border-b-2 transition-colors"
          :class="currentTab === 'albums' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
        >
          Album
        </button>
      </div>
    </div>

    <div class="p-4 md:p-6 flex flex-col space-y-6">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-2">
        <AdminKpiCard
          title="Chờ duyệt"
          :value="activeStats.pendingCount ?? 0"
          icon="clock"
          tone="amber"
          :showIcon="true"
        />
        <AdminKpiCard
          title="Đã duyệt"
          :value="activeStats.approvedCount ?? 0"
          icon="check-circle"
          tone="green"
          :showIcon="true"
        />
        <AdminKpiCard
          title="Đã từ chối"
          :value="activeStats.rejectedCount ?? 0"
          icon="close"
          tone="rose"
          :showIcon="true"
        />
      </div>

      <!-- Filter Bar -->
      <AdminFilterBar class="!mb-3 !p-2">
        <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
          <div class="relative min-w-[320px] flex-1">
            <MfIcon name="search" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              type="text"
              placeholder="Tìm theo tên..."
              class="admin-input pl-8 pr-8 w-full !text-[13px] !py-1.5"
            />
            <button v-if="searchQuery" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
              <MfIcon name="close" size="14" />
            </button>
          </div>
          <select v-model="statusFilter" @change="handleSearch" class="admin-input w-full xl:w-48 xl:shrink-0 cursor-pointer !text-[13px] !py-1.5 !pl-3">
            <option value="all">Tất cả trạng thái</option>
            <option value="pending_review">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Bị từ chối</option>
          </select>
          <select v-model="sortOption" @change="handleSearch" class="admin-input w-full xl:w-44 xl:shrink-0 cursor-pointer !text-[13px] !py-1.5 !pl-3">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
      </AdminFilterBar>

      <div v-if="errorMsg" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {{ errorMsg }}
      </div>

      <!-- Table Songs -->
      <div v-if="currentTab === 'songs'" class="mb-8 flex flex-col !mt-2">
        <AdminTableShell
          maxHeight="400px"
          :loading="loading"
          :empty="!loading && songReviews.length === 0"
          emptyTitle="Không có bài hát nào cần duyệt."
          emptyDescription="Các bài hát do nghệ sĩ gửi lên sẽ xuất hiện tại đây."
        >
          <table class="w-full min-w-[900px] text-left border-collapse text-xs whitespace-nowrap table-fixed">
            <thead class="bg-gray-50 dark:bg-bg-card sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]">
              <tr class="text-black dark:text-white uppercase tracking-wider font-bold">
                <th class="py-2 px-3 w-[30%]">Bài hát</th>
                <th class="py-2 px-3 w-[20%]">Nghệ sĩ</th>
                <th class="py-2 px-3 w-[15%]">Thể loại / Album</th>
                <th class="py-2 px-3 w-[15%]">Ngày gửi</th>
                <th class="py-2 px-3 w-[10%] text-center">Trạng thái</th>
                <th class="py-2 px-3 w-[10%] text-right sticky right-0 bg-gray-50 dark:bg-bg-card z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
              <tr v-for="review in songReviews" :key="review.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
                <td class="py-2 px-3 max-w-0">
                  <div class="flex items-center gap-3">
                    <div class="relative w-10 h-10 shrink-0">
                      <img :src="normalizeImageUrl(review.coverUrl) || fallbackCover" @error="onImageError" loading="lazy" class="w-full h-full rounded-md object-cover shadow-sm bg-gray-100" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="font-bold text-gray-900 dark:text-white text-[13px] truncate" :title="review.title">{{ review.title }}</span>
                      <span class="text-[11px] text-gray-500 font-medium">{{ formatDuration(review.duration) }}</span>
                    </div>
                  </div>
                </td>
                <td class="py-2 px-3">
                  <div class="flex items-center" v-if="review.artist">
                    <span class="font-semibold text-gray-700 dark:text-gray-300 truncate">{{ review.artist.name }}</span>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="py-2 px-3">
                  <div class="flex flex-col">
                    <span class="font-semibold text-gray-700 dark:text-gray-300 truncate">{{ review.genre?.name || 'Không có' }}</span>
                    <span class="text-[11px] text-gray-500">{{ review.album?.title || 'Single' }}</span>
                  </div>
                </td>
                <td class="py-2 px-3">
                  <div class="flex flex-col">
                    <span class="text-gray-700 dark:text-gray-300">{{ formatDate(review.submittedAt) }}</span>
                    <span class="text-[11px] text-gray-500">{{ formatTime(review.submittedAt) }}</span>
                  </div>
                </td>
                <td class="py-2 px-3 text-center">
                  <span class="px-2 py-1 rounded-md text-[11px] font-bold tracking-wide" :class="getStatusClass(review.reviewStatus)">
                    {{ formatStatus(review.reviewStatus) }}
                  </span>
                </td>
                <td class="py-2 px-3 text-right sticky right-0 bg-white group-hover:bg-gray-50/80 dark:bg-bg-base dark:group-hover:bg-bg-card transition-colors">
                  <button @click="openDetailModal(review.id)" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shadow-sm">
                    Chi tiết
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </AdminTableShell>

        <!-- Pagination -->
        <AdminPagination
          v-if="activePagination.totalPages > 1"
          :current-page="activePagination.page"
          :total-pages="activePagination.totalPages"
          @change="changePage"
          class="mt-4"
        />
      </div>

      <!-- Table Albums -->
      <div v-else-if="currentTab === 'albums'" class="mb-8 flex flex-col !mt-2">
        <AdminTableShell
          maxHeight="400px"
          :loading="loading"
          :empty="!loading && albumReviews.length === 0"
          emptyTitle="Không có album nào cần duyệt."
          emptyDescription="Các album do nghệ sĩ gửi lên sẽ xuất hiện tại đây."
        >
          <table class="w-full min-w-[900px] text-left border-collapse text-xs whitespace-nowrap table-fixed">
            <thead class="bg-gray-50 dark:bg-bg-card sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]">
              <tr class="text-black dark:text-white uppercase tracking-wider font-bold">
                <th class="py-2 px-3 w-[30%]">Album</th>
                <th class="py-2 px-3 w-[20%]">Nghệ sĩ</th>
                <th class="py-2 px-3 w-[15%] text-center">Số bài hát</th>
                <th class="py-2 px-3 w-[15%]">Ngày gửi</th>
                <th class="py-2 px-3 w-[10%] text-center">Trạng thái</th>
                <th class="py-2 px-3 w-[10%] text-right sticky right-0 bg-gray-50 dark:bg-bg-card z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
              <tr v-for="review in albumReviews" :key="review.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
                <td class="py-2 px-3 max-w-0">
                  <div class="flex items-center gap-3">
                    <div class="relative w-10 h-10 shrink-0">
                      <img :src="normalizeImageUrl(review.coverUrl) || fallbackCover" @error="onImageError" loading="lazy" class="w-full h-full rounded-md object-cover shadow-sm bg-gray-100" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="font-bold text-gray-900 dark:text-white text-[13px] truncate" :title="review.title">{{ review.title }}</span>
                    </div>
                  </div>
                </td>
                <td class="py-2 px-3">
                  <div class="flex items-center" v-if="review.artist">
                    <span class="font-semibold text-gray-700 dark:text-gray-300 truncate">{{ review.artist.name }}</span>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="py-2 px-3 text-center">
                  <span class="font-semibold text-gray-700 dark:text-gray-300">{{ review.songCount ?? 0 }}</span>
                </td>
                <td class="py-2 px-3">
                  <div class="flex flex-col">
                    <span class="text-gray-700 dark:text-gray-300">{{ formatDate(review.submittedAt) }}</span>
                    <span class="text-[11px] text-gray-500">{{ formatTime(review.submittedAt) }}</span>
                  </div>
                </td>
                <td class="py-2 px-3 text-center">
                  <span class="px-2 py-1 rounded-md text-[11px] font-bold tracking-wide" :class="getStatusClass(review.reviewStatus)">
                    {{ formatStatus(review.reviewStatus) }}
                  </span>
                </td>
                <td class="py-2 px-3 text-right sticky right-0 bg-white group-hover:bg-gray-50/80 dark:bg-bg-base dark:group-hover:bg-bg-card transition-colors">
                  <button @click="openDetailModal(review.id)" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-bg-surface text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shadow-sm">
                    Chi tiết
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </AdminTableShell>

        <!-- Pagination -->
        <AdminPagination
          v-if="activePagination.totalPages > 1"
          :current-page="activePagination.page"
          :total-pages="activePagination.totalPages"
          @change="changePage"
          class="mt-4"
        />
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal && selectedReview" class="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" @click.self="closeDetailModal">
      <div class="bg-white dark:bg-bg-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">

        <div class="flex items-center justify-between p-5 border-b border-gray-100 dark:border-bg-border shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MfIcon :name="currentTab === 'songs' ? 'library_music' : 'album'" size="20" class="text-indigo-500" />
            Chi tiết {{ currentTab === 'songs' ? 'bài hát' : 'album' }}
          </h2>
          <button @click="closeDetailModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-bg-surface">
            <MfIcon name="close" size="20" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1">
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Left: Cover & Audio -->
            <div class="w-full md:w-[180px] shrink-0 flex flex-col gap-4">
              <div class="aspect-square w-full rounded-xl overflow-hidden shadow-md bg-gray-100">
                <img :src="normalizeImageUrl(selectedReview.coverUrl) || fallbackCover" @error="onImageError" class="w-full h-full object-cover" />
              </div>
              <div class="w-full" v-if="currentTab === 'songs' && selectedReview.audioUrl">
                <audio controls :src="normalizeImageUrl(selectedReview.audioUrl)" class="w-full h-10"></audio>
              </div>
            </div>

            <!-- Right: Info -->
            <div class="flex-1 min-w-0">
              <div class="mb-4">
                <span class="inline-flex px-2 py-1 rounded-md text-[11px] font-bold tracking-wide mb-2" :class="getStatusClass(selectedReview.reviewStatus)">
                  {{ formatStatus(selectedReview.reviewStatus) }}
                </span>
                <h3 class="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight break-words">{{ selectedReview.title }}</h3>
                <p class="text-indigo-600 dark:text-indigo-400 font-semibold mt-1 flex items-center gap-1.5">
                  <MfIcon name="person" size="16" /> {{ selectedReview.artist?.name || 'Nghệ sĩ ẩn danh' }}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-bg-surface p-4 rounded-xl border border-gray-100 dark:border-bg-border mb-4">
                <div v-if="currentTab === 'songs'">
                  <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Thể loại</span>
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ selectedReview.genre?.name || '-' }}</span>
                </div>
                <div v-if="currentTab === 'songs'">
                  <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Album</span>
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ selectedReview.album?.title || 'Single' }}</span>
                </div>
                <div>
                  <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Ngày gửi</span>
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ formatDateTime(selectedReview.submittedAt) }}</span>
                </div>
                <div v-if="currentTab === 'songs'">
                  <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Dữ liệu</span>
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ formatMetadataStatus(selectedReview.metadataStatus) }}</span>
                </div>
              </div>

              <div v-if="selectedReview.submissionNote" class="mb-4">
                <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Ghi chú từ nghệ sĩ</span>
                <div class="bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-sm p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                  {{ selectedReview.submissionNote }}
                </div>
              </div>

              <div v-if="currentTab === 'albums' && selectedReview.description" class="mb-4">
                <span class="block text-xs font-semibold text-gray-500 uppercase mb-1">Mô tả</span>
                <div class="bg-gray-50 dark:bg-bg-surface text-gray-700 dark:text-gray-300 text-sm p-3 rounded-lg border border-gray-100 dark:border-bg-border">
                  {{ selectedReview.description }}
                </div>
              </div>

              <div v-if="selectedReview.rejectionReason" class="mb-4">
                <span class="block text-xs font-semibold text-rose-500 uppercase mb-1">Lý do bị từ chối</span>
                <div class="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm p-3 rounded-lg border border-rose-200 dark:border-rose-800/30 font-medium">
                  {{ selectedReview.rejectionReason }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="currentTab === 'songs' && selectedReview.lyrics" class="mt-6 border-t border-gray-100 dark:border-bg-border pt-4">
            <span class="block text-xs font-semibold text-gray-500 uppercase mb-2">Lời bài hát</span>
            <div class="bg-gray-50 dark:bg-bg-surface p-4 rounded-xl text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto border border-gray-100 dark:border-bg-border">
              {{ selectedReview.lyrics }}
            </div>
          </div>

          <div v-if="currentTab === 'albums'" class="mt-6 border-t border-gray-100 dark:border-bg-border pt-4">
            <span class="block text-xs font-semibold text-gray-500 uppercase mb-2">Danh sách bài hát ({{ selectedReview.songs?.length || 0 }})</span>
            <div class="bg-gray-50 dark:bg-bg-surface p-4 rounded-xl text-sm text-gray-700 dark:text-gray-300 overflow-y-auto border border-gray-100 dark:border-bg-border" style="max-height: 300px">
              <div v-if="selectedReview.songs && selectedReview.songs.length" class="flex flex-col gap-3">
                <div v-for="(song, index) in selectedReview.songs" :key="song.id" class="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-bg-base rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-bg-border transition-colors">
                  <div class="font-mono text-gray-400 text-xs w-4 text-right">{{ index + 1 }}</div>
                  <img v-if="song.coverUrl" :src="normalizeImageUrl(song.coverUrl)" class="w-10 h-10 rounded shadow-sm object-cover bg-gray-200" />
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 dark:text-gray-100 truncate" :title="song.title">{{ song.title }}</div>
                    <div class="text-xs text-gray-500">{{ formatDuration(song.duration) }}</div>
                  </div>
                  <div v-if="song.audioUrl">
                    <audio controls controlsList="nodownload noplaybackrate" style="height: 32px; max-width: 200px;">
                      <source :src="normalizeImageUrl(song.audioUrl)" type="audio/mpeg" />
                    </audio>
                  </div>
                  <div class="px-2 py-1 rounded text-[10px] uppercase font-bold" :class="getStatusClass(song.review_status)">{{ formatStatus(song.review_status) }}</div>
                </div>
              </div>
              <div v-else class="text-center py-4 text-gray-400">Không có bài hát nào.</div>
            </div>
          </div>

          <div v-if="isRejecting" class="mt-6 border-t border-gray-100 dark:border-bg-border pt-4 animate-fade-in-up">
            <label class="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Lý do từ chối <span class="text-rose-500">*</span></label>
            <textarea
              v-model="rejectReason"
              class="admin-input w-full p-3 h-24 resize-none"
              placeholder="Nhập lý do từ chối rõ ràng cho nghệ sĩ biết..."
            ></textarea>
            <div class="flex gap-2 mt-3 justify-end">
              <button @click="isRejecting = false" class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" :disabled="submitting">Hủy</button>
              <button @click="submitReject" class="px-4 py-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors shadow-sm disabled:opacity-50" :disabled="!rejectReason.trim() || submitting">Xác nhận Từ chối</button>
            </div>
          </div>
        </div>

        <div class="p-5 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-surface flex justify-between shrink-0" v-if="!isRejecting">
          <button @click="closeDetailModal" class="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition-colors" :disabled="submitting">Đóng</button>

          <div class="flex gap-2" v-if="selectedReview.reviewStatus === 'pending_review'">
            <button @click="isRejecting = true" class="px-4 py-2 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-sm" :disabled="submitting">Từ chối</button>
            <button @click="confirmApprove" class="px-4 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm flex items-center gap-1.5" :disabled="submitting">
              <MfIcon name="check" size="16" /> Duyệt & Public
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model:open="showConfirmApprove"
      :title="currentTab === 'songs' ? 'Duyệt bài hát này?' : 'Duyệt album này?'"
      :message="currentTab === 'songs' ? 'Sau khi duyệt, bài hát sẽ được hiển thị ở phía người dùng. Bạn có chắc chắn muốn duyệt bài hát này không?' : 'Sau khi duyệt, album sẽ được hiển thị ở phía người dùng. Bạn có chắc chắn muốn duyệt album này không?'"
      confirmText="Duyệt"
      cancelText="Hủy"
      type="primary"
      :loading="submitting"
      @confirm="submitApprove"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminArtistSongReviewsApi } from '@/api/adminArtistSongReviews'
import { adminArtistAlbumReviewsApi } from '@/api/adminArtistAlbumReviews'
import { useAdminNotificationStore } from '@/stores/adminNotification'
import { useNotificationStore } from '@/stores/notification'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useToastStore } from '@/stores/toast'
import MfIcon from '@/components/common/MfIcon.vue'
import { normalizeImageUrl } from '@/utils/imageUrl'

const route = useRoute()
const notifStore = useAdminNotificationStore()
const globalNotifStore = useNotificationStore()
const toastStore = useToastStore()

const toast = {
  success: (msg) => toastStore.showToast(msg, 'success'),
  error: (msg) => toastStore.showToast(msg, 'error')
}

const fallbackCover = 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=100&q=80'
const emptyStats = {
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0
}
const emptyPagination = { page: 1, limit: 20, total: 0, totalPages: 0 }

const currentTab = ref('songs')
const loading = ref(false)
const errorMsg = ref('')
const songReviews = ref([])
const albumReviews = ref([])
const songStats = ref({ ...emptyStats })
const albumStats = ref({ ...emptyStats })
const songPagination = ref({ ...emptyPagination })
const albumPagination = ref({ ...emptyPagination })

const activeStats = computed(() => {
  return currentTab.value === 'albums'
    ? (albumStats.value || emptyStats)
    : (songStats.value || emptyStats)
})

const activePagination = computed(() => {
  return currentTab.value === 'albums'
    ? (albumPagination.value || emptyPagination)
    : (songPagination.value || emptyPagination)
})

const searchQuery = ref('')
const statusFilter = ref('pending_review')
const sortOption = ref('newest')

const showDetailModal = ref(false)
const selectedReview = ref(null)
const isRejecting = ref(false)
const rejectReason = ref('')
const submitting = ref(false)
const showConfirmApprove = ref(false)

const normalizeStatusFilter = (status) => {
  return status === 'pending' ? 'pending_review' : (status || 'pending_review')
}

onMounted(() => {
  if (route.query.status) {
    statusFilter.value = normalizeStatusFilter(route.query.status)
  }
  fetchSummary()
  fetchReviews()

  // Realtime updates
  if (globalNotifStore.socket) {
    globalNotifStore.socket.on('admin:review_updated', handleRealtimeUpdate)
  } else {
    setTimeout(() => {
      if (globalNotifStore.socket) {
        globalNotifStore.socket.on('admin:review_updated', handleRealtimeUpdate)
      }
    }, 2000)
  }
})

const handleRealtimeUpdate = () => {
  fetchSummary()
  fetchReviews()
}

onUnmounted(() => {
  if (globalNotifStore.socket) {
    globalNotifStore.socket.off('admin:review_updated', handleRealtimeUpdate)
  }
})

watch(() => route.query.status, (newStatus) => {
  if (newStatus) {
    statusFilter.value = normalizeStatusFilter(newStatus)
    fetchReviews()
  }
})

watch(currentTab, () => {
  searchQuery.value = ''
  statusFilter.value = 'pending_review'
  sortOption.value = 'newest'
  closeDetailModal()
  fetchReviews(1)
})

const mapStats = (summary = {}) => {
  songStats.value = {
    pendingCount: Number(summary.pendingSongs || 0),
    approvedCount: Number(summary.approvedSongs || 0),
    rejectedCount: Number(summary.rejectedSongs || 0)
  }
  albumStats.value = {
    pendingCount: Number(summary.pendingAlbums || 0),
    approvedCount: Number(summary.approvedAlbums || 0),
    rejectedCount: Number(summary.rejectedAlbums || 0)
  }
}

const fetchSummary = async () => {
  try {
    const res = await adminArtistSongReviewsApi.getSummary()
    if (res.data.success) {
      mapStats(res.data.summary || {})
    }
  } catch (err) {
    console.error(err)
    songStats.value = { ...emptyStats }
    albumStats.value = { ...emptyStats }
  }
}

const mapAlbumReview = (album = {}) => ({
  id: album.id,
  title: album.title,
  coverUrl: album.coverUrl || album.cover_url,
  reviewStatus: album.reviewStatus || album.review_status,
  submittedAt: album.submittedAt || album.submitted_at,
  releaseDate: album.releaseDate || album.release_date,
  description: album.description || null,
  submissionNote: album.submissionNote || album.submission_note || null,
  rejectionReason: album.rejectionReason || album.rejection_reason || null,
  songCount: Number(album.songCount ?? album.song_count ?? 0),
  artist: album.artist || (album.artist_id ? {
    id: album.artist_id,
    name: album.artist_name,
    avatarUrl: album.artist_avatar
  } : null),
  songs: album.songs || []
})

const fetchReviews = async (page = 1) => {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = {
      page,
      limit: activePagination.value.limit,
      q: searchQuery.value,
      status: normalizeStatusFilter(statusFilter.value),
      sort: sortOption.value
    }

    let res
    if (currentTab.value === 'songs') {
      res = await adminArtistSongReviewsApi.getReviews(params)
    } else {
      res = await adminArtistAlbumReviewsApi.getReviews(params)
    }

    if (res.data.success) {
      if (currentTab.value === 'songs') {
        songReviews.value = res.data.reviews || []
        if (res.data.summary) {
          songStats.value = {
            pendingCount: Number(res.data.summary.pendingCount || 0),
            approvedCount: Number(res.data.summary.approvedCount || 0),
            rejectedCount: Number(res.data.summary.rejectedCount || 0)
          }
        }
        songPagination.value = res.data.pagination || { ...emptyPagination }
      } else {
        albumReviews.value = (res.data.reviews || res.data.data || []).map(mapAlbumReview)
        albumPagination.value = res.data.pagination || { ...emptyPagination }
      }
      fetchSummary()
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'Lỗi khi tải danh sách ' + (currentTab.value === 'songs' ? 'bài hát' : 'album')
    toast.error('Lỗi khi tải danh sách ' + (currentTab.value === 'songs' ? 'bài hát' : 'album'))
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchReviews(1)
}

const clearSearch = () => {
  searchQuery.value = ''
  fetchReviews(1)
}

const changePage = (page) => {
  if (page > 0 && page <= activePagination.value.totalPages) {
    fetchReviews(page)
  }
}

const openDetailModal = async (id) => {
  try {
    let res
    if (currentTab.value === 'songs') {
      res = await adminArtistSongReviewsApi.getReviewDetail(id)
    } else {
      res = await adminArtistAlbumReviewsApi.getReviewDetail(id)
    }

    if (res.data.success) {
      selectedReview.value = currentTab.value === 'songs'
        ? res.data.review
        : mapAlbumReview(res.data.review || res.data.album || res.data.data)
      isRejecting.value = false
      rejectReason.value = ''
      showDetailModal.value = true
    }
  } catch (err) {
    console.error(err)
    toast.error('Lỗi tải chi tiết')
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedReview.value = null
}

const confirmApprove = () => {
  showConfirmApprove.value = true
}

const submitApprove = async () => {
  submitting.value = true
  try {
    let res
    if (currentTab.value === 'songs') {
      res = await adminArtistSongReviewsApi.approveSong(selectedReview.value.id)
    } else {
      res = await adminArtistAlbumReviewsApi.approveAlbum(selectedReview.value.id)
    }

    if (res.data.success) {
      toast.success('Đã duyệt thành công')
      closeDetailModal()
      fetchReviews(activePagination.value.page)
      fetchSummary()
      notifStore.fetchSummary()
    }
  } catch (err) {
    console.error(err)
    toast.error(err.response?.data?.message || 'Lỗi khi duyệt.')
  } finally {
    submitting.value = false
    showConfirmApprove.value = false
  }
}

const submitReject = async () => {
  if (!rejectReason.value.trim()) return

  submitting.value = true
  try {
    let res
    if (currentTab.value === 'songs') {
      res = await adminArtistSongReviewsApi.rejectSong(selectedReview.value.id, rejectReason.value)
    } else {
      res = await adminArtistAlbumReviewsApi.rejectAlbum(selectedReview.value.id, rejectReason.value)
    }

    if (res.data.success) {
      toast.success('Đã từ chối.')
      closeDetailModal()
      fetchReviews(activePagination.value.page)
      fetchSummary()
      notifStore.fetchSummary()
    }
  } catch (err) {
    console.error(err)
    toast.error(err.response?.data?.message || 'Lỗi khi từ chối.')
  } finally {
    submitting.value = false
  }
}

const formatDuration = (sec) => {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

const formatTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('vi-VN')
}

const getStatusClass = (status) => {
  switch (status) {
    case 'approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    case 'pending_review': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
    case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

const formatStatus = (status) => {
  switch (status) {
    case 'approved': return 'Đã duyệt'
    case 'pending_review': return 'Chờ duyệt'
    case 'rejected': return 'Bị từ chối'
    default: return 'Không xác định'
  }
}

const formatMetadataStatus = (status) => {
  switch (status) {
    case 'complete': return 'Đầy đủ'
    case 'missing_audio': return 'Thiếu audio'
    case 'missing_cover': return 'Thiếu cover'
    case 'missing_genre': return 'Thiếu thể loại'
    case 'incomplete': return 'Chưa hoàn thiện'
    default: return status
  }
}

const onImageError = (e) => {
  e.target.src = fallbackCover
}
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
