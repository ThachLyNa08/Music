<template>
  <div class="p-4 md:p-6 bg-gray-50 dark:bg-bg-base min-h-screen text-gray-800 dark:text-text-base font-sans">

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
      <div class="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
      <p class="font-medium">Đang tải thông tin bài hát...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-6 rounded-2xl text-center">
      <MfIcon name="error_outline" size="48" className="text-red-500 mx-auto mb-3" />
      <h3 class="text-lg font-bold text-red-700 dark:text-red-400 mb-1">Không thể tải dữ liệu</h3>
      <p class="text-sm text-red-600 dark:text-red-300">{{ error }}</p>
      <button @click="router.push('/admin/songs')" class="mt-4 px-4 py-2 bg-white dark:bg-bg-surface text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-bg-border shadow-sm font-medium hover:bg-gray-50">
        Quay lại Quản lý Bài hát
      </button>
    </div>

    <!-- Main Content -->
    <div v-else-if="song" class="detail-content animate-fade-in-up">
      <!-- 1. HEADER -->
      <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl p-6 shadow-sm mb-6 relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none"></div>
        <button @click="router.push('/admin/songs')" class="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 mb-4 transition-colors w-fit relative z-10">
          <MfIcon name="arrow_back" size="16" />
          Quay lại danh sách
        </button>

        <div class="flex flex-col md:flex-row gap-6 relative z-10">
          <div class="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 shadow-lg rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img :src="$formatImageUrl(song.cover_url)" @error="e => e.target.src = '/default-cover.png'" class="w-full h-full object-cover" />
          </div>

          <div class="flex-1 flex flex-col justify-center">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" :class="song.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'">
                    {{ song.status === 'active' ? 'Đang hoạt động' : 'Đã ẩn' }}
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {{ formatDuration(song.duration) }}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{{ song.title }}</h1>
                  <div class="flex items-center gap-1 mb-2">
                    <button @click="openEditModal" v-if="adminActions.canEdit" title="Chỉnh sửa" class="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-full transition-colors flex items-center justify-center">
                      <MfIcon name="edit" size="20" />
                    </button>
                    <button @click="confirmDelete" v-if="adminActions.canDelete" title="Xóa bài hát" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors flex items-center justify-center">
                      <MfIcon name="delete" size="20" />
                    </button>
                  </div>
                </div>
                <p class="text-lg text-gray-600 dark:text-gray-300 font-medium mb-1">
                  Nghệ sĩ:
                  <RouterLink
                    v-if="song.artist_id"
                    :to="`/admin/artists/${song.artist_id}/detail`"
                    class="inline-block max-w-full truncate align-bottom text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer transition-colors"
                    :title="song.artist_name"
                  >
                    {{ song.artist_name || 'Chưa có nghệ sĩ' }}
                  </RouterLink>
                  <span v-else class="inline-block max-w-full truncate align-bottom text-gray-700 dark:text-gray-300" :title="song.artist_name">
                    {{ song.artist_name || 'Chưa có nghệ sĩ' }}
                  </span>
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Album:
                  <RouterLink
                    v-if="song.album_id"
                    :to="`/admin/albums/${song.album_id}/detail`"
                    class="inline-block max-w-full truncate align-bottom font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline cursor-pointer transition-colors"
                    :title="song.album_title"
                  >
                    {{ song.album_title || 'Chưa có album' }}
                  </RouterLink>
                  <span v-else class="inline-block max-w-full truncate align-bottom text-gray-600 dark:text-gray-400" :title="song.album_title">
                    {{ song.album_title || 'Chưa có album' }}
                  </span>
                  &bull; Thể loại: {{ song.genre_name }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. KPI CARDS -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <AdminKpiCard title="Tổng Lượt Nghe" :value="summary.totalListens.toLocaleString('vi-VN')" icon="play_arrow" tone="blue" />
        <AdminKpiCard title="Người Nghe Duy Nhất" :value="summary.uniqueListeners.toLocaleString('vi-VN')" icon="person" tone="indigo" />
        <AdminKpiCard title="Lượt Thích" :value="summary.likedCount.toLocaleString('vi-VN')" icon="favorite" tone="rose" />
        <AdminKpiCard title="Thêm vào Playlist" :value="summary.playlistAdds.toLocaleString('vi-VN')" icon="playlist_add" tone="emerald" />
      </div>

      <!-- 3. DATA QUALITY -->
      <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl p-5 shadow-sm mb-6">
        <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-bg-border pb-2">Chất lượng Dữ liệu</h3>

        <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">Audio File</span>
            <span v-if="quality.hasAudio" class="badge-ok">Có sẵn</span>
            <span v-else class="badge-error">Thiếu</span>
          </div>
          <div class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">Cover Image</span>
            <span v-if="quality.hasCover" class="badge-ok">Có sẵn</span>
            <span v-else class="badge-error">Thiếu</span>
          </div>
          <div class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">Nghệ Sĩ</span>
            <span v-if="quality.hasArtist" class="badge-ok">Đã gán</span>
            <span v-else class="badge-error">Trống</span>
          </div>
          <div class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">Album</span>
            <span v-if="quality.hasAlbum" class="badge-ok">Đã gán</span>
            <span v-else class="badge-warn">Trống</span>
          </div>
          <div class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">Thể loại</span>
            <span v-if="quality.hasGenre" class="badge-ok">Đã gán</span>
            <span v-else class="badge-warn">Trống</span>
          </div>
          <div class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">Lyrics</span>
            <span v-if="quality.hasLyrics" class="badge-ok">Có sẵn</span>
            <span v-else class="badge-info">Chưa có</span>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-2xl p-5 shadow-sm mb-6">
        <div class="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-bg-border pb-2 mb-4">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Audio Features</h3>
          <span v-if="audioFeatures" class="badge-ok">Analyzed</span>
          <span v-else class="badge-info">Chưa có</span>
        </div>
        <div v-if="audioFeatures" class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div v-for="item in audioFeatureItems" :key="item.label" class="quality-item flex flex-col gap-1">
            <span class="text-xs text-gray-500">{{ item.label }}</span>
            <span class="text-sm font-bold text-gray-900 dark:text-white">{{ item.value }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          Bài hát này chưa có đặc trưng âm thanh. Trang vẫn hoạt động bình thường và recommendation sẽ dùng điểm trung lập cho tempo layer.
        </p>
      </div>

      <!-- 4. TABS NAVIGATION -->
      <div class="flex overflow-x-auto gap-2 mb-6 border-b border-gray-200 dark:border-bg-border pb-px hide-scrollbar">
        <button v-for="tab in tabs" :key="tab.id" @click="currentTab = tab.id"
          class="px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors focus:outline-none"
          :class="currentTab === tab.id ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'">
          {{ tab.label }}
        </button>
      </div>

      <!-- 5. TABS CONTENT -->
      <div class="tab-content relative min-h-[300px]">
        <transition name="slide-up" mode="out-in">
          <div :key="currentTab">

            <!-- TỔNG QUAN -->
            <div v-if="currentTab === 'overview'" class="tab-pane">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Cột trái: Chart -->
                <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-5 shadow-sm">
                  <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-4">Lượt nghe 30 ngày qua</h3>
                  <div class="h-64 relative" v-if="analytics.listensByDay.length > 0">
                    <LineChart :data="dailyChartData" :options="chartOptions" />
                  </div>
                  <div v-else class="h-64 flex items-center justify-center text-gray-400">Không đủ dữ liệu 30 ngày</div>
                </div>

                <!-- Cột phải: Top Info -->
                <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <div>
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2">Thông số sử dụng</h3>
                    <div class="flex justify-between items-center py-2 border-b border-gray-50 dark:border-bg-border">
                      <span class="text-sm text-gray-600 dark:text-gray-400">Tổng thời gian nghe</span>
                      <span class="text-sm font-bold text-gray-900 dark:text-white">{{ formatListeningTime(summary) }}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-50 dark:border-bg-border">
                      <span class="text-sm text-gray-600 dark:text-gray-400">Tỷ lệ hoàn thành (TB)</span>
                      <span class="text-sm font-bold text-gray-900 dark:text-white">{{ summary.averageCompletionRate ? (summary.averageCompletionRate * 100).toFixed(1) + '%' : 'N/A' }}</span>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2">Trạng thái file</h3>
                    <div class="flex justify-between items-center py-2 border-b border-gray-50 dark:border-bg-border">
                      <span class="text-sm text-gray-600 dark:text-gray-400">Audio URL</span>
                      <span class="text-xs font-mono truncate max-w-[150px] text-gray-500">{{ song.audio_url || 'N/A' }}</span>
                    </div>
                    <div class="flex justify-between items-center py-2">
                      <span class="text-sm text-gray-600 dark:text-gray-400">Cover URL</span>
                      <span class="text-xs font-mono truncate max-w-[150px] text-gray-500">{{ song.cover_url || 'N/A' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- HIỆU SUẤT NGHE -->
            <div v-if="currentTab === 'performance'" class="tab-pane">
              <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-5 shadow-sm mb-6">
                <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-4">Phân bổ lượt nghe theo khung giờ</h3>
                <div class="h-64 relative" v-if="analytics.listensByHour.length > 0">
                  <BarChart :data="hourlyChartData" :options="chartOptions" />
                </div>
                <div v-else class="h-64 flex items-center justify-center text-gray-400">Không đủ dữ liệu theo giờ</div>
              </div>

              <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-0 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-gray-100 dark:border-bg-border">
                  <h3 class="text-sm font-bold text-gray-900 dark:text-white">Người nghe gần đây (10 lượt)</h3>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs" v-if="analytics.recentListeners.length > 0">
                    <thead class="bg-gray-50 dark:bg-bg-card/50 text-gray-900 dark:text-gray-200">
                      <tr>
                        <th class="px-4 py-3 font-semibold">User ID</th>
                        <th class="px-4 py-3 font-semibold">Username</th>
                        <th class="px-4 py-3 font-semibold">Thời gian</th>
                        <th class="px-4 py-3 font-semibold text-right">
                          <div class="flex items-center justify-end gap-1" :title="'Tỷ lệ thời lượng user đã nghe so với tổng thời lượng bài hát.\nGiá trị hiển thị được giới hạn trong khoảng 0–100%.'">
                            % Hoàn thành
                            <MfIcon name="info" size="14" class="text-gray-400 cursor-help hover:text-indigo-500" />
                          </div>
                        </th>
                        <th class="px-4 py-3 font-semibold">Nguồn</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
                      <tr v-for="(l, i) in analytics.recentListeners" :key="i" class="hover:bg-gray-50/50 dark:hover:bg-bg-card/50">
                        <td class="px-4 py-3 text-gray-500">#{{ l.user_id }}</td>
                        <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{{ l.username }}</td>
                        <td class="px-4 py-3 text-gray-500">{{ new Date(l.listened_at).toLocaleString('vi-VN') }}</td>
                        <td class="px-4 py-3 text-right">
                          <span v-if="l.completion_rate == null || isNaN(Number(l.completion_rate))" class="text-gray-400">—</span>
                          <span v-else :class="Number(l.completion_rate) > 0.8 ? 'text-emerald-600' : (Number(l.completion_rate) < 0.3 ? 'text-red-500' : 'text-yellow-600')">
                            {{ Math.round(Math.max(0, Math.min(1, Number(l.completion_rate))) * 100) }}%
                          </span>
                        </td>
                        <td class="px-4 py-3">
                          <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs font-mono">{{ l.source }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="p-8 text-center text-gray-400">Chưa có lượt nghe nào.</div>
                </div>
              </div>
            </div>

            <!-- METADATA & FILE -->
            <div v-if="currentTab === 'metadata'" class="tab-pane">
              <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-5 shadow-sm">
                <div class="overflow-hidden">
                  <table class="w-full text-xs text-left">
                    <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
                      <tr>
                        <td class="py-3 font-semibold text-gray-700 dark:text-gray-300 w-1/3">Song ID</td>
                        <td class="py-3 text-gray-900 dark:text-white">{{ song.id }}</td>
                      </tr>
                      <tr>
                        <td class="py-3 font-semibold text-gray-700 dark:text-gray-300">Tiêu đề</td>
                        <td class="py-3 text-gray-900 dark:text-white">{{ song.title }}</td>
                      </tr>
                      <tr>
                        <td class="py-3 font-semibold text-gray-700 dark:text-gray-300">Audio URL</td>
                        <td class="py-3">
                          <div class="flex items-center gap-2">
                            <span class="truncate max-w-xs md:max-w-md lg:max-w-xl font-mono text-xs text-gray-500">{{ song.audio_url || 'N/A' }}</span>
                            <button v-if="song.audio_url" @click="copyText(song.audio_url)" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Copy"><MfIcon name="content_copy" size="16" className="text-gray-400" /></button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td class="py-3 font-semibold text-gray-700 dark:text-gray-300">Cover URL</td>
                        <td class="py-3">
                          <div class="flex items-center gap-2">
                            <span class="truncate max-w-xs md:max-w-md lg:max-w-xl font-mono text-xs text-gray-500">{{ song.cover_url || 'N/A' }}</span>
                            <button v-if="song.cover_url" @click="copyText(song.cover_url)" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Copy"><MfIcon name="content_copy" size="16" className="text-gray-400" /></button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td class="py-3 font-semibold text-gray-700 dark:text-gray-300">Created At</td>
                        <td class="py-3 text-gray-900 dark:text-white">{{ new Date(song.created_at).toLocaleString('vi-VN') }}</td>
                      </tr>
                      <tr>
                        <td class="py-3 font-semibold text-gray-700 dark:text-gray-300">Lyrics Length</td>
                        <td class="py-3 text-gray-900 dark:text-white">{{ quality.hasLyrics ? 'Có nội dung' : '0' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- PLAYLISTS -->
            <div v-if="currentTab === 'playlists'" class="tab-pane">
              <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-0 shadow-sm overflow-hidden">
                <table class="w-full text-left text-xs" v-if="relations.playlists.length > 0">
                  <thead class="bg-gray-50 dark:bg-bg-card/50 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th class="px-4 py-3 font-semibold">Playlist ID</th>
                      <th class="px-4 py-3 font-semibold">Tên Playlist</th>
                      <th class="px-4 py-3 font-semibold">Phân loại</th>
                      <th class="px-4 py-3 font-semibold text-right">Ngày thêm</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
                    <tr v-for="pl in relations.playlists" :key="pl.id" class="hover:bg-gray-50/50 dark:hover:bg-bg-card/50">
                      <td class="px-4 py-3 text-gray-500">#{{ pl.id }}</td>
                      <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">{{ pl.name }}</td>
                      <td class="px-4 py-3">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{{ pl.type }}</span>
                      </td>
                      <td class="px-4 py-3 text-right text-gray-500">{{ new Date(pl.added_at).toLocaleDateString('vi-VN') }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="p-12 text-center text-gray-400">Bài hát này chưa được thêm vào playlist nào.</div>
              </div>
            </div>

            <!-- RELATED -->
            <div v-if="currentTab === 'related'" class="tab-pane">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Cùng nghệ sĩ -->
                <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-5 shadow-sm">
                  <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-4">Cùng Nghệ Sĩ ({{ song.artist_name }})</h3>
                  <ul v-if="relations.sameArtistSongs.length > 0" class="divide-y divide-gray-50 dark:divide-bg-border">
                    <li v-for="s in relations.sameArtistSongs" :key="s.id" class="py-2 flex items-center justify-between group cursor-pointer" @click="router.push(`/admin/songs/${s.id}`)">
                      <div class="flex items-center gap-3">
                        <img :src="$formatImageUrl(s.cover_url)" @error="e => e.target.src = '/default-cover.png'" class="w-10 h-10 rounded object-cover" />
                        <span class="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 transition-colors">{{ s.title }}</span>
                      </div>
                      <span class="text-xs text-gray-400">{{ s.play_count }} lượt</span>
                    </li>
                  </ul>
                  <div v-else class="text-sm text-gray-400 text-center py-4">Không có bài hát khác.</div>
                </div>

                <!-- Cùng album -->
                <div class="bg-white dark:bg-bg-surface border border-gray-100 dark:border-bg-border rounded-xl p-5 shadow-sm">
                  <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-4">Cùng Album ({{ song.album_title }})</h3>
                  <ul v-if="relations.sameAlbumSongs.length > 0" class="divide-y divide-gray-50 dark:divide-bg-border">
                    <li v-for="s in relations.sameAlbumSongs" :key="s.id" class="py-2 flex items-center justify-between group cursor-pointer" @click="router.push(`/admin/songs/${s.id}`)">
                      <div class="flex items-center gap-3">
                        <img :src="$formatImageUrl(s.cover_url)" @error="e => e.target.src = '/default-cover.png'" class="w-10 h-10 rounded object-cover" />
                        <span class="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 transition-colors">{{ s.title }}</span>
                      </div>
                      <span class="text-xs text-gray-400">{{ s.play_count }} lượt</span>
                    </li>
                  </ul>
                  <div v-else class="text-sm text-gray-400 text-center py-4">Không có bài hát khác.</div>
                </div>
              </div>
            </div>

          </div>
        </transition>
      </div>
    </div>

    <!-- Optional: Import SongFormModal directly if we want editing here. But usually redirected to list, or just reused. -->
    <SongFormModal
      v-if="formData.artists.length > 0"
      :isOpen="isModalOpen"
      :isEditing="true"
      :songData="song"
      :metadata="formData"
      :saving="saving"
      :statusMessage="statusMessage"
      :isError="isError"
      @close="isModalOpen = false"
      @submit="submitForm"
    />

    <!-- Confirm Dialog -->
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
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToastStore } from '@/stores/toast';
import api from '@/api/axios';
import { Line as LineChart, Bar as BarChart } from 'vue-chartjs';
import {
  Chart as ChartJS, Title, Tooltip, Legend,
  LineElement, PointElement, BarElement, LinearScale, CategoryScale
} from 'chart.js';
import SongFormModal from '@/components/admin/SongFormModal.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue';

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, BarElement, LinearScale, CategoryScale);

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
});

function openConfirm(options) {
  confirmState.value = { ...confirmState.value, ...options, open: true, loading: false };
}

async function handleConfirm() {
  if (!confirmState.value.action) return;
  confirmState.value.loading = true;
  try {
    await confirmState.value.action();
  } finally {
    confirmState.value.open = false;
    confirmState.value.loading = false;
  }
}

const loading = ref(true);
const error = ref(null);

const song = ref(null);
const summary = ref({});
const quality = ref({});
const audioFeatures = ref(null);
const analytics = ref({ listensByDay: [], listensByHour: [], recentListeners: [] });
const relations = ref({ playlists: [], sameArtistSongs: [], sameAlbumSongs: [] });
const adminActions = ref({});

const currentTab = ref('overview');
const tabs = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'performance', label: 'Hiệu suất nghe' },
  { id: 'metadata', label: 'Metadata & File' },
  { id: 'playlists', label: 'Playlist chứa bài' },
  { id: 'related', label: 'Bài hát liên quan' }
];

// Edit Modal logic
const isModalOpen = ref(false);
const formData = ref({ artists: [], albums: [], genres: [] });
const saving = ref(false);
const statusMessage = ref('');
const isError = ref(false);

async function fetchFormData() {
  try {
    const res = await api.get('/admin/form-data');
    formData.value = res.data.data;
  } catch (e) {
    console.error(e);
  }
}

async function fetchSongDetail(id) {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get(`/admin/songs/${id}/detail`);
    const data = res.data.data;
    song.value = data.song;
    summary.value = data.summary;
    quality.value = data.quality;
    audioFeatures.value = data.audioFeatures || null;
    analytics.value = data.analytics;
    relations.value = data.relations;
    adminActions.value = data.adminActions;
  } catch (err) {
    error.value = err.response?.data?.message || 'Lỗi kết nối máy chủ.';
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, (newId) => {
  if (newId && route.name === 'admin-song-detail') {
    fetchSongDetail(newId);
  }
});

onMounted(() => {
  if (route.params.id) {
    fetchSongDetail(route.params.id);
    fetchFormData();
  }
});

// Chart config
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: { beginAtZero: true, grid: { display: true, color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } }
  }
};

