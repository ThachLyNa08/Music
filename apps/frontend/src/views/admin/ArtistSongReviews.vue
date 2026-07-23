<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-screen overflow-y-scroll pb-10 font-sans text-gray-800 dark:text-text-base" style="scrollbar-gutter: stable;">
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

    <div class="p-4 md:p-6 flex flex-col gap-4">

      <!-- KPI Risk Cards (Clickable Quick Filters with Toggle) -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          @click="toggleKpiFilter('pending_review', 'all')"
          class="bg-white dark:bg-bg-card p-4 rounded-xl border border-gray-200 dark:border-bg-border shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 select-none"
          :class="{ 'ring-2 ring-indigo-500 border-indigo-500': statusFilter === 'pending_review' && levelFilter === 'all' }"
        >
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Tổng chờ duyệt</span>
          <div class="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{{ riskStats.totalPending || 0 }}</div>
        </div>

        <div
          @click="toggleKpiFilter('pending_review', 'high')"
          class="bg-rose-50/50 dark:bg-rose-500/10 p-4 rounded-xl border border-rose-200 dark:border-rose-500/20 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 select-none"
          :class="{ 'ring-2 ring-rose-500 border-rose-500': statusFilter === 'pending_review' && levelFilter === 'high' }"
        >
          <span class="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rủi ro cao (High)</span>
          <div class="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{{ riskStats.highRiskCount || 0 }}</div>
        </div>

        <div
          @click="toggleKpiFilter('pending_review', 'medium')"
          class="bg-amber-50/50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 select-none"
          :class="{ 'ring-2 ring-amber-500 border-amber-500': statusFilter === 'pending_review' && levelFilter === 'medium' }"
        >
          <span class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Cần kiểm tra (Medium)</span>
          <div class="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{{ riskStats.mediumRiskCount || 0 }}</div>
        </div>

        <div
          @click="toggleKpiFilter('pending_review', 'low')"
          class="bg-emerald-50/50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 select-none"
          :class="{ 'ring-2 ring-emerald-500 border-emerald-500': statusFilter === 'pending_review' && levelFilter === 'low' }"
        >
          <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Rủi ro thấp (Low)</span>
          <div class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{{ riskStats.lowRiskCount || 0 }}</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div>
        <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
          <div class="relative min-w-[280px] flex-1">
            <MfIcon name="search" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              type="text"
              placeholder="Tìm theo tên..."
              class="admin-input pl-8 pr-8 w-full"
            />
            <button v-if="searchQuery" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
              <MfIcon name="close" size="14" />
            </button>
          </div>
          <select v-model="levelFilter" @change="handleSearch" class="admin-input w-full xl:w-40 xl:shrink-0 cursor-pointer !pl-3">
            <option value="all">Tất cả mức độ</option>
            <option value="high">Mức cao (High)</option>
            <option value="medium">Mức trung bình</option>
            <option value="low">Mức thấp (Low)</option>
          </select>
          <select v-model="flagFilter" @change="handleSearch" class="admin-input w-full xl:w-44 xl:shrink-0 cursor-pointer !pl-3">
            <option v-for="opt in flagOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <select v-model="artistFilter" @change="handleSearch" class="admin-input w-full xl:w-44 xl:shrink-0 cursor-pointer !pl-3">
            <option value="all">Tất cả nghệ sĩ</option>
            <option v-for="artist in artistOptions" :key="artist.id" :value="artist.id">{{ artist.name }}</option>
          </select>
          <select v-model="statusFilter" @change="handleSearch" class="admin-input w-full xl:w-40 xl:shrink-0 cursor-pointer !pl-3">
            <option value="all">Tất cả trạng thái</option>
            <option value="pending_review">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Bị từ chối</option>
          </select>
          <select v-model="sortOption" @change="handleSearch" class="admin-input w-full xl:w-40 xl:shrink-0 cursor-pointer !pl-3">
            <option value="risk_desc">Rủi ro cao trước</option>
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
      </div>

      <div v-if="errorMsg" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {{ errorMsg }}
      </div>

      <!-- Bulk Action Bar -->
      <div v-if="selectedIds.length > 0" class="sticky top-20 z-30 mb-3 flex items-center justify-between rounded-xl bg-white dark:bg-bg-card p-3 px-4 text-gray-900 dark:text-white shadow-md border border-gray-200 dark:border-bg-border">
        <div class="flex items-center gap-2 text-sm font-bold">
          <MfIcon name="check-circle" size="18" class="text-indigo-600 dark:text-indigo-400" />
          <span>Đã chọn <span class="text-indigo-600 dark:text-indigo-400">{{ selectedIds.length }}</span> {{ currentTab === 'songs' ? 'bài hát' : 'album' }}</span>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="openBulkConfirmApprove"
            :disabled="bulkLoading"
            class="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <MfIcon name="check" size="14" /> Duyệt đã chọn
          </button>
          <button
            @click="openBulkRejectModal"
            :disabled="bulkLoading"
            class="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <MfIcon name="close" size="14" /> Từ chối đã chọn
          </button>
          <button
            @click="clearSelection"
            :disabled="bulkLoading"
            class="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 transition-colors cursor-pointer"
          >
            Bỏ chọn
          </button>
        </div>
      </div>

      <!-- Table Songs -->
      <div v-if="currentTab === 'songs'" class="mb-8 flex flex-col !mt-2 min-h-[480px]">
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
                <th class="py-2 px-3 w-[4%] text-center">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    :disabled="pendingItemsOnCurrentPage.length === 0"
                    @change="toggleSelectAll"
                    class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                    title="Chọn tất cả mục chờ duyệt trên trang này"
                  />
                </th>
                <th class="py-2 px-3 w-[24%]">Bài hát</th>
                <th class="py-2 px-3 w-[15%]">Nghệ sĩ</th>
                <th class="py-2 px-3 w-[24%]">Kiểm duyệt / Rủi ro</th>
                <th class="py-2 px-3 w-[13%]">Ngày gửi</th>
                <th class="py-2 px-3 w-[10%] text-center">Trạng thái</th>
                <th class="py-2 px-3 w-[10%] text-right sticky right-0 bg-gray-50 dark:bg-bg-card z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
              <tr v-for="review in songReviews" :key="review.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :value="review.id"
                    v-model="selectedIds"
                    :disabled="(review.reviewStatus || review.review_status) !== 'pending_review'"
                    class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </td>
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
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[11px] font-bold" :class="getLevelBadgeClass(review.moderationLevel)">
                        {{ formatLevelText(review.moderationLevel) }}
                      </span>
                      <span class="text-[11px] text-gray-500 font-semibold">Health: {{ review.metadataScore || 0 }}/100</span>
                      <span class="text-[11px] text-rose-500 font-bold" v-if="review.riskScore > 0">Risk: +{{ review.riskScore }}</span>
                    </div>
                    <div class="flex flex-wrap gap-1" v-if="review.moderationFlags && review.moderationFlags.length">
                      <span v-for="flag in review.moderationFlags" :key="flag" class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-bg-surface text-gray-600 dark:text-gray-300 text-[10px] font-medium border border-gray-200 dark:border-bg-border">
                        {{ formatFlagText(flag) }}
                      </span>
                    </div>
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
      <div v-else-if="currentTab === 'albums'" class="mb-8 flex flex-col !mt-2 min-h-[480px]">
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
                <th class="py-2 px-3 w-[4%] text-center">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    :disabled="pendingItemsOnCurrentPage.length === 0"
                    @change="toggleSelectAll"
                    class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                    title="Chọn tất cả album chờ duyệt trên trang này"
                  />
                </th>
                <th class="py-2 px-3 w-[28%]">Album</th>
                <th class="py-2 px-3 w-[18%]">Nghệ sĩ</th>
                <th class="py-2 px-3 w-[15%] text-center">Số bài hát</th>
                <th class="py-2 px-3 w-[15%]">Ngày gửi</th>
                <th class="py-2 px-3 w-[10%] text-center">Trạng thái</th>
                <th class="py-2 px-3 w-[10%] text-right sticky right-0 bg-gray-50 dark:bg-bg-card z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
              <tr v-for="review in albumReviews" :key="review.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :value="review.id"
                    v-model="selectedIds"
                    :disabled="(review.reviewStatus || review.review_status) !== 'pending_review'"
                    class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </td>
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
    <Teleport to="body">
      <div v-if="showDetailModal && selectedReview" class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="closeDetailModal">
        <div class="mx-auto flex w-full max-w-2xl max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col overflow-hidden bg-white dark:bg-bg-surface rounded-2xl shadow-2xl animate-fade-in-up">

          <header class="shrink-0 flex items-center justify-between p-5 border-b border-gray-100 dark:border-bg-border">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MfIcon :name="currentTab === 'songs' ? 'library_music' : 'album'" size="20" class="text-indigo-500" />
            Chi tiết {{ currentTab === 'songs' ? 'bài hát' : 'album' }}
          </h2>
          <button @click="closeDetailModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-bg-surface">
            <MfIcon name="close" size="20" />
          </button>
          </header>

          <div class="flex-1 overflow-y-auto p-6">
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

              <div v-if="selectedReview.duplicateReferenceSongId" class="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400">
                <div class="font-bold flex items-center gap-1 mb-1">
                  <MfIcon name="alert-triangle" size="14" /> Cảnh báo Audio Trùng khớp:
                </div>
                <div>
                  Trùng 100% với bài hát <strong>#{{ selectedReview.duplicateReferenceSongId }} - {{ selectedReview.duplicateReferenceTitle }}</strong>
                  <span v-if="selectedReview.duplicateReferenceArtistName"> (Nghệ sĩ: <strong>{{ selectedReview.duplicateReferenceArtistName }}</strong>)</span>
                  — Trạng thái: <span class="font-bold uppercase">{{ selectedReview.duplicateReferenceStatus === 'pending_review' ? 'Chờ duyệt' : selectedReview.duplicateReferenceStatus }}</span>
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
            <div class="mt-3 flex items-center gap-2">
              <input type="checkbox" id="allowResubmit" v-model="allowResubmit" class="rounded border-gray-300 text-rose-500 focus:ring-rose-500 disabled:opacity-50" :disabled="selectedReview.resubmissionCount >= 3" />
              <label for="allowResubmit" class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer" :class="{'opacity-50': selectedReview.resubmissionCount >= 3}">
                Cho phép nghệ sĩ chỉnh sửa và gửi lại
              </label>
              <span v-if="selectedReview.resubmissionCount >= 3" class="text-xs text-rose-500 font-medium ml-2">(Đã hết lượt)</span>
            </div>
            <div class="flex gap-2 mt-4 justify-end">
              <button @click="isRejecting = false" class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" :disabled="submitting">Hủy</button>
              <button @click="submitReject" class="px-4 py-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors shadow-sm disabled:opacity-50" :disabled="!rejectReason.trim() || submitting">Xác nhận Từ chối</button>
            </div>
          </div>
        </div>

          <footer class="shrink-0 p-5 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-surface flex justify-between" v-if="!isRejecting">
            <button @click="closeDetailModal" class="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition-colors" :disabled="submitting">Đóng</button>

          <div class="flex gap-2" v-if="selectedReview.reviewStatus === 'pending_review'">
            <button @click="isRejecting = true" class="px-4 py-2 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-sm" :disabled="submitting">Từ chối</button>
            <button @click="confirmApprove" class="px-4 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm flex items-center gap-1.5" :disabled="submitting">
              <MfIcon name="check" size="16" /> Duyệt & Public
            </button>
          </div>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Dialog Single Approve -->
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

    <!-- Confirm Dialog Bulk Approve -->
    <ConfirmDialog
      v-model:open="showBulkConfirmApprove"
      :title="currentTab === 'songs' ? 'Duyệt các bài hát đã chọn?' : 'Duyệt các album đã chọn?'"
      :message="`Bạn có chắc chắn muốn duyệt ${selectedIds.length} mục đã chọn? Các nội dung rủi ro cao (High Risk), điểm rủi ro > 60 hoặc có cờ cảnh báo vi phạm sẽ tự động được hệ thống bỏ qua để đảm bảo an toàn.`"
      confirmText="Duyệt hàng loạt"
      cancelText="Hủy"
      type="primary"
      :loading="bulkLoading"
      @confirm="submitBulkApprove"
    />

    <!-- Modal Bulk Reject -->
    <Teleport to="body">
      <div v-if="showBulkRejectModal" class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" @click.self="showBulkRejectModal = false">
        <div class="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-bg-card rounded-2xl shadow-2xl border border-gray-100 dark:border-bg-border overflow-hidden">
          <!-- Header -->
          <div class="p-4 px-5 border-b border-gray-100 dark:border-bg-border flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white">Từ chối {{ selectedIds.length }} {{ currentTab === 'songs' ? 'bài hát' : 'album' }} đã chọn</h3>
              <p class="text-xs text-gray-500">Lựa chọn áp dụng lý do chung hoặc nhập lý do riêng từng nội dung.</p>
            </div>
            <button @click="showBulkRejectModal = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg">
              <MfIcon name="close" size="18" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 overflow-y-auto flex-1 space-y-4">
            <!-- Warning if items have different flags -->
            <div v-if="hasDiverseFlags" class="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
              <div class="font-bold flex items-center gap-1.5 mb-0.5">
                <MfIcon name="warning" size="14" class="text-amber-500" /> Cảnh báo:
              </div>
              <span>Các nội dung đã chọn có cảnh báo khác nhau. Nên nhập lý do riêng cho từng nội dung.</span>
            </div>

            <!-- Mode Selector -->
            <div class="flex rounded-xl bg-gray-100 dark:bg-bg-surface p-1 text-xs font-bold border border-gray-200 dark:border-bg-border">
              <button
                @click="bulkRejectMode = 'common'"
                :class="bulkRejectMode === 'common' ? 'bg-white dark:bg-bg-card text-rose-600 dark:text-rose-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'"
                class="flex-1 py-2 rounded-lg transition-all text-center cursor-pointer"
              >
                Dùng lý do chung
              </button>
              <button
                @click="bulkRejectMode = 'per_item'"
                :class="bulkRejectMode === 'per_item' ? 'bg-white dark:bg-bg-card text-rose-600 dark:text-rose-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'"
                class="flex-1 py-2 rounded-lg transition-all text-center cursor-pointer"
              >
                Nhập lý do riêng cho từng {{ currentTab === 'songs' ? 'bài' : 'album' }}
              </button>
            </div>

            <!-- Suggestion Chips -->
            <div>
              <span class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Gợi ý lý do từ chối:</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="chip in reasonChips"
                  :key="chip"
                  @click="applyReasonChip(chip)"
                  type="button"
                  class="rounded-lg bg-gray-100 dark:bg-bg-surface hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 border border-gray-200 dark:border-bg-border px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  + {{ chip }}
                </button>
              </div>
            </div>

            <!-- Mode 1: Common Reason -->
            <div v-if="bulkRejectMode === 'common'" class="space-y-2">
              <div class="rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30">
                Lý do này sẽ được áp dụng cho tất cả nội dung đã chọn. Chỉ sử dụng khi các nội dung có cùng nguyên nhân từ chối.
              </div>
              <textarea
                v-model="bulkCommonReason"
                rows="3"
                placeholder="Nhập lý do từ chối chung cho tất cả các mục..."
                class="w-full p-3 text-xs rounded-xl border border-gray-200 dark:border-bg-border bg-gray-50 dark:bg-bg-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              ></textarea>
            </div>

            <!-- Mode 2: Per Item Reason -->
            <div v-else class="space-y-3">
              <span class="block text-xs font-semibold text-gray-500">Danh sách lý do riêng từng mục (Click vào ô nhập để áp dụng gợi ý):</span>
              <div class="space-y-3 max-h-64 overflow-y-auto pr-1">
                <div
                  v-for="item in selectedItemsDetails"
                  :key="item.id"
                  class="p-3 rounded-xl border border-gray-200 dark:border-bg-border bg-gray-50/70 dark:bg-bg-surface/70 flex flex-col gap-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <img :src="normalizeImageUrl(item.coverUrl) || fallbackCover" class="w-8 h-8 rounded-md object-cover bg-gray-200 shrink-0" />
                      <div class="min-w-0 flex flex-col">
                        <span class="font-bold text-xs text-gray-900 dark:text-white truncate">{{ item.title }}</span>
                        <span class="text-[11px] text-gray-500 truncate">{{ item.artist?.name || '-' }}</span>
                      </div>
                    </div>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                      :class="getLevelBadgeClass(item.moderationLevel || item.moderation_level)"
                    >
                      {{ formatLevelText(item.moderationLevel || item.moderation_level) }}
                    </span>
                  </div>

                  <!-- Flags -->
                  <div v-if="(item.moderationFlags || item.moderation_flags)?.length > 0" class="flex flex-wrap gap-1">
                    <span
                      v-for="flag in (item.moderationFlags || item.moderation_flags)"
                      :key="flag"
                      class="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium"
                    >
                      {{ formatFlagText(flag) }}
                    </span>
                  </div>

                  <textarea
                    v-model="bulkItemReasons[item.id]"
                    @focus="focusedItemId = item.id"
                    rows="2"
                    :placeholder="`Nhập lý do từ chối cho '${item.title}'...`"
                    class="w-full p-2.5 text-xs rounded-lg border border-gray-200 dark:border-bg-border bg-white dark:bg-bg-card text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Resubmit Option -->
            <label class="flex items-center gap-2 pt-2 cursor-pointer select-none">
              <input type="checkbox" v-model="bulkAllowResubmit" class="rounded text-rose-600 focus:ring-rose-500" />
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">Cho phép nghệ sĩ chỉnh sửa và gửi lại</span>
            </label>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-surface flex justify-end gap-2 shrink-0">
            <button @click="showBulkRejectModal = false" class="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer" :disabled="bulkLoading">Hủy</button>
            <button @click="submitBulkReject" class="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer" :disabled="bulkLoading">Xác nhận từ chối {{ selectedIds.length }} mục</button>
          </div>
        </div>
      </div>
    </Teleport>
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
const statusFilter = ref('all')
const levelFilter = ref('all')
const flagFilter = ref('all')
const artistFilter = ref('all')
const artistOptions = ref([])
const sortOption = ref('risk_desc')
const riskStats = ref({ totalPending: 0, highRiskCount: 0, mediumRiskCount: 0, lowRiskCount: 0 })

