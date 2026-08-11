<template>
  <div class="p-6 md:p-8 bg-gray-50 dark:bg-bg-base min-h-screen text-gray-800 dark:text-text-base font-sans">
    
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[50vh]">
      <div class="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">Đang tải thông tin nghệ sĩ...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center min-h-[50vh] bg-white dark:bg-bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-bg-border p-8">
      <MfIcon name="error_outline" size="64" className="text-rose-400 mb-4" />
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Không thể tải dữ liệu</h2>
      <p class="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">{{ error }}</p>
      <button @click="$router.push('/admin/artists')" class="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold rounded-xl transition-colors">
        Quay lại danh sách
      </button>
    </div>

    <!-- Main Content -->
    <div v-else-if="artist" class="space-y-6">
      
      <!-- Back Button & Breadcrumbs -->
      <div class="flex items-center justify-between mb-2">
        <button @click="$router.push('/admin/artists')" class="flex items-center gap-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors font-medium">
          <MfIcon name="arrow_back" size="20" />
          <span>Quản lý nghệ sĩ</span>
        </button>
        <div class="flex gap-2">
          <!-- Buttons for fetching actions if needed later -->
        </div>
      </div>

      <!-- Header Section -->
      <div class="bg-white dark:bg-bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-bg-border overflow-hidden">
        <div class="h-32 md:h-48 relative overflow-hidden bg-gray-900">
          <img :src="formatImageUrl(artist.avatar_url)" @error="handleImageError" class="absolute inset-0 w-full h-full object-cover blur-xl opacity-50 scale-110" />
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
        </div>
        <div class="px-6 md:px-8 pb-6 md:pb-8 relative">
          <div class="flex flex-col md:flex-row gap-6 md:items-end -mt-16 md:-mt-20">
            <img :src="formatImageUrl(artist.avatar_url)" @error="handleImageError" class="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-bg-surface object-cover shadow-lg bg-gray-100 z-10" />
            <div class="flex-1 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <h1 class="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">{{ artist.name }}</h1>
                <button @click="openEditModal" class="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-emerald-100 dark:bg-bg-card dark:hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-full transition-colors focus:outline-none" title="Chỉnh sửa thông tin">
                  <MfIcon name="edit" size="18" />
                </button>
                <span v-if="artist.market" :class="['px-3 py-1 rounded-full text-xs font-bold', getRegionBadgeClass(artist.market)]">
                  {{ artist.market }}
                </span>
                <span v-if="artist.country" class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {{ artist.country }}
                </span>
              </div>
              <p class="text-gray-500 dark:text-gray-400 flex items-center gap-4 text-sm font-medium">
                <span title="Total Listens" class="flex items-center gap-1"><MfIcon name="play_circle" size="16"/> {{ formatNumber(stats.totalListens) }} lượt nghe</span>
                <span title="Followers" class="flex items-center gap-1"><MfIcon name="favorite" size="16"/> {{ formatNumber(stats.followerCount) }} followers</span>
              </p>
              </div>
            </div>
          </div>
          
          <!-- Hai cột: Tiểu sử & Thông tin nhanh -->
          <div class="grid grid-cols-1 xl:grid-cols-[1.5fr_0.8fr] gap-6 mt-8 border-t border-gray-100 dark:border-bg-border pt-8">
            <!-- Cột trái: Tiểu sử -->
            <div class="flex flex-col">
              <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Tiểu sử</h3>
              
              <div v-if="!artist.bio" class="text-gray-500 dark:text-gray-400 text-sm font-medium italic py-6 px-4 bg-gray-50 dark:bg-bg-card rounded-xl border border-gray-100 dark:border-bg-border">
                Chưa có tiểu sử cho nghệ sĩ này.
              </div>
              
              <div v-else class="relative bg-gray-50/50 dark:bg-bg-card/50 rounded-2xl p-5 md:p-6 border border-gray-100 dark:border-bg-border flex-1 flex flex-col">
                <div ref="bioWrapper" :class="['relative transition-all duration-300', isBioExpanded ? 'max-h-[360px] md:max-h-[460px] overflow-y-auto overscroll-contain pr-3 custom-scrollbar' : 'max-h-[140px] overflow-hidden']">
                  <p class="text-gray-600 dark:text-gray-300 text-sm md:text-base leading-relaxed md:leading-loose whitespace-pre-line break-words">
                    {{ artist.bio }}
                  </p>
                  <!-- Fade overlay -->
                  <div v-if="!isBioExpanded && isBioLong" class="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-50 dark:from-[#1e222b] to-transparent pointer-events-none"></div>
                </div>
                
                <div v-if="isBioLong" class="mt-4 text-center">
                  <button @click="toggleBio" class="px-4 py-2 bg-white dark:bg-bg-surface border border-gray-200 dark:border-gray-700 rounded-full text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-600 hover:border-emerald-600 font-bold text-xs uppercase tracking-wider transition-all shadow-sm inline-flex items-center gap-1 focus:outline-none">
                    {{ isBioExpanded ? 'Thu gọn' : 'Xem thêm' }}
                    <MfIcon name="more_horiz" size="16" />
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Cột phải: Thông tin nhanh -->
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Thông tin nhanh</h3>
              <div class="bg-gray-50 dark:bg-bg-card rounded-2xl border border-gray-100 dark:border-bg-border overflow-hidden">
                <ul class="divide-y divide-gray-100 dark:divide-gray-800/50">
                  <li class="flex items-center justify-between p-4 md:p-5 hover:bg-white dark:hover:bg-bg-surface transition-colors">
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Tổng bài hát</span>
                    <span class="font-bold text-gray-900 dark:text-white">{{ formatNumber(stats.songCount) }}</span>
                  </li>
                  <li class="flex items-center justify-between p-4 md:p-5 hover:bg-white dark:hover:bg-bg-surface transition-colors">
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Tổng album / EP</span>
                    <span class="font-bold text-gray-900 dark:text-white">{{ formatNumber(stats.albumCount + stats.singleCount) }}</span>
                  </li>
                  <li class="flex items-center justify-between p-4 md:p-5 hover:bg-white dark:hover:bg-bg-surface transition-colors">
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Tổng lượt nghe</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ formatNumber(stats.totalListens) }}</span>
                  </li>
                  <li class="flex items-center justify-between p-4 md:p-5 hover:bg-white dark:hover:bg-bg-surface transition-colors">
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Thể loại chính</span>
                    <span class="font-bold text-gray-900 dark:text-white truncate max-w-[150px] text-right" :title="stats.main_genre || 'Chưa phân loại'">{{ stats.main_genre || 'Chưa phân loại' }}</span>
                  </li>
                  <li class="flex items-center justify-between p-4 md:p-5 hover:bg-white dark:hover:bg-bg-surface transition-colors">
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Nguồn tiểu sử</span>
                    <span class="font-semibold text-gray-700 dark:text-gray-300 text-sm">{{ artist.metadata_source || 'Thủ công' }}</span>
                  </li>
                  <li class="flex items-center justify-between p-4 md:p-5 hover:bg-white dark:hover:bg-bg-surface transition-colors">
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">Cập nhật lúc</span>
                    <span class="font-semibold text-gray-700 dark:text-gray-300 text-sm">{{ formatDate(artist.metadata_fetched_at || artist.created_at, true) }}</span>
                  </li>
                </ul>
              </div>
              
              <!-- Meta tags -->
              <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] text-gray-400 dark:text-gray-500 font-medium px-2">
                <div>ID: {{ artist.id }}</div>
                <div v-if="artist.spotify_artist_id">Spotify: {{ artist.spotify_artist_id }}</div>
                <div v-if="artist.avatar_source">Nguồn Ảnh: {{ artist.avatar_source }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Listen Trend Chart -->
      <div class="bg-white dark:bg-bg-surface p-6 rounded-2xl border border-gray-100 dark:border-bg-border shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Lượt nghe theo thời gian</h3>
          <select v-model="trendRange" @change="fetchArtistData" class="px-3 py-1.5 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none">
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày qua</option>
            <option value="30d">30 ngày qua</option>
          </select>
        </div>
        <div class="h-64 relative">
          <LineChart v-if="listenTrend.length" :data="listenTrendData" :options="chartOptions" />
          <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">Không có dữ liệu lượt nghe</div>
        </div>
      </div>

      <!-- Top Songs -->
      <div class="bg-white dark:bg-bg-surface p-6 rounded-2xl border border-gray-100 dark:border-bg-border shadow-sm">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Bài Hát</h3>
        <div v-if="topSongs.length === 0" class="text-gray-500 text-center py-8 bg-gray-50 dark:bg-bg-card rounded-xl">Nghệ sĩ này chưa có bài hát.</div>
        <div v-else class="space-y-3">
          <div v-for="(song, idx) in topSongs.slice(0, 5)" :key="song.id" @click="song.id ? $router.push(`/admin/songs/${song.id}`) : null" class="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-bg-card hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-emerald-200 dark:hover:border-emerald-500/30">
            <span class="text-gray-400 dark:text-gray-500 font-bold w-4 text-right text-sm">{{ idx + 1 }}</span>
            <img :src="formatImageUrl(song.cover_url)" @error="handleImageError" class="w-12 h-12 rounded-lg object-cover shadow-sm group-hover:scale-105 transition-transform" />
            <div class="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
              <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-900 dark:text-white text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" :title="song.title">{{ song.title }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  <span v-if="song.album_id" @click.stop="$router.push(`/admin/albums/${song.album_id}/detail`)" class="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer">{{ song.album }}</span>
                  <span v-else-if="song.album">{{ song.album }}</span>
                  <span v-else>Độc lập</span>
                  • {{ song.genre || 'Chưa phân loại' }}
                </p>
              </div>
              <div class="flex items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
                <span class="flex items-center gap-1.5" title="Lượt nghe"><MfIcon name="play_arrow" size="16" className="text-emerald-500"/> {{ formatNumber(song.play_count) }}</span>
                <span class="flex items-center gap-1.5 w-16" title="Thời lượng"><span class="text-[10px]">🕒</span> {{ formatDuration(song.duration_sec) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- Tabs -->
      <div class="bg-white dark:bg-bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-bg-border overflow-hidden">
        <div class="flex border-b border-gray-100 dark:border-bg-border">
          <button @click="activeTab = 'songs'" :class="['px-6 py-4 text-sm font-bold transition-colors focus:outline-none relative', activeTab === 'songs' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800']">
            Danh sách bài hát ({{ songs.length }})
            <div v-if="activeTab === 'songs'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>
          </button>
          <button @click="activeTab = 'albums'" :class="['px-6 py-4 text-sm font-bold transition-colors focus:outline-none relative', activeTab === 'albums' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800']">
            Danh sách Album ({{ albums.length }})
            <div v-if="activeTab === 'albums'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>
          </button>
        </div>

        <!-- Songs Tab -->
        <div v-if="activeTab === 'songs'" class="p-0">
          <div v-if="songs.length === 0" class="p-12 text-center">
             <MfIcon name="music_off" size="48" className="text-gray-300 dark:text-gray-600 mb-3 mx-auto" />
             <p class="text-gray-500 dark:text-gray-400 font-medium">Nghệ sĩ này chưa có bài hát nào.</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-gray-50/50 dark:bg-bg-card/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-100 dark:border-bg-border">
                  <th class="py-3 px-6 w-2/5 min-w-[300px]">Bài hát</th>
                  <th class="py-3 px-6 w-1/5 min-w-[150px]">Album</th>
                  <th class="py-3 px-6 w-32">Thể loại</th>
                  <th class="py-3 px-6 w-24 text-center">Âm thanh</th>
                  <th class="py-3 px-6 w-24 text-center">Lyrics</th>
                  <th class="py-3 px-6 w-32 text-right">Lượt nghe</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
                <tr v-for="song in paginatedSongs" :key="song.id" @click="song.id ? $router.push(`/admin/songs/${song.id}`) : null" class="hover:bg-gray-50/80 dark:hover:bg-bg-card transition-colors cursor-pointer group">
                  <td class="py-3 px-6">
                    <div class="flex items-center gap-3">
                      <img :src="formatImageUrl(song.cover_url)" @error="handleImageError" class="w-10 h-10 rounded object-cover shadow-sm bg-gray-200 group-hover:scale-105 transition-transform" />
                      <div class="flex flex-col min-w-0 max-w-[200px] md:max-w-[300px]">
                        <span class="font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" :title="song.title">{{ song.title }}</span>
                        <span class="text-xs text-gray-400 truncate mt-0.5" :title="song.audio_url">{{ formatDuration(song.duration_sec) }} • {{ truncateUrl(song.audio_url) || 'No file' }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-6 text-sm text-gray-700 dark:text-gray-300">
                    <span v-if="song.album_id" @click.stop="$router.push(`/admin/albums/${song.album_id}/detail`)" class="cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors truncate block">
                      {{ song.album }}
                    </span>
                    <span v-else-if="song.album">{{ song.album }}</span>
                    <span v-else>Độc lập</span>
                  </td>
                  <td class="py-3 px-6 text-sm">
                    <span v-if="song.genre" class="px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs font-bold">{{ song.genre }}</span>
                    <span v-else class="text-gray-400 text-xs">-</span>
                  </td>
                  <td class="py-3 px-6 text-center">
                    <MfIcon v-if="song.audio_url" name="check_circle" size="18" className="text-emerald-500" title="Đã có audio" />
                    <MfIcon v-else name="cancel" size="18" className="text-rose-500" title="Thiếu audio" />
                  </td>
                  <td class="py-3 px-6 text-center">
                    <MfIcon v-if="song.lyrics" name="check_circle" size="18" className="text-emerald-500" title="Đã có lyrics" />
                    <MfIcon v-else name="cancel" size="18" className="text-gray-300 dark:text-gray-600" title="Chưa có lyrics" />
                  </td>
                  <td class="py-3 px-6 text-right font-semibold text-gray-700 dark:text-gray-300">
                    {{ formatNumber(song.play_count) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Phân trang bài hát -->
          <div v-if="totalSongPages > 1" class="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden md:inline">
              Hiển thị {{ (currentSongPage - 1) * songsPerPage + 1 }} - {{ Math.min(currentSongPage * songsPerPage, songs.length) }} trong {{ songs.length }} bài hát
            </span>
            <AdminPagination v-model:currentPage="currentSongPage" :totalPages="totalSongPages" />
          </div>
        </div>

        <!-- Albums Tab -->
        <div v-if="activeTab === 'albums'" class="p-6">
          <div v-if="albums.length === 0" class="p-12 text-center">
             <MfIcon name="album" size="48" className="text-gray-300 dark:text-gray-600 mb-3 mx-auto" />
             <p class="text-gray-500 dark:text-gray-400 font-medium">Nghệ sĩ này chưa có album nào.</p>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div v-for="album in albums" :key="album.id" @click="album.id ? $router.push(`/admin/albums/${album.id}/detail`) : null" :class="['bg-gray-50 dark:bg-bg-card rounded-xl border border-gray-100 dark:border-bg-border overflow-hidden flex flex-col transition-all group', album.id ? 'cursor-pointer hover:bg-white hover:shadow-md hover:border-emerald-200 dark:hover:bg-gray-800 dark:hover:border-emerald-500/30' : '']">
              <div class="p-4 flex items-center gap-4">
                <img :src="formatImageUrl(album.cover_url)" @error="handleImageError" class="w-16 h-16 rounded-lg object-cover shadow-sm bg-gray-200 shrink-0 border border-gray-100 dark:border-gray-700 group-hover:scale-105 transition-transform duration-300" />
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" :title="album.title">{{ album.title }}</h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    {{ album.album_type }} • {{ formatDate(album.release_date, true).substring(6) || 'N/A' }} • {{ album.actual_song_count }} bài
                  </p>
                </div>
                <div class="shrink-0 flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition-colors" title="Mở chi tiết album">
                  <span class="text-[10px] font-bold uppercase tracking-wider mr-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">Chi tiết</span>
                  <MfIcon name="chevron_right" size="20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="isEditModalOpen" class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="closeEditModal" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="mx-auto flex w-full max-w-2xl max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col bg-white dark:bg-bg-surface rounded-2xl shadow-2xl overflow-hidden">
          <header class="shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/50">
            <h2 class="text-xl font-extrabold text-gray-900 dark:text-white" id="modal-title">
              Chỉnh sửa thông tin Nghệ sĩ
            </h2>
            <button type="button" class="rounded-full p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 focus:outline-none transition-colors" @click="closeEditModal">
              <MfIcon name="close" size="24" />
            </button>
          </header>
          
          <div class="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <form @submit.prevent="submitForm" class="space-y-5">
              <div>
                <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Tên nghệ sĩ <span class="text-rose-500">*</span></label>
                <input v-model="form.name" type="text" required class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm" />
              </div>

              <div>
                <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Khu vực / Thế hệ <span class="text-rose-500">*</span></label>
                <select v-model="form.region" required class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm appearance-none cursor-pointer">
                  <option v-for="r in regionsList" :key="r" :value="r">{{ r }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Tiểu sử</label>
                <textarea v-model="form.bio" rows="4" class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm resize-none"></textarea>
              </div>

              <div>
                <label class="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Ảnh đại diện (Avatar)</label>
                <div @click="$refs.avatarInput.click()" class="border-2 border-dashed border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400 transition-colors group" :class="{ 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30': form.avatar }">
                  <input type="file" ref="avatarInput" accept="image/*" @change="handleAvatar" hidden />
                  <MfIcon v-if="!form.avatar" name="account_circle" size="32" className="text-emerald-300 dark:text-emerald-500/50 group-hover:text-emerald-500 mb-2 transition-colors" />
                  <span v-if="!form.avatar" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Tải lên ảnh mới để thay thế</span>
                  <span v-else class="text-sm font-bold text-teal-600 dark:text-teal-400 text-center break-all">🖼️ {{ form.avatar.name }}</span>
                </div>
              </div>

              <div v-if="statusMessage" :class="['p-3 rounded-xl text-sm font-bold text-center', isError ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400']">
                {{ statusMessage }}
              </div>
              
              <button type="submit" hidden ref="submitBtn"></button>
            </form>
          </div>
          
          <footer class="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/50">
            <button type="button" @click="closeEditModal" class="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none shadow-sm">Hủy</button>
            <button type="button" @click="$refs.submitBtn.click()" :disabled="saving" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
              <div v-if="saving" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              {{ saving ? 'Đang lưu...' : 'Lưu thông tin' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/axios'
import MfIcon from '@/components/common/MfIcon.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import { toBackendAssetUrl } from '@/config/runtime'
import { Line as LineChart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const route = useRoute()
const artistId = route.params.id

const loading = ref(true)
const error = ref(null)
const artist = ref(null)
const stats = ref({})
const songs = ref([])
const albums = ref([])
const relatedIssues = ref([])
const warnings = ref([])
const listenTrend = ref([])
const topSongs = ref([])
const trendRange = ref('30d')

const isBioExpanded = ref(false)
const bioWrapper = ref(null)

const isBioLong = computed(() => {
  return artist.value?.bio && artist.value.bio.length > 400
})

const toggleBio = () => {
  isBioExpanded.value = !isBioExpanded.value
  if (!isBioExpanded.value && bioWrapper.value) {
    bioWrapper.value.scrollTop = 0
  }
}

const listenTrendData = computed(() => {
  return {
    labels: listenTrend.value.map(t => t.label),
    datasets: [
      {
        label: 'Lượt nghe',
        data: listenTrend.value.map(t => t.listens),
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#10b981',
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#fff',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 10,
      displayColors: false
    }
  },
  scales: {
    x: {
      grid: { display: false, drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11 }, precision: 0 }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}

const activeTab = ref('songs')

// Phân trang danh sách bài hát
const currentSongPage = ref(1)
const songsPerPage = 10

const paginatedSongs = computed(() => {
  const start = (currentSongPage.value - 1) * songsPerPage
  return songs.value.slice(start, start + songsPerPage)
})

const totalSongPages = computed(() => Math.ceil(songs.value.length / songsPerPage) || 1)

// Edit Modal State
const isEditModalOpen = ref(false)
const saving = ref(false)
const statusMessage = ref('')
const isError = ref(false)
const regionsList = ['VPOP', 'KPOP', 'US-UK', 'Khác']
const form = ref({
  name: '',
  bio: '',
  region: 'Khác',
  avatar: null
})

async function fetchArtistData() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get(`/admin/artists/${artistId}/detail?range=${trendRange.value}`)
    if (res.data?.success) {
      const data = res.data.data
      artist.value = data.artist
      stats.value = data.stats || {}
      songs.value = data.songs || []
      
      albums.value = data.albums || []
      
      relatedIssues.value = data.relatedIssues || []
      warnings.value = data.warnings || []
      listenTrend.value = data.listenTrend || []
      topSongs.value = data.topSongs || []
    } else {
      error.value = res.data?.message || 'Không thể lấy dữ liệu nghệ sĩ'
    }
  } catch (err) {
    console.error('Lỗi khi lấy dữ liệu nghệ sĩ:', err)
    error.value = err.response?.data?.message || 'Đã có lỗi xảy ra từ máy chủ'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchArtistData()
})

// Modal Logic
function openEditModal() {
  if (!artist.value) return
  form.value = {
    name: artist.value.name || '',
    bio: artist.value.bio || '',
    region: artist.value.market || artist.value.region || 'Khác',
    avatar: null
  }
  statusMessage.value = ''
  isError.value = false
  isEditModalOpen.value = true
}

function closeEditModal() {
  isEditModalOpen.value = false
}

function handleAvatar(event) {
  const file = event.target.files[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      toastStore.showToast('Vui lòng chọn file hình ảnh (jpg, png,...)', 'error')
      return
    }
    form.value.avatar = file
  }
}

async function submitForm() {
  if (!form.value.name) {
    statusMessage.value = 'Tên nghệ sĩ là bắt buộc'
    isError.value = true
    return
  }

  saving.value = true
  statusMessage.value = ''
  
  const formData = new FormData()
  formData.append('name', form.value.name)
  formData.append('bio', form.value.bio)
  formData.append('region', form.value.region)
  if (form.value.avatar) formData.append('avatar', form.value.avatar)

  try {
    const res = await api.put(`/admin/artists/${artistId}`, formData)
    if (res.data?.success) {
      closeEditModal()
      fetchArtistData() // reload info
    } else {
      statusMessage.value = res.data?.message || 'Có lỗi xảy ra'
      isError.value = true
    }
  } catch (err) {
    console.error(err)
    statusMessage.value = err.response?.data?.message || 'Lỗi khi lưu thông tin'
    isError.value = true
  } finally {
    saving.value = false
  }
}

// Format Helpers
function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num || 0)
}

function formatDate(dateString, short = false) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (short) {
    return d.toLocaleDateString('vi-VN')
  }
  return d.toLocaleString('vi-VN')
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function truncateUrl(url) {
  if (!url) return ''
  if (url.length <= 40) return url
  return url.substring(0, 15) + '...' + url.substring(url.length - 15)
}

function formatImageUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80'
  return toBackendAssetUrl(url)
}

function handleImageError(e) {
  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80'
}

function getRegionBadgeClass(region) {
  const r = region?.toUpperCase() || ''
  if (r.includes('KPOP')) return 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400'
  if (r.includes('VPOP')) return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
  if (r.includes('USUK') || r.includes('US-UK')) return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function getIssueLabel(type) {
  const map = {
    missing_audio: 'Thiếu file Audio',
    broken_audio: 'Lỗi đường dẫn Audio (không tồn tại)',
    missing_cover: 'Thiếu ảnh bìa bài hát',
    missing_lyrics: 'Thiếu lời bài hát (Lyrics)',
    missing_features: 'Thiếu phân tích âm thanh (Tempo, v.v)'
  }
  return map[type] || type
}
</script>
