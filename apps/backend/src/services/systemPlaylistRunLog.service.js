const { pool } = require('../config/database');

const DEFAULT_RUN_TIMEOUT_MINUTES = 15;
const ACTIVE_GENERATION_STATUSES = ['queued', 'running', 'cancelling'];
const TERMINAL_GENERATION_STATUSES = ['success', 'partial_success', 'failed', 'stale', 'cancelled', 'skipped'];
const ALL_GENERATION_STATUSES = [...ACTIVE_GENERATION_STATUSES, ...TERMINAL_GENERATION_STATUSES, 'partial'];

function getRunTimeoutMinutes() {
  const parsed = Number(process.env.SYSTEM_PLAYLIST_RUN_TIMEOUT_MINUTES || DEFAULT_RUN_TIMEOUT_MINUTES);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RUN_TIMEOUT_MINUTES;
  return Math.max(1, Math.min(Math.floor(parsed), 24 * 60));
}

function normalizeGenerationStatus(status, fallback = 'success') {
  if (status === 'partial') return 'partial_success';
  return ALL_GENERATION_STATUSES.includes(status) ? status : fallback;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

async function ensureLogTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_playlist_runs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      system_key VARCHAR(100) NOT NULL,
      playlist_id INT UNSIGNED NULL,
      user_id INT UNSIGNED NULL,
      run_type ENUM('scheduled', 'manual', 'admin_all', 'script') NOT NULL DEFAULT 'scheduled',
      source_start_date DATE NULL,
      source_end_date DATE NULL,
      scheduled_for DATETIME NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      status ENUM('success', 'failed', 'partial', 'skipped') NOT NULL DEFAULT 'success',
      playlist_count INT DEFAULT 0,
      song_count INT DEFAULT 0,
      songs_added INT DEFAULT 0,
      songs_removed INT DEFAULT 0,
      total_songs INT DEFAULT 0,
      overlap_ratio DECIMAL(5,2) NULL,
      error_message TEXT NULL,
      message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_system_key_created_at (system_key, created_at),
      INDEX idx_scheduled_for (scheduled_for)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    ALTER TABLE system_playlist_runs
    MODIFY status ENUM('success', 'failed', 'partial', 'skipped') NOT NULL DEFAULT 'success'
  `);
  await addColumnIfMissing('system_playlist_runs', 'playlist_id', 'playlist_id INT UNSIGNED NULL AFTER system_key');
  await addColumnIfMissing('system_playlist_runs', 'user_id', 'user_id INT UNSIGNED NULL AFTER playlist_id');
  await addColumnIfMissing('system_playlist_runs', 'songs_added', 'songs_added INT DEFAULT 0 AFTER song_count');
  await addColumnIfMissing('system_playlist_runs', 'songs_removed', 'songs_removed INT DEFAULT 0 AFTER songs_added');
  await addColumnIfMissing('system_playlist_runs', 'total_songs', 'total_songs INT DEFAULT 0 AFTER songs_removed');
  await addColumnIfMissing('system_playlist_runs', 'error_message', 'error_message TEXT NULL AFTER overlap_ratio');
}

async function logSystemPlaylistRun(data) {
  const [result] = await pool.query(
    `INSERT INTO system_playlist_runs
     (system_key, playlist_id, user_id, run_type, source_start_date, source_end_date, scheduled_for,
      started_at, status, playlist_count, song_count, songs_added, songs_removed, total_songs,
      overlap_ratio, error_message, message, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      data.system_key,
      data.playlist_id || null,
      data.user_id || null,
      data.run_type || 'scheduled',
      data.source_start_date || null,
      data.source_end_date || null,
      data.scheduled_for || null,
      data.started_at || null,
      data.status || 'success',
      data.playlist_count || 0,
      data.song_count || 0,
      data.songs_added || 0,
      data.songs_removed || 0,
      data.total_songs || data.song_count || 0,
      data.overlap_ratio !== undefined ? data.overlap_ratio : null,
      data.error_message || null,
      data.message || null
    ]
  );
  return result.insertId;
}

