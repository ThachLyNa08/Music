const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const runLogService = require('../src/services/systemPlaylistRunLog.service');

function parseArgs(argv) {
  const runIdIndex = argv.indexOf('--run-id');
  const statusIndex = argv.indexOf('--status');
  return {
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    apply: argv.includes('--apply'),
    runId: runIdIndex >= 0 ? Number(argv[runIdIndex + 1]) : null,
    status: statusIndex >= 0 ? String(argv[statusIndex + 1] || 'stale') : 'stale'
  };
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesSince(value) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function recommendedAction(row, timeoutMinutes) {
  const total = Number(row.total_count || 0);
  const heartbeatBase = row.heartbeat_at || row.started_at || row.created_at;
  const ageMinutes = minutesSince(heartbeatBase);
  if (['queued', 'running'].includes(row.status) && total <= 0) return 'mark_stale';
  if (['queued', 'running'].includes(row.status) && ageMinutes !== null && ageMinutes >= timeoutMinutes) return 'mark_stale';
  return 'none';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timeoutMinutes = runLogService.getRunTimeoutMinutes();

  await runLogService.ensureGenerationRunsTableExists();
  if (args.runId && args.apply) {
    const status = ['stale', 'failed', 'cancelled'].includes(args.status) ? args.status : 'stale';
    const [result] = await pool.query(
      `UPDATE system_playlist_generation_runs
       SET status = ?,
           finished_at = NOW(),
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
           error_message = COALESCE(error_message, ?)
       WHERE id = ?
         AND status IN ('queued', 'running')`,
      [status, `Recovered manually by recover_stuck_system_playlist_runs.js --run-id ${args.runId}`, args.runId]
    );
    console.log(`Applied ${status} to run ${args.runId}. affectedRows=${Number(result.affectedRows || 0)}`);
    return;
  }

  const [rows] = await pool.query(
    `SELECT id,
            operation_type,
            status,
            total_count,
            processed_count,
            success_count,
            failed_count,
            started_at,
            heartbeat_at,
            created_at
     FROM system_playlist_generation_runs
     WHERE status IN ('queued', 'running')
        OR (status IN ('failed', 'stale') AND finished_at >= DATE_SUB(NOW(), INTERVAL 1 DAY))
     ORDER BY started_at DESC
     LIMIT 100`
  );

  const report = rows.map((row) => {
    const action = recommendedAction(row, timeoutMinutes);
    return {
      run_id: Number(row.id),
      type: row.operation_type,
      status: row.status,
      total_count: Number(row.total_count || 0),
      processed_count: Number(row.processed_count || 0),
      success_count: Number(row.success_count || 0),
      failed_count: Number(row.failed_count || 0),
      started_at: row.started_at,
      heartbeat_at: row.heartbeat_at,
      age_minutes: minutesSince(row.heartbeat_at || row.started_at || row.created_at),
      recommended_action: action
    };
  });

  console.table(report);

  if (args.apply) {
    const ids = report
      .filter((row) => row.recommended_action === 'mark_stale')
      .map((row) => row.run_id);

    if (ids.length > 0) {
      await pool.query(
        `UPDATE system_playlist_generation_runs
         SET status = 'stale',
             finished_at = NOW(),
             duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
             error_message = COALESCE(error_message, 'Recovered by recover_stuck_system_playlist_runs.js')
         WHERE id IN (?)`,
        [ids]
      );
    }
    console.log(`Applied recovery to ${ids.length} run(s).`);
  } else {
    console.log('Dry run only. Re-run with --apply to mark recommended rows as stale.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
