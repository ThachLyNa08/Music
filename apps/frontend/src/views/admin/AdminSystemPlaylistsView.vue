<template>
  <div class="flex-1 flex flex-col relative full-bleed min-h-0 pb-10 bg-slate-50">
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm mb-6">
      <div>
        <h1 class="text-2xl !font-heading font-bold tracking-tight leading-[1.15] text-gray-900">Giám sát playlist hệ thống</h1>
        <p class="text-gray-500 mt-1 text-sm font-medium">Theo dõi trạng thái, lịch trình và bảo trì các playlist được hệ thống tự động tạo</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
        <button class="flex h-9 items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-3 rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-60" title="Tác vụ này chỉ khởi chạy lại pipeline tự động tạo/cập nhật playlist khi dữ liệu bị trống, lỗi hoặc cần bảo trì. Playlist không được quản trị viên tạo thủ công." @click="executeQuickFix" :disabled="isRegeneratingAll || runningJobs > 0">
          <MfIcon v-if="isRegeneratingAll" name="sync" class="spinning" size="16" />
          <MfIcon v-else name="auto_fix_high" size="16" />
          {{ (isRegeneratingAll || runningJobs > 0) ? 'Đang xử lý...' : 'Làm mới nhanh' }}
        </button>
        <select v-model="selectedRegenerateKey" class="h-9 max-w-[230px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">
          <option value="">{{ refreshSystemKeysOptions.length ? 'Theo loại cần làm mới' : 'Không có loại cần làm mới' }}</option>
          <option v-for="item in refreshSystemKeysOptions" :key="item.key" :value="item.key">
            {{ item.label || item.key }} ({{ formatNumber(item.needsRefreshCount) }})
          </option>
        </select>
        <button class="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60" title="Tác vụ này chỉ khởi chạy lại pipeline tự động tạo/cập nhật playlist khi dữ liệu bị trống, lỗi hoặc cần bảo trì. Playlist không được quản trị viên tạo thủ công." @click="executeRegenerateScope" :disabled="isRegeneratingAll || runningJobs > 0 || !selectedRegenerateKey">
          <MfIcon name="filter_alt" size="16" />
          Làm mới theo loại
        </button>
        <button class="flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-60" title="Tác vụ này chỉ khởi chạy lại pipeline tự động tạo/cập nhật playlist khi dữ liệu bị trống, lỗi hoặc cần bảo trì. Playlist không được quản trị viên tạo thủ công." @click="confirmRegenerateAll" :disabled="isRegeneratingAll || runningJobs > 0">
          <MfIcon name="schedule" size="16" />
          Chạy bảo trì nền
        </button>
      </div>
    </header>

    <div class="px-6 flex flex-col space-y-6">

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminKpiCard
        v-for="item in kpiCards"
        :key="item.title"
        v-bind="item"
        :loading="loading && !summary"
        :showIcon="false"
        compact
        :class="{'cursor-pointer hover:bg-slate-50 transition': !!item.onClick}"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
      <!-- Tỷ Lệ Lỗi -->
      <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-sky-400"></div>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-500 line-clamp-1">Tỷ Lệ Lỗi Tạo Playlist</p>
            <p class="mt-1 leading-tight font-black tracking-tight text-cyan-600" :class="operationFailureRateText ? 'text-2xl' : 'text-xl'">
              {{ operationFailureRateText || 'Chưa có dữ liệu' }}
            </p>
            <p class="mt-1 text-[11px] font-medium line-clamp-1" :class="operationFailureRateText ? 'text-emerald-500' : 'text-slate-400'">
              {{ operationFailureRateText ? `Run gần nhất: ${formatRunStatus(operationSummary?.lastRunStatus)}` : 'Chưa có dữ liệu vận hành' }}
            </p>
          </div>
          <div class="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 mt-0.5">24H</div>
        </div>
      </div>

      <!-- Thời Gian Tạo -->
      <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400"></div>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-500 line-clamp-1">Thời Gian Tạo TB</p>
            <p class="mt-1 leading-tight font-black tracking-tight text-violet-600 text-2xl">
              {{ averageGenerationTimeText || 'â€”' }}
            </p>
            <p class="mt-1 text-[11px] font-medium line-clamp-1" :class="averageGenerationTimeText ? 'text-emerald-500' : 'text-slate-400'">
              {{ averageGenerationTimeText ? 'Theo run thành công gần nhất' : 'Chưa có dữ liệu vận hành' }}
            </p>
          </div>
          <div class="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 mt-0.5">MS</div>
        </div>
      </div>

      <!-- Đang Xử Lý -->
      <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-amber-400"></div>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-500 line-clamp-1">Đang Xử Lý</p>
            <p class="mt-1 leading-tight font-black tracking-tight text-orange-600 text-2xl">
              {{ runningJobs }}
            </p>
            <div class="mt-2 mb-1 flex items-center gap-2">
              <div class="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-orange-500 rounded-full" :style="{ width: (runningJobs > 0 ? '50%' : '0%') }"></div>
              </div>
            </div>
            <p class="mt-1 text-[11px] font-medium text-slate-400 line-clamp-1">
              {{ runningJobs > 0 ? 'Đang chạy pipeline làm mới playlist' : 'Không có job đang chạy' }}
            </p>
          </div>
          <div class="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 mt-0.5">QUEUE</div>
        </div>
      </div>

      <!-- Tạo Lại Gần Nhất -->
      <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 to-slate-300"></div>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-500 line-clamp-1">Làm Mới Gần Nhất</p>
            <p class="mt-1 leading-tight font-black tracking-tight text-slate-800" :class="lastRegeneratedText ? 'text-lg' : 'text-xl'">
              {{ lastRegeneratedText || 'Chưa ghi nhận' }}
            </p>
            <p class="mt-1 text-[11px] font-medium text-slate-400 line-clamp-2 leading-relaxed">
              <template v-if="lastRegeneratedText">
                <span class="text-slate-500">Trạng thái:</span> <span class="text-violet-600 font-medium">{{ formatRunStatus(operationSummary?.lastRunStatus) }}</span><br>
                Dữ liệu từ lần chạy pipeline gần nhất
              </template>
              <template v-else>
                Chưa có dữ liệu vận hành
              </template>
            </p>
          </div>
          <div class="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 mt-0.5">AUTO</div>
        </div>
      </div>
    </div>

    <!-- Automatic Schedule -->
    <section class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 class="text-base text-slate-800 !font-heading font-bold">Lịch trình tự động</h3>
          <p class="text-[11px] text-slate-500 mt-0.5">Pipeline chạy nền độc lập; quản trị viên chỉ giám sát và kích hoạt bảo trì khi cần.</p>
        </div>
        <button class="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50" @click="fetchSchedule" :disabled="loadingSchedule">
          Làm mới
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left text-xs">
          <thead class="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2">Nhóm playlist</th>
              <th class="px-3 py-2">Lịch chạy</th>
              <th class="px-3 py-2">Lần chạy gần nhất</th>
              <th class="px-3 py-2">Trạng thái</th>
              <th class="px-3 py-2">Nguồn kích hoạt</th>
              <th class="px-3 py-2">Kết quả</th>
              <th class="px-3 py-2 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loadingSchedule">
              <td colspan="7" class="px-3 py-4 text-center text-slate-500">Đang tải lịch trình...</td>
            </tr>
            <tr v-else-if="!scheduleRows.length">
              <td colspan="7" class="px-3 py-4 text-center text-slate-500">Chưa có dữ liệu lịch trình.</td>
            </tr>
            <tr v-for="row in scheduleRows" v-else :key="row.schedulerName" class="hover:bg-slate-50">
              <td class="px-3 py-2 font-semibold text-slate-800">{{ row.groupLabel }}</td>
              <td class="px-3 py-2 text-slate-600">{{ formatScheduleLabel(row.scheduleLabel) }}</td>
              <td class="px-3 py-2 text-slate-600">{{ formatDateTime(row.lastRunAt) || 'Chưa ghi nhận' }}</td>
              <td class="px-3 py-2">
                <span class="rounded-md px-2 py-1 text-[11px] font-semibold" :class="scheduleStatusClass(row.statusCode)">
                  {{ formatScheduleStatus(row.statusCode, row.statusLabel) }}
                </span>
              </td>
              <td class="px-3 py-2 text-slate-600">{{ formatTriggerSource(row.triggerSource) }}</td>
              <td class="px-3 py-2 text-slate-500">{{ formatScheduleResult(row.result) }}</td>
              <td class="px-3 py-2 text-right">
                <button class="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" @click="selectScheduleForMaintenance(row)">
                  Chạy
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Distribution & Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
      <!-- Chart -->
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col lg:col-span-2">
        <h3 class="text-base text-slate-800 !font-heading font-bold mb-1">Phân bố loại playlist</h3>
        <p class="text-[11px] text-slate-500 mb-4">Số lượng playlist theo từng system key (Theo toàn bộ dữ liệu)</p>
        <div v-if="distributionChartItems.length > 0" class="playlist-distribution-chart mt-4">
          <div
            v-for="item in distributionChartItems"
            :key="item.system_key"
            class="distribution-bar-item group"
            :title="`${item.system_key}: ${item.count}`"
          >
            <div class="distribution-bar-value opacity-0 group-hover:opacity-100 transition-opacity">
              {{ formatNumber(item.count) }}
            </div>

            <div class="distribution-bar-stage">
              <div
                class="distribution-bar-flat"
                :class="item.colorClass"
                :style="{ height: `${item.percent}%` }"
              >
              </div>
            </div>

            <div class="distribution-bar-label">
              {{ item.label }}
            </div>
          </div>
        </div>
        <div v-else class="flex h-[240px] items-center justify-center text-[13px] text-slate-500">
          Chưa có dữ liệu phân bố playlist hệ thống.
        </div>
      </div>

      <!-- Activity Log -->
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col lg:col-span-1">
        <h3 class="text-base text-slate-800 !font-heading font-bold mb-1">Lịch sử hoạt động</h3>
        <div class="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
          <div v-if="loadingActivity" class="text-[13px] text-slate-500 py-4 text-center">Đang tải...</div>
          <div v-else-if="!activityLogs || activityLogs.length === 0" class="text-[13px] text-slate-500 py-8 text-center flex flex-col items-center justify-center h-full">
            <MfIcon name="history" size="32" class="text-slate-300 mb-2" />
            <span>Chưa có lịch sử hoạt động.<br>Các lần làm mới playlist sẽ xuất hiện tại đây sau khi hệ thống ghi log.</span>
          </div>
          <div v-else class="space-y-4 pr-2">
            <div v-for="log in activityLogs" :key="log.id" class="flex gap-3 text-[13px]">
              <div class="w-2 h-2 mt-1.5 rounded-full shrink-0" :class="runStatusDotClass(log.status)"></div>
              <div>
                <div class="font-medium text-slate-800">
                  {{ formatOperationType(log.operationType) }} - {{ formatRunStatus(log.status) }}
                </div>
                <div class="text-[11px] text-slate-500 mt-0.5">
                  {{ formatDateTime(log.startedAt) }} - bởi {{ log.triggeredBy || 'Admin' }}
                </div>
                <div class="text-[11px] text-slate-500 mt-0.5">
                  Nguồn: {{ formatTriggerSource(log.triggerSource) }}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  {{ formatRunProgress(log) }}
                  <span v-if="log.durationMs">, {{ formatDurationMs(log.durationMs) }}</span>
                </div>
                <button
                  v-if="canResetGenerationRun(log)"
                  class="mt-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  @click="resetGenerationRun(log)"
                >
                  Hủy tác vụ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chất lượng Playlist Hệ thống -->
    <div class="panel border-t-4 border-t-indigo-500 shadow-sm mt-6 mb-2" v-if="qualityReport">
      <div class="panel-header flex-col items-start gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 class="text-lg text-slate-800 !font-heading font-bold tracking-tight flex items-center gap-2">
            <MfIcon name="analytics" size="20" class="text-indigo-600" />
            Báo cáo chất lượng theo loại playlist
            <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] uppercase tracking-wide font-bold">Báo cáo tổng hợp</span>
          </h2>
          <p class="text-[11px] text-slate-500 font-normal mt-1">Mỗi dòng là một loại playlist hệ thống (system key), dùng để đánh giá thuật toán tạo playlist: số bài ứng viên, độ trùng lặp, độ đa dạng nghệ sĩ/thể loại và độ phủ audio features.</p>
        </div>
        <div v-if="qualityReport.rows && qualityReport.rows.length === 0 && qualityReport.message" class="text-[11px] text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-200">
          {{ qualityReport.message }}
        </div>
      </div>
      <div class="panel-body bg-slate-50/50 p-5">

        <!-- Quick Filters -->
        <div class="flex gap-2 mb-4" v-if="qualityReport.rows && qualityReport.rows.length > 0">
          <button class="px-2.5 py-1 rounded-md text-xs font-semibold transition"
            :class="qualityFilter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="qualityFilter = 'all'">
            Tất cả ({{ qualityReport.summary.total }})
          </button>
          <button class="px-2.5 py-1 rounded-md text-xs font-semibold transition"
            :class="qualityFilter === 'good' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="qualityFilter = 'good'">
            Good ({{ qualityReport.summary.good }})
          </button>
          <button class="px-2.5 py-1 rounded-md text-xs font-semibold transition"
            :class="qualityFilter === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="qualityFilter = 'warning'">
            Warning ({{ qualityReport.summary.warning }})
          </button>
          <button class="px-2.5 py-1 rounded-md text-xs font-semibold transition"
            :class="qualityFilter === 'bad' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="qualityFilter = 'bad'">
            Bad ({{ qualityReport.summary.bad }})
          </button>
        </div>

        <div v-if="qualityReport.rows && qualityReport.rows.length > 0" class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div class="overflow-x-auto overflow-y-auto max-h-[300px] custom-scrollbar relative border-b border-slate-200">
            <table class="w-full text-left text-xs whitespace-nowrap table-fixed min-w-[900px]">
              <thead class="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-900 uppercase font-bold sticky top-0 z-20">
                <tr>
                  <th class="px-2 py-2 w-[12%]">Playlist</th>
                  <th class="px-2 py-2 w-[8%]">Trạng thái</th>
                  <th class="px-2 py-2 text-right w-[9%]" title="Số bài cuối cùng được chọn vào playlist so với số bài mục tiêu.">Kết quả chọn</th>
                  <th class="px-2 py-2 text-right w-[8%]" title="Số bài hát hệ thống tìm được trước khi lọc và chọn ra playlist cuối cùng. Ví dụ 566 bài ứng viên được lọc còn 25 bài chính thức.">Bài ứng viên</th>
                  <th class="px-2 py-2 text-right w-[9%]" title="Tỷ lệ bài trong playlist mới trùng với phiên bản trước đó. Càng thấp thì playlist càng mới.">Trùng bản cũ</th>
                  <th class="px-2 py-2 text-right w-[11%]" title="Tỷ lệ cao nhất của một nghệ sĩ trong playlist. Ví dụ 28% nghĩa là nghệ sĩ xuất hiện nhiều nhất chiếm 28% số bài.">Tối đa cùng nghệ sĩ</th>
                  <th class="px-2 py-2 text-right w-[11%]" title="Tỷ lệ cao nhất của một thể loại trong playlist. Ví dụ 72% nghĩa là thể loại chiếm nhiều nhất có 72% số bài.">Tối đa cùng thể loại</th>
                  <th class="px-2 py-2 text-right w-[10%]">Audio coverage</th>
                  <th class="px-2 py-2 w-[16%]">Cảnh báo</th>
                  <th class="px-2 py-2 text-right w-[6%]">Chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in filteredQualityRows" :key="row.system_key" class="transition group hover:bg-slate-50">
                  <td class="px-2 py-2 font-semibold text-slate-800">{{ row.system_key }}</td>
                  <td class="px-2 py-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold"
                          :class="{'bg-green-100 text-green-700': row.status === 'GOOD', 'bg-amber-100 text-amber-700': row.status === 'WARNING', 'bg-rose-100 text-rose-700': row.status === 'BAD'}">
                      {{ row.status === 'GOOD' ? 'Đạt' : row.status === 'WARNING' ? 'Cảnh báo' : row.status === 'BAD' ? 'Lỗi' : row.status }}
                    </span>
                  </td>
                  <td class="px-2 py-2 text-right font-mono text-[11px]">{{ row.actual_songs }} / {{ row.target_size }} bài</td>
                  <td class="px-2 py-2 text-right font-mono text-[11px] text-slate-500">{{ row.candidate_count || 'N/A' }}</td>
                  <td class="px-2 py-2 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <span class="font-mono text-[11px]" :class="{'text-amber-600 font-bold': row.overlap_ratio >= 0.7}">{{ formatQualityPercent(row.overlap_ratio) }}</span>
                      <div class="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div class="h-full rounded-full" :class="row.overlap_ratio >= 0.7 ? 'bg-amber-500' : 'bg-slate-400'" :style="`width: ${Math.min((row.overlap_ratio || 0) * 100, 100)}%`"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-2 text-right">
                    <div class="flex items-center justify-end gap-1.5" :title="`Max Same Artist Ratio: ${formatQualityPercent(row.max_same_artist_ratio)}`">
                      <span class="font-mono text-[11px]" :class="{'text-amber-600 font-bold': row.max_same_artist_ratio > 0.3}">{{ formatQualityPercent(row.max_same_artist_ratio) }}</span>
                      <div class="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div class="h-full rounded-full" :class="row.max_same_artist_ratio > 0.3 ? 'bg-amber-500' : 'bg-slate-400'" :style="`width: ${Math.min((row.max_same_artist_ratio || 0) * 100, 100)}%`"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-2 text-right">
                    <div class="flex items-center justify-end gap-1.5" :title="`Max Same Genre Ratio: ${formatQualityPercent(row.max_same_genre_ratio)}`">
                      <span class="font-mono text-[11px]" :class="{'text-amber-600 font-bold': row.max_same_genre_ratio > 0.75}">{{ formatQualityPercent(row.max_same_genre_ratio) }}</span>
                      <div class="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div class="h-full rounded-full" :class="row.max_same_genre_ratio > 0.75 ? 'bg-amber-500' : 'bg-slate-400'" :style="`width: ${Math.min((row.max_same_genre_ratio || 0) * 100, 100)}%`"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-2 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <span class="font-mono text-[11px]" :class="{'text-amber-600 font-bold': row.audio_feature_coverage < 0.95}">{{ formatQualityPercent(row.audio_feature_coverage) }}</span>
                      <div class="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div class="h-full rounded-full" :class="row.audio_feature_coverage < 0.95 ? 'bg-amber-500' : 'bg-green-500'" :style="`width: ${Math.min((row.audio_feature_coverage || 0) * 100, 100)}%`"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-2 text-[11px] text-amber-600 truncate" :title="row.warnings">{{ row.warnings }}</td>
                  <td class="px-2 py-2 text-right">
                    <button class="text-indigo-600 hover:text-indigo-800 font-semibold text-[10px] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition" @click="openQualityDetail(row)">
                      Chi tiết
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else-if="!qualityReport.message && loadingQuality" class="text-center p-6 text-slate-500">
          Đang tải dữ liệu chất lượng...
        </div>
      </div>
    </div>

    <!-- Main Content Group (Filter, Table, Pagination) -->
    <div class="flex flex-col gap-3">
      <!-- Khối giải thích -->
      <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900 leading-relaxed">
        <strong>Phân biệt nhanh:</strong>
        <ul class="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Bảng chất lượng:</strong> đánh giá thuật toán theo system key.</li>
          <li><strong>Bảng dữ liệu:</strong> quản lý từng playlist thật trong database.</li>
        </ul>
        <p class="mt-2 text-xs opacity-80 italic">Ví dụ: weekly_mix ở bảng trên là kết quả tổng hợp của toàn bộ Weekly Mix; còn các dòng Weekly Mix bên dưới là playlist cụ thể của từng người dùng.</p>
      </div>

      <div class="mt-2">
        <h2 class="text-lg text-slate-800 !font-heading font-bold tracking-tight flex items-center gap-2">
          <MfIcon name="list_alt" size="20" class="text-indigo-600" />
          Danh sách playlist hệ thống trong dữ liệu
          <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wide font-bold">Dữ liệu thực tế</span>
        </h2>
        <p class="text-xs text-slate-500 font-normal mt-1">Mỗi dòng là một playlist cụ thể trong database, thường gắn với một người dùng. Bảng này dùng để kiểm tra trạng thái dữ liệu như thiếu ảnh bìa, thiếu bài hát hoặc thao tác quản trị.</p>
      </div>

      <!-- Tra cứu nâng cao -->
      <div>
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center w-full">
          <div class="relative w-full xl:flex-1 xl:min-w-[200px]">
          <AdminSearchInput
            v-model="filters.q"
            compact
            placeholder="Từ khóa (Tên / System Key)..."
            icon="search"
            historyKey="admin-playlist-q-history"
            @search="handleSearch"
          />
          </div>

          <div class="relative w-full xl:flex-1 xl:min-w-[200px]">
          <AdminSearchInput
            v-model="filters.owner"
            compact
            placeholder="Người dùng (Tên, email, ID)..."
            icon="person"
            historyKey="admin-playlist-owner-history"
            @search="handleSearch"
          />
          </div>

          <div class="grid grid-cols-2 gap-3 w-full xl:w-auto xl:shrink-0">
          <SearchableCombobox
            v-model="filters.system_key"
            :options="[{ key: 'all', label: 'Tất cả Loại System Key' }, ...systemKeysOptions]"
            valueKey="key"
            labelKey="label"
            placeholder="Tất cả Loại System Key"
            maxHeightClass="max-h-[128px]"
            compact
            class="w-full xl:w-56"
            @change="handleSearch"
          />

          <select v-model="filters.status" class="admin-input !h-9 min-w-0 truncate text-xs w-full xl:w-44 cursor-pointer" @change="handleSearch">
            <option value="all">Tất cả trạng thái</option>
            <option value="need_update">Cần xử lý</option>
            <option value="active">Bình thường</option>
            <option value="empty">Trống bài hát</option>
            <option value="missing_cover">Thiếu ảnh bìa</option>
          </select>
          </div>
          <AdminResetButton @click="resetFilters" class="!h-9 !w-9" />
        </div>
    </div>

    <!-- Bulk Action Bar -->
    <div v-if="selectedPlaylists.length > 0" class="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between mb-3 shadow-sm">
      <div class="flex items-center gap-2 mb-2 sm:mb-0">
        <div class="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{{ selectedPlaylists.length }}</div>
        <span class="text-sm font-semibold text-indigo-900">playlist đã chọn</span>
      </div>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed shadow-sm" title="Tác vụ này chỉ khởi chạy lại pipeline tự động tạo/cập nhật playlist khi dữ liệu bị trống, lỗi hoặc cần bảo trì. Playlist không được quản trị viên tạo thủ công.">Làm mới</button>
        <button class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed shadow-sm" title="Chức năng này sẽ được bổ sung sau.">Cập nhật ảnh bìa</button>
        <button class="px-3 py-1.5 bg-white border border-rose-100 rounded-lg text-sm font-medium text-rose-300 cursor-not-allowed shadow-sm" title="Chức năng này sẽ được bổ sung sau.">Xóa</button>
      </div>
    </div>

    <!-- Bảng danh sách cần xử lý -->
    <AdminTableShell :loading="loading" :empty="!loading && playlists.length === 0" emptyTitle="Không tìm thấy playlist" emptyDescription="Thử thay đổi bộ lọc." maxHeight="375px">
      <table class="w-full text-left text-xs whitespace-nowrap table-fixed">
        <thead class="bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            <th class="px-3 py-2.5 w-[36px] text-center"><input type="checkbox" v-model="selectAll" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"></th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] w-[25%]">Playlist</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] w-[15%]">Người Dùng</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] w-[15%]">Loại / System Key</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] text-right w-[10%]">Số bài</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] w-[15%]">Trạng thái</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] w-[10%]">Cập nhật</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] w-[14%]">Tempo-aware</th>
            <th class="px-3 py-2.5 font-semibold text-black uppercase text-[11px] text-right w-[10%] sticky right-0 bg-slate-50 z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in playlists" :key="item.id" class="hover:bg-slate-50 transition group">
            <td class="px-3 py-2 text-center"><input type="checkbox" :value="item.id" v-model="selectedPlaylists" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"></td>
            <td class="px-3 py-2 truncate">
              <div class="flex items-center gap-3">
                <AdminCoverThumb :src="getPlaylistCover(item)" size="custom" class="w-8 h-8 shrink-0" rounded="lg" />
                <span class="font-semibold text-slate-900 truncate" :title="item.name">{{ item.name }}</span>
              </div>
            </td>
            <td class="px-3 py-2 truncate">
              <router-link v-if="item.user_id" :to="`/admin/users/${item.user_id}`" class="text-primary hover:underline font-medium">
                {{ item.owner_name || 'User #' + item.user_id }}
              </router-link>
              <span v-else class="text-slate-400">Hệ thống</span>
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-2">
                <div class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 border text-slate-600" v-if="item.system_key">{{ item.system_key }}</div>
                <div class="text-[10px] text-slate-500 uppercase font-semibold">{{ item.type }}</div>
              </div>
            </td>
            <td class="px-3 py-2 text-right" :class="{'text-rose-600 font-bold': item.song_count === 0, 'text-slate-700 font-medium': item.song_count > 0}">
              {{ item.song_count }}
            </td>
            <td class="px-3 py-2">
              <span class="status-badge" :class="item.status">{{ formatStatus(item.status) }}</span>
            </td>
            <td class="px-3 py-2 text-[11px] text-slate-500">
              {{ item.updated_at ? new Date(item.updated_at).toLocaleDateString('vi-VN') : 'N/A' }}
            </td>
            <td class="px-3 py-2">
              <div v-if="item.tempoAware" class="flex flex-col gap-0.5">
                <span class="w-max rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-100">Applied</span>
                <span class="text-[10px] text-slate-500">{{ formatBpm(item.avgBpm) }} · {{ formatQualityPercent(item.audioFeatureCoverage?.ratio) }}</span>
              </div>
              <span v-else class="text-[10px] text-slate-400">-</span>
            </td>
            <td class="px-3 py-2 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-10">
              <AdminActionMenu :actions="getToolsActions(item)" />
            </td>
          </tr>
        </tbody>
      </table>
    </AdminTableShell>

    <!-- Pagination -->
    <div v-if="totalPages > 1 || playlists.length > 0" class="flex items-center justify-between mt-1">
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <label>Hiển thị:</label>
        <select v-model="filters.limit" @change="handleLimitChange" class="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>

      <AdminPagination
        :limit="filters.limit"
        :currentPage="currentPage"
        :totalPages="totalPages"
        :disabled="loading"
        @update:currentPage="changePage"
      />
    </div>

    </div> <!-- End Main Content Group -->

    <!-- Modals & Drawers -->
    <ConfirmDialog
      :open="showConfirmModal"
      title="Xác nhận chạy bảo trì nền"
      message="Tác vụ này chỉ khởi chạy lại pipeline tự động tạo/cập nhật playlist. Hệ thống hiện có rất nhiều playlist nên tác vụ có thể mất nhiều phút, sẽ chạy trong nền và không nên dùng khi demo trực tiếp."
      confirmText="Chạy bảo trì nền"
      type="danger"
      @confirm="executeRegenerateAll"
      @cancel="showConfirmModal = false"
    />

    </div> <!-- End px-6 wrapper -->

    <!-- Pipeline Result Modal -->
    <Teleport to="body">
      <div v-if="regenerateResult" class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="closeResultModal">
        <div class="mx-auto flex w-full max-w-xl max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="shrink-0 flex items-center px-6 py-5 border-b border-slate-100 bg-white">
            <h3 class="text-xl font-bold">Kết quả làm mới</h3>
          </header>
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="flex gap-4 mb-4">
              <div class="flex-1 bg-green-50 text-green-700 p-4 rounded-xl text-center">
                <span class="block text-2xl font-bold">{{ regenerateResult.success }}</span>
                <span class="text-xs uppercase opacity-80">Thành công</span>
              </div>
              <div class="flex-1 bg-red-50 text-red-700 p-4 rounded-xl text-center">
                <span class="block text-2xl font-bold">{{ regenerateResult.failed }}</span>
                <span class="text-xs uppercase opacity-80">Thất bại</span>
              </div>
              <div class="flex-1 bg-blue-50 text-blue-700 p-4 rounded-xl text-center">
                <span class="block text-2xl font-bold">{{ regenerateResult.total }}</span>
                <span class="text-xs uppercase opacity-80">Tổng cộng</span>
              </div>
            </div>
            <div v-if="regenerateResult.errors && regenerateResult.errors.length > 0" class="mt-4 bg-slate-50 p-4 rounded-xl">
              <h4 class="font-bold text-slate-800 mb-2">Chi tiết lỗi:</h4>
              <ul class="text-sm text-red-600 space-y-1 pl-4 list-disc">
                <li v-for="(err, idx) in regenerateResult.errors" :key="idx">{{ err }}</li>
              </ul>
            </div>
          </div>
          <footer class="shrink-0 flex justify-end px-6 py-4 border-t border-slate-100 bg-white">
            <button class="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold" @click="closeResultModal">Đóng</button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Modal Chi Tiết Playlist -->
    <Teleport to="body">
      <div v-if="drawerItem" class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="closeDetailModal">
        <div class="mx-auto flex w-full max-w-lg max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="shrink-0 flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
            <h3 class="text-xl font-bold">Chi tiết Playlist</h3>
            <button class="text-gray-400 hover:text-gray-700" @click="closeDetailModal" :disabled="isRegeneratingSingle">
              <MfIcon name="close" size="24" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="w-full aspect-square rounded-xl overflow-hidden mb-6 shadow-md border border-slate-100 bg-slate-50">
              <AdminCoverThumb
                :src="getPlaylistCover(drawerItem)"
                size="custom"
                rounded="lg"
                alt="Cover lớn"
                style="width: 100%; height: 100%; object-fit: cover;"
              />
            </div>
            <h2 class="text-xl font-bold mb-1">{{ drawerItem.name }}</h2>
            <p class="text-sm text-slate-500 mb-4">{{ drawerItem.description || 'Không có mô tả' }}</p>

            <div class="flex flex-col gap-2 text-sm text-slate-700 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div><span class="font-semibold w-28 inline-block">System Key:</span> <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-mono border border-indigo-100">{{ drawerItem.system_key || 'N/A' }}</span></div>
              <div><span class="font-semibold w-28 inline-block">Trạng thái:</span> <span class="status-badge" :class="drawerItem.status">{{ formatStatus(drawerItem.status) }}</span></div>
              <div><span class="font-semibold w-28 inline-block">Số bài hát:</span> <span class="font-mono bg-white px-2 py-0.5 rounded border">{{ drawerItem.song_count }}</span></div>
              <div><span class="font-semibold w-28 inline-block">Cập nhật lúc:</span> {{ drawerItem.updated_at ? new Date(drawerItem.updated_at).toLocaleString('vi-VN') : 'N/A' }}</div>
              <div v-if="drawerItem.tempoAware"><span class="font-semibold w-28 inline-block">Tempo-aware:</span> <span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold border border-emerald-100">Applied</span></div>
              <div v-if="drawerItem.tempoAware"><span class="font-semibold w-28 inline-block">Audio coverage:</span> {{ formatQualityPercent(drawerItem.audioFeatureCoverage?.ratio) }}</div>
              <div v-if="drawerItem.tempoAware"><span class="font-semibold w-28 inline-block">Avg BPM:</span> {{ formatBpm(drawerItem.avgBpm) }}</div>
              <div v-if="drawerItem.tempoAware"><span class="font-semibold w-28 inline-block">Tempo:</span> {{ formatTempoDistribution(drawerItem.tempoDistribution) }}</div>
              <div v-if="drawerItem.user_id"><span class="font-semibold w-28 inline-block">Owner:</span> {{ drawerItem.owner_name || 'User #' + drawerItem.user_id }}</div>
            </div>

            <h4 class="font-bold text-slate-800 mb-3 border-b pb-2">Danh sách bài hát</h4>
            <div v-if="drawerItem.user_id" class="bg-violet-50 border border-violet-100 rounded-xl p-5 flex flex-col items-center text-center gap-3">
              <div>
                <div class="text-violet-900 font-semibold">Quản lý nội bộ theo người dùng</div>
                <div class="text-violet-600 text-sm mt-1">Để xem đầy đủ bài hát, vui lòng mở trang chi tiết người dùng.</div>
              </div>
              <button class="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors mt-2 shadow-sm" @click="goToUserDetail(drawerItem.user_id)">
                <MfIcon name="open_in_new" size="16" />
                Xem tại Admin User Detail
              </button>
            </div>
            <div v-else class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <div class="text-slate-500 text-sm">Không xác định được người dùng sở hữu playlist này.</div>
            </div>
          </div>

          <footer class="shrink-0 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Tác vụ này chỉ khởi chạy lại pipeline tự động tạo/cập nhật playlist khi dữ liệu bị trống, lỗi hoặc cần bảo trì. Playlist không được quản trị viên tạo thủ công." @click="regenerateSingle(drawerItem)" :disabled="isRegeneratingSingle">
              <MfIcon v-if="isRegeneratingSingle" name="sync" class="animate-spin" size="18" />
              <MfIcon v-else name="sync" size="18" />
              {{ isRegeneratingSingle ? 'Đang xử lý...' : 'Làm mới playlist này' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Modal Chi tiết Chất lượng -->
    <Teleport to="body">
      <div v-if="qualityDetailItem" class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="closeQualityDetail">
        <div class="mx-auto flex w-full max-w-3xl max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="shrink-0 p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 class="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MfIcon name="analytics" class="text-indigo-600" />
              Chi tiết Đánh giá: <span class="text-indigo-600 font-mono">{{ qualityDetailItem.system_key }}</span>
            </h3>
            <button class="text-gray-400 hover:text-gray-700" @click="closeQualityDetail">
              <MfIcon name="close" size="24" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div class="px-4 py-2 rounded-lg font-bold text-sm inline-block"
                   :class="{'bg-green-100 text-green-800': qualityDetailItem.status === 'GOOD', 'bg-amber-100 text-amber-800': qualityDetailItem.status === 'WARNING', 'bg-rose-100 text-rose-800': qualityDetailItem.status === 'BAD'}">
                Trạng thái: {{ qualityDetailItem.status === 'GOOD' ? 'Đạt' : qualityDetailItem.status === 'WARNING' ? 'Cảnh báo' : qualityDetailItem.status === 'BAD' ? 'Lỗi' : qualityDetailItem.status }}
              </div>
              <div class="text-sm text-slate-500 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100" v-if="qualityDetailItem.warnings">
                <strong class="text-amber-700">Cảnh báo:</strong> {{ qualityDetailItem.warnings }}
              </div>
            </div>

            <!-- Ngưỡng áp dụng -->
            <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6 text-sm">
              <h4 class="font-bold text-indigo-900 mb-2 border-b border-indigo-100 pb-2">Ngưỡng áp dụng</h4>
              <ul class="list-disc pl-5 text-indigo-800 space-y-1">
                <li>Nghệ sĩ tối đa: <strong>30%</strong> (ổn)</li>
                <li>Thể loại tối đa: <strong>65% hoặc 75%</strong> tùy loại playlist</li>
                <li>Overlap cảnh báo: <strong>70%</strong></li>
                <li>Audio feature coverage cảnh báo: <strong>dưới 95%</strong></li>
              </ul>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm mb-6">
              <div class="border rounded-xl p-4 bg-white shadow-sm">
                <div class="text-slate-500 mb-1">Số bài / Mục tiêu</div>
                <div class="font-mono text-lg font-semibold">{{ qualityDetailItem.actual_songs }} / {{ qualityDetailItem.target_size }}</div>
              </div>
              <div class="border rounded-xl p-4 bg-white shadow-sm">
                <div class="text-slate-500 mb-1">Số bài ứng viên</div>
                <div class="font-mono text-lg font-semibold">{{ qualityDetailItem.candidate_count || 'N/A' }}</div>
              </div>
              <div class="border rounded-xl p-4 bg-white shadow-sm">
                <div class="text-slate-500 mb-1">Đã thêm / Đã xóa</div>
                <div class="font-mono text-lg font-semibold text-green-600">{{ qualityDetailItem.added_songs }} <span class="text-slate-300">/</span> <span class="text-rose-500">{{ qualityDetailItem.removed_songs }}</span></div>
              </div>
              <div class="border rounded-xl p-4 bg-white shadow-sm">
                <div class="text-slate-500 mb-1">Số nghệ sĩ / Thể loại</div>
                <div class="font-mono text-lg font-semibold text-indigo-600">{{ qualityDetailItem.artist_count }} <span class="text-slate-300">/</span> <span class="text-pink-600">{{ qualityDetailItem.genre_count }}</span></div>
              </div>
            </div>

            <h4 class="font-bold text-slate-800 mb-3">Chỉ số chi tiết</h4>
            <div class="overflow-x-auto border border-slate-200 rounded-xl mb-6">
              <table class="w-full text-left text-sm table-fixed">
                <tbody class="divide-y divide-slate-100">
                  <tr>
                    <td class="px-4 py-3 bg-slate-50 font-semibold w-1/2">Tỷ lệ trùng lặp (Overlap)</td>
                    <td class="px-4 py-3 font-mono font-bold">{{ formatQualityPercent(qualityDetailItem.overlap_ratio) }}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 bg-slate-50 font-semibold">Tỷ lệ nghệ sĩ cao nhất (Max)</td>
                    <td class="px-4 py-3 font-mono font-bold">{{ formatQualityPercent(qualityDetailItem.max_same_artist_ratio) }}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 bg-slate-50 font-semibold">Tỷ lệ thể loại cao nhất (Max)</td>
                    <td class="px-4 py-3 font-mono font-bold">{{ formatQualityPercent(qualityDetailItem.max_same_genre_ratio) }}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 bg-slate-50 font-semibold">Độ phủ Audio Feature</td>
                    <td class="px-4 py-3 font-mono font-bold">{{ formatQualityPercent(qualityDetailItem.audio_feature_coverage) }}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 bg-slate-50 font-semibold">Playlist Instance vi phạm đa dạng</td>
                    <td class="px-4 py-3 font-mono font-bold text-rose-600">{{ qualityDetailItem.failed_diversity_playlists || 0 }}</td>
                  </tr>
                  <tr v-if="qualityDetailItem.avg_max_same_artist_ratio">
                    <td class="px-4 py-3 bg-slate-50 font-semibold">Trung bình % nghệ sĩ / Worst</td>
                    <td class="px-4 py-3 font-mono">{{ formatQualityPercent(qualityDetailItem.avg_max_same_artist_ratio) }} / <span class="font-bold text-amber-600">{{ formatQualityPercent(qualityDetailItem.worst_max_same_artist_ratio) }}</span></td>
                  </tr>
                  <tr v-if="qualityDetailItem.avg_max_same_genre_ratio">
                    <td class="px-4 py-3 bg-slate-50 font-semibold">Trung bình % thể loại / Worst</td>
                    <td class="px-4 py-3 font-mono">{{ formatQualityPercent(qualityDetailItem.avg_max_same_genre_ratio) }} / <span class="font-bold text-amber-600">{{ formatQualityPercent(qualityDetailItem.worst_max_same_genre_ratio) }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Công thức chứng minh -->
            <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm">
              <h4 class="font-bold text-indigo-900 mb-2">Công thức chứng minh</h4>
              <ul class="list-disc pl-5 text-indigo-800 space-y-1">
                <li><strong>Tỷ lệ trùng lặp</strong> = số bài trùng playlist cũ / target_size</li>
                <li><strong>Tỷ lệ nghệ sĩ cao nhất</strong> = số bài của nghệ sĩ xuất hiện nhiều nhất / actual_songs</li>
                <li><strong>Tỷ lệ thể loại cao nhất</strong> = số bài của thể loại xuất hiện nhiều nhất / actual_songs</li>
                <li><strong>Độ phủ audio feature</strong> = số bài có audio feature / actual_songs</li>
                <li><strong>Failed diversity</strong> = số playlist instance vượt quota artist/genre</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import AdminCoverThumb from '@/components/admin/AdminCoverThumb.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import { getPlaylistCover } from '@/utils/imageUrl'
import SearchableCombobox from '@/components/common/SearchableCombobox.vue'
import AdminSearchInput from '@/components/admin/AdminSearchInput.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const toast = useToastStore()
const router = useRouter()

// Refs
const summary = ref(null)
const playlists = ref([])
const loading = ref(false)
const totalItems = ref(0)
const totalPages = ref(1)
const currentPage = ref(1)

const showAdvancedSearch = ref(false)


const filters = reactive({
  q: '',
  owner: '',
  system_key: 'all',
  status: 'all', // Mặc định là tất cả
  limit: 20
})

const systemKeysOptions = ref([])

const allowedDistributionKeys = [
  'weekly_mix',
  'moodmix',
  'morning_vibes',
  'afternoon_vibes',
  'evening_vibes',
  'night_vibes',
  'trending_now'
]

const excludedDistributionKeys = [
  'favorite',
  'favorites',
  'favorite_songs',
  'fav',
  'recent',
  'recently_played',
  'top_tracks',
  'weeklymix'
]

const distributionLabelMap = {
  weekly_mix: 'Weekly',
  moodmix: 'Mood',
  morning_vibes: 'Morning',
  afternoon_vibes: 'Afternoon',
  evening_vibes: 'Evening',
  night_vibes: 'Night',
  trending_now: 'Trending'
}

const distributionColorMap = {
  weekly_mix: 'bar-purple',
  moodmix: 'bar-violet',
  morning_vibes: 'bar-emerald',
  afternoon_vibes: 'bar-teal',
  evening_vibes: 'bar-green',
  night_vibes: 'bar-amber',
  trending_now: 'bar-rose'
}

function normalizeDistributionKey(key) {
  if (key === 'weeklymix') return 'weekly_mix'
  return key
}

const distributionChartItems = computed(() => {
  const counts = new Map()

  systemKeysOptions.value.forEach((row) => {
    const normalizedKey = normalizeDistributionKey(row.key)

    if (!normalizedKey) return
    if (excludedDistributionKeys.includes(normalizedKey)) return
    if (!allowedDistributionKeys.includes(normalizedKey)) return

    const current = counts.get(normalizedKey) || 0
    counts.set(normalizedKey, current + Number(row.count || 0))
  })

  const items = allowedDistributionKeys
    .map((key) => ({
      system_key: key,
      label: distributionLabelMap[key],
      count: counts.get(key) || 0,
      colorClass: distributionColorMap[key]
    }))
    .filter((item) => item.count > 0)

  const maxCount = Math.max(...items.map((item) => item.count), 1)

  return items.map((item) => ({
    ...item,
    percent: Math.max(8, Math.round((item.count / maxCount) * 100))
  }))
})

const refreshSystemKeysOptions = computed(() => (
  systemKeysOptions.value
    .filter((item) => item?.isRegeneratable)
    .filter((item) => String(item?.key || '').toLowerCase() !== 'weeklymix')
    .filter((item) => Number(item?.needsRefreshCount || 0) > 0)
))

const isRegeneratingAll = ref(false)
const showConfirmModal = ref(false)
const regenerateResult = ref(null)
const selectedRegenerateKey = ref('')

const openActionMenuId = ref(null)
const drawerItem = ref(null)
const isRegeneratingSingle = ref(false)

const qualityReport = ref(null)
const loadingQuality = ref(false)
const qualityDetailItem = ref(null)

const operationSummary = ref(null)
const activityLogs = ref([])
const loadingOperation = ref(false)
const loadingActivity = ref(false)
const scheduleRows = ref([])
const loadingSchedule = ref(false)
const activeRunId = ref(null)

const runningJobs = computed(() => Number(operationSummary.value?.runningJobs || 0))
const terminalRunStatuses = ['success', 'partial_success', 'failed', 'stale', 'skipped', 'cancelled']
let runPollTimer = null
let requestWatchdogTimer = null
let requestMonitorTimer = null
let lastProgressSignature = null
let lastProgressAt = 0
const operationFailureRateText = computed(() => {
  if (operationSummary.value?.failureRate === null || operationSummary.value?.failureRate === undefined) return null
  return `${(Number(operationSummary.value.failureRate) * 100).toFixed(1).replace(/\.0$/, '')}%`
})
const averageGenerationTimeText = computed(() => {
  if (operationSummary.value?.averageGenerationTimeMs === null || operationSummary.value?.averageGenerationTimeMs === undefined) return null
  return formatDurationMs(operationSummary.value.averageGenerationTimeMs)
})
const lastRegeneratedText = computed(() => formatDateTime(operationSummary.value?.lastRegeneratedAt))

const qualityFilter = ref('all')
const selectedPlaylists = ref([])
const selectAll = ref(false)

const filteredQualityRows = computed(() => {
  if (!qualityReport.value?.rows) return []
  if (qualityFilter.value === 'all') return qualityReport.value.rows
  return qualityReport.value.rows.filter(row => row.status.toLowerCase() === qualityFilter.value)
})

watch(selectAll, (newVal) => {
  if (newVal) {
    selectedPlaylists.value = playlists.value.map(p => p.id)
  } else {
    selectedPlaylists.value = []
  }
})

async function fetchOperationSummary() {
  loadingOperation.value = true
  try {
    const res = await api.get('/admin/system-playlists/operation-summary')
    operationSummary.value = res.data?.data || null
    if (Number(operationSummary.value?.runningJobs || 0) === 0) {
      activeRunId.value = null
      isRegeneratingAll.value = false
      stopRunPolling()
    }
  } catch (err) {
    console.error('Lỗi lấy operation summary:', err)
  } finally {
    loadingOperation.value = false
  }
}

async function fetchActivityLogs() {
  loadingActivity.value = true
  try {
    const res = await api.get('/admin/system-playlists/activity-log')
    activityLogs.value = res.data?.data || []
  } catch (err) {
    console.error('Lỗi lấy activity logs:', err)
  } finally {
    loadingActivity.value = false
  }
}

async function fetchSchedule() {
  loadingSchedule.value = true
  try {
    const res = await api.get('/admin/system-playlists/schedule')
    scheduleRows.value = res.data?.data || []
  } catch (err) {
    console.error('Lỗi lấy lịch trình playlist hệ thống:', err)
  } finally {
    loadingSchedule.value = false
  }
}

function stopRunPolling() {
  if (runPollTimer) clearInterval(runPollTimer)
  runPollTimer = null
}

function stopRequestMonitor() {
  if (requestWatchdogTimer) clearTimeout(requestWatchdogTimer)
  if (requestMonitorTimer) clearInterval(requestMonitorTimer)
  requestWatchdogTimer = null
  requestMonitorTimer = null
}

async function refreshOperationState() {
  await Promise.all([
    fetchOperationSummary(),
    fetchActivityLogs(),
    fetchSchedule()
  ])
}

function updateProgressWatch(run) {
  const signature = [
    run?.status,
    run?.successCount,
    run?.failedCount,
    run?.skippedCount,
    run?.totalPlaylists,
    run?.heartbeatAt
  ].join(':')
  if (signature !== lastProgressSignature) {
    lastProgressSignature = signature
    lastProgressAt = Date.now()
  }
}

async function pollGenerationRun(runId) {
  if (!runId) return
  try {
    const res = await api.get(`/admin/system-playlists/generation-runs/${runId}`)
    const run = res.data?.data
    updateProgressWatch(run)
    await refreshOperationState()

    if (terminalRunStatuses.includes(run?.status)) {
      stopRunPolling()
      isRegeneratingAll.value = false
      activeRunId.value = null
      if (run.status === 'success') toast.showToast('Đã làm mới playlist hệ thống thành công', 'success')
      else if (run.status === 'partial_success') toast.showToast('Đã làm mới một phần, có playlist bị lỗi', 'warning')
      else if (run.status === 'stale') toast.showToast('Tác vụ làm mới bị gián đoạn', 'warning')
      else if (run.status === 'skipped') toast.showToast('Pipeline đã kiểm tra nhưng chưa ghi playlist mới', 'info')
      else if (run.status === 'cancelled') toast.showToast('Tác vụ làm mới đã được hủy', 'info')
      else if (run.status === 'failed') toast.showToast(run.errorMessage || 'Làm mới playlist hệ thống thất bại', 'error')
    } else if (Date.now() - lastProgressAt > 120000) {
      isRegeneratingAll.value = false
      toast.showToast('Tac vu dang chay lau hon du kien. Da tai lai trang thai tu backend.', 'warning')
      lastProgressAt = Date.now()
    }
  } catch (err) {
    stopRunPolling()
    isRegeneratingAll.value = false
    activeRunId.value = null
    await refreshOperationState()
    toast.showToast(err.response?.data?.message || 'Không đọc được trạng thái tác vụ làm mới', 'error')
  }
}

function startRunPolling(runId) {
  stopRunPolling()
  activeRunId.value = runId
  lastProgressSignature = null
  lastProgressAt = Date.now()
  pollGenerationRun(runId)
  runPollTimer = setInterval(() => pollGenerationRun(runId), 5000)
}

function startRequestMonitor() {
  stopRequestMonitor()
  requestMonitorTimer = setInterval(() => {
    refreshOperationState()
  }, 10000)
  requestWatchdogTimer = setTimeout(async () => {
    if (requestMonitorTimer) clearInterval(requestMonitorTimer)
    requestMonitorTimer = null
    isRegeneratingAll.value = false
    await refreshOperationState()
    toast.showToast('Tác vụ làm mới chưa phản hồi sau 2 phút. Đã tải lại trạng thái từ backend.', 'warning')
  }, 120000)
}

async function fetchQualityReport() {
  loadingQuality.value = true
  try {
    const res = await api.get('/admin/system-playlists/quality-report')
    qualityReport.value = res.data?.data || null
  } catch (err) {
    console.error('Lỗi lấy quality report:', err)
  } finally {
    loadingQuality.value = false
  }
}

function formatQualityPercent(val) {
  if (val === null || val === undefined) return 'N/A'
  return `${(Number(val) * 100).toFixed(1).replace(/\.0$/, '')}%`
}

function formatBpm(val) {
  const bpm = Number(val)
  if (!Number.isFinite(bpm) || bpm <= 0) return 'N/A BPM'
  return `${Math.round(bpm)} BPM`
}

function formatTempoDistribution(value) {
  if (!value) return 'N/A'
  const total = ['slow', 'medium', 'fast'].reduce((sum, key) => sum + Number(value[key] || 0), 0)
  if (!total) return 'N/A'
  return ['slow', 'medium', 'fast']
    .map((key) => `${key} ${Math.round((Number(value[key] || 0) / total) * 100)}%`)
    .join(', ')
}

function openQualityDetail(row) {
  qualityDetailItem.value = row
  document.body.style.overflow = 'hidden'
}

function closeQualityDetail() {
  qualityDetailItem.value = null
  if (!drawerItem.value) {
    document.body.style.overflow = ''
  }
}

function closeDetailModal() {
  if (isRegeneratingSingle.value) return;
  drawerItem.value = null;
  document.body.style.overflow = '';
}

const hasActiveFilters = computed(() => {
  return filters.q || filters.owner || filters.system_key !== 'all' || filters.status !== 'all'
})

function percent(value, total) {
  if (!total) return '0%'
  return `${((Number(value || 0) / Number(total)) * 100).toFixed(1)}%`
}

const kpiCards = computed(() => {
  if (!summary.value) return Array(4).fill({})
  const s = summary.value
  const total = s.total_playlists || 0
  const activePlaylists = total - s.empty_playlists - s.missing_cover_playlists

  return [
    {
      title: 'Tổng Playlist',
      value: formatNumber(total),
      subtitle: 'Hệ thống',
      tone: 'purple',
      meta: '100%'
    },
    {
      title: 'Đang Hoạt Động',
      value: formatNumber(activePlaylists),
      subtitle: 'Trạng thái bình thường',
      tone: 'green',
      meta: percent(activePlaylists, total)
    },
    {
      title: 'Playlist Trống',
      value: formatNumber(s.empty_playlists),
      subtitle: '0 bài hát',
      tone: 'amber',
      meta: percent(s.empty_playlists, total),
      onClick: () => setFilter('empty')
    },
    {
      title: 'Thiếu Ảnh Bìa',
      value: formatNumber(s.missing_cover_playlists),
      subtitle: 'Cần cập nhật cover',
      tone: 'rose',
      meta: percent(s.missing_cover_playlists, total),
      onClick: () => setFilter('missing_cover')
    },
  ]
})

// Directive for click outside
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}

// APIs
async function fetchSummary() {
  try {
    const res = await api.get('/admin/system-playlists/summary')
    summary.value = res.data?.data || null
  } catch (err) {
    console.error('Lỗi lấy summary:', err)
  }
}

async function fetchSystemKeys() {
  try {
    const res = await api.get('/admin/system-playlists/system-keys')
    systemKeysOptions.value = res.data?.data || []
    if (
      selectedRegenerateKey.value &&
      !refreshSystemKeysOptions.value.some((item) => item.key === selectedRegenerateKey.value)
    ) {
      selectedRegenerateKey.value = ''
    }
  } catch (err) {
    console.error('Lỗi lấy system keys:', err)
  }
}

async function fetchPlaylists(page = 1) {
  loading.value = true
  try {
    const res = await api.get('/admin/system-playlists', {
      params: { ...filters, page, limit: filters.limit }
    })
    playlists.value = res.data?.data || []
    totalItems.value = res.data?.pagination?.total || 0
    totalPages.value = res.data?.pagination?.totalPages || 1
    currentPage.value = page
  } catch (err) {
    toast.showToast('Lỗi khi tải danh sách playlist', 'error')
  } finally {
    loading.value = false
  }
}

// Actions
let searchTimeout = null
function debounceSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    handleSearch()
  }, 400)
}

