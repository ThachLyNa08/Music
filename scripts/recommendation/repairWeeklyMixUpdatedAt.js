// scripts/recommendation/repairWeeklyMixUpdatedAt.js
// Fix Weekly Mix updated_at to the most recent Sunday at 07:00.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../apps/backend/.env') });
const { pool } = require('../../apps/backend/src/config/database');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  return {
    apply: args.apply === true,
    help: args.help === true || args.h === true
  };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/recommendation/repairWeeklyMixUpdatedAt.js --dry-run
  node scripts/recommendation/repairWeeklyMixUpdatedAt.js --apply

Options:
  --apply   Perform the actual DB update. Otherwise, it runs in dry-run mode.
  --help    Show this help.
`);
}

function getLastWeeklyMixTargetDate(now = new Date()) {
  const d = new Date(now.getTime());
  // Set to 07:00:00
  d.setHours(7, 0, 0, 0);

  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  
  // If today is Sunday
  if (day === 0) {
    // If it's before 07:00 today, rollback 7 days to last week's Sunday
    if (now.getTime() < d.getTime()) {
      d.setDate(d.getDate() - 7);
    }
  } else {
    // If today is not Sunday, rollback to the most recent Sunday
    // e.g. Mon (1) -> minus 1 day
    // e.g. Sat (6) -> minus 6 days
    d.setDate(d.getDate() - day);
  }

  return d;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const dryRun = !args.apply;
  console.log(`--- REPAIR WEEKLY MIX UPDATED_AT ---`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  try {
    const [playlists] = await pool.query(
      `SELECT id, user_id, updated_at 
       FROM playlists 
       WHERE system_key = 'weekly_mix'`
    );

    console.log(`Found ${playlists.length} weekly_mix playlists.`);

    const now = new Date();
    const targetDate = getLastWeeklyMixTargetDate(now);
    console.log(`Target Date (Last Sun 07:00): ${targetDate.toISOString()}`);

    let updateCount = 0;

    for (const pl of playlists) {
      if (dryRun) {
        console.log(`[DRY-RUN] Would update playlist_id=${pl.id} user_id=${pl.user_id} from ${new Date(pl.updated_at).toISOString()} to ${targetDate.toISOString()}`);
        updateCount++;
      } else {
        await pool.query(
          `UPDATE playlists SET updated_at = ? WHERE id = ?`,
          [targetDate, pl.id]
        );
        updateCount++;
      }
    }

    console.log(`\nSuccessfully processed ${updateCount} playlists.`);

  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