const dailyChartData = computed(() => {
  const days = analytics.value.listensByDay || [];
  return {
    labels: days.map(d => {
      const date = new Date(d.date);
      return `${date.getDate()}/${date.getMonth()+1}`;
    }),
    datasets: [{
      label: 'Lượt nghe',
      data: days.map(d => d.listens),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointBackgroundColor: '#6366f1'
    }]
  };
});

const hourlyChartData = computed(() => {
  const hours = analytics.value.listensByHour || [];
  // Ensure we show 0-23 if possible, but let's just map available hours for simplicity
  return {
    labels: hours.map(h => `${h.hour}:00`),
    datasets: [{
      label: 'Lượt nghe',
      data: hours.map(h => h.listens),
      backgroundColor: '#8b5cf6',
      borderRadius: 4
    }]
  };
});

function formatNullableMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  const n = Number(value)
  return `${Number.isInteger(n) ? n : n.toFixed(3)}${suffix}`
}

const audioFeatureItems = computed(() => {
  const f = audioFeatures.value || {}
  return [
    { label: 'Raw BPM', value: formatNullableMetric(f.rawBpm) },
    { label: 'Normalized BPM', value: formatNullableMetric(f.normalizedBpm) },
    { label: 'Tempo Bucket', value: f.tempoBucket || 'N/A' },
    { label: 'Energy', value: formatNullableMetric(f.energyScore) },
    { label: 'Danceability', value: formatNullableMetric(f.danceabilityScore) },
    { label: 'Beat Confidence', value: formatNullableMetric(f.beatConfidence) },
    { label: 'Tempo Stability', value: formatNullableMetric(f.tempoStability) },
    { label: 'Extractor', value: f.extractor || 'N/A' },
    { label: 'Extracted At', value: f.extractedAt ? new Date(f.extractedAt).toLocaleString('vi-VN') : 'N/A' },
  ]
})

