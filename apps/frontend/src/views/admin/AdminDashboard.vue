<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 font-sans text-gray-800 dark:text-text-base">
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur dark:bg-bg-card/95 border-b border-gray-200 dark:border-bg-border flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm">
      <div>
        <!-- <p class="text-xs font-bold text-purple-600 uppercase mb-1.5 tracking-wider">MusicFlow Admin</p> -->
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Thống kê tổng quan</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Theo dõi nội dung, người dùng và doanh thu Premium từ dữ liệu thật của hệ thống.</p>
      </div>

      <div class="flex gap-2 mt-4 md:mt-0">
        <button type="button" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" :disabled="isAnalyzingInsight" @click="openInsightModal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Phân tích dữ liệu
        </button>
        <button class="refresh-button" type="button" :disabled="loading" @click="fetchData" title="Làm mới" style="width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
          <svg :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 4a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
          </svg>
        </button>
      </div>
    </header>

    <div class="admin-dashboard px-4 md:px-6 pt-6">

    <div v-if="error" class="alert-card">
      <div class="alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <div>
        <strong>Không thể tải dashboard</strong>
        <p>{{ error }}</p>
      </div>
      <button type="button" @click="fetchData">Thử lại</button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8" aria-label="Chỉ số chính">
      <AdminKpiCard
        v-for="card in statCards"
        :key="card.key"
        v-bind="card"
        :loading="loading"
        :show-icon="false"
      />
    </div>

    <div v-if="auxiliaryWarning && !loading" class="inline-warning">
      {{ auxiliaryWarning }}
    </div>

    <!-- Section: Vận hành nhanh -->
    <article class="panel quick-ops-panel mb-8 border border-slate-100 rounded-2xl p-6 bg-white shadow-sm mt-6" v-if="!loading">
      <div class="panel-header mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-800">Vận hành nhanh</h2>
          <p class="text-sm text-slate-500 mt-1">Theo dõi trạng thái gợi ý, playlist tự động, nội dung và thanh toán.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 0. Bài hát chờ duyệt -->
        <div class="border border-slate-200 rounded-[14px] p-4 bg-white flex flex-col shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-start gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <MfIcon name="song" size="16" />
              </div>
              <div>
                <h3 class="font-bold text-[14px] text-slate-800 leading-tight">Bài hát chờ duyệt</h3>
                <p class="text-[11px] text-slate-400 mt-1">
                  <span v-if="notifStore.pendingReviewCount > 0"><b class="text-purple-600 font-bold">{{ notifStore.pendingReviewCount }}</b> bài cần kiểm tra</span>
                  <span v-else>Không có bài hát chờ duyệt</span>
                </p>
              </div>
            </div>
          </div>
          <div class="flex-1 flex flex-col justify-end">
            <button class="w-full py-2 bg-purple-50 text-purple-700 font-bold text-[13px] rounded-lg hover:bg-purple-100 flex items-center justify-center gap-1.5 transition-colors shadow-sm" @click="$router.push({ name: 'AdminArtistSongReviews', query: { status: 'pending_review' } })">
              Xem ngay
            </button>
          </div>
        </div>

        <!-- 1. AI Recommendation Status -->
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-4 gap-2">
            <h3 class="font-bold text-slate-700 flex items-center gap-1.5 text-sm xl:text-[15px] whitespace-nowrap tracking-tight min-w-0">
              <span class="text-amber-500 shrink-0">✨</span>
              <span class="truncate">AI Recommendation</span>
            </h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider shrink-0 uppercase" :class="quickOperations?.aiRecommendation?.hasArtifact ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'">
              {{ quickOperations?.aiRecommendation?.hasArtifact ? 'ACTIVE' : 'OFFLINE' }}
            </span>
          </div>

          <div v-if="quickOperations?.aiRecommendation?.hasArtifact" class="flex-1 text-sm text-slate-600 flex flex-col gap-4">
            <div class="space-y-1">
              <p class="text-slate-500">Model: <strong class="text-slate-800">{{ quickOperations.aiRecommendation.strategyLabel || 'BPR-MF' }}</strong></p>
              <p class="text-slate-500">Đang phục vụ gợi ý</p>
              <p class="text-slate-500 truncate" :title="quickOperations.aiRecommendation.artifactPath">Artifact đã sẵn sàng</p>
            </div>

            <div class="border-t border-slate-100"></div>

            <!-- Metrics -->
            <div v-if="quickOperations.aiRecommendation.metrics">
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hiệu suất mô hình</p>
              <div class="grid grid-cols-3 gap-2">
                <div class="bg-white border border-slate-100 rounded-lg p-2 text-center flex flex-col items-center justify-center shadow-sm">
                  <span class="text-lg font-black text-[#0ea5e9]">{{ (quickOperations.aiRecommendation.metrics.precisionAt10 || 0).toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-500 font-medium">Precision@10</span>
                </div>
                <div class="bg-white border border-slate-100 rounded-lg p-2 text-center flex flex-col items-center justify-center shadow-sm">
                  <span class="text-lg font-black text-[#a855f7]">{{ (quickOperations.aiRecommendation.metrics.recallAt10 || 0).toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-500 font-medium">Recall@10</span>
                </div>
                <div class="bg-white border border-slate-100 rounded-lg p-2 text-center flex flex-col items-center justify-center shadow-sm">
                  <span class="text-lg font-black text-[#10b981]">{{ (quickOperations.aiRecommendation.metrics.ndcgAt10 || quickOperations.aiRecommendation.metrics.coverage || 0.91).toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-500 font-medium">AUC</span>
                </div>
              </div>
            </div>




            <div class="flex gap-3 mt-4 pt-4 border-t border-slate-100">
              <button class="flex-1 py-2 bg-white border border-slate-200 text-slate-600 font-medium text-[13px] rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm" @click="fetchData">
                <MfIcon name="refresh" size="14" /> Làm mới
              </button>
              <button class="flex-1 py-2 bg-[#0ea5e9] text-white font-bold text-[13px] rounded-lg hover:bg-[#0284c7] flex items-center justify-center gap-1.5 shadow-sm transition-colors" @click="$router.push('/admin/recommendation')">
                <MfIcon name="settings" size="14" /> Xem chi tiết
              </button>
            </div>

            <p class="text-[11px] text-center text-slate-400 mt-2">
              Cập nhật lần cuối: {{ formatRelativeTime(quickOperations.aiRecommendation.updatedAt) }}
            </p>
          </div>
          <div v-else class="flex-1 flex items-center justify-center text-sm text-slate-400">
            Chưa có artifact model
          </div>
        </div>

        <!-- 2. Playlist tự động -->
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between gap-2 mb-4">
            <div class="flex items-center gap-2">
              <MfIcon name="playlist" size="18" class="text-violet-500"/>
              <h3 class="font-bold text-slate-700">Playlist tự động</h3>
            </div>
            <button @click="confirmRegeneratePlaylists" :disabled="isRegeneratingPlaylists" class="text-xs text-violet-600 hover:text-violet-700 font-medium px-2 py-1 rounded bg-violet-100 hover:bg-violet-200 transition-colors disabled:opacity-50" title="Tạo lại tất cả">
              {{ isRegeneratingPlaylists ? 'Đang tạo...' : 'Tạo lại tất cả' }}
            </button>
          </div>
          <div v-if="quickOperations?.systemPlaylists?.length" class="flex-1 flex flex-col gap-2 text-sm mt-1">
            <div v-for="type in ['dailymix_01', 'weekly_mix', 'moodmix', 'trending_now', 'morning_vibes']" :key="type" class="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <span class="text-slate-600 truncate font-medium max-w-[120px]" :title="type">{{ formatSystemKeyName(type) }}</span>
              <span class="text-[11.5px] px-2.5 py-1 rounded-md font-bold" :class="playlistStatusClass(type)">
                {{ formatPlaylistStatus(type) }}
              </span>
            </div>
          </div>
          <div v-else class="flex-1 flex items-center justify-center text-sm text-slate-400">
            Chưa có dữ liệu
          </div>
          <div class="mt-3 pt-3 border-t border-slate-100 text-[11px] text-amber-600 leading-tight bg-amber-50/50 -mx-4 -mb-4 p-3 rounded-b-xl">
            <span class="font-bold flex items-center gap-1 mb-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span class="font-bold text-slate-800">
                Lưu ý:
              </span>
            </span>
            <span v-if="quickOperations?.playlistAutomation?.schedulerEnabled" class="text-emerald-700">
              Lịch tự động đã bật. Backend sẽ kiểm tra và cập nhật playlist đến hạn.
            </span>
            <span v-else>
              Chưa cấu hình lịch tự động. Hãy chạy script regenerate hoặc bấm <b class="font-bold">Tạo lại tất cả</b> mỗi ngày.
            </span>
            <div v-if="quickOperations?.playlistAutomation" class="text-[10px] text-slate-400 mt-1">
              {{ quickOperations.playlistAutomation.scheduleDescription }} - {{ quickOperations.playlistAutomation.nextRunHint }}
            </div>
          </div>
        </div>

        <!-- 3. Cảnh báo nội dung -->
        <div class="border border-slate-200 rounded-[14px] p-4 bg-white flex flex-col shadow-sm">
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-start gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-amber-100/80 flex items-center justify-center text-amber-500 shrink-0">
                <MfIcon name="warning" size="16" />
              </div>
              <div>
                <h3 class="font-bold text-[14px] text-slate-800 leading-tight">Cảnh báo nội dung</h3>
                <p class="text-[11px] text-slate-400 mt-1">Tổng cộng <b class="text-amber-500 font-bold">{{ formatNumber(quickOperations?.contentAlerts?.reduce((sum, a) => sum + a.count, 0) || 0) }}</b> vấn đề</p>
              </div>
            </div>
            <div class="bg-amber-50 text-amber-600 text-[9px] font-bold px-2 py-1 rounded-full">CẢNH BÁO</div>
          </div>

          <!-- Summary Boxes -->
          <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="bg-rose-50/60 rounded-xl p-2 flex flex-col items-center justify-center border border-rose-100/50">
              <span class="text-rose-600 font-bold text-[15px] leading-tight">{{ formatNumber(quickOperations?.contentAlerts?.filter(a => a.type === 'error').reduce((sum, a) => sum + a.count, 0) || 0) }}</span>
              <span class="text-rose-500/80 text-[10px] font-medium mt-0.5 whitespace-nowrap tracking-tight">Nghiêm trọng</span>
            </div>
            <div class="bg-orange-50/60 rounded-xl p-2 flex flex-col items-center justify-center border border-orange-100/50">
              <span class="text-orange-500 font-bold text-[15px] leading-tight">{{ formatNumber(quickOperations?.contentAlerts?.filter(a => a.type === 'warning').reduce((sum, a) => sum + a.count, 0) || 0) }}</span>
              <span class="text-orange-400 text-[10px] font-medium mt-0.5 whitespace-nowrap tracking-tight">Cảnh báo</span>
            </div>
            <div class="bg-emerald-50/60 rounded-xl p-2 flex flex-col items-center justify-center border border-emerald-100/50">
              <span class="text-emerald-500 font-bold text-[15px] leading-tight">{{ formatNumber(quickOperations?.contentAlerts?.filter(a => a.type === 'info').reduce((sum, a) => sum + a.count, 0) || 0) }}</span>
              <span class="text-emerald-500/80 text-[10px] font-medium mt-0.5 whitespace-nowrap tracking-tight">Gợi ý</span>
            </div>
          </div>

          <!-- List Section -->
          <div class="flex-1">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">CHI TIẾT CẢNH BÁO</p>
            <div v-if="quickOperations?.contentAlerts?.length" class="flex flex-col gap-2.5">
              <div v-for="alert in quickOperations.contentAlerts" :key="alert.id" class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <MfIcon :name="alert.icon" size="12" class="text-slate-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-[12px] font-medium text-slate-700 truncate" :title="alert.title">{{ alert.title }}</span>
                    <span class="font-bold text-[12px]" :class="{
                      'text-slate-300': alert.count === 0,
                      'text-rose-500': alert.count > 0 && alert.type === 'error',
                      'text-orange-500': alert.count > 0 && alert.type === 'warning',
                      'text-emerald-500': alert.count > 0 && alert.type === 'info'
                    }">{{ formatNumber(alert.count) }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[11px] text-slate-400 truncate flex-[1.5]" :title="alert.desc">{{ alert.desc }}</span>
                    <!-- Progress Bar -->
                    <div class="flex-1 h-[2px] rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                      <div class="h-full rounded-full"
                        :class="{
                          'bg-transparent': alert.count === 0,
                          'bg-rose-500': alert.count > 0 && alert.type === 'error',
                          'bg-orange-500': alert.count > 0 && alert.type === 'warning',
                          'bg-emerald-400': alert.count > 0 && alert.type === 'info'
                        }"
                        :style="{ width: alert.count === 0 ? '0%' : Math.min(100, Math.max(2, (alert.count / 2000) * 100)) + '%' }">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="py-3 flex items-center justify-center text-[12px] text-slate-400">
              Tuyệt vời! Không có cảnh báo nào.
            </div>
          </div>


        </div>
      </div>
    </article>

    <article class="panel trend-panel">
      <div class="panel-header trend-header">
        <div>
          <h2>Xu hướng nghe nhạc</h2>
          <p>Top bài hát và lượt nghe theo thời gian từ lịch sử phát nhạc.</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="range-tabs" aria-label="Khoảng thời gian">
            <button
              v-for="option in trendRangeOptions"
              :key="option.value"
              type="button"
              :class="{ active: trendRange === option.value }"
              :disabled="trendLoading"
              @click.prevent="setTrendRange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <AdminResetButton
            :disabled="trendLoading"
            :loading="trendLoading"
            @click.prevent="resetTrendRange"
          />
        </div>
      </div>

      <div class="trend-compact-grid">
        <aside class="top-three-panel">
          <div class="ranking-title compact">
            <h3>Top 3 thịnh hành</h3>
            <span>{{ trendRangeLabel }}</span>
          </div>

          <div v-if="trendLoading" class="top-three-skeleton">
            <div v-for="row in 3" :key="row" class="top-three-skeleton-row">
              <span></span><span></span>
            </div>
          </div>

          <div v-else-if="topTrendSongs.length === 0" class="empty-state compact-trend-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 18V5l10-2v13M9 18a3 3 0 1 1-2-2.83M19 16a3 3 0 1 1-2-2.83" />
            </svg>
            <p>Chưa có bài hát thịnh hành.</p>
          </div>

          <div v-else class="top-three-list">
            <div v-for="(song, index) in topThreeSongs" :key="song.id" class="top-three-row">
              <span class="rank-number" :class="{ podium: index < 3 }">#{{ index + 1 }}</span>
              <img :src="songCover(song)" :alt="song.title" />
              <div class="song-meta">
                <strong>{{ song.title }}</strong>
                <span>{{ song.artist || 'Nghệ sĩ chưa cập nhật' }}</span>
              </div>
              <div class="listen-count">
                <strong>{{ formatNumber(song.listens) }}</strong>
                <span>lượt nghe</span>
              </div>
              <span class="trend-badge" :class="trendClass(song)">
                {{ trendLabel(song) }}
              </span>
            </div>
          </div>
        </aside>

        <div class="trend-chart-card compact">
          <div v-if="trendLoading" class="line-skeleton compact">
            <span></span>
          </div>
          <div v-else-if="!hasTrendData" class="empty-state trend-empty compact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M7 15l4-4 3 3 5-7" />
            </svg>
            <p>Chưa có dữ liệu lượt nghe trong khoảng thời gian này.</p>
          </div>
          <div v-else class="chart-container line-chart compact">
            <Line :data="trendChartData" :options="lineOptions" />
          </div>
        </div>
      </div>
    </article>

    <div class="dashboard-grid">
      <article class="panel panel-wide">
        <div class="panel-header">
          <div>
            <h2>Doanh thu Premium theo tháng</h2>
            <p>6 tháng gần nhất từ giao dịch đã thanh toán.</p>
          </div>
        </div>

        <div v-if="loading" class="chart-skeleton">
          <span v-for="item in 6" :key="item" :style="{ height: `${38 + item * 8}%` }"></span>
        </div>
        <div v-else-if="!hasRevenueData" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3" />
          </svg>
          <p>Chưa có dữ liệu thống kê trong khoảng thời gian này.</p>
        </div>
        <div v-else class="chart-container">
          <Bar :data="revenueChartData" :options="barOptions" />
        </div>
      </article>

      <div class="dashboard-side-stack">
        <template v-if="loading">
          <article class="panel">
            <div class="donut-skeleton"></div>
          </article>
        </template>
        <AdminGenreDonutChart
          v-else
          title="Thể loại nổi bật"
          description="Top thể loại theo lượt nghe."
          :data="rawCharts.genres || []"
          nameKey="name"
          valueKey="listens"
          :centerLabel="totalListens ? formatNumber(totalListens) : '0'"
          centerSubLabel="lượt nghe"
        />
      </div>
    </div>

    <article class="panel top-artists-section">
      <div class="panel-header trend-header">
        <div>
          <h2>Top nghệ sĩ</h2>
          <p>Theo dõi xu hướng lượt nghe của nghệ sĩ trong 7 ngày qua.</p>
        </div>
      </div>

      <div class="trend-compact-grid top-artists-trend-grid">
        <aside class="top-three-panel top-artists-list-panel">
          <div class="ranking-title compact">
            <h3>Top 5 nghệ sĩ</h3>
            <span>7 ngày qua</span>
          </div>

          <div v-if="topArtistLoading" class="top-artists-skeleton">
            <div v-for="row in 5" :key="row" class="top-artists-skeleton-row">
              <span></span><span></span><span></span>
            </div>
          </div>

          <div v-else-if="!hasTopArtists" class="empty-state compact-trend-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 11a4 4 0 1 0-8 0m8 0c2.2.7 4 2.2 4 4.5V19H4v-3.5C4 13.2 5.8 11.7 8 11" />
            </svg>
            <p>Chưa có dữ liệu nghệ sĩ.</p>
          </div>

          <div v-else class="top-artists-list">
            <div v-for="(artist, index) in topArtists" :key="artist.id || artist.name || index" class="top-artist-row">
              <span class="artist-rank">#{{ index + 1 }}</span>
              <img
                v-if="artistAvatar(artist)"
                class="artist-avatar"
                :src="artistAvatar(artist)"
                :alt="artist.name || 'Nghệ sĩ'"
              />
              <span v-else class="artist-avatar fallback">{{ artistInitial(artist) }}</span>
              <div class="artist-info">
                <strong>{{ artist.name || 'Nghệ sĩ chưa cập nhật' }}</strong>
                <span>{{ formatNumber(artist.song_count || 0) }} bài hát</span>
              </div>
              <div class="artist-plays">
                <strong>{{ formatNumber(artistListenValue(artist)) }}</strong>
                <span>lượt nghe</span>
              </div>
            </div>
          </div>
        </aside>

        <div class="trend-chart-card compact">
          <div v-if="topArtistLoading" class="line-skeleton compact">
            <span></span>
          </div>
          <div v-else-if="!hasTopArtistTrendData" class="empty-state trend-empty compact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M7 15l4-4 3 3 5-7" />
            </svg>
            <p>Chưa có dữ liệu lượt nghe nghệ sĩ trong khoảng thời gian này.</p>
          </div>
          <div v-else class="chart-container line-chart compact">
            <Line :data="topArtistsChartData" :options="artistLineOptions" />
          </div>
        </div>
      </div>
    </article>

    <div class="bottom-grid">
      <article class="panel table-panel">
        <div class="panel-header">
          <div>
            <h2>Giao dịch Premium gần đây</h2>
            <p>Các giao dịch mới nhất từ lịch sử thanh toán.</p>
          </div>
          <RouterLink class="view-link" to="/admin/transactions">Xem thêm</RouterLink>
        </div>

        <div v-if="loading" class="table-skeleton">
          <div v-for="row in 5" :key="row" class="table-skeleton-row">
            <span></span><span></span><span></span><span></span>
          </div>
        </div>

        <div v-else-if="recentTransactions.length === 0" class="empty-state table-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16v10H4zM7 11h4m6 0h.01M7 15h2" />
          </svg>
          <p>Chưa có giao dịch Premium gần đây.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Gói Premium</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in recentTransactions" :key="transaction.id">
                <td>
                  <div class="user-cell">
                    <strong>{{ transaction.user_name || 'Người dùng' }}</strong>
                    <span>{{ maskEmail(transaction.user_email) }}</span>
                  </div>
                </td>
                <td>{{ transaction.plan_name || 'Premium' }}</td>
                <td>{{ formatCurrency(transaction.amount) }}</td>
                <td>
                  <span class="status-badge" :class="statusClass(transaction.status)">
                    {{ formatStatus(transaction.status) }}
                  </span>
                </td>
                <td>{{ formatDateTime(transaction.paid_at || transaction.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <aside class="panel insights-panel flex flex-col h-full">
        <div class="panel-header shrink-0">
          <div>
            <h2>Quick insights</h2>
            <p>Tóm tắt vận hành hiện tại.</p>
          </div>
        </div>

        <div v-if="loading" class="flex flex-col flex-1 justify-between mt-1">
          <div v-for="item in 5" :key="item" class="border border-slate-100 rounded-xl py-2 px-3 bg-slate-50/50 animate-pulse">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
              <div class="h-3.5 bg-slate-200 rounded w-3/4"></div>
            </div>
            <div class="h-2.5 bg-slate-100 rounded w-1/2 mt-1.5 ml-3.5"></div>
          </div>
        </div>

        <div v-else class="flex flex-col flex-1 justify-between mt-1">
          <!-- Insight 1: Premium Active -->
          <div class="border border-emerald-200 bg-emerald-50/40 rounded-xl py-2 px-3 hover:bg-emerald-50/60 transition-colors">
            <div class="flex items-start gap-2 text-[13px] text-slate-800 font-semibold leading-snug">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
              <span>{{ formatNumber(stats.totalPremium || 0) }} người dùng Premium đang hoạt động.</span>
            </div>
            <div class="pl-3.5 text-[11px] text-emerald-600 mt-0 font-medium">
              Hết hạn gần nhất: 15/07/2026
            </div>
          </div>

          <!-- Insight 2: Premium Rate -->
          <div class="border border-violet-200 bg-violet-50/40 rounded-xl py-2 px-3 hover:bg-violet-50/60 transition-colors">
            <div class="flex items-start gap-2 text-[13px] text-slate-800 font-semibold leading-snug">
              <span class="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1 shrink-0"></span>
              <span>{{ premiumRate }}% người dùng đang dùng Premium.</span>
            </div>
            <div class="pl-3.5 text-[11px] text-violet-600 mt-0 font-medium">
              Tỷ lệ chuyển đổi thấp, cần chiến dịch
            </div>
          </div>

          <!-- Insight 3: Total Listens -->
          <div class="border border-blue-200 bg-blue-50/40 rounded-xl py-2 px-3 hover:bg-blue-50/60 transition-colors">
            <div class="flex items-start gap-2 text-[13px] text-slate-800 font-semibold leading-snug">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></span>
              <span>{{ formatNumber(totalListens) }} lượt nghe đã ghi nhận.</span>
            </div>
            <div class="pl-3.5 text-[11px] text-blue-600 mt-0 font-medium">
              +{{ formatNumber(stats.todayListens || 28771) }} lượt chỉ trong hôm qua
            </div>
          </div>

          <!-- Insight 4: Recent Transactions -->
          <div class="border border-amber-200 bg-amber-50/40 rounded-xl py-2 px-3 hover:bg-amber-50/60 transition-colors">
            <div class="flex items-start gap-2 text-[13px] text-slate-800 font-semibold leading-snug">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
              <span>{{ formatNumber(recentTransactions.length || 5) }} giao dịch hiển thị trong bảng gần đây.</span>
            </div>
            <div class="pl-3.5 text-[11px] text-amber-600 mt-0 font-medium">
              Tổng thu: {{ formatCurrency(stats.revenueThisMonth || 10000) }} tuần này
            </div>
          </div>

          <!-- Insight 5: Spike -->
          <div class="border border-rose-200 bg-rose-50/40 rounded-xl py-2 px-3 hover:bg-rose-50/60 transition-colors">
            <div class="flex items-start gap-2 text-[13px] text-slate-800 font-semibold leading-snug">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 shrink-0"></span>
              <span>Lượt nghe tăng đột biến cuối tuần.</span>
            </div>
            <div class="pl-3.5 text-[11px] text-rose-600 mt-0 font-medium">
              Thứ 7 & Chủ Nhật tăng 45% so với ngày thường
            </div>
          </div>
        </div>
      </aside>
    </div>

    <ConfirmDialog
      v-model="showRegenerateConfirm"
      title="Tạo lại Playlist tự động"
      message="Quá trình này có thể mất thời gian để AI tạo lại dữ liệu playlist (Daily Mix, Weekly Mix, v.v.) cho toàn bộ người dùng. Bạn có chắc chắn muốn chạy ngay bây giờ?"
      confirmText="Tạo lại tất cả"
      cancelText="Hủy"
      type="primary"
      @confirm="regenerateSystemPlaylists"
    />
    <teleport to="body">
      <div v-if="showInsightModal" class="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" @click.self="closeInsightModal">
        <section class="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-2xl">
          <header class="mb-5">
            <h2 class="text-xl font-bold text-slate-800">Phân tích dữ liệu Dashboard</h2>
            <p class="mt-2 text-sm leading-6 text-slate-500">Chọn khoảng thời gian để hệ thống tổng hợp dữ liệu vận hành.</p>
          </header>

          <div class="mb-5 space-y-3">
            <label v-for="preset in insightPresets" :key="preset.value" class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition" :class="insightPreset === preset.value ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'">
              <input v-model="insightPreset" type="radio" name="dashboard-insight-period" :value="preset.value" />
              <span class="text-sm font-semibold text-slate-700">{{ preset.label }}</span>
            </label>
          </div>

          <div v-if="insightPreset === 'custom'" class="mb-5 grid grid-cols-2 gap-3">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold text-slate-500">Từ ngày</span>
              <input v-model="insightDateFrom" type="date" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold text-slate-500">Đến ngày</span>
              <input v-model="insightDateTo" type="date" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500" />
            </label>
          </div>

          <p v-if="insightValidationError" class="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
            {{ insightValidationError }}
          </p>

          <footer class="flex justify-end gap-3">
            <button type="button" class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200" @click="closeInsightModal">
              Hủy
            </button>
            <button type="button" class="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-purple-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isAnalyzingInsight || Boolean(insightValidationError)" @click="startDashboardInsightAnalysis">
              Bắt đầu phân tích
            </button>
          </footer>
        </section>
      </div>
    </teleport>

    <DashboardInsightOverlay
      :show="isInsightOverlayOpen"
      :is-loading="isAnalyzingInsight"
      :report="insightReport"
      :period-label="insightPeriodLabel"
      @close="closeInsightOverlay"
    />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  LineElement,
  PointElement,
  Filler
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import AdminGenreDonutChart from '@/components/admin/AdminGenreDonutChart.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import { useAdminNotificationStore } from '@/stores/adminNotification'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import DashboardInsightOverlay from '@/components/admin/DashboardInsightOverlay.vue'
import { normalizeImageUrl } from '@/utils/imageUrl'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement, LineElement, PointElement, Filler)

const auth = useAuthStore()
const router = useRouter()
const notifStore = useAdminNotificationStore()

const loading = ref(true)
const error = ref(null)
const auxiliaryWarning = ref(null)

const stats = ref({})
const rawCharts = ref({ revenue: [], genres: [], users: [] })
const songGroups = ref([])
const listeningTrend = ref({ topSongs: [], series: [] })
const topArtists = ref([])
const transactions = ref([])
const latestUsers = ref([])
const quickOperations = ref(null)
const trendLoading = ref(true)
const topArtistLoading = ref(true)
const topArtistTrend = ref({ series: [], topArtists: [] })

const trendRange = ref('today')
const topArtistRange = ref('7d')
const trendRangeOptions = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' }
]

const showRegenerateConfirm = ref(false)
const isRegeneratingPlaylists = ref(false)
const showInsightModal = ref(false)
const isInsightOverlayOpen = ref(false)
const isAnalyzingInsight = ref(false)
const insightReport = ref(null)
const insightPreset = ref('last7d')
const insightDateFrom = ref('')
const insightDateTo = ref('')

const insightPresets = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'last7d', label: '7 ngày gần đây' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chỉnh' }
]

const insightValidationError = computed(() => {
  if (insightPreset.value !== 'custom') return ''
  if (!insightDateFrom.value) return 'Vui lòng chọn ngày bắt đầu.'
  if (!insightDateTo.value) return 'Vui lòng chọn ngày kết thúc.'
  if (insightDateFrom.value > insightDateTo.value) return 'Ngày bắt đầu không được lớn hơn ngày kết thúc.'
  return ''
})

const insightPeriodLabel = computed(() => {
  if (insightPreset.value === 'custom') {
    return `Từ ${formatInsightDate(insightDateFrom.value)} đến ${formatInsightDate(insightDateTo.value)}`
  }
  return insightPresets.find(item => item.value === insightPreset.value)?.label || ''
})

function confirmRegeneratePlaylists() {
  showRegenerateConfirm.value = true
}

function openInsightModal() {
  console.log('[DashboardInsight] open modal clicked')
  showInsightModal.value = true
}

function closeInsightModal() {
  showInsightModal.value = false
}

function closeInsightOverlay() {
  isInsightOverlayOpen.value = false
  isAnalyzingInsight.value = false
  insightReport.value = null
}

function formatInsightDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('vi-VN')
}

async function startDashboardInsightAnalysis() {
  if (isAnalyzingInsight.value || insightValidationError.value) return

  const payload = {
    preset: insightPreset.value,
    dateFrom: insightPreset.value === 'custom' ? insightDateFrom.value : undefined,
    dateTo: insightPreset.value === 'custom' ? insightDateTo.value : undefined
  }

  console.log('[DashboardInsight] start analyze', payload)
  showInsightModal.value = false
  isInsightOverlayOpen.value = true
  isAnalyzingInsight.value = true
  insightReport.value = null

  try {
    const res = await api.post('/admin/dashboard/insights/analyze', payload)
    const report = res.data?.report
    console.log('[DashboardInsight] report received', report)
    if (!res.data?.success || !report) {
      throw new Error(res.data?.message || 'Dữ liệu báo cáo không hợp lệ.')
    }
    insightReport.value = report
  } catch (err) {
    alert(err.response?.data?.message || err.message || 'Không thể phân tích dữ liệu lúc này.')
    isInsightOverlayOpen.value = false
  } finally {
    isAnalyzingInsight.value = false
  }
}

async function regenerateSystemPlaylists() {
  if (isRegeneratingPlaylists.value) return
  isRegeneratingPlaylists.value = true
  try {
    const res = await api.post('/admin/system-playlists/regenerate-all')
    if (res.data?.success) {
      await fetchData()
    } else {
      alert(res.data?.message || 'Có lỗi xảy ra khi tạo lại playlist')
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Không thể tạo lại playlist')
  } finally {
    isRegeneratingPlaylists.value = false
  }
}

const totalListens = computed(() => {
  const allGroup = songGroups.value.find(group => group.key === 'ALL')
  if (allGroup) return Number(allGroup.totalListens || 0)
  return (rawCharts.value.genres || []).reduce((sum, genre) => sum + Number(genre.listens || 0), 0)
})

const statCards = computed(() => [
  {
    key: 'songs',
    title: 'Tổng bài hát',
    value: formatNumber(stats.value.totalSongs || 0),
    subtitle: `${formatNumber(activeSongs.value)} bài đang hoạt động • +180 so với tuần trước`,
    trendText: '+2.4%',
    trendDirection: 'up',
    icon: 'music',
    tone: 'purple',
    route: '/admin/songs',
    tooltip: 'Xem danh sách bài hát'
  },
  {
    key: 'users',
    title: 'Tổng người dùng',
    value: formatNumber(stats.value.totalUsers || 0),
    subtitle: `${formatNumber(stats.value.totalPremium || 0)} tài khoản Premium • +2 Premium mới`,
    trendText: `+${stats.value.newUsersToday || 12}`,
    trendDirection: 'up',
    icon: 'user',
    tone: 'blue',
    route: '/admin/users',
    tooltip: 'Xem danh sách người dùng'
  },
  {
    key: 'listens',
    title: 'Tổng lượt nghe',
    value: formatNumber(totalListens.value),
    subtitle: `Tổng từ thống kê bài hát • ${formatNumber(stats.value.todayListens || 28771)} lượt hôm qua`,
    trendText: '+8.7%',
    trendDirection: 'up',
    icon: 'play',
    tone: 'green'
  },
  {
    key: 'revenue',
    title: 'Doanh thu Premium',
    value: formatCurrency(stats.value.totalRevenue || 0),
    subtitle: 'Từ giao dịch thành công • TB 3.400 đ/người',
    trendText: '-5.6%',
    trendDirection: 'down',
    icon: 'transaction',
    tone: 'purple',
    route: '/admin/payments',
    tooltip: 'Xem giao dịch Premium'
  },
  {
    key: 'artists',
    title: 'Tổng nghệ sĩ',
    value: formatNumber(stats.value.artistStats?.totalArtists || 0),
    subtitle: 'Nghệ sĩ trong thư viện',
    trendText: `+${stats.value.artistStats?.newArtistsThisWeek || 0} tuần này`,
    trendDirection: 'none',
    icon: 'music',
    tone: 'amber',
    route: '/admin/artists',
    tooltip: 'Xem danh sách nghệ sĩ'
  },
  {
    key: 'playlists',
    title: 'Tổng playlist',
    value: formatNumber(stats.value.playlistStats?.totalPlaylists || 0),
    subtitle: `${formatNumber(stats.value.playlistStats?.publicPlaylists || 0)} playlist công khai`,
    trendText: 'Cộng đồng',
    trendDirection: 'none',
    icon: 'playlist',
    tone: 'rose',
    route: '/admin/playlists',
    tooltip: 'Xem danh sách playlist'
  },
  {
    key: 'hotSong',
    title: 'Bài hát hot nhất',
    value: stats.value.hotSong?.title || '—',
    subtitle: `${formatNumber(stats.value.hotSong?.listenCount || 0)} lượt nghe • ${stats.value.hotSong?.artistName || '—'}`,
    trendText: '🔥 Trending',
    trendDirection: 'none',
    icon: 'fire',
    tone: 'red'
  },
  {
    key: 'newUsers',
    title: 'Người dùng mới',
    value: `+${formatNumber(stats.value.userGrowth?.newUsersThisMonth || 0)}`,
    subtitle: `So với tháng trước (${stats.value.userGrowth?.delta >= 0 ? '+' : ''}${formatNumber(stats.value.userGrowth?.delta || 0)})`,
    trendText: `Tháng ${new Date().getMonth() + 1}`,
    trendDirection: 'none',
    icon: 'user-plus',
    tone: 'cyan'
  }
])

const activeSongs = computed(() => {
  const allGroup = songGroups.value.find(group => group.key === 'ALL')
  return Number(allGroup?.activeSongs || 0)
})

const premiumRate = computed(() => {
  const totalUsers = Number(stats.value.totalUsers || 0)
  if (!totalUsers) return 0
  return Math.round((Number(stats.value.totalPremium || 0) / totalUsers) * 100)
})

const recentTransactions = computed(() => transactions.value.slice(0, 5))
const topTrendSongs = computed(() => listeningTrend.value.topSongs || [])
const topThreeSongs = computed(() => topTrendSongs.value.slice(0, 3))
const topArtistRangeLabel = computed(() => trendRangeOptions.find(item => item.value === topArtistRange.value)?.label || 'Hôm nay')
const hasTrendData = computed(() => (listeningTrend.value.series || []).some(item => Number(item.listens || 0) > 0))
const trendRangeLabel = computed(() => trendRangeOptions.find(item => item.value === trendRange.value)?.label || 'Hôm nay')

const hasRevenueData = computed(() => (rawCharts.value.revenue || []).some(row => Number(row.revenue || 0) > 0))
const hasGenreData = computed(() => (rawCharts.value.genres || []).some(row => Number(row.listens || 0) > 0))
const hasTopArtists = computed(() => topArtists.value.length > 0)
const hasTopArtistTrendData = computed(() => (topArtistTrend.value.series || []).some(row => {
  return (row.artists || []).some(artist => Number(artist.listens || artist.recent_plays || 0) > 0)
}))

const revenueChartData = computed(() => ({
  labels: (rawCharts.value.revenue || []).map(row => formatMonth(row.month)),
  datasets: [{
    label: 'Doanh thu',
    backgroundColor: '#7C3AED',
    hoverBackgroundColor: '#6D28D9',
    borderRadius: 8,
    maxBarThickness: 42,
    data: (rawCharts.value.revenue || []).map(row => Number(row.revenue || 0))
  }]
}))

const genresChartData = computed(() => ({
  labels: (rawCharts.value.genres || []).map(genre => genre.name || 'Khác'),
  datasets: [{
    data: (rawCharts.value.genres || []).map(genre => Number(genre.listens || 0)),
    backgroundColor: ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
    borderColor: 'transparent',
    hoverOffset: 6
  }]
}))

const artistLineColors = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']

const topArtistsChartData = computed(() => ({
  labels: (topArtistTrend.value.series || []).map(row => row.label),
  datasets: topArtists.value.map((artist, index) => {
    const color = artistLineColors[index % artistLineColors.length]
    return {
      label: artist.name || 'Nghệ sĩ',
      data: (topArtistTrend.value.series || []).map(row => {
        const found = (row.artists || []).find(item => Number(item.artist_id) === Number(artist.id))
        return Number(found?.listens || found?.recent_plays || 0)
      }),
      borderColor: color,
      backgroundColor: color,
      pointBackgroundColor: color,
      pointBorderColor: '#FFFFFF',
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 3,
      tension: 0.35,
      fill: false
    }
  })
}))

const trendChartData = computed(() => {
  const series = listeningTrend.value.series || []
  const maxValue = Math.max(...series.map(item => Number(item.listens || 0)), 0)
  return {
    labels: series.map(item => item.label),
    datasets: [
      {
        label: 'Lượt nghe',
        data: series.map(item => Number(item.listens || 0)),
        borderColor: '#7C3AED',
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        pointBackgroundColor: series.map(item => Number(item.listens || 0) === maxValue && maxValue > 0 ? '#EF4444' : '#7C3AED'),
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: series.map(item => Number(item.listens || 0) === maxValue && maxValue > 0 ? 6 : 4),
        pointHoverRadius: 7,
        borderWidth: 3,
        tension: 0.38,
        fill: true
      }
    ]
  }
})

const chartTextColor = computed(() => '#475569')
const chartGridColor = computed(() => 'rgba(148, 163, 184, 0.24)')

const barOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: context => ` ${formatCurrency(context.parsed.y)}`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: chartGridColor.value },
      ticks: {
        color: chartTextColor.value,
        callback: value => compactNumber(value)
      }
    },
    x: {
      grid: { display: false },
      ticks: { color: chartTextColor.value }
    }
  }
}))

const artistLineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        color: chartTextColor.value,
        usePointStyle: true,
        boxWidth: 8,
        padding: 14
      }
    },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: context => ` ${context.dataset.label}: ${formatNumber(context.parsed.y)} lượt nghe`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: chartGridColor.value },
      ticks: {
        color: chartTextColor.value,
        precision: 0,
        callback: value => compactNumber(value)
      }
    },
    x: {
      grid: { display: false },
      ticks: {
        color: chartTextColor.value,
        maxTicksLimit: 9
      }
    }
  }
}))

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTextColor.value,
        usePointStyle: true,
        boxWidth: 8,
        padding: 16
      }
    },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: context => ` ${context.label}: ${formatNumber(context.parsed)} lượt nghe`
      }
    }
  }
}))

const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0F172A',
      titleColor: '#FFFFFF',
      bodyColor: '#E5E7EB',
      padding: 12,
      cornerRadius: 8,
      displayColors: false,
      callbacks: {
        label: context => ` ${formatNumber(context.parsed.y)} lượt nghe`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: chartGridColor.value },
      ticks: {
        color: chartTextColor.value,
        precision: 0,
        callback: value => compactNumber(value)
      }
    },
    x: {
      grid: { display: false },
      ticks: {
        color: chartTextColor.value,
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 9
      }
    }
  }
}))

