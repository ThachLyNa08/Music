require('dotenv').config();

const { pool } = require('../../src/config/database');
const runLogService = require('../../src/services/systemPlaylistRunLog.service');
const {
  getAllSystemPlaylistScheduleRules,
  resolveScheduleRunStatus
} = require('../../src/utils/systemPlaylistSchedule.util');

const STATUS_LABELS = {
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
};

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

async function main() {
  const rules = getAllSystemPlaylistScheduleRules();
  const summary = await runLogService.getScheduleRunSummary(rules.map((rule) => rule.schedulerName));

  console.log('System Playlist Schedule Audit');
  console.log('');

  for (const rule of rules) {
    const item = summary[rule.schedulerName] || {};
    const statusCode = resolveScheduleRunStatus({
      scheduleKey: rule.schedulerName,
      lastRun: item.lastRun,
      lastSuccess: item.lastSuccess
    });

    console.log(rule.groupLabel);
    console.log(`- Schedule: ${rule.label}`);
    console.log(`- Last scheduler run: ${formatDate(item.lastRun?.started_at)}`);
    console.log(`- Last success: ${formatDate(item.lastSuccess?.finished_at)}`);
    console.log(`- Status: ${statusCode} / ${STATUS_LABELS[statusCode] || statusCode}`);
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