const flagOptions = computed(() => {
  if (currentTab.value === 'songs') {
    return [
      { value: 'all', label: 'Tất cả cảnh báo' },
      { value: 'duplicate_audio_pending', label: 'Trùng audio đang chờ duyệt' },
      { value: 'missing_cover', label: 'Thiếu ảnh bìa' },
      { value: 'missing_lyrics', label: 'Thiếu lyrics' },
      { value: 'new_artist', label: 'Nghệ sĩ mới' },
      { value: 'duplicate_title', label: 'Tên gần trùng' },
      { value: 'resubmitted_multiple_times', label: 'Gửi lại nhiều lần' },
      { value: 'unusual_duration', label: 'Thời lượng bất thường' }
    ]
  } else {
    return [
      { value: 'all', label: 'Tất cả cảnh báo' },
      { value: 'missing_cover', label: 'Thiếu ảnh bìa' },
      { value: 'new_artist', label: 'Nghệ sĩ mới' },
      { value: 'duplicate_title', label: 'Tên gần trùng' },
      { value: 'resubmitted_multiple_times', label: 'Gửi lại nhiều lần' },
      { value: 'few_album_songs', label: 'Album quá ít bài' },
      { value: 'unapproved_album_song', label: 'Chứa bài chưa duyệt' }
    ]
  }
})