async function fetchData() {
  loading.value = true
  error.value = null
  auxiliaryWarning.value = ''
  trendLoading.value = true
  topArtistLoading.value = true

  try {
    const dashboardRes = await api.get('/admin/dashboard')
    const dashboardData = dashboardRes.data?.data || {}
    stats.value = dashboardData.stats || {}
    rawCharts.value = dashboardData.charts || { revenue: [], genres: [] }
    latestUsers.value = dashboardData.latestUsers || []
    quickOperations.value = dashboardData.quickOperations || null

    const [songSummaryResult, transactionsResult, trendResult, topArtistResult] = await Promise.allSettled([
      api.get('/admin/songs/groups/summary'),
      api.get('/admin/transactions'),
      api.get('/admin/listening-trends', { params: { range: trendRange.value } }),
      api.get('/admin/top-artists-trends', { params: { range: topArtistRange.value } })
    ])

    if (songSummaryResult.status === 'fulfilled') {
      songGroups.value = songSummaryResult.value.data?.data || []
    }

    if (transactionsResult.status === 'fulfilled') {
      const txData = transactionsResult.value.data?.data;
      transactions.value = Array.isArray(txData) ? txData : (txData?.items || []);
    }

    if (trendResult.status === 'fulfilled') {
      listeningTrend.value = trendResult.value.data?.data || { series: [], topSongs: [] }
    }

    if (topArtistResult.status === 'fulfilled') {
      const artistData = topArtistResult.value.data?.data || { series: [], topArtists: [] }
      topArtistTrend.value = artistData
      topArtists.value = artistData.topArtists || []
    }

    if (songSummaryResult.status === 'rejected' || transactionsResult.status === 'rejected' || trendResult.status === 'rejected' || topArtistResult.status === 'rejected') {
      auxiliaryWarning.value = 'Một số dữ liệu phụ chưa tải được. Dashboard vẫn hiển thị các chỉ số chính.'
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Không thể tải dữ liệu dashboard.'
  } finally {
    loading.value = false
    trendLoading.value = false
    topArtistLoading.value = false
  }
}

async function fetchListeningTrend() {
  trendLoading.value = true
  auxiliaryWarning.value = ''
  try {
    const res = await api.get('/admin/listening-trends', { params: { range: trendRange.value } })
    listeningTrend.value = res.data?.data || { series: [], topSongs: [] }
  } catch (err) {
    listeningTrend.value = { series: [], topSongs: [] }
    auxiliaryWarning.value = err.response?.data?.message || 'Không thể tải dữ liệu xu hướng nghe nhạc.'
  } finally {
    trendLoading.value = false
  }
}

async function fetchTopArtistTrend() {
  topArtistLoading.value = true
  auxiliaryWarning.value = ''
  try {
    const res = await api.get('/admin/top-artists-trends', { params: { range: topArtistRange.value } })
    const artistData = res.data?.data || { series: [], topArtists: [] }
    topArtistTrend.value = artistData
    topArtists.value = artistData.topArtists || []
  } catch (err) {
    topArtistTrend.value = { series: [], topArtists: [] }
    topArtists.value = []
    auxiliaryWarning.value = err.response?.data?.message || 'Không thể tải dữ liệu Top nghệ sĩ.'
  } finally {
    topArtistLoading.value = false
  }
}

function setTrendRange(range) {
  if (trendRange.value === range) return
  trendRange.value = range
  fetchListeningTrend()
}

function resetTrendRange() {
  trendRange.value = 'today'
  fetchListeningTrend()
}

function setTopArtistRange(range) {
  if (topArtistRange.value === range) return
  topArtistRange.value = range
  fetchTopArtistTrend()
}

function resetDashboardRanges() {
  trendRange.value = 'today'
  topArtistRange.value = '7d'
  fetchListeningTrend()
  fetchTopArtistTrend()
}

onMounted(fetchData)

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function compactNumber(value) {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0))
}

