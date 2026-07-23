const { pool } = require('../config/database');
const { tableExists, columnExists } = require('../utils/dbIntrospection');
const { getDashboardQuickOperationsLite } = require('./adminDashboard.service');
const { getWidgetCache } = require('./adminDashboardWidgetCache.service');

const VALID_PRESETS = new Set(['today', 'last7d', 'thisMonth', 'lastMonth', 'custom']);
const DEBUG_DASHBOARD = process.env.DEBUG_DASHBOARD === 'true';
const INSIGHT_DATA_PENDING_MESSAGE = 'Dữ liệu phân tích đang được cập nhật, vui lòng thử lại sau';

function getTzDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
}

function assertDateInput(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    const error = new Error(`${label} không hợp lệ.`);
    error.status = 400;
    throw error;
  }
}

function toSqlDateTime(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + ' ' + [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
}

function toDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDateOnly(value, endOfDay = false) {
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

function getPeriodDates(preset = 'last7d', customFrom, customTo) {
  if (!VALID_PRESETS.has(preset)) {
    const error = new Error('Khoảng thời gian phân tích không hợp lệ.');
    error.status = 400;
    throw error;
  }

  const now = getTzDate();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  let dateFrom;
  let dateTo;

  if (preset === 'today') {
    dateFrom = new Date(now);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo = endOfToday;
  } else if (preset === 'last7d') {
    dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - 6);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo = endOfToday;
  } else if (preset === 'thisMonth') {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    dateTo = endOfToday;
  } else if (preset === 'lastMonth') {
    dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else {
    assertDateInput(customFrom, 'Ngày bắt đầu');
    assertDateInput(customTo, 'Ngày kết thúc');
    if (customFrom > customTo) {
      const error = new Error('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      error.status = 400;
      throw error;
    }
    dateFrom = parseDateOnly(customFrom);
    dateTo = parseDateOnly(customTo, true);
  }

  return {
    from: toSqlDateTime(dateFrom),
    to: toSqlDateTime(dateTo),
    dateFrom: toDateOnly(dateFrom),
    dateTo: toDateOnly(dateTo),
  };
}

function emptyReport(preset, period) {
  return {
    period: { preset, dateFrom: period.dateFrom, dateTo: period.dateTo },
    kpis: {
      totalListens: 0,
      activeUsers: 0,
      newUsers: 0,
      avgCompletionRate: 0,
      premiumRevenue: 0,
    },
    chartData: {
      trends: [],
      genres: [],
      top5Songs: [],
      heatmap: [],
      dataQuality: {
        totalSongs: 0,
        hasAudio: 0,
        hasCover: 0
      },
      durationStats: {
        avgListenSec: 0
      },
      retentionCohorts: [],
      funnel: []
    },
    warnings: [],
    recommendations: [],
  };
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function safeQuery(label, sql, params = [], fallback = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows || fallback;
  } catch (error) {
    if (DEBUG_DASHBOARD) {
      console.warn(`[DashboardInsight] ${label}: ${error.message}`);
    }
    return fallback;
  }
}

function addWarning(report, type, message, level = 'warning') {
  report.warnings.push({ type, level, message });
}

async function queryWithWarning(report, label, sql, params = [], fallback = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows || fallback;
  } catch (error) {
    addWarning(report, label, `${label}: ${error.message}`);
    if (DEBUG_DASHBOARD) {
      console.warn(`[DashboardInsight] ${label}: ${error.message}`);
    }
    return fallback;
  }
}

async function getListeningHistorySchema() {
  if (!(await tableExists('listening_history'))) return { exists: false };

  const [
    hasUserId,
    hasSongId,
    hasListenDuration,
    hasListenedDuration,
    hasCompletionRate,
    hasIsSkip,
    hasSkipped,
    hasCreatedAt,
    hasListenedAt,
    hasSource
  ] = await Promise.all([
    columnExists('listening_history', 'user_id'),
    columnExists('listening_history', 'song_id'),
    columnExists('listening_history', 'listen_duration'),
    columnExists('listening_history', 'listened_duration'),
    columnExists('listening_history', 'completion_rate'),
    columnExists('listening_history', 'is_skip'),
    columnExists('listening_history', 'skipped'),
    columnExists('listening_history', 'created_at'),
    columnExists('listening_history', 'listened_at'),
    columnExists('listening_history', 'source')
  ]);

  return {
    exists: true,
    userColumn: hasUserId ? 'user_id' : null,
    songColumn: hasSongId ? 'song_id' : null,
    durationColumn: hasListenDuration ? 'listen_duration' : (hasListenedDuration ? 'listened_duration' : null),
    completionColumn: hasCompletionRate ? 'completion_rate' : null,
    skipColumn: hasIsSkip ? 'is_skip' : (hasSkipped ? 'skipped' : null),
    dateColumn: hasCreatedAt ? 'created_at' : (hasListenedAt ? 'listened_at' : null),
    hasSource
  };
}

function periodWhere(schema, alias = 'lh') {
  if (!schema.dateColumn) return { sql: '1 = 1', params: [] };
  return { sql: `${alias}.${schema.dateColumn} BETWEEN ? AND ?`, params: null };
}

function normalizeDateOnly(value) {
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }
  return String(value || '');
}

async function analyzeListeningHistoryInsights(report, period) {
  const schema = await getListeningHistorySchema();
  if (!schema.exists) {
    addWarning(report, 'listening_history_missing', 'Thiếu bảng listening_history nên chưa thể tính analytics lượt nghe.', 'info');
    return;
  }
  if (!schema.dateColumn) {
    addWarning(report, 'listening_history_date_missing', 'listening_history thiếu cột thời gian created_at/listened_at nên chưa thể tính heatmap theo kỳ.', 'warning');
    return;
  }

  const where = periodWhere(schema, 'lh');
  const whereParams = [period.from, period.to];
  const totalExpr = 'COUNT(*) AS total_listens';
  const activeExpr = schema.userColumn ? `COUNT(DISTINCT lh.${schema.userColumn}) AS active_users` : 'NULL AS active_users';
  const completionExpr = schema.completionColumn ? `AVG(lh.${schema.completionColumn}) AS avg_completion_rate` : 'NULL AS avg_completion_rate';
  const durationExpr = schema.durationColumn
    ? `AVG(CASE WHEN lh.${schema.durationColumn} IS NOT NULL AND lh.${schema.durationColumn} > 0 THEN lh.${schema.durationColumn} END) AS avg_listen_duration`
    : 'NULL AS avg_listen_duration';

  const kpiRows = await queryWithWarning(report, 'listening_kpis', `
    SELECT ${totalExpr}, ${activeExpr}, ${completionExpr}, ${durationExpr}
    FROM listening_history lh
    WHERE ${where.sql}
  `, whereParams);
  const kpi = kpiRows[0] || {};
  report.kpis.totalListens = numberValue(kpi.total_listens);
  report.kpis.activeUsers = numberValue(kpi.active_users);
  report.kpis.avgCompletionRate = Math.min(Math.max(numberValue(kpi.avg_completion_rate) * 100, 0), 100);
  report.chartData.durationStats = {
    avgListenSec: numberValue(kpi.avg_listen_duration),
    avgListenDurationSeconds: numberValue(kpi.avg_listen_duration)
  };

  const trendRows = await queryWithWarning(report, 'listening_trends', `
    SELECT DATE(lh.${schema.dateColumn}) AS date, COUNT(*) AS listens
    FROM listening_history lh
    WHERE ${where.sql}
    GROUP BY DATE(lh.${schema.dateColumn})
    ORDER BY date ASC
  `, whereParams);
  report.chartData.trends = trendRows.map(row => ({
    date: normalizeDateOnly(row.date),
    listens: numberValue(row.listens)
  }));

  const heatmapRows = await queryWithWarning(report, 'listening_heatmap', `
    SELECT DAYOFWEEK(lh.${schema.dateColumn}) AS day_of_week,
           HOUR(lh.${schema.dateColumn}) AS hour_of_day,
           COUNT(*) AS listen_count
    FROM listening_history lh
    WHERE ${where.sql}
    GROUP BY day_of_week, hour_of_day
    ORDER BY day_of_week ASC, hour_of_day ASC
  `, whereParams);
  report.chartData.heatmap = heatmapRows.map(row => ({
    dayOfWeek: numberValue(row.day_of_week),
    day_of_week: numberValue(row.day_of_week),
    hour: numberValue(row.hour_of_day),
    hour_of_day: numberValue(row.hour_of_day),
    listens: numberValue(row.listen_count),
    listen_count: numberValue(row.listen_count)
  }));

  if (schema.songColumn) {
    const topSongRows = await queryWithWarning(report, 'top_songs', `
      SELECT s.id, s.title, a.name AS artist, COUNT(*) AS listen_count
      FROM listening_history lh
      JOIN songs s ON s.id = lh.${schema.songColumn}
      LEFT JOIN artists a ON a.id = s.artist_id
      WHERE ${where.sql}
      GROUP BY s.id, s.title, a.name
      ORDER BY listen_count DESC
      LIMIT 5
    `, whereParams);
    report.chartData.top5Songs = topSongRows.map(row => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      listens: numberValue(row.listen_count),
      listen_count: numberValue(row.listen_count)
    }));

    const genreRows = await queryWithWarning(report, 'top_genres', `
      SELECT g.id, g.name, COUNT(*) AS listen_count
      FROM listening_history lh
      JOIN songs s ON s.id = lh.${schema.songColumn}
      JOIN genres g ON g.id = s.genre_id
      WHERE s.genre_id IS NOT NULL
        AND ${where.sql}
      GROUP BY g.id, g.name
      ORDER BY listen_count DESC
      LIMIT 5
    `, whereParams);
    report.chartData.genres = genreRows.map(row => ({
      id: row.id,
      name: row.name,
      listen_count: numberValue(row.listen_count),
      listens: numberValue(row.listen_count)
    }));
  } else {
    addWarning(report, 'listening_history_song_missing', 'listening_history thiếu song_id nên chưa thể tính top bài hát và thể loại.', 'warning');
  }

  if (report.kpis.totalListens > 0 && report.chartData.heatmap.length === 0) {
    addWarning(report, 'heatmap_empty', 'Có listening_history trong kỳ nhưng heatmap chưa có dữ liệu. Kiểm tra cột thời gian của listening_history.', 'warning');
  }
  if (report.kpis.totalListens > 0 && report.chartData.top5Songs.length === 0) {
    addWarning(report, 'top_songs_empty', 'Có listening_history trong kỳ nhưng chưa tính được Top 5 bài hát. Kiểm tra listening_history.song_id và songs.id.', 'warning');
  }
  if (report.kpis.totalListens > 0 && report.chartData.genres.length === 0) {
    addWarning(report, 'genres_empty', 'Có listening_history trong kỳ nhưng chưa tính được Top thể loại. Kiểm tra songs.genre_id và genres.id.', 'warning');
  }
  if (schema.durationColumn && report.kpis.totalListens > 0 && report.chartData.durationStats.avgListenSec === 0) {
    addWarning(report, 'duration_empty', `Cột ${schema.durationColumn} chưa có giá trị > 0 trong kỳ phân tích.`, 'info');
  }
}