// Utilities
function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatListeningTime(summaryData) {
  const seconds = Number(summaryData?.totalListeningSeconds || 0);
  if (seconds <= 0) return 'Chưa có dữ liệu';
  if (seconds < 60) return `${seconds.toLocaleString('vi-VN')} giây`;

  const minutes = seconds / 60;
  const formatted = minutes >= 10
    ? Math.round(minutes).toLocaleString('vi-VN')
    : minutes.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${formatted} phút`;
}

function copyText(txt) {
  navigator.clipboard.writeText(txt);
  toast.showToast('Đã copy!', 'success');
}

function confirmDelete() {
  openConfirm({
    title: 'Xóa bài hát?',
    message: `Bạn có chắc chắn muốn xóa/ẩn bài hát "${song.value.title}" khỏi hệ thống?`,
    confirmText: 'Xóa bài hát',
    type: 'danger',
    action: async () => {
      try {
        await api.delete(`/admin/songs/${song.value.id}`);
        toast.showToast('Xóa bài hát thành công', 'success');
        router.push('/admin/songs');
      } catch (err) {
        toast.showToast('Không thể xóa bài hát này', 'error');
      }
    }
  });
}

function openEditModal() {
  statusMessage.value = '';
  isError.value = false;
  isModalOpen.value = true;
}

async function submitForm(submitData) {
  saving.value = true;
  statusMessage.value = '';
  try {
    await api.put(`/admin/songs/${song.value.id}`, submitData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    statusMessage.value = 'Đã cập nhật bài hát thành công!';
    toast.showToast('Cập nhật bài hát thành công!', 'success');
    isError.value = false;
    // Refresh detail
    setTimeout(() => {
      isModalOpen.value = false;
      fetchSongDetail(song.value.id);
    }, 1000);
  } catch (err) {
    statusMessage.value = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu.';
    isError.value = true;
    toast.showToast(statusMessage.value, 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="postcss">
.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

.quality-item {
  @apply bg-gray-50 dark:bg-bg-card p-3 rounded-xl border border-gray-100 dark:border-bg-border;
}

.badge-ok {
  @apply inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase rounded w-fit;
}
.badge-error {
  @apply inline-block px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-[10px] font-bold uppercase rounded w-fit;
}
.badge-warn {
  @apply inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-[10px] font-bold uppercase rounded w-fit;
}
.badge-info {
  @apply inline-block px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-[10px] font-bold uppercase rounded w-fit;
}

/* Slide Transition for tabs */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