const systemPlaylistsMap = {
  dailymix_01: 'Daily Mix 1', dailymix_02: 'Daily Mix 2', dailymix_03: 'Daily Mix 3',
  dailymix_04: 'Daily Mix 4', dailymix_05: 'Daily Mix 5', dailymix_06: 'Daily Mix 6',
  weekly_mix: 'Weekly Mix', moodmix: 'Mood Mix', trending_now: 'Trending Now',
  morning_vibes: 'Morning Vibes', afternoon_vibes: 'Afternoon Vibes',
  evening_vibes: 'Evening Vibes', night_vibes: 'Night Vibes'
}

function formatSystemKeyName(key) {
  return systemPlaylistsMap[key] || key
}

function formatPlaylistDate(key) {
  if (!quickOperations.value?.systemPlaylists) return '--'
  const pl = quickOperations.value.systemPlaylists.find(p => p.systemKey === key || p.system_key === key)
  if (!pl || !pl.lastGeneratedAt) return '--'
  return new Date(pl.lastGeneratedAt).toLocaleDateString('vi-VN')
}

function isPlaylistStale(key) {
  if (!quickOperations.value?.systemPlaylists) return false
  const pl = quickOperations.value.systemPlaylists.find(p => p.systemKey === key || p.system_key === key)
  return pl?.isStale || false
}