const toggleKpiFilter = (targetStatus, targetLevel) => {
  if (statusFilter.value === targetStatus && levelFilter.value === targetLevel) {
    statusFilter.value = 'all'
    levelFilter.value = 'all'
  } else {
    statusFilter.value = targetStatus
    levelFilter.value = targetLevel
  }
  handleSearch()
}

const allowResubmit = ref(true)
const showDetailModal = ref(false)
const selectedReview = ref(null)
const isRejecting = ref(false)
const rejectReason = ref('')
const submitting = ref(false)
const showConfirmApprove = ref(false)

// Bulk Selection & Action States
const selectedIds = ref([])
const bulkLoading = ref(false)
const showBulkConfirmApprove = ref(false)
const showBulkRejectModal = ref(false)
const bulkRejectMode = ref('common') // 'common' | 'per_item'
const bulkCommonReason = ref('')
const bulkItemReasons = ref({})
const focusedItemId = ref(null)
const bulkAllowResubmit = ref(true)

const reasonChips = [
  'Thiếu lời bài hát.',
  'Thời lượng audio không hợp lệ.',
  'Metadata chưa đầy đủ.',
  'Ảnh bìa chưa phù hợp.',
  'Nội dung cần chỉnh sửa trước khi phát hành.'
]

const selectedItemsDetails = computed(() => {
  const sourceList = currentTab.value === 'songs' ? songReviews.value : albumReviews.value
  const idSet = new Set(selectedIds.value)
  return sourceList.filter(item => idSet.has(item.id))
})

