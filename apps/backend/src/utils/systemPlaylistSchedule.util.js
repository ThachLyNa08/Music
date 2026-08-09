const SCHEDULE_RULES = {
  dailymix_01: {
    schedulerName: 'daily_mix_01',
    systemKeys: ['dailymix_01'],
    groupLabel: 'Daily Mix 01',
    frequency: 'weekly',
    dayOfWeek: 1,
    hour: 0,
    minute: 0,
    label: 'Thu 2 luc 00:00'
  },
  dailymix_02: {
    schedulerName: 'daily_mix_02',
    systemKeys: ['dailymix_02'],
    groupLabel: 'Daily Mix 02',
    frequency: 'weekly',
    dayOfWeek: 2,
    hour: 0,
    minute: 0,
    label: 'Thu 3 luc 00:00'
  },
  dailymix_03: {
    schedulerName: 'daily_mix_03',
    systemKeys: ['dailymix_03'],
    groupLabel: 'Daily Mix 03',
    frequency: 'weekly',
    dayOfWeek: 3,
    hour: 0,
    minute: 0,
    label: 'Thu 4 luc 00:00'
  },
  dailymix_04: {
    schedulerName: 'daily_mix_04',
    systemKeys: ['dailymix_04'],
    groupLabel: 'Daily Mix 04',
    frequency: 'weekly',
    dayOfWeek: 4,
    hour: 0,
    minute: 0,
    label: 'Thu 5 luc 00:00'
  },
  dailymix_05: {
    schedulerName: 'daily_mix_05',
    systemKeys: ['dailymix_05'],
    groupLabel: 'Daily Mix 05',
    frequency: 'weekly',
    dayOfWeek: 5,
    hour: 0,
    minute: 0,
    label: 'Thu 6 luc 00:00'
  },
  dailymix_06: {
    schedulerName: 'daily_mix_06',
    systemKeys: ['dailymix_06'],
    groupLabel: 'Daily Mix 06',
    frequency: 'weekly',
    dayOfWeek: 6,
    hour: 0,
    minute: 0,
    label: 'Thu 7 luc 00:00'
  },
  weekly_mix: {
    schedulerName: 'weekly_mix',
    systemKeys: ['weekly_mix'],
    groupLabel: 'Weekly Mix',
    frequency: 'weekly',
    dayOfWeek: 0,
    hour: 0,
    minute: 0,
    label: 'Chu nhat luc 00:00'
  },
  moodmix: {
    schedulerName: 'moodmix',
    systemKeys: ['moodmix'],
    groupLabel: 'Mood Mix',
    frequency: 'daily',
    hour: 0,
    minute: 0,
    label: 'Hang ngay luc 00:00'
  },
  vibes: {
    schedulerName: 'vibes',
    systemKeys: ['morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes'],
    groupLabel: 'Vibes',
    frequency: 'daily',
    hour: 0,
    minute: 0,
    label: 'Hang ngay luc 00:00'
  },
  trending_now: {
    schedulerName: 'trending_now',
    systemKeys: ['trending_now'],
    groupLabel: 'Trending Now',
    frequency: 'daily',
    hour: 0,
    minute: 0,
    label: 'Hang ngay luc 00:00'
  }
};

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

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

function getVietnamDateParts(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDateTime(parts, hour = 0, minute = 0, second = 0) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function shiftVietnamDateParts(parts, dayOffset = 0, timezone = DEFAULT_TIMEZONE) {
  const utcNoon = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + Number(dayOffset || 0), 5, 0, 0);
  return getVietnamDateParts(new Date(utcNoon), timezone);
}

function getClosedAnalysisWindow(scheduleKey, runAt = new Date(), timezone = DEFAULT_TIMEZONE) {
  const rule = getSystemPlaylistScheduleRule(scheduleKey);
  const key = rule?.schedulerName || normalizeScheduleKey(scheduleKey);
  const runParts = getVietnamDateParts(runAt, timezone);
  const days = key === 'weekly_mix' ? 7 : 1;
  const startParts = shiftVietnamDateParts(runParts, -days, timezone);

  return {
    scheduleKey: key,
    timezone,
    analysisStart: formatLocalDateTime(startParts, 0, 0, 0),
    analysisEnd: formatLocalDateTime(runParts, 0, 0, 0),
    sourceStartDate: `${startParts.year}-${pad2(startParts.month)}-${pad2(startParts.day)}`,
    sourceEndDate: `${runParts.year}-${pad2(runParts.month)}-${pad2(runParts.day)}`,
    lookbackDays: days
  };
}

function isRuleDueToday(rule, date = new Date()) {
  const parts = getVietnamDateParts(date);
  if (rule.frequency !== 'daily' && Number(rule.dayOfWeek) !== parts.dayOfWeek) return false;
  const scheduledMinutes = Number(rule.hour || 0) * 60 + Number(rule.minute || 0);
  const currentMinutes = Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
  return currentMinutes >= scheduledMinutes;
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

function isScheduledForDue(scheduledFor, date = new Date()) {
  if (!scheduledFor) return false;
  const scheduled = new Date(scheduledFor);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled <= date;
}

function isRunForScheduledOccurrence(lastRun, scheduledFor) {
  if (!lastRun || !scheduledFor) return false;
  const scheduled = new Date(scheduledFor);
  const runScheduledFor = lastRun.scheduled_for || lastRun.scheduledFor || null;
  const runReference = runScheduledFor || lastRun.finished_at || lastRun.finishedAt || lastRun.started_at || lastRun.startedAt;
  if (!runReference) return false;
  const runDate = new Date(runReference);
  if (Number.isNaN(scheduled.getTime()) || Number.isNaN(runDate.getTime())) return false;
  return runDate >= scheduled;
}

function resolveScheduleRunStatus({ scheduleKey, lastRun, lastSuccess, scheduledFor = null, today = new Date() }) {
  if (!lastRun) return isScheduledForDue(scheduledFor, today) ? 'OVERDUE_NO_RUN' : 'NO_RUN_HISTORY';
  if (lastRun.status === 'running' || lastRun.status === 'queued' || lastRun.status === 'cancelling') return 'RUNNING';
  if (isScheduledForDue(scheduledFor, today) && !isRunForScheduledOccurrence(lastRun, scheduledFor)) return 'OVERDUE_NO_RUN';
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
  getClosedAnalysisWindow,
  getVietnamDateParts,
  isRuleDueToday,
  isScheduledForDue,
  isRunForScheduledOccurrence,
  isSameVietnamDate,
  resolveScheduleRunStatus
};
