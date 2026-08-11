const { pool } = require('../config/database');
const notificationService = require('./notification.service');

const LOCK_KEY = 'song_release_scheduler';

async function ensureReleaseLockTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_scheduler_locks (
      lock_key VARCHAR(100) NOT NULL PRIMARY KEY,
      locked_until DATETIME NOT NULL,
      locked_by VARCHAR(100) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function acquireReleaseLock(ttlMinutes = 10) {
  await ensureReleaseLockTable();
  const lockedBy = `${process.pid}@${require('os').hostname()}`;
  const [result] = await pool.query(
    `INSERT INTO system_scheduler_locks (lock_key, locked_until, locked_by)
     VALUES (?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)
     ON DUPLICATE KEY UPDATE
       locked_until = IF(locked_until < NOW(), VALUES(locked_until), locked_until),
       locked_by = IF(locked_until < NOW(), VALUES(locked_by), locked_by)`,
    [LOCK_KEY, ttlMinutes, lockedBy]
  );
  return result.affectedRows === 1 || result.affectedRows === 2;
}

async function releaseLock() {
  await pool.query(
    'UPDATE system_scheduler_locks SET locked_until = NOW() WHERE lock_key = ?',
    [LOCK_KEY]
  );
}

async function releaseScheduledSongs() {
  const acquired = await acquireReleaseLock();
  if (!acquired) {
    console.log('[SongRelease] skipped because another release job is active');
    return { releasedCount: 0, skipped: true };
  }

  try {
    const [songs] = await pool.query(
      `SELECT s.id, s.title, s.artist_id, s.cover_url, a.name AS artist_name
       FROM songs s
       LEFT JOIN artists a ON a.id = s.artist_id
       WHERE s.review_status = 'approved'
         AND s.is_active = TRUE
         AND s.release_status = 'scheduled'
         AND s.release_at IS NOT NULL
         AND s.release_at <= NOW()
       LIMIT 500`
    );

    if (!songs.length) {
      console.log('[SongRelease] no scheduled songs ready');
      return { releasedCount: 0, skipped: false };
    }

    const ids = songs.map(song => song.id);
    await pool.query(
      `UPDATE songs
       SET release_status = 'published',
           published_at = COALESCE(published_at, NOW())
       WHERE id IN (?)
         AND review_status = 'approved'
         AND release_status = 'scheduled'
         AND release_at <= NOW()`,
      [ids]
    );

    for (const song of songs) {
      await notificationService.notifyInterestedUsersContentApproved({
        contentType: 'song',
        contentId: song.id,
        title: song.title,
        artistId: song.artist_id,
        artistName: song.artist_name || 'Nghệ sĩ',
        coverUrl: song.cover_url || ''
      });
    }

    console.log(`[SongRelease] released ${songs.length} scheduled song(s)`);
    return { releasedCount: songs.length, skipped: false };
  } finally {
    await releaseLock().catch(() => {});
  }
}

module.exports = {
  releaseScheduledSongs
};