const hasDiverseFlags = computed(() => {
  const items = selectedItemsDetails.value
  if (items.length <= 1) return false
  const getFlagString = (item) => {
    const flags = item.moderationFlags || item.moderation_flags || []
    return Array.isArray(flags) ? flags.sort().join(',') : ''
  }
  const firstFlagStr = getFlagString(items[0])
  return items.some(item => getFlagString(item) !== firstFlagStr)
})

const applyReasonChip = (chipText) => {
  if (bulkRejectMode.value === 'common') {
    bulkCommonReason.value = chipText
  } else {
    if (focusedItemId.value && selectedIds.value.includes(focusedItemId.value)) {
      bulkItemReasons.value[focusedItemId.value] = chipText
    } else {
      for (const id of selectedIds.value) {
        if (!bulkItemReasons.value[id] || !bulkItemReasons.value[id].trim()) {
          bulkItemReasons.value[id] = chipText
        }
      }
    }
  }
}

const pendingItemsOnCurrentPage = computed(() => {
  if (currentTab.value === 'songs') {
    return songReviews.value.filter(s => (s.reviewStatus || s.review_status) === 'pending_review')
  } else {
    return albumReviews.value.filter(a => (a.reviewStatus || a.review_status) === 'pending_review')
  }
})

const isAllSelected = computed(() => {
  const items = pendingItemsOnCurrentPage.value
  if (items.length === 0) return false
  return items.every(item => selectedIds.value.includes(item.id))
})

