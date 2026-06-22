// scripts/recommendation/generateContextualMoodPlaylists.js
// Generate read-only contextual mood system playlists.

const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_ROOT = path.join(PROJECT_ROOT, 'apps', 'backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));
const contextualMoodPlaylistService = require(path.join(BACKEND_ROOT, 'src/services/contextualMoodPlaylist.service'));

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  return {
    userId: args['user-id'] !== undefined ? Number(args['user-id']) : null,
    timeSlot: args.timeSlot || args['time-slot'] || null,
    all: args.all === true,
    dryRun: args['dry-run'] === true,
    limit: args.limit !== undefined ? Number(args.limit) : 25,
    help: args.help === true || args.h === true
  };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11
  node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11 --timeSlot=morning
  node scripts/recommendation/generateContextualMoodPlaylists.js --all
  node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11 --dry-run

Options:
  --user-id=<id>       Generate for one user.
  --timeSlot=<slot>    morning | afternoon | evening | night.
  --all               Generate for all active non-admin users.
  --dry-run           Print planned playlists and songs, do not write DB.
  --limit=<n>          Songs per contextual service request. Default: 25.
  --help              Show this help.
`);
}

function validateArgs(args) {
  if (args.help) return;
  if (!args.all && (!Number.isInteger(args.userId) || args.userId <= 0)) {
    throw new Error('Provide --user-id=<id> or --all');
  }
  if (args.all && args.userId) {
    throw new Error('Use either --all or --user-id, not both.');
  }
  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    throw new Error('--limit must be a positive number.');
  }
}

function printSlotResult(result) {
  console.log(`\n[${result.dryRun ? 'DRY-RUN' : 'WRITE'}] user_id=${result.userId} timeSlot=${result.timeSlot}`);
  console.log(`system_key=${result.systemKey}`);
  console.log(`playlistId=${result.playlistId || 'n/a'} created=${result.created}`);
  console.log(`item count=${result.itemCount} duplicate count=${result.duplicateCount}`);
  console.log(`withAudioFeaturesCount=${result.withAudioFeaturesCount ?? 'n/a'} withoutAudioFeaturesCount=${result.withoutAudioFeaturesCount ?? 'n/a'}`);
  console.log(`insertedSongs=${result.insertedSongs}`);
  console.log(`strategy_reason=${result.strategyReason || 'n/a'}`);
  console.log('top 5 songs:');
  for (const song of result.topSongs || []) {
    console.log(`  ${song.position}. id=${song.id} "${song.title || ''}" - ${song.artist_name || 'Unknown'} score=${song.recommendation_score ?? 'n/a'}`);
  }
}

function printUserResult(result) {
  for (const slotResult of result.results || []) {
    printSlotResult(slotResult);
  }
  console.log(`\n[user summary] user_id=${result.userId} playlists=${result.playlistsProcessed} created=${result.playlistsCreated} updated=${result.playlistsUpdated} songsInserted=${result.songsInserted}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  validateArgs(args);

  const options = {
    limit: Math.floor(args.limit),
    timeSlot: args.timeSlot,
    dryRun: args.dryRun
  };

  console.log(`[ContextualMoodPlaylists] mode=${args.all ? 'all-users' : 'single-user'} dryRun=${args.dryRun} limit=${options.limit}`);

  if (args.all) {
    const summary = await contextualMoodPlaylistService.generateContextualMoodPlaylistsForAllUsers(options);
    for (const userResult of summary.results) {
      if (userResult.error) {
        console.warn(`[ERROR] user_id=${userResult.userId} ${userResult.error}`);
        continue;
      }
      printUserResult(userResult);
    }
    console.log(`\n[summary] totalUsers=${summary.totalUsers} usersProcessed=${summary.usersProcessed} playlistsProcessed=${summary.playlistsProcessed} created=${summary.playlistsCreated} updated=${summary.playlistsUpdated} songsInserted=${summary.songsInserted} errors=${summary.errors}`);
    return;
  }

  const result = await contextualMoodPlaylistService.generateContextualMoodPlaylistsForUser(args.userId, options);
  printUserResult(result);
  console.log(`\n[summary] totalUsers=1 playlistsUpdated=${result.playlistsUpdated} playlistsCreated=${result.playlistsCreated} songsInserted=${result.songsInserted} errors=0`);
}

main()
  .catch((err) => {
    console.error('[ContextualMoodPlaylists] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
