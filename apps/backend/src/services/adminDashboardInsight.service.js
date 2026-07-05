const { pool } = require('../config/database');
const { tableExists, columnExists } = require('../utils/dbIntrospection');

const VALID_PRESETS = new Set(['today', 'last7d', 'thisMonth', 'lastMonth', 'custom']);

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
    console.warn(`[DashboardInsight] ${label}: ${error.message}`);
    return fallback;
  }
}

async function analyzeListening(report, period) {
  if (!(await tableExists('listening_history'))) return;

  const rows = await safeQuery('listening KPI', `
    SELECT COUNT(*) AS total_listens,
           COUNT(DISTINCT user_id) AS active_users,
           AVG(completion_rate) AS avg_completion_rate
    FROM listening_history
    WHERE listened_at BETWEEN ? AND ?
  `, [period.from, period.to]);

  const row = rows[0] || {};
  report.kpis.totalListens = numberValue(row.total_listens);
  report.kpis.activeUsers = numberValue(row.active_users);
  report.kpis.avgCompletionRate = Math.min(Math.max(numberValue(row.avg_completion_rate) * 100, 0), 100);

  // Chart: Trends
  const trends = await safeQuery('trends', `
    SELECT DATE(listened_at) as date, COUNT(*) as listens
    FROM listening_history
    WHERE listened_at BETWEEN ? AND ?
    GROUP BY DATE(listened_at)
    ORDER BY date ASC
  `, [period.from, period.to]);
  report.chartData.trends = trends.map(r => {
    let dateStr = r.date;
    if (r.date instanceof Date) {
        dateStr = [r.date.getFullYear(), String(r.date.getMonth() + 1).padStart(2, '0'), String(r.date.getDate()).padStart(2, '0')].join('-');
    }
    return { date: String(dateStr), listens: numberValue(r.listens) };
  });

  // Chart: Genres
  const genres = await safeQuery('genres', `
    SELECT g.name, COUNT(l.id) as listens
    FROM listening_history l
    JOIN songs s ON l.song_id = s.id
    JOIN genres g ON s.genre_id = g.id
    WHERE l.listened_at BETWEEN ? AND ?
    GROUP BY g.id, g.name
    ORDER BY listens DESC
    LIMIT 5
  `, [period.from, period.to]);
  report.chartData.genres = genres.map(r => ({ name: r.name, listens: numberValue(r.listens) }));

  // Chart: Top 5 Songs
  const top5Songs = await safeQuery('top5Songs', `
    SELECT s.id, s.title, a.name as artist, COUNT(l.id) as listens
    FROM listening_history l
    JOIN songs s ON l.song_id = s.id
    LEFT JOIN artists a ON s.artist_id = a.id
    WHERE l.listened_at BETWEEN ? AND ?
    GROUP BY s.id, s.title, a.name
    ORDER BY listens DESC
    LIMIT 5
  `, [period.from, period.to]);
  report.chartData.top5Songs = top5Songs.map(r => ({ id: r.id, title: r.title, artist: r.artist, listens: numberValue(r.listens) }));

  // Chart: Heatmap
  const heatmap = await safeQuery('heatmap', `
    SELECT DAYOFWEEK(listened_at) as dayOfWeek, HOUR(listened_at) as hour, COUNT(*) as listens
    FROM listening_history
    WHERE listened_at BETWEEN ? AND ?
    GROUP BY dayOfWeek, hour
  `, [period.from, period.to]);
  report.chartData.heatmap = heatmap.map(r => ({ dayOfWeek: r.dayOfWeek, hour: r.hour, listens: numberValue(r.listens) }));

  // Duration Stats
  const durationStats = await safeQuery('durationStats', `
    SELECT AVG(s.duration_sec * l.completion_rate) as avgListenSec
    FROM listening_history l
    JOIN songs s ON l.song_id = s.id
    WHERE l.listened_at BETWEEN ? AND ?
  `, [period.from, period.to]);
  report.chartData.durationStats = {
    avgListenSec: numberValue(durationStats[0]?.avgListenSec)
  };
}

