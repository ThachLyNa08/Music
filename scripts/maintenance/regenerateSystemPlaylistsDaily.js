const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(
  path.resolve(__dirname, '../../apps/backend/package.json')
);

backendRequire('dotenv').config({
  path: path.resolve(__dirname, '../../apps/backend/.env')
});
const { checkAndRunDueSystemPlaylists } = require('../../apps/backend/src/schedulers/systemPlaylistScheduler');
const { testConnection } = require('../../apps/backend/src/config/database');
const { connectRedis } = require('../../apps/backend/src/config/redis');

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const all = args.includes('--all');
  const compare = args.includes('--compare');
  const debug = args.includes('--debug');
  
  if (!dryRun && !apply && !compare) {
    console.log('Usage:');
    console.log('  node regenerateSystemPlaylistsDaily.js --dry-run');
    console.log('  node regenerateSystemPlaylistsDaily.js --dry-run --compare');
    console.log('  node regenerateSystemPlaylistsDaily.js --apply');
    console.log('  node regenerateSystemPlaylistsDaily.js --key=dailymix_01 --apply');
    console.log('  node regenerateSystemPlaylistsDaily.js --all --apply');
    process.exit(1);
  }

  const SYSTEM_KEY_ALIASES = {
    'weeklymix': 'weekly_mix',
    'weekly_mix': 'weekly_mix',
    'mood_mix': 'moodmix',
    'daily_mix_1': 'dailymix_01',
    'daily_mix_01': 'dailymix_01'
  };
  function normalizeSystemKey(key) {
    return SYSTEM_KEY_ALIASES[key] || key;
  }
  
  const keyArg = args.find(a => a.startsWith('--key='));
  let forceKeys = keyArg ? [normalizeSystemKey(keyArg.split('=')[1])] : null;
  
  const nowArg = args.find(a => a.startsWith('--now='));
  const customNow = nowArg ? nowArg.split('=')[1] : null;
  
  if (all) {
    if (debug) console.log('[Script] WARNING: --all flag used. This will bypass scheduling and force run ALL system playlists.');
    forceKeys = 'ALL';
  }

  try {
    if (debug) console.log('[Script] Connecting to DB & Redis...');
    await testConnection();
    await connectRedis();

    if (debug) console.log('[Script] Invoking SystemPlaylistScheduler manually...');
    const result = await checkAndRunDueSystemPlaylists(forceKeys, dryRun, customNow, compare);

    if (dryRun && result?.details) {
      console.log('[DryRun] System playlist schedule check:');
      for (const item of result.details) {
        const status = item.due ? 'DUE' : 'SKIP';
        const scheduledFor = item.scheduledFor ? new Date(item.scheduledFor).toISOString() : 'n/a';
        console.log(`  - ${status} ${item.label} (${item.keys.join(', ')}): scheduledFor=${scheduledFor}; ${item.reason}`);
      }
    }
    
    if (debug) console.log('[Script] Completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Script] Failed:', error.message);
    process.exit(1);
  }
}

run();
