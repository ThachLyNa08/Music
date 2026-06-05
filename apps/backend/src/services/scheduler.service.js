const cron = require('node-cron');
const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

if (process.env.AI_RETRAIN_ENABLED === 'true') {
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting recommendation model retrain...');
    try {
      await axios.post(`${AI_URL}/api/recommend/retrain`, {}, { timeout: 15000 });
      console.log('[CRON] Recommendation model retrain completed');
    } catch (err) {
      console.warn('[CRON] Recommendation model retrain skipped:', err.message);
    }
  });
} else {
  console.log('[CRON] AI retrain disabled. Set AI_RETRAIN_ENABLED=true to enable it.');
}

cron.schedule('0 2 * * 0', async () => {
  console.log('[CRON] Generating personalized weekly mixes...');
  try {
    const { generateWeeklyMix } = require('./playlistGenerator.service');
    await generateWeeklyMix();
    console.log('[CRON] Weekly mixes generated');
  } catch (err) {
    console.error('[CRON] Weekly mix generation failed:', err.message);
  }
});

cron.schedule('10 2 * * 1', async () => {
  console.log('[CRON] Generating Daily Mix 01...');
  try {
    const { generateDailyMix } = require('./playlistGenerator.service');
    await generateDailyMix(1);
    console.log('[CRON] Daily Mix 01 generated');
  } catch (err) {
    console.error('[CRON] Daily Mix 01 generation failed:', err.message);
  }
});

cron.schedule('10 2 * * 2', async () => {
  try {
    const { generateDailyMix } = require('./playlistGenerator.service');
    await generateDailyMix(2);
    console.log('[CRON] Daily Mix 02 generated');
  } catch (err) {
    console.error('[CRON] Daily Mix 02 generation failed:', err.message);
  }
});

cron.schedule('10 2 * * 3', async () => {
  try {
    const { generateDailyMix } = require('./playlistGenerator.service');
    await generateDailyMix(3);
  } catch (err) {
    console.error('[CRON] Daily Mix 03 generation failed:', err.message);
  }
});

cron.schedule('10 2 * * 4', async () => {
  try {
    const { generateDailyMix } = require('./playlistGenerator.service');
    await generateDailyMix(4);
  } catch (err) {
    console.error('[CRON] Daily Mix 04 generation failed:', err.message);
  }
});

cron.schedule('10 2 * * 5', async () => {
  try {
    const { generateDailyMix } = require('./playlistGenerator.service');
    await generateDailyMix(5);
  } catch (err) {
    console.error('[CRON] Daily Mix 05 generation failed:', err.message);
  }
});

cron.schedule('10 2 * * 6', async () => {
  try {
    const { generateDailyMix } = require('./playlistGenerator.service');
    await generateDailyMix(6);
  } catch (err) {
    console.error('[CRON] Daily Mix 06 generation failed:', err.message);
  }
});

cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] Scanning missing artist avatars...');
  try {
    const { scanAndFetchMissingAvatars } = require('./artistImage.service');
    await scanAndFetchMissingAvatars();
    console.log('[CRON] Artist avatar scan completed');
  } catch (err) {
    console.error('[CRON] Artist avatar scan failed:', err.message);
  }
});

cron.schedule('30 3 * * *', async () => {
  console.log('[CRON] Scanning missing song covers...');
  try {
    const { scanAndFetchMissingSongCovers } = require('./songImage.service');
    await scanAndFetchMissingSongCovers(50);
    console.log('[CRON] Song cover scan completed');
  } catch (err) {
    console.error('[CRON] Song cover scan failed:', err.message);
  }
});

cron.schedule('0 4 * * *', async () => {
  console.log('[CRON] Scanning missing album covers...');
  try {
    const { scanAndFetchMissingAlbumCovers } = require('./songImage.service');
    await scanAndFetchMissingAlbumCovers(50);
    console.log('[CRON] Album cover scan completed');
  } catch (err) {
    console.error('[CRON] Album cover scan failed:', err.message);
  }
});

console.log('[CRON] Scheduler registered');
