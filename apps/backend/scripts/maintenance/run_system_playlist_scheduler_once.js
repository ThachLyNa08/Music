require('dotenv').config();

const { pool } = require('../../src/config/database');
const {
  runSystemPlaylistSchedulerOnce
} = require('../../src/services/systemPlaylistSchedulerRunner.service');

function parseArgs(argv) {
  const args = { allDue: false, scheduler: null, force: false, dryRun: false, limitTargets: null };
  for (const arg of argv) {
    if (arg === '--all-due') args.allDue = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--scheduler=')) args.scheduler = arg.slice('--scheduler='.length);
    else if (arg.startsWith('--limit-targets=')) {
      const limit = Number(arg.slice('--limit-targets='.length));
      args.limitTargets = Number.isInteger(limit) && limit >= 0 ? limit : null;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runSystemPlaylistSchedulerOnce(args);
}

main()
  .catch((error) => {
    console.error('Scheduler failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