const toggleSelectAll = () => {
  const items = pendingItemsOnCurrentPage.value
  if (isAllSelected.value) {
    const itemIds = new Set(items.map(i => i.id))
    selectedIds.value = selectedIds.value.filter(id => !itemIds.has(id))
  } else {
    const newSelected = new Set([...selectedIds.value, ...items.map(i => i.id)])
    selectedIds.value = Array.from(newSelected)
  }
}

const clearSelection = () => {
  selectedIds.value = []
}

const openBulkConfirmApprove = () => {
  if (selectedIds.value.length === 0) return
  showBulkConfirmApprove.value = true
}

const submitBulkApprove = async () => {
  if (selectedIds.value.length === 0) return
  bulkLoading.value = true
  try {
    const apiCall = currentTab.value === 'songs'
      ? adminArtistSongReviewsApi.bulkApproveSongs(selectedIds.value)
      : adminArtistAlbumReviewsApi.bulkApproveAlbums(selectedIds.value)

    const res = await apiCall
    if (res.data.success) {
      const { approvedCount = 0, skippedCount = 0, skipped = [] } = res.data
      if (approvedCount > 0) {
        toastStore.showToast(`Đã duyệt thành công ${approvedCount} nội dung.`, 'success')
      }
      if (skippedCount > 0) {
        const firstReason = skipped[0]?.reason || 'Không đủ điều kiện duyệt hàng loạt.'
        toastStore.showToast(`Bỏ qua ${skippedCount} nội dung: ${firstReason}`, 'warning')
      }
      showBulkConfirmApprove.value = false
      clearSelection()
      fetchSummary()
      fetchReviews()
    }
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Lỗi khi duyệt hàng loạt', 'error')
  } finally {
    bulkLoading.value = false
  }
}

