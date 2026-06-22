// scripts/recommendation/repairDailyMixUpdatedAt.js
const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(projectRoot, 'apps', 'backend');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { pool } = require(path.join(backendRoot, 'src/config/database'));

function getMostRecentDayOfWeek(targetDOW) {
  const now = new Date();
  let diff = now.getDay() - targetDOW;
  if (diff < 0) diff += 7;
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  targetDate.setHours(0, 10, 0, 0);
  if (targetDate > now) {
    targetDate.setDate(targetDate.getDate() - 7);
  }
  return targetDate;
}

const targetDOWs = {
  dailymix_01: 2, // Tue
  dailymix_02: 3, // Wed
  dailymix_03: 4, // Thu
  dailymix_04: 5, // Fri
  dailymix_05: 6, // Sat
  dailymix_06: 1  // Mon
};

function formatDateForMySQL(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0') + ' ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' +
    String(date.getSeconds()).padStart(2, '0');
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply || args.includes('--dry-run');

  if (isDryRun && !isApply) {
    console.log('--- DRY RUN MODE (không sửa database) ---');
    console.log('Thêm cờ --apply để cập nhật DB thật.');
  }

  const [rows] = await pool.query(
    `SELECT id, user_id, system_key, updated_at
     FROM playlists
     WHERE is_system = 1 AND system_key IN ('dailymix_01','dailymix_02','dailymix_03','dailymix_04','dailymix_05','dailymix_06')`
  );

  let totalUpdated = 0;
  const perKeyCount = {
    dailymix_01: 0,
    dailymix_02: 0,
    dailymix_03: 0,
    dailymix_04: 0,
    dailymix_05: 0,
    dailymix_06: 0
  };

  for (const row of rows) {
    const targetDOW = targetDOWs[row.system_key];
    const newDate = getMostRecentDayOfWeek(targetDOW);
    const oldDateStr = formatDateForMySQL(new Date(row.updated_at));
    const newDateStr = formatDateForMySQL(newDate);

    const isChanged = oldDateStr !== newDateStr;

    if (isDryRun) {
      console.log(`user_id=${row.user_id} system_key=${row.system_key} current=${oldDateStr} proposed=${newDateStr} changed=${isChanged ? 'yes' : 'no'}`);
    }

    if (isApply && isChanged) {
      await pool.query(
        `UPDATE playlists SET updated_at = ? WHERE id = ?`,
        [newDateStr, row.id]
      );
      totalUpdated++;
      perKeyCount[row.system_key]++;
    }
  }

  if (isApply) {
    console.log('\n--- APPLY RESULT ---');
    console.log(`Total rows updated: ${totalUpdated}`);
    for (const key of Object.keys(perKeyCount)) {
      console.log(`${key}: ${perKeyCount[key]}`);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
