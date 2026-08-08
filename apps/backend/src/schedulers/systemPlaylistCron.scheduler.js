const cron = require('node-cron');
const runLogService = require('../services/systemPlaylistRunLog.service');
const {
  acquireSchedulerLock,
  releaseSchedulerLock,
  getLockTtlMinutes
} = require('../services/systemPlaylistSchedulerLock.service');
const {
  runSystemPlaylistSchedulerOnce
} = require('../services/systemPlaylistSchedulerRunner.service');
const {
  _systemPlaylistMaintenance: maintenance
} = require('../controllers/admin.controller');

const LOCK_KEY = 'system_playlist_scheduler';
let cronTask = null;
let isRunningInProcess = false;
let startupCatchupTimer = null;

function isCronEnabled() {
  return String(process.env.SYSTEM_PLAYLIST_CRON_ENABLED || '').trim().toLowerCase() === 'true';
}

function getCronSchedule() {
  return process.env.SYSTEM_PLAYLIST_CRON_SCHEDULE || '0 0 * * *';
}

function getCronTimezone() {
  return process.env.SYSTEM_PLAYLIST_CRON_TIMEZONE || 'Asia/Ho_Chi_Minh';
}

function isStartupCatchupEnabled() {
  return String(process.env.SYSTEM_PLAYLIST_CRON_RUN_ON_STARTUP || '').trim().toLowerCase() === 'true';
}

function getStartupDelaySeconds() {
  const parsed = Number(process.env.SYSTEM_PLAYLIST_CRON_STARTUP_DELAY_SECONDS || 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 10;
  return Math.min(Math.floor(parsed), 3600);
}

async function runCronTick(context = {}) {
  const label = context.label || 'cron';
  const prefix = label === 'startup catch-up' ? '[SystemPlaylistCron] startup catch-up' : '[SystemPlaylistCron]';
  if (isRunningInProcess) {
    console.log(`${prefix} skipped because another scheduler run is active`);
    return;
  }

  isRunningInProcess = true;
  let lock = null;
  try {
    if (label === 'startup catch-up') {
      console.log('[SystemPlaylistCron] startup catch-up triggered');
    } else {
      console.log(`[SystemPlaylistCron] triggered at ${new Date().toISOString()}`);
    }
    lock = await acquireSchedulerLock(LOCK_KEY, getLockTtlMinutes());
    if (!lock.acquired) {
      console.log(`${prefix} skipped because another scheduler run is active`);
      return;
    }

    const activeRun = await runLogService.getRunningGenerationRun(maintenance.SYSTEM_PLAYLIST_REGENERATE_OPERATION);
    if (activeRun) {
      console.log(`${prefix} skipped because another scheduler run is active`);
      return;
    }

    await runSystemPlaylistSchedulerOnce({
      allDue: true,
      force: false,
      dryRun: false,
      limitTargets: null
    });
    if (label === 'startup catch-up') {
      console.log('[SystemPlaylistCron] startup catch-up finished');
    } else {
      console.log('[SystemPlaylistCron] finished');
    }
  } catch (error) {
    console.error(`${prefix} failed:`, error);
  } finally {
    if (lock?.acquired) {
      try {
        await releaseSchedulerLock(LOCK_KEY, lock.owner);
      } catch (releaseError) {
        console.error('[SystemPlaylistCron] failed to release lock:', releaseError);
      }
    }
    isRunningInProcess = false;
  }
}

function scheduleStartupCatchup() {
  if (!isStartupCatchupEnabled()) return;
  if (startupCatchupTimer) return;
  const delaySeconds = getStartupDelaySeconds();
  console.log(`[SystemPlaylistCron] startup catch-up scheduled after ${delaySeconds}s`);
  startupCatchupTimer = setTimeout(() => {
    startupCatchupTimer = null;
    runCronTick({ label: 'startup catch-up' }).catch((error) => {
      console.error('[SystemPlaylistCron] startup catch-up failed:', error);
    });
  }, delaySeconds * 1000);
  if (typeof startupCatchupTimer.unref === 'function') {
    startupCatchupTimer.unref();
  }
}

function startSystemPlaylistCron() {
  if (process.env.NODE_ENV === 'test') {
    console.log('[SystemPlaylistCron] disabled');
    return null;
  }
  if (!isCronEnabled()) {
    console.log('[SystemPlaylistCron] disabled');
    return null;
  }
  if (cronTask) {
    console.log('[SystemPlaylistCron] already registered');
    return cronTask;
  }

  const schedule = getCronSchedule();
  const timezone = getCronTimezone();
  if (!cron.validate(schedule)) {
    console.error(`[SystemPlaylistCron] invalid schedule=${schedule}`);
    return null;
  }

  cronTask = cron.schedule(
    schedule,
    () => {
      runCronTick().catch((error) => {
        console.error('[SystemPlaylistCron] failed:', error);
      });
    },
    {
      timezone
    }
  );
  console.log(`[SystemPlaylistCron] registered schedule=${schedule} timezone=${timezone}`);
  scheduleStartupCatchup();
  return cronTask;
}

module.exports = {
  startSystemPlaylistCron,
  runCronTick
};