const openBulkRejectModal = () => {
  if (selectedIds.value.length === 0) return
  bulkRejectMode.value = 'common'
  bulkCommonReason.value = ''
  bulkItemReasons.value = {}
  focusedItemId.value = null
  for (const id of selectedIds.value) {
    bulkItemReasons.value[id] = ''
  }
  bulkAllowResubmit.value = true
  showBulkRejectModal.value = true
}

const submitBulkReject = async () => {
  if (selectedIds.value.length === 0) return

  if (bulkRejectMode.value === 'common') {
    if (!bulkCommonReason.value || !bulkCommonReason.value.trim()) {
      toastStore.showToast('Vui lòng nhập lý do từ chối chung.', 'error')
      return
    }
  } else {
    for (const id of selectedIds.value) {
      if (!bulkItemReasons.value[id] || !bulkItemReasons.value[id].trim()) {
        const item = selectedItemsDetails.value.find(i => i.id === id)
        toastStore.showToast(`Vui lòng nhập lý do từ chối cho "${item?.title || id}".`, 'error')
        return
      }
    }
  }

  bulkLoading.value = true
  try {
    let res
    if (bulkRejectMode.value === 'common') {
      const payload = {
        ids: selectedIds.value,
        reason: bulkCommonReason.value.trim(),
        allowResubmit: bulkAllowResubmit.value
      }
      res = currentTab.value === 'songs'
        ? await adminArtistSongReviewsApi.bulkRejectSongs(payload)
        : await adminArtistAlbumReviewsApi.bulkRejectAlbums(payload)
    } else {
      const itemsPayload = selectedIds.value.map(id => ({
        id,
        reason: bulkItemReasons.value[id].trim()
      }))
      const payload = {
        items: itemsPayload,
        allowResubmit: bulkAllowResubmit.value
      }
      res = currentTab.value === 'songs'
        ? await adminArtistSongReviewsApi.bulkRejectSongs(payload)
        : await adminArtistAlbumReviewsApi.bulkRejectAlbums(payload)
    }

    if (res.data.success) {
      toastStore.showToast(`Đã từ chối ${res.data.rejectedCount} nội dung.`, 'success')
      showBulkRejectModal.value = false
      clearSelection()
      fetchSummary()
      fetchReviews()
    }
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Lỗi khi từ chối hàng loạt', 'error')
  } finally {
    bulkLoading.value = false
  }
}

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
  statusFilter.value = 'all'
  levelFilter.value = 'all'
  flagFilter.value = 'all'
  artistFilter.value = 'all'
  sortOption.value = 'risk_desc'
  clearSelection()
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
      if (res.data.artists) {
        artistOptions.value = res.data.artists || []
      }
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

