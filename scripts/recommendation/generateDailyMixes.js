// scripts/recommendation/generateDailyMixes.js
// Manual CLI cho Daily Mix theo logic anchor + discovery.
//
// Daily Mix mới sử dụng hành vi nghe của 1 ngày cụ thể (hoặc cả Thứ Bảy +
// Chủ nhật đối với dailymix_06) để tạo playlist pha trộn giữa anchor songs
// (25-35%) và discovery songs (65-75%). KHÔNG copy toàn bộ Recently Played,
// cũng KHÔNG loại hết bài đã nghe.
//
// Mapping weekday -> system_key:
//   Mon  -> dailymix_01
//   Tue  -> dailymix_02
//   Wed  -> dailymix_03
//   Thu  -> dailymix_04
//   Fri  -> dailymix_05
//   Sat|Sun -> dailymix_06 (CLI dùng range cuối tuần)
//
// Usage:
//   node scripts/recommendation/generateDailyMixes.js --user-id=11 --date=2026-06-17
//   node scripts/recommendation/generateDailyMixes.js --user-id=11 --date=2026-06-17 --dry-run
//   node scripts/recommendation/generateDailyMixes.js --user-id=11 --yesterday
//   node scripts/recommendation/generateDailyMixes.js --user-id=11 --backfill-days=6
//   node scripts/recommendation/generateDailyMixes.js --all --yesterday
//   node scripts/recommendation/generateDailyMixes.js --all --date=2026-06-17
//   node scripts/recommendation/generateDailyMixes.js --help

const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(projectRoot, 'apps', 'backend');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { pool } = require(path.join(backendRoot, 'src/config/database'));
const dailyMixService = require(path.join(backendRoot, 'src/services/dailyMix.service'));
const modelService = require(path.join(backendRoot, 'src/services/recommendationModel.service'));