async function analyzeRetentionCohorts(report, period) {
  const schema = await getListeningHistorySchema();
  if (!schema.exists || !schema.userColumn || !schema.dateColumn || !(await tableExists('users'))) {
    addWarning(report, 'cohort_unavailable', 'Chưa đủ dữ liệu cohort: cần users và listening_history.user_id + cột thời gian.', 'info');
    return;
  }

  const rows = await queryWithWarning(report, 'retention_cohorts', `
    SELECT DATE_FORMAT(u.created_at, '%Y-%m') AS cohort_month,
           COUNT(DISTINCT u.id) AS total_users,
           COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.created_at, lh.${schema.dateColumn}) = 0 THEN u.id END) AS month_0,
           COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.created_at, lh.${schema.dateColumn}) = 1 THEN u.id END) AS month_1,
           COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.created_at, lh.${schema.dateColumn}) = 2 THEN u.id END) AS month_2,
           COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.created_at, lh.${schema.dateColumn}) = 3 THEN u.id END) AS month_3,
           COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.created_at, lh.${schema.dateColumn}) = 4 THEN u.id END) AS month_4
    FROM users u
    LEFT JOIN listening_history lh
      ON lh.${schema.userColumn} = u.id
     AND lh.${schema.dateColumn} >= u.created_at
     AND TIMESTAMPDIFF(MONTH, u.created_at, lh.${schema.dateColumn}) BETWEEN 0 AND 4
    WHERE u.created_at <= ?
      AND (u.role = 'user' OR u.role IS NULL)
    GROUP BY cohort_month
    ORDER BY cohort_month DESC
    LIMIT 5
  `, [period.to]);

  report.chartData.retentionCohorts = rows.map(row => ({
    week: row.cohort_month,
    cohort: row.cohort_month,
    totalUsers: numberValue(row.total_users),
    retention: [
      numberValue(row.month_0),
      numberValue(row.month_1),
      numberValue(row.month_2),
      numberValue(row.month_3),
      numberValue(row.month_4)
    ]
  })).filter(row => row.totalUsers > 0);

  if (!report.chartData.retentionCohorts.length) {
    addWarning(report, 'cohort_empty', 'Chưa có cohort người dùng phù hợp trong kỳ phân tích.', 'info');
  }
}

