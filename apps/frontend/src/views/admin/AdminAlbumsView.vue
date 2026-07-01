<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10 font-sans text-gray-800 dark:text-text-base">
    <template v-if="isDetailMode">
      <div class="p-4 md:p-6 flex flex-col space-y-6">
        <div class="flex items-center justify-between gap-4 mb-5">
        <button @click="router.push('/admin/albums')" class="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-600">
          <MfIcon name="arrow_back" size="20" />
          Quản lý Album
        </button>
      </div>

      <div v-if="detailLoading" class="panel p-12 text-center text-gray-400">
        <div class="w-10 h-10 mx-auto border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
        <p class="text-sm font-semibold">Đang tải album...</p>
      </div>

      <div v-else-if="detailError" class="panel p-12 text-center">
        <MfIcon name="error_outline" size="52" className="text-rose-400 mx-auto mb-3" />
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Không thể tải album</h2>
        <p class="text-sm text-gray-500">{{ detailError }}</p>
      </div>

      <div v-else-if="detail.album" class="space-y-5">
        <section class="panel p-5 md:p-6">
          <div class="flex flex-col md:flex-row gap-5">
            <img :src="formatImageUrl(detail.album.cover_url)" @error="handleImageError" class="w-36 h-36 rounded-xl object-cover bg-gray-100 border border-gray-100 dark:border-bg-border shadow-sm" />
            <div class="flex-1 min-w-0">
              <span class="inline-flex mb-2 px-2.5 py-1 rounded-full text-xs font-bold" :class="releaseBadgeClass(detail.album)">
                {{ releaseLabel(detail.album) }}
              </span>
              <div class="flex items-center gap-3">
                <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white truncate" :title="detail.album.title">{{ detail.album.title }}</h1>
                <div class="flex items-center gap-1">
                  <button @click="openEditModal(detail.album)" class="admin-icon-button text-indigo-500 hover:bg-indigo-50" title="Chỉnh sửa">
                    <MfIcon name="edit" size="20" />
                  </button>
                  <button v-if="detail.album.release_status !== 'published'" @click="quickRelease(detail.album, 'published')" class="admin-icon-button text-emerald-600 hover:bg-emerald-50" title="Phát hành">
                    <MfIcon name="publish" size="20" />
                  </button>
                  <button v-if="detail.album.release_status === 'published'" @click="quickRelease(detail.album, 'hidden')" class="admin-icon-button text-rose-600 hover:bg-rose-50" title="Ẩn">
                    <MfIcon name="visibility_off" size="20" />
                  </button>
                </div>
              </div>
              <button @click="goToArtist(detail.album.artist_id)" class="mt-2 inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-emerald-600">
                {{ detail.album.artist_name }}
              </button>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
                <div class="metric-box"><span>Thể loại</span><strong>{{ detail.album.genre_name || 'Chưa phân loại' }}</strong></div>
                <div class="metric-box"><span>Bài hát</span><strong>{{ formatNumber(detail.stats.song_count) }}</strong></div>
                <div class="metric-box"><span>Lượt nghe</span><strong>{{ formatNumber(detail.stats.total_plays) }}</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-bg-border">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">Bài hát trong album</h2>
            <button @click="openEditModal(detail.album)" class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50">
              <MfIcon name="queue_music" size="18" />
              Quản lý bài hát
            </button>
          </div>
          <AlbumSongsTable :songs="detail.songs" />
        </section>
      </div>
      </div>
    </template>

    <template v-else>
      <header class="py-5 bg-white dark:bg-bg-surface border-b border-slate-200 dark:border-bg-border flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 shrink-0">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Album</h1>
          <p class="text-sm text-gray-500 dark:text-text-secondary mt-1">Quản lý metadata, bài hát và trạng thái phát hành của album.</p>
        </div>
        <div class="flex gap-2 mt-3 md:mt-0">
          <AdminAddButton title="Thêm album" @click="openCreateModal" />
        </div>
      </header>

      <div class="p-4 md:p-6 flex flex-col space-y-6">
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5 shrink-0">
        <AdminKpiCard
          v-for="item in kpiCards"
          :key="item.title"
          v-bind="item"
          :show-icon="false"
          compact
          :loading="isStatsLoading"
        />
      </div>

      <AdminFilterBar>
        <div class="relative flex-1 min-w-[200px]">
          <MfIcon name="search" size="18" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            v-model="filters.search" 
            @keyup.enter="handleEnter"
            @focus="showHistory = true"
            @blur="handleBlur"
            type="text" 
            placeholder="Tìm album hoặc nghệ sĩ..." 
            class="admin-input album-search-input pl-9 pr-8" 
          />
          <button v-if="filters.search" @click="clearSearch" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <MfIcon name="close" size="14" />
          </button>
          <!-- History Dropdown -->
          <div v-if="showHistory && searchHistory.length > 0" class="absolute z-50 w-full mt-1 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-lg shadow-lg overflow-hidden animate-fade-in-up">
            <ul>
              <li v-for="item in searchHistory" :key="item" class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group" @mousedown.prevent="selectHistoryItem(item)">
                <div class="flex items-center gap-2 overflow-hidden">
                  <MfIcon name="history" size="14" class="text-gray-400 flex-shrink-0" />
                  <span class="text-sm text-gray-600 dark:text-gray-300 truncate">{{ item }}</span>
                </div>
                <button @mousedown.prevent.stop="removeHistoryItem(item)" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1">
                  <MfIcon name="close" size="12" />
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div class="w-full md:w-40">
          <select v-model="filters.genreId" class="admin-input">
            <option value="">Tất cả thể loại</option>
            <option v-for="genre in meta.genres" :key="genre.id" :value="genre.id">{{ genre.name }}</option>
          </select>
        </div>
        <div class="w-full md:w-40">
          <select v-model="filters.sortPlays" class="admin-input">
            <option value="">Lượt nghe mặc định</option>
            <option value="desc">Lượt nghe giảm dần</option>
            <option value="asc">Lượt nghe tăng dần</option>
          </select>
        </div>
        <div class="w-full md:w-40">
          <select v-model="filters.releaseStatus" class="admin-input">
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="scheduled">Lên lịch</option>
            <option value="published">Đã phát hành</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        </div>
        <div v-if="meta.supportsMarketFilter" class="w-full md:w-40">
          <select v-model="filters.market" class="admin-input">
            <option value="">Tất cả khu vực</option>
            <option v-for="market in meta.markets" :key="market" :value="market">{{ market }}</option>
          </select>
        </div>
        <AdminResetButton :disabled="isInitialLoading || isPageLoading" @click="resetFilters" class="h-[38px] mt-[auto]" />
      </AdminFilterBar>

      <div class="flex-1 flex flex-col">
        <AdminTableShell 
          class="h-[440px] flex-none"
          :loading="isInitialLoading || isPageLoading" 
          :empty="!isInitialLoading && !isPageLoading && albums.length === 0" 
          emptyTitle="Không tìm thấy album nào" 
          emptyDescription="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
        >
          <table class="w-full text-left border-collapse table-fixed min-w-[1000px] text-xs">
            <thead class="bg-gray-50 dark:bg-bg-card sticky top-0 z-20 shadow-[0_1px_0_0_#f3f4f6] dark:shadow-[0_1px_0_0_#273142]">
              <tr class="text-black dark:text-white uppercase tracking-wider font-bold">
                <th class="py-2 px-3 w-[35%]">Album</th>
                <th class="py-2 px-3 w-[20%]">Nghệ sĩ</th>
                <th class="py-2 px-3 w-36 whitespace-nowrap">Thể loại</th>
                <th v-if="meta.supportsMarketFilter" class="py-2 px-3 w-24 whitespace-nowrap">Khu vực</th>
                <th class="py-2 px-3 w-32 text-center whitespace-nowrap">Phát hành</th>
                <th class="py-2 px-3 w-24 text-center whitespace-nowrap">Bài hát</th>
                <th class="py-2 px-3 w-28 text-right whitespace-nowrap">Lượt nghe</th>
                <th class="py-2 px-3 w-24 text-center whitespace-nowrap sticky right-0 bg-gray-50 dark:bg-bg-card z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-bg-border relative">
              <tr v-for="album in albums" :key="album.id" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors group">
                <td class="py-2 px-3">
                  <button @click="router.push(`/admin/albums/${album.id}/detail`)" class="flex items-center gap-3 max-w-[320px] text-left">
                    <img :src="formatImageUrl(album.cover_url)" @error="handleImageError" class="w-10 h-10 rounded-md object-cover bg-gray-100 border border-gray-100 dark:border-bg-border shadow-sm" />
                    <span class="font-bold text-[13px] text-gray-900 dark:text-white truncate hover:text-emerald-600" :title="album.title">{{ album.title }}</span>
                  </button>
                </td>
                <td class="py-2 px-3">
                  <button @click="goToArtist(album.artist_id)" class="inline-flex items-center gap-2 max-w-[190px] text-[11px] font-bold text-gray-700 dark:text-gray-200 hover:text-emerald-600">
                    <span class="truncate">{{ album.artist_name }}</span>
                  </button>
                </td>
                <td class="py-2 px-3 text-[11px] text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ album.genre_name || 'Chưa phân loại' }}</td>
                <td v-if="meta.supportsMarketFilter" class="py-2 px-3 whitespace-nowrap">
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {{ album.market || 'OTHER' }}
                  </span>
                </td>
                <td class="py-2 px-3 text-center">
                  <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold" :class="releaseBadgeClass(album)">
                    {{ releaseLabel(album) }}
                  </span>
                </td>
                <td class="py-2 px-3 text-center font-bold text-gray-700 dark:text-gray-200">{{ formatNumber(album.song_count) }}</td>
                <td class="py-2 px-3 text-right font-bold text-gray-700 dark:text-gray-200">{{ formatNumber(album.total_plays) }}</td>
                <td class="py-2 px-3 text-center sticky right-0 bg-white group-hover:bg-gray-50/80 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-10">
                  <div class="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <AdminActionMenu :actions="getAlbumActions(album)" />
                  </div>
                </td>
              </tr>
              <tr v-for="album in expandedRows" :key="`songs-${album.id}`" class="bg-gray-50/70 dark:bg-bg-card/40">
                <td :colspan="meta.supportsMarketFilter ? 8 : 7" class="px-4 py-4">
                  <div v-if="quickLoadingId === album.id" class="py-6 text-center text-sm font-semibold text-gray-400">Đang tải bài hát...</div>
                  <AlbumSongsTable v-else :songs="quickSongs[album.id] || []" compact />
                </td>
              </tr>
            </tbody>
          </table>
        </AdminTableShell>
        <div v-if="pagination.totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
          <span class="hidden md:inline text-sm font-medium text-gray-500">Hiển thị {{ pageStart }} - {{ pageEnd }} trong {{ pagination.total }} album</span>
          <AdminPagination :currentPage="pagination.page" :totalPages="pagination.totalPages" :disabled="isInitialLoading || isPageLoading" @update:currentPage="setPage" />
        </div>
      </div>
      </div>
    </template>

    <Teleport to="body">
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="closeModal"></div>
        <div class="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-bg-surface rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-bg-border bg-gray-50/70 dark:bg-bg-card/60">
            <h2 class="text-xl font-extrabold text-gray-900 dark:text-white">{{ editingAlbum ? 'Chỉnh sửa album' : 'Thêm album' }}</h2>
            <button @click="closeModal" class="admin-icon-button text-gray-400 hover:text-gray-700 hover:bg-gray-200">
              <MfIcon name="close" size="24" />
            </button>
          </div>

          <form @submit.prevent="submitAlbum" class="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            <div class="space-y-4">
              <div>
                <label class="admin-label">Tên album <span class="text-rose-500">*</span></label>
                <input v-model="form.title" required class="admin-input" />
              </div>
              <div class="relative" ref="artistDropdownRef">
                <label class="admin-label">Nghệ sĩ <span class="text-rose-500">*</span></label>
                <input v-model="artistSearchQuery" @focus="isArtistDropdownOpen = true" @input="handleArtistSearchInput" placeholder="Tìm hoặc chọn nghệ sĩ..." required class="admin-input" autocomplete="off" />
                <div v-if="isArtistDropdownOpen" class="absolute z-[60] w-full mt-1 bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl shadow-lg max-h-[220px] overflow-y-auto">
                  <button v-for="artist in filteredArtists" :key="artist.id" type="button" @click="selectArtist(artist)" class="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-bg-card transition-colors text-sm font-medium text-gray-700 dark:text-gray-200 h-[40px] truncate">
                    {{ artist.name }}
                  </button>
                  <div v-if="filteredArtists.length === 0" class="px-4 py-3 text-sm text-gray-500 italic">Không tìm thấy nghệ sĩ nào</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="admin-label">Năm phát hành</label>
                  <input v-model="form.release_year" type="number" min="1900" max="2100" class="admin-input" />
                </div>
                <div>
                  <label class="admin-label">Thể loại</label>
                  <select v-model="form.genre_id" class="admin-input">
                    <option value="">Chưa phân loại</option>
                    <option v-for="genre in formData.genres" :key="genre.id" :value="genre.id">{{ genre.name }}</option>
                  </select>
                  <p v-if="selectedGenreMarket" class="mt-2 text-xs font-bold text-gray-500">
                    Khu vực: <span class="text-emerald-600">{{ selectedGenreMarket }}</span>
                  </p>
                </div>
              </div>
              <div class="rounded-xl border border-gray-100 dark:border-bg-border p-4 bg-gray-50/70 dark:bg-bg-card/50">
                <label class="admin-label">Trạng thái phát hành</label>
                <select v-model="form.release_status" class="admin-input">
                  <option value="draft">Nháp</option>
                  <option value="published">Phát hành ngay</option>
                  <option value="scheduled">Lên lịch phát hành</option>
                  <option value="hidden">Ẩn</option>
                </select>
                <input v-if="form.release_status === 'scheduled'" v-model="form.release_at" type="datetime-local" class="admin-input mt-3" required />
                <p v-if="form.release_status === 'published' && selectedSongs.length === 0" class="mt-2 text-xs font-semibold text-rose-600">
                  Album rỗng không thể phát hành.
                </p>
              </div>
              <div>
                <label class="admin-label">Ảnh bìa album</label>
                <div class="flex gap-3">
                  <div class="w-24 h-24 shrink-0">
                    <img v-if="coverPreviewSrc && !coverLoadError" :src="coverPreviewSrc" @error="coverLoadError = true" class="w-full h-full rounded-xl object-cover bg-gray-100 border border-gray-200 dark:border-bg-border" />
                    <div v-else class="w-full h-full flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-bg-border">
                      <MfIcon name="image" size="24" />
                      <span class="text-[10px] mt-1 font-medium">Chưa có ảnh</span>
                    </div>
                  </div>
                  <div class="flex-1 space-y-2">
                    <input ref="coverInput" type="file" accept="image/*" hidden @change="handleCoverChange" />
                    <button type="button" @click="coverInput?.click()" class="w-full px-3 py-2 rounded-xl border border-dashed border-emerald-300 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                      Chọn ảnh
                    </button>
                    <input v-model="form.cover_url" placeholder="Hoặc nhập cover_url" class="admin-input py-2" />
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-4 min-w-0">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="text-base font-bold text-gray-900 dark:text-white">Danh sách bài hát trong album</h3>
                  <p class="text-xs text-gray-500 mt-1">Gỡ khỏi album không xóa bài hát khỏi hệ thống.</p>
                </div>
                <span class="badge">{{ selectedSongs.length }} bài</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                <input v-model="songSearch" class="admin-input" placeholder="Tìm bài hát để thêm..." />
                <select v-model="songArtistFilter" class="admin-input">
                  <option value="">Tất cả nghệ sĩ</option>
                  <option value="album_artist">Nghệ sĩ album</option>
                  <option v-for="artist in formData.artists" :key="artist.id" :value="artist.id">{{ artist.name }}</option>
                </select>
              </div>
              <div class="max-h-44 overflow-y-auto rounded-xl border border-gray-100 dark:border-bg-border bg-gray-50/70 dark:bg-bg-card/50">
                <button v-for="song in availableSongs" :key="song.id" type="button" @click="!song.disabled && addSong(song)" :disabled="song.disabled" :class="['w-full flex items-center gap-3 p-2.5 text-left border-b border-gray-100 dark:border-bg-border last:border-b-0', song.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-bg-surface']">
                  <img :src="formatImageUrl(song.cover_url)" @error="handleImageError" class="w-9 h-9 rounded-lg object-cover bg-gray-100" />
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm font-bold text-gray-900 dark:text-white truncate">{{ song.title }}</span>
                    <span class="block text-xs text-gray-500 truncate">{{ song.artist_name }}<template v-if="song.album_title"> - {{ song.album_title }}</template></span>
                  </span>
                  <span v-if="song.disabled" class="text-xs text-rose-500 font-bold ml-auto shrink-0 pr-2">{{ song.reason }}</span>
                  <MfIcon v-else name="add" size="18" className="text-emerald-600 shrink-0" />
                </button>
                <div v-if="availableSongs.length === 0" class="p-4 text-center text-sm text-gray-400">Không có bài hát khả dụng.</div>
              </div>
              <draggable v-model="selectedSongs" item-key="id" handle=".drag-handle" ghost-class="drag-ghost" class="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                <template #item="{ element: song, index }">
                <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-bg-border bg-white dark:bg-bg-card">
                  <button type="button" class="drag-handle admin-icon-button text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-grab active:cursor-grabbing" title="Kéo để sắp xếp">
                    <MfIcon name="drag_indicator" size="20" />
                  </button>
                  <span class="w-7 text-right text-xs font-bold text-gray-400">{{ index + 1 }}</span>
                  <img :src="formatImageUrl(song.cover_url)" @error="handleImageError" class="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-gray-900 dark:text-white truncate">{{ song.title }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ song.artist_name }} - {{ song.genre_name || 'Chưa phân loại' }}</p>
                  </div>
                  <button type="button" @click="removeSong(song)" class="admin-icon-button text-gray-400 hover:text-rose-600 hover:bg-rose-50" title="Gỡ khỏi album">
                    <MfIcon name="close" size="20" />
                  </button>
                </div>
                </template>
              </draggable>
              <div v-if="selectedSongs.length === 0" class="p-8 text-center text-sm font-semibold text-gray-500 bg-white dark:bg-bg-surface rounded-xl">
                Album chưa có bài hát.
              </div>
              <div v-if="modalMessage" :class="['p-3 rounded-xl text-sm font-bold', modalError ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600']">{{ modalMessage }}</div>
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" @click="closeModal" class="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50">Hủy</button>
                <button type="submit" :disabled="saving" class="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {{ saving ? 'Đang lưu...' : 'Lưu album' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="deleteTarget" class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="closeDeleteConfirm"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-bg-surface rounded-2xl shadow-2xl p-6 text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-50 mb-4">
            <MfIcon name="delete_outline" size="32" className="text-rose-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Xóa album</h3>
          <p class="text-sm text-gray-500 mb-8">Bạn có chắc muốn xóa album "{{ deleteTarget?.title }}"? Bài hát sẽ không bị xóa.</p>
          <div class="flex gap-3">
            <button type="button" class="flex-1 rounded-xl border border-gray-200 px-4 py-3 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50" @click="closeDeleteConfirm">Hủy</button>
            <button type="button" class="flex-1 rounded-xl px-4 py-3 bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60" @click="deleteAlbum" :disabled="deleting">{{ deleting ? 'Đang xóa...' : 'Xóa' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="removeSongTarget" class="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="closeRemoveSongConfirm"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-bg-surface rounded-2xl shadow-2xl p-6 text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-50 mb-4">
            <MfIcon name="close" size="32" className="text-rose-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Gỡ bài hát</h3>
          <p class="text-sm text-gray-500 mb-8">Bạn có chắc muốn gỡ bài hát "{{ removeSongTarget?.title }}" khỏi album này?</p>
          <div class="flex gap-3">
            <button type="button" class="flex-1 rounded-xl border border-gray-200 px-4 py-3 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50" @click="closeRemoveSongConfirm">Hủy</button>
            <button type="button" class="flex-1 rounded-xl px-4 py-3 bg-rose-600 text-sm font-bold text-white hover:bg-rose-700" @click="executeRemoveSong">Gỡ bài hát</button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="quickReleaseTarget" class="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="closeQuickReleaseConfirm"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-bg-surface rounded-2xl shadow-2xl p-6 text-center">
          <div :class="['mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4', quickReleaseStatus === 'published' ? 'bg-emerald-50' : 'bg-rose-50']">
            <MfIcon :name="quickReleaseStatus === 'published' ? 'publish' : (quickReleaseStatus === 'hidden' ? 'visibility_off' : 'undo')" size="32" :className="quickReleaseStatus === 'published' ? 'text-emerald-600' : 'text-rose-600'" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Xác nhận</h3>
          <p class="text-sm text-gray-500 mb-8">Bạn có chắc muốn {{ quickReleaseLabel }} album "{{ quickReleaseTarget?.title }}"?</p>
          <div class="flex gap-3">
            <button type="button" class="flex-1 rounded-xl border border-gray-200 px-4 py-3 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50" @click="closeQuickReleaseConfirm">Hủy</button>
            <button type="button" :class="['flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60', quickReleaseStatus === 'published' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700']" @click="executeQuickRelease" :disabled="quickReleaseLoading">
              {{ quickReleaseLoading ? 'Đang xử lý...' : 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import api from '@/api/axios'
import AdminAddButton from '@/components/admin/AdminAddButton.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import { useToastStore } from '@/stores/toast'

const AlbumSongsTable = defineComponent({
  props: {
    songs: { type: Array, default: () => [] },
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    const formatDuration = seconds => {
      const total = Number(seconds || 0)
      const m = Math.floor(total / 60)
      const s = total % 60
      return `${m}:${String(s).padStart(2, '0')}`
    }
    const image = url => {
      if (!url) return '/default-cover.png'
      return String(url).startsWith('http') ? url : `http://127.0.0.1:3000${url}`
    }
    return () => {
      if (!props.songs.length) {
        return h('div', { class: 'p-8 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-bg-surface rounded-xl' }, 'Album này chưa có bài hát.')
      }
      return h('div', { class: 'overflow-x-auto' }, [
        h('table', { class: 'w-full text-left border-collapse' }, [
          h('thead', [
            h('tr', { class: 'text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-bg-border' }, [
              h('th', { class: 'py-2 px-3 w-12' }, '#'),
              h('th', { class: 'py-2 px-3 min-w-[260px]' }, 'Bài hát'),
              h('th', { class: 'py-2 px-3' }, 'Nghệ sĩ'),
              h('th', { class: 'py-2 px-3 text-center' }, 'Phát hành'),
              h('th', { class: 'py-2 px-3 text-right' }, 'Thời lượng'),
            ]),
          ]),
          h('tbody', { class: 'divide-y divide-gray-100 dark:divide-bg-border' }, props.songs.map((song, index) => (
            h('tr', { key: song.id, class: 'hover:bg-gray-50 dark:hover:bg-bg-card' }, [
              h('td', { class: 'py-2 px-3 text-sm font-bold text-gray-400' }, String(song.track_number || index + 1)),
              h('td', { class: 'py-2 px-3' }, [
                h('div', { class: 'flex items-center gap-3' }, [
                  h('img', { src: image(song.cover_url), class: `${props.compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-lg object-cover bg-gray-100` }),
                  h(RouterLink, { to: `/admin/songs/${song.id}`, class: 'truncate text-sm font-bold text-gray-900 hover:text-indigo-600 hover:underline dark:text-white', title: song.title }, () => song.title),
                ]),
              ]),
              h('td', { class: 'py-2 px-3 text-sm text-gray-600 dark:text-gray-300' }, song.artist_name || '-'),
              h('td', { class: 'py-2 px-3 text-center text-xs font-bold text-gray-500' }, song.effective_release_status || song.release_status || '-'),
              h('td', { class: 'py-2 px-3 text-right text-sm text-gray-500' }, formatDuration(song.duration_sec)),
            ])
          ))),
        ]),
      ])
    }
  },
})

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const isDetailMode = computed(() => Boolean(route.params.id))

const albums = ref([])
const isInitialLoading = ref(false)
const isPageLoading = ref(false)
const isStatsLoading = ref(false)
const pagination = reactive({ total: 0, page: 1, limit: 20, totalPages: 1 })
const filters = reactive({ search: '', genreId: '', releaseYear: '', market: '', sortPlays: '', releaseStatus: '' })
const meta = reactive({ artists: [], genres: [], markets: [], supportsMarketFilter: false })

const detail = reactive({ album: null, artist: null, stats: {}, songs: [], schema: {} })
const detailLoading = ref(false)
const detailError = ref('')

const expandedAlbumId = ref(null)
const quickSongs = reactive({})
const quickLoadingId = ref(null)
const expandedRows = computed(() => albums.value.filter(album => expandedAlbumId.value === album.id))

const modalOpen = ref(false)
const editingAlbum = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const modalMessage = ref('')
const modalError = ref(false)
const coverInput = ref(null)
const coverObjectUrl = ref('')
const coverLoadError = ref(false)
const songSearch = ref('')
const songArtistFilter = ref('album_artist')
const selectedSongs = ref([])
const fetchedAvailableSongs = ref([])
const formData = reactive({ artists: [], genres: [], songs: [], supportsTrackOrder: false })
const form = reactive({
  title: '',
  artist_id: '',
  genre_id: '',
  release_year: '',
  release_status: 'draft',
  release_at: '',
  cover_url: '',
  cover: null,
})

const artistDropdownRef = ref(null)
const isArtistDropdownOpen = ref(false)
const artistSearchQuery = ref('')

const filteredArtists = computed(() => {
  const q = artistSearchQuery.value.trim().toLowerCase()
  if (!q) return formData.artists
  const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const normalizedQ = normalize(q)
  return formData.artists.filter(a => normalize(a.name).includes(normalizedQ))
})

function handleArtistSearchInput() {
  isArtistDropdownOpen.value = true
  if (!artistSearchQuery.value.trim()) {
    form.artist_id = ''
    form.genre_id = ''
    handleArtistChange()
  } else {
    form.artist_id = ''
  }
}

function selectArtist(artist) {
  form.artist_id = artist.id
  artistSearchQuery.value = artist.name
  isArtistDropdownOpen.value = false
  if (artist.primary_genre_id) {
    form.genre_id = artist.primary_genre_id
  } else {
    form.genre_id = ''
  }
  handleArtistChange()
}

function closeDropdownOnOutsideClick(e) {
  if (artistDropdownRef.value && !artistDropdownRef.value.contains(e.target)) {
    isArtistDropdownOpen.value = false
  }
}

const pageStart = computed(() => pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1)
const pageEnd = computed(() => Math.min(pagination.page * pagination.limit, pagination.total))
const albumStats = reactive({
  total: 0,
  draft: 0,
  scheduled: 0,
  published: 0,
  hidden: 0,
  empty: 0,
})

const kpiCards = computed(() => [
  {
    title: 'Tổng album',
    value: albumStats.total,
    icon: 'album',
    tone: 'blue'
  },
  {
    title: 'Nháp',
    value: albumStats.draft,
    icon: 'edit_document',
    tone: 'slate'
  },
  {
    title: 'Lên lịch',
    value: albumStats.scheduled,
    icon: 'schedule',
    tone: 'amber'
  },
  {
    title: 'Đã phát hành',
    value: albumStats.published,
    icon: 'check_circle',
    tone: 'green'
  },
  {
    title: 'Đã ẩn',
    value: albumStats.hidden,
    icon: 'visibility_off',
    tone: 'rose'
  },
  {
    title: 'Album rỗng',
    value: albumStats.empty,
    icon: 'hourglass_empty',
    tone: 'purple'
  }
])
const selectedSongIds = computed(() => new Set(selectedSongs.value.map(song => Number(song.id))))
const availableSongs = computed(() => {
  const query = songSearch.value.trim().toLowerCase()
  const albumArtistId = Number(form.artist_id || 0)
  return fetchedAvailableSongs.value
    .filter(song => !selectedSongIds.value.has(Number(song.id)))
    .filter(song => {
      if (songArtistFilter.value === 'album_artist') return !albumArtistId || Number(song.artist_id) === albumArtistId
      if (songArtistFilter.value) return Number(song.artist_id) === Number(songArtistFilter.value)
      return true
    })
    .filter(song => !query || `${song.title} ${song.artist_name} ${song.album_title || ''}`.toLowerCase().includes(query))
    .map(song => ({ ...song, disabled: !song.can_add_to_album }))
    .slice(0, 80)
})
const selectedGenreMarket = computed(() => {
  const genre = formData.genres.find(item => String(item.id) === String(form.genre_id))
  return deriveMarketFromGenreName(genre?.name)
})

const coverPreviewSrc = computed(() => {
  if (coverObjectUrl.value) return coverObjectUrl.value
  if (form.cover_url && String(form.cover_url).trim()) {
    const url = String(form.cover_url).trim()
    return url.startsWith('http') ? url : `http://127.0.0.1:3000${url}`
  }
  return ''
})

let searchTimer = null
watch(() => ({ ...filters }), () => {
  pagination.page = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchAlbums()
    fetchStats()
  }, 300)
}, { deep: true })

const searchHistory = ref(JSON.parse(localStorage.getItem('adminAlbumsSearchHistory') || '[]'))
const showHistory = ref(false)

const handleEnter = () => {
  const term = filters.search.trim()
  if (term && !searchHistory.value.includes(term)) {
    searchHistory.value.unshift(term)
    if (searchHistory.value.length > 5) searchHistory.value.pop()
    localStorage.setItem('adminAlbumsSearchHistory', JSON.stringify(searchHistory.value))
  }
  showHistory.value = false
}

const selectHistoryItem = (item) => {
  filters.search = item
  showHistory.value = false
}

const clearSearch = () => {
  filters.search = ''
  showHistory.value = false
}

const handleBlur = () => {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

const removeHistoryItem = (item) => {
  searchHistory.value = searchHistory.value.filter(i => i !== item)
  localStorage.setItem('adminAlbumsSearchHistory', JSON.stringify(searchHistory.value))
}

watch(() => route.params.id, () => {
  if (isDetailMode.value) fetchDetail()
  else {
    fetchAlbums()
    fetchStats()
  }
})

onMounted(() => {
  document.addEventListener('click', closeDropdownOnOutsideClick)
  if (isDetailMode.value) fetchDetail()
  else {
    fetchAlbums()
    fetchStats()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdownOnOutsideClick)
})

let currentRequestId = 0

function getAlbumActions(album) {
  const actions = []

  actions.push({
    label: expandedAlbumId.value === album.id ? 'Đóng danh sách bài hát' : 'Xem nhanh bài hát',
    icon: expandedAlbumId.value === album.id ? 'expand_less' : 'queue_music',
    onClick: () => toggleQuickView(album)
  })

  actions.push({
    label: 'Xem chi tiết',
    icon: 'visibility',
    onClick: () => router.push(`/admin/albums/${album.id}/detail`)
  })

  actions.push({
    label: 'Chỉnh sửa',
    icon: 'edit',
    onClick: () => openEditModal(album)
  })

  if (album.release_status !== 'published') {
    actions.push({
      label: 'Phát hành',
      icon: 'publish',
      variant: 'success',
      onClick: () => quickRelease(album, 'published')
    })
  }

  if (album.release_status === 'published') {
    actions.push({
      label: 'Ẩn album',
      icon: 'visibility_off',
      variant: 'warning',
      onClick: () => quickRelease(album, 'hidden')
    })
  }

  if (album.release_status === 'scheduled') {
    actions.push({
      label: 'Chuyển về nháp',
      icon: 'undo',
      onClick: () => quickRelease(album, 'draft')
    })
  }

  actions.push({
    label: 'Xóa album',
    icon: 'delete',
    variant: 'danger',
    onClick: () => confirmDelete(album)
  })

  return actions
}

async function fetchAlbums() {
  if (isDetailMode.value) return
  
  const requestId = ++currentRequestId
  if (albums.value.length === 0) isInitialLoading.value = true
  else isPageLoading.value = true
  
  try {
    const res = await api.get('/admin/albums', {
      params: {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        genreId: filters.genreId,
        releaseYear: filters.releaseYear,
        market: filters.market,
        sortPlays: filters.sortPlays,
        releaseStatus: filters.releaseStatus,
      },
    })
    
    if (requestId !== currentRequestId) return

    if (res.data?.success) {
      albums.value = res.data.data || []
      Object.assign(pagination, res.data.pagination || {})
      Object.assign(meta, res.data.meta || {})
    }
  } catch (err) {
    if (requestId === currentRequestId) toastStore.showToast('Lỗi tải danh sách album', 'error')
  } finally {
    if (requestId === currentRequestId) {
      isInitialLoading.value = false
      isPageLoading.value = false
    }
  }
}

let statsRequestId = 0

async function fetchStats() {
  if (isDetailMode.value) return
  
  const requestId = ++statsRequestId
  if (!albumStats.total) isStatsLoading.value = true
  
  try {
    const res = await api.get('/admin/albums/stats', {
      params: {
        search: filters.search,
        genreId: filters.genreId,
        releaseYear: filters.releaseYear,
        market: filters.market,
      },
    })
    
    if (requestId !== statsRequestId) return
    
    if (res.data?.success) {
      Object.assign(albumStats, res.data.data)
    }
  } catch (e) {
    // Ignore error to avoid blocking UI
  } finally {
    if (requestId === statsRequestId) {
      isStatsLoading.value = false
    }
  }
}

async function fetchDetail() {
  detailLoading.value = true
  detailError.value = ''
  try {
    const res = await api.get(`/admin/albums/${route.params.id}/detail`)
    if (res.data?.success) Object.assign(detail, res.data.data)
    else detailError.value = res.data?.message || 'Không thể tải dữ liệu album'
  } catch (err) {
    detailError.value = err.response?.data?.message || 'Không thể tải dữ liệu album'
  } finally {
    detailLoading.value = false
  }
}

async function fetchAvailableSongsFromApi() {
  if (!form.artist_id) {
    fetchedAvailableSongs.value = []
    return
  }
  try {
    const params = { artistId: form.artist_id }
    if (editingAlbum.value) params.albumId = editingAlbum.value.id
    const res = await api.get('/admin/albums/available-songs', { params })
    if (res.data?.success) fetchedAvailableSongs.value = res.data.data || []
  } catch {
    fetchedAvailableSongs.value = []
  }
}

function handleArtistChange() {
  selectedSongs.value = []
  fetchAvailableSongsFromApi()
}

async function loadFormData() {
  if (formData.artists.length) return
  const res = await api.get('/admin/albums/form-data')
  if (res.data?.success) Object.assign(formData, res.data.data)
}

async function toggleQuickView(album) {
  if (expandedAlbumId.value === album.id) {
    expandedAlbumId.value = null
    return
  }
  expandedAlbumId.value = album.id
  if (quickSongs[album.id]) return
  quickLoadingId.value = album.id
  try {
    const res = await api.get(`/admin/albums/${album.id}/detail`)
    quickSongs[album.id] = res.data?.data?.songs || []
  } finally {
    quickLoadingId.value = null
  }
}

function setPage(page) {
  pagination.page = page
  fetchAlbums()
}

function resetFilters() {
  filters.search = ''
  filters.genreId = ''
  filters.releaseYear = ''
  filters.market = ''
  filters.sortPlays = ''
  filters.releaseStatus = ''
}

async function openCreateModal() {
  await loadFormData()
  editingAlbum.value = null
  resetForm()
  modalOpen.value = true
}

async function openEditModal(album) {
  await loadFormData()
  const res = await api.get(`/admin/albums/${album.id}/detail`)
  const data = res.data?.data
  editingAlbum.value = data?.album || album
  resetForm()
  form.title = editingAlbum.value.title || ''
  form.artist_id = editingAlbum.value.artist_id || ''
  const artistObj = formData.artists.find(a => Number(a.id) === Number(form.artist_id))
  artistSearchQuery.value = artistObj ? artistObj.name : ''
  form.genre_id = editingAlbum.value.genre_id || ''
  form.release_year = editingAlbum.value.release_year || ''
  form.release_status = editingAlbum.value.release_status || 'draft'
  form.release_at = toDateTimeLocal(editingAlbum.value.release_at)
  form.cover_url = editingAlbum.value.stored_cover_url || editingAlbum.value.cover_url || ''
  selectedSongs.value = data?.songs ? [...data.songs] : []
  await fetchAvailableSongsFromApi()
  modalOpen.value = true
}

function resetForm() {
  form.title = ''
  form.artist_id = ''
  artistSearchQuery.value = ''
  form.genre_id = ''
  form.release_year = ''
  form.release_status = 'draft'
  form.release_at = ''
  form.cover_url = ''
  form.cover = null
  selectedSongs.value = []
  songSearch.value = ''
  songArtistFilter.value = 'album_artist'
  modalMessage.value = ''
  modalError.value = false
  coverLoadError.value = false
  if (coverObjectUrl.value) URL.revokeObjectURL(coverObjectUrl.value)
  coverObjectUrl.value = ''
}

function closeModal() {
  modalOpen.value = false
  if (coverObjectUrl.value) URL.revokeObjectURL(coverObjectUrl.value)
  coverObjectUrl.value = ''
}

function handleCoverChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    modalMessage.value = 'Vui lòng chọn file hình ảnh.'
    modalError.value = true
    return
  }
  form.cover = file
  coverLoadError.value = false
  if (coverObjectUrl.value) URL.revokeObjectURL(coverObjectUrl.value)
  coverObjectUrl.value = URL.createObjectURL(file)
}

function addSong(song) {
  if (song.disabled) return
  selectedSongs.value.push({ ...song })
}

const removeSongTarget = ref(null)

function removeSong(song) {
  removeSongTarget.value = song
}

function closeRemoveSongConfirm() {
  removeSongTarget.value = null
}

function executeRemoveSong() {
  if (!removeSongTarget.value) return
  selectedSongs.value = selectedSongs.value.filter(s => Number(s.id) !== Number(removeSongTarget.value.id))
  toastStore.showToast(`Đã gỡ bài hát "${removeSongTarget.value.title}" khỏi album.`, 'success')
  removeSongTarget.value = null
}

async function submitAlbum() {
  modalMessage.value = ''
  modalError.value = false
  if (!form.title.trim() || !form.artist_id) {
    modalMessage.value = 'Tên album và nghệ sĩ là bắt buộc.'
    modalError.value = true
    return
  }
  if (form.release_status === 'published' && selectedSongs.value.length === 0) {
    modalMessage.value = 'Album rỗng không thể phát hành.'
    modalError.value = true
    return
  }
  saving.value = true
  try {
    const payload = new FormData()
    payload.append('title', form.title.trim())
    payload.append('artist_id', form.artist_id)
    payload.append('genre_id', form.genre_id || '')
    payload.append('release_year', form.release_year || '')
    payload.append('release_status', form.release_status || 'draft')
    payload.append('release_at', form.release_status === 'scheduled' ? form.release_at : '')
    payload.append('cover_url', form.cover_url || '')
    payload.append('song_ids', JSON.stringify(selectedSongs.value.map(song => song.id)))
    if (form.cover) payload.append('cover', form.cover)

    if (editingAlbum.value) {
      await api.put(`/admin/albums/${editingAlbum.value.id}`, payload)
      toastStore.showToast('Đã cập nhật album thành công.', 'success')
    } else {
      await api.post('/admin/albums', payload)
      toastStore.showToast('Đã thêm album thành công.', 'success')
    }

    closeModal()
    if (isDetailMode.value) await fetchDetail()
    else await fetchAlbums()
  } catch (err) {
    modalMessage.value = err.response?.data?.message || 'Không thể lưu album.'
    modalError.value = true
  } finally {
    saving.value = false
  }
}

const quickReleaseTarget = ref(null)
const quickReleaseStatus = ref('')
const quickReleaseLoading = ref(false)

const quickReleaseLabel = computed(() => {
  const labels = { published: 'phát hành', hidden: 'ẩn', draft: 'chuyển về nháp' }
  return labels[quickReleaseStatus.value] || 'cập nhật'
})

function quickRelease(album, status) {
  quickReleaseTarget.value = album
  quickReleaseStatus.value = status
}

function closeQuickReleaseConfirm() {
  if (quickReleaseLoading.value) return
  quickReleaseTarget.value = null
  quickReleaseStatus.value = ''
}

async function executeQuickRelease() {
  if (!quickReleaseTarget.value) return
  quickReleaseLoading.value = true
  try {
    await api.put(`/admin/albums/${quickReleaseTarget.value.id}`, { release_status: quickReleaseStatus.value })
    toastStore.showToast('Đã cập nhật trạng thái phát hành.', 'success')
    quickReleaseTarget.value = null
    quickReleaseStatus.value = ''
    if (isDetailMode.value) await fetchDetail()
    else await fetchAlbums()
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Không thể cập nhật trạng thái.', 'error')
  } finally {
    quickReleaseLoading.value = false
  }
}

function confirmDelete(album) {
  deleteTarget.value = album
}

function closeDeleteConfirm() {
  if (deleting.value) return
  deleteTarget.value = null
}

async function deleteAlbum() {
  if (!deleteTarget.value) return
  const album = deleteTarget.value
  deleting.value = true
  try {
    await api.delete(`/admin/albums/${album.id}`)
    toastStore.showToast(`Đã xóa album "${album.title}".`, 'success')
    deleteTarget.value = null
    if (isDetailMode.value) router.push('/admin/albums')
    else await fetchAlbums()
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Không thể xóa album.', 'error')
  } finally {
    deleting.value = false
  }
}

function releaseLabel(item) {
  if (item?.release_status === 'scheduled' && item?.effective_release_status === 'published') return 'Đã phát hành theo lịch'
  return {
    draft: 'Nháp',
    scheduled: 'Lên lịch',
    published: 'Đã phát hành',
    hidden: 'Đã ẩn',
  }[item?.release_status] || 'Không rõ'
}

function releaseBadgeClass(item) {
  const effective = item?.effective_release_status || item?.release_status
  if (item?.release_status === 'scheduled' && effective === 'published') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  return {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    scheduled: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    hidden: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  }[item?.release_status] || 'bg-gray-100 text-gray-700'
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function goToArtist(artistId) {
  if (artistId) router.push(`/admin/artists/${artistId}/detail`)
}

function formatImageUrl(url) {
  if (!url) return '/default-cover.png'
  return String(url).startsWith('http') ? url : `http://127.0.0.1:3000${url}`
}

function handleImageError(event) {
  if (!event.target.src.includes('default-cover.png')) event.target.src = '/default-cover.png'
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0)
}

function deriveMarketFromGenreName(name) {
  const genreName = String(name || '').trim().toUpperCase()
  if (!genreName) return ''
  if (genreName.startsWith('KPOP') || genreName.startsWith('K-POP')) return 'KPOP'
  if (genreName.startsWith('VPOP') || genreName.startsWith('V-POP')) return 'VPOP'
  if (genreName.startsWith('USUK') || genreName.startsWith('US-UK')) return 'USUK'
  return 'OTHER'
}
</script>

<style scoped>
.panel {
  border: 1px solid rgb(243 244 246);
  border-radius: 1rem;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.dark .panel {
  border-color: var(--color-bg-border, #273142);
  background: var(--color-bg-surface, #111827);
}
.admin-input {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgb(229 231 235);
  background: white;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(17 24 39);
  outline: none;
}
.album-search-input {
  padding-left: 2.5rem;
}
.admin-input:focus {
  border-color: rgb(16 185 129);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.18);
}
.dark .admin-input {
  border-color: var(--color-bg-border, #273142);
  background: var(--color-bg-card, #151c2b);
  color: white;
}
.admin-label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  color: rgb(5 150 105);
}
.admin-icon-button {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  background: rgb(243 244 246);
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: rgb(75 85 99);
}
.dark .badge {
  background: rgba(55, 65, 81, 0.7);
  color: rgb(209 213 219);
}
.stat-card {
  border-radius: 0.875rem;
  border: 1px solid rgb(243 244 246);
  background: white;
  padding: 0.875rem 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.stat-card span {
  display: block;
  font-size: 0.75rem;
  font-weight: 800;
  color: rgb(107 114 128);
}
.stat-card strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.25rem;
  color: rgb(17 24 39);
}
.dark .stat-card {
  border-color: var(--color-bg-border, #273142);
  background: var(--color-bg-surface, #111827);
}
.dark .stat-card strong {
  color: white;
}
.drag-ghost {
  opacity: 0.45;
}
.metric-box {
  border-radius: 0.75rem;
  border: 1px solid rgb(243 244 246);
  background: rgb(249 250 251);
  padding: 0.875rem;
}
.metric-box span {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(107 114 128);
}
.metric-box strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1rem;
  color: rgb(17 24 39);
}
.dark .metric-box {
  border-color: var(--color-bg-border, #273142);
  background: var(--color-bg-card, #151c2b);
}
.dark .metric-box strong {
  color: white;
}

.full-bleed {
  margin: -24px;
  height: calc(100% + 48px);
}
@media (max-width: 900px) {
  .full-bleed {
    margin: -18px;
    height: calc(100% + 36px);
  }
}
</style>
