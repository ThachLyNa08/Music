const os = require('os');
const crypto = require('crypto');
const { pool } = require('../config/database');

const DEFAULT_LOCK_TTL_MINUTES = 120;

function getLockTtlMinutes(value = process.env.SYSTEM_PLAYLIST_CRON_LOCK_TTL_MINUTES) {
  const parsed = Number(value || DEFAULT_LOCK_TTL_MINUTES);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LOCK_TTL_MINUTES;
  return Math.max(1, Math.min(Math.floor(parsed), 24 * 60));
}

async function ensureSchedulerLockTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_scheduler_locks (
      lock_key VARCHAR(100) NOT NULL PRIMARY KEY,
      locked_until DATETIME NOT NULL,
      locked_by VARCHAR(255) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_system_scheduler_locks_until (locked_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function acquireSchedulerLock(lockKey, ttlMinutes = null) {
  await ensureSchedulerLockTableExists();
  const safeTtl = getLockTtlMinutes(ttlMinutes);
  const owner = `${os.hostname()}:${process.pid}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
  const [[existingLock]] = await pool.query(
    `SELECT locked_by, locked_until
     FROM system_scheduler_locks
     WHERE lock_key = ?
     LIMIT 1`,
    [lockKey]
  );

  await pool.query(
    `INSERT INTO system_scheduler_locks (lock_key, locked_until, locked_by)
     VALUES (?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)
     ON DUPLICATE KEY UPDATE
       locked_until = IF(locked_until < NOW(), VALUES(locked_until), locked_until),
       locked_by = IF(locked_until < NOW(), VALUES(locked_by), locked_by),
       updated_at = IF(locked_until < NOW(), NOW(), updated_at)`,
    [lockKey, safeTtl, owner]
  );

  const [[row]] = await pool.query(
    `SELECT locked_by, locked_until
     FROM system_scheduler_locks
     WHERE lock_key = ?
     LIMIT 1`,
    [lockKey]
  );

  const staleReleased = existingLock?.locked_until && new Date(existingLock.locked_until) < new Date();
  if (staleReleased) {
    console.log(`[SystemPlaylistCron] stale lock released lock_key=${lockKey} locked_until=${existingLock.locked_until}`);
  }

  return {
    acquired: row?.locked_by === owner,
    owner,
    lockedUntil: row?.locked_until || null
  };
}

async function releaseSchedulerLock(lockKey, owner) {
  if (!lockKey || !owner) return 0;
  await ensureSchedulerLockTableExists();
  const [result] = await pool.query(
    `UPDATE system_scheduler_locks
     SET locked_until = NOW(),
         updated_at = NOW()
     WHERE lock_key = ?
       AND locked_by = ?`,
    [lockKey, owner]
  );
  return Number(result.affectedRows || 0);
}

async function getSchedulerLockStatus(lockKey) {
  await ensureSchedulerLockTableExists();
  const [[row]] = await pool.query(
    `SELECT lock_key, locked_by, locked_until, updated_at
     FROM system_scheduler_locks
     WHERE lock_key = ?
     LIMIT 1`,
    [lockKey]
  );
  if (!row) {
    return { exists: false, active: false, lockedUntil: null, lockedBy: null };
  }
  const lockedUntil = row.locked_until || null;
  return {
    exists: true,
    active: lockedUntil ? new Date(lockedUntil) > new Date() : false,
    lockedUntil,
    lockedBy: row.locked_by || null,
    updatedAt: row.updated_at || null
  };
}

module.exports = {
  acquireSchedulerLock,
  releaseSchedulerLock,
  getSchedulerLockStatus,
  ensureSchedulerLockTableExists,
  getLockTtlMinutes
};