async function analyzeConversionFunnel(report, period) {
  const schema = await getListeningHistorySchema();
  const steps = [];

  const totalUsers = await queryWithWarning(report, 'funnel_total_users', `
    SELECT COUNT(*) AS total
    FROM users
    WHERE created_at <= ?
      AND (role = 'user' OR role IS NULL)
  `, [period.to]);
  steps.push({ step: 'Tổng người dùng', value: numberValue(totalUsers[0]?.total) });

  if (schema.exists && schema.userColumn && schema.dateColumn) {
    const listenedUsers = await queryWithWarning(report, 'funnel_users_with_listens', `
      SELECT COUNT(DISTINCT lh.${schema.userColumn}) AS total
      FROM listening_history lh
      WHERE lh.${schema.dateColumn} <= ?
    `, [period.to]);
    steps.push({ step: 'Đã nghe nhạc', value: numberValue(listenedUsers[0]?.total) });
  } else {
    addWarning(report, 'funnel_listens_unavailable', 'Chưa đủ dữ liệu phễu: thiếu listening_history.user_id hoặc cột thời gian.', 'info');
  }

  if (await tableExists('song_likes')) {
    const likedUsers = await queryWithWarning(report, 'funnel_users_with_likes', `
      SELECT COUNT(DISTINCT user_id) AS total
      FROM song_likes
    `);
    steps.push({ step: 'Đã thích bài hát', value: numberValue(likedUsers[0]?.total) });
  } else {
    addWarning(report, 'funnel_likes_missing', 'Chưa có bảng song_likes nên bỏ qua bước users_with_likes.', 'info');
  }

  if (await tableExists('playlists')) {
    const playlistUsers = await queryWithWarning(report, 'funnel_users_with_playlists', `
      SELECT COUNT(DISTINCT user_id) AS total
      FROM playlists
      WHERE user_id IS NOT NULL
    `);
    steps.push({ step: 'Đã tạo playlist', value: numberValue(playlistUsers[0]?.total) });
  }

  const premiumUsers = await queryWithWarning(report, 'funnel_premium_users', `
    SELECT COUNT(*) AS total
    FROM users
    WHERE premium_expires_at > NOW()
      AND (role = 'user' OR role IS NULL)
  `);
  steps.push({ step: 'Premium active', value: numberValue(premiumUsers[0]?.total) });

  report.chartData.funnel = steps;
  if (steps.length < 3) {
    addWarning(report, 'funnel_incomplete', 'Chưa đủ dữ liệu phễu chuyển đổi.', 'info');
  }
}

