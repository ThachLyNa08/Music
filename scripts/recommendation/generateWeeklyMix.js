// scripts/recommendation/generateWeeklyMix.js
// Manual CLI for generating Weekly Mix playlists based on the recommendation
// service.
//
// Usage:
//   node scripts/recommendation/generateWeeklyMix.js --user-id=218
//   node scripts/recommendation/generateWeeklyMix.js --user-id=218 --dry-run
//   node scripts/recommendation/generateWeeklyMix.js --user-id=218 --limit=50
//   node scripts/recommendation/generateWeeklyMix.js --all
//   node scripts/recommendation/generateWeeklyMix.js --date=2026-06-21 --user-id=11 --dry-run

const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(projectRoot, 'apps', 'backend');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { pool } = require(path.join(backendRoot, 'src/config/database'));
const weeklyMixService = require(path.join(backendRoot, 'src/services/weeklyMix.service'));
const recommendationService = require(path.join(backendRoot, 'src/services/recommendation.service'));
const modelService = require(path.join(backendRoot, 'src/services/recommendationModel.service'));

function parseArgs(argv) {
  const args = { userId: null, all: false, dryRun: false, limit: null, date: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--all') args.all = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--date=')) {
      args.date = arg.split('=')[1];
    }
    else if (arg.startsWith('--user-id=')) {
      const v = arg.split('=')[1];
      args.userId = Number(v);
      if (!Number.isInteger(args.userId) || args.userId <= 0) {
        throw new Error(`Invalid --user-id=${v}`);
      }
    } else if (arg.startsWith('--limit=')) {
      const v = arg.split('=')[1];
      args.limit = Number(v);
      if (!Number.isInteger(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid --limit=${v}`);
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.all && args.userId == null) {
    throw new Error('Provide --user-id=<id> or --all. Use --help for usage.');
  }
  return args;
}

function printHelp() {
  console.log(`Weekly Mix phân tích dữ liệu nghe từ Thứ Hai đến hết Thứ Bảy và cập nhật vào sáng Chủ nhật.

Usage:
  node scripts/recommendation/generateWeeklyMix.js --user-id=<id> [--date=YYYY-MM-DD] [--limit=<n>] [--dry-run]
  node scripts/recommendation/generateWeeklyMix.js --all [--date=YYYY-MM-DD] [--limit=<n>] [--dry-run]

Options:
  --user-id=<id>   Generate for a single user.
  --all            Generate for all active users.
  --date=YYYY-MM-DD Simulate generation for a specific date.
  --limit=<n>      Override the per-user candidate limit (default 35, capped at 50).
  --dry-run        Do not write to DB. Print summary only.
  --help, -h       Show this help.`);
}

function fmtTop(songIds) {
  if (!songIds || !songIds.length) return '[]';
  return `[${songIds.slice(0, 10).join(', ')}${songIds.length > 10 ? ', ...' : ''}]`;
}

async function runOne(userId, args) {
  const opts = { limit: args.limit, dryRun: args.dryRun, referenceDate: args.date };
  const summary = await weeklyMixService.generateWeeklyMixForUser(userId, opts);
  console.log(`\n--- user_id=${userId} ---`);
  console.log(`target system_key: ${weeklyMixService.SYSTEM_KEY}`);
  if (summary.listeningWindow) {
    console.log(`listening window startAt: ${summary.listeningWindow.startAt.toISOString()}`);
    console.log(`listening window endAt: ${summary.listeningWindow.endAt.toISOString()}`);
  }
  console.log(`strategy: ${summary.strategy} (reason=${summary.reason})`);
  console.log(`candidateCount: ${summary.candidateCount}`);
  console.log(`dedupedCount (selected song count): ${summary.dedupedCount}`);
  if (summary.dryRun) {
    console.log(`dryRun: true`);
    console.log(`topSongIds: ${fmtTop(summary.topSongIds)}`);
  } else {
    console.log(`playlistId: ${summary.playlistId}`);
    console.log(`created: ${summary.created}`);
    console.log(`insertedSongs: ${summary.insertedSongs}`);
  }
  return summary;
}

async function runAll(args) {
  const opts = { limit: args.limit, dryRun: args.dryRun, referenceDate: args.date };
  console.log(`Running Weekly Mix generation for all active users${args.dryRun ? ' (dry-run)' : ''}...`);
  const stats = await weeklyMixService.generateWeeklyMixForAllUsers(opts);
  console.log('\n=== Summary ===');
  console.log(`users processed: ${stats.usersProcessed}`);
  if (!args.dryRun) {
    console.log(`playlists created: ${stats.playlistsCreated}`);
    console.log(`playlists updated: ${stats.playlistsUpdated}`);
    console.log(`songs inserted:    ${stats.songsInserted}`);
  } else {
    console.log(`mode: dry-run (no DB writes)`);
  }
  console.log(`skipped users:     ${stats.skipped}`);
  console.log(`errors:            ${stats.errors}`);
  const errored = stats.details.filter((d) => d.error);
  if (errored.length) {
    console.log('\nErrored users:');
    for (const e of errored) {
      console.log(`  user_id=${e.userId}: ${e.error}`);
    }
  }
  return stats;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(`Argument error: ${err.message}`);
    printHelp();
    process.exit(2);
  }

  // Surface model availability briefly so the operator sees what is being used.
  const loadResult = modelService.tryLoad();
  if (loadResult.ok) {
    const meta = modelService.getModelMetadata();
    console.log(`[model] loaded: ${meta.algorithm} | trained_users=${meta.trained_users} factors=${meta.factors}`);
  } else {
    console.log(`[model] unavailable: ${loadResult.error}`);
  }

  // Make sure recommendation service module is reachable even when only --all is used.
  void recommendationService;

  try {
    if (args.all) {
      await runAll(args);
    } else {
      await runOne(args.userId, args);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('generateWeeklyMix failed:', err);
  process.exit(1);
});
