<template>
  <div class="admin-user-detail">
    <!-- Header: Quick info & Actions -->
    <header class="detail-header" v-if="!loading && user">
      <div class="header-back" @click="$router.push('/admin/users')">
        <MfIcon name="arrow_back" size="16" />
        Quay lại
      </div>
      
      <div class="header-main">
        <div class="user-profile">
          <img v-if="user.avatar_url" :src="normalizeImageUrl(user.avatar_url, 'user')" class="avatar" />
          <div v-else class="avatar-placeholder">
            {{ user.display_name?.charAt(0).toUpperCase() || 'U' }}
          </div>
          <div class="user-info">
            <h1 class="user-name">{{ user.display_name }}</h1>
            <p class="user-email">{{ user.email }} &bull; Đăng ký: {{ new Date(user.created_at).toLocaleDateString('vi-VN') }}</p>
            <div class="badges">
              <span class="badge role" :class="user.role">{{ user.role === 'admin' ? 'Quản trị viên' : 'Thành viên' }}</span>
              <span class="badge status" :class="user.status">{{ user.status === 'active' ? 'Hoạt động' : 'Bị khóa' }}</span>
              <span class="badge premium" :class="user.is_premium ? 'active' : 'free'">
                {{ user.is_premium ? 'Premium' : 'Free' }}
              </span>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <button class="btn-action bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl" @click="exportReport" title="Xuất báo cáo">
            Xuất báo cáo
          </button>
          <button class="btn-action" @click="toggleRole" :title="user.role === 'admin' ? 'Hạ cấp' : 'Thăng cấp'">
            {{ user.role === 'admin' ? 'Hạ cấp' : 'Thăng cấp' }}
          </button>
          <button class="btn-action" :class="{ 'unlock': user.status === 'locked' }" @click="toggleStatus">
            {{ user.status === 'locked' ? 'Mở khóa' : 'Khóa' }}
          </button>
          <button class="btn-action premium" @click="openPremiumModal">
            Gia hạn
          </button>
        </div>
      </div>
    </header>

    <!-- State Loading -->
    <div v-if="loading" class="state-container">
      <div class="spinner"></div>
      <p>Đang tải chi tiết người dùng...</p>
    </div>

    <!-- State Error / Not Found -->
    <div v-else-if="error" class="state-container">
      <MfIcon name="error_outline" size="48" className="icon-error" />
      <h3>Lỗi khi tải dữ liệu</h3>
      <p>{{ error }}</p>
      <button class="btn-secondary mt-4" @click="$router.push('/admin/users')">Quay lại danh sách</button>
    </div>

    <!-- Main Content -->
    <div v-else class="detail-content">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <!-- 1. Tổng lượt nghe -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 min-h-[110px] flex flex-col justify-center items-center text-center relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden group">
          <div class="z-10">
            <span class="text-slate-500 text-sm font-medium truncate block">Tổng lượt nghe</span>
          </div>
          <div class="mt-2 z-10">
            <span class="text-slate-900 text-3xl font-bold">{{ summary.totalListens ?? '--' }}</span>
            <div v-if="summary.trends?.totalListens" class="mt-1 text-sm font-medium" :class="getTrendClass(summary.trends.totalListens.status)">
              {{ summary.trends.totalListens.text }}
            </div>
            <div v-else class="mt-1 text-sm font-medium text-slate-400">
              Tổng hiện tại
            </div>
          </div>
          <!-- Decorative SVG -->
          <svg class="absolute bottom-0 right-0 w-24 h-16 text-violet-200 opacity-40 z-0 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path d="M0,50 Q25,20 50,40 T100,10 L100,50 Z" fill="currentColor" />
            <path d="M0,50 Q25,20 50,40 T100,10" fill="none" stroke="currentColor" stroke-width="2" class="text-violet-300" />
          </svg>
        </div>

        <!-- 2. Thời gian nghe -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 min-h-[110px] flex flex-col justify-center items-center text-center relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden group">
          <div class="z-10">
            <span class="text-slate-500 text-sm font-medium truncate block">Thời gian nghe</span>
          </div>
          <div class="mt-2 z-10 flex flex-col items-center">
            <div class="flex items-baseline justify-center gap-1">
              <span class="text-slate-900 text-3xl font-bold">{{ summary.totalListeningMinutes ?? '--' }}</span>
              <span v-if="summary.totalListeningMinutes !== undefined && summary.totalListeningMinutes !== null" class="text-slate-500 text-base">phút</span>
            </div>
            <div v-if="summary.trends?.totalListeningMinutes" class="mt-1 text-sm font-medium" :class="getTrendClass(summary.trends.totalListeningMinutes.status)">
              {{ summary.trends.totalListeningMinutes.text }}
            </div>
            <div v-else class="mt-1 text-sm font-medium text-slate-400">
              Tổng hiện tại
            </div>
          </div>
          <svg class="absolute bottom-0 right-0 w-24 h-16 text-cyan-200 opacity-40 z-0 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path d="M0,50 Q25,10 50,30 T100,20 L100,50 Z" fill="currentColor" />
            <path d="M0,50 Q25,10 50,30 T100,20" fill="none" stroke="currentColor" stroke-width="2" class="text-cyan-300" />
          </svg>
        </div>

        <!-- 3. Bài hát yêu thích -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 min-h-[110px] flex flex-col justify-center items-center text-center relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden group">
          <div class="z-10">
            <span class="text-slate-500 text-sm font-medium truncate block">Bài hát yêu thích</span>
          </div>
          <div class="mt-2 z-10">
            <span class="text-slate-900 text-3xl font-bold">{{ summary.likedSongs ?? '--' }}</span>
            <div v-if="summary.trends?.likedSongs" class="mt-1 text-sm font-medium" :class="getTrendClass(summary.trends.likedSongs.status)">
              {{ summary.trends.likedSongs.text }}
            </div>
            <div v-else class="mt-1 text-sm font-medium text-slate-400">
              Tổng hiện tại
            </div>
          </div>
          <svg class="absolute bottom-0 right-0 w-24 h-16 text-rose-200 opacity-40 z-0 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path d="M0,50 Q20,30 50,15 T100,25 L100,50 Z" fill="currentColor" />
            <path d="M0,50 Q20,30 50,15 T100,25" fill="none" stroke="currentColor" stroke-width="2" class="text-rose-300" />
          </svg>
        </div>

        <!-- 4. Playlist tự tạo -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 min-h-[110px] flex flex-col justify-center items-center text-center relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden group">
          <div class="z-10">
            <span class="text-slate-500 text-sm font-medium truncate block">Playlist tự tạo</span>
          </div>
          <div class="mt-2 z-10">
            <span class="text-slate-900 text-3xl font-bold">{{ userPlaylistsLoading ? '--' : (userPlaylists.summary?.manualCount ?? '--') }}</span>
            <div v-if="summary.trends?.createdPlaylists" class="mt-1 text-sm font-medium" :class="getTrendClass(summary.trends.createdPlaylists.status)">
              {{ summary.trends.createdPlaylists.text }}
            </div>
            <div v-else class="mt-1 text-sm font-medium text-slate-400">
              Tổng hiện tại
            </div>
          </div>
          <svg class="absolute bottom-0 right-0 w-24 h-16 text-pink-200 opacity-40 z-0 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path d="M0,50 Q30,10 60,35 T100,10 L100,50 Z" fill="currentColor" />
            <path d="M0,50 Q30,10 60,35 T100,10" fill="none" stroke="currentColor" stroke-width="2" class="text-pink-300" />
          </svg>
        </div>

        <!-- 5. Đang theo dõi -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 min-h-[110px] flex flex-col justify-center items-center text-center relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden group">
          <div class="z-10">
            <span class="text-slate-500 text-sm font-medium truncate block">Đang theo dõi</span>
          </div>
          <div class="mt-2 z-10">
            <span class="text-slate-900 text-3xl font-bold">{{ summary.followedArtists ?? '--' }}</span>
            <div v-if="summary.trends?.followedArtists" class="mt-1 text-sm font-medium" :class="getTrendClass(summary.trends.followedArtists.status)">
              {{ summary.trends.followedArtists.text }}
            </div>
            <div v-else class="mt-1 text-sm font-medium text-slate-400">
              Tổng hiện tại
            </div>
          </div>
          <svg class="absolute bottom-0 right-0 w-24 h-16 text-emerald-200 opacity-40 z-0 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path d="M0,50 Q25,35 50,15 T100,30 L100,50 Z" fill="currentColor" />
            <path d="M0,50 Q25,35 50,15 T100,30" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-300" />
          </svg>
        </div>

        <!-- 6. Chi tiêu -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 min-h-[110px] flex flex-col justify-center items-center text-center relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden group">
          <div class="z-10">
            <span class="text-slate-500 text-sm font-medium truncate block">Chi tiêu</span>
          </div>
          <div class="mt-2 z-10 flex flex-col items-center">
            <div class="flex items-baseline justify-center gap-1">
              <span class="text-slate-900 text-3xl font-bold">{{ summary.totalSpent !== undefined ? formatCurrency(summary.totalSpent) : '--' }}</span>
              <span v-if="summary.totalSpent !== undefined" class="text-slate-500 text-base">đ</span>
            </div>
            <div v-if="summary.trends?.totalSpent" class="mt-1 text-sm font-medium" :class="getTrendClass(summary.trends.totalSpent.status)">
              {{ summary.trends.totalSpent.text }}
            </div>
            <div v-else class="mt-1 text-sm font-medium text-slate-400">
              Chưa có giao dịch tuần này
            </div>
          </div>
          <svg class="absolute bottom-0 right-0 w-24 h-16 text-amber-200 opacity-40 z-0 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path d="M0,50 Q40,20 60,40 T100,5 L100,50 Z" fill="currentColor" />
            <path d="M0,50 Q40,20 60,40 T100,5" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-300" />
          </svg>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="tabs-nav mt-6">
        <button v-for="tab in tabs" :key="tab.id" class="tab-btn" :class="{ active: currentTab === tab.id }" @click="currentTab = tab.id">
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <transition name="slide-up" mode="out-in">
          <!-- Wrapper div with key bound to currentTab for transition to work properly -->
          <div :key="currentTab">
            <!-- 1. TỔNG QUAN -->
            <div v-if="currentTab === 'overview'" class="tab-pane">
              <!-- Engagement & Heatmap Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <!-- Left: Engagement Score -->
                <div class="card bg-white border border-slate-200 rounded-2xl flex flex-col p-6 shadow-sm">
                  <h3 class="mb-4 font-bold text-slate-800 m-0">Engagement Score</h3>
                  <div v-if="engagementLoading" class="flex-1 flex justify-center items-center py-8">
                    <div class="spinner"></div>
                  </div>
                  <div v-else-if="!engagementData" class="flex-1 flex justify-center items-center py-8 text-slate-500 text-sm">
                    Chưa có dữ liệu
                  </div>
                  <div v-else class="flex-1 flex flex-col items-center justify-center">
                    <!-- SVG Gauge -->
                    <div class="relative w-40 h-20 overflow-hidden mb-4">
                      <svg viewBox="0 0 100 50" class="w-full h-full">
                        <!-- Nền -->
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" stroke-width="12" stroke-linecap="round" />
                        <!-- Giá trị -->
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#8b5cf6" stroke-width="12" stroke-linecap="round"
                              :stroke-dasharray="125.6" :stroke-dashoffset="125.6 - (125.6 * (engagementData.engagementScore === '--' ? 0 : engagementData.engagementScore) / 100)" 
                              style="transition: stroke-dashoffset 1s ease-in-out;" />
                      </svg>
                      <div class="absolute bottom-0 w-full text-center font-bold text-3xl text-slate-800">
                        {{ engagementData.engagementScore }}<span class="text-sm text-slate-500 font-normal">/100</span>
                      </div>
                    </div>
                    
                    <div class="w-full mt-2 space-y-3 text-sm">
                      <div class="flex justify-between border-b border-slate-100 pb-2">
                        <span class="text-slate-500">Nguy cơ churn</span>
                        <span class="font-semibold" :class="getChurnColor(engagementData.churnRisk)">{{ engagementData.churnRisk }}</span>
                      </div>
                      <div class="flex justify-between border-b border-slate-100 pb-2">
                        <span class="text-slate-500">Listening Streak</span>
                        <span class="font-semibold text-slate-700">{{ engagementData.currentStreakDays }}{{ engagementData.currentStreakDays !== '--' ? ' ngày' : '' }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-slate-500">Nghe gần nhất</span>
                        <span class="font-semibold text-slate-700">{{ formatRelativeTime(engagementData.lastListenedAt) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Right: Listening Heatmap -->
                <div class="card bg-white border border-slate-200 rounded-2xl flex flex-col p-6 shadow-sm">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="m-0 font-bold text-slate-800">Listening Heatmap (30 ngày qua)</h3>
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                      Ít <span class="w-4 h-4 rounded-md bg-slate-100"></span>
                      <span class="w-4 h-4 rounded-md bg-emerald-200"></span>
                      <span class="w-4 h-4 rounded-md bg-emerald-400"></span>
                      <span class="w-4 h-4 rounded-md bg-emerald-600"></span>
                      <span class="w-4 h-4 rounded-md bg-emerald-800"></span> Nhiều
                    </div>
                  </div>
                  
                  <div v-if="heatmapLoading" class="flex-1 flex justify-center items-center py-8">
                    <div class="spinner"></div>
                  </div>
                  <div v-else-if="!heatmapWeeks || heatmapWeeks.length === 0" class="flex-1 flex justify-center items-center py-8 text-slate-500 text-sm">
                    Chưa có dữ liệu nghe trong 30 ngày qua
                  </div>
                  <div v-else class="flex-1 flex justify-center items-center overflow-x-auto pb-2 custom-scrollbar">
                    <div class="flex flex-col gap-2" style="min-width: max-content;">
                      <!-- Weeks -->
                      <div v-for="(week, wIdx) in heatmapWeeks" :key="'w'+wIdx" class="flex flex-row gap-2">
                        <!-- Days in week -->
                        <div v-for="(day, dIdx) in week" :key="'d'+dIdx" 
                             class="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-md transition-all hover:scale-110 hover:shadow-sm"
                             :class="getHeatmapColor(day?.count)"
                             :title="day && day.date ? `${formatDateTitle(day.date)}: ${day.count} lượt nghe, ${Math.round(day.minutes)} phút` : ''"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          <div class="chart-grid mb-4">
            <div class="card">
              <div class="chart-header" style="margin-bottom: 20px;">
                <h3>Xu hướng nghe nhạc (30 ngày qua)</h3>
              </div>
              <div class="chart-container" style="position: relative; height: 300px; width: 100%;" v-if="listeningTrends.byDay.length">
                <LineChart :data="trendChartData" :options="trendChartOptions" />
              </div>
              <div v-else class="empty-text p-6 text-center">Chưa có dữ liệu nghe nhạc trong 30 ngày qua.</div>
            </div>

            <AdminGenreDonutChart
              title="Thể loại yêu thích"
              :data="musicTaste.favoriteGenres || []"
              nameKey="name"
              valueKey="listens"
              :centerLabel="new Intl.NumberFormat('vi-VN').format((musicTaste.favoriteGenres || []).reduce((sum, g) => sum + (Number(g.listens) || 0), 0))"
              centerSubLabel="lượt nghe"
              emptyText="Chưa có dữ liệu thể loại."
            />
          </div>

          <div class="section-grid">
            <div class="card">
              <h3>Top Bài Hát Nghe Nhiều</h3>
              <ul v-if="musicTaste.topSongs.length" class="simple-list">
                <li v-for="(song, i) in musicTaste.topSongs" :key="song.id" 
                    class="group flex items-center gap-3 rounded-xl px-2 py-2 cursor-pointer hover:bg-slate-50 transition -mx-2" 
                    title="Mở chi tiết bài hát" 
                    @click="goToAdminSong(song)">
                  <span class="rank">{{ i + 1 }}</span>
                  <img :src="normalizeImageUrl(song.cover_url)" class="tiny-cover" @error="handleImageError" />
                  <div class="info">
                    <span class="title group-hover:text-violet-600 transition">{{ song.title }}</span>
                    <span class="subtitle">{{ song.artist }}</span>
                  </div>
                  <span class="stat">{{ song.user_plays ?? song.listen_count ?? song.listens ?? 0 }} lượt của user</span>
                </li>
              </ul>
              <div v-else class="empty-text">Chưa có bài hát nào.</div>
            </div>
            
            <div class="card">
              <h3>Top Nghệ Sĩ Nghe Nhiều</h3>
              <ul v-if="musicTaste.topArtists.length" class="simple-list">
                <li v-for="(artist, i) in musicTaste.topArtists" :key="artist.id"
                    class="group flex items-center gap-3 rounded-xl px-2 py-2 cursor-pointer hover:bg-slate-50 transition -mx-2"
                    title="Mở chi tiết nghệ sĩ"
                    @click="goToAdminArtist(artist)">
                  <span class="rank">{{ i + 1 }}</span>
                  <img :src="normalizeImageUrl(artist.avatar_url)" class="tiny-cover rounded-full" style="border-radius: 50%" @error="handleImageError" />
                  <div class="info">
                    <span class="title group-hover:text-violet-600 transition">{{ artist.name }}</span>
                  </div>
                  <span class="stat">{{ artist.user_plays ?? artist.listen_count ?? artist.listens ?? 0 }} lượt của user</span>
                </li>
              </ul>
              <div v-else class="empty-text">Chưa có nghệ sĩ nào.</div>
            </div>
          </div>
        </div>

        <!-- 3. PLAYLIST & YÊU THÍCH -->
        <div v-if="currentTab === 'playlists'" class="tab-pane">
          <div v-if="userPlaylistsLoading" class="text-center py-8 text-slate-500">
            <div class="spinner inline-block w-6 h-6"></div>
            <div class="mt-2 text-xs">Đang tải playlist...</div>
          </div>
          <div v-else-if="userPlaylistsError" class="text-center py-8 text-red-500">
            Lỗi backend: {{ userPlaylistsError }}
          </div>
          <div v-else>
            <!-- 1. Stats Row -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div class="bg-white rounded-2xl p-4 border border-slate-200 flex items-center gap-4 shadow-sm">
                <div class="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-500 text-xl shrink-0">
                  <MfIcon name="queue_music" size="24" />
                </div>
                <div class="flex-1">
                  <p class="text-2xl font-bold text-slate-800">{{ userPlaylists.created?.length || 0 }}</p>
                  <p class="text-xs text-slate-500">Playlist tự tạo</p>
                </div>
                <div class="ml-auto shrink-0">
                  <svg class="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <path class="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"/>
                    <path class="text-violet-500 transition-all duration-500" :stroke-dasharray="`${Math.min(((userPlaylists.created?.length || 0) / 20) * 100, 100)}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"/>
                  </svg>
                </div>
              </div>
              
              <div class="bg-white rounded-2xl p-4 border border-slate-200 flex items-center gap-4 shadow-sm">
                <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-500 text-xl shrink-0">
                  <MfIcon name="server" size="24" />
                </div>
                <div class="flex-1">
                  <p class="text-2xl font-bold text-slate-800">{{ userPlaylists.system?.length || 0 }}</p>
                  <p class="text-xs text-slate-500">Playlist hệ thống</p>
                </div>
                <div class="ml-auto shrink-0">
                  <svg class="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <path class="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"/>
                    <path class="text-blue-500 transition-all duration-500" :stroke-dasharray="`${Math.min(((userPlaylists.system?.length || 0) / 20) * 100, 100)}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"/>
                  </svg>
                </div>
              </div>

              <div class="bg-white rounded-2xl p-4 border border-slate-200 flex items-center gap-4 shadow-sm">
                <div class="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-500 text-xl shrink-0">
                  <MfIcon name="auto_awesome" size="24" />
                </div>
                <div class="flex-1">
                  <p class="text-2xl font-bold text-slate-800">{{ userPlaylists.ai?.length || 0 }}</p>
                  <p class="text-xs text-slate-500">Playlist AI</p>
                </div>
                <div class="ml-auto shrink-0">
                  <svg class="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <path class="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"/>
                    <path class="text-cyan-500 transition-all duration-500" :stroke-dasharray="`${Math.min(((userPlaylists.ai?.length || 0) / 10) * 100, 100)}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- 2. Highlight Cards -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <!-- Manual Highlight -->
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 shadow-sm" :class="{ 'scale-[1.02] shadow-xl border-violet-200': expandedTracklist === 'manual', 'hover:-translate-y-1 hover:shadow-xl': expandedTracklist !== 'manual' }">
                <div v-if="highlightPlaylists.manual" class="h-full flex flex-col">
                  <div class="relative h-56 cursor-pointer group shrink-0" @click="toggleTracklist('manual')">
                    <div class="w-full h-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center overflow-hidden">
                      <AdminCoverThumb
                        :src="getPlaylistCover(highlightPlaylists.manual)"
                        size="custom"
                        rounded="none"
                        imgClass="group-hover:scale-110 transition-transform duration-500"
                        icon="library_music"
                        iconSize="48"
                        iconClass="text-violet-300"
                        class="w-full h-full bg-transparent border-0"
                      />
                    </div>
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-[2px]">
                      <div class="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white">
                        <MfIcon name="play" size="32" />
                      </div>
                    </div>
                    <div class="absolute top-3 left-3">
                      <span class="bg-white/20 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5">
                        <MfIcon name="person" size="14" /> Tự tạo
                      </span>
                    </div>
                    <div class="absolute bottom-3 right-3">
                      <span class="bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-lg text-slate-800">
                        {{ highlightPlaylists.manual.song_count || highlightPlaylists.manual.songs?.length || 0 }} bài hát
                      </span>
                    </div>
                  </div>
                  
                  <div class="p-5 flex flex-col flex-1">
                    <h3 class="font-bold text-lg truncate text-slate-800">{{ highlightPlaylists.manual.name }}</h3>
                    <p class="text-xs text-slate-500 mt-1 mb-3">Cập nhật: {{ highlightPlaylists.manual.updated_at ? new Date(highlightPlaylists.manual.updated_at).toLocaleDateString('vi-VN') : 'N/A' }}</p>
                    <p class="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[40px]">{{ highlightPlaylists.manual.description || 'Không có mô tả' }}</p>
                    
                    <div class="flex items-center justify-between mt-auto">
                      <button class="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 hover:text-violet-600 rounded-lg text-sm font-medium transition-colors" @click.stop="viewPlaylistDetail(highlightPlaylists.manual)">Xem chi tiết</button>
                    </div>
                  </div>
                  
                  <!-- Tracklist Expand -->
                  <div class="overflow-hidden transition-all duration-500 bg-slate-50 border-t border-slate-100" :style="{ maxHeight: expandedTracklist === 'manual' ? '400px' : '0px', opacity: expandedTracklist === 'manual' ? 1 : 0 }">
                    <div class="p-4 space-y-2" v-if="highlightPlaylists.manual.songs?.length">
                      <div class="flex items-center justify-between text-xs text-slate-400 px-2 mb-1">
                        <span class="w-4 text-center">#</span>
                        <span class="flex-1 ml-3">Tiêu đề</span>
                      </div>
                      <div v-for="(song, idx) in highlightPlaylists.manual.songs.slice(0, 4)" :key="song.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-violet-50 transition-colors group">
                        <span class="text-xs text-slate-400 w-4 text-center group-hover:text-violet-500">{{ idx + 1 }}</span>
                        <img :src="normalizeImageUrl(song.cover_url)" @error="handleImageError" class="w-8 h-8 rounded object-cover shrink-0 bg-slate-200">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium truncate text-slate-700">{{ song.title }}</p>
                          <p class="text-xs text-slate-500 truncate">{{ song.artist_name || song.artist || 'Unknown' }}</p>
                        </div>
                      </div>
                      <button class="w-full py-2 text-xs text-violet-600 font-medium hover:underline mt-1" @click.stop="viewPlaylistDetail(highlightPlaylists.manual)">Xem tất cả →</button>
                    </div>
                    <div class="p-4 text-center text-sm text-slate-500" v-else>
                      Nhấn "Xem chi tiết" để xem danh sách bài hát.
                    </div>
                  </div>
                </div>
                <div v-else class="h-full flex flex-col items-center justify-center p-6 text-slate-400 bg-slate-50">
                  <MfIcon name="queue_music" size="48" class="mb-2 opacity-50" />
                  <p>Chưa có playlist tự tạo</p>
                </div>
              </div>

              <!-- System Highlight -->
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 shadow-sm" :class="{ 'scale-[1.02] shadow-xl border-blue-200': expandedTracklist === 'system', 'hover:-translate-y-1 hover:shadow-xl': expandedTracklist !== 'system' }">
                <div v-if="highlightPlaylists.system" class="h-full flex flex-col">
                  <div class="relative h-56 cursor-pointer group shrink-0" @click="toggleTracklist('system')">
                    <div class="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden">
                      <AdminCoverThumb
                        :src="getPlaylistCover(highlightPlaylists.system)"
                        size="custom"
                        rounded="none"
                        imgClass="group-hover:scale-110 transition-transform duration-500"
                        icon="server"
                        iconSize="48"
                        iconClass="text-blue-300"
                        class="w-full h-full bg-transparent border-0"
                      />
                    </div>
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-[2px]">
                      <div class="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white">
                        <MfIcon name="play" size="32" />
                      </div>
                    </div>
                    <div class="absolute top-3 left-3 flex gap-2">
                      <span class="bg-white/20 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5">
                        <MfIcon name="server" size="14" /> Hệ thống
                      </span>
                    </div>
                    <div class="absolute bottom-3 right-3">
                      <span class="bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-lg text-slate-800">
                        {{ highlightPlaylists.system.song_count || highlightPlaylists.system.songs?.length || 0 }} bài hát
                      </span>
                    </div>
                  </div>
                  
                  <div class="p-5 flex flex-col flex-1">
                    <h3 class="font-bold text-lg truncate text-slate-800">{{ highlightPlaylists.system.name }}</h3>
                    <p class="text-xs text-slate-500 mt-1 mb-3">Cập nhật: {{ highlightPlaylists.system.updated_at ? new Date(highlightPlaylists.system.updated_at).toLocaleDateString('vi-VN') : 'N/A' }}</p>
                    <p class="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[40px]">{{ highlightPlaylists.system.description || 'Không có mô tả' }}</p>
                    
                    <div class="flex items-center justify-between mt-auto">
                      <button class="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors" @click.stop="viewPlaylistDetail(highlightPlaylists.system)">Chi tiết</button>
                      <button class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-500 hover:text-white rounded-lg text-slate-600 transition-colors" title="Làm mới" @click.stop="regenerateUserPlaylist(highlightPlaylists.system)">
                        <MfIcon name="sync" size="16" />
                      </button>
                    </div>
                  </div>
                  
                  <!-- Tracklist Expand -->
                  <div class="overflow-hidden transition-all duration-500 bg-slate-50 border-t border-slate-100" :style="{ maxHeight: expandedTracklist === 'system' ? '400px' : '0px', opacity: expandedTracklist === 'system' ? 1 : 0 }">
                    <div class="p-4 space-y-2" v-if="highlightPlaylists.system.songs?.length">
                      <div class="flex items-center justify-between text-xs text-slate-400 px-2 mb-1">
                        <span class="w-4 text-center">#</span>
                        <span class="flex-1 ml-3">Tiêu đề</span>
                      </div>
                      <div v-for="(song, idx) in highlightPlaylists.system.songs.slice(0, 4)" :key="song.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors group">
                        <span class="text-xs text-slate-400 w-4 text-center group-hover:text-blue-500">{{ idx + 1 }}</span>
                        <img :src="normalizeImageUrl(song.cover_url)" @error="handleImageError" class="w-8 h-8 rounded object-cover shrink-0 bg-slate-200">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium truncate text-slate-700">{{ song.title }}</p>
                          <p class="text-xs text-slate-500 truncate">{{ song.artist_name || song.artist || 'Unknown' }}</p>
                        </div>
                      </div>
                      <button class="w-full py-2 text-xs text-blue-600 font-medium hover:underline mt-1" @click.stop="viewPlaylistDetail(highlightPlaylists.system)">Xem tất cả →</button>
                    </div>
                    <div class="p-4 text-center text-sm text-slate-500" v-else>
                      Nhấn "Chi tiết" để xem danh sách bài hát.
                    </div>
                  </div>
                </div>
                <div v-else class="h-full flex flex-col items-center justify-center p-6 text-slate-400 bg-slate-50">
                  <MfIcon name="server" size="48" class="mb-2 opacity-50" />
                  <p>Chưa có playlist hệ thống</p>
                </div>
              </div>

              <!-- AI Highlight -->
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 shadow-sm" :class="{ 'scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] border-cyan-300': expandedTracklist === 'ai', 'hover:-translate-y-1 hover:shadow-xl': expandedTracklist !== 'ai' }">
                <div v-if="highlightPlaylists.ai" class="h-full flex flex-col">
                  <div class="relative h-56 cursor-pointer group shrink-0" @click="toggleTracklist('ai')">
                    <div class="w-full h-full bg-gradient-to-br from-cyan-100 to-purple-100 flex items-center justify-center overflow-hidden">
                      <AdminCoverThumb
                        :src="getPlaylistCover(highlightPlaylists.ai)"
                        size="custom"
                        rounded="none"
                        imgClass="group-hover:scale-110 transition-transform duration-500"
                        icon="auto_awesome"
                        iconSize="48"
                        iconClass="text-cyan-300"
                        class="w-full h-full bg-transparent border-0"
                      />
                    </div>
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-[2px]">
                      <div class="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white">
                        <MfIcon name="play" size="32" />
                      </div>
                    </div>
                    <div class="absolute top-3 left-3">
                      <span class="bg-gradient-to-r from-cyan-500 to-violet-500 px-2.5 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-md">
                        <MfIcon name="auto_awesome" size="14" /> AI Generated
                      </span>
                    </div>
                    <div class="absolute bottom-3 right-3">
                      <span class="bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-lg text-slate-800">
                        {{ highlightPlaylists.ai.song_count || highlightPlaylists.ai.songs?.length || 0 }} bài hát
                      </span>
                    </div>
                  </div>
                  
                  <div class="p-5 flex flex-col flex-1">
                    <h3 class="font-bold text-lg truncate text-slate-800">{{ highlightPlaylists.ai.name }}</h3>
                    <p class="text-xs text-slate-500 mt-1 mb-3">Cập nhật: {{ highlightPlaylists.ai.updated_at ? new Date(highlightPlaylists.ai.updated_at).toLocaleDateString('vi-VN') : 'N/A' }}</p>
                    <p class="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[40px]">{{ highlightPlaylists.ai.description || 'Gợi ý tự động từ AI' }}</p>
                    
                    <div class="flex items-center justify-between mt-auto">
                      <button class="px-3 py-1.5 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-600 rounded-lg text-sm font-medium transition-colors" @click.stop="viewPlaylistDetail(highlightPlaylists.ai)">Chi tiết</button>
                      <button class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-cyan-500 hover:text-white rounded-lg text-slate-600 transition-colors" title="Làm mới" @click.stop="regenerateUserPlaylist(highlightPlaylists.ai)">
                        <MfIcon name="sync" size="16" />
                      </button>
                    </div>
                  </div>
                  
                  <!-- Tracklist Expand -->
                  <div class="overflow-hidden transition-all duration-500 bg-slate-50 border-t border-slate-100" :style="{ maxHeight: expandedTracklist === 'ai' ? '400px' : '0px', opacity: expandedTracklist === 'ai' ? 1 : 0 }">
                    <div class="p-4 space-y-2" v-if="highlightPlaylists.ai.songs?.length">
                      <div class="flex items-center justify-between text-xs text-slate-400 px-2 mb-1">
                        <span class="w-4 text-center">#</span>
                        <span class="flex-1 ml-3">Tiêu đề</span>
                      </div>
                      <div v-for="(song, idx) in highlightPlaylists.ai.songs.slice(0, 4)" :key="song.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-cyan-50 transition-colors group">
                        <span class="text-xs text-slate-400 w-4 text-center group-hover:text-cyan-500">{{ idx + 1 }}</span>
                        <img :src="normalizeImageUrl(song.cover_url)" @error="handleImageError" class="w-8 h-8 rounded object-cover shrink-0 bg-slate-200">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium truncate text-slate-700">{{ song.title }}</p>
                          <p class="text-xs text-slate-500 truncate">{{ song.artist_name || song.artist || 'Unknown' }}</p>
                        </div>
                      </div>
                      <button class="w-full py-2 text-xs text-cyan-600 font-medium hover:underline mt-1" @click.stop="viewPlaylistDetail(highlightPlaylists.ai)">Xem tất cả →</button>
                    </div>
                    <div class="p-4 text-center text-sm text-slate-500" v-else>
                      Nhấn "Chi tiết" để xem danh sách bài hát.
                    </div>
                  </div>
                </div>
                <div v-else class="h-full flex flex-col items-center justify-center p-6 text-slate-400 bg-slate-50">
                  <MfIcon name="auto_awesome" size="48" class="mb-2 opacity-50" />
                  <p>Chưa có playlist AI</p>
                </div>
              </div>
            </div>

            <!-- 3. Analytics Section -->
            <div class="bg-white rounded-2xl p-6 border border-slate-200 mb-8 shadow-sm">
              <h4 class="font-bold mb-4 flex items-center gap-2 text-slate-800">
                <MfIcon name="analytics" class="text-violet-500" /> Phân tích Playlist
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                  <div class="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-500 text-lg shrink-0">
                    <MfIcon name="library_music" />
                  </div>
                  <div>
                    <p class="text-lg font-bold text-slate-800">{{ totalPlaylistsCount }} playlist</p>
                    <p class="text-xs text-slate-500">Tổng cộng thư viện</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                  <div class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 text-lg shrink-0">
                    <MfIcon name="music_note" />
                  </div>
                  <div>
                    <p class="text-lg font-bold text-slate-800">{{ totalSongsInPlaylists }} bài</p>
                    <p class="text-xs text-slate-500">Tổng số bài hát</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                  <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 text-lg shrink-0">
                    <MfIcon name="clock" />
                  </div>
                  <div>
                    <p class="text-lg font-bold text-slate-800 truncate" :title="lastUpdatedPlaylistDate">{{ lastUpdatedPlaylistDate }}</p>
                    <p class="text-xs text-slate-500">Cập nhật gần nhất</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                  <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 text-lg shrink-0">
                    <MfIcon name="music" />
                  </div>
                  <div>
                    <p class="text-lg font-bold text-slate-800">--</p>
                    <p class="text-xs text-slate-500">Lượt nghe playlist</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. Full List -->
            <div class="space-y-4">
              <!-- Manual List -->
              <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button class="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors" @click="showFullList.manual = !showFullList.manual">
                  <div class="flex items-center gap-2 font-bold text-slate-700">
                    <MfIcon name="queue_music" size="20" class="text-violet-500" /> Danh sách Playlist Tự tạo ({{ userPlaylists.created?.length || 0 }})
                  </div>
                  <MfIcon name="chevron_right" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': showFullList.manual }" />
                </button>
                <div v-show="showFullList.manual" class="p-4 border-t border-slate-200">
                  <div v-if="userPlaylists.created?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div v-for="pl in userPlaylists.created" :key="pl.id" class="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:shadow-md transition-shadow bg-white cursor-pointer" @click="viewPlaylistDetail(pl)">
                      <AdminCoverThumb
                        :src="getPlaylistCover(pl)"
                        size="lg"
                        icon="library_music"
                        iconClass="text-slate-400"
                        class="mr-3"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold truncate text-slate-800">{{ pl.name }}</p>
                        <p class="text-xs text-slate-500">{{ pl.song_count || pl.songs?.length || 0 }} bài hát</p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-center text-slate-500 py-4">Trống</p>
                </div>
              </div>

              <!-- System List -->
              <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button class="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors" @click="showFullList.system = !showFullList.system">
                  <div class="flex items-center gap-2 font-bold text-slate-700">
                    <MfIcon name="server" size="20" class="text-blue-500" /> Danh sách Playlist Hệ thống ({{ userPlaylists.system?.length || 0 }})
                  </div>
                  <MfIcon name="chevron_right" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': showFullList.system }" />
                </button>
                <div v-show="showFullList.system" class="p-4 border-t border-slate-200">
                  <div v-if="userPlaylists.system?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div v-for="pl in userPlaylists.system" :key="pl.id" class="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:shadow-md transition-shadow bg-white cursor-pointer" @click="viewPlaylistDetail(pl)">
                      <AdminCoverThumb
                        :src="getPlaylistCover(pl)"
                        size="lg"
                        icon="server"
                        iconClass="text-slate-400"
                        class="mr-3"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold truncate text-slate-800">{{ pl.name }}</p>
                        <p class="text-xs text-slate-500">{{ pl.song_count || pl.songs?.length || 0 }} bài hát</p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-center text-slate-500 py-4">Trống</p>
                </div>
              </div>

              <!-- AI List -->
              <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button class="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors" @click="showFullList.ai = !showFullList.ai">
                  <div class="flex items-center gap-2 font-bold text-slate-700">
                    <MfIcon name="auto_awesome" size="20" class="text-cyan-500" /> Danh sách Playlist AI ({{ userPlaylists.ai?.length || 0 }})
                  </div>
                  <MfIcon name="chevron_right" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': showFullList.ai }" />
                </button>
                <div v-show="showFullList.ai" class="p-4 border-t border-slate-200">
                  <div v-if="userPlaylists.ai?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div v-for="pl in userPlaylists.ai" :key="pl.id" class="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:shadow-md transition-shadow bg-white cursor-pointer" @click="viewPlaylistDetail(pl)">
                      <AdminCoverThumb
                        :src="getPlaylistCover(pl)"
                        size="lg"
                        icon="auto_awesome"
                        iconClass="text-slate-400"
                        class="mr-3"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold truncate text-slate-800">{{ pl.name }}</p>
                        <p class="text-xs text-slate-500">{{ pl.song_count || pl.songs?.length || 0 }} bài hát</p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-center text-slate-500 py-4">Trống</p>
                </div>
              </div>
            </div>
          </div>
        </div>


        <!-- 4. PREMIUM & GIAO DỊCH -->
        <div v-if="currentTab === 'premium'" class="tab-pane">
          <div class="card mb-4 premium-card" :class="premium.status">
            <h3>Trạng thái Gói Cước</h3>
            <div class="status-big">
              {{ premium.status === 'active' ? 'Đang sử dụng Premium' : (premium.status === 'expired' ? 'Premium Đã Hết Hạn' : 'Gói Miễn Phí') }}
            </div>
            <p v-if="premium.expiresAt" class="expiry-text">
              Hết hạn vào: <strong>{{ new Date(premium.expiresAt).toLocaleDateString('vi-VN') }}</strong>
            </p>
          </div>

          <div class="card">
            <h3>Lịch sử Giao dịch (5 gần nhất)</h3>
            <table v-if="premium.recentTransactions.length" class="data-table">
              <thead>
                <tr>
                  <th>Mã GD</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="trx in premium.recentTransactions" :key="trx.id">
                  <td>#{{ trx.id }}</td>
                  <td class="font-bold">{{ formatCurrency(trx.amount) }}</td>
                  <td>
                    <span class="badge" :class="trx.status === 'success' ? 'active' : 'free'">
                      {{ trx.status }}
                    </span>
                  </td>
                  <td>{{ new Date(trx.created_at).toLocaleString('vi-VN') }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-text">Chưa có giao dịch nào.</div>
          </div>
        </div>

        <!-- 5. GỢI Ý CÁ NHÂN HÓA -->
        <div v-if="currentTab === 'recommendation'" class="tab-pane">
          <div class="card mb-4 bg-purple-50/50 border-purple-100">
            <h3 class="mb-4">Trạng thái Thuật toán Gợi ý</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 bg-white rounded-xl border border-purple-100 shadow-sm flex flex-col justify-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Số lượt nghe ghi nhận</span>
                <span class="text-2xl font-black text-purple-700">{{ recommendation.listenCount }} <span class="text-sm font-normal text-slate-400">/ 10 (ngưỡng tối thiểu)</span></span>
              </div>
              <div class="p-4 bg-white rounded-xl border border-purple-100 shadow-sm flex flex-col justify-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chiến lược hiện tại</span>
                <span class="text-lg font-bold text-purple-700">
                  {{ recommendation.strategy === 'cold_start' ? 'Cold Start' : 'Hybrid (BPR-MF + CB)' }}
                </span>
                <span class="text-xs text-slate-400 mt-1">{{ recommendation.strategy === 'cold_start' ? 'Dành cho người dùng mới' : 'Kết hợp hành vi & nội dung' }}</span>
              </div>
            </div>
            <p class="mt-4 text-sm text-gray-600">
              * Người dùng {{ recommendation.strategy === 'cold_start' ? 'chưa đủ lịch sử nghe, hệ thống đang ưu tiên sở thích đăng ký và bài hát phổ biến.' : 'đã đủ dữ liệu, hệ thống đang kết hợp Collaborative Filtering và Content-based để đưa ra gợi ý.' }}
            </p>
          </div>

          <div class="section-grid mb-4">
            <div class="card">
              <h3>Sở thích khi đăng ký (Cold Start)</h3>
              <div class="mb-4">
                <h4 class="text-sm font-bold text-gray-500 mb-2">THỂ LOẠI</h4>
                <div class="flex flex-wrap gap-2" v-if="recommendation.selectedGenres.length">
                  <span v-for="g in recommendation.selectedGenres" :key="g.id" class="badge-tag">{{ g.name }}</span>
                </div>
                <div v-else class="text-sm text-gray-400">Không có.</div>
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-500 mb-2">NGHỆ SĨ</h4>
                <div class="flex flex-wrap gap-2" v-if="recommendation.selectedArtists.length">
                  <span v-for="a in recommendation.selectedArtists" :key="a.id" class="badge-tag">{{ a.name }}</span>
                </div>
                <div v-else class="text-sm text-gray-400">Không có.</div>
              </div>
            </div>

            <div class="card">
              <h3>Top Thể loại & Nghệ sĩ (Từ lịch sử)</h3>
              <div class="mb-4">
                <h4 class="text-sm font-bold text-gray-500 mb-2">TOP THỂ LOẠI</h4>
                <div class="flex flex-wrap gap-2" v-if="musicTaste.favoriteGenres && musicTaste.favoriteGenres.length">
                  <span v-for="g in musicTaste.favoriteGenres" :key="g.name" class="badge-tag bg-blue-50 text-blue-700 border-blue-200">
                    {{ g.name }} ({{ g.listens }})
                  </span>
                </div>
                <div v-else class="text-sm text-gray-400">Chưa có dữ liệu thể loại.</div>
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-500 mb-2">TOP NGHỆ SĨ</h4>
                <div class="flex flex-wrap gap-2" v-if="musicTaste.topArtists && musicTaste.topArtists.length">
                  <span v-for="a in musicTaste.topArtists" :key="a.id" class="badge-tag bg-blue-50 text-blue-700 border-blue-200">
                    {{ a.name }} ({{ a.listens }})
                  </span>
                </div>
                <div v-else class="text-sm text-gray-400">Chưa có dữ liệu nghệ sĩ.</div>
              </div>
            </div>
          </div>

          <div class="section-grid">
            <div class="card playlist-ai-card">
              <div class="flex justify-between items-center mb-4">
                <h3 style="margin: 0;">Playlist Tự động & AI</h3>
                <span v-if="recommendation.generatedPlaylists.length > 8" class="text-xs text-slate-500 font-semibold">{{ recommendation.generatedPlaylists.length }} playlist</span>
              </div>
              <div class="playlist-ai-scroll custom-scrollbar" v-if="recommendation.generatedPlaylists.length">
                <div class="ai-playlist-list">
                  <div v-for="pl in recommendation.generatedPlaylists" :key="pl.id" class="ai-playlist-row">
                    <div class="info">
                      <span class="title">{{ pl.name }}</span>
                      <span class="badge-tag mt-1" :class="getSystemKeyColor(pl.system_key)">{{ pl.system_key || 'AI / Manual' }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-text p-4 text-center">Chưa có playlist tự động hoặc AI.</div>
            </div>

            <div class="card playlist-ai-card">
              <div class="shrink-0">
                <h3>Bài hát đề xuất cho người dùng</h3>
                <p class="text-sm text-slate-500 mt-1 mb-4">Dựa trên lịch sử nghe, thể loại yêu thích và mô hình recommendation hiện có.</p>
              </div>
              
              <div v-if="recommendedSongsLoading" class="flex justify-center items-center py-8 shrink-0">
                <div class="spinner"></div>
              </div>
              
              <div v-else-if="recommendedSongsError" class="p-4 text-center bg-rose-50 rounded-lg border border-rose-100 text-rose-600 text-sm shrink-0">
                {{ recommendedSongsError }}
              </div>

              <div v-else-if="recommendedSongs.length" class="playlist-ai-scroll custom-scrollbar">
                <div class="flex flex-col gap-2">
                  <div v-for="(song, i) in recommendedSongs" :key="song.song_id || i" class="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                  <span class="text-slate-400 font-medium w-6 text-center text-sm shrink-0">{{ i + 1 }}</span>
                  
                  <img 
                    :src="song.cover_url || '/images/default-cover.svg'" 
                    @error="handleImageError" 
                    class="w-12 h-12 rounded-md object-cover shrink-0 shadow-sm cursor-pointer"
                    @click="goToAdminSong(song)"
                  />
                  
                  <div class="min-w-0 flex-1 flex flex-col justify-center">
                    <p 
                      class="truncate font-semibold text-slate-800 transition-colors w-max max-w-full cursor-pointer hover:text-violet-600"
                      @click="goToAdminSong(song)"
                    >
                      {{ song.title }}
                    </p>

                    <button
                      v-if="song.artist_id"
                      type="button"
                      class="truncate text-sm text-slate-400 hover:text-violet-600 hover:underline transition-colors w-max max-w-full text-left block"
                      @click.stop="goToAdminArtist(song)"
                    >
                      {{ song.artist_name }}
                    </button>
                    <p v-else class="truncate text-sm text-slate-400 w-max max-w-full text-left block">
                      {{ song.artist_name || 'Không rõ nghệ sĩ' }}
                    </p>
                  </div>
                  
                  <div class="flex-shrink-0 flex flex-col items-end gap-1">
                    <span v-if="song.genre" class="badge-tag bg-slate-100 text-slate-600">{{ song.genre }}</span>
                    <span v-if="song.strategy" class="text-[10px] uppercase font-bold tracking-wider text-slate-400" :title="song.reason">{{ song.strategy.replace('_', ' ') }}</span>
                  </div>
                </div>
              </div>
              </div>

              <div v-else class="empty-text text-center p-6 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
                <MfIcon name="auto_awesome" size="32" class="text-slate-300 mb-2 block mx-auto" />
                <h4 class="font-semibold text-slate-700 mb-2">Chưa có bài hát đề xuất</h4>
                <p class="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Người dùng này chưa có đủ dữ liệu nghe nhạc để tạo đề xuất cá nhân hóa.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 6. HOẠT ĐỘNG GẦN ĐÂY -->
        <div v-if="currentTab === 'activity'" class="tab-pane">
           <div class="card">
              <h3>Lịch sử hoạt động (10 sự kiện nghe gần nhất)</h3>
              <div class="activity-timeline" v-if="recentActivity.length">
                <div v-for="act in recentActivity" :key="act.id" class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="act-title">{{ act.title }}</span>
                      <span class="act-time">{{ new Date(act.date).toLocaleString('vi-VN') }}</span>
                    </div>
                    <div class="act-subtitle">{{ act.subtitle }}</div>
                    <div class="act-meta">{{ act.meta }}</div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-text">Chưa có hoạt động nào.</div>
           </div>
        </div>
      </div>
    </transition>
  </div>
</div>

    <!-- Premium Manager Modal (Reused logic) -->
    <div v-if="showPremiumModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Gia hạn Gói Premium</h2>
          <button class="close-btn" @click="showPremiumModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Chọn thời gian gia hạn</label>
            <div class="premium-options">
              <button class="btn-premium-opt" @click="setPremiumExpiry(30)">+30 ngày (1 tháng)</button>
              <button class="btn-premium-opt" @click="setPremiumExpiry(90)">+90 ngày (3 tháng)</button>
              <button class="btn-premium-opt" @click="setPremiumExpiry(365)">+365 ngày (1 năm)</button>
              <button class="btn-premium-opt cancel" @click="setPremiumExpiry(0)">Hủy gói Premium</button>
            </div>
          </div>
          <div class="form-group custom-date">
            <label>Hoặc chọn ngày hết hạn cụ thể</label>
            <input type="date" v-model="customExpiryDate" class="form-input" />
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showPremiumModal = false">Đóng</button>
            <button class="btn-primary" @click="saveCustomPremiumExpiry" :disabled="savingPremium">
              {{ savingPremium ? 'Đang lưu...' : 'Xác nhận thay đổi' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Playlist Detail Modal -->
    <div class="modal-overlay" v-if="drawerPlaylist" @click.self="drawerPlaylist = null">
      <div class="modal-card" style="max-height: 90vh; display: flex; flex-direction: column; width: 700px; max-width: 90vw;">
        <div class="modal-header">
          <h2>Chi tiết Playlist</h2>
          <button class="close-btn" @click="drawerPlaylist = null">&times;</button>
        </div>
        <div class="modal-body custom-scrollbar" style="overflow-y: auto; flex: 1;">
        <div class="flex flex-col md:flex-row gap-6 mb-6">
          <div class="shrink-0 mx-auto md:mx-0">
            <div class="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-lg bg-slate-100">
              <AdminCoverThumb
                :src="getPlaylistCover(drawerPlaylist)"
                size="custom"
                rounded="none"
                class="w-full h-full"
                iconSize="64"
                alt="Cover lớn"
              />
            </div>
          </div>
          <div class="flex-1">
            <h2 class="text-2xl font-bold mb-2 text-slate-800">{{ drawerPlaylist.name }}</h2>
            <p class="text-slate-500 mb-4">{{ drawerPlaylist.description || 'Không có mô tả' }}</p>
            
            <div class="flex flex-col gap-2 text-sm text-slate-700 mb-5">
              <div v-if="drawerPlaylist.system_key"><span class="font-semibold w-24 inline-block">System Key:</span> <span class="system-key-badge bg-slate-100 px-2 py-1 rounded text-xs font-mono">{{ drawerPlaylist.system_key }}</span></div>
              <div><span class="font-semibold w-24 inline-block">Số bài hát:</span> {{ drawerPlaylist.song_count }}</div>
              <div><span class="font-semibold w-24 inline-block">Thời lượng:</span> {{ formatDuration(drawerPlaylist.total_duration) }}</div>
              <div><span class="font-semibold w-24 inline-block">Cập nhật lúc:</span> {{ drawerPlaylist.updated_at ? new Date(drawerPlaylist.updated_at).toLocaleString('vi-VN') : 'N/A' }}</div>
            </div>

            <button v-if="drawerPlaylist.type === 'system' || drawerPlaylist.type === 'ai' || drawerPlaylist.system_key" class="btn-primary inline-flex items-center gap-2 py-2 px-5 rounded-xl text-sm font-semibold w-max" @click="regenerateUserPlaylist(drawerPlaylist)">
              <MfIcon name="sync" size="16" /> Tạo lại Playlist này
            </button>
          </div>
        </div>

        <h4 class="font-bold text-slate-800 mb-3 border-b pb-2">Danh sách bài hát</h4>
        <div v-if="drawerSongsLoading" class="text-center py-4 text-slate-500">
          <div class="spinner inline-block w-6 h-6"></div>
          <div class="mt-2 text-xs">Đang tải...</div>
        </div>
        <ul v-else-if="drawerSongs.length" class="flex flex-col gap-1 mt-2">
          <li v-for="(song, i) in drawerSongs" :key="song.id" class="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 transition">
            <span class="text-slate-400 font-medium w-6 text-center text-sm shrink-0">{{ i + 1 }}</span>
            <div class="flex flex-1 min-w-0 items-center gap-3">
              <img 
                :src="normalizeImageUrl(song.cover_url)" 
                @error="handleImageError" 
                class="w-10 h-10 rounded-md object-cover shrink-0 shadow-sm"
                :class="{'cursor-pointer': (song.song_id || song.id)}"
                @click="(song.song_id || song.id) ? goToAdminSong(song) : null"
              />
              <div class="min-w-0 flex-1 flex flex-col justify-center">
                <p 
                  class="truncate font-semibold text-slate-800 transition-colors w-max max-w-full" 
                  :class="{'cursor-pointer hover:text-violet-600': (song.song_id || song.id)}"
                  @click="(song.song_id || song.id) ? goToAdminSong(song) : null"
                >
                  {{ song.title }}
                </p>

                <button
                  v-if="song.artist_id"
                  type="button"
                  class="truncate text-sm text-slate-400 hover:text-violet-600 hover:underline transition-colors w-max max-w-full text-left block"
                  @click.stop="goToAdminArtist(song)"
                >
                  {{ song.artist_name || song.artist }}
                </button>
                <p v-else class="truncate text-sm text-slate-400 w-max max-w-full text-left block">
                  {{ song.artist_name || song.artist }}
                </p>
              </div>
            </div>
            <span class="text-xs text-slate-500 w-12 text-right shrink-0">{{ formatDuration(song.duration_sec || song.duration) }}</span>
          </li>
        </ul>
        <div v-else class="empty-text p-4 text-center bg-slate-50 rounded-lg border border-slate-100">
          Playlist trống.
        </div>
      </div>
    </div>
    </div>

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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'
import AdminCoverThumb from '@/components/admin/AdminCoverThumb.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { normalizeImageUrl, getPlaylistCover } from '@/utils/imageUrl'
import { Line as LineChart } from 'vue-chartjs'
import AdminGenreDonutChart from '@/components/admin/AdminGenreDonutChart.vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Filler
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Filler
)

const route = useRoute()
const router = useRouter()
const userId = route.params.id
const toast = useToastStore()

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
})

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

const loading = ref(true)
const error = ref(null)
const currentTab = ref('overview')

// Modal states
const showPremiumModal = ref(false)
const savingPremium = ref(false)
const customExpiryDate = ref('')

// Data
const user = ref(null)
const summary = ref({})
const listeningTrends = ref({ byDay: [] })
const musicTaste = ref({ topSongs: [], topArtists: [], recentLikedSongs: [], favoriteGenres: [] })
const userPlaylistsLoading = ref(true)
const userPlaylists = ref({ created: [], system: [], ai: [], summary: {} })
const drawerPlaylist = ref(null)
const drawerSongs = ref([])
const drawerSongsLoading = ref(false)

const expandedTracklist = ref(null) // 'manual', 'system', 'ai'
function toggleTracklist(type) {
  expandedTracklist.value = expandedTracklist.value === type ? null : type
}

const showFullList = ref({
  manual: false,
  system: false,
  ai: false
})

const goToAdminSong = (song) => {
  const songId = song.song_id || song.id
  if (!songId) return
  drawerPlaylist.value = null // Close modal
  router.push(`/admin/songs/${songId}`)
}

const goToAdminArtist = (artist) => {
  const artistId = artist.artist_id || artist.id
  if (!artistId) return
  drawerPlaylist.value = null // Close modal
  router.push(`/admin/artists/${artistId}/detail`)
}

const highlightPlaylists = computed(() => {
  return {
    manual: userPlaylists.value.created?.[0] || null,
    system: userPlaylists.value.system?.[0] || null,
    ai: userPlaylists.value.ai?.[0] || null
  }
})

const totalPlaylistsCount = computed(() => 
  (userPlaylists.value.created?.length || 0) + 
  (userPlaylists.value.system?.length || 0) + 
  (userPlaylists.value.ai?.length || 0)
)

const totalSongsInPlaylists = computed(() => {
  let count = 0
  const all = [...(userPlaylists.value.created||[]), ...(userPlaylists.value.system||[]), ...(userPlaylists.value.ai||[])]
  for (const p of all) count += Number(p.song_count || p.songs?.length || 0)
  return count
})

const lastUpdatedPlaylistDate = computed(() => {
  const all = [...(userPlaylists.value.created||[]), ...(userPlaylists.value.system||[]), ...(userPlaylists.value.ai||[])]
  let latest = 0
  for (const p of all) {
    if (p.updated_at) {
      const ts = new Date(p.updated_at).getTime()
      if (ts > latest) latest = ts
    }
  }
  return latest ? new Date(latest).toLocaleDateString('vi-VN') : 'N/A'
})

const playlists = ref([])
const premium = ref({ status: 'free', recentTransactions: [] })
const recommendation = ref({ listenCount: 0, selectedGenres: [], selectedArtists: [], generatedPlaylists: [] })
const recentActivity = ref([])

const tabs = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'playlists', label: 'Playlist & Yêu thích' },
  { id: 'premium', label: 'Premium & Giao dịch' },
  { id: 'recommendation', label: 'Gợi ý cá nhân hóa' },
  { id: 'activity', label: 'Hoạt động gần đây' }
]

const maxTrendValue = computed(() => {
  if (!listeningTrends.value.byDay || !listeningTrends.value.byDay.length) return 1
  return Math.max(...listeningTrends.value.byDay.map(d => d.listens), 1)
})

const engagementData = ref(null)
const engagementLoading = ref(true)

const heatmapData = ref([])
const heatmapLoading = ref(true)

function getChurnColor(risk) {
  if (risk === 'Cao') return 'text-rose-500'
  if (risk === 'Trung bình') return 'text-amber-500'
  if (risk === 'Thấp') return 'text-emerald-500'
  return 'text-slate-400'
}

function getTrendClass(status) {
  if (status === 'up') return 'text-emerald-600'
  if (status === 'down') return 'text-rose-500'
  return 'text-slate-400'
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Chưa có lượt nghe'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 60) return `${diffMins} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${diffDays} ngày trước`
}

function getHeatmapColor(count) {
  if (!count) return 'bg-slate-100'
  if (count <= 2) return 'bg-emerald-200'
  if (count <= 5) return 'bg-emerald-400'
  if (count <= 10) return 'bg-emerald-600'
  return 'bg-emerald-800'
}

function formatDateTitle(dateStr) {
  const d = new Date(dateStr)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

const heatmapWeeks = computed(() => {
  if (!heatmapData.value || heatmapData.value.length === 0) return []
  
  // Create last 30 days grid
  const today = new Date()
  today.setHours(0,0,0,0)
  
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 29) // 30 days ago (including today)
  
  // Align start date to Sunday (0)
  while (startDate.getDay() !== 0) {
    startDate.setDate(startDate.getDate() - 1)
  }
  
  const dataMap = {}
  heatmapData.value.forEach(d => {
    // API returns local YYYY-MM-DD
    dataMap[d.date] = d
  })
  
  const weeks = []
  let currentWeek = []
  let currDate = new Date(startDate)
  
  while (currDate <= today || currentWeek.length > 0) {
    const y = currDate.getFullYear()
    const m = String(currDate.getMonth() + 1).padStart(2, '0')
    const dStr = String(currDate.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${dStr}`
    
    currentWeek.push(dataMap[key] || { date: key, count: 0, minutes: 0 })
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    
    currDate.setDate(currDate.getDate() + 1)
  }
  
  return weeks
})

async function fetchEngagementSummary() {
  engagementLoading.value = true
  try {
    const res = await api.get(`/admin/users/${userId}/engagement-summary`)
    engagementData.value = res.data.data
  } catch (err) {
    console.error('Lỗi tải engagement summary:', err)
  } finally {
    engagementLoading.value = false
  }
}

async function fetchListeningHeatmap() {
  heatmapLoading.value = true
  try {
    const res = await api.get(`/admin/users/${userId}/listening-heatmap?months=1`)
    heatmapData.value = res.data.data
  } catch (err) {
    console.error('Lỗi tải heatmap:', err)
  } finally {
    heatmapLoading.value = false
  }
}

const trendChartData = computed(() => {
  return {
    labels: listeningTrends.value.byDay.map(d => `${d.date.substring(8, 10)}/${d.date.substring(5, 7)}`),
    datasets: [
      {
        label: 'Lượt nghe',
        data: listeningTrends.value.byDay.map(d => d.listens),
        borderColor: '#a29bfe',
        backgroundColor: 'rgba(162, 155, 254, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#a29bfe'
      }
    ]
  }
})

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => ` ${context.raw} lượt nghe`
      }
    }
  },
  scales: {
    y: { 
      beginAtZero: true, 
      grid: { display: false, drawBorder: false },
      ticks: { precision: 0 }
    },
    x: { 
      grid: { display: false, drawBorder: false } 
    }
  }
}

const genreChartData = computed(() => {
  const genres = musicTaste.value.favoriteGenres || []
  return {
    labels: genres.map(g => g.name),
    datasets: [{
      data: genres.map(g => g.listens),
      backgroundColor: ['#fd79a8', '#74b9ff', '#00b894', '#a29bfe', '#ffeaa7'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  }
})

const genreChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: { size: 11, family: "'Be Vietnam Pro', sans-serif" }
      }
    },
    tooltip: {
      callbacks: {
        label: (context) => ` ${context.raw} lượt nghe`
      }
    }
  },
  cutout: '70%'
}

function handleImageError(e) {
  e.target.src = '/images/default-cover.svg'
}

function exportReport() {
  toast.showToast('Chức năng xuất báo cáo đang được hoàn thiện', 'info')
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0)
}

async function fetchUserDetail() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get(`/admin/users/${userId}/detail?range=30d`)
    const d = res.data.data
    user.value = d.user
    summary.value = d.summary
    listeningTrends.value = d.listeningTrends
    musicTaste.value = d.musicTaste
    playlists.value = d.playlists
    premium.value = d.premium
    recommendation.value = d.recommendation
    recentActivity.value = d.recentActivity

    // Lấy thêm dữ liệu mới song song
    await Promise.all([
      fetchEngagementSummary(),
      fetchListeningHeatmap()
    ])
  } catch (err) {
    console.error('Lỗi khi tải chi tiết user:', err)
    error.value = err.response?.data?.message || 'Không thể lấy dữ liệu chi tiết người dùng.'
  } finally {
    loading.value = false
  }
}

const userPlaylistsError = ref('')

// Playlists API
async function fetchUserPlaylists() {
  userPlaylistsLoading.value = true
  userPlaylistsError.value = ''
  try {
    const res = await api.get(`/admin/users/${userId}/playlists`)
    userPlaylists.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải playlist user:', err)
    userPlaylistsError.value = err.response?.data?.message || err.message || 'Lỗi chưa xác định'
  } finally {
    userPlaylistsLoading.value = false
  }
}

// Recommendation API
const recommendedSongs = ref([])
const recommendedSongsLoading = ref(false)
const recommendedSongsError = ref('')

async function fetchRecommendedSongs() {
  if (recommendedSongs.value.length > 0) return // Already loaded
  recommendedSongsLoading.value = true
  recommendedSongsError.value = ''
  try {
    const res = await api.get(`/admin/users/${userId}/recommendations?limit=20`)
    recommendedSongs.value = res.data.data.items || []
  } catch (err) {
    console.error('Lỗi khi tải bài hát đề xuất:', err)
    recommendedSongsError.value = err.response?.data?.message || 'Không thể tải danh sách đề xuất. Vui lòng thử lại.'
  } finally {
    recommendedSongsLoading.value = false
  }
}

watch(currentTab, (newTab) => {
  if (newTab === 'recommendation') {
    fetchRecommendedSongs()
  }
})

function formatDuration(seconds) {
  if (!seconds) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getSystemKeyColor(key) {
  if (!key) return 'bg-purple-100 text-purple-700 border border-purple-200'
  const k = key.toLowerCase()
  if (k.includes('mix')) return 'bg-blue-100 text-blue-700 border border-blue-200'
  if (k.includes('vibes') || k.includes('morning') || k.includes('afternoon') || k.includes('night')) return 'bg-amber-100 text-amber-700 border border-amber-200'
  if (k.includes('top') || k.includes('trending')) return 'bg-rose-100 text-rose-700 border border-rose-200'
  if (k.includes('ai') || k.includes('smart')) return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

async function viewPlaylistDetail(pl) {
  drawerPlaylist.value = pl
  drawerSongs.value = []
  drawerSongsLoading.value = true
  try {
    const isSystem = pl.type === 'system' || pl.system_key;
    const url = isSystem ? `/admin/system-playlists/${pl.id}` : `/playlists/${pl.id}`;
    const res = await api.get(url)
    drawerSongs.value = res.data.data?.songs || []
  } catch (err) {
    console.error('Lỗi lấy detail playlist', err)
  } finally {
    drawerSongsLoading.value = false
  }
}

function regenerateUserPlaylist(pl) {
  openConfirm({
    title: 'Tạo lại Playlist?',
    message: `Bạn có chắc muốn tạo lại playlist "${pl.name}"?`,
    confirmText: 'Tạo lại',
    type: 'default',
    action: async () => {
      try {
        await api.post(`/admin/system-playlists/${pl.id}/regenerate`)
        toast.showToast('Đã tạo lại playlist thành công!', 'success')
        fetchUserPlaylists()
        if (drawerPlaylist.value && drawerPlaylist.value.id === pl.id) {
          viewPlaylistDetail(pl)
        }
      } catch (err) {
        toast.showToast(err.response?.data?.message || 'Lỗi khi tạo lại playlist', 'error')
      }
    }
  })
}

// Quick Actions
function toggleRole() {
  const newRole = user.value.role === 'admin' ? 'user' : 'admin'
  const isDemote = user.value.role === 'admin'
  openConfirm({
    title: isDemote ? 'Hạ quyền Admin?' : 'Thăng cấp Admin?',
    message: isDemote 
      ? `Bạn có chắc muốn hạ quyền quản trị của "${user.value.display_name}"?` 
      : `Người dùng "${user.value.display_name}" sẽ có quyền truy cập khu vực quản trị.`,
    confirmText: isDemote ? 'Hạ quyền' : 'Thăng cấp',
    type: 'warning',
    action: async () => {
      try {
        await api.put(`/admin/users/${userId}/role`, { role: newRole })
        await fetchUserDetail() // refresh
        toast.showToast(`Đã ${isDemote ? 'hạ' : 'thăng'} quyền thành công`, 'success')
      } catch (err) {
        toast.showToast('Không thể thay đổi quyền người dùng', 'error')
      }
    }
  })
}

function toggleStatus() {
  const newStatus = user.value.status === 'locked' ? 'active' : 'locked'
  const isLocked = user.value.status === 'locked'
  
  openConfirm({
    title: isLocked ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?',
    message: isLocked
      ? `Mở khóa tài khoản cho "${user.value.display_name}"?`
      : `Người dùng "${user.value.display_name}" sẽ không thể đăng nhập cho đến khi được mở khóa.`,
    confirmText: isLocked ? 'Mở khóa' : 'Khóa tài khoản',
    type: isLocked ? 'default' : 'warning',
    action: async () => {
      try {
        await api.put(`/admin/users/${userId}/status`, { status: newStatus })
        await fetchUserDetail()
        toast.showToast(isLocked ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', 'success')
      } catch (err) {
        toast.showToast('Không thể cập nhật trạng thái người dùng', 'error')
      }
    }
  })
}

function openPremiumModal() {
  customExpiryDate.value = user.value.premium_expires_at 
    ? new Date(user.value.premium_expires_at).toISOString().split('T')[0]
    : ''
  showPremiumModal.value = true
}

async function setPremiumExpiry(days) {
  savingPremium.value = true
  try {
    let expiry = null
    if (days > 0) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      expiry = d.toISOString()
    }
    await api.put(`/admin/users/${userId}/premium`, { premium_expires_at: expiry })
    showPremiumModal.value = false
    await fetchUserDetail()
    toast.showToast('Cập nhật Premium thành công', 'success')
  } catch (err) {
    toast.showToast('Thao tác thất bại', 'error')
  } finally {
    savingPremium.value = false
  }
}

async function saveCustomPremiumExpiry() {
  savingPremium.value = true
  try {
    const expiry = customExpiryDate.value ? new Date(customExpiryDate.value).toISOString() : null
    await api.put(`/admin/users/${userId}/premium`, { premium_expires_at: expiry })
    showPremiumModal.value = false
    await fetchUserDetail()
    toast.showToast('Cập nhật Premium thành công', 'success')
  } catch (err) {
    toast.showToast('Thao tác thất bại', 'error')
  } finally {
    savingPremium.value = false
  }
}

onMounted(() => {
  fetchUserDetail()
  fetchUserPlaylists()
})
</script>

<style scoped>
.admin-user-detail {
  padding: 8px 16px;
  font-family: 'Be Vietnam Pro', sans-serif;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide Up Transition for Tabs */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Header */
.detail-header {
  background: white;
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  border: 1px solid #f0f2f5;
  animation: fadeIn 0.5s ease-out;
}
.header-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #636e72;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 20px;
  transition: color 0.2s;
}
.header-back:hover {
  color: #2d3436;
}
.header-back svg {
  width: 16px; height: 16px;
}
.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.user-profile {
  display: flex;
  align-items: center;
  gap: 20px;
}
.avatar, .avatar-placeholder {
  width: 80px; height: 80px;
  border-radius: 50%;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  object-fit: cover;
}
.avatar-placeholder {
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 32px;
  font-weight: 800;
}
.user-info {
  display: flex; flex-direction: column; gap: 6px;
}
.user-name {
  margin: 0; font-size: 24px; font-weight: 800; color: #2d3436;
}
.user-email {
  margin: 0; font-size: 14px; color: #636e72;
}
.badges {
  display: flex; gap: 8px; margin-top: 4px;
}
.badge {
  padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;
}
.badge.role.admin { background: rgba(253, 121, 168, 0.12); color: #e84393; }
.badge.role.user { background: rgba(116, 185, 255, 0.12); color: #0984e3; }
.badge.status.active { background: rgba(85, 239, 196, 0.12); color: #00b894; }
.badge.status.locked { background: rgba(255, 118, 117, 0.12); color: #d63031; }
.badge.premium.active { background: rgba(253, 121, 168, 0.12); color: #e84393; border: 1px solid rgba(253,121,168,0.2); }
.badge.premium.free { background: #f1f2f6; color: #636e72; }

/* Quick Actions */
.quick-actions {
  display: flex; gap: 10px;
}
.btn-action {
  background: #f1f2f6; border: 1px solid #dfe6e9; padding: 10px 16px; border-radius: 12px;
  font-size: 13px; font-weight: 700; cursor: pointer; color: #2d3436; transition: all 0.2s;
}
.btn-action:hover { background: #dfe6e9; transform: translateY(-2px); }
.btn-action.unlock { background: rgba(85, 239, 196, 0.1); color: #00b894; border-color: rgba(85, 239, 196, 0.3); }
.btn-action.unlock:hover { background: rgba(85, 239, 196, 0.2); }
.btn-action.premium { background: rgba(253, 121, 168, 0.1); color: #e84393; border-color: rgba(253, 121, 168, 0.3); }
.btn-action.premium:hover { background: rgba(253, 121, 168, 0.2); }

.detail-content {
  animation: fadeIn 0.5s ease-out 0.1s both;
}



/* Tabs Navigation */
.tabs-nav {
  display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 2px solid #f0f2f5; padding-bottom: 12px; overflow-x: auto;
}
.tab-btn {
  background: transparent; border: none; padding: 10px 16px; border-radius: 12px;
  font-size: 14px; font-weight: 700; color: #636e72; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.tab-btn:hover { background: #f8f9fa; color: #2d3436; }
.tab-btn.active { background: rgba(162, 155, 254, 0.1); color: #6c5ce7; }

/* Tab Content */
.tab-content {
  min-height: 400px;
}
.chart-grid {
  display: grid; grid-template-columns: 2fr 1fr; gap: 24px;
}
@media (max-width: 768px) {
  .chart-grid { grid-template-columns: 1fr; }
}
.section-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
}
.card {
  background: white; border-radius: 20px; padding: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); border: 1px solid #f0f2f5;
}
.card h3 { margin: 0 0 20px 0; font-size: 16px; font-weight: 800; color: #2d3436; }

/* Simple List */
.simple-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.simple-list li { display: flex; align-items: center; gap: 16px; padding: 8px 0; border-bottom: 1px solid #f8f9fa; }
.simple-list li:last-child { border-bottom: none; }
.rank { font-weight: 800; color: #b2bec3; width: 24px; }
.emoji { font-size: 20px; }
.tiny-cover { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
.info { flex: 1; display: flex; flex-direction: column; }
.info .title { font-weight: 700; color: #2d3436; font-size: 14px; }
.info .subtitle { font-size: 12px; color: #b2bec3; }
.stat { font-weight: 700; font-size: 13px; color: #636e72; }

/* Grid List (Playlists) */
.grid-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; }
.grid-item { display: flex; flex-direction: column; gap: 8px; }
.item-img { width: 100%; aspect-ratio: 1; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.item-info { display: flex; flex-direction: column; }
.item-info .title { font-size: 13px; font-weight: 700; color: #2d3436; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-info .subtitle { font-size: 11px; color: #b2bec3; }

/* Data Table */
.data-table { width: 100%; border-collapse: collapse; text-align: left; }
.data-table th { padding: 12px; color: #b2bec3; font-size: 12px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #f0f2f5; }
.data-table td { padding: 16px 12px; border-bottom: 1px solid #f8f9fa; font-size: 14px; color: #2d3436; }

/* Empty Text */
.empty-text { color: #b2bec3; font-size: 14px; font-style: italic; }

/* State Containers */
.state-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; text-align: center; color: #636e72; }
.icon-error { width: 64px; height: 64px; color: #ff7675; margin-bottom: 16px; }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(162, 155, 254, 0.1); border-top-color: #a29bfe; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Simple Bar Chart */
.bar-chart-container { height: 250px; display: flex; align-items: flex-end; padding-top: 20px; overflow-x: auto; }
.bars { display: flex; gap: 8px; height: 100%; align-items: flex-end; min-width: max-content; padding-bottom: 24px; position: relative; }
.bar-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 24px; position: relative; }
.bar { width: 16px; background: linear-gradient(to top, #74b9ff, #a29bfe); border-radius: 4px 4px 0 0; transition: height 0.5s ease; min-height: 4px; }
.bar-wrapper:hover .bar { filter: brightness(1.1); }
.bar-label { position: absolute; bottom: -24px; font-size: 10px; color: #b2bec3; transform: rotate(-45deg); transform-origin: top left; }

/* Timeline */
.activity-timeline { display: flex; flex-direction: column; position: relative; padding-left: 20px; }
.activity-timeline::before { content: ''; position: absolute; left: 6px; top: 0; bottom: 0; width: 2px; background: #f0f2f5; }
.timeline-item { position: relative; padding-bottom: 24px; }
.timeline-item:last-child { padding-bottom: 0; }
.timeline-dot { position: absolute; left: -20px; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: white; border: 3px solid #a29bfe; box-shadow: 0 0 0 4px white; }
.timeline-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
.act-title { font-weight: 700; color: #2d3436; font-size: 14px; }
.act-time { font-size: 12px; color: #b2bec3; }
.act-subtitle { font-size: 13px; color: #636e72; margin-bottom: 4px; }
.act-meta { display: inline-block; background: #f8f9fa; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #a29bfe; }

/* Premium special classes */
.premium-card { text-align: center; padding: 40px 20px; }
.premium-card.active { background: linear-gradient(135deg, rgba(253, 121, 168, 0.1), rgba(162, 155, 254, 0.1)); border-color: rgba(253, 121, 168, 0.2); }
.status-big { font-size: 28px; font-weight: 900; color: #e84393; margin-bottom: 8px; }
.premium-card.free .status-big { color: #636e72; }
.badge-tag { background: #f1f2f6; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #2d3436; }

/* Utils */
.mb-4 { margin-bottom: 24px; }
.mt-4 { margin-top: 16px; }
.flex { display: flex; }
.gap-8 { gap: 32px; }
.gap-2 { gap: 8px; }
.flex-wrap { flex-wrap: wrap; }
.text-center { text-align: center; }
.p-6 { padding: 24px; }

/* Modal (reused) */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease-out; }
.modal-card { background: white; border-radius: 20px; width: 100%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; }
.modal-header { padding: 24px; border-bottom: 1px solid #f0f2f5; display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { font-size: 18px; font-weight: 800; color: #2d3436; margin: 0; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #b2bec3; line-height: 1; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.form-group { display: flex; flex-direction: column; gap: 10px; }
.form-group label { font-size: 12px; font-weight: 800; color: #a29bfe; text-transform: uppercase; }
.premium-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.btn-premium-opt { background: white; border: 2px solid #e4e6eb; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; color: #2d3436; transition: all 0.2s; }
.btn-premium-opt:hover { border-color: #fd79a8; color: #e84393; background: rgba(253, 121, 168, 0.04); }
.btn-premium-opt.cancel { grid-column: span 2; border-color: #ff7675; color: #d63031; }
.custom-date { border-top: 1px dashed #f0f2f5; padding-top: 16px; }
.form-input { padding: 12px 16px; border-radius: 12px; border: 1px solid #dfe6e9; font-size: 14px; font-weight: 600; outline: none; width: 100%; box-sizing: border-box;}
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
.btn-primary { background: linear-gradient(135deg, #fd79a8, #fd79a8); color: white; padding: 12px 20px; border-radius: 14px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 8px 15px rgba(253, 121, 168, 0.3); }
.btn-secondary { background: #f1f2f6; color: #2d3436; border: 1px solid #dfe6e9; padding: 12px 20px; border-radius: 14px; font-weight: 700; cursor: pointer; }

/* Playlist List Details */
.playlist-list { display: flex; flex-direction: column; gap: 12px; max-height: 260px; overflow-y: auto; padding-right: 4px; }
.playlist-item { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; transition: background 0.2s; }
.playlist-item:hover { background: #f8fafc; }
.pl-img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background: #f1f5f9; flex-shrink: 0; }
.pl-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.pl-info .title { font-weight: 700; color: #0f172a; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-info .subtitle { font-size: 12px; color: #64748b; }
.pl-action { flex-shrink: 0; }
.badge-tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }

/* Drawer Layout */
.drawer-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.4); z-index: 40; }
.drawer-content { position: fixed; top: 0; right: -400px; width: 400px; max-width: 100%; height: 100vh; background: white; z-index: 50; transition: right 0.3s; display: flex; flex-direction: column; box-shadow: -4px 0 15px rgba(0,0,0,0.05); }
.drawer-content.open { right: 0; }
.drawer-header { padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.drawer-body { padding: 24px; flex: 1; overflow-y: auto; }
.drawer-cover { width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
.drawer-cover img { width: 100%; height: 100%; object-fit: cover; }
.btn-action.primary.w-full { display: flex; width: 100%; padding: 12px; color: white; background: #7c3aed; border: none; border-radius: 8px; font-weight: 600; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.btn-action.primary.w-full:hover { background: #6d28d9; }

/* AI Playlist Card Scrollable */
.playlist-ai-card {
  display: flex;
  flex-direction: column;
  max-height: 420px;
}
@media (max-width: 768px) {
  .playlist-ai-card { max-height: 360px; }
}
.playlist-ai-scroll {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}
/* Custom Scrollbar for light theme */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.ai-playlist-list {
  display: flex;
  flex-direction: column;
}
.ai-playlist-row {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}
.ai-playlist-row:last-child { border-bottom: none; }
.ai-playlist-row .info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.ai-playlist-row .title { font-weight: 600; color: #1e293b; font-size: 14px; }
.ai-playlist-row .subtitle { font-size: 12px; color: #94a3b8; font-family: monospace; }
.ai-playlist-row .badge-tag { background: #f1f5f9; color: #64748b; font-size: 10px; padding: 2px 6px; border-radius: 4px; align-self: flex-start; }
</style>