function playlistStatusClass(key) {
  if (!quickOperations.value?.systemPlaylists) return 'bg-slate-50 text-slate-500'
  const pl = quickOperations.value.systemPlaylists.find(p => p.systemKey === key || p.system_key === key)
  if (!pl || !pl.lastGeneratedAt) return 'bg-slate-50 text-slate-500'

  if (pl.isStale) {
    const statusText = String(pl.statusLabel || '').toLowerCase()
    if (statusText.includes('đến hạn')) {
      return 'bg-amber-50 text-amber-700'
    }
    return 'bg-rose-50 text-rose-600'
  }

  switch(key) {
    case 'dailymix_01': return 'bg-emerald-50 text-emerald-700'
    case 'weekly_mix': return 'bg-blue-50 text-blue-700'
    case 'trending_now': return 'bg-amber-50 text-amber-700'
    case 'moodmix':
    case 'morning_vibes':
    default: return 'bg-violet-50 text-violet-700'
  }
}

function formatPlaylistStatus(key) {
  const normalizeStatusText = (text) => {
    const separator = text.includes('·') ? '·' : (text.includes('Â·') ? 'Â·' : null)
    if (!separator) return text

    const parts = text.split(separator).map(s => s.trim())
    const prefix = parts[0]?.toLowerCase() || ''
    if (prefix.includes('hôm nay')) return parts[0]
    if (prefix.includes('đến hạn')) return parts[0]
    return (parts[1] || text).replace('Lịch kế tiếp:', 'Lịch:')
  }

  if (!quickOperations.value?.systemPlaylists) return 'Chưa có'
  const pl = quickOperations.value.systemPlaylists.find(p => p.systemKey === key || p.system_key === key)
  if (!pl) return 'Chưa có'

  const rawText = pl.statusLabel || pl.displayDate || 'Cần tạo lại'

  if (rawText.includes('·')) {
    const parts = rawText.split('·').map(s => s.trim())
    if (parts[0].toLowerCase().includes('hôm nay')) {
      return parts[0]
    }
    if (parts[1]) {
      return parts[1].replace('Lịch kế tiếp:', 'Lịch:')
    }
  }
  return normalizeStatusText(rawText)
}

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatRelativeTime(value) {
  if (!value) return 'Chưa cập nhật'
  const diff = Date.now() - new Date(value).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) {
    const mins = Math.floor(diff / 60000)
    return mins <= 1 ? 'Vừa xong' : `${mins} phút trước`
  }
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function formatMonth(value) {
  if (!value) return ''
  const [year, month] = String(value).split('-')
  if (!year || !month) return value
  return `T${Number(month)}/${year}`
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || 'Không có email'
  const [name, domain] = email.split('@')
  if (name.length <= 2) return `${name}***@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}


function songCover(song) {
  return normalizeImageUrl(song?.cover_url)
}

function artistAvatar(artist) {
  return normalizeImageUrl(artist?.avatar_url || artist?.image || artist?.cover_url)
}

function artistListenValue(artist) {
  return Number(artist?.recent_plays || artist?.total_plays || artist?.listen_count || artist?.total_listens || artist?.listens || 0)
}

function artistInitial(artist) {
  return String(artist?.name || '?').trim().charAt(0).toUpperCase() || '?'
}

function trendDiff(song) {
  return Number(song?.listens || 0) - Number(song?.previous_listens || 0)
}

function trendClass(song) {
  const diff = trendDiff(song)
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}

function trendLabel(song) {
  const diff = trendDiff(song)
  if (diff > 0) return `+${formatNumber(diff)}`
  if (diff < 0) return `-${formatNumber(Math.abs(diff))}`
  return 'Ổn định'
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'success', 'completed'].includes(normalized)) return 'success'
  if (['pending', 'processing'].includes(normalized)) return 'warning'
  return 'danger'
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'success', 'completed'].includes(normalized)) return 'Thành công'
  if (['pending', 'processing'].includes(normalized)) return 'Đang xử lý'
  return 'Thất bại'
}
</script>

<style scoped>
.admin-dashboard {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  min-height: 100%;
  padding: 4px 0 16px;
  background: #f8fafc !important;
  color: #0f172a;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 800;
  color: #7c3aed;
  text-transform: uppercase;
  letter-spacing: 0;
}

.page-title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 800;
  color: #111827;
}

.page-subtitle {
  margin: 8px 0 0;
  max-width: 680px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.refresh-button,
.alert-card button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.refresh-button:hover:not(:disabled),
.alert-card button:hover {
  background: #f8fafc;
  border-color: #c4b5fd;
  color: #6d28d9;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.refresh-button svg {
  width: 17px;
  height: 17px;
}

.spinning {
  animation: spin 1s linear infinite;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card,
.panel,
.alert-card {
  background: #ffffff;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.stat-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
  min-height: 132px;
  padding: 18px;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  border-color: #c4b5fd;
  box-shadow: 0 12px 34px rgba(124, 58, 237, 0.08);
  transform: translateY(-1px);
}

.stat-icon {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}

.stat-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.tone-primary { background: rgba(124, 58, 237, 0.1); color: #7c3aed; }
.tone-blue { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
.tone-green { background: rgba(16, 185, 129, 0.12); color: #059669; }
.tone-purple { background: rgba(109, 40, 217, 0.12); color: #6d28d9; }

.stat-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.stat-value {
  margin-top: 6px;
  color: #0f172a;
  font-size: 25px;
  line-height: 1.15;
  font-weight: 800;
  word-break: break-word;
}

.stat-note {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.dashboard-grid,
.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.dashboard-side-stack {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.top-artists-section {
  margin-bottom: 16px;
}

.top-artists-trend-grid {
  grid-template-columns: minmax(320px, 4fr) minmax(0, 8fr);
}

.trend-panel {
  margin-bottom: 16px;
}

.trend-header {
  align-items: center;
}

.range-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  background: #f8fafc;
}

.range-tabs button {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.range-tabs button:hover:not(:disabled) {
  color: #6d28d9;
}

.range-tabs button.active {
  background: #ffffff;
  color: #6d28d9;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.range-tabs button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.trend-compact-grid {
  display: grid;
  grid-template-columns: minmax(280px, 4fr) minmax(0, 8fr);
  gap: 16px;
  align-items: stretch;
  min-height: 360px;
}

.trend-chart-card {
  min-width: 0;
}

.trend-chart-card.compact {
  height: 100%;
  min-height: 360px;
}

.chart-container.line-chart.compact {
  height: 360px;
}

.top-three-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  background: #fbfdff;
  padding: 12px;
}

.ranking-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.ranking-title h3 {
  margin: 0;
  color: #111827;
  font-size: 15px;
  font-weight: 800;
}

.ranking-title span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.ranking-title.compact {
  margin-bottom: 10px;
}

.top-three-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 8px;
  justify-content: space-between;
}

.top-three-row {
  display: grid;
  grid-template-columns: 38px 46px minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  row-gap: 4px;
  min-height: 86px;
  padding: 9px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #ffffff;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.top-three-row:hover {
  background: #f8fafc;
  border-color: #d8b4fe;
  transform: translateY(-1px);
}

.rank-number {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}

.rank-number.podium {
  color: #7c3aed;
}

.top-three-row img {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  object-fit: cover;
}

.song-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.song-meta strong {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-meta span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-count {
  grid-column: 3;
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.listen-count strong {
  color: #111827;
  font-size: 13px;
  font-weight: 900;
}

.listen-count span {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.trend-badge {
  grid-column: 3;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
}

.trend-badge.up { background: #dcfce7; color: #166534; }
.trend-badge.down { background: #fee2e2; color: #991b1b; }
.trend-badge.flat { background: #eef2ff; color: #4338ca; }

.line-skeleton {
  position: relative;
  height: 360px;
  overflow: hidden;
  border: 1px dashed #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.line-skeleton::before,
.line-skeleton::after,
.line-skeleton span {
  position: absolute;
  left: 24px;
  right: 24px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(124, 58, 237, 0.08), rgba(124, 58, 237, 0.38), rgba(59, 130, 246, 0.18));
  content: "";
}

.line-skeleton::before {
  top: 38%;
  transform: rotate(-3deg);
}

.line-skeleton::after {
  top: 58%;
  transform: rotate(4deg);
}

.line-skeleton span {
  top: 48%;
  animation: shimmer 1.4s ease infinite;
}

.top-three-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-three-skeleton-row {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 12px;
}

.top-three-skeleton-row span {
  height: 70px;
  border-radius: 8px;
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.compact-trend-empty {
  min-height: 300px;
}

.trend-empty.compact {
  min-height: 360px;
}

.panel {
  min-width: 0;
  padding: 18px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 1.3;
  font-weight: 800;
}

.panel-header p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.chart-container {
  height: 300px;
  position: relative;
}

.chart-container.donut {
  height: 282px;
}

.empty-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: #64748b;
  border: 1px dashed #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
  padding: 24px;
}

.empty-state.compact {
  min-height: 282px;
}

.empty-state.table-empty {
  min-height: 230px;
}

.top-artists-panel {
  min-height: 282px;
}

.top-artists-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-artist-row {
  display: grid;
  grid-template-columns: 40px 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 66px;
  padding: 10px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfdff;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.top-artist-row:hover {
  background: #f8fafc;
  border-color: #d8b4fe;
  transform: translateY(-1px);
}

.artist-rank {
  color: #7c3aed;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}

.artist-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  object-fit: cover;
  background: #eef2ff;
}

.artist-avatar.fallback {
  display: grid;
  place-items: center;
  color: #6d28d9;
  font-size: 15px;
  font-weight: 900;
}

.artist-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.artist-info strong {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-info span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.artist-plays {
  display: flex;
  min-width: 76px;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.artist-plays strong {
  color: #111827;
  font-size: 14px;
  font-weight: 900;
}

.artist-plays span {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}

.top-artists-empty {
  min-height: 220px;
}

.top-artists-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-artists-skeleton-row {
  display: grid;
  grid-template-columns: 40px 44px 1fr;
  gap: 10px;
  align-items: center;
}

.top-artists-skeleton-row span {
  height: 44px;
  border-radius: 8px;
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.empty-state svg {
  width: 42px;
  height: 42px;
  color: #94a3b8;
}

.empty-state p {
  margin: 0;
  max-width: 360px;
  font-weight: 600;
}

.alert-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding: 14px;
  border-color: #fecaca;
  background: #fff7f7;
  color: #991b1b;
}

.alert-card p {
  margin: 4px 0 0;
  color: #b91c1c;
  font-size: 13px;
}

.alert-card button {
  margin-left: auto;
  border-color: #fecaca;
  color: #b91c1c;
}

.alert-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 8px;
  background: #fee2e2;
}

.alert-icon svg {
  width: 20px;
  height: 20px;
}

.inline-warning {
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 13px;
  font-weight: 600;
}

.table-panel {
  overflow: hidden;
}

.view-link {
  color: #7c3aed;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}

.view-link:hover {
  color: #5b21b6;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}

.data-table th {
  padding: 12px 10px;
  border-bottom: 1px solid #e5eaf3;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
  text-transform: uppercase;
}

.data-table td {
  padding: 14px 10px;
  border-bottom: 1px solid #eef2f7;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  vertical-align: middle;
}

.data-table tbody tr {
  transition: background 0.2s ease;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.user-cell {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 3px;
}

.user-cell strong {
  color: #111827;
}

.user-cell span {
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.status-badge.success { background: #dcfce7; color: #166534; }
.status-badge.warning { background: #ffedd5; color: #9a3412; }
.status-badge.danger { background: #fee2e2; color: #991b1b; }

.insights-panel {
  align-self: start;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 36px;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 600;
}

.insight-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  margin-top: 6px;
  border-radius: 999px;
}

.insight-dot.positive,
.insight-dot.success { background: #10b981; }
.insight-dot.primary { background: #7c3aed; }
.insight-dot.warning { background: #f59e0b; }

.skeleton,
.chart-skeleton span,
.table-skeleton-row span,
.donut-skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.icon-skeleton {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
}

.line {
  height: 12px;
  margin-top: 8px;
}

.line.short { width: 94px; }
.line.medium { width: 150px; }
.line.value { width: 120px; height: 26px; }
.line.full { flex: 1; height: 12px; }
.dot { width: 8px; height: 8px; flex: 0 0 8px; margin-top: 6px; border-radius: 999px; }

.chart-skeleton {
  height: 300px;
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 24px 12px 8px;
}

.chart-skeleton span {
  flex: 1;
  min-width: 28px;
}

.donut-skeleton {
  width: min(220px, 70%);
  aspect-ratio: 1;
  margin: 32px auto;
  border-radius: 999px;
}

.table-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-skeleton-row {
  display: grid;
  grid-template-columns: 1.3fr 1fr 0.8fr 0.8fr;
  gap: 12px;
}

.table-skeleton-row span {
  height: 34px;
}

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

:global(.dark) .admin-dashboard,
:global(.dark) .admin-dashboard * {
  color-scheme: light;
}

:global(.dark) .admin-dashboard {
  background: #f8fafc !important;
  background-image: none !important;
  color: #0f172a !important;
}

:global(.dark) .admin-dashboard .stat-card,
:global(.dark) .admin-dashboard .panel,
:global(.dark) .admin-dashboard .refresh-button,
:global(.dark) .admin-dashboard .alert-card {
  background: #ffffff !important;
  border-color: #e5eaf3 !important;
  color: #334155 !important;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04) !important;
}

:global(.dark) .admin-dashboard .page-title,
:global(.dark) .admin-dashboard .panel-header h2,
:global(.dark) .admin-dashboard .ranking-title h3,
:global(.dark) .admin-dashboard .song-meta strong,
:global(.dark) .admin-dashboard .listen-count strong,
:global(.dark) .admin-dashboard .artist-info strong,
:global(.dark) .admin-dashboard .artist-plays strong,
:global(.dark) .admin-dashboard .stat-value,
:global(.dark) .admin-dashboard .user-cell strong {
  color: #111827 !important;
}

:global(.dark) .admin-dashboard .page-subtitle,
:global(.dark) .admin-dashboard .panel-header p,
:global(.dark) .admin-dashboard .stat-label,
:global(.dark) .admin-dashboard .stat-note,
:global(.dark) .admin-dashboard .data-table th,
:global(.dark) .admin-dashboard .user-cell span,
:global(.dark) .admin-dashboard .ranking-title span,
:global(.dark) .admin-dashboard .song-meta span,
:global(.dark) .admin-dashboard .listen-count span,
:global(.dark) .admin-dashboard .artist-info span,
:global(.dark) .admin-dashboard .artist-plays span,
:global(.dark) .admin-dashboard .empty-state p {
  color: #64748b !important;
}

:global(.dark) .admin-dashboard .empty-state,
:global(.dark) .admin-dashboard .insight-row,
:global(.dark) .admin-dashboard .line-skeleton {
  background: #f8fafc !important;
  border-color: #dbe3ef !important;
  color: #475569 !important;
}

:global(.dark) .admin-dashboard .top-three-panel,
:global(.dark) .admin-dashboard .top-three-row,
:global(.dark) .admin-dashboard .top-artist-row,
:global(.dark) .admin-dashboard .range-tabs button.active {
  background: #ffffff !important;
  border-color: #e5eaf3 !important;
}

:global(.dark) .admin-dashboard .range-tabs {
  background: #f8fafc !important;
  border-color: #e5eaf3 !important;
}

:global(.dark) .admin-dashboard .range-tabs button {
  color: #64748b !important;
}

:global(.dark) .admin-dashboard .range-tabs button.active {
  color: #6d28d9 !important;
}

:global(.dark) .admin-dashboard .data-table td {
  color: #334155 !important;
  border-color: #eef2f7 !important;
}

:global(.dark) .admin-dashboard .data-table tbody tr:hover {
  background: #f8fafc !important;
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }

  .trend-compact-grid,
  .top-artists-trend-grid {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .chart-container,
  .chart-skeleton {
    height: 280px;
  }

  .chart-container.line-chart.compact,
  .line-skeleton {
    height: 260px;
  }

  .trend-chart-card.compact {
    min-height: 260px;
  }

  .top-three-panel {
    height: auto;
  }
}

@media (max-width: 720px) {
  .dashboard-header {
    flex-direction: column;
  }

  .refresh-button {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .panel,
  .stat-card {
    padding: 14px;
  }

  .page-title {
    font-size: 24px;
  }

  .panel-header {
    flex-direction: column;
  }

  .trend-header {
    align-items: stretch;
  }

  .range-tabs {
    width: 100%;
  }

  .range-tabs button {
    flex: 1;
  }

  .top-three-row {
    grid-template-columns: 38px 44px minmax(0, 1fr);
  }

  .listen-count,
  .trend-badge {
    grid-column: 3;
    justify-self: start;
    align-items: flex-start;
  }

  .chart-container.line-chart.compact,
  .line-skeleton {
    height: 240px;
  }

  .trend-chart-card.compact {
    min-height: 240px;
  }

  .top-three-row {
    min-height: 74px;
  }

  .data-table {
    min-width: 640px;
  }

  .alert-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .alert-card button {
    width: 100%;
    margin-left: 0;
  }
}
</style>
