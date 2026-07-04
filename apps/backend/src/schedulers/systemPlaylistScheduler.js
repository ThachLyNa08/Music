const { pool } = require('../config/database');
const { logSystemPlaylistRun } = require('../services/systemPlaylistRunLog.service');
const dailyMixService = require('../services/dailyMix.service');
const weeklyMixService = require('../services/weeklyMix.service');
const moodMixService = require('../services/moodMix.service');
const contextualService = require('../services/contextualMoodPlaylist.service');
const trendingService = require('../services/trendingPlaylist.service');

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
    hour: 6,
    minute: 0,
    staleAfterHours: 24 * 7,
    regenerate: async (options) => weeklyMixService.generateWeeklyMixForAllUsers(options)
  },
  {
    keys: ['moodmix'],
    label: 'Mood Mix',
    hour: 0,
    minute: 20,
    staleAfterHours: 24,
    regenerate: async (options) => moodMixService.generateMoodMixForAllUsers(options)
  },
  {
    keys: ['morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes'],
    label: 'Contextual Vibes',
    hour: 4,
    minute: 0,
    staleAfterHours: 24,
    regenerate: async (options) => contextualService.generateContextualMoodPlaylistsForAllUsers(options)
  },
  {
    keys: ['trending_now'],
    label: 'Trending Now',
    hour: 1,
    minute: 0,
    staleAfterHours: 24,
    regenerate: async (options) => trendingService.generateTrendingPlaylist(options)
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

function isScheduledTimeDue(schedule, now = new Date()) {
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (schedule.runDayOfWeek !== undefined && schedule.runDayOfWeek !== null) {
    if (day !== schedule.runDayOfWeek) return false;
  }
  
  if (schedule.hour !== undefined && schedule.hour !== null) {
    if (hour !== schedule.hour) return false;
  }
  
  if (schedule.minute !== undefined && schedule.minute !== null) {
    // 60-minute window for safety
    return minute >= schedule.minute && minute < schedule.minute + 60;
  }
  
  return true;
}

function hasRunToday(lastGeneratedAt, now = new Date()) {
  if (!lastGeneratedAt) return false;
  const last = new Date(lastGeneratedAt);
  return (
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  );
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

  try {
    const [rows] = await pool.query(`SELECT system_key, MAX(updated_at) as lastGeneratedAt FROM playlists WHERE system_key IS NOT NULL GROUP BY system_key`);
    const lastGenMap = rows.reduce((acc, row) => {
      acc[row.system_key] = row.lastGeneratedAt;
      return acc;
    }, {});

    for (const schedule of SYSTEM_PLAYLIST_SCHEDULES) {
      let shouldRun = false;
      let reason = '';

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
        if (!isScheduledTimeDue(schedule, now)) {
          reason = 'not scheduled today or outside time window';
        } else {
          const alreadyRun = schedule.keys.every(k => hasRunToday(lastGenMap[k], now));
          if (alreadyRun) {
            reason = 'already run today';
          } else {
            shouldRun = true;
          }
        }
      }

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
          let status = 'success';
          let message = null;
          let stats = null;
          
          try {
            stats = await schedule.regenerate({});
            if (debug) console.log(`[SystemPlaylistScheduler] Completed ${schedule.label}`);
            successCount++;
            
            // For successful runs, serialize stats to JSON so evaluation script can parse metrics
            // Ignore bulky arrays like 'details' to keep DB row size manageable
            const { details, ...loggableStats } = stats;
            message = JSON.stringify(loggableStats);
          } catch (err) {
            console.error(`[SystemPlaylistScheduler] Failed ${schedule.label}:`, err.message);
            status = 'failed';
            message = JSON.stringify({ error: err.message });
            failedCount++;
          }
          
          for (const key of schedule.keys) {
            const isDaily = key.startsWith('dailymix');
            const isWeekly = key === 'weekly_mix';
            let source_start = null;
            let source_end = null;
            
            if (isDaily) {
              const today = new Date(now);
              const dayOfWeek = today.getDay();
              const offsetToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              const lastMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offsetToThisMonday - 7);
              
              let targetDate = new Date(lastMonday);
              if (key === 'dailymix_01') targetDate.setDate(lastMonday.getDate());
              else if (key === 'dailymix_02') targetDate.setDate(lastMonday.getDate() + 1);
              else if (key === 'dailymix_03') targetDate.setDate(lastMonday.getDate() + 2);
              else if (key === 'dailymix_04') targetDate.setDate(lastMonday.getDate() + 3);
              else if (key === 'dailymix_05') targetDate.setDate(lastMonday.getDate() + 4);
              else if (key === 'dailymix_06') targetDate.setDate(lastMonday.getDate() + 6);
              
              source_start = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
              source_end = source_start;
            } else if (isWeekly) {
              const ref = new Date(now);
              const day = ref.getDay();
              let diffToSun = day === 0 ? 0 : day;
              if (day === 0 && ref.getHours() < 6) diffToSun = 7;
              
              const endAt = new Date(ref.getTime());
              endAt.setDate(ref.getDate() - diffToSun - 1); // Saturday
              const startAt = new Date(endAt.getTime());
              startAt.setDate(startAt.getDate() - 5); // Monday
              
              source_start = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, '0')}-${String(startAt.getDate()).padStart(2, '0')}`;
              source_end = `${endAt.getFullYear()}-${String(endAt.getMonth() + 1).padStart(2, '0')}-${String(endAt.getDate()).padStart(2, '0')}`;
            }
            
            let scheduled_for = null;
            if (!forceKeys) {
              scheduled_for = new Date(now);
              scheduled_for.setHours(schedule.hour !== undefined ? schedule.hour : 0, schedule.minute !== undefined ? schedule.minute : 0, 0, 0);
            }
            
            try {
              await logSystemPlaylistRun({
                system_key: key,
                run_type: customNow ? 'script' : (forceKeys ? 'manual' : 'scheduled'),
                source_start_date: source_start,
                source_end_date: source_end,
                scheduled_for: scheduled_for,
                status: status,
                playlist_count: stats ? ((stats.playlistsCreated || 0) + (stats.playlistsUpdated || 0)) : 0,
                song_count: stats ? (stats.songsInserted || 0) : 0,
                overlap_ratio: stats ? stats.overlapRatio : null,
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
  
  return { successCount, failedCount };
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
  startSystemPlaylistScheduler
};