async function ensureGenerationRunsTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_playlist_generation_runs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      operation_type VARCHAR(80) NOT NULL,
      status ENUM('queued','running','cancelling','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      heartbeat_at DATETIME NULL,
      duration_ms BIGINT NULL,
      total_users INT DEFAULT 0,
      total_count INT DEFAULT 0,
      processed_count INT DEFAULT 0,
      success_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      skipped_count INT DEFAULT 0,
      error_message TEXT NULL,
      cancel_requested TINYINT(1) DEFAULT 0,
      cancelled_at DATETIME NULL,
      trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin',
      scheduler_name VARCHAR(100) NULL,
      scheduled_for DATETIME NULL,
      mode VARCHAR(50) NULL,
      triggered_by_user_id BIGINT NULL,
      metadata JSON NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_operation_type (operation_type),
      INDEX idx_started_at (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    ALTER TABLE system_playlist_generation_runs
    MODIFY status ENUM('queued','running','cancelling','success','partial_success','failed','stale','cancelled','skipped','partial') NOT NULL
  `);
  await addColumnIfMissing('system_playlist_generation_runs', 'heartbeat_at', 'heartbeat_at DATETIME NULL AFTER finished_at');
  await addColumnIfMissing('system_playlist_generation_runs', 'duration_ms', 'duration_ms BIGINT NULL AFTER heartbeat_at');
  await addColumnIfMissing('system_playlist_generation_runs', 'total_users', 'total_users INT DEFAULT 0 AFTER duration_ms');
  await addColumnIfMissing('system_playlist_generation_runs', 'total_count', 'total_count INT DEFAULT 0 AFTER total_users');
  if (await columnExists('system_playlist_generation_runs', 'total_playlists')) {
    await pool.query(`
      UPDATE system_playlist_generation_runs
      SET total_count = COALESCE(NULLIF(total_count, 0), total_playlists, 0)
      WHERE total_count IS NULL OR total_count = 0
    `);
  }
  await addColumnIfMissing('system_playlist_generation_runs', 'processed_count', 'processed_count INT DEFAULT 0 AFTER total_count');
  await addColumnIfMissing('system_playlist_generation_runs', 'success_count', 'success_count INT DEFAULT 0 AFTER processed_count');
  await addColumnIfMissing('system_playlist_generation_runs', 'failed_count', 'failed_count INT DEFAULT 0 AFTER success_count');
  await addColumnIfMissing('system_playlist_generation_runs', 'skipped_count', 'skipped_count INT DEFAULT 0 AFTER failed_count');
  await addColumnIfMissing('system_playlist_generation_runs', 'error_message', 'error_message TEXT NULL AFTER skipped_count');
  await addColumnIfMissing('system_playlist_generation_runs', 'cancel_requested', 'cancel_requested TINYINT(1) DEFAULT 0 AFTER error_message');
  await addColumnIfMissing('system_playlist_generation_runs', 'cancelled_at', 'cancelled_at DATETIME NULL AFTER cancel_requested');
  await addColumnIfMissing('system_playlist_generation_runs', 'trigger_source', "trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin' AFTER cancelled_at");
  await addColumnIfMissing('system_playlist_generation_runs', 'scheduler_name', 'scheduler_name VARCHAR(100) NULL AFTER trigger_source');
  await addColumnIfMissing('system_playlist_generation_runs', 'scheduled_for', 'scheduled_for DATETIME NULL AFTER scheduler_name');
  await addColumnIfMissing('system_playlist_generation_runs', 'mode', 'mode VARCHAR(50) NULL AFTER scheduled_for');
  await pool.query("ALTER TABLE system_playlist_generation_runs MODIFY COLUMN trigger_source VARCHAR(30) NOT NULL DEFAULT 'admin'");
  await pool.query('ALTER TABLE system_playlist_generation_runs MODIFY COLUMN scheduler_name VARCHAR(100) NULL');
  await pool.query('ALTER TABLE system_playlist_generation_runs MODIFY COLUMN mode VARCHAR(50) NULL');
}

async function recoverStaleSystemPlaylistRuns(operationType = null, staleMinutes = null) {
  await ensureGenerationRunsTableExists();
  const safeMinutes = Math.max(1, Math.min(Number(staleMinutes) || getRunTimeoutMinutes(), 24 * 60));
  const params = [
    'System playlist regenerate job timed out or backend stopped before completion.',
    safeMinutes
  ];
  let operationFilter = '';
  if (operationType) {
    operationFilter = 'AND operation_type = ?';
    params.push(operationType);
  }

  const [result] = await pool.query(
    `UPDATE system_playlist_generation_runs
     SET status = 'stale',
         finished_at = NOW(),
         duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
         error_message = COALESCE(error_message, ?)
     WHERE status IN ('queued', 'running', 'cancelling')
       AND COALESCE(cancel_requested, 0) = 0
       AND COALESCE(heartbeat_at, started_at, created_at) < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ${operationFilter}`,
    params
  );
  const [cancelResult] = await pool.query(
    `UPDATE system_playlist_generation_runs
     SET status = 'cancelled',
         cancelled_at = COALESCE(cancelled_at, NOW()),
         finished_at = COALESCE(finished_at, NOW()),
         duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
         error_message = COALESCE(error_message, 'System playlist regenerate job was cancelled by admin.')
     WHERE status IN ('queued', 'running', 'cancelling')
       AND COALESCE(cancel_requested, 0) = 1
       AND COALESCE(heartbeat_at, started_at, created_at) < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ${operationFilter}`,
    operationType ? [safeMinutes, operationType] : [safeMinutes]
  );
  return Number(result.affectedRows || 0) + Number(cancelResult.affectedRows || 0);
}

async function markStaleRunningGenerationRuns(operationType, staleMinutes = null) {
  return recoverStaleSystemPlaylistRuns(operationType, staleMinutes);
}

async function getRunningGenerationRun(operationType = 'regenerate_all') {
  await ensureGenerationRunsTableExists();
  await recoverStaleSystemPlaylistRuns(operationType);
  const [rows] = await pool.query(
    `SELECT *
     FROM system_playlist_generation_runs
     WHERE operation_type = ?
       AND status IN ('queued', 'running', 'cancelling')
       AND COALESCE(heartbeat_at, started_at, created_at) >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     ORDER BY started_at DESC
     LIMIT 1`,
    [operationType, getRunTimeoutMinutes()]
  );
  return rows[0] || null;
}

async function startGenerationRun({
  operationType = 'regenerate_all',
  triggeredByUserId = null,
  metadata = null,
  totalUsers = 0,
  totalPlaylists = 0,
  status = 'running',
  triggerSource = 'admin',
  schedulerName = null,
  scheduledFor = null,
  mode = null
} = {}) {
  await ensureGenerationRunsTableExists();
  const conn = await pool.getConnection();
  const lockName = `system_playlist_generation:${operationType}`;

  try {
    const [[lockRow]] = await conn.query('SELECT GET_LOCK(?, 5) AS lockAcquired', [lockName]);
    if (Number(lockRow?.lockAcquired || 0) !== 1) {
      const err = new Error('Dang co tac vu tao lai playlist he thong. Vui long cho hoan tat.');
      err.statusCode = 409;
      err.code = 'SYSTEM_PLAYLIST_REGENERATE_ALREADY_RUNNING';
      throw err;
    }

    try {
      await recoverStaleSystemPlaylistRuns(operationType);
      const running = await getRunningGenerationRun(operationType);
      if (running) {
        const err = new Error('Dang co tac vu tao lai playlist he thong. Vui long cho hoan tat.');
        err.statusCode = 409;
        err.code = 'SYSTEM_PLAYLIST_REGENERATE_ALREADY_RUNNING';
        err.runningRun = running;
        throw err;
      }

      const initialStatus = ACTIVE_GENERATION_STATUSES.includes(status) ? status : 'running';
      const [result] = await conn.query(
        `INSERT INTO system_playlist_generation_runs
          (operation_type, status, started_at, heartbeat_at, total_users, total_count,
           trigger_source, scheduler_name, scheduled_for, mode, triggered_by_user_id, metadata)
         VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operationType,
          initialStatus,
          Number(totalUsers || 0),
          Number(totalPlaylists || 0),
          ['scheduler', 'admin', 'user_lazy', 'recovery'].includes(triggerSource) ? triggerSource : 'admin',
          schedulerName || null,
          scheduledFor || null,
          mode || null,
          triggeredByUserId || null,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
      return result.insertId;
    } finally {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (_) {
        // best effort
      }
    }
  } finally {
    conn.release();
  }
}

