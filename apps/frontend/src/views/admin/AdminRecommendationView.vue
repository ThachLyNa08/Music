<template>
  <div class="flex-1 flex flex-col bg-gray-50 dark:bg-bg-base relative full-bleed min-h-0 pb-10 font-sans text-gray-800 dark:text-text-base">
    <!-- Header -->
    <header class="sticky -top-6 py-6 bg-white/95 backdrop-blur dark:bg-bg-card/95 border-b border-gray-200 dark:border-bg-border flex flex-col md:flex-row items-start md:items-center justify-between px-6 shrink-0 z-40 shadow-sm">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Recommendation Observatory</h1>
          <span class="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-[11px] font-bold rounded uppercase flex items-center gap-1.5 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ACTIVE
          </span>
        </div>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-sm font-medium">Trung tâm quan sát hiệu suất mô hình gợi ý MusicFlow</p>
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-6 mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span class="flex items-center gap-1.5"><MfIcon name="ai" size="14" /> Core Model: <strong class="text-gray-700 dark:text-gray-300 font-bold">{{ summary?.coreModel || summary?.serving?.strategyLabel || 'LightGCN Hybrid V4' }}</strong></span>
        </div>
      </div>
      <div class="flex gap-2 mt-4 md:mt-0">
        <button class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border text-slate-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-bg-surface transition shadow-sm" title="Làm mới" @click="fetchData(true)" :disabled="loading">
          <MfIcon name="sync" size="20" :class="{ 'animate-spin': loading }" />
        </button>
        <button class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border text-slate-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-bg-surface transition shadow-sm" title="Xuất báo cáo" @click="exportReport" :disabled="exportLoading">
          <MfIcon v-if="exportLoading" name="sync" size="20" class="animate-spin" />
          <MfIcon v-else name="download" size="20" />
        </button>
      </div>
    </header>

    <div class="p-4 md:p-6 flex flex-col gap-6">
      <div v-if="loading && !summary" class="flex flex-col items-center justify-center py-20">
      <div class="spinner"></div>
      <p class="mt-4 text-slate-500">Đang khởi tạo đài quan sát...</p>
    </div>

    <template v-else>
      <!-- Summary Cards for Core Model -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Precision@10</p>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-slate-900">{{ formatMetric(coreMetrics.PrecisionAt10) }}</span>
            <span class="text-sm font-semibold text-emerald-600">{{ formatPercent(coreMetrics.PrecisionAt10) }}</span>
          </div>
          <p class="text-xs text-slate-400 mt-2">Độ chính xác top 10</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">NDCG@10</p>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-slate-900">{{ formatMetric(coreMetrics.NDCGAt10) }}</span>
            <span class="text-sm font-semibold text-emerald-600">{{ formatPercent(coreMetrics.NDCGAt10) }}</span>
          </div>
          <p class="text-xs text-slate-400 mt-2">Chất lượng xếp hạng</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">HitRate@10</p>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-slate-900">{{ formatMetric(coreMetrics.HitRateAt10) }}</span>
            <span class="text-sm font-semibold text-emerald-600">{{ formatPercent(coreMetrics.HitRateAt10) }}</span>
          </div>
          <p class="text-xs text-slate-400 mt-2">Tỷ lệ user được gợi ý đúng</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Coverage@20</p>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-slate-900">{{ formatMetric(coreMetrics.CoverageAt20) }}</span>
            <span class="text-sm font-semibold text-emerald-600">{{ formatPercent(coreMetrics.CoverageAt20) }}</span>
          </div>
          <p class="text-xs text-slate-400 mt-2">Độ phủ danh mục bài hát</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Benchmark users</p>
          <p class="text-2xl font-bold text-slate-900">{{ formatNumber(summary?.benchmarkUsers || summary?.serving?.benchmarkUsers || 2000) }}</p>
          <p class="text-xs text-slate-400 mt-2">Số lượng user được dùng để huấn luyện/đánh giá</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Existing system users</p>
          <p class="text-2xl font-bold text-slate-900">{{ formatNumber(summary?.existingSystemUsers || summary?.serving?.existingSystemUsers || 212) }}</p>
          <p class="text-xs text-slate-400 mt-2">Tổng số tài khoản listener đang hoạt động thực tế</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Serving coverage</p>
          <p class="text-2xl font-bold text-emerald-700">
            {{
              summary?.servingCoverage !== undefined && summary?.eligibleServingUsers !== undefined
                ? `${summary.servingCoverage} / ${summary.eligibleServingUsers}`
                : summary?.serving?.servingCoverage !== undefined && summary?.serving?.eligibleServingUsers !== undefined
                  ? `${summary.serving.servingCoverage} / ${summary.serving.eligibleServingUsers}`
                  : '—'
            }}
            <span v-if="summary?.servingCoverage !== undefined && summary?.eligibleServingUsers" class="text-sm text-emerald-600 ml-1">
              ({{ ((summary.servingCoverage / summary.eligibleServingUsers) * 100).toFixed(2) }}%)
            </span>
            <span v-else-if="summary?.serving?.servingCoverage !== undefined && summary?.serving?.eligibleServingUsers" class="text-sm text-emerald-600 ml-1">
              ({{ ((summary.serving.servingCoverage / summary.serving.eligibleServingUsers) * 100).toFixed(2) }}%)
            </span>
          </p>
          <p class="text-xs text-slate-400 mt-2">Số user được gợi ý trực tiếp bằng mô hình LightGCN</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Fallback Users</p>
          <p class="text-2xl font-bold text-amber-600">
            {{ summary?.fallbackUsers !== undefined ? summary.fallbackUsers : (summary?.serving?.fallbackUsers !== undefined ? summary.serving.fallbackUsers : '—') }}
          </p>
          <p class="text-xs text-slate-400 mt-2">User cold-start hoặc thiếu tương tác (fallback sang CB/Popular)</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Tempo-aware Layer</p>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-2xl font-bold text-slate-900">{{ summary?.tempoAwareLayer?.status || 'Enabled' }}</span>
              <span class="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase text-emerald-800">Audio re-ranking</span>
            </div>
            <p class="text-xs text-slate-400 mt-2">Applied to: {{ (summary?.tempoAwareLayer?.appliedTo || ['Home Recommendation', 'AI Search', 'AI Playlist', 'Similar Songs']).join(', ') }}</p>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted Songs</p>
              <p class="mt-1 font-bold text-slate-900">{{ formatNumber(summary?.tempoAwareLayer?.extractedSongs || 0) }} / {{ formatNumber(summary?.tempoAwareLayer?.totalSongs || 0) }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage</p>
              <p class="mt-1 font-bold text-emerald-700">{{ formatPercent(summary?.tempoAwareLayer?.coverage || 0) }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Features</p>
              <p class="mt-1 font-semibold text-slate-700">{{ (summary?.tempoAwareLayer?.features || ['BPM', 'Beat', 'Energy', 'Danceability']).join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <!-- Training Mode Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div class="px-5 py-4 border-b border-slate-100 bg-blue-50 rounded-t-2xl">
            <h2 class="text-lg font-bold text-blue-950">Chế độ huấn luyện mô hình</h2>
          </div>
          <div class="p-5 flex-1 text-sm text-slate-700 flex flex-col gap-4">
            <p class="leading-relaxed">
              Hệ thống hiện sử dụng cơ chế huấn luyện định kỳ offline. Sau khi script huấn luyện hoàn tất, model artifact mới được lưu lại và backend sử dụng artifact này để phục vụ đề xuất cá nhân hóa theo thời gian thực.
            </p>
            <div class="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900 leading-relaxed">
              Serving real-time từ model đã huấn luyện; MVP chưa bật job retrain tự động qua API.
            </div>
            <div class="space-y-3 mt-auto">
              <div class="flex justify-between gap-4">
                <span class="font-medium text-slate-500">Serving Model:</span>
                <span class="font-semibold text-right text-slate-900">{{ summary?.coreModel || summary?.serving?.strategyLabel || 'LightGCN Hybrid V4' }}</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="font-medium text-slate-500">Artifact path:</span>
                <span class="text-xs text-right text-slate-500 break-all" :title="summary?.serving?.path || summary?.artifactPath">{{ formatPath(summary?.serving?.path || summary?.artifactPath) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-t border-blue-100 pt-3">
                <span class="font-medium text-slate-500">Fallback policy:</span>
                <span class="font-semibold text-right text-amber-700 whitespace-nowrap">{{ summary?.fallbackPolicy || summary?.serving?.fallbackPolicy || 'Content-Based V4 → Most Popular V4' }}</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="font-medium text-slate-500">Trạng thái:</span>
                <span
                  class="px-2 py-1 rounded-full text-[11px] font-bold uppercase"
                  :class="summary?.hasArtifact !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
                >
                  {{ summary?.hasArtifact !== false ? 'ACTIVE' : 'MISSING ARTIFACT' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Model Status Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div class="px-5 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 class="text-lg font-bold text-slate-800">Trạng thái mô hình</h2>
          </div>
          <div class="p-5 flex-1 text-sm text-slate-600 flex flex-col">
            <div class="flex justify-between items-center mb-4">
              <span class="font-medium text-slate-500">Chiến lược đang dùng:</span>
              <div class="flex flex-col items-end">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900">{{ formatStrategyName(summary?.strategy || 'lightgcn_hybrid_v4') }}</span>
                  <span v-if="summary?.strategy && summary.strategy.includes('fallback')" class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">
                    Đang dùng fallback
                  </span>
                </div>
                <span class="text-[10px] text-slate-400 mt-0.5">Mã chiến lược: {{ summary?.strategy || 'lightgcn_hybrid_v4' }}</span>
              </div>
            </div>
            <div class="flex justify-between items-center mb-4">
              <span class="font-medium text-slate-500">Artifact path:</span>
              <span class="text-xs text-slate-500 truncate ml-4" :title="summary?.artifactPath">{{ formatPath(summary?.artifactPath) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="font-medium text-slate-500">Cập nhật lúc:</span>
              <span class="font-medium">{{ summary?.updatedAt ? formatDate(summary.updatedAt) : '—' }}</span>
            </div>

            <hr class="border-slate-100 my-4">

            <template v-if="summary?.hasArtifact">
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Trained Users:</span>
                  <span class="font-medium">{{ modelMetadata?.trainedUsers ?? '—' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Trained Items:</span>
                  <span class="font-medium">{{ modelMetadata?.trainedItems ?? '—' }}</span>
                </div>
                <div class="flex justify-between items-center" v-if="modelMetadata?.dim !== undefined && modelMetadata?.dim !== null">
                  <span class="font-medium text-slate-500">{{ modelMetadata.dimLabel }}:</span>
                  <span class="font-medium">{{ modelMetadata.dim }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium text-slate-500">Epochs:</span>
                  <span class="font-medium">{{ modelMetadata?.epochs ?? '—' }}</span>
                </div>
              </div>
            </template>
            <div v-else class="flex-1 bg-slate-50 rounded-xl p-5 border border-slate-100 text-center flex flex-col justify-center mt-2">
              <MfIcon name="info" size="32" class="text-slate-400 mx-auto mb-2" />
              <h3 class="font-bold text-slate-700 mb-1">Chưa có metadata model</h3>
              <p class="text-xs text-slate-500 mb-4 leading-relaxed">
                Hệ thống hiện đang dùng chiến lược fallback để đảm bảo vẫn có gợi ý cho người dùng.
                Bạn có thể kiểm tra artifact model hoặc chạy lại pipeline huấn luyện nếu cần.
              </p>
            </div>
          </div>
        </div>

        <!-- Fallback Strategy Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-slate-100 bg-amber-50">
            <h2 class="text-lg font-bold text-amber-900">Chiến lược Fallback V4</h2>
          </div>
          <div class="p-5 flex-1 text-sm text-slate-700">
            <p class="mb-3">Hệ thống gợi ý sử dụng cơ chế fallback đa tầng trong hệ sinh thái V4 để đảm bảo luôn có kết quả phù hợp cho user:</p>
            <ul class="list-disc pl-5 space-y-2 mb-4">
              <li>
                <strong class="text-slate-900">Direct:</strong> <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">LightGCN Hybrid V4</code> via the V4 serving artifact keyed by db_user_id.
              </li>
              <li>
                <strong class="text-slate-900">Fallback 1:</strong> <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">Content-Based V4</code>
              </li>
              <li>
                <strong class="text-slate-900">Fallback 2:</strong> <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">Most Popular V4</code>
              </li>
              <li>
                <strong class="text-slate-900">Legacy:</strong> <code class="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs">V3 disabled</code>
              </li>
            </ul>
              <strong class="text-slate-900 block mb-2">Quy tắc bổ sung (Rules):</strong>
              <div class="text-xs text-slate-600 space-y-1">
                <p>- Artist Cap (tránh lặp quá nhiều bài của 1 nghệ sĩ)</p>
                <p>- Market Strict Rule (ưu tiên nhạc cùng thị trường với gu nghe)</p>
              </div>
            </div>
          </div>
      </div>

      <!-- Chart Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <!-- 1. Accuracy Metrics Comparison -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <AdminBarChart
            title="Accuracy Metrics Comparison"
            :labels="['Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10']"
            :datasets="accuracyChartData.datasets"
            :isPercent="true"
          />
        </div>

        <!-- 2. Coverage Comparison -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <AdminBarChart
            title="Coverage@20 Comparison"
            :labels="coverageChartData.labels"
            :datasets="coverageChartData.datasets"
            :isPercent="true"
          />
        </div>

        <!-- 3. Diversity Comparison -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <AdminBarChart
            title="Diversity Comparison @ 20"
            :labels="['ArtistDiversity@20', 'GenreDiversity@20']"
            :datasets="diversityChartData.datasets"
            :isPercent="true"
          />
        </div>

        <!-- 4. Novelty Comparison -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <AdminBarChart
            title="Novelty@20 Comparison"
            :labels="noveltyChartData.labels"
            :datasets="noveltyChartData.datasets"
            :isPercent="true"
            :yMin="0.8"
            :yMax="1.0"
          />
        </div>

        <!-- 5. BPR-MF vs LightGCN Radar -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <AdminRadarChart
            title="LightGCN Hybrid vs BPR-MF Hybrid"
            :labels="['Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10', 'Coverage@20']"
            :datasets="radarChartData.datasets"
          />
        </div>

        <!-- 6. Normalized Loss Comparison -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h3 class="text-sm font-semibold text-slate-800 font-sans mb-1 text-center">Normalized Training Loss Comparison</h3>
          <p class="text-[10px] text-slate-400 text-center mb-3">Normalized loss is used for trend comparison only.</p>
          <div v-if="!hasTrainingHistory" class="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
            <MfIcon name="activity" size="40" class="text-slate-300 mb-3" />
            <p class="text-slate-500 font-medium text-sm">Chưa có dữ liệu loss.</p>
          </div>
          <div v-else class="flex-1">
            <AdminLineChart
              title=""
              :labels="normalizedLossChartData.labels"
              :datasets="normalizedLossChartData.datasets"
            />
          </div>
        </div>
      </div>

      <!-- Training Loss Explanation -->
      <div class="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 shadow-sm">
        <div class="flex items-start gap-3">
          <MfIcon name="info" size="20" class="text-indigo-500 shrink-0 mt-0.5" />
          <p>
            <strong>Training loss</strong> chỉ phản ánh quá trình tối ưu của từng mô hình. Do BPR-MF và LightGCN có hàm loss và scale khác nhau, không so sánh trực tiếp giá trị loss tuyệt đối giữa hai mô hình. Hiệu quả cuối cùng được đánh giá bằng Precision@10, Recall@10, NDCG@10, HitRate@10 và Coverage@20.
          </p>
        </div>
      </div>

      <!-- Evaluation Metrics Table -->
      <div class="mt-8">
        <h2 class="text-xl font-bold text-slate-800 mb-4">Đánh giá chi tiết (Metrics Table)</h2>

        <div v-if="!summary?.hasMetrics" class="bg-white py-8 px-5 rounded-2xl border border-slate-200 text-center shadow-sm">
          <MfIcon name="analytics" size="48" class="text-slate-300 mx-auto mb-3" />
          <h3 class="text-lg font-semibold text-slate-700">Chưa có dữ liệu đánh giá</h3>
          <p class="text-slate-500 mt-1">Hãy chạy script evaluation để tạo metrics trước khi hiển thị.</p>
        </div>

        <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative">
          <table class="min-w-full divide-y divide-slate-200 text-xs">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-900 w-1/4">
                  Metric
                </th>
                <th
                  v-for="modelName in modelOrder"
                  :key="modelName"
                  class="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-900"
                  :class="modelName === activeModelName ? 'bg-emerald-50 text-emerald-900' : ''"
                >
                  <div class="flex flex-col items-center gap-0.5">
                    <span>{{ modelName }}</span>
                    <span
                      v-if="modelName === activeModelName"
                      class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 uppercase"
                    >
                      Core Model
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in metricRows" :key="row.key" class="hover:bg-slate-50/50">
                <td class="px-3 py-2">
                  <p class="text-xs font-semibold text-slate-800">{{ row.label }}</p>
                  <p class="text-[10px] text-slate-500 mt-0.5">{{ row.description }}</p>
                </td>
                <td
                  v-for="modelName in modelOrder"
                  :key="`${modelName}-${row.key}`"
                  class="px-3 py-2 text-center text-xs font-bold text-slate-900"
                  :class="modelName === activeModelName ? 'bg-emerald-50/60 text-emerald-700' : ''"
                >
                  {{ formatMetricTableValue(getModelByName(modelName), row.key) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>Users in Benchmark: <strong>{{ summary?.users || 2000 }}</strong></span>
            <span>Interactions: <strong>{{ summary?.interactions || 603435 }}</strong></span>
          </div>
        </div>
      </div>
    </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import { useToastStore } from '@/stores/toast'
import MfIcon from '@/components/common/MfIcon.vue'
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob'

import AdminBarChart from '@/components/admin/charts/AdminBarChart.vue'
import AdminLineChart from '@/components/admin/charts/AdminLineChart.vue'
import AdminRadarChart from '@/components/admin/charts/AdminRadarChart.vue'

const router = useRouter()
const toast = useToastStore()

const summary = ref(null)
const loading = ref(true)
const exportLoading = ref(false)

onMounted(() => {
  fetchData()
})

async function fetchData(showToastSuccess = false) {
  loading.value = true
  try {
    const sumRes = await api.get('/admin/recommendation/summary')
    if (sumRes.data?.success) {
      summary.value = sumRes.data.data
      if (showToastSuccess) {
        toast.showToast('Làm mới dữ liệu thành công!', 'success')
      }
    }
  } catch (err) {
    console.error('Error loading recommendation data:', err)
    toast.showToast('Không thể tải dữ liệu observatory', 'error')
  } finally {
    loading.value = false
  }
}

// Data Mapping Helpers
const metricAliases = {
  'Precision@10': ['Precision@10', 'precisionAt10', 'precision_10', 'precision'],
  'Recall@10': ['Recall@10', 'recallAt10', 'recall_10', 'recall'],
  'NDCG@10': ['NDCG@10', 'ndcgAt10', 'NDCGAt10', 'ndcg_10', 'ndcg'],
  'HitRate@10': ['HitRate@10', 'hitRateAt10', 'hitrateAt10', 'hit_rate_10', 'hitRate'],
  'Coverage@20': ['Coverage@20', 'coverageAt20', 'coverage_20', 'coverage'],
  'ArtistDiversity@20': ['ArtistDiversity@20', 'artistDiversityAt20', 'artist_diversity_20'],
  'GenreDiversity@20': ['GenreDiversity@20', 'genreDiversityAt20', 'genre_diversity_20'],
  'Novelty@20': ['Novelty@20', 'noveltyAt20', 'novelty_20', 'novelty']
};

const isValidValue = (value) => {
  return !(value === null || value === undefined || Number.isNaN(Number(value)));
};

const getMetricValue = (modelObj, metricKey) => {
  if (!modelObj) return null;

  const aliases = metricAliases[metricKey] || [
    metricKey,
    metricKey.replace('@', 'At').replace(/^\w/, c => c.toLowerCase()),
    metricKey.replace('@', '_at_').toLowerCase()
  ];

  // 1. Kiểm tra trực tiếp trong modelObj
  for (const alias of aliases) {
    const val = modelObj[alias];
    if (isValidValue(val)) return Number(val);
  }

  // 2. Fallback tìm trong global metrics
  const mName = modelObj.name || modelObj.key;
  if (mName && summary.value?.metrics) {
    const globalMetrics = summary.value.metrics;

    for (const alias of aliases) {
      // Dạng metrics[modelName][metricKey]
      if (globalMetrics[mName] && isValidValue(globalMetrics[mName][alias])) {
        return Number(globalMetrics[mName][alias]);
      }
      // Dạng metrics[metricKey][modelName]
      if (globalMetrics[alias] && isValidValue(globalMetrics[alias][mName])) {
        return Number(globalMetrics[alias][mName]);
      }
    }

    // Dạng metrics.models[modelName][metricKey] và metrics.comparison[modelName][metricKey]
    const nestedObjs = [globalMetrics.models, globalMetrics.comparison];
    for (const nestedObj of nestedObjs) {
      if (nestedObj && nestedObj[mName]) {
        for (const alias of aliases) {
          if (isValidValue(nestedObj[mName][alias])) {
            return Number(nestedObj[mName][alias]);
          }
        }
      }
    }
  }

  return null;
}

const formatMetric = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(3)
}

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return ''
  return `${(Number(value) * 100).toFixed(2)}%`
}

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('vi-VN')
}

const formatMetricTableValue = (modelObj, metricKey) => {
  const val = getMetricValue(modelObj, metricKey);
  if (val === null) return '—';
  return `${formatMetric(val)} (${formatPercent(val)})`;
}

// Chart Constants
const modelOrder = ['Most Popular', 'Content-Based', 'BPR-MF Hybrid', 'LightGCN Hybrid'];
const modelColors = {
  'Most Popular': '#94a3b8', // slate-400
  'Content-Based': '#3b82f6', // blue-500
  'BPR-MF Hybrid': '#f97316', // orange-500
  'LightGCN Hybrid': '#10b981' // emerald-500
};

const activeModelName = computed(() => summary.value?.activeModel || 'LightGCN Hybrid');

const getModelByName = (name) => {
  if (!summary.value?.metricsComparison) return null;
  // Handle edge cases where backend key mapping might be weird, but try exact name first
  const exact = summary.value.metricsComparison.find(m => m.name === name);
  if (exact) return exact;

  // Fallback heuristic based on key prefix
  const prefix = name.toLowerCase().split(' ')[0];
  return summary.value.metricsComparison.find(m => m.key.includes(prefix));
}

// Computed Core Metrics for KPI Cards
const coreMetrics = computed(() => {
  const model = getModelByName(activeModelName.value);
  return {
    PrecisionAt10: getMetricValue(model, 'Precision@10'),
    NDCGAt10: getMetricValue(model, 'NDCG@10'),
    HitRateAt10: getMetricValue(model, 'HitRate@10'),
    CoverageAt20: getMetricValue(model, 'Coverage@20')
  };
});

const modelMetadata = computed(() => {
  if (!summary.value) return null;
  const training = summary.value.training || {};
  const model = summary.value.model || {};

  const trainedUsers = training.trainedUsers || training.users || model.num_users || model.n_users;
  const trainedItems = training.trainedItems || training.items || model.num_items || model.n_items;
  const epochs = training.epochs || model.epochs || model.num_epochs;
  const dim = training.embeddingDim || training.latentFactors || model.embedding_dim || model.factors;

  const isLightGCN = summary.value?.coreModel?.toLowerCase().includes('lightgcn') || summary.value?.strategy?.toLowerCase().includes('lightgcn');
  const dimLabel = isLightGCN ? 'Embedding Dim' : 'Latent Factors';

  return {
    trainedUsers,
    trainedItems,
    epochs,
    dim,
    dimLabel
  };
});

// Chart 1: Accuracy
const accuracyChartData = computed(() => {
  const labels = ['Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10'];
  const datasets = modelOrder.map(name => {
    const m = getModelByName(name);
    return {
      label: name,
      backgroundColor: modelColors[name],
      data: labels.map(lbl => m ? getMetricValue(m, lbl) || 0 : 0)
    };
  });
  return { datasets };
});

// Chart 2: Coverage
const coverageChartData = computed(() => {
  const labels = modelOrder;
  const datasets = [{
    label: 'Coverage@20',
    backgroundColor: labels.map(name => modelColors[name]),
    data: labels.map(name => {
      const m = getModelByName(name);
      return m ? getMetricValue(m, 'Coverage@20') || 0 : 0;
    })
  }];
  return { labels, datasets };
});

// Chart 3: Diversity
const diversityChartData = computed(() => {
  const labels = ['ArtistDiversity@20', 'GenreDiversity@20'];
  const datasets = modelOrder.map(name => {
    const m = getModelByName(name);
    return {
      label: name,
      backgroundColor: modelColors[name],
      data: labels.map(lbl => m ? getMetricValue(m, lbl) || 0 : 0)
    };
  });
  return { datasets };
});

// Chart 4: Novelty
const noveltyChartData = computed(() => {
  const labels = modelOrder;
  const datasets = [{
    label: 'Novelty@20',
    backgroundColor: labels.map(name => modelColors[name]),
    data: labels.map(name => {
      const m = getModelByName(name);
      return m ? getMetricValue(m, 'Novelty@20') || 0 : 0;
    })
  }];
  return { labels, datasets };
});

// Chart 5: Radar
const radarChartData = computed(() => {
  const targetModels = ['BPR-MF Hybrid', 'LightGCN Hybrid'];
  const labels = ['Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10', 'Coverage@20'];

  const datasets = targetModels.map(name => {
    const m = getModelByName(name);
    const color = modelColors[name];
    // Convert hex to rgba for fill
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return {
      label: name,
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
      borderColor: color,
      pointBackgroundColor: color,
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: color,
      data: labels.map(lbl => m ? getMetricValue(m, lbl) || 0 : 0)
    };
  });

  return { datasets };
});

// Chart 6: Training Loss
const hasTrainingHistory = computed(() => {
  const th = summary.value?.trainingHistory;
  return th && (
    (th.lightgcn && th.lightgcn.length > 0) ||
    (th.bprMf && th.bprMf.length > 0)
  );
});

const bprLossChartData = computed(() => {
  const th = summary.value?.trainingHistory;
  if (!th || !th.bprMf || th.bprMf.length === 0) return { labels: [], datasets: [] };
  const bpr = th.bprMf;
  return {
    labels: Array.from({ length: bpr.length }, (_, i) => `Epoch ${i + 1}`),
    datasets: [{
      label: 'BPR-MF Loss',
      borderColor: modelColors['BPR-MF Hybrid'],
      backgroundColor: 'transparent',
      data: bpr.map(item => item.loss),
      tension: 0.1
    }]
  };
});

const lightgcnLossChartData = computed(() => {
  const th = summary.value?.trainingHistory;
  if (!th || !th.lightgcn || th.lightgcn.length === 0) return { labels: [], datasets: [] };
  const lgcn = th.lightgcn;
  return {
    labels: Array.from({ length: lgcn.length }, (_, i) => `Epoch ${i + 1}`),
    datasets: [{
      label: 'LightGCN Loss',
      borderColor: modelColors['LightGCN Hybrid'],
      backgroundColor: 'transparent',
      data: lgcn.map(item => item.loss),
      tension: 0.1
    }]
  };
});

const normalizedLossChartData = computed(() => {
  const th = summary.value?.trainingHistory;
  if (!th) return { labels: [], datasets: [] };

  const lgcn = th.lightgcn || [];
  const bpr = th.bprMf || [];

  const maxEpochs = Math.max(lgcn.length, bpr.length);
  const labels = Array.from({ length: maxEpochs }, (_, i) => `Epoch ${i + 1}`);

  const normalize = (data) => {
    if (!data.length) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    if (max === min) return data.map(() => 0);
    return data.map(val => (val - min) / (max - min));
  };

  const datasets = [];

  if (bpr.length > 0) {
    datasets.push({
      label: 'BPR-MF (Normalized)',
      borderColor: modelColors['BPR-MF Hybrid'],
      backgroundColor: 'transparent',
      data: normalize(bpr.map(item => item.loss)),
      tension: 0.1
    });
  }

  if (lgcn.length > 0) {
    datasets.push({
      label: 'LightGCN (Normalized)',
      borderColor: modelColors['LightGCN Hybrid'],
      backgroundColor: 'transparent',
      data: normalize(lgcn.map(item => item.loss)),
      tension: 0.1
    });
  }

  return { labels, datasets };
});

// Table Definitions
const metricRows = [
  { key: 'Precision@10', label: 'Precision@10', description: 'Tỷ lệ bài đúng / Top 10' },
  { key: 'Recall@10', label: 'Recall@10', description: 'Tỷ lệ thu hồi / Top 10' },
  { key: 'NDCG@10', label: 'NDCG@10', description: 'Chất lượng xếp hạng (DCG/IDCG)' },
  { key: 'HitRate@10', label: 'HitRate@10', description: 'Tỷ lệ user có ít nhất 1 bài đúng' },
  { key: 'Coverage@20', label: 'Coverage@20', description: 'Độ phủ kho nhạc' },
  { key: 'ArtistDiversity@20', label: 'ArtistDiversity@20', description: 'Đa dạng nghệ sĩ (ILS)' },
  { key: 'GenreDiversity@20', label: 'GenreDiversity@20', description: 'Đa dạng thể loại' },
  { key: 'Novelty@20', label: 'Novelty@20', description: 'Điểm mới lạ (dựa trên mức phổ biến)' }
];

async function exportReport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/recommendation/export', { responseType: 'blob' })
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'recommendation_metrics_report.json'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    console.error('Export error:', error)
    if (error.response?.status === 404) {
      toast.showToast('Không tìm thấy báo cáo', 'error')
    } else {
      toast.showToast('Không thể xuất báo cáo. Vui lòng thử lại.', 'error')
    }
  } finally {
    exportLoading.value = false
  }
}

// Additional formatting helpers restored for the detail cards
function formatStrategyName(str) {
  if (!str) return '—'
  const strategyLabelMap = {
    lightgcn_hybrid_v4: 'LightGCN Hybrid V4',
    bpr_mf_rerank: 'BPR-MF cá nhân hóa',
    bpr_mf: 'BPR-MF',
    content_based_fallback: 'Fallback theo nội dung',
    popular_fallback: 'Fallback phổ biến',
    cold_start_preferences: 'Dựa trên sở thích ban đầu'
  }
  return strategyLabelMap[str] || str
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatPath(fullPath) {
  if (!fullPath) return 'Không có'
  const parts = fullPath.split(/[/\\]/)
  if (parts.length <= 3) return fullPath
  return '.../' + parts.slice(-3).join('/')
}
</script>

<style scoped>
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0,0,0,0.1);
  border-radius: 50%;
  border-top-color: #6366f1;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
