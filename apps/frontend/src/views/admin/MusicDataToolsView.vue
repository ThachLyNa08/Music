<template>
  <div class="music-data-tools">
    <!-- 1. Header -->
    <header class="header-section">
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h1 class="text-2xl font-bold text-slate-900">Music Data Tools</h1>
            <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">BETA</span>
          </div>
          <p class="text-slate-500 text-sm mt-1">Quản lý, bổ sung và bảo trì dữ liệu thư viện nhạc.</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right mr-2 hidden md:block">
            <div class="text-xs text-slate-400">Cập nhật lần cuối</div>
            <div class="text-sm font-medium text-slate-700">{{ lastUpdatedStr }}</div>
          </div>
          <button @click="refreshData" class="inline-flex items-center justify-center w-9 h-9 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95" :disabled="loading" title="Refresh">
            <MfIcon name="sync" :class="{ 'fa-spin': loading }" size="18" />
          </button>
          <div class="relative" v-if="selectedIds.length > 0">
            <button @click="toggleBulkMenu" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-500/30 active:scale-95">
              <MfIcon name="playlist_add_check" size="16" />
              <span>Thao tác hàng loạt ({{ selectedIds.length }})</span>
            </button>
            <div v-if="showBulkMenu" class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <button @click="bulkFetchCover" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Fetch Cover</button>
              <button @click="bulkAnalyzeFeatures" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Analyze Features</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 2. KPI Cards -->
    <section class="mb-8 mt-6">
      <div v-if="loading && !summary" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-pulse">
        <div v-for="i in 6" :key="i" class="h-32 bg-slate-200 rounded-2xl"></div>
      </div>
      <div v-else-if="summary" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <!-- Total Songs -->
        <div class="kpi-card total bg-white rounded-2xl p-5 border border-slate-200 card-hover shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <MfIcon name="library_music" size="20" />
            </div>
          </div>
          <div class="text-2xl font-bold text-slate-900 mb-1">{{ summary.totalSongs.toLocaleString() }}</div>
          <div class="text-sm text-slate-500">Tổng bài hát</div>
        </div>

        <!-- Cover Status -->
        <div class="kpi-card cover bg-white rounded-2xl p-5 border border-slate-200 card-hover shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <MfIcon name="image" size="20" />
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Thiếu</div>
              <div class="text-sm font-bold text-red-500">{{ (summary.cover.total - summary.cover.has).toLocaleString() }}</div>
            </div>
          </div>
          <div class="text-2xl font-bold text-slate-900 mb-1">{{ summary.cover.has.toLocaleString() }}</div>
          <div class="text-sm text-slate-500">Cover <span class="text-emerald-600 font-medium">Đã có</span></div>
          <div class="mt-2 w-full bg-slate-100 rounded-full h-1.5">
            <div class="bg-emerald-500 h-1.5 rounded-full" :style="{ width: percent(summary.cover.has, summary.cover.total) + '%' }"></div>
          </div>
        </div>

        <!-- Lyrics Status -->
        <div class="kpi-card lyrics bg-white rounded-2xl p-5 border border-slate-200 card-hover shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <MfIcon name="article" size="20" />
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Thiếu</div>
              <div class="text-sm font-bold text-red-500">{{ (summary.lyrics.total - summary.lyrics.has).toLocaleString() }}</div>
            </div>
          </div>
          <div class="text-2xl font-bold text-slate-900 mb-1">{{ summary.lyrics.has.toLocaleString() }}</div>
          <div class="text-sm text-slate-500">Lyrics <span class="text-purple-600 font-medium">Đã có</span></div>
          <div class="mt-2 w-full bg-slate-100 rounded-full h-1.5">
            <div class="bg-purple-500 h-1.5 rounded-full" :style="{ width: percent(summary.lyrics.has, summary.lyrics.total) + '%' }"></div>
          </div>
        </div>

        <!-- Audio Features -->
        <div class="kpi-card audio bg-white rounded-2xl p-5 border border-slate-200 card-hover shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <MfIcon name="equalizer" size="20" />
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Chưa</div>
              <div class="text-sm font-bold text-red-500">{{ (summary.audioFeatures.total - summary.audioFeatures.has).toLocaleString() }}</div>
            </div>
          </div>
          <div class="text-2xl font-bold text-slate-900 mb-1">{{ summary.audioFeatures.has.toLocaleString() }}</div>
          <div class="text-sm text-slate-500">Audio Features <span class="text-amber-600 font-medium">Đã phân tích</span></div>
          <div class="mt-2 w-full bg-slate-100 rounded-full h-1.5">
            <div class="bg-amber-500 h-1.5 rounded-full" :style="{ width: percent(summary.audioFeatures.has, summary.audioFeatures.total) + '%' }"></div>
          </div>
        </div>

        <!-- Metadata Health -->
        <div class="kpi-card health bg-white rounded-2xl p-5 border border-slate-200 card-hover shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div class="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
              <MfIcon name="favorite" size="20" />
            </div>
            <span class="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Avg</span>
          </div>
          <div class="text-2xl font-bold text-slate-900 mb-1">{{ overallHealthPercent }}%</div>
          <div class="text-sm text-slate-500">Metadata Health</div>
          <div class="mt-2 flex items-center gap-2">
            <div class="flex-1 bg-slate-100 rounded-full h-1.5">
              <div class="bg-cyan-500 h-1.5 rounded-full" :style="{ width: overallHealthPercent + '%' }"></div>
            </div>
            <span class="text-xs text-cyan-600 font-medium">{{ getHealthLabelByPercent(overallHealthPercent) }}</span>
          </div>
        </div>

        <!-- Cần xử lý -->
        <div class="kpi-card processing bg-white rounded-2xl p-5 border border-slate-200 card-hover shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div class="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <MfIcon name="warning" size="20" />
            </div>
          </div>
          <div class="text-2xl font-bold text-slate-900 mb-1">{{ totalMissingMetadata.toLocaleString() }}</div>
          <div class="text-sm text-slate-500">Cần xử lý <span class="text-rose-600 font-medium">Missing data</span></div>
        </div>
      </div>
    </section>

    <!-- 3. Filter Bar -->
    <section class="mb-6">
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div class="flex flex-col xl:flex-row gap-4">
          <!-- Search -->
          <div class="flex-1 min-w-[240px]">
            <div class="relative">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <MfIcon name="search" size="18" />
              </div>
              <input 
                v-model="filters.search" 
                type="text" 
                placeholder="Tìm kiếm bài hát, nghệ sĩ..." 
                @keyup.enter="applyFilters"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
            </div>
          </div>

          <!-- Filters -->
          <div class="flex flex-wrap gap-3">
            <select v-model="filters.missing" @change="applyFilters" class="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[140px]">
              <option value="">Tất cả trạng thái</option>
              <option value="cover">Thiếu Cover</option>
              <option value="lyrics">Thiếu Lyrics</option>
              <option value="features">Thiếu Audio Features</option>
            </select>
            
            <!-- Dummy filter (TODO) -->
            <select disabled title="TODO: Tích hợp API lọc theo Nghệ sĩ" class="opacity-50 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 cursor-not-allowed min-w-[140px]">
              <option>Tất cả nghệ sĩ</option>
            </select>
            
            <select disabled title="TODO: Tích hợp API lọc theo Thể loại" class="opacity-50 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 cursor-not-allowed min-w-[140px]">
              <option>Tất cả thể loại</option>
            </select>

            <button @click="resetFilters" class="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Data Table -->
    <section class="mb-8">
      <div v-if="loading && songs.length === 0" class="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div class="animate-pulse space-y-4">
          <div class="flex gap-4"><div class="h-10 bg-slate-200 rounded w-1/4"></div></div>
          <div class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-slate-100 rounded"></div>
          </div>
        </div>
      </div>

      <div v-else-if="songs.length === 0" class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <div class="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <MfIcon name="music_off" size="40" class="text-slate-300" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-2">Chưa có bài hát nào</h3>
        <p class="text-sm text-slate-500 max-w-md mx-auto">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
      </div>

      <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Table Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
            <span class="text-sm font-semibold text-slate-700">Danh sách bài hát</span>
            <span class="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full font-medium">{{ pagination.total.toLocaleString() }}</span>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-200">
                <th class="px-6 py-3 w-4"></th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cover</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bài hát</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nghệ sĩ</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Album</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Health</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Cover</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Lyrics</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Audio</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Updated</th>
                <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(song, index) in songs" :key="song.id" class="table-row-hover transition-colors group cursor-pointer" @click="openDetail(song.id)">
                <td class="px-6 py-4" @click.stop>
                  <input type="checkbox" :value="song.id" v-model="selectedIds" class="w-4 h-4 rounded border-slate-300 text-indigo-600">
                </td>
                <td class="px-4 py-4" @click.stop="openDetail(song.id)">
                  <div class="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 group-hover:ring-2 group-hover:ring-indigo-500/30 transition-all">
                    <AdminCoverThumb :src="song.cover_url" size="custom" class="w-full h-full" rounded="none" />
                  </div>
                </td>
                <td class="px-4 py-4" @click.stop="openDetail(song.id)">
                  <div class="font-medium text-slate-900 text-sm truncate max-w-[200px]">{{ song.title }}</div>
                </td>
                <td class="px-4 py-4">
                  <div class="text-sm text-slate-700 truncate max-w-[150px]">{{ song.artist_name || 'Unknown' }}</div>
                </td>
                <td class="px-4 py-4">
                  <div class="text-sm text-slate-500 truncate max-w-[120px]">{{ song.album_title || 'N/A' }}</div>
                </td>
                <td class="px-4 py-4 text-center">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap" :class="getSongHealthBadgeClass(song)">
                    <span class="w-1.5 h-1.5 rounded-full" :class="getSongHealthDotClass(song)"></span>
                    {{ getSongHealthScore(song) }}%
                  </span>
                </td>
                <td class="px-4 py-4 text-center">
                  <span class="inline-flex items-center justify-center w-7 h-7 rounded-full" :class="song.has_cover ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'">
                    <MfIcon :name="song.has_cover ? 'check' : 'close'" size="14" />
                  </span>
                </td>
                <td class="px-4 py-4 text-center">
                  <span class="inline-flex items-center justify-center w-7 h-7 rounded-full" :class="song.has_lyrics ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'">
                    <MfIcon :name="song.has_lyrics ? 'check' : 'close'" size="14" />
                  </span>
                </td>
                <td class="px-4 py-4 text-center">
                  <span class="inline-flex items-center justify-center w-7 h-7 rounded-full" :class="song.has_features ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'">
                    <MfIcon :name="song.has_features ? 'check' : 'close'" size="14" />
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-slate-500 whitespace-nowrap">{{ formatDate(song.updated_at) }}</td>
                <td class="px-4 py-4 text-right" @click.stop>
                  <div class="relative inline-block text-left">
                    <button @click.stop="toggleDropdown(song.id)" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <MfIcon name="more_vert" size="18" />
                    </button>
                    <div v-if="activeDropdown === song.id" class="dropdown-menu absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50" :class="{ 'dropdown-up': index >= songs.length - 2 && songs.length > 3 }">
                      <button @click="openDetail(song.id); closeDropdown()" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <MfIcon name="visibility" size="16" class="text-slate-400" /> Xem chi tiết
                      </button>
                      <button @click="fetchCover(song.id); closeDropdown()" :disabled="song.has_cover" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <MfIcon name="image" size="16" class="text-slate-400" /> Fetch Cover
                      </button>
                      <button @click="analyzeFeatures(song.id); closeDropdown()" :disabled="song.has_features" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <MfIcon name="equalizer" size="16" class="text-slate-400" /> Analyze Features
                      </button>
                      <button disabled title="Lyrics được xử lý qua batch LRCLIB, không gọi trực tiếp từ giao diện quản trị." class="w-full text-left px-4 py-2 text-sm text-slate-700 flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <MfIcon name="article" size="16" class="text-slate-400" /> Fetch Lyrics
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-6 py-4 border-t border-slate-200 flex justify-end" v-if="pagination.totalPages > 1">
          <AdminPagination v-model:currentPage="pagination.page" :totalPages="pagination.totalPages" />
        </div>
      </div>
    </section>

    <!-- 5. PROCESSING STATE -->
    <section v-if="processingState.active" class="mb-6 animate-fade-in">
      <div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <MfIcon name="settings" class="fa-spin text-indigo-600" size="20" />
            </div>
            <div>
              <div class="text-sm font-semibold text-indigo-900">{{ processingState.title }}</div>
              <div class="text-xs text-indigo-600">Batch #{{ new Date().toISOString().slice(0,10) }} &bull; {{ processingState.total }} bài hát trong queue</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold text-indigo-700 mb-1">Đang xử lý...</div>
            <div class="text-xs text-indigo-600">Total: {{ processingState.total }}</div>
          </div>
        </div>
        <div class="w-full bg-indigo-200 rounded-full h-2.5 overflow-hidden">
          <div class="bg-indigo-500 h-2.5 rounded-full w-full animate-pulse"></div>
        </div>
      </div>
    </section>

    <!-- 6. STATS SECTION -->
    <section class="mb-8" v-if="summary && summary.healthDistribution">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Health Distribution -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-semibold text-slate-900 flex items-center gap-2">
              <MfIcon name="activity" class="text-indigo-500" size="20" />
              Health Distribution
            </h3>
            <button class="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Xem chi tiết</button>
          </div>
          <div class="space-y-5">
            <div>
              <div class="flex justify-between text-sm mb-1.5">
                <span class="text-slate-600">Excellent (90-100%)</span>
                <span class="font-semibold text-slate-900">{{ summary.healthDistribution.excellent.toLocaleString() }} <span class="text-slate-400 font-normal">({{ getPercent(summary.healthDistribution.excellent, summary.totalSongs) }}%)</span></span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="bg-emerald-500 h-2 rounded-full" :style="{ width: getPercent(summary.healthDistribution.excellent, summary.totalSongs) + '%' }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1.5">
                <span class="text-slate-600">Good (70-89%)</span>
                <span class="font-semibold text-slate-900">{{ summary.healthDistribution.good.toLocaleString() }} <span class="text-slate-400 font-normal">({{ getPercent(summary.healthDistribution.good, summary.totalSongs) }}%)</span></span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="bg-cyan-500 h-2 rounded-full" :style="{ width: getPercent(summary.healthDistribution.good, summary.totalSongs) + '%' }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1.5">
                <span class="text-slate-600">Fair (50-69%)</span>
                <span class="font-semibold text-slate-900">{{ summary.healthDistribution.fair.toLocaleString() }} <span class="text-slate-400 font-normal">({{ getPercent(summary.healthDistribution.fair, summary.totalSongs) }}%)</span></span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="bg-amber-500 h-2 rounded-full" :style="{ width: getPercent(summary.healthDistribution.fair, summary.totalSongs) + '%' }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1.5">
                <span class="text-slate-600">Poor (&lt;50%)</span>
                <span class="font-semibold text-slate-900">{{ summary.healthDistribution.poor.toLocaleString() }} <span class="text-slate-400 font-normal">({{ getPercent(summary.healthDistribution.poor, summary.totalSongs) }}%)</span></span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="bg-red-500 h-2 rounded-full" :style="{ width: getPercent(summary.healthDistribution.poor, summary.totalSongs) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Missing Metadata -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-semibold text-slate-900 flex items-center gap-2">
              <MfIcon name="warning" class="text-amber-500" size="20" />
              Top Missing Metadata
            </h3>
            <button class="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Xem tất cả</button>
          </div>
          <div class="space-y-3">
            <div v-for="(item, index) in topMissing" :key="item.id" class="flex items-center justify-between p-3 rounded-xl border" :class="item.bgColorClass">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" :class="item.iconBgClass">{{ index + 1 }}</div>
                <div>
                  <div class="text-sm font-medium text-slate-900">{{ item.title }}</div>
                  <div class="text-xs opacity-70">{{ item.count.toLocaleString() }} {{ item.desc }}</div>
                </div>
              </div>
              <button class="px-3 py-1.5 bg-white border rounded-lg text-xs font-medium transition-colors shadow-sm" :class="item.btnClass" :disabled="item.disabled" :title="item.disabled ? (item.id === 'embedding' ? 'Embedding vectors được tạo bằng pipeline recommendation riêng, chưa chạy trực tiếp từ Music Data Tools.' : 'Vui lòng chọn bài hát ở table để thao tác hàng loạt (Bulk).') : ''" @click="handleMissingAction(item.id)">
                {{ item.actionText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Detail Drawer/Modal -->
    <div v-if="showDetail" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 lg:p-8 overflow-y-auto" @click.self="showDetail = false">
      <div class="bg-slate-50 w-full max-w-[1200px] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
        
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-2xl shrink-0">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-bold text-slate-900">Chi tiết Metadata</h2>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-mono">{{ detailSong?.id }}</span>
          </div>
          <button @click="showDetail = false" class="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
            <MfIcon name="close" size="20" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto flex-1 flex flex-col lg:flex-row gap-6">
          
          <!-- Left Column (Cover + Basic) -->
          <div class="w-full lg:w-80 shrink-0 space-y-6">
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div class="aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-4 border border-slate-100">
                <AdminCoverThumb :src="detailSong?.cover_url" size="custom" class="w-full h-full" rounded="none" iconSize="64" />
              </div>
              <h3 class="font-bold text-lg text-slate-900">{{ detailSong?.title }}</h3>
              <p class="text-slate-500 text-sm mt-1">{{ detailSong?.artist_name || 'Unknown Artist' }}</p>
              
              <div class="mt-4 pt-4 border-t border-slate-100 space-y-3 text-sm">
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Album</span>
                  <span class="font-medium text-slate-700 truncate max-w-[140px]" :title="detailSong?.album_title">{{ detailSong?.album_title || 'N/A' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Thể loại</span>
                  <span class="font-medium text-slate-700">{{ detailSong?.genre_name || 'N/A' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Thời lượng</span>
                  <span class="font-medium text-slate-700">{{ formatDuration(detailSong?.duration) }}</span>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 class="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
                <MfIcon name="favorite" class="text-cyan-500" size="16" /> Health Summary
              </h4>
              <div class="space-y-4">
                <div>
                  <div class="flex justify-between text-sm mb-1.5">
                    <span class="text-slate-600">Cover Art</span>
                    <span class="font-semibold" :class="detailSong?.has_cover ? 'text-emerald-600' : 'text-red-500'">{{ detailSong?.has_cover ? '100%' : '0%' }}</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-1.5">
                    <div class="h-1.5 rounded-full" :class="detailSong?.has_cover ? 'bg-emerald-500' : 'bg-red-500'" :style="{ width: detailSong?.has_cover ? '100%' : '5%' }"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1.5">
                    <span class="text-slate-600">Lyrics</span>
                    <span class="font-semibold" :class="detailSong?.has_lyrics ? 'text-purple-600' : 'text-red-500'">{{ detailSong?.has_lyrics ? '100%' : '0%' }}</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-1.5">
                    <div class="h-1.5 rounded-full" :class="detailSong?.has_lyrics ? 'bg-purple-500' : 'bg-red-500'" :style="{ width: detailSong?.has_lyrics ? '100%' : '5%' }"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-1.5">
                    <span class="text-slate-600">Audio Features</span>
                    <span class="font-semibold" :class="detailSong?.has_features ? 'text-amber-600' : 'text-red-500'">{{ detailSong?.has_features ? '100%' : '0%' }}</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-1.5">
                    <div class="h-1.5 rounded-full" :class="detailSong?.has_features ? 'bg-amber-500' : 'bg-red-500'" :style="{ width: detailSong?.has_features ? '100%' : '5%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column (Features, Lyrics, Raw) -->
          <div class="flex-1 space-y-6">
            
            <!-- Audio Features Grid -->
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 class="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
                <MfIcon name="equalizer" class="text-amber-500" size="16" /> Audio Features
              </h3>
              <div v-if="detailSong?.has_features" class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div v-for="f in audioFeaturesList" :key="f.label" class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600" :class="getFeatureIconBg(f.label)">
                    <MfIcon :name="getFeatureIcon(f.label)" size="14" />
                  </div>
                  <div>
                    <div class="text-xs text-slate-400">{{ f.label }}</div>
                    <div class="text-sm font-semibold text-slate-900">{{ f.value }}</div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-6">
                <p class="text-sm text-slate-500">Chưa có dữ liệu Audio Features.</p>
                <button @click="analyzeFeatures(detailSong.id)" class="mt-3 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  <MfIcon name="equalizer" size="14" class="mr-1" /> Analyze Now
                </button>
              </div>
            </div>

            <!-- Lyrics Summary -->
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 class="font-semibold text-slate-900 mb-4 text-sm flex items-center justify-between">
                <span class="flex items-center gap-2"><MfIcon name="article" class="text-purple-500" size="16" /> Lyrics Status</span>
              </h3>
              
              <div v-if="detailSong?.has_lyrics" class="space-y-3 mb-4">
                <div class="flex justify-between items-center text-sm">
                  <span class="text-slate-500">Trạng thái</span>
                  <span class="font-medium text-emerald-600">Có lyrics</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span class="text-slate-500">Loại đồng bộ</span>
                  <span class="font-medium text-slate-700">{{ detailSong.sync_type || 'N/A' }}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span class="text-slate-500">Provider</span>
                  <span class="font-medium text-slate-700">{{ detailSong.lyrics_provider || 'N/A' }}</span>
                </div>
                <div class="flex justify-between items-center text-sm" v-if="detailSong.plain_lyrics_length">
                  <span class="text-slate-500">Plain Lyrics</span>
                  <span class="font-medium text-slate-700">{{ detailSong.plain_lyrics_length }} ký tự</span>
                </div>
                <div class="flex justify-between items-center text-sm" v-if="detailSong.synced_lyrics_length">
                  <span class="text-slate-500">Synced Lyrics</span>
                  <span class="font-medium text-slate-700">{{ detailSong.synced_lyrics_length }} ký tự</span>
                </div>
              </div>
              <div v-else class="text-center py-4 mb-4">
                <p class="text-sm text-slate-900 font-medium mb-1">Bài hát này chưa có lời.</p>
                <p class="text-xs text-slate-500">Sử dụng Quản lý Lời bài hát để kiểm tra hoặc thêm thủ công.</p>
              </div>

              <router-link :to="`/admin/lyrics/${detailSong?.id}`" class="block w-full text-center px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors">
                Mở quản lý lời bài hát
              </router-link>
            </div>

            <!-- Raw Metadata -->
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm max-w-full overflow-hidden">
              <h3 class="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
                <MfIcon name="database" class="text-slate-500" size="16" /> Raw Metadata
              </h3>
              <div class="bg-slate-900 rounded-xl p-4 overflow-auto max-h-64 custom-scrollbar">
                <pre class="text-[11px] text-green-400 font-mono whitespace-pre-wrap break-words max-w-full">{{ JSON.stringify(safeRawMetadata, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-white rounded-b-2xl shrink-0">
          <button @click="showDetail = false" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">Đóng</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminCoverThumb from '@/components/admin/AdminCoverThumb.vue'
import MfIcon from '@/components/common/MfIcon.vue'

const toastStore = useToastStore()
const toast = {
  success: (msg) => toastStore.showToast(msg, 'success'),
  error: (msg) => toastStore.showToast(msg, 'error')
}

const loading = ref(true)
const summary = ref(null)
const songs = ref([])
const selectedIds = ref([])
const pagination = ref({ page: 1, limit: 10, total: 0, totalPages: 1 })
const filters = ref({ search: '', missing: '' })
const showBulkMenu = ref(false)
const lastUpdatedStr = ref(new Date().toLocaleString('vi-VN'))

const showDetail = ref(false)
const detailSong = ref(null)
const showFullLyrics = ref(false)

const safeRawMetadata = computed(() => {
  if (!detailSong.value) return {}
  const clone = { ...detailSong.value }

  const plain = clone.plain_lyrics || ''
  const synced = clone.synced_lyrics || ''

  delete clone.plain_lyrics
  delete clone.synced_lyrics
  delete clone.lyrics_json

  clone.has_plain_lyrics = plain.trim().length > 0
  clone.plain_lyrics_length = plain.length
  clone.has_synced_lyrics = synced.trim().length > 0
  clone.synced_lyrics_length = synced.length

  if (clone.audio_url && clone.audio_url.length > 120) {
    clone.audio_url_preview = clone.audio_url.slice(0, 120) + '...'
    delete clone.audio_url
  }

  if (clone.cover_url && clone.cover_url.length > 120) {
    clone.cover_url_preview = clone.cover_url.slice(0, 120) + '...'
    delete clone.cover_url
  }

  return clone
})

const activeDropdown = ref(null)

function toggleDropdown(id) {
  activeDropdown.value = activeDropdown.value === id ? null : id
}

function closeDropdown() {
  activeDropdown.value = null
}

function toggleBulkMenu() {
  showBulkMenu.value = !showBulkMenu.value
}

const handleClickOutside = (e) => {
  if (!e.target.closest('.relative')) {
    activeDropdown.value = null
    showBulkMenu.value = false
  }
}

const isAllSelected = computed(() => {
  return songs.value.length > 0 && selectedIds.value.length === songs.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = songs.value.map(s => s.id)
  }
}

const percent = (part, total) => {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

const overallHealthPercent = computed(() => {
  if (!summary.value || summary.value.totalSongs === 0) return 0
  const t = summary.value.totalSongs * 3
  const has = summary.value.cover.has + summary.value.lyrics.has + summary.value.audioFeatures.has
  return percent(has, t)
})

const totalMissingMetadata = computed(() => {
  if (!summary.value) return 0
  const t = summary.value.totalSongs * 3
  const has = summary.value.cover.has + summary.value.lyrics.has + summary.value.audioFeatures.has
  return t - has
})

const getHealthLabelByPercent = (p) => {
  if (p >= 90) return 'Excellent'
  if (p >= 70) return 'Good'
  if (p >= 50) return 'Fair'
  return 'Poor'
}

const getSongHealthScore = (song) => {
  let score = 0
  if (song.has_cover) score += 33
  if (song.has_lyrics) score += 33
  if (song.has_features) score += 34
  return score
}

const getSongHealthBadgeClass = (song) => {
  const score = getSongHealthScore(song)
  if (score >= 90) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (score >= 60) return 'bg-cyan-50 text-cyan-700 border-cyan-100'
  if (score >= 30) return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-red-50 text-red-700 border-red-100'
}

const getSongHealthDotClass = (song) => {
  const score = getSongHealthScore(song)
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 60) return 'bg-cyan-500'
  if (score >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

const getFeatureIconBg = (label) => {
  const l = label.toLowerCase()
  if (l.includes('acoustic')) return 'bg-blue-50 text-blue-600'
  if (l.includes('dance')) return 'bg-purple-50 text-purple-600'
  if (l.includes('energy')) return 'bg-red-50 text-red-600'
  if (l.includes('vibe') || l.includes('mood')) return 'bg-green-50 text-green-600'
  return 'bg-slate-50 text-slate-600'
}

const getFeatureIcon = (label) => {
  const l = label.toLowerCase()
  if (l.includes('acoustic')) return 'volume_up'
  if (l.includes('dance')) return 'music'
  if (l.includes('energy')) return 'activity'
  if (l.includes('vibe') || l.includes('mood')) return 'heart'
  return 'analytics'
}

const audioFeaturesList = computed(() => {
  if (!detailSong.value) return []
  const features = []
  const keys = ['bpm', 'tempo_level', 'energy_score', 'energy', 'danceability', 'acoustic_score', 'brightness', 'mood', 'vibe']
  keys.forEach(k => {
    if (detailSong.value[k] !== undefined && detailSong.value[k] !== null) {
      const label = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      features.push({ label, value: detailSong.value[k] })
    }
  })
  return features
})

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('vi-VN')
}

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const fetchSummary = async () => {
  try {
    const res = await api.get('/admin/music-data-tools/summary')
    if (res.data.success) {
      summary.value = res.data.data
    }
  } catch (err) {
    console.error(err)
  }
}

const fetchList = async (page = 1) => {
  loading.value = true
  try {
    const params = {
      page,
      limit: pagination.value.limit,
      search: filters.value.search
    }
    
    if (filters.value.missing === 'cover') params.cover = 'missing'
    if (filters.value.missing === 'lyrics') params.lyrics = 'missing'
    if (filters.value.missing === 'features') params.features = 'missing'

    const res = await api.get('/admin/music-data-tools', { params })
    if (res.data.success) {
      songs.value = res.data.data
      pagination.value = res.data.pagination
      selectedIds.value = []
    }
  } catch (err) {
    toast.error('Lỗi khi tải danh sách')
  } finally {
    loading.value = false
    lastUpdatedStr.value = new Date().toLocaleString('vi-VN')
  }
}

const applyFilters = () => {
  fetchList(1)
}

const resetFilters = () => {
  filters.value = { search: '', missing: '' }
  fetchList(1)
}

let searchTimeout = null
watch(() => filters.value.search, (newVal, oldVal) => {
  if (newVal === oldVal) return
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchList(1)
  }, 500)
})

watch(() => pagination.value.page, (newPage) => {
  fetchList(newPage)
})

const refreshData = () => {
  fetchSummary()
  fetchList(pagination.value.page)
}

const openDetail = async (id) => {
  try {
    const res = await api.get(`/admin/music-data-tools/${id}`)
    if (res.data.success) {
      detailSong.value = res.data.data
      showFullLyrics.value = false
      showDetail.value = true
    }
  } catch (err) {
    toast.error('Lỗi khi tải chi tiết bài hát')
  }
}

const fetchCover = async (id) => {
  try {
    const res = await api.post(`/admin/music-data-tools/${id}/fetch-cover`)
    if (res.data.success) {
      toast.success('Fetch cover thành công')
      refreshData()
    }
  } catch (err) {
    toast.error('Lỗi khi fetch cover')
  }
}

const analyzeFeatures = async (id) => {
  try {
    const res = await api.post(`/admin/music-data-tools/${id}/analyze-features`)
    if (res.data.success) {
      toast.success('Phân tích audio features thành công')
      refreshData()
      if (showDetail.value && detailSong.value && detailSong.value.id === id) {
        openDetail(id) // Reload details
      }
    }
  } catch (err) {
    toast.error('Lỗi khi phân tích features')
  }
}

const bulkFetchCover = async () => {
  if (selectedIds.value.length === 0) return
  showBulkMenu.value = false
  const count = selectedIds.value.length
  
  processingState.value = {
    active: true,
    title: 'Đang bổ sung Cover Art',
    total: count
  }
  
  try {
    const res = await api.post('/admin/music-data-tools/bulk/fetch-cover', { ids: selectedIds.value })
    if (res.data.success) {
      toast.success(`Fetch thành công ${res.data.data.successCount}, Lỗi: ${res.data.data.failCount}`)
      selectedIds.value = []
      refreshData()
    }
  } catch (err) {
    toast.error('Lỗi khi fetch cover hàng loạt')
  } finally {
    processingState.value.active = false
  }
}

const bulkAnalyzeFeatures = async () => {
  if (selectedIds.value.length === 0) return
  showBulkMenu.value = false
  const count = selectedIds.value.length
  
  processingState.value = {
    active: true,
    title: 'Đang phân tích Audio Features',
    total: count
  }
  
  try {
    const res = await api.post('/admin/music-data-tools/bulk/analyze-features', { ids: selectedIds.value })
    if (res.data.success) {
      toast.success(`Analyze thành công ${res.data.data.successCount}, Lỗi: ${res.data.data.failCount}`)
      selectedIds.value = []
      refreshData()
    }
  } catch (err) {
    toast.error('Lỗi khi phân tích audio features hàng loạt')
  } finally {
    processingState.value.active = false
  }
}

const getPercent = (value, total) => {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

const processingState = ref({
  active: false,
  title: '',
  total: 0
})

const topMissing = computed(() => {
  if (!summary.value) return []
  const list = [
    { 
      id: 'cover', title: 'Cover Art', count: summary.value.cover.total - summary.value.cover.has, desc: 'bài hát thiếu',
      bgColorClass: 'bg-red-50 border-red-100 text-red-800', iconBgClass: 'bg-red-100 text-red-600', btnClass: 'text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed', actionText: 'Bulk via Table', disabled: true
    },
    { 
      id: 'lyrics', title: 'Lyrics', count: summary.value.lyrics.total - summary.value.lyrics.has, desc: 'bài hát thiếu',
      bgColorClass: 'bg-amber-50 border-amber-100 text-amber-800', iconBgClass: 'bg-amber-100 text-amber-600', btnClass: 'text-amber-600 border-amber-200 hover:bg-amber-50', actionText: 'Export Backlog', disabled: false
    },
    { 
      id: 'features', title: 'Audio Features', count: summary.value.audioFeatures.total - summary.value.audioFeatures.has, desc: 'bài hát chưa phân tích',
      bgColorClass: 'bg-fuchsia-50 border-fuchsia-100 text-fuchsia-800', iconBgClass: 'bg-fuchsia-100 text-fuchsia-600', btnClass: 'text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-50 disabled:opacity-50 disabled:cursor-not-allowed', actionText: 'Bulk via Table', disabled: true
    },
    { 
      id: 'embedding', title: 'Embedding Vectors', count: summary.value.totalSongs, desc: 'bài hát chưa tạo',
      bgColorClass: 'bg-slate-50 border-slate-200 text-slate-800', iconBgClass: 'bg-slate-200 text-slate-600', btnClass: 'text-slate-600 border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed', actionText: 'Disabled', disabled: true
    }
  ]
  return list.sort((a, b) => b.count - a.count)
})

const handleMissingAction = (id) => {
  if (id === 'embedding') {
    toast.info('Chức năng tạo Embedding Vectors đang phát triển.')
  } else if (id === 'lyrics') {
    toast.success('Đang chuẩn bị file xuất...')
    api.get('/admin/music-data-tools/lyrics-backlog/export', { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'missing-lyrics-backlog.csv')
        document.body.appendChild(link)
        link.click()
        link.remove()
      })
      .catch(err => {
        toast.error('Lỗi khi xuất dữ liệu')
      })
  } else {
    toast.info('Tính năng xử lý hàng loạt toàn bộ thư viện cần Queue Worker.')
  }
}

onMounted(() => {
  refreshData()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.music-data-tools {
  font-family: 'Inter', 'Be Vietnam Pro', sans-serif;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* KPI Cards */
.kpi-card {
  position: relative;
  overflow: hidden;
}
.kpi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
}
.kpi-card.total::before { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.kpi-card.cover::before { background: linear-gradient(90deg, #10b981, #34d399); }
.kpi-card.lyrics::before { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
.kpi-card.audio::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.kpi-card.health::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
.kpi-card.processing::before { background: linear-gradient(90deg, #f43f5e, #fb7185); }

.card-hover { transition: all 0.2s ease; }
.card-hover:hover { 
  transform: translateY(-2px); 
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); 
}

/* Table Hover Effect */
.table-row-hover:hover {
  background-color: #f8fafc;
}

/* Custom Scrollbar for Modal and Pre */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Dropdown */
.dropdown-up {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 4px;
}
</style>
