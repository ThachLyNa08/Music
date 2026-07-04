const { pool } = require('../config/database');

async function ensureLogTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_playlist_runs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      system_key VARCHAR(100) NOT NULL,
      run_type ENUM('scheduled', 'manual', 'admin_all', 'script') NOT NULL DEFAULT 'scheduled',
      source_start_date DATE NULL,
      source_end_date DATE NULL,
      scheduled_for DATETIME NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      status ENUM('success', 'failed', 'skipped') NOT NULL DEFAULT 'success',
      playlist_count INT DEFAULT 0,
      song_count INT DEFAULT 0,
      overlap_ratio DECIMAL(5,2) NULL,
      message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_system_key_created_at (system_key, created_at),
      INDEX idx_scheduled_for (scheduled_for)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function logSystemPlaylistRun(data) {
  const [result] = await pool.query(
    `INSERT INTO system_playlist_runs 
     (system_key, run_type, source_start_date, source_end_date, scheduled_for, status, playlist_count, song_count, overlap_ratio, message, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      data.system_key, 
      data.run_type || 'scheduled', 
      data.source_start_date || null, 
      data.source_end_date || null, 
      data.scheduled_for || null,
      data.status || 'success',
      data.playlist_count || 0,
      data.song_count || 0,
      data.overlap_ratio !== undefined ? data.overlap_ratio : null,
      data.message || null
    ]
  );
  return result.insertId;
}

module.exports = {
  ensureLogTableExists,
  logSystemPlaylistRun
};