const getLevelBadgeClass = (level) => {
  switch (level) {
    case 'high': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
    case 'medium': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    default: return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
  }
}

const formatLevelText = (level) => {
  switch (level) {
    case 'high': return 'RỦI RO CAO'
    case 'medium': return 'TRUNG BÌNH'
    default: return 'AN TOÀN'
  }
}

const formatFlagText = (flag) => {
  const flagMap = {
    missing_cover: 'Thiếu ảnh bìa',
    missing_lyrics: 'Thiếu lời bài hát',
    new_artist: 'Nghệ sĩ mới (<3 bài)',
    duplicate_title: 'Tên trùng/gần trùng',
    duplicate_audio_pending: 'Audio trùng bài đang chờ duyệt',
    resubmitted_multiple_times: 'Gửi lại nhiều lần (>=2)',
    incomplete_metadata: 'Metadata chưa đủ',
    unusual_duration: 'Thời lượng bất thường',
    few_album_songs: 'Album ít bài (<2)',
    unapproved_album_song: 'Album chứa bài chưa duyệt',
    missing_description: 'Thiếu mô tả album'
  }
  return flagMap[flag] || flag
}

const fetchReviews = async (page = 1) => {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = {
      page,
      limit: activePagination.value.limit,
      q: searchQuery.value,
      status: normalizeStatusFilter(statusFilter.value),
      level: levelFilter.value !== 'all' ? levelFilter.value : undefined,
      flag: flagFilter.value !== 'all' ? flagFilter.value : undefined,
      artistId: artistFilter.value !== 'all' ? artistFilter.value : undefined,
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
        if (res.data.stats) {
          riskStats.value = res.data.stats
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
  clearSelection()
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

watch(isRejecting, (newVal) => {
  if (newVal) {
    allowResubmit.value = (selectedReview.value?.resubmissionCount || 0) < 3
  }
})

const submitReject = async () => {
  if (!rejectReason.value.trim()) return

  submitting.value = true
  try {
    let res
    if (currentTab.value === 'songs') {
      res = await adminArtistSongReviewsApi.rejectSong(selectedReview.value.id, rejectReason.value, allowResubmit.value)
    } else {
      res = await adminArtistAlbumReviewsApi.rejectAlbum(selectedReview.value.id, rejectReason.value, allowResubmit.value)
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
    case 'needs_check': return 'Cần kiểm tra'
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