async function updateGenerationRunProgress(runId, data = {}) {
  await ensureGenerationRunsTableExists();
  await pool.query(
    `UPDATE system_playlist_generation_runs
     SET total_users = ?,
         total_count = ?,
         processed_count = ?,
         success_count = ?,
         failed_count = ?,
         skipped_count = ?,
         heartbeat_at = NOW(),
         error_message = ?,
         metadata = ?
     WHERE id = ? AND status IN ('queued', 'running', 'cancelling')`,
    [
      Number(data.totalUsers || 0),
      Number(data.totalPlaylists || 0),
      Number(data.processedCount ?? (Number(data.successCount || 0) + Number(data.failedCount || 0) + Number(data.skippedCount || 0))),
      Number(data.successCount || 0),
      Number(data.failedCount || 0),
      Number(data.skippedCount || 0),
      data.errorMessage || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      runId
    ]
  );
}

async function finishGenerationRun(runId, data = {}) {
  await ensureGenerationRunsTableExists();
  const status = normalizeGenerationStatus(data.status, 'success');
  await pool.query(
    `UPDATE system_playlist_generation_runs
     SET status = ?,
         finished_at = NOW(),
         cancelled_at = CASE WHEN ? = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
         heartbeat_at = COALESCE(heartbeat_at, NOW()),
         duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
         total_users = ?,
         total_count = ?,
         processed_count = ?,
         success_count = ?,
         failed_count = ?,
         skipped_count = ?,
         error_message = ?,
         metadata = ?
     WHERE id = ? AND status IN ('queued', 'running', 'cancelling')`,
    [
      status,
      status,
      Number(data.totalUsers || 0),
      Number(data.totalPlaylists || 0),
      Number(data.processedCount ?? (Number(data.successCount || 0) + Number(data.failedCount || 0) + Number(data.skippedCount || 0))),
      Number(data.successCount || 0),
      Number(data.failedCount || 0),
      Number(data.skippedCount || 0),
      data.errorMessage || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      runId
    ]
  );
}

