// scripts/recommendation/generateTrendingNow.js
// Refresh the global read-only Trending Now system playlist.

const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_ROOT = path.join(PROJECT_ROOT, 'apps', 'backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));
const trendingPlaylistService = require(path.join(BACKEND_ROOT, 'src/services/trendingPlaylist.service'));

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  return {
    dryRun: args['dry-run'] === true,
    limit: args.limit !== undefined ? Number(args.limit) : 50,
    help: args.help === true || args.h === true
  };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/recommendation/generateTrendingNow.js --dry-run
  node scripts/recommendation/generateTrendingNow.js
  node scripts/recommendation/generateTrendingNow.js --limit=50

Options:
  --dry-run       Print selected songs without writing DB.
  --limit=<n>     Songs to persist. Default: 50.
  --help          Show this help.
`);
}

function validateArgs(args) {
  if (args.help) return;
  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    throw new Error('--limit must be a positive number.');
  }
}

function printResult(result) {
  console.log(`system_key=${result.systemKey}`);
  console.log(`strategy=${result.strategy}`);
  console.log(`score_formula=${result.formula}`);
  console.log(`candidate count=${result.candidateCount}`);
  console.log(`selected count=${result.selectedCount}`);
  console.log(`duplicate count=${result.duplicateCount}`);
  console.log(`playlistId=${result.playlistId || 'n/a'} created=${result.created}`);
  console.log(`insertedSongs=${result.insertedSongs}`);
  console.log(`updatedAt=${result.updatedAt || 'n/a'}`);
  console.log('top 10 songs:');
  for (const song of result.topSongs || []) {
    console.log(
      `  ${song.position}. id=${song.id} "${song.title || ''}" - ${song.artist_name || 'Unknown'} ` +
      `score=${song.trending_score} listens=${song.recent_listens} likes=${song.recent_likes} ` +
      `completion=${Number(song.avg_completion_rate || 0).toFixed(3)} skips=${song.skip_count}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  validateArgs(args);

  console.log(`[TrendingNow] dryRun=${args.dryRun} limit=${Math.floor(args.limit)}`);
  const result = await trendingPlaylistService.generateTrendingPlaylist({
    dryRun: args.dryRun,
    limit: Math.floor(args.limit)
  });
  printResult(result);
}

main()
  .catch((err) => {
    console.error('[TrendingNow] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