async function analyzeUsers(report, period) {
  if (!(await tableExists('users'))) return;
  const rows = await safeQuery('new users', `
    SELECT COUNT(*) AS new_users
    FROM users
    WHERE created_at BETWEEN ? AND ?
  `, [period.from, period.to]);
  report.kpis.newUsers = numberValue(rows[0]?.new_users);

  // Retention Cohorts (5 weeks)
  const cohorts = await safeQuery('retentionCohorts', `
    SELECT 
      YEARWEEK(u.created_at, 1) as cohort_week,
      MIN(u.created_at) as week_start,
      COUNT(DISTINCT u.id) as total_users,
      COUNT(DISTINCT CASE WHEN lh.listened_at >= u.created_at AND lh.listened_at < DATE_ADD(u.created_at, INTERVAL 1 WEEK) THEN u.id END) as week_0,
      COUNT(DISTINCT CASE WHEN lh.listened_at >= DATE_ADD(u.created_at, INTERVAL 1 WEEK) AND lh.listened_at < DATE_ADD(u.created_at, INTERVAL 2 WEEK) THEN u.id END) as week_1,
      COUNT(DISTINCT CASE WHEN lh.listened_at >= DATE_ADD(u.created_at, INTERVAL 2 WEEK) AND lh.listened_at < DATE_ADD(u.created_at, INTERVAL 3 WEEK) THEN u.id END) as week_2,
      COUNT(DISTINCT CASE WHEN lh.listened_at >= DATE_ADD(u.created_at, INTERVAL 3 WEEK) AND lh.listened_at < DATE_ADD(u.created_at, INTERVAL 4 WEEK) THEN u.id END) as week_3,
      COUNT(DISTINCT CASE WHEN lh.listened_at >= DATE_ADD(u.created_at, INTERVAL 4 WEEK) AND lh.listened_at < DATE_ADD(u.created_at, INTERVAL 5 WEEK) THEN u.id END) as week_4
    FROM users u
    LEFT JOIN listening_history lh ON u.id = lh.user_id
    WHERE u.created_at >= DATE_SUB(?, INTERVAL 5 WEEK) AND u.created_at <= ?
    GROUP BY cohort_week
    ORDER BY cohort_week DESC
    LIMIT 5
  `, [period.to, period.to]);
  
  report.chartData.retentionCohorts = cohorts.map(c => {
    let weekLabel = String(c.week_start);
    if (c.week_start instanceof Date) {
        weekLabel = [c.week_start.getFullYear(), String(c.week_start.getMonth() + 1).padStart(2, '0'), String(c.week_start.getDate()).padStart(2, '0')].join('-');
    }
    return {
      week: weekLabel,
      totalUsers: numberValue(c.total_users),
      retention: [
        numberValue(c.week_0),
        numberValue(c.week_1),
        numberValue(c.week_2),
        numberValue(c.week_3),
        numberValue(c.week_4)
      ]
    };
  });
}

async function analyzePremium(report, period) {
  if (!(await tableExists('payment_transactions'))) return;
  const rows = await safeQuery('premium payments', `
    SELECT COALESCE(SUM(CASE WHEN status IN ('completed', 'paid') THEN amount ELSE 0 END), 0) AS revenue
    FROM payment_transactions
    WHERE created_at BETWEEN ? AND ?
  `, [period.from, period.to]);
  const row = rows[0] || {};
  report.kpis.premiumRevenue = numberValue(row.revenue);
}

async function analyzeFunnel(report, period) {
  const funnelTotalUsers = await safeQuery('funnelTotalUsers', 'SELECT COUNT(*) as count FROM users WHERE created_at <= ?', [period.to]);
  const funnelListens = await safeQuery('funnelListens', 'SELECT COUNT(DISTINCT user_id) as count FROM listening_history WHERE listened_at <= ?', [period.to]);
  const funnelMultListens = await safeQuery('funnelMultListens', 'SELECT COUNT(*) as count FROM (SELECT user_id FROM listening_history WHERE listened_at <= ? GROUP BY user_id HAVING COUNT(*) > 1) as sub', [period.to]);
  const funnelPremium = await safeQuery('funnelPremium', "SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions WHERE status = 'active' AND start_date <= ?", [period.to]);
  
  report.chartData.funnel = [
    { step: 'Truy cập Ứng dụng', value: numberValue(funnelTotalUsers[0]?.count) },
    { step: 'Phát nhạc > 1 bài', value: numberValue(funnelMultListens[0]?.count) },
    { step: 'Đăng ký Tài khoản', value: numberValue(funnelListens[0]?.count) },
    { step: 'Nâng cấp Premium', value: numberValue(funnelPremium[0]?.count) }
  ];
  
  report.chartData.funnel[0].value = numberValue(funnelTotalUsers[0]?.count);
  report.chartData.funnel[1].value = numberValue(funnelMultListens[0]?.count);
  report.chartData.funnel[2].value = numberValue(funnelListens[0]?.count);
  report.chartData.funnel[3].value = numberValue(funnelPremium[0]?.count);
}