async function cancelGenerationRun(runId, message = 'System playlist regenerate job was reset by admin.') {
  await ensureGenerationRunsTableExists();
  const [result] = await pool.query(
    `UPDATE system_playlist_generation_runs
     SET status = 'cancelling',
         cancel_requested = 1,
         cancelled_at = NOW(),
         heartbeat_at = NOW(),
         error_message = COALESCE(?, error_message)
     WHERE id = ?
       AND status IN ('queued', 'running', 'cancelling')`,
    [message, runId]
  );
  return Number(result.affectedRows || 0);
}

async function getGenerationRun(runId) {
  await ensureGenerationRunsTableExists();
  await recoverStaleSystemPlaylistRuns();
  const [rows] = await pool.query(
    `SELECT *
     FROM system_playlist_generation_runs
     WHERE id = ?
     LIMIT 1`,
    [runId]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    operationType: row.operation_type,
    status: normalizeGenerationStatus(row.status),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    heartbeatAt: row.heartbeat_at,
    durationMs: row.duration_ms !== null && row.duration_ms !== undefined ? Number(row.duration_ms) : null,
    totalUsers: Number(row.total_users || 0),
    totalPlaylists: Number(row.total_count || 0),
    processedCount: Number(row.processed_count || 0),
    successCount: Number(row.success_count || 0),
    failedCount: Number(row.failed_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    cancelRequested: Number(row.cancel_requested || 0) === 1,
    cancelledAt: row.cancelled_at || null,
    triggerSource: row.trigger_source || 'admin',
    schedulerName: row.scheduler_name || null,
    scheduledFor: row.scheduled_for || null,
    mode: row.mode || null,
    errorMessage: row.error_message || null,
    metadata: row.metadata || null
  };
}

async function getOperationSummary() {
  await ensureGenerationRunsTableExists();
  await recoverStaleSystemPlaylistRuns();
  const [[runningRow]] = await pool.query(
    `SELECT COUNT(*) AS runningJobs
     FROM system_playlist_generation_runs
     WHERE status IN ('queued', 'running', 'cancelling')
       AND COALESCE(heartbeat_at, started_at, created_at) >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [getRunTimeoutMinutes()]
  );

  const [runs] = await pool.query(
    `SELECT *
     FROM system_playlist_generation_runs
     WHERE status IN ('success', 'partial_success', 'failed', 'stale', 'cancelled', 'skipped', 'partial')
     ORDER BY COALESCE(finished_at, started_at) DESC
     LIMIT 1`
  );
  const lastRun = runs[0] || null;

  let averageGenerationTimeMs = null;
  const [successRuns] = await pool.query(
    `SELECT duration_ms, total_count
     FROM system_playlist_generation_runs
     WHERE status = 'success'
       AND duration_ms IS NOT NULL
       AND total_count > 0
     ORDER BY finished_at DESC
     LIMIT 1`
  );
  if (successRuns[0]) {
    averageGenerationTimeMs = Math.round(Number(successRuns[0].duration_ms || 0) / Number(successRuns[0].total_count || 1));
  }

  const failureRate = lastRun && Number(lastRun.total_count || 0) > 0
    ? Number((Number(lastRun.failed_count || 0) / Number(lastRun.total_count || 1)).toFixed(4))
    : null;

  return {
    failureRate,
    averageGenerationTimeMs,
    runningJobs: Number(runningRow?.runningJobs || 0),
    lastRegeneratedAt: lastRun?.finished_at || null,
    lastRunStatus: lastRun ? normalizeGenerationStatus(lastRun.status) : null
  };
}

async function getActivityLog(limit = 20) {
  await ensureGenerationRunsTableExists();
  await recoverStaleSystemPlaylistRuns();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const [rows] = await pool.query(
    `SELECT r.id,
            r.operation_type,
            r.status,
            r.started_at,
            r.finished_at,
            r.heartbeat_at,
            r.duration_ms,
            r.total_count,
            r.processed_count,
            r.success_count,
            r.failed_count,
            r.skipped_count,
            r.error_message,
            r.cancel_requested,
            r.cancelled_at,
            r.trigger_source,
            r.scheduler_name,
            r.scheduled_for,
            r.mode,
            r.triggered_by_user_id,
            COALESCE(u.display_name, u.email, 'Admin') AS triggered_by
     FROM system_playlist_generation_runs r
     LEFT JOIN users u ON u.id = r.triggered_by_user_id
     ORDER BY r.started_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    operationType: row.operation_type,
    status: normalizeGenerationStatus(row.status),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    heartbeatAt: row.heartbeat_at,
    durationMs: row.duration_ms !== null && row.duration_ms !== undefined ? Number(row.duration_ms) : null,
    totalPlaylists: Number(row.total_count || 0),
    processedCount: Number(row.processed_count || 0),
    successCount: Number(row.success_count || 0),
    failedCount: Number(row.failed_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    cancelRequested: Number(row.cancel_requested || 0) === 1,
    cancelledAt: row.cancelled_at || null,
    triggerSource: row.trigger_source || 'admin',
    schedulerName: row.scheduler_name || null,
    scheduledFor: row.scheduled_for || null,
    mode: row.mode || null,
    errorMessage: row.error_message || null,
    triggeredBy: row.triggered_by || 'Admin'
  }));
}

