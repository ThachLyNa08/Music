const { pool } = require('../config/database');
const { logSystemPlaylistRun } = require('../services/systemPlaylistRunLog.service');
const dailyMixService = require('../services/dailyMix.service');
const weeklyMixService = require('../services/weeklyMix.service');
const moodMixService = require('../services/moodMix.service');
const contextualService = require('../services/contextualMoodPlaylist.service');
const trendingService = require('../services/trendingPlaylist.service');
const behaviorPlaylistService = require('../services/behaviorSystemPlaylist.service');

const SYSTEM_PLAYLIST_SCHEDULES = [
  {
    keys: ['dailymix_01'],
    label: 'Daily Mix 1',
    runDayOfWeek: 2, // Thứ Ba
    hour: 0,
    minute: 10,
    staleAfterHours: 24,
    regenerate: async (options) => dailyMixService.generateDailyMixByKeyForAllUsers('dailymix_01', options)
  },
  {
    keys: ['dailymix_02'],
    label: 'Daily Mix 2',
    runDayOfWeek: 3, // Thứ Tư
    hour: 0,
    minute: 10,
    staleAfterHours: 24,
    regenerate: async (options) => dailyMixService.generateDailyMixByKeyForAllUsers('dailymix_02', options)
  },
  {
    keys: ['dailymix_03'],
    label: 'Daily Mix 3',
    runDayOfWeek: 4, // Thứ Năm
    hour: 0,
    minute: 10,
    staleAfterHours: 24,
    regenerate: async (options) => dailyMixService.generateDailyMixByKeyForAllUsers('dailymix_03', options)
  },
  {
    keys: ['dailymix_04'],
    label: 'Daily Mix 4',
    runDayOfWeek: 5, // Thứ Sáu
    hour: 0,
    minute: 10,
    staleAfterHours: 24,
    regenerate: async (options) => dailyMixService.generateDailyMixByKeyForAllUsers('dailymix_04', options)
  },
  {
    keys: ['dailymix_05'],
    label: 'Daily Mix 5',
    runDayOfWeek: 6, // Thứ Bảy
    hour: 0,
    minute: 10,
    staleAfterHours: 24,
    regenerate: async (options) => dailyMixService.generateDailyMixByKeyForAllUsers('dailymix_05', options)
  },
  {
    keys: ['dailymix_06'],
    label: 'Daily Mix 6',
    runDayOfWeek: 1, // Thứ Hai
    hour: 0,
    minute: 10,
    staleAfterHours: 24,
    regenerate: async (options) => dailyMixService.generateDailyMixByKeyForAllUsers('dailymix_06', options)
  },
  {
    keys: ['weekly_mix'],
    label: 'Weekly Mix',
    runDayOfWeek: 0, // Chủ Nhật
    hour: 7,
    minute: 0,
    staleAfterHours: 24 * 7,
    regenerate: async (options) => weeklyMixService.generateWeeklyMixForAllUsers(options)
  },
  {
    keys: ['moodmix'],
    label: 'Mood Mix',
    hour: 1,
    minute: 0,
    staleAfterHours: 24,
    regenerate: async (options) => moodMixService.generateMoodMixForAllUsers(options)
  },
  {
    keys: ['morning_vibes'],
    label: 'Morning Vibes',
    hour: 5,
    minute: 30,
    staleAfterHours: 24,
    regenerate: async (options) => contextualService.generateContextualMoodPlaylistsForAllUsers({ ...options, timeSlot: 'morning' })
  },
  {
    keys: ['afternoon_vibes'],
    label: 'Afternoon Vibes',
    hour: 12,
    minute: 30,
    staleAfterHours: 24,
    regenerate: async (options) => contextualService.generateContextualMoodPlaylistsForAllUsers({ ...options, timeSlot: 'afternoon' })
  },
  {
    keys: ['evening_vibes'],
    label: 'Evening Vibes',
    hour: 17,
    minute: 30,
    staleAfterHours: 24,
    regenerate: async (options) => contextualService.generateContextualMoodPlaylistsForAllUsers({ ...options, timeSlot: 'evening' })
  },
  {
    keys: ['night_vibes'],
    label: 'Night Vibes',
    hour: 20,
    minute: 30,
    staleAfterHours: 24,
    regenerate: async (options) => contextualService.generateContextualMoodPlaylistsForAllUsers({ ...options, timeSlot: 'night' })
  },
  {
    keys: ['trending_now'],
    label: 'Trending Now',
    hour: 0,
    minute: 30,
    staleAfterHours: 24,
    regenerate: async (options) => trendingService.generateTrendingPlaylist(options)
  },
  {
    keys: ['favorite_songs'],
    label: 'Favorite Songs',
    hour: 0,
    minute: 45,
    staleAfterHours: 24,
    regenerate: async (options) => behaviorPlaylistService.generateBehaviorPlaylistsForAllUsers({
      ...options,
      systemKeys: ['favorite_songs'],
    })
  },
  {
    keys: ['recently_played'],
    label: 'Recently Played',
    hour: 0,
    minute: 55,
    staleAfterHours: 24,
    regenerate: async (options) => behaviorPlaylistService.generateBehaviorPlaylistsForAllUsers({
      ...options,
      systemKeys: ['recently_played'],
    })
  },
  {
    keys: ['genre_deep_dive'],
    label: 'Genre Deep Dive',
    runDayOfWeek: 1,
    hour: 1,
    minute: 0,
    staleAfterHours: 24 * 7,
    regenerate: async (options) => {
      if (process.argv.includes('--debug')) {
        console.log('[SystemPlaylistScheduler] Genre Deep Dive service not implemented yet');
      }
      return { canApply: false, status: 'skipped', message: 'Genre Deep Dive service not implemented yet' };
    }
  }
];

