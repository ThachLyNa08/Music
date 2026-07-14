<template>
  <teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[9999] report-overlay flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6" @click.self="$emit('close')" role="dialog" aria-modal="true">
      
      <template v-if="isLoading">
        <div class="relative z-10 flex flex-col items-center justify-center p-8 text-center w-full">
          <div class="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-lg">
            <svg class="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 12v4m10-10h-4M6 12H2m16.95-6.95-2.83 2.83M7.88 16.12l-2.83 2.83m13.9 0-2.83-2.83M7.88 7.88 5.05 5.05" />
            </svg>
          </div>
          <h3 class="text-2xl font-bold text-white">AI đang phân tích...</h3>
          <p class="mt-2 text-white/80">{{ loadingText }}</p>
        </div>
      </template>

      <div v-else class="mx-auto flex w-full max-w-[1400px] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60" style="background-color: #f5f5f7;">
        
        <!-- Header cố định -->
        <div class="db-header shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between" style="margin-bottom: 0;">
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold text-slate-800 truncate">Báo cáo phân tích Dashboard</h2>
            <p class="text-sm text-slate-500 mt-1.5 flex items-center">
              Kỳ phân tích: 
              <span class="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md mx-1.5 border border-blue-100/50 shadow-sm">
                {{ periodLabel || '--' }}
              </span> 
              · Nền tảng Âm nhạc
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-4">
            <!-- Nút Tải PDF -->
            <button class="hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center w-10 h-10 rounded-[10px]" @click="downloadPdf" style="background:#dc2626; color:white; border:none; padding: 0;" title="Xuất PDF trang ngang">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>

            <!-- Nút Đóng -->
            <button class="db-close-btn hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center w-10 h-10" @click="$emit('close')" style="padding: 0;" title="Đóng báo cáo">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body cuộn -->
        <div class="flex-1 overflow-y-auto p-6 md:p-8">
          <div class="db-wrapper" style="padding: 0; max-width: 100%;">

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card" v-for="kpi in kpiCards" :key="kpi.label">
            <div class="kpi-label">{{ kpi.label }}</div>
            <div class="kpi-value">{{ kpi.value }}</div>
            <span v-if="kpi.growth" class="kpi-growth" :class="kpi.growth > 0 ? 'up' : 'down'">
              {{ kpi.growth > 0 ? '↑' : '↓' }} {{ Math.abs(kpi.growth) }}%
            </span>
          </div>
        </div>

        <!-- Row 2: Line Chart + Donut -->
        <div class="db-row db-row-2">
          <div class="db-panel flex flex-col">
            <div class="panel-title shrink-0">Xu hướng lượt nghe</div>
            <div class="chart-container flex-1 flex flex-col justify-center min-h-[280px]">
              <svg v-if="safeReport.chartData.trends.length" class="chart-svg" viewBox="0 0 600 280" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stop-color="#0071e3" stop-opacity="0.35" />
                    <stop offset="95%" stop-color="#0071e3" stop-opacity="0" />
                  </linearGradient>
                  <filter id="chart-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="chart-line-glow" x="-10%" y="-20%" width="120%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                <line x1="40" y1="240" x2="580" y2="240" class="chart-grid"/>
                <line x1="40" y1="170" x2="580" y2="170" class="chart-grid"/>
                <line x1="40" y1="100" x2="580" y2="100" class="chart-grid"/>
                <line x1="40" y1="30" x2="580" y2="30" class="chart-grid"/>

                <text x="35" y="245" text-anchor="end" class="chart-text">0</text>
                <text x="35" y="175" text-anchor="end" class="chart-text">{{ formatNumber(maxTrendValue * 0.33) }}</text>
                <text x="35" y="105" text-anchor="end" class="chart-text">{{ formatNumber(maxTrendValue * 0.66) }}</text>
                <text x="35" y="35" text-anchor="end" class="chart-text">{{ formatNumber(maxTrendValue) }}</text>

                <path class="chart-area" :d="trendAreaPath" fill="url(#chart-fill)"/>
                <path class="chart-line" :d="trendPath" filter="url(#chart-line-glow)"/>

                <circle v-for="pt in trendCircles" :key="pt.x" :cx="pt.x" :cy="pt.y" r="4" 
                        class="chart-dot" 
                        filter="url(#chart-dot-glow)"
                        @mouseenter="showTooltip(pt)"
                        @mouseleave="hideTooltip"
                        style="cursor: crosshair;"/>

                <!-- Tooltip -->
                <g v-if="hoveredPoint" class="chart-tooltip-group" style="pointer-events: none;">
                  <rect :x="Math.max(10, Math.min(hoveredPoint.x - 45, 500))" :y="hoveredPoint.y - 45" width="90" height="35" rx="6" fill="#1d1d1f" opacity="0.9" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>
                  <text :x="Math.max(10, Math.min(hoveredPoint.x - 45, 500)) + 45" :y="hoveredPoint.y - 28" fill="#fff" font-size="11" font-weight="600" text-anchor="middle">{{ formatNumber(hoveredPoint.listens) }} lượt</text>
                  <text :x="Math.max(10, Math.min(hoveredPoint.x - 45, 500)) + 45" :y="hoveredPoint.y - 15" fill="#a1a1aa" font-size="10" text-anchor="middle">{{ hoveredPoint.date }}</text>
                </g>

                <!-- Simplified x-axis labels -->
                <text x="40" y="265" text-anchor="middle" class="chart-text">{{ trendLabels[0] }}</text>
                <text x="310" y="265" text-anchor="middle" class="chart-text">{{ trendLabels[Math.floor(trendLabels.length / 2)] }}</text>
                <text x="580" y="265" text-anchor="middle" class="chart-text">{{ trendLabels[trendLabels.length - 1] }}</text>
              </svg>
              <div v-else class="chart-container" style="display:flex;align-items:center;justify-content:center;color:#86868b">
                Chưa có dữ liệu xu hướng
              </div>
            </div>
          </div>

          <AdminGenreDonutChart 
            title="Phân bố thể loại"
            description="Top thể loại theo lượt nghe."
            :data="safeReport.chartData.genres"
            nameKey="name"
            valueKey="listens"
            :centerLabel="totalGenresListens ? formatNumber(totalGenresListens) : '0'"
            centerSubLabel="lượt nghe"
            emptyText="Chưa có đủ dữ liệu thể loại trong kỳ phân tích."
          />
        </div>

        <!-- Row 3: Top Songs + Heatmap -->
        <div class="db-row db-row-2-alt">
          <div class="db-panel">
            <div class="panel-title">Top 5 bài hát hot nhất</div>
            <div v-if="safeReport.chartData.top5Songs.length" class="top-list">
              <div v-for="(song, idx) in safeReport.chartData.top5Songs" :key="song.id" class="top-item">
                <div class="top-rank" :class="{ 'gold': idx === 0 }">{{ idx + 1 }}</div>
                <div class="top-info">
                  <div class="top-name">{{ song.title }}</div>
                  <div class="top-meta">{{ song.artist || 'Không rõ' }}</div>
                </div>
                <div class="top-bar-bg">
                  <div class="top-bar-fill" :style="{ width: getSongBarWidth(song.listens) + '%' }"></div>
                </div>
                <div class="top-count">{{ formatNumber(song.listens) }}</div>
              </div>
            </div>
            <div v-else style="color:#86868b;text-align:center;padding:20px;">Chưa có dữ liệu bài hát</div>
          </div>

          <div class="db-panel">
            <div class="panel-title">Heatmap thời gian nghe · Giờ cao điểm</div>
            <div v-if="safeReport.chartData.heatmap.length" class="heatmap-grid" style="overflow-x:auto;">
              <div></div>
              <div class="heatmap-col-header">T2</div>
              <div class="heatmap-col-header">T3</div>
              <div class="heatmap-col-header">T4</div>
              <div class="heatmap-col-header">T5</div>
              <div class="heatmap-col-header">T6</div>
              <div class="heatmap-col-header">T7</div>
              <div class="heatmap-col-header">CN</div>

              <template v-for="h in [6, 9, 12, 15, 18, 21]" :key="h">
                <div class="heatmap-label">{{ h }}h</div>
                <div v-for="d in [2,3,4,5,6,7,1]" :key="d+'-'+h" 
                     class="heatmap-cell" 
                     :style="{ background: getHeatmapColor(d, h) }"
                     :title="`Thứ ${d===1?'CN':d} - ${h}h: ${getHeatmapValue(d, h)} lượt`">
                </div>
              </template>
            </div>
            <div v-else style="color:#86868b;text-align:center;padding:20px;">Chưa có dữ liệu heatmap</div>
          </div>
        </div>

        <!-- Row 4: Retention + Device + Duration -->
        <div class="db-row db-row-3">
          <div class="db-panel">
            <div class="panel-title">Retention Cohort · Tuần 0–4</div>
            <table v-if="safeReport.chartData.retentionCohorts.length" class="cohort-table">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Tuần 0</th>
                  <th>Tuần 1</th>
                  <th>Tuần 2</th>
                  <th>Tuần 3</th>
                  <th>Tuần 4</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in safeReport.chartData.retentionCohorts" :key="c.week">
                  <td>Tuần {{ c.week }}</td>
                  <td v-for="(val, idx) in c.retention" :key="idx" 
                      class="cohort-cell" :class="getCohortClass(val, c.totalUsers)">
                    {{ c.totalUsers ? Math.round((val / c.totalUsers) * 100) : 0 }}%
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else style="color:#86868b;text-align:center;padding:20px;">Chưa có dữ liệu cohort</div>
          </div>

          <div class="db-panel">
            <div class="panel-title">Chất lượng dữ liệu (Thay thế Platform)</div>
            <div class="bar-chart-container">
              <div class="bar-row">
                <div class="bar-label">Audio</div>
                <div class="bar-track">
                  <div class="bar-fill ios" :style="{ width: getQualityPct('hasAudio') + '%' }">{{ getQualityPct('hasAudio') }}%</div>
                </div>
                <div class="bar-value">{{ safeReport.chartData.dataQuality.hasAudio }}</div>
              </div>
              <div class="bar-row">
                <div class="bar-label">Cover</div>
                <div class="bar-track">
                  <div class="bar-fill android" :style="{ width: getQualityPct('hasCover') + '%' }">{{ getQualityPct('hasCover') }}%</div>
                </div>
                <div class="bar-value">{{ safeReport.chartData.dataQuality.hasCover }}</div>
              </div>
            </div>
            <div style="margin-top:18px; padding-top:14px; border-top:1px solid #f0f0f0;">
              <div style="font-size:12px; color:#86868b; margin-bottom:10px; font-weight:500;">Tổng quan Music Library</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <span style="font-size:12px; padding:4px 10px; border-radius:6px; background:#f5f5f7; color:#1d1d1f;">Tổng số bài hát · {{ safeReport.chartData.dataQuality.totalSongs }}</span>
              </div>
            </div>
          </div>

          <div class="db-panel">
            <div class="panel-title">Thời lượng nghe trung bình</div>
            <div class="duration-grid" style="grid-template-columns: 1fr;">
              <div class="duration-card">
                <div class="dur-label">Trung bình mỗi lượt phát</div>
                <div class="dur-value">{{ formatDurationSecs(safeReport.chartData.durationStats.avgListenSec) }}</div>
                <div class="dur-sub">giây / lượt</div>
              </div>
            </div>
            <div v-if="safeReport.chartData.durationStats.avgListenSec < 30" style="margin-top:16px; padding:12px; border-radius:10px; background:#fff8e1; border:1px solid #ffe082;">
              <div style="font-size:13px; color:#c79100; font-weight:500;">⚠️ Thời lượng phát rất thấp</div>
              <div style="font-size:12px; color:#c79100; margin-top:4px;">Thời lượng trung bình dưới 30s. Người dùng có dấu hiệu skip liên tục hoặc hệ thống phát sinh lỗi gián đoạn.</div>
            </div>
            <div v-else style="margin-top:16px; padding:12px; border-radius:10px; background:#e8f5e9; border:1px solid #c8e6c9;">
              <div style="font-size:13px; color:#1d8f3e; font-weight:500;">✅ Thời lượng ổn định</div>
              <div style="font-size:12px; color:#1d8f3e; margin-top:4px;">Người dùng đang giữ tương tác tốt với các bài hát được phát.</div>
            </div>
          </div>
        </div>

        <!-- Row 5 & 6: Funnel Conversion and Insights -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
          <!-- Phễu chuyển đổi -->
          <div class="db-panel xl:col-span-2 m-0 h-full flex flex-col">
            <div class="panel-title">Phễu chuyển đổi · {{ periodLabel }}</div>
            <div v-if="safeReport.chartData.funnel.length" class="funnel-container">
              <template v-for="(step, idx) in safeReport.chartData.funnel" :key="idx">
                <div class="funnel-step" :class="'s' + (idx + 1)">
                  <div>
                    <div class="step-name">{{ step.step }}</div>
                    <div class="step-rate">{{ getFunnelRate(idx) }}</div>
                  </div>
                  <div class="step-count">{{ formatNumber(step.value) }}</div>
                </div>
                <div v-if="idx < safeReport.chartData.funnel.length - 1" class="funnel-arrow">▼</div>
              </template>
            </div>
            <div v-if="safeReport.chartData.funnel.length" class="funnel-legend">
              <span v-for="(step, idx) in safeReport.chartData.funnel" :key="idx">
                <div class="funnel-legend-dot" :class="'bg-s' + (idx+1)"></div> {{ step.step.split(' ')[0] }}
              </span>
            </div>
            <div v-else style="color:#86868b;text-align:center;padding:20px;">Chưa có dữ liệu phễu chuyển đổi</div>
          </div>

          <!-- Cảnh báo & đề xuất hành động -->
          <div class="db-panel xl:col-span-1 m-0 h-full flex flex-col">
            <div class="panel-title">Cảnh báo & đề xuất hành động</div>
            <div class="insights-list flex-1 overflow-y-auto">
            <div v-for="(warn, idx) in safeReport.warnings" :key="'w'+idx" class="insight-item" style="background: #fff8e1; border-color: #ffe082;">
              <div class="insight-icon" style="background: #ffe082; color: #f57f17;">⚠️</div>
              <div class="insight-text">{{ warn.message || warn }}</div>
            </div>
            <div v-for="(rec, idx) in safeReport.recommendations" :key="'r'+idx" class="insight-item">
              <div class="insight-icon">💡</div>
              <div class="insight-text">{{ rec }}</div>
            </div>
            <div v-if="!safeReport.warnings.length && !safeReport.recommendations.length" class="insight-item">
              <div class="insight-icon">✅</div>
              <div class="insight-text">Hệ thống đang vận hành ổn định. Chưa có cảnh báo nào đáng chú ý.</div>
            </div>
          </div>
        </div>
        </div> <!-- Closes grid -->

        </div> <!-- Closes db-wrapper -->
        </div> <!-- Closes overflow-y-auto -->
      </div> <!-- Closes v-else -->
    </div> <!-- Closes v-if="show" -->
  </teleport>