async function getScheduleRunSummary(schedulerNames = []) {
  await ensureGenerationRunsTableExists();
  await recoverStaleSystemPlaylistRuns();
  const names = [...new Set((schedulerNames || []).map((name) => String(name || '').trim()).filter(Boolean))];
  if (!names.length) return {};
  const placeholders = names.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT *
     FROM system_playlist_generation_runs
     WHERE scheduler_name IN (${placeholders})
     ORDER BY started_at DESC`,
    names
  );
  const summary = {};
  for (const name of names) summary[name] = { lastRun: null, lastSuccess: null };
  for (const row of rows) {
    const name = row.scheduler_name;
    if (!summary[name]) summary[name] = { lastRun: null, lastSuccess: null };
    if (!summary[name].lastRun) summary[name].lastRun = row;
    if (!summary[name].lastSuccess && ['success', 'partial_success'].includes(normalizeGenerationStatus(row.status))) {
      summary[name].lastSuccess = row;
    }
  }
  return summary;
}

module.exports = {
  ensureLogTableExists,
  logSystemPlaylistRun,
  ensureGenerationRunsTableExists,
  getRunningGenerationRun,
  markStaleRunningGenerationRuns,
  recoverStaleSystemPlaylistRuns,
  startGenerationRun,
  updateGenerationRunProgress,
  finishGenerationRun,
  cancelGenerationRun,
  getGenerationRun,
  getOperationSummary,
  getActivityLog,
  getScheduleRunSummary,
  normalizeGenerationStatus,
  getRunTimeoutMinutes,
  ACTIVE_GENERATION_STATUSES,
  TERMINAL_GENERATION_STATUSES
};