let isRunning = false;
let intervalId = null;

const SYSTEM_KEY_ALIASES = {
  weeklymix: 'weekly_mix',
  weekly_mix: 'weekly_mix',
  mood_mix: 'moodmix',
  moodmix: 'moodmix',
};

function normalizeSystemKey(key) {
  return SYSTEM_KEY_ALIASES[key] || key;
}

function equivalentSystemKeys(key) {
  const canonical = normalizeSystemKey(key);
  const aliases = new Set([key, canonical]);
  for (const [alias, target] of Object.entries(SYSTEM_KEY_ALIASES)) {
    if (target === canonical) aliases.add(alias);
  }
  return Array.from(aliases);
}

function getLatestScheduledOccurrence(schedule, now = new Date()) {
  const occurrence = new Date(now);
  occurrence.setHours(schedule.hour ?? 0, schedule.minute ?? 0, 0, 0);

  if (schedule.runDayOfWeek !== undefined && schedule.runDayOfWeek !== null) {
    const diffDays = schedule.runDayOfWeek - occurrence.getDay();
    occurrence.setDate(occurrence.getDate() + diffDays);
    return occurrence <= now ? occurrence : null;
  }

  return occurrence <= now ? occurrence : null;
}

function getLastGeneratedAtForKey(lastGenMap, key) {
  let latest = null;
  for (const equivalentKey of equivalentSystemKeys(key)) {
    const value = lastGenMap[equivalentKey];
    if (!value) continue;
    const date = new Date(value);
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function getLastGeneratedAtForSchedule(lastGenMap, schedule) {
  let latest = null;
  for (const key of schedule.keys) {
    const date = getLastGeneratedAtForKey(lastGenMap, key);
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}

async function buildLastSuccessMap() {
  const lastSuccessMap = {};

  try {
    const [runRows] = await pool.query(`
      SELECT system_key, MAX(finished_at) AS lastSuccessAt
      FROM system_playlist_runs
      WHERE status = 'success'
      GROUP BY system_key
    `);

    for (const row of runRows) {
      if (!row.lastSuccessAt) continue;
      const key = normalizeSystemKey(row.system_key);
      const current = lastSuccessMap[key];
      const date = new Date(row.lastSuccessAt);
      if (!current || date > new Date(current)) {
        lastSuccessMap[key] = row.lastSuccessAt;
      }
    }
  } catch (err) {
    if (process.argv.includes('--debug')) {
      console.warn('[SystemPlaylistScheduler] system_playlist_runs unavailable, falling back to playlists.updated_at:', err.message);
    }
  }

  const [playlistRows] = await pool.query(`
    SELECT system_key, MAX(updated_at) as lastGeneratedAt
    FROM playlists
    WHERE system_key IS NOT NULL
    GROUP BY system_key
  `);

  for (const row of playlistRows) {
    const key = normalizeSystemKey(row.system_key);
    if (!lastSuccessMap[key]) {
      lastSuccessMap[key] = row.lastGeneratedAt;
    }
    lastSuccessMap[row.system_key] = row.lastGeneratedAt;
  }

  return lastSuccessMap;
}

function hasScheduleRunForOccurrence(lastGenMap, schedule, scheduledFor) {
  if (!scheduledFor) return false;
  return schedule.keys.every((key) => {
    const lastGeneratedAt = getLastGeneratedAtForKey(lastGenMap, key);
    return lastGeneratedAt && lastGeneratedAt >= scheduledFor;
  });
}

function isScheduledTimeDue(schedule, now = new Date(), lastGeneratedAt = null) {
  const scheduledFor = getLatestScheduledOccurrence(schedule, now);
  if (!scheduledFor || scheduledFor > now) return false;
  if (!lastGeneratedAt) return true;
  return new Date(lastGeneratedAt) < scheduledFor;
}

function formatDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDailyMixSourceWindow(key, scheduledFor) {
  const sourceDate = new Date(scheduledFor);
  sourceDate.setDate(sourceDate.getDate() - 1);

  if (key === 'dailymix_06') {
    const startAt = new Date(sourceDate);
    startAt.setDate(startAt.getDate() - 1);
    return {
      source_start: formatDateOnly(startAt),
      source_end: formatDateOnly(sourceDate),
      targetDate: sourceDate,
    };
  }

  return {
    source_start: formatDateOnly(sourceDate),
    source_end: formatDateOnly(sourceDate),
    targetDate: sourceDate,
  };
}

function getWeeklyMixSourceWindow(scheduledFor) {
  const endAt = new Date(scheduledFor);
  endAt.setHours(0, 0, 0, 0);
  endAt.setDate(endAt.getDate() - 1);

  const startAt = new Date(endAt);
  startAt.setDate(startAt.getDate() - 5);

  return {
    source_start: formatDateOnly(startAt),
    source_end: formatDateOnly(endAt),
  };
}

function normalizeRunStatus(status) {
  if (status === 'failed') return 'failed';
  if (status === 'partial' || status === 'warning') return 'partial';
  if (status === 'skipped') return 'skipped';
  return 'success';
}

function countPlaylists(stats) {
  return Number(
    stats?.playlistsProcessed
    || stats?.totalPlaylists
    || ((stats?.playlistsCreated || 0) + (stats?.playlistsUpdated || 0))
    || stats?.playlist_count
    || 0
  );
}

function countSongs(stats) {
  return Number(
    stats?.totalSongs
    || stats?.songsInserted
    || stats?.insertedSongs
    || stats?.song_count
    || 0
  );
}

function averageOrTotal(value, playlistCount) {
  const n = Number(value || 0);
  if (!playlistCount || n > playlistCount) return n;
  return Math.round(n * playlistCount);
}

function summarizeSongChanges(stats) {
  const playlistCount = countPlaylists(stats);
  return {
    playlistCount,
    songCount: countSongs(stats),
    songsAdded: Number(stats?.songsAdded || averageOrTotal(stats?.addedSongs || stats?.avgAddedSongs, playlistCount) || 0),
    songsRemoved: Number(stats?.songsRemoved || averageOrTotal(stats?.removedSongs || stats?.avgRemovedSongs, playlistCount) || 0),
    totalSongs: Number(stats?.totalSongs || countSongs(stats) || 0),
  };
}

async function checkAndRunDueSystemPlaylists(forceKeys = null, dryRun = false, customNow = null, compareRun = false) {
  const debug = process.argv.includes('--debug');
  if (isRunning && !forceKeys && !compareRun) {
    if (debug) console.log('[SystemPlaylistScheduler] Skip because previous run is still running');
    return { successCount: 0, failedCount: 0 };
  }
  isRunning = true;
  const now = customNow ? new Date(customNow) : new Date();

  if (debug) console.log(`[SystemPlaylistScheduler] Started checking due playlists${dryRun ? ' (DRY RUN)' : ''}...`);
  if (dryRun && debug) {
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    console.log(`[SystemPlaylistScheduler] Today: ${weekdays[now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
  }

  let successCount = 0;
  let failedCount = 0;
  const details = [];

  try {
    const lastGenMap = await buildLastSuccessMap();

    for (const schedule of SYSTEM_PLAYLIST_SCHEDULES) {
      let shouldRun = false;
      let reason = '';
      const scheduledFor = getLatestScheduledOccurrence(schedule, now);

      if (forceKeys === 'ALL') {
        shouldRun = true;
        reason = 'forced all';
      } else if (forceKeys && forceKeys.length > 0) {
        if (schedule.keys.some(k =>
          forceKeys.includes(k) ||
          forceKeys.includes(k.replace('dailymix_0', 'daily_mix_')) ||
          forceKeys.includes(k.replace('weekly_mix', 'weeklymix')) ||
          forceKeys.includes(k.replace('moodmix', 'mood_mix'))
        )) {
          shouldRun = true;
          reason = 'forced by key';
        } else {
          reason = 'key mismatch';
        }
      } else {
        if (!scheduledFor || scheduledFor > now) {
          reason = 'latest scheduled occurrence is in the future';
        } else if (hasScheduleRunForOccurrence(lastGenMap, schedule, scheduledFor)) {
          reason = 'already run for latest scheduled occurrence';
        } else {
          shouldRun = true;
        }
      }

      details.push({
        label: schedule.label,
        keys: schedule.keys,
        scheduledFor,
        due: shouldRun,
        reason: shouldRun ? reason || 'due for latest scheduled occurrence' : reason
      });

      if (shouldRun) {
        if (compareRun) {
          if (debug) console.log(`[SystemPlaylistScheduler] [COMPARE] Regenerating ${schedule.label} (${schedule.keys.join(', ')})`);
          try {
             const stats = await schedule.regenerate({ dryRun: true });
             const { details, ...loggableStats } = stats;
             console.log(JSON.stringify(loggableStats, null, 2));
             successCount++;
          } catch (err) {
             console.error(`[SystemPlaylistScheduler] Compare Failed ${schedule.label}:`, err.message);
          }
        } else if (dryRun) {
          if (debug) console.log(`[SystemPlaylistScheduler] [DRY RUN] Due: ${schedule.label} (${schedule.keys.join(', ')})`);
          successCount++;
        } else {
          if (debug) console.log(`[SystemPlaylistScheduler] Regenerating ${schedule.label} (${schedule.keys.join(', ')})`);
          const startedAt = new Date();
          let status = 'success';
          let message = null;
          let errorMessage = null;
          let stats = null;

          try {
            stats = await schedule.regenerate({ scheduledFor });
            status = normalizeRunStatus(stats?.status);
            if (debug) console.log(`[SystemPlaylistScheduler] Completed ${schedule.label}`);
            successCount++;

            // For successful runs, serialize stats to JSON so evaluation script can parse metrics
            // Ignore bulky arrays like 'details' to keep DB row size manageable
            const { details, results, ...loggableStats } = stats;
            message = JSON.stringify(loggableStats);
          } catch (err) {
            console.error(`[SystemPlaylistScheduler] Failed ${schedule.label}:`, err.message);
            status = 'failed';
            errorMessage = err.message;
            message = JSON.stringify({ error: err.message });
            failedCount++;
          }

          for (const key of schedule.keys) {
            const isDaily = key.startsWith('dailymix');
            const isWeekly = key === 'weekly_mix';
            const sourceReference = scheduledFor || now;
            let source_start = null;
            let source_end = null;
            let targetDate = null;

            if (isDaily) {
              const sourceWindow = getDailyMixSourceWindow(key, sourceReference);
              source_start = sourceWindow.source_start;
              source_end = sourceWindow.source_end;
              targetDate = sourceWindow.targetDate;
            } else if (isWeekly) {
              const sourceWindow = getWeeklyMixSourceWindow(sourceReference);
              source_start = sourceWindow.source_start;
              source_end = sourceWindow.source_end;
            }

            let scheduled_for = null;
            if (!forceKeys) {
              scheduled_for = getLatestScheduledOccurrence(schedule, now);
            }

            try {
              const songChanges = summarizeSongChanges(stats || {});
              await logSystemPlaylistRun({
                system_key: key,
                run_type: customNow ? 'script' : (forceKeys ? 'manual' : 'scheduled'),
                source_start_date: source_start,
                source_end_date: source_end,
                scheduled_for: scheduled_for,
                started_at: startedAt,
                status: status,
                playlist_count: songChanges.playlistCount,
                song_count: songChanges.songCount,
                songs_added: songChanges.songsAdded,
                songs_removed: songChanges.songsRemoved,
                total_songs: songChanges.totalSongs,
                overlap_ratio: stats ? stats.overlapRatio : null,
                error_message: errorMessage,
                message: message
              });
            } catch (logErr) {
              console.error(`[SystemPlaylistScheduler] Failed to log run for ${key}:`, logErr.message);
            }
          }
        }
      } else {
        if (reason !== 'key mismatch') {
          if (debug) console.log(`[SystemPlaylistScheduler] Skipped: ${schedule.keys.join(', ')}. Reason: ${reason}`);
        }
      }
    }
  } catch (err) {
    console.error('[SystemPlaylistScheduler] Error fetching playlist status:', err.message);
  } finally {
    isRunning = false;
    if (debug) console.log(`[SystemPlaylistScheduler] Finished. Success: ${successCount}, Failed: ${failedCount}`);
  }

  return { successCount, failedCount, details };
}

function startSystemPlaylistScheduler() {
  const enabled = process.env.ENABLE_SYSTEM_PLAYLIST_SCHEDULER !== 'false';
  if (!enabled) {
    console.log('[SystemPlaylistScheduler] Scheduler is disabled by env var ENABLE_SYSTEM_PLAYLIST_SCHEDULER');
    return;
  }

  // Initial check after 30s
  setTimeout(() => {
    checkAndRunDueSystemPlaylists();
  }, 30 * 1000);

  // Periodic check every 60m
  intervalId = setInterval(() => {
    checkAndRunDueSystemPlaylists();
  }, 60 * 60 * 1000);

  console.log('[SystemPlaylistScheduler] Mounted and scheduled to run every 60m');
}

module.exports = {
  SYSTEM_PLAYLIST_SCHEDULES,
  checkAndRunDueSystemPlaylists,
  startSystemPlaylistScheduler,
  getLatestScheduledOccurrence,
  getLastGeneratedAtForKey,
  getLastGeneratedAtForSchedule,
  hasScheduleRunForOccurrence,
  normalizeSystemKey
};