</template>

<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import AdminGenreDonutChart from '@/components/admin/AdminGenreDonutChart.vue';

const hoveredPoint = ref(null);
const showTooltip = (pt) => { hoveredPoint.value = pt; };
const hideTooltip = () => { hoveredPoint.value = null; };

const props = defineProps({
  show: Boolean,
  isLoading: Boolean,
  report: {
    type: Object,
    default: () => ({})
  },
  periodLabel: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close']);

const loadingText = ref('Đang tổng hợp dữ liệu thật từ DB...');
let loadingTextTimer = null;

const safeReport = computed(() => {
  const raw = props.report || {};
  return {
    kpis: raw.kpis || { totalListens: 0, activeUsers: 0, newUsers: 0, avgCompletionRate: 0, premiumRevenue: 0 },
    chartData: {
      trends: Array.isArray(raw.chartData?.trends) ? raw.chartData.trends : [],
      genres: Array.isArray(raw.chartData?.genres) ? raw.chartData.genres : [],
      top5Songs: Array.isArray(raw.chartData?.top5Songs) ? raw.chartData.top5Songs : [],
      heatmap: Array.isArray(raw.chartData?.heatmap) ? raw.chartData.heatmap : [],
      dataQuality: raw.chartData?.dataQuality || { totalSongs: 0, hasAudio: 0, hasCover: 0 },
      durationStats: raw.chartData?.durationStats || { avgListenSec: 0 },
      retentionCohorts: Array.isArray(raw.chartData?.retentionCohorts) ? raw.chartData.retentionCohorts : [],
      funnel: Array.isArray(raw.chartData?.funnel) ? raw.chartData.funnel : []
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : []
  };
});

const kpiCards = computed(() => [
  { label: 'TỔNG LƯỢT NGHE', value: formatNumber(safeReport.value.kpis.totalListens), growth: 12.4 }, // Static growth mock since DB doesn't have it yet
  { label: 'NGƯỜI DÙNG ACTIVE', value: formatNumber(safeReport.value.kpis.activeUsers), growth: 8.2 },
  { label: 'NGƯỜI DÙNG MỚI', value: `+${formatNumber(safeReport.value.kpis.newUsers)}`, growth: 23.1 },
  { label: 'TỶ LỆ HOÀN THÀNH', value: `${Math.round(safeReport.value.kpis.avgCompletionRate)}%`, growth: -0.8 },
  { label: 'DOANH THU PREMIUM', value: formatMoney(safeReport.value.kpis.premiumRevenue), growth: 5.7 }
]);

// SVG Trend Calculations
const maxTrendValue = computed(() => {
  const trends = safeReport.value.chartData.trends;
  return Math.max(...trends.map(t => t.listens), 1);
});

const trendPath = computed(() => {
  const trends = safeReport.value.chartData.trends;
  if (trends.length === 0) return '';
  const pts = trends.map((t, i) => {
    const x = 40 + (i / Math.max(1, trends.length - 1)) * 540;
    const y = 240 - (t.listens / maxTrendValue.value) * 210;
    return {x, y};
  });
  
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
  }
  return d;
});

const trendAreaPath = computed(() => {
  const path = trendPath.value;
  if (!path) return '';
  return `${path} L580,240 L40,240 Z`;
});

const trendCircles = computed(() => {
  const trends = safeReport.value.chartData.trends;
  if (trends.length === 0) return [];
  return trends.map((t, i) => {
    let dLabel = t.date || '';
    if (dLabel && dLabel.includes('-')) {
      const parts = dLabel.split('-');
      if (parts.length === 3) dLabel = `${parts[2]}/${parts[1]}`;
    }
    return {
      x: 40 + (i / Math.max(1, trends.length - 1)) * 540,
      y: 240 - (t.listens / maxTrendValue.value) * 210,
      listens: t.listens,
      date: dLabel
    };
  });
});

const trendLabels = computed(() => {
  const trends = safeReport.value.chartData.trends;
  return trends.map(t => {
    // try to parse as date if format YYYY-MM-DD
    if (t.date && t.date.includes('-')) {
      const parts = t.date.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    }
    return t.date || '';
  });
});

const totalGenresListens = computed(() => {
  return safeReport.value.chartData.genres.reduce((sum, g) => sum + Number(g.listens || 0), 0);
});

// Top 5 songs width
const getSongBarWidth = (listens) => {
  const top = safeReport.value.chartData.top5Songs;
  if (!top.length) return 0;
  const max = Math.max(...top.map(s => s.listens), 1);
  return (listens / max) * 100;
};

// Heatmap logic
const getHeatmapValue = (d, h) => {
  const item = safeReport.value.chartData.heatmap.find(x => x.dayOfWeek === d && x.hour === h);
  return item ? item.listens : 0;
};
const maxHeatmap = computed(() => {
  const map = safeReport.value.chartData.heatmap;
  return Math.max(...map.map(x => x.listens), 1);
});
const getHeatmapColor = (d, h) => {
  const val = getHeatmapValue(d, h);
  if (val === 0) return 'rgba(0,113,227,0.05)';
  const opacity = Math.max(0.1, val / maxHeatmap.value);
  return `rgba(0,113,227,${opacity})`;
};

// Cohort color map
const getCohortClass = (val, total) => {
  if (!total) return '';
  const pct = val / total;
  if (pct >= 0.5) return 'high';
  if (pct >= 0.25) return 'mid';
  return 'low';
};

// Data Quality Pct
const getQualityPct = (key) => {
  const dq = safeReport.value.chartData.dataQuality;
  if (!dq.totalSongs) return 0;
  return Math.round((dq[key] / dq.totalSongs) * 100);
};

// Funnel logic
const getFunnelRate = (idx) => {
  const funnelArr = safeReport.value.chartData.funnel;
  if (idx === 0) return '100% · Cơ sở';
  const pct = Math.round((funnelArr[idx].value / Math.max(1, funnelArr[idx-1].value)) * 100);
  return `${pct}% chuyển đổi`;
};

watch(() => [props.show, props.isLoading], ([show, loading]) => {
  if (show) document.body.style.overflow = 'hidden';
  else document.body.style.overflow = '';

  if (show && loading) startLoadingText();
  else stopLoadingText();
}, { immediate: true });

function startLoadingText() {
  const texts = [
    'Đang tải dữ liệu thật từ database...',
    'Đang render biểu đồ vector...',
    'Xử lý HTML/CSS Layout...'
  ];
  let index = 0;
  loadingText.value = texts[index];
  stopLoadingText();
  loadingTextTimer = setInterval(() => {
    index = (index + 1) % texts.length;
    loadingText.value = texts[index];
  }, 600);
}

function stopLoadingText() {
  if (loadingTextTimer) {
    clearInterval(loadingTextTimer);
    loadingTextTimer = null;
  }
}

function downloadPdf() {
  const wrapper = document.querySelector('.db-wrapper');
  if (!wrapper) return;

  // Trích xuất Canvas thành Base64 image để không bị mất khi in (VD: Donut Chart)
  const canvases = wrapper.querySelectorAll('canvas');
  const canvasImages = [];
  canvases.forEach((canvas) => {
    canvasImages.push({
      width: canvas.style.width,
      height: canvas.style.height,
      dataUrl: canvas.toDataURL('image/png')
    });
  });

  // Tạo Header riêng cho bản in PDF
  const periodSpan = document.querySelector('.db-header p span');
  const periodText = periodSpan ? periodSpan.innerText : '--';
  const printHeader = `
    <div class="print-header" style="margin-bottom: 24px;">
      <h1 style="font-size: 26px; font-weight: bold; margin-bottom: 8px; color: #1d1d1f; text-align: center;">Báo cáo phân tích Dashboard</h1>
      <div style="font-size: 14px; color: #6e6e73; display: flex; justify-content: space-between; border-bottom: 1.5px solid #e5e5ea; padding-bottom: 16px;">
        <span>Kỳ phân tích: <strong>${periodText}</strong></span>
        <span>Thời gian xuất: ${new Date().toLocaleString('vi-VN')}</span>
      </div>
    </div>
  `;

  const contentHtml = printHeader + wrapper.outerHTML;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép mở cửa sổ pop-up để tải PDF.');
    return;
  }

  let styles = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
    styles += el.outerHTML;
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dashboard_Report</title>
        ${styles}
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .db-wrapper {
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
            padding: 0 !important;
          }
          @media print {
            .db-panel, .kpi-card { 
              break-inside: avoid; 
              page-break-inside: avoid;
            }
            /* Phân trang PDF chuẩn 3 trang */
            .db-row-2, .db-row-3 {
              page-break-after: always;
              break-after: page;
            }
            /* Chống vỡ chữ trên phễu chuyển đổi */
            .funnel-step {
              white-space: nowrap !important;
              min-width: max-content !important;
              padding: 10px 16px !important;
            }
          }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          // Thay thế các thẻ canvas bằng thẻ img mang dữ liệu base64
          const printCanvases = document.querySelectorAll('canvas');
          const imagesData = ${JSON.stringify(canvasImages)};
          printCanvases.forEach((c, idx) => {
            if (imagesData[idx]) {
              const img = document.createElement('img');
              img.src = imagesData[idx].dataUrl;
              img.style.width = imagesData[idx].width || '100%';
              img.style.height = imagesData[idx].height || 'auto';
              img.style.display = 'block';
              img.style.margin = '0 auto';
              c.parentNode.replaceChild(img, c);
            }
          });

          // Kích hoạt in sau khi ảnh được thay thế
          setTimeout(() => {
            window.print();
            window.close();
          }, 800);
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDurationSecs(seconds) {
  if (!seconds) return '0';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

onBeforeUnmount(() => {
  stopLoadingText();
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* COPIED FROM music_dashboard.html */
.report-overlay {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.5;
}
.db-wrapper {
  margin: 0 auto;
}
.db-header {
  /* Di chuyển header ra ngoài layout db-wrapper, để ở đây phòng hờ CSS cũ bị ghi đè */
}
.db-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
}
.db-subtitle {
  font-size: 13px;
  color: #6e6e73;
  margin-top: 4px;
}
.db-close-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  background: #fff;
  color: #1d1d1f;
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}
.db-close-btn:hover {
  background: #f5f5f7;
}

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.kpi-card {
  border: 1px solid #e5e5ea;
  border-radius: 14px;
  padding: 18px;
  background: #fff;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.06);
}
.kpi-label {
  font-size: 12px;
  color: #6e6e73;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.kpi-value {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: #1d1d1f;
}
.kpi-growth {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  margin-top: 10px;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 600;
}
.kpi-growth.up {
  color: #1d8f3e;
  background: #e8f5e9;
}
.kpi-growth.down {
  color: #c62828;
  background: #ffebee;
}

/* Section layout */
.db-row {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}
.db-row-2 { grid-template-columns: 2fr 1fr; }
.db-row-2-alt { grid-template-columns: 1fr 1fr; }
.db-row-3 { grid-template-columns: repeat(3, 1fr); }
.db-panel {
  border: 1px solid #e5e5ea;
  border-radius: 14px;
  padding: 22px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 18px;
  color: #1d1d1f;
}

/* Line Chart */
.chart-container {
  position: relative;
}
.chart-svg {
  width: 100%;
  height: 280px; /* Fixed height to prevent stretching */
  overflow: visible;
}
.chart-line {
  fill: none;
  stroke: #0071e3;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.chart-area {
  /* fill is applied inline via url(#chart-fill) */
}
.chart-grid {
  stroke: #e5e5ea;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.chart-text {
  font-size: 11px;
  fill: #86868b;
}
.chart-dot {
  fill: #0071e3;
  stroke: #ffffff;
  stroke-width: 2;
}

/* Donut Chart */
.donut-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  height: 220px;
  flex-wrap: wrap;
}
.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6e6e73;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-value {
  font-weight: 600;
  color: #1d1d1f;
  margin-left: auto;
  padding-left: 16px;
}

/* Top List */
.top-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.top-item:hover {
  background: #f5f5f7;
}
.top-rank {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #f5f5f7;
  color: #86868b;
  flex-shrink: 0;
}
.top-rank.gold {
  background: #fff8e1;
  color: #f9a825;
}
.top-info {
  flex: 1;
  min-width: 0;
}
.top-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1d1d1f;
}
.top-meta {
  font-size: 11px;
  color: #86868b;
  margin-top: 2px;
}
.top-bar-bg {
  width: 70px;
  height: 5px;
  background: #f5f5f7;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.top-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: #0071e3;
}
.top-count {
  font-size: 12px;
  font-weight: 600;
  color: #6e6e73;
  width: 45px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* Heatmap */
.heatmap-grid {
  display: grid;
  grid-template-columns: 40px repeat(7, 1fr);
  gap: 6px;
}
.heatmap-label {
  font-size: 11px;
  color: #86868b;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
}
.heatmap-col-header {
  font-size: 11px;
  color: #86868b;
  text-align: center;
  padding-bottom: 4px;
}
.heatmap-cell {
  height: 34px;
  border-radius: 6px;
  transition: opacity 0.15s ease;
  cursor: pointer;
}
.heatmap-cell:hover {
  opacity: 0.75;
}

/* Insights */
.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.insight-item {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  background: #f0f7ff;
  border: 1px solid #d0e3ff;
  align-items: flex-start;
}
.insight-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #d0e3ff;
  color: #0071e3;
  flex-shrink: 0;
  font-size: 16px;
}
.insight-text {
  font-size: 14px;
  line-height: 1.6;
  color: #1d1d1f;
}

/* Cohort Table */
.cohort-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.cohort-table th, .cohort-table td {
  padding: 10px 12px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}
.cohort-table th {
  font-weight: 600;
  color: #86868b;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: #fafafa;
}
.cohort-table th:first-child, .cohort-table td:first-child {
  text-align: left;
  font-weight: 500;
  color: #1d1d1f;
}
.cohort-table tr:hover td {
  background: #f9f9fb;
}
.cohort-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.cohort-cell.high { color: #1d8f3e; background: #e8f5e9; border-radius: 6px; }
.cohort-cell.mid { color: #c79100; background: #fff8e1; border-radius: 6px; }
.cohort-cell.low { color: #c62828; background: #ffebee; border-radius: 6px; }

/* Bar Chart (Device/Data) */
.bar-chart-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bar-label {
  width: 60px;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  text-align: right;
  flex-shrink: 0;
}
.bar-track {
  flex: 1;
  height: 28px;
  background: #f5f5f7;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}
.bar-fill {
  height: 100%;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}
.bar-fill.ios { background: #0071e3; }
.bar-fill.android { background: #34c759; }

.bar-value {
  width: 50px;
  font-size: 13px;
  font-weight: 600;
  color: #6e6e73;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* Funnel */
.funnel-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
}
.funnel-step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-radius: 10px;
  color: #fff;
  font-weight: 500;
  font-size: 14px;
  position: relative;
  transition: transform 0.2s ease;
}
.funnel-step:hover {
  transform: scale(1.02);
}
.funnel-step .step-name { font-weight: 600; }
.funnel-step .step-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 16px;
}
.funnel-step .step-rate {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 2px;
}
/* For 4 steps */
.funnel-step.s1 { background: #0071e3; width: 100%; }
.funnel-step.s2 { background: #2997ff; width: 85%; }
.funnel-step.s3 { background: #5ac8fa; width: 55%; }
.funnel-step.s4 { background: #af52de; width: 35%; }
.bg-s1 { background: #0071e3; }
.bg-s2 { background: #2997ff; }
.bg-s3 { background: #5ac8fa; }
.bg-s4 { background: #af52de; }

.funnel-arrow {
  font-size: 18px;
  color: #86868b;
  line-height: 1;
}
.funnel-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 16px;
  font-size: 12px;
  color: #86868b;
}
.funnel-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.funnel-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Listening Duration */
.duration-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.duration-card {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  background: #f9f9fb;
  border: 1px solid #f0f0f0;
}
.duration-card .dur-label {
  font-size: 12px;
  color: #86868b;
  margin-bottom: 6px;
}
.duration-card .dur-value {
  font-size: 22px;
  font-weight: 600;
  color: #1d1d1f;
  font-variant-numeric: tabular-nums;
}
.duration-card .dur-sub {
  font-size: 12px;
  color: #86868b;
  margin-top: 4px;
}

/* Responsive */
@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .db-row-2, .db-row-2-alt, .db-row-3 { grid-template-columns: 1fr; }
  .db-wrapper { padding: 16px; }
  .duration-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .db-header { flex-direction: column; align-items: flex-start; }
  .donut-container { flex-direction: column; height: auto; gap: 16px; padding: 10px 0; }
  .duration-grid { grid-template-columns: 1fr; }
  .cohort-table { font-size: 11px; }
  .cohort-table th, .cohort-table td { padding: 6px 4px; }
}
</style>
