const SCHEDULE_RULES = {
  dailymix_01: {
    schedulerName: 'daily_mix_01',
    systemKeys: ['dailymix_01'],
    groupLabel: 'Daily Mix 01',
    frequency: 'weekly',
    dayOfWeek: 1,
    hour: 0,
    minute: 0,
    label: 'Thứ 2 lúc 00:00'
  },
  dailymix_02: {
    schedulerName: 'daily_mix_02',
    systemKeys: ['dailymix_02'],
    groupLabel: 'Daily Mix 02',
    frequency: 'weekly',
    dayOfWeek: 2,
    hour: 0,
    minute: 0,
    label: 'Thứ 3 lúc 00:00'
  },
  dailymix_03: {
    schedulerName: 'daily_mix_03',
    systemKeys: ['dailymix_03'],
    groupLabel: 'Daily Mix 03',
    frequency: 'weekly',
    dayOfWeek: 3,
    hour: 0,
    minute: 0,
    label: 'Thứ 4 lúc 00:00'
  },
  dailymix_04: {
    schedulerName: 'daily_mix_04',
    systemKeys: ['dailymix_04'],
    groupLabel: 'Daily Mix 04',
    frequency: 'weekly',
    dayOfWeek: 4,
    hour: 0,
    minute: 0,
    label: 'Thứ 5 lúc 00:00'
  },
  dailymix_05: {
    schedulerName: 'daily_mix_05',
    systemKeys: ['dailymix_05'],
    groupLabel: 'Daily Mix 05',
    frequency: 'weekly',
    dayOfWeek: 5,
    hour: 0,
    minute: 0,
    label: 'Thứ 6 lúc 00:00'
  },
  dailymix_06: {
    schedulerName: 'daily_mix_06',
    systemKeys: ['dailymix_06'],
    groupLabel: 'Daily Mix 06',
    frequency: 'weekly',
    dayOfWeek: 6,
    hour: 0,
    minute: 0,
    label: 'Thứ 7 lúc 00:00'
  },
  weekly_mix: {
    schedulerName: 'weekly_mix',
    systemKeys: ['weekly_mix'],
    groupLabel: 'Weekly Mix',
    frequency: 'weekly',
    dayOfWeek: 0,
    hour: 0,
    minute: 0,
    label: 'Chủ nhật lúc 00:00'
  },
  moodmix: {
    schedulerName: 'moodmix',
    systemKeys: ['moodmix'],
    groupLabel: 'Mood Mix',
    frequency: 'daily',
    hour: 0,
    minute: 0,
    label: 'Hằng ngày lúc 00:00'
  },
  vibes: {
    schedulerName: 'vibes',
    systemKeys: ['morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes'],
    groupLabel: 'Vibes',
    frequency: 'daily',
    hour: 0,
    minute: 0,
    label: 'Hằng ngày lúc 00:00'
  },
  trending_now: {
    schedulerName: 'trending_now',
    systemKeys: ['trending_now'],
    groupLabel: 'Trending Now',
    frequency: 'daily',
    hour: 0,
    minute: 0,
    label: 'Hằng ngày lúc 00:00'
  }
};

const SCHEDULE_ROWS = [
  SCHEDULE_RULES.dailymix_01,
  SCHEDULE_RULES.dailymix_02,
  SCHEDULE_RULES.dailymix_03,
  SCHEDULE_RULES.dailymix_04,
  SCHEDULE_RULES.dailymix_05,
  SCHEDULE_RULES.dailymix_06,
  SCHEDULE_RULES.weekly_mix,
  SCHEDULE_RULES.moodmix,
  SCHEDULE_RULES.vibes,
  SCHEDULE_RULES.trending_now
];

function normalizeScheduleKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'daily_mix_01') return 'dailymix_01';
  if (key === 'daily_mix_02') return 'dailymix_02';
  if (key === 'daily_mix_03') return 'dailymix_03';
  if (key === 'daily_mix_04') return 'dailymix_04';
  if (key === 'daily_mix_05') return 'dailymix_05';
  if (key === 'daily_mix_06') return 'dailymix_06';
  if (key === 'weeklymix') return 'weekly_mix';
  return key;
}

function getSystemPlaylistScheduleRule(systemKeyOrSchedulerName) {
  const key = normalizeScheduleKey(systemKeyOrSchedulerName);
  if (SCHEDULE_RULES[key]) return SCHEDULE_RULES[key];
  return SCHEDULE_ROWS.find((rule) => rule.systemKeys.includes(key) || rule.schedulerName === key) || null;
}

function getAllSystemPlaylistScheduleRules() {
  return SCHEDULE_ROWS.map((rule) => ({ ...rule, systemKeys: [...rule.systemKeys] }));
}

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function isRuleDueToday(rule, date = new Date()) {
  const parts = getVietnamDateParts(date);
  if (rule.frequency === 'daily') return true;
  return Number(rule.dayOfWeek) === parts.dayOfWeek;
}

function getDueSystemPlaylistScheduleRules(date = new Date()) {
  return getAllSystemPlaylistScheduleRules().filter((rule) => isRuleDueToday(rule, date));
}

function getScheduledForDateTime(rule, date = new Date()) {
  const parts = getVietnamDateParts(date);
  const hour = String(rule.hour || 0).padStart(2, '0');
  const minute = String(rule.minute || 0).padStart(2, '0');
  return `${parts.dateKey} ${hour}:${minute}:00`;
}

function isSameVietnamDate(value, date = new Date()) {
  if (!value) return false;
  return getVietnamDateParts(new Date(value)).dateKey === getVietnamDateParts(date).dateKey;
}

function resolveScheduleRunStatus({ scheduleKey, lastRun, lastSuccess, today = new Date() }) {
  if (!lastRun) return 'NO_RUN_HISTORY';
  if (lastRun.status === 'running' || lastRun.status === 'queued' || lastRun.status === 'cancelling') return 'RUNNING';
  if (lastRun.status === 'success') return 'SUCCESS';
  if (lastRun.status === 'partial_success' || lastRun.status === 'partial') return 'PARTIAL_SUCCESS';
  if (lastRun.status === 'skipped') return 'SKIPPED';
  if (lastRun.status === 'failed') return 'LAST_RUN_FAILED';
  if (lastRun.status === 'cancelled' || lastRun.status === 'stale') return 'LAST_RUN_INTERRUPTED';
  if (scheduleKey === 'weekly_mix') return 'LAST_WEEKLY_RUN_RECORDED';
  if (isSameVietnamDate(lastSuccess?.finished_at || lastSuccess?.finishedAt, today)) return 'RAN_TODAY';
  return 'NOT_RUN_TODAY';
}

module.exports = {
  getSystemPlaylistScheduleRule,
  getAllSystemPlaylistScheduleRules,
  getDueSystemPlaylistScheduleRules,
  getScheduledForDateTime,
  getVietnamDateParts,
  isSameVietnamDate,
  resolveScheduleRunStatus
};