function parseArgs(argv) {
  const args = {
    userId: null,
    all: false,
    dryRun: false,
    perMix: null,
    date: null,
    yesterday: false,
    backfillDays: null,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--all') args.all = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yesterday') args.yesterday = true;
    else if (arg.startsWith('--user-id=')) {
      const v = arg.split('=')[1];
      args.userId = Number(v);
      if (!Number.isInteger(args.userId) || args.userId <= 0) {
        throw new Error(`Invalid --user-id=${v}`);
      }
    } else if (arg.startsWith('--limit-per-mix=') || arg.startsWith('--per-mix=')) {
      const v = arg.split('=')[1];
      args.perMix = Number(v);
      if (!Number.isInteger(args.perMix) || args.perMix <= 0) {
        throw new Error(`Invalid limit: ${v}`);
      }
    } else if (arg.startsWith('--date=')) {
      const v = arg.split('=')[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        throw new Error(`Invalid --date=${v} (expected YYYY-MM-DD)`);
      }
      args.date = v;
    } else if (arg.startsWith('--backfill-days=')) {
      const v = arg.split('=')[1];
      args.backfillDays = Number(v);
      if (!Number.isInteger(args.backfillDays) || args.backfillDays <= 0 || args.backfillDays > 14) {
        throw new Error(`Invalid --backfill-days=${v} (1-14)`);
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Cach su dung:

  # Tao/cap nhat 1 Daily Mix theo ngay cu the
  node scripts/recommendation/generateDailyMixes.js --user-id=<id> --date=YYYY-MM-DD
  node scripts/recommendation/generateDailyMixes.js --user-id=<id> --date=YYYY-MM-DD --dry-run

  # Tao/cap nhat Daily Mix cho ngay hom qua (scheduler mode)
  node scripts/recommendation/generateDailyMixes.js --user-id=<id> --yesterday
  node scripts/recommendation/generateDailyMixes.js --all --yesterday

  # Backfill 6 ngay gan nhat (Mon..Sun last week)
  node scripts/recommendation/generateDailyMixes.js --user-id=<id> --backfill-days=6

Options:
  --user-id=<id>         User can generate.
  --all                  Tat ca user active.
  --date=YYYY-MM-DD      Target date (mapping theo weekday).
  --yesterday            Target = hom qua.
  --backfill-days=<n>    Generate cho n ngay gan nhat (1-14).
  --limit-per-mix=<n>    So bai moi mix (default 25, max 30).
  --dry-run              Khong ghi DB.
  --help, -h             Help.`);
}

function fmtTop(ids) {
  if (!ids || !ids.length) return '[]';
  return `[${ids.slice(0, 10).join(', ')}${ids.length > 10 ? ', ...' : ''}]`;
}

function weekdayName(date) {
  const w = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
  return `${w} (${date.toISOString ? '' : ''}${date.toString().slice(0, 10)})`;
}

function printOneSummary(s) {
  console.log(`\n--- user_id=${s.userId} system_key=${s.systemKey} ---`);
  console.log(`target date   : ${s.targetDate} (${s.weekday})`);
  console.log(`target range  : [${s.targetRangeStart} 00:00 ICT, ${s.targetRangeEnd} 00:00 ICT)` +
    (s.isWeekendRange ? ' [WEEKEND RANGE]' : ''));
  console.log(`rec strategy  : ${s.strategy} (reason=${s.reason}, recItems=${s.recItemsCount})`);
  console.log(`historyCount  : ${s.historyCount} (target range goc)` +
    (s.usedFallbackHistory ? ` | profileCount=${s.profileCount} (fallback lookback 3d)` : '') +
    ` | distinctListened=${s.distinctListenedSongCount}` +
    ` | distinctTargetRange=${s.distinctTargetRangeSongCount}`);
  console.log(`top genres    : [${s.topGenres.join(', ')}]`);
  console.log(`top artists   : [${s.topArtists.join(', ')}]`);
  console.log(`top markets   : [${s.topMarkets.join(', ')}]`);
  console.log(`perMix        : ${s.perMix} | anchorRatio target: ${s.anchorTarget}/${s.perMix} = ${(s.anchorTarget / s.perMix).toFixed(2)}`);
  console.log(`anchorSelected: ${s.anchorSelected}`);
  console.log(`discovery     : ${s.discoverySelected} (target=${s.discoveryTarget}, popularAdded=${s.popularAdded})`);
  console.log(`finalSongCount: ${s.finalSongCount}`);
  console.log(`duplicateCount: ${s.duplicateCount}`);
  console.log(`listenedFromTargetDateCount: ${s.listenedFromTargetDateCount}` +
    ` (${s.anchorRatio * 100}% of final)` +
    (s.recentlyPlayedWarning ? '  [WARN: giong Recently Played qua nhieu]' : ''));
  console.log(`top 10 songs  : ${fmtTop(s.topSongIds)}`);
  if (!s.dryRun) {
    console.log(`playlistId    : ${s.playlistId} | created=${s.created} | inserted=${s.insertedSongs}`);
  } else {
    console.log(`mode          : dry-run (no DB write)`);
  }
}

async function runOne(userId, date, args) {
  const opts = { perMix: args.perMix, dryRun: args.dryRun };
  const summary = await dailyMixService.generateDailyMixForDate(userId, date, opts);
  printOneSummary(summary);
  return summary;
}

async function runAll(date, args) {
  const opts = { perMix: args.perMix, dryRun: args.dryRun };
  const [users] = await pool.query(
    `SELECT id FROM users WHERE status = 'active' AND role = 'user' ORDER BY id`
  );
  console.log(`Running Daily Mix for all active users (target=${dailyMixService.fmtDate(date)}, dry-run=${args.dryRun})...`);
  console.log(`user count: ${users.length}`);
  let ok = 0;
  let err = 0;
  let created = 0;
  let updated = 0;
  let songs = 0;
  const details = [];
  for (const u of users) {
    try {
      const r = await dailyMixService.generateDailyMixForDate(u.id, date, opts);
      if (r.created) created += 1; else updated += 1;
      songs += r.insertedSongs || 0;
      ok += 1;
      details.push({ userId: u.id, systemKey: r.systemKey, ok: true });
    } catch (e) {
      err += 1;
      details.push({ userId: u.id, ok: false, error: e.message });
    }
  }
  console.log('\n=== Summary ===');
  console.log(`users processed: ${users.length}`);
  if (!args.dryRun) {
    console.log(`playlists created: ${created}`);
    console.log(`playlists updated: ${updated}`);
    console.log(`songs inserted:    ${songs}`);
  } else {
    console.log(`mode: dry-run (no DB writes)`);
  }
  console.log(`skipped users:     ${err}`);
  console.log(`errors:            ${err}`);
  return { usersProcessed: users.length, created, updated, songs, errors: err, details };
}

function parseDateOrYesterday(args) {
  if (args.date) {
    return dailyMixService.parseDateInput(args.date);
  }
  if (args.yesterday) {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  }
  return null;
}

async function runBackfill(userId, days, args) {
  const opts = { perMix: args.perMix, dryRun: args.dryRun };
  console.log(`\nCẢNH BÁO: Backfill sẽ cập nhật nhiều Daily Mix cùng lúc, ngày cập nhật (updated_at) có thể giống nhau.`);
  console.log(`Backfill ${days} days for user ${userId}${args.dryRun ? ' (dry-run)' : ''}...`);
  // days ngày gần nhất (kết thúc hôm qua). Tạo danh sách ngày.
  const t = new Date();
  const yesterday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  const summaries = [];
  // Dedupe theo system_key: nếu gặp Sat và Sun trong range thì cùng map
  // dailymix_06, chỉ chạy 1 lần (ưu tiên target date đầu tiên xuất hiện).
  const seen = new Set();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() - i);
    const sk = dailyMixService.weekdayToSystemKey(d);
    if (sk && seen.has(sk)) {
      console.log(`  (skip ${dailyMixService.fmtDate(d)} ${dailyMixService.weekdayFull(d)} -> ${sk} da duoc tao bang ngay khac trong range)`);
      continue;
    }
    seen.add(sk);
    const r = await dailyMixService.generateDailyMixForDate(userId, d, opts);
    summaries.push(r);
    printOneSummary(r);
  }
  // Sanity: id của 6 playlist dailymix_*
  if (!args.dryRun) {
    const [rows] = await pool.query(
      `SELECT id, system_key, updated_at FROM playlists
       WHERE user_id = ? AND system_key IN ('dailymix_01','dailymix_02','dailymix_03','dailymix_04','dailymix_05','dailymix_06')
       ORDER BY system_key`,
      [userId],
    );
    console.log('\n=== Backfill result (DB state) ===');
    for (const r of rows) {
      const matching = summaries.find((s) => s.systemKey === r.system_key);
      const m = matching ? `${matching.finalSongCount} songs` : '?';
      console.log(`  ${r.system_key} id=${r.id} updated_at=${r.updated_at.toISOString()} ${m}`);
    }
  }
  return summaries;
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

  if (!args.userId && !args.all) {
    console.error('Cần --user-id=<id> hoặc --all. Dùng --help để xem hướng dẫn.');
    process.exit(2);
  }

  if (args.backfillDays != null) {
    if (args.all) {
      // Backfill all users (sequential, không in summary to)
      const [users] = await pool.query(
        `SELECT id FROM users WHERE status = 'active' AND role = 'user' ORDER BY id`
      );
      let ok = 0, err = 0;
      for (const u of users) {
        try {
          await runBackfill(u.id, args.backfillDays, { ...args, dryRun: true });
          ok += 1;
        } catch (e) {
          err += 1;
          console.warn(`user ${u.id} backfill failed: ${e.message}`);
        }
      }
      console.log(`\nbackfill all: ok=${ok} err=${err}`);
    } else {
      await runBackfill(args.userId, args.backfillDays, args);
    }
  } else {
    const date = parseDateOrYesterday(args);
    if (!date) {
      console.error('Cần --date=YYYY-MM-DD hoặc --yesterday hoặc --backfill-days=N. Dùng --help.');
      process.exit(2);
    }
    if (args.all) {
      await runAll(date, args);
    } else {
      await runOne(args.userId, date, args);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error('generateDailyMixes failed:', err);
  process.exit(1);
});