function handleSearch() {
  fetchPlaylists(1)
}

function resetFilters() {
  filters.q = ''
  filters.owner = ''
  filters.system_key = 'all'
  filters.status = 'all'
  fetchPlaylists(1)
}

function setFilter(statusFilter) {
  filters.status = statusFilter
  showAdvancedSearch.value = true
  fetchPlaylists(1)
}

function toggleAdvancedSearch() {
  showAdvancedSearch.value = !showAdvancedSearch.value
}

function changePage(p) {
  if (p < 1 || p > totalPages.value) return
  fetchPlaylists(p)
}

function handleLimitChange() {
  fetchPlaylists(1)
}

function toggleActionMenu(id) {
  openActionMenuId.value = openActionMenuId.value === id ? null : id
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function getToolsActions(item) {
  const actions = [
    { label: 'Xem chi tiết', icon: 'visibility', onClick: () => viewDetail(item) }
  ]
  if (item.user_id) {
    actions.push({ label: 'Xem người dùng', icon: 'person', onClick: () => router.push(`/admin/users/${item.user_id}`) })
  }
  actions.push({ label: 'Làm mới playlist này', icon: 'sync', onClick: () => regenerateSingle(item) })
  if (item.system_key) {
    actions.push({ label: 'Sao chép system_key', icon: 'content_copy', onClick: () => copySystemKey(item.system_key) })
  }
  return actions
}

function viewDetail(item) {
  closeActionMenu()
  drawerItem.value = item
  document.body.style.overflow = 'hidden'
}

function goToUserDetail(userId) {
  closeDetailModal()
  router.push(`/admin/users/${userId}`)
}

function copySystemKey(key) {
  closeActionMenu()
  navigator.clipboard.writeText(key)
  toast.showToast('Đã sao chép System Key', 'success')
}

async function regenerateSingle(item) {
  closeActionMenu()
  isRegeneratingSingle.value = true
  toast.showToast('Đang làm mới...', 'info')
  try {
    await api.post(`/admin/system-playlists/${item.id}/regenerate`)
    toast.showToast('Đã làm mới thành công', 'success')
    fetchPlaylists(currentPage.value)
    if (drawerItem.value && drawerItem.value.id === item.id) {
      drawerItem.value = null
      document.body.style.overflow = ''
    }
  } catch (err) {
    toast.showToast(err.response?.data?.message || 'Lỗi khi làm mới', 'error')
  } finally {
    isRegeneratingSingle.value = false
  }
}

function confirmRegenerateAll() {
  if (isRegeneratingAll.value || runningJobs.value > 0) {
    toast.showToast('Đang có pipeline làm mới playlist đang chạy', 'warning')
    return
  }
  showConfirmModal.value = true
}

async function startRegenerateJob(payload, successMessage) {
  isRegeneratingAll.value = true
  startRequestMonitor()
  try {
    const res = await api.post('/admin/system-playlists/regenerate', payload)
    toast.showToast(successMessage || res.data?.message || 'Đã đưa tác vụ làm mới playlist vào hàng chờ', 'info')
    stopRequestMonitor()
    const data = res.data?.data || {}
    regenerateResult.value = {
      success: data.success || 0,
      failed: data.failed || 0,
      skipped: data.skipped || 0,
      total: data.total || 0,
      runId: data.runId || res.data?.run_id,
      status: data.status || 'running'
    }
    const runId = data.runId || res.data?.run_id
    if (runId) {
      startRunPolling(runId)
    }
    await Promise.all([
      fetchSummary(),
      fetchOperationSummary(),
      fetchActivityLogs(),
      fetchSchedule(),
      fetchQualityReport(),
      fetchSystemKeys(),
      fetchPlaylists(1)
    ])
  } catch (err) {
    stopRequestMonitor()
    stopRunPolling()
    activeRunId.value = null
    const errorCode = err.response?.data?.code
    const errorMessage = err.response?.data?.message
    if (errorCode === 'NO_PLAYLIST_NEED_REGENERATE' || errorCode === 'NO_SYSTEM_PLAYLIST_TARGETS') {
      toast.showToast(errorMessage || 'Không có playlist cần làm mới.', 'info')
    } else {
      toast.showToast(errorMessage || 'Lỗi tiến trình làm mới playlist hệ thống', 'error')
    }
    await Promise.all([
      fetchOperationSummary(),
      fetchActivityLogs()
    ])
  } finally {
    if (!activeRunId.value) {
      isRegeneratingAll.value = false
    }
  }
}

async function executeQuickFix() {
  await startRegenerateJob({
    mode: 'quick_fix',
    batchSize: 200,
    concurrency: 2
  }, 'Bắt đầu làm mới nhanh các playlist cần sửa')
}

async function executeRegenerateScope() {
  if (!selectedRegenerateKey.value) {
    toast.showToast('Vui lòng chọn loại playlist cần làm mới', 'warning')
    return
  }
  await startRegenerateJob({
    mode: 'regenerate_scope',
    systemKeys: [selectedRegenerateKey.value],
    batchSize: 200,
    concurrency: 2
  }, `Bắt đầu làm mới ${selectedRegenerateKey.value}`)
}

async function executeRegenerateAll() {
  showConfirmModal.value = false
  await startRegenerateJob({
    mode: 'regenerate_all_background',
    batchSize: 200,
    concurrency: 2
  }, 'Tác vụ bảo trì nền đã được đưa vào hàng chờ')
}

function closeResultModal() {
  regenerateResult.value = null
}

function canResetGenerationRun(log) {
  return isActiveGenerationRun(log)
}

function isActiveGenerationRun(log) {
  return ['queued', 'running', 'cancelling'].includes(log?.status)
}

async function resetGenerationRun(log) {
  if (!log?.id) return
  try {
    const res = await api.post(`/admin/system-playlists/runs/${log.id}/cancel`)
    if (isActiveGenerationRun(log)) {
      activeRunId.value = log.id
      isRegeneratingAll.value = true
      startRunPolling(log.id)
    }
    await refreshOperationState()
    toast.showToast(res.data?.message || 'Đã gửi yêu cầu hủy tác vụ', 'success')
  } catch (err) {
    toast.showToast(err.response?.data?.message || 'Không hủy được tác vụ làm mới', 'error')
  }
}

// Utils
function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatDurationMs(value) {
  const ms = Number(value)
  if (!Number.isFinite(ms) || ms < 0) return null
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

function formatRunProgress(log) {
  const total = Number(log?.totalPlaylists || 0)
  const success = Number(log?.successCount || 0)
  const failed = Number(log?.failedCount || 0)
  const skipped = Number(log?.skippedCount || 0)
  const processed = Number(log?.processedCount ?? (success + failed + skipped))
  if (log?.status === 'running' || log?.status === 'queued') {
    return total > 0 ? `Đang chạy ${processed}/${total}` : 'Đang khởi tạo'
  }
  if (log?.status === 'cancelling') {
    return total > 0 ? `Đang hủy sau batch hiện tại ${processed}/${total}` : 'Đang hủy'
  }
  if (log?.status === 'success') return `Thành công ${success}/${total}`
  if (log?.status === 'partial_success') return `Hoàn tất một phần ${success}/${total}, lỗi ${failed}`
  if (log?.status === 'failed') return failed > 0 ? `Thất bại ${failed}/${total}` : 'Thất bại'
  if (log?.status === 'stale') return 'Bị gián đoạn'
  if (log?.status === 'skipped') {
    if (total > 0 && skipped > 0) return `Pipeline bỏ qua ${skipped}/${total}, chưa ghi playlist mới`
    return 'Không có playlist cần làm mới'
  }
  if (log?.status === 'cancelled') return total > 0 ? `Đã hủy ${processed}/${total}` : 'Đã hủy'
  return total > 0 ? `${success}/${total} thành công` : 'Không có tiến độ'
}

function formatRunStatus(status) {
  const map = {
    success: 'Thành công',
    partial_success: 'Hoàn tất một phần',
    failed: 'Thất bại',
    partial: 'Một phần',
    stale: 'Bị gián đoạn',
    skipped: 'Bỏ qua',
    cancelled: 'Đã hủy',
    queued: 'Đang chờ',
    running: 'Đang chạy',
    cancelling: 'Đang hủy'
  }
  return map[status] || 'Chưa có dữ liệu'
}

function formatScheduleLabel(label) {
  const map = {
    'Thu 2 luc 00:00': 'Thứ 2 lúc 00:00',
    'Thu 3 luc 00:00': 'Thứ 3 lúc 00:00',
    'Thu 4 luc 00:00': 'Thứ 4 lúc 00:00',
    'Thu 5 luc 00:00': 'Thứ 5 lúc 00:00',
    'Thu 6 luc 00:00': 'Thứ 6 lúc 00:00',
    'Thu 7 luc 00:00': 'Thứ 7 lúc 00:00',
    'Chu nhat luc 00:00': 'Chủ nhật lúc 00:00',
    'Hang ngay luc 00:00': 'Hằng ngày lúc 00:00'
  }
  return map[label] || label || 'Chưa có lịch'
}

function formatScheduleStatus(code, fallback) {
  const map = {
    NO_RUN_HISTORY: 'Chưa có lịch sử chạy',
    RUNNING: 'Đang chạy',
    SUCCESS: 'Đã chạy thành công',
    PARTIAL_SUCCESS: 'Hoàn tất một phần',
    SKIPPED: 'Đã kiểm tra, không có mục cần xử lý',
    LAST_RUN_FAILED: 'Lỗi lần chạy gần nhất',
    LAST_RUN_INTERRUPTED: 'Bị gián đoạn',
    RAN_TODAY: 'Đã chạy hôm nay',
    NOT_RUN_TODAY: 'Chưa chạy hôm nay',
    LAST_WEEKLY_RUN_RECORDED: 'Đã ghi nhận lần chạy theo tuần'
  }
  return map[code] || fallback || 'Chưa có dữ liệu'
}

function scheduleStatusClass(code) {
  if (code === 'RUNNING') return 'bg-orange-50 text-orange-700'
  if (code === 'LAST_RUN_FAILED' || code === 'LAST_RUN_INTERRUPTED') return 'bg-rose-50 text-rose-700'
  if (code === 'SUCCESS' || code === 'RAN_TODAY' || code === 'LAST_WEEKLY_RUN_RECORDED') return 'bg-emerald-50 text-emerald-700'
  if (code === 'PARTIAL_SUCCESS') return 'bg-amber-50 text-amber-700'
  if (code === 'SKIPPED') return 'bg-sky-50 text-sky-700'
  return 'bg-slate-100 text-slate-600'
}

function formatTriggerSource(source) {
  const map = {
    scheduler: 'Hệ thống tự động',
    admin: 'Quản trị viên',
    user_lazy: 'Làm mới khi người dùng truy cập',
    recovery: 'Phục hồi hệ thống'
  }
  return map[source] || 'Chưa có'
}

function formatScheduleResult(result) {
  if (!result) return 'Chưa có kết quả'
  if (result.status === 'skipped' && Number(result.total || 0) === 0) return 'Đã kiểm tra, không có mục cần xử lý'
  return `${result.processed || 0}/${result.total || 0} xử lý, thành công ${result.success || 0}, lỗi ${result.failed || 0}, bỏ qua ${result.skipped || 0}`
}

function selectScheduleForMaintenance(row) {
  if (!row?.systemKeys?.length) return
  const firstKey = row.systemKeys[0]
  const option = systemKeysOptions.value.find((item) => row.systemKeys.includes(item.key))
  selectedRegenerateKey.value = option?.key || firstKey
  toast.showToast(`Đã chọn ${row.groupLabel} để làm mới theo loại`, 'info')
}

function formatOperationType(value) {
  const map = {
    regenerate_all: 'Chạy bảo trì nền',
    regenerate_scope: 'Làm mới theo loại',
    system_playlist_regenerate: 'Làm mới playlist hệ thống'
  }
  return map[value] || String(value || 'Tác vụ hệ thống').replaceAll('_', ' ')
}

function runStatusDotClass(status) {
  if (status === 'success') return 'bg-emerald-500'
  if (status === 'partial' || status === 'partial_success') return 'bg-amber-500'
  if (status === 'failed' || status === 'stale') return 'bg-rose-500'
  if (status === 'running' || status === 'queued' || status === 'cancelling') return 'bg-orange-500'
  if (status === 'skipped' || status === 'cancelled') return 'bg-slate-400'
  return 'bg-slate-300'
}

function formatStatus(status) {
  const map = {
    'ok': 'Hoạt động',
    'active': 'Hoạt động',
    'empty': 'Trống',
    'missing_cover': 'Thiếu ảnh bìa'
  }
  return map[status] || status
}

function formatNumber(num) {
  return num ? new Intl.NumberFormat('vi-VN').format(num) : '0'
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    if (drawerItem.value) closeDetailModal();
    if (qualityDetailItem.value) closeQualityDetail();
  }
}

onMounted(() => {
  fetchSummary()
  fetchSystemKeys()
  fetchPlaylists(1)
  fetchQualityReport()
  fetchOperationSummary()
  fetchActivityLogs()
  fetchSchedule()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopRunPolling()
  stopRequestMonitor()
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.maintenance-dashboard {
  background-color: #f8fafc;
  min-height: 100vh;
  color: #0f172a;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
}
.page-subtitle {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

/* Base Components */
.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-action:hover:not(:disabled) {
  background: #f1f5f9;
}
.btn-action.primary {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #ffffff;
}
.btn-action.primary:hover:not(:disabled) {
  background: #6d28d9;
}
.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.btn-icon:hover { background: #f1f5f9; color: #0f172a; }

.panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  margin-bottom: 24px;
}
.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #fdfdfd;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-body { padding: 20px; }

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card.cursor-pointer:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1.4;
}
.stat-value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.1;
  word-break: break-word;
}
.stat-meta { font-size: 12px; color: #94a3b8; }
.text-indigo { color: #7c3aed; }
.text-green { color: #16a34a; }
.text-amber { color: #d97706; }
.text-orange { color: #ea580c; }
.text-blue { color: #2563eb; }

/* Filters */
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}
.filter-group { display: flex; flex-direction: column; gap: 6px; }
.filter-group label { font-size: 13px; font-weight: 600; color: #475569; }
.form-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}
.form-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1); }
.filter-actions { display: flex; gap: 12px; justify-content: flex-end; }
.filter-badge { background: #7c3aed; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 10px; }

/* Alerts */
.alert-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Table */
.table-responsive { overflow-x: auto; }
.admin-table {
  width: 100%;
  border-collapse: collapse;
}
.admin-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  background: #fdfdfd;
  text-transform: uppercase;
  white-space: nowrap;
}
.admin-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  vertical-align: middle;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.status-badge.ok, .status-badge.active { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.status-badge.empty { background: #f1f5f9; color: #64748b; border-color: #cbd5e1; }
.status-badge.missing_cover { background: #fff7ed; color: #ea580c; border-color: #ffedd5; }

.system-key-badge {
  font-family: monospace;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #334155;
  border: 1px solid #e2e8f0;
  display: inline-block;
}

/* Action Menu */
.action-menu-container { position: relative; display: flex; justify-content: center; }
.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  border-radius: 8px;
  z-index: 10;
  width: 200px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #334155;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
}
.dropdown-item:hover { background: #f1f5f9; }

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 16px 20px;
}
.btn-page {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 13px; font-weight: 600; color: #475569; }

/* Modal & Drawers */
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal-content {
  background: white;
  width: 90%;
  max-width: 500px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
.modal-header { padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
.modal-body { padding: 24px; }
.modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }

.result-stats { display: flex; justify-content: space-between; }
.stat-box { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
.stat-box.success { background: #f0fdf4; color: #16a34a; }
.stat-box.failed { background: #fef2f2; color: #dc2626; }
.stat-box.total { background: #f1f5f9; color: #475569; }

/* Detail Modal (Center) */
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.detail-modal-container {
  background: white;
  width: calc(100vw - 32px);
  max-width: 640px;
  max-height: calc(100vh - 64px);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-fade-in 0.2s ease-out;
}

@keyframes modal-fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.detail-modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.detail-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.detail-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.detail-modal-cover {
  width: 200px;
  height: 200px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: #f1f5f9;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.detail-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: center;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(124, 58, 237, 0.2);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Flat Bar Chart CSS */
.playlist-distribution-chart {
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  height: 240px;
  padding: 1rem 0.5rem 0;
  overflow-x: auto;
}

.distribution-bar-item {
  min-width: 72px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.distribution-bar-value {
  font-size: 0.75rem;
  font-weight: 800;
  color: #334155;
  margin-bottom: 0.5rem;
}

.distribution-bar-stage {
  position: relative;
  height: 190px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.distribution-bar-flat {
  position: relative;
  width: 48px;
  min-height: 8px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(var(--bar-color), 0.7) 0%, rgba(var(--bar-color), 0.4) 50%, rgba(var(--bar-color), 0.15) 100%);
  transition: height 0.5s ease, transform 0.2s ease, filter 0.2s ease;
}

.distribution-bar-flat:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
  background: linear-gradient(180deg, rgba(var(--bar-color), 0.8) 0%, rgba(var(--bar-color), 0.5) 50%, rgba(var(--bar-color), 0.2) 100%);
}

.distribution-bar-label {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-align: center;
  line-height: 1.15;
  max-width: 82px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-purple { --bar-color: 139, 92, 246; }
.bar-violet { --bar-color: 167, 139, 250; }
.bar-emerald { --bar-color: 52, 211, 153; }
.bar-teal { --bar-color: 45, 212, 191; }
.bar-green { --bar-color: 74, 222, 128; }
.bar-amber { --bar-color: 251, 191, 36; }
.bar-rose { --bar-color: 251, 113, 133; }
</style>
