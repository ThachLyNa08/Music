const { pool } = require('../config/database');

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
      status ENUM('running','success','failed','partial') NOT NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      duration_ms BIGINT NULL,
      total_users INT DEFAULT 0,
      total_playlists INT DEFAULT 0,
      success_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      skipped_count INT DEFAULT 0,
      error_message TEXT NULL,
      triggered_by_user_id BIGINT NULL,
      metadata JSON NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_operation_type (operation_type),
      INDEX idx_started_at (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getRunningGenerationRun(operationType = 'regenerate_all') {
  await ensureGenerationRunsTableExists();
  const [rows] = await pool.query(
    `SELECT *
     FROM system_playlist_generation_runs
     WHERE operation_type = ? AND status = 'running'
     ORDER BY started_at DESC
     LIMIT 1`,
    [operationType]
  );
  return rows[0] || null;
}

async function markStaleRunningGenerationRuns(operationType, staleMinutes = 60) {
  await ensureGenerationRunsTableExists();
  const safeMinutes = Math.max(5, Math.min(Number(staleMinutes) || 60, 24 * 60));
  await pool.query(
    `UPDATE system_playlist_generation_runs
     SET status = 'failed',
         finished_at = NOW(),
         duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
         error_message = COALESCE(error_message, ?)
     WHERE operation_type = ?
       AND status = 'running'
       AND started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [
      `Marked stale after ${safeMinutes} minutes`,
      operationType,
      safeMinutes
    ]
  );
}

async function startGenerationRun({ operationType = 'regenerate_all', triggeredByUserId = null, metadata = null } = {}) {
  await ensureGenerationRunsTableExists();
  await markStaleRunningGenerationRuns(operationType, 60);
  const running = await getRunningGenerationRun(operationType);
  if (running) {
    const err = new Error('Đang có tiến trình tạo lại playlist đang chạy');
    err.statusCode = 409;
    err.runningRun = running;
    throw err;
  }

  const [result] = await pool.query(
    `INSERT INTO system_playlist_generation_runs
      (operation_type, status, started_at, triggered_by_user_id, metadata)
     VALUES (?, 'running', NOW(), ?, ?)`,
    [
      operationType,
      triggeredByUserId || null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
  return result.insertId;
}

async function updateGenerationRunProgress(runId, data = {}) {
  await ensureGenerationRunsTableExists();
  await pool.query(
    `UPDATE system_playlist_generation_runs
     SET total_users = ?,
         total_playlists = ?,
         success_count = ?,
         failed_count = ?,
         skipped_count = ?,
         error_message = ?,
         metadata = ?
     WHERE id = ? AND status = 'running'`,
    [
      Number(data.totalUsers || 0),
      Number(data.totalPlaylists || 0),
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
  const status = ['success', 'failed', 'partial'].includes(data.status) ? data.status : 'success';
  await pool.query(
    `UPDATE system_playlist_generation_runs
     SET status = ?,
         finished_at = NOW(),
         duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000,
         total_users = ?,
         total_playlists = ?,
         success_count = ?,
         failed_count = ?,
         skipped_count = ?,
         error_message = ?,
         metadata = ?
     WHERE id = ?`,
    [
      status,
      Number(data.totalUsers || 0),
      Number(data.totalPlaylists || 0),
      Number(data.successCount || 0),
      Number(data.failedCount || 0),
      Number(data.skippedCount || 0),
      data.errorMessage || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      runId
    ]
  );
}

async function getOperationSummary() {
  await ensureGenerationRunsTableExists();
  const [[runningRow]] = await pool.query(
    `SELECT COUNT(*) AS runningJobs
     FROM system_playlist_generation_runs
     WHERE status = 'running'`
  );

  const [runs] = await pool.query(
    `SELECT *
     FROM system_playlist_generation_runs
     WHERE status IN ('success', 'failed', 'partial')
     ORDER BY COALESCE(finished_at, started_at) DESC
     LIMIT 1`
  );
  const lastRun = runs[0] || null;

  let averageGenerationTimeMs = null;
  const [successRuns] = await pool.query(
    `SELECT duration_ms, total_playlists
     FROM system_playlist_generation_runs
     WHERE status = 'success'
       AND duration_ms IS NOT NULL
       AND total_playlists > 0
     ORDER BY finished_at DESC
     LIMIT 1`
  );
  if (successRuns[0]) {
    averageGenerationTimeMs = Math.round(Number(successRuns[0].duration_ms || 0) / Number(successRuns[0].total_playlists || 1));
  }

  const failureRate = lastRun && Number(lastRun.total_playlists || 0) > 0
    ? Number((Number(lastRun.failed_count || 0) / Number(lastRun.total_playlists || 1)).toFixed(4))
    : null;

  return {
    failureRate,
    averageGenerationTimeMs,
    runningJobs: Number(runningRow?.runningJobs || 0),
    lastRegeneratedAt: lastRun?.finished_at || null,
    lastRunStatus: lastRun?.status || null
  };
}

async function getActivityLog(limit = 20) {
  await ensureGenerationRunsTableExists();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const [rows] = await pool.query(
    `SELECT r.id,
            r.operation_type,
            r.status,
            r.started_at,
            r.finished_at,
            r.duration_ms,
            r.total_playlists,
            r.success_count,
            r.failed_count,
            r.skipped_count,
            r.error_message,
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
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms !== null && row.duration_ms !== undefined ? Number(row.duration_ms) : null,
    totalPlaylists: Number(row.total_playlists || 0),
    successCount: Number(row.success_count || 0),
    failedCount: Number(row.failed_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    errorMessage: row.error_message || null,
    triggeredBy: row.triggered_by || 'Admin'
  }));
}

module.exports = {
  ensureLogTableExists,
  logSystemPlaylistRun,
  ensureGenerationRunsTableExists,
  getRunningGenerationRun,
  markStaleRunningGenerationRuns,
  startGenerationRun,
  updateGenerationRunProgress,
  finishGenerationRun,
  getOperationSummary,
  getActivityLog
};