async function analyzeLightDashboardInsights(report, period) {
  const [
    users,
    songs,
    artists,
    albums,
    playlists,
    premiumUsers,
    revenue,
    pendingTransactions,
    newUsers,
    dataQuality
  ] = await Promise.all([
    safeQuery('insight users', 'SELECT COUNT(*) AS total FROM users WHERE role = "user"'),
    safeQuery('insight songs', 'SELECT COUNT(*) AS total FROM songs'),
    safeQuery('insight artists', 'SELECT COUNT(*) AS total FROM artists'),
    safeQuery('insight albums', 'SELECT COUNT(*) AS total FROM albums'),
    safeQuery('insight playlists', 'SELECT COUNT(*) AS total FROM playlists'),
    safeQuery('insight premium users', 'SELECT COUNT(*) AS total FROM users WHERE premium_expires_at > NOW() AND role = "user"'),
    safeQuery('insight revenue', "SELECT COALESCE(SUM(amount), 0) AS total FROM payment_transactions WHERE status = 'paid'"),
    safeQuery('insight pending transactions', "SELECT COUNT(*) AS total FROM payment_transactions WHERE status = 'pending'"),
    safeQuery('insight new users', 'SELECT COUNT(*) AS total FROM users WHERE role = "user" AND created_at BETWEEN ? AND ?', [period.from, period.to]),
    safeQuery('insight data quality', `
      SELECT
        COUNT(*) AS totalSongs,
        SUM(CASE WHEN audio_url IS NOT NULL AND TRIM(audio_url) != '' THEN 1 ELSE 0 END) AS hasAudio,
        SUM(CASE WHEN cover_url IS NOT NULL AND TRIM(cover_url) != '' THEN 1 ELSE 0 END) AS hasCover
      FROM songs
    `)
  ]);

  const [totalListensCache, trendCache, artistCache, genreCache] = await Promise.all([
    getWidgetCache('dashboard_total_listens_cache', 'all'),
    getWidgetCache('dashboard_listening_trends_cache', '7d'),
    getWidgetCache('dashboard_top_artists_cache', '7d'),
    getWidgetCache('dashboard_top_genres_cache', 'all')
  ]);

  const pending = numberValue(pendingTransactions[0]?.total);
  const v4Summary = getDashboardQuickOperationsLite({ pendingTransactions: pending }).aiRecommendation;

  report.kpis = {
    ...report.kpis,
    totalListens: totalListensCache?.payload ? numberValue(totalListensCache.payload.totalListens) : null,
    activeUsers: null,
    newUsers: numberValue(newUsers[0]?.total),
    avgCompletionRate: null,
    premiumRevenue: numberValue(revenue[0]?.total),
    totalUsers: numberValue(users[0]?.total),
    totalSongs: numberValue(songs[0]?.total),
    totalArtists: numberValue(artists[0]?.total),
    totalAlbums: numberValue(albums[0]?.total),
    totalPlaylists: numberValue(playlists[0]?.total),
    premiumUsers: numberValue(premiumUsers[0]?.total),
    revenue: numberValue(revenue[0]?.total),
    pendingTransactions: pending,
  };

  const dq = dataQuality[0] || {};
  report.chartData.dataQuality = {
    totalSongs: numberValue(dq.totalSongs),
    hasAudio: numberValue(dq.hasAudio),
    hasCover: numberValue(dq.hasCover)
  };
  report.chartData.trends = trendCache?.payload?.series || [];
  report.chartData.top5Songs = (trendCache?.payload?.topSongs || []).slice(0, 5);
  report.chartData.genres = genreCache?.payload?.genres || [];
  report.chartData.topArtists = artistCache?.payload?.topArtists || [];

  report.recommendation = v4Summary;
  report.recommendations.push(`Core recommendation hiện tại: ${v4Summary.coreModel || 'LightGCN Hybrid V4'} với ${numberValue(v4Summary.training?.users || v4Summary.training?.trainedUsers)} users và ${numberValue(v4Summary.training?.interactions)} interactions.`);

  const missingAudio = report.chartData.dataQuality.totalSongs - report.chartData.dataQuality.hasAudio;
  const missingCover = report.chartData.dataQuality.totalSongs - report.chartData.dataQuality.hasCover;
  if (missingAudio > 0) {
    report.recommendations.push(`Có ${missingAudio} bài hát thiếu audio, nên ưu tiên xử lý để tránh lỗi phát nhạc.`);
  }
  if (missingCover > 0) {
    report.recommendations.push(`Có ${missingCover} bài hát thiếu ảnh bìa, nên bổ sung để giao diện thư viện đồng đều hơn.`);
  }

  if (report.recommendations.length === 1) {
    report.recommendations.push('Dashboard chính đang dùng KPI nhẹ; các biểu đồ listening sẽ tải bằng widget riêng khi snapshot/cache sẵn sàng.');
  }
  await Promise.all([
    analyzeListeningHistoryInsights(report, period),
    analyzeRetentionCohorts(report, period),
    analyzeConversionFunnel(report, period)
  ]);
}

async function analyzeDashboardInsights(preset = 'last7d', customFrom, customTo) {
  const period = getPeriodDates(preset, customFrom, customTo);
  const report = emptyReport(preset, period);

  await analyzeLightDashboardInsights(report, period);

  return report;
}

module.exports = {
  analyzeDashboardInsights,
  getPeriodDates,
};
