const cron = require('node-cron');
const { releaseScheduledSongs } = require('../services/songRelease.service');

let task = null;

function isEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function startSongReleaseCron() {
  if (process.env.NODE_ENV === 'test') {
    console.log('[SongReleaseCron] disabled in test environment');
    return null;
  }

  if (!isEnabled(process.env.SONG_RELEASE_CRON_ENABLED)) {
    console.log('[SongReleaseCron] disabled');
    return null;
  }

  if (task) {
    console.log('[SongReleaseCron] already registered');
    return task;
  }

  const schedule = process.env.SONG_RELEASE_CRON_SCHEDULE || '*/5 * * * *';
  const timezone = process.env.SONG_RELEASE_CRON_TIMEZONE || 'Asia/Ho_Chi_Minh';

  task = cron.schedule(schedule, async () => {
    console.log(`[SongReleaseCron] triggered at ${new Date().toISOString()}`);
    try {
      const result = await releaseScheduledSongs();
      console.log(`[SongReleaseCron] finished released=${result.releasedCount || 0}`);
    } catch (error) {
      console.error('[SongReleaseCron] failed:', error.message);
    }
  }, { timezone });

  console.log(`[SongReleaseCron] registered schedule=${schedule} timezone=${timezone}`);
  return task;
}

module.exports = {
  startSongReleaseCron
};