async function analyzeWarningsAndQuality(report) {
  if (!(await tableExists('songs'))) return;
  
  const dataQuality = await safeQuery('dataQuality', `
    SELECT 
      COUNT(*) as totalSongs,
      SUM(CASE WHEN audio_url IS NOT NULL AND TRIM(audio_url) != '' THEN 1 ELSE 0 END) as hasAudio,
      SUM(CASE WHEN cover_url IS NOT NULL AND TRIM(cover_url) != '' THEN 1 ELSE 0 END) as hasCover
    FROM songs
  `);
  
  const dq = dataQuality[0] || {};
  report.chartData.dataQuality = {
    totalSongs: numberValue(dq.totalSongs),
    hasAudio: numberValue(dq.hasAudio),
    hasCover: numberValue(dq.hasCover)
  };

  const missingCover = report.chartData.dataQuality.totalSongs - report.chartData.dataQuality.hasCover;
  const missingAudio = report.chartData.dataQuality.totalSongs - report.chartData.dataQuality.hasAudio;
  
  if (missingCover > 0) {
    report.warnings.push({ type: 'missing_data', level: 'warning', message: `Có ${missingCover} bài hát thiếu ảnh bìa. Nên cập nhật để làm đẹp UI.` });
  }
  if (missingAudio > 0) {
    report.warnings.push({ type: 'missing_data', level: 'error', message: `Có ${missingAudio} bài hát thiếu file âm thanh. Cần sửa ngay để tránh lỗi phát nhạc.` });
  }
}

function buildNarrative(report) {
  if (report.kpis.avgCompletionRate >= 80) {
    report.recommendations.push(`Tỷ lệ hoàn thành lượt nghe cao (${Math.round(report.kpis.avgCompletionRate)}%), chất lượng playlist đang đáp ứng tốt thị hiếu.`);
  } else if (report.kpis.avgCompletionRate > 0 && report.kpis.avgCompletionRate < 50) {
    report.recommendations.push(`Tỷ lệ hoàn thành thấp (${Math.round(report.kpis.avgCompletionRate)}%), cần xem xét lại thuật toán gợi ý.`);
  }
  
  if (report.chartData.top5Songs && report.chartData.top5Songs.length > 0) {
    const top = report.chartData.top5Songs[0];
    report.recommendations.push(`Bài hát "${top.title}" đang dẫn đầu. Cân nhắc thêm vào các playlist đề xuất.`);
  }

  if (report.chartData.funnel[3].value === 0 && report.chartData.funnel[0].value > 0) {
     report.recommendations.push(`Chưa có chuyển đổi Premium trong tệp người dùng xét. Cần tung ra chiến dịch khuyến mãi.`);
  }

  if (report.recommendations.length === 0) {
    report.recommendations.push('Hệ thống đang vận hành ổn định trong kỳ phân tích này.');
  }
}

async function analyzeDashboardInsights(preset = 'last7d', customFrom, customTo) {
  const period = getPeriodDates(preset, customFrom, customTo);
  const report = emptyReport(preset, period);

  await analyzeListening(report, period);
  await analyzeUsers(report, period);
  await analyzePremium(report, period);
  await analyzeFunnel(report, period);
  await analyzeWarningsAndQuality(report);
  buildNarrative(report);

  return report;
}

module.exports = {
  analyzeDashboardInsights,
  getPeriodDates,
};
