const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { getIo, notifyUser } = require('./socket.service');
const { createNotification } = require('./notification.service');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads');
const PUBLIC_STEMS_PREFIX = '/uploads/stems';

const STEM_STATUSES = {
  QUEUED: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALE: 'stale',
  CANCELLED: 'cancelled',
};

const ACTIVE_STEM_STATUSES = [STEM_STATUSES.QUEUED, STEM_STATUSES.PROCESSING];
const RETRYABLE_STEM_STATUSES = new Set([STEM_STATUSES.FAILED, STEM_STATUSES.STALE]);
const STALE_ERROR_MESSAGE = 'Stem processing interrupted or timed out. Please retry.';

function normalizeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    song_id: row.song_id,
    status: row.status,
    progress: Number(row.progress) || 0,
    input_audio_url: row.input_audio_url,
    vocals_url: row.vocals_url,
    instrumental_url: row.instrumental_url,
    error_message: row.error_message,
    job_id: row.job_id || String(row.id),
    locked_by: row.locked_by || null,
    started_at: row.started_at || null,
    heartbeat_at: row.heartbeat_at || null,
    completed_at: row.completed_at || null,
    failed_at: row.failed_at || null,
    retry_count: Number(row.retry_count) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeSongStem(row, userId = null) {
  if (!row) return null;
  return {
    id: row.latest_job_id || row.id,
    stem_id: row.id,
    user_id: row.user_id || userId,
    song_id: row.song_id,
    status: row.status,
    progress: row.status === 'completed' ? 100 : row.status === 'processing' ? 50 : 0,
    input_audio_url: row.input_audio_url || null,
    vocals_url: row.vocals_url,
    instrumental_url: row.instrumental_url,
    error_message: row.error_message,
    job_id: row.job_id || row.latest_job_id || null,
    locked_by: row.locked_by || null,
    started_at: row.started_at || null,
    heartbeat_at: row.heartbeat_at || null,
    completed_at: row.completed_at || row.processed_at || null,
    failed_at: row.failed_at || null,
    retry_count: Number(row.retry_count) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    processed_at: row.processed_at,
  };
}

function getUserId(user) {
  const id = Number(user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function getStemTimeoutMinutes() {
  return Math.max(1, Number(process.env.STEM_PROCESSING_TIMEOUT_MINUTES || 60));
}

function getBackendBaseUrl() {
  return process.env.BACKEND_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

function getAiServiceUrl() {
  return (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

function isMissingSongStemsTable(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' && /song_stems/i.test(err.message || '');
}

function isMissingStemJobColumn(err) {
  return err?.code === 'ER_BAD_FIELD_ERROR' && /(job_id|locked_by|started_at|heartbeat_at|completed_at|failed_at|retry_count)/i.test(err.message || '');
}

function publicUrlToUploadsPath(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string') return null;

  let pathname = audioUrl.trim();
  if (/^https?:\/\//i.test(pathname)) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith('/uploads/')) return null;

  let relative = pathname.replace(/^\/uploads\//, '');
  try {
    relative = decodeURIComponent(relative);
  } catch {
    return null;
  }

  const resolved = path.resolve(UPLOADS_ROOT, relative);
  return resolved.startsWith(UPLOADS_ROOT + path.sep) ? resolved : null;
}

function fileExistsAndNonEmpty(filePath) {
  if (!filePath) return false;
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function publicStemUrlExists(publicUrl) {
  const filePath = publicUrlToUploadsPath(publicUrl);
  return Boolean(filePath && fileExistsAndNonEmpty(filePath));
}

function stemPublicUrls(songId) {
  return {
    vocalsUrl: `${PUBLIC_STEMS_PREFIX}/${songId}/vocals.mp3`,
    instrumentalUrl: `${PUBLIC_STEMS_PREFIX}/${songId}/instrumental.mp3`,
  };
}

function stemOutputPaths(songId) {
  const stemDir = path.join(UPLOADS_ROOT, 'stems', String(songId));
  return {
    stemDir,
    vocalsPath: path.join(stemDir, 'vocals.mp3'),
    instrumentalPath: path.join(stemDir, 'instrumental.mp3'),
  };
}

function hasStemOutputFiles(songId) {
  const { vocalsPath, instrumentalPath } = stemOutputPaths(songId);
  return fileExistsAndNonEmpty(vocalsPath) && fileExistsAndNonEmpty(instrumentalPath);
}

function cleanupPartialStemFiles(songId) {
  const { stemDir, vocalsPath, instrumentalPath } = stemOutputPaths(songId);
  if (!fs.existsSync(stemDir)) return;
  const candidates = [
    `${vocalsPath}.tmp`,
    `${instrumentalPath}.tmp`,
    vocalsPath.replace(/\.mp3$/i, '.tmp.mp3'),
    instrumentalPath.replace(/\.mp3$/i, '.tmp.mp3'),
  ];
  for (const target of candidates) {
    try {
      const resolved = path.resolve(target);
      if (resolved.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        console.log(`[StemRecovery] removed partial file ${resolved}`);
      }
    } catch (err) {
      console.warn(`[StemRecovery] cannot remove partial file ${target}: ${err.message}`);
    }
  }
}

function isStemJobTimedOut(row, timeoutMinutes = getStemTimeoutMinutes()) {
  if (!row || row.status !== STEM_STATUSES.PROCESSING) return false;
  const basis = row.heartbeat_at || row.updated_at || row.started_at || row.created_at;
  if (!basis) return false;
  return Date.now() - new Date(basis).getTime() > timeoutMinutes * 60 * 1000;
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await tableExists(tableName)) || await columnExists(tableName, columnName)) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`[StemSchema] added ${tableName}.${columnName}`);
}

async function ensureStemSchema() {
  if (await tableExists('song_stems')) {
    await pool.query("ALTER TABLE song_stems MODIFY COLUMN status ENUM('pending','processing','completed','failed','stale','cancelled') NOT NULL DEFAULT 'pending'");
    await addColumnIfMissing('song_stems', 'job_id', 'VARCHAR(64) NULL AFTER song_id');
    await addColumnIfMissing('song_stems', 'locked_by', 'VARCHAR(128) NULL AFTER job_id');
    await addColumnIfMissing('song_stems', 'started_at', 'DATETIME NULL AFTER error_message');
    await addColumnIfMissing('song_stems', 'heartbeat_at', 'DATETIME NULL AFTER started_at');
    await addColumnIfMissing('song_stems', 'completed_at', 'DATETIME NULL AFTER heartbeat_at');
    await addColumnIfMissing('song_stems', 'failed_at', 'DATETIME NULL AFTER completed_at');
    await addColumnIfMissing('song_stems', 'retry_count', 'INT NOT NULL DEFAULT 0 AFTER failed_at');
  }
  if (await tableExists('stem_separation_jobs')) {
    await pool.query("ALTER TABLE stem_separation_jobs MODIFY COLUMN status ENUM('pending','processing','completed','failed','stale','cancelled') NOT NULL DEFAULT 'pending'");
    await addColumnIfMissing('stem_separation_jobs', 'job_id', 'VARCHAR(64) NULL AFTER id');
    await addColumnIfMissing('stem_separation_jobs', 'locked_by', 'VARCHAR(128) NULL AFTER job_id');
    await addColumnIfMissing('stem_separation_jobs', 'started_at', 'DATETIME NULL AFTER error_message');
    await addColumnIfMissing('stem_separation_jobs', 'heartbeat_at', 'DATETIME NULL AFTER started_at');
    await addColumnIfMissing('stem_separation_jobs', 'completed_at', 'DATETIME NULL AFTER heartbeat_at');
    await addColumnIfMissing('stem_separation_jobs', 'failed_at', 'DATETIME NULL AFTER completed_at');
    await addColumnIfMissing('stem_separation_jobs', 'retry_count', 'INT NOT NULL DEFAULT 0 AFTER failed_at');
  }
}

async function getSong(songId) {
  const [rows] = await pool.query(
    `SELECT id, title, audio_url FROM songs WHERE id = ? AND ${publicSongCondition('songs')} LIMIT 1`,
    [songId]
  );
  return rows[0] || null;
}

async function getSongTitle(songId) {
  const [rows] = await pool.query('SELECT title FROM songs WHERE id = ? LIMIT 1', [songId]);
  return rows[0]?.title || 'bai hat nay';
}

async function getCompletedJob(userId, songId) {
  const [rows] = await pool.query(
    `SELECT *
     FROM stem_separation_jobs
     WHERE user_id = ? AND song_id = ? AND status = 'completed'
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId, songId]
  );
  return normalizeJob(rows[0]);
}

async function getSongStem(songId, userId = null) {
  try {
    const [rows] = await pool.query(
      `SELECT ss.*,
              (
                SELECT j.id
                FROM stem_separation_jobs j
                WHERE j.song_id = ss.song_id
                  AND (? IS NULL OR j.user_id = ?)
                ORDER BY j.updated_at DESC, j.id DESC
                LIMIT 1
              ) AS latest_job_id
       FROM song_stems ss
       WHERE ss.song_id = ?
       LIMIT 1`,
      [userId, userId, songId]
    );
    return normalizeSongStem(rows[0], userId);
  } catch (err) {
    if (isMissingSongStemsTable(err)) return null;
    if (isMissingStemJobColumn(err)) {
      await ensureStemSchema();
      return getSongStem(songId, userId);
    }
    throw err;
  }
}

async function getActiveJob(userId, songId) {
  const [rows] = await pool.query(
    `SELECT *
     FROM stem_separation_jobs
     WHERE user_id = ? AND song_id = ? AND status IN ('pending', 'processing')
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId, songId]
  );
  return normalizeJob(rows[0]);
}

async function getLatestJob(userId, songId) {
  await recoverStaleStemJobs({ songId });
  const stem = await getSongStem(songId, userId);
  if (stem) return stem;

  const [rows] = await pool.query(
    `SELECT *
     FROM stem_separation_jobs
     WHERE user_id = ? AND song_id = ?
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId, songId]
  );
  return normalizeJob(rows[0]);
}

async function getJobForUser(jobId, user) {
  const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
  const job = rows[0];
  if (!job) return getSongStemById(jobId, getUserId(user));
  if (!isAdmin(user) && Number(job.user_id) !== getUserId(user)) {
    const err = new Error('Khong co quyen xem job nay');
    err.statusCode = 403;
    throw err;
  }
  return normalizeJob(job);
}

async function getSongStemById(stemId, userId = null) {
  try {
    const [rows] = await pool.query('SELECT * FROM song_stems WHERE id = ? LIMIT 1', [stemId]);
    return normalizeSongStem(rows[0], userId);
  } catch (err) {
    if (isMissingSongStemsTable(err)) return null;
    throw err;
  }
}

async function createPendingJob(userId, songId, inputAudioUrl) {
  const [result] = await pool.query(
    `INSERT INTO stem_separation_jobs
      (user_id, song_id, status, progress, input_audio_url, job_id, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, ?, UUID(), NOW(), NOW())`,
    [userId, songId, inputAudioUrl]
  );
  await upsertSongStem(songId, {
    status: STEM_STATUSES.QUEUED,
    error_message: null,
    job_id: String(result.insertId),
  });
  const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [result.insertId]);
  return normalizeJob(rows[0]);
}

async function upsertSongStem(songId, patch) {
  const allowedStatus = new Set(Object.values(STEM_STATUSES));
  const status = patch.status && allowedStatus.has(patch.status) ? patch.status : STEM_STATUSES.QUEUED;
  const vocalsUrl = patch.vocals_url !== undefined ? patch.vocals_url : null;
  const instrumentalUrl = patch.instrumental_url !== undefined ? patch.instrumental_url : null;
  const errorMessage = patch.error_message !== undefined ? patch.error_message : null;
  const processedAtSql = status === STEM_STATUSES.COMPLETED ? 'NOW()' : 'NULL';

  try {
    await pool.query(
      `INSERT INTO song_stems
        (song_id, status, vocals_url, instrumental_url, error_message, processed_at,
         job_id, locked_by, started_at, heartbeat_at, completed_at, failed_at, retry_count,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${processedAtSql}, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         vocals_url = VALUES(vocals_url),
         instrumental_url = VALUES(instrumental_url),
         error_message = VALUES(error_message),
         processed_at = CASE WHEN VALUES(status) = 'completed' THEN NOW() ELSE processed_at END,
         job_id = COALESCE(VALUES(job_id), job_id),
         locked_by = VALUES(locked_by),
         started_at = COALESCE(VALUES(started_at), started_at),
         heartbeat_at = COALESCE(VALUES(heartbeat_at), heartbeat_at),
         completed_at = CASE WHEN VALUES(status) = 'completed' THEN NOW() ELSE completed_at END,
         failed_at = CASE WHEN VALUES(status) IN ('failed','stale') THEN NOW() ELSE failed_at END,
         retry_count = GREATEST(COALESCE(retry_count, 0), VALUES(retry_count)),
         updated_at = NOW()`,
      [
        songId,
        status,
        vocalsUrl,
        instrumentalUrl,
        errorMessage,
        patch.job_id || null,
        patch.locked_by || null,
        patch.started_at || null,
        patch.heartbeat_at || null,
        patch.completed_at || null,
        patch.failed_at || null,
        Number(patch.retry_count) || 0,
      ]
    );
  } catch (err) {
    if (isMissingSongStemsTable(err)) return;
    if (isMissingStemJobColumn(err)) {
      await ensureStemSchema();
      return upsertSongStem(songId, patch);
    }
    throw err;
  }
}

async function updateJobStatus(jobId, patch) {
  const allowedStatus = new Set(Object.values(STEM_STATUSES));
  const fields = [];
  const values = [];
  const [beforeRows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
  const previousJob = normalizeJob(beforeRows[0]);

  if (patch.status !== undefined) {
    if (!allowedStatus.has(patch.status)) {
      const err = new Error('Trang thai stem job khong hop le');
      err.statusCode = 400;
      throw err;
    }
    if (patch.status === STEM_STATUSES.COMPLETED && previousJob && !hasStemOutputFiles(previousJob.song_id)) {
      patch.status = STEM_STATUSES.FAILED;
      patch.progress = 0;
      patch.vocals_url = null;
      patch.instrumental_url = null;
      patch.error_message = 'Stem output is incomplete: vocals and instrumental files must both exist and be non-empty.';
    }
    fields.push('status = ?');
    values.push(patch.status);
  }

  if (patch.progress !== undefined) {
    fields.push('progress = ?');
    values.push(Math.max(0, Math.min(100, Number(patch.progress) || 0)));
  }

  for (const [column, value] of [
    ['vocals_url', patch.vocals_url],
    ['instrumental_url', patch.instrumental_url],
    ['error_message', patch.error_message],
    ['locked_by', patch.locked_by],
  ]) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value || null);
    }
  }

  if (patch.status === STEM_STATUSES.PROCESSING || patch.heartbeat_at !== undefined) {
    fields.push('started_at = COALESCE(started_at, NOW())');
    fields.push('heartbeat_at = NOW()');
  }
  if (patch.status === STEM_STATUSES.COMPLETED) {
    fields.push('completed_at = NOW()');
    fields.push('failed_at = NULL');
  }
  if ([STEM_STATUSES.FAILED, STEM_STATUSES.STALE].includes(patch.status)) {
    fields.push('failed_at = NOW()');
  }

  if (!fields.length) {
    const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
    return normalizeJob(rows[0]);
  }

  try {
    values.push(jobId);
    await pool.query(`UPDATE stem_separation_jobs SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
  } catch (err) {
    if (isMissingStemJobColumn(err)) {
      await ensureStemSchema();
      return updateJobStatus(jobId, patch);
    }
    throw err;
  }

  const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
  const job = normalizeJob(rows[0]);
  if (job) {
    await upsertSongStem(job.song_id, {
      status: job.status,
      vocals_url: job.vocals_url,
      instrumental_url: job.instrumental_url,
      error_message: job.error_message,
      job_id: String(job.id),
      locked_by: job.locked_by,
      started_at: job.started_at,
      heartbeat_at: job.heartbeat_at,
      completed_at: job.completed_at,
      failed_at: job.failed_at,
      retry_count: job.retry_count,
    });
    await maybeCreateStemNotification(job, previousJob);
  }
  emitJobUpdate(job);
  return job;
}

async function maybeCreateStemNotification(job, previousJob) {
  if (!job?.user_id || ![STEM_STATUSES.COMPLETED, STEM_STATUSES.FAILED, STEM_STATUSES.STALE].includes(job.status)) return;
  if (previousJob?.status === job.status) return;

  try {
    const songTitle = await getSongTitle(job.song_id);
    if (job.status === STEM_STATUSES.COMPLETED) {
      await createNotification({
        userId: job.user_id,
        type: 'karaoke_ready',
        title: 'Karaoke đã sẵn sàng',
        message: `Bài hát "${songTitle}" đã tách vocal xong và có thể hát Karaoke.`,
        link: '/karaoke',
        data: {
          song_id: job.song_id,
          song_title: songTitle,
          vocals_url: job.vocals_url,
          instrumental_url: job.instrumental_url,
          target_route: '/karaoke',
        },
      });
      return;
    }

    await createNotification({
      userId: job.user_id,
      type: 'karaoke_failed',
      title: 'Tách Karaoke thất bại',
      message: `Không thể tách vocal cho bài hát "${songTitle}". Vui lòng thử lại sau.`,
      link: '/karaoke',
      data: {
        song_id: job.song_id,
        song_title: songTitle,
        error_message: String(job.error_message || '').slice(0, 300),
        target_route: '/karaoke',
      },
    });
  } catch (err) {
    console.error('[StemJob] create notification failed:', err.message);
  }
}

function emitJobUpdate(job) {
  if (!job) return;
  const io = getIo();
  if (!io) return;

  notifyUser(io, job.user_id, 'stem:job-updated', job);
  if (job.status === STEM_STATUSES.COMPLETED) notifyUser(io, job.user_id, 'stem:job-completed', job);
  if ([STEM_STATUSES.FAILED, STEM_STATUSES.STALE].includes(job.status)) notifyUser(io, job.user_id, 'stem:job-failed', job);
}

async function enqueueAiJob(job, song, inputPath) {
  const { vocalsUrl, instrumentalUrl } = stemPublicUrls(song.id);
  const outputDir = path.join(UPLOADS_ROOT, 'stems', String(song.id));
  const callbackToken = process.env.STEM_CALLBACK_TOKEN || process.env.JWT_SECRET || '';

  const payload = {
    job_id: job.id,
    user_id: job.user_id,
    song_id: song.id,
    input_audio_path: inputPath,
    output_dir: outputDir,
    vocals_url: vocalsUrl,
    instrumental_url: instrumentalUrl,
    callback_url: `${getBackendBaseUrl()}/api/stem/internal/jobs/${job.id}`,
    callback_token: callbackToken,
  };

  try {
    console.log(`[StemJob] enqueue job=${job.id} song=${song.id} input=${inputPath}`);
    await axios.post(`${getAiServiceUrl()}/api/stem/jobs`, payload, { timeout: 5000 });
  } catch (err) {
    console.error(`[StemJob] enqueue failed job=${job.id} song=${song.id}: ${err.message}`);
    await updateJobStatus(job.id, {
      status: STEM_STATUSES.FAILED,
      progress: 0,
      error_message: `Khong the gui job sang AI service: ${err.message}`,
    });
  }
}

async function requestSeparation(user, songId) {
  await ensureStemSchema();
  const userId = getUserId(user);
  if (!userId) {
    const err = new Error('Can dang nhap de tach stem');
    err.statusCode = 401;
    throw err;
  }

  const normalizedSongId = Number(songId);
  if (!Number.isInteger(normalizedSongId) || normalizedSongId <= 0) {
    const err = new Error('ID bai hat khong hop le');
    err.statusCode = 400;
    throw err;
  }

  const song = await getSong(normalizedSongId);
  if (!song) {
    const err = new Error('Bai hat khong ton tai');
    err.statusCode = 404;
    throw err;
  }

  const inputPath = publicUrlToUploadsPath(song.audio_url);
  if (!inputPath || !fileExistsAndNonEmpty(inputPath)) {
    const err = new Error('Bai hat chua co file audio cuc bo hop le de tach stem');
    err.statusCode = 400;
    throw err;
  }

  await recoverStaleStemJobs({ songId: normalizedSongId });
  const songStem = await getSongStem(normalizedSongId, userId);
  if (songStem?.status === STEM_STATUSES.COMPLETED && songStem.vocals_url && songStem.instrumental_url) {
    if (hasStemOutputFiles(normalizedSongId)) return songStem;
    await upsertSongStem(normalizedSongId, {
      status: STEM_STATUSES.FAILED,
      error_message: 'Stem record completed but output files are missing',
    });
  }

  if (ACTIVE_STEM_STATUSES.includes(songStem?.status)) {
    const activeJob = await getActiveJob(userId, normalizedSongId);
    return activeJob || songStem;
  }

  const completedJob = await getCompletedJob(userId, normalizedSongId);
  if (completedJob?.vocals_url && completedJob?.instrumental_url && hasStemOutputFiles(normalizedSongId)) {
    return completedJob;
  }

  const { vocalsUrl, instrumentalUrl } = stemPublicUrls(normalizedSongId);
  if (hasStemOutputFiles(normalizedSongId)) {
    const job = await createPendingJob(userId, normalizedSongId, song.audio_url);
    return updateJobStatus(job.id, {
      status: STEM_STATUSES.COMPLETED,
      progress: 100,
      vocals_url: vocalsUrl,
      instrumental_url: instrumentalUrl,
      error_message: null,
    });
  }

  const activeJob = await getActiveJob(userId, normalizedSongId);
  if (activeJob && !isStemJobTimedOut(activeJob)) return activeJob;

  const job = await createPendingJob(userId, normalizedSongId, song.audio_url);
  enqueueAiJob(job, song, inputPath);
  return job;
}

async function isPremiumUser(userId) {
  const [rows] = await pool.query(
    `SELECT premium_expires_at, premium_expired_at
     FROM users
     WHERE id = ? AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  const user = rows[0];
  if (!user) return false;
  const expiresAt = user.premium_expires_at || user.premium_expired_at;
  return Boolean(expiresAt && new Date(expiresAt) > new Date());
}

async function getInstrumentalDownload(jobId, user) {
  const job = await getJobForUser(jobId, user);
  if (!job) {
    const err = new Error('Khong tim thay stem job');
    err.statusCode = 404;
    throw err;
  }
  if (job.status !== STEM_STATUSES.COMPLETED || !job.instrumental_url) {
    const err = new Error('Beat chua san sang de tai');
    err.statusCode = 400;
    throw err;
  }
  if (!(await isPremiumUser(getUserId(user)))) {
    const err = new Error('Tinh nang tai beat yeu cau tai khoan Premium');
    err.statusCode = 403;
    throw err;
  }

  const filePath = publicUrlToUploadsPath(job.instrumental_url);
  if (!filePath || !filePath.startsWith(UPLOADS_ROOT + path.sep) || !fileExistsAndNonEmpty(filePath)) {
    const err = new Error('Khong tim thay file beat');
    err.statusCode = 404;
    throw err;
  }
  return filePath;
}

async function getReadyKaraokeSongs({ limit = 24 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 50));
  const [rows] = await pool.query(
    `SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        COALESCE(s.cover_url, al.cover_url) AS cover_url,
        s.play_count,
        s.artist_id,
        a.name AS artist_name,
        s.album_id,
        al.title AS album_title,
        ss.id AS stem_id,
        ss.status AS stem_status,
        ss.vocals_url,
        ss.instrumental_url,
        ss.processed_at
     FROM song_stems ss
     JOIN songs s ON s.id = ss.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     LEFT JOIN albums al ON al.id = s.album_id
     WHERE ss.status = 'completed'
       AND ss.vocals_url IS NOT NULL
       AND TRIM(ss.vocals_url) <> ''
       AND ss.instrumental_url IS NOT NULL
       AND TRIM(ss.instrumental_url) <> ''
       AND ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND TRIM(s.audio_url) <> ''
     ORDER BY ss.processed_at DESC, ss.updated_at DESC, s.play_count DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows
    .filter((row) => hasStemOutputFiles(Number(row.id)))
    .map((row) => ({
      id: Number(row.id),
      title: row.title,
      duration_sec: row.duration_sec,
      duration: row.duration_sec,
      audio_url: row.audio_url,
      cover_url: row.cover_url,
      cover: row.cover_url,
      play_count: row.play_count || 0,
      artist_id: row.artist_id,
      artist_name: row.artist_name,
      artist: row.artist_name,
      album_id: row.album_id,
      album_title: row.album_title,
      album: row.album_title,
      karaoke_ready: true,
      stem: {
        id: row.stem_id,
        stem_id: row.stem_id,
        song_id: Number(row.id),
        status: row.stem_status,
        progress: 100,
        vocals_url: row.vocals_url,
        instrumental_url: row.instrumental_url,
        processed_at: row.processed_at,
      },
    }));
}

async function recoverStaleStemJobs({ songId = null, timeoutMinutes = getStemTimeoutMinutes(), dryRun = false } = {}) {
  const params = [timeoutMinutes];
  let songFilter = '';
  if (songId) {
    songFilter = ' AND ss.song_id = ?';
    params.push(Number(songId));
  }

  const [rows] = await pool.query(
    `SELECT ss.*, s.title, a.name AS artist_name
     FROM song_stems ss
     LEFT JOIN songs s ON s.id = ss.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE ss.status = 'processing'
       AND COALESCE(ss.heartbeat_at, ss.updated_at) < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ${songFilter}
     ORDER BY ss.updated_at ASC
     LIMIT 100`,
    params
  );

  const recovered = [];
  for (const row of rows) {
    const { vocalsUrl, instrumentalUrl } = stemPublicUrls(row.song_id);
    const vocalsExists = publicStemUrlExists(row.vocals_url) || fileExistsAndNonEmpty(stemOutputPaths(row.song_id).vocalsPath);
    const instrumentalExists = publicStemUrlExists(row.instrumental_url) || fileExistsAndNonEmpty(stemOutputPaths(row.song_id).instrumentalPath);
    const nextStatus = vocalsExists && instrumentalExists ? STEM_STATUSES.COMPLETED : STEM_STATUSES.STALE;
    const message = nextStatus === STEM_STATUSES.STALE ? STALE_ERROR_MESSAGE : null;
    const entry = {
      stem_id: row.id,
      song_id: row.song_id,
      title: row.title,
      artist_name: row.artist_name,
      status: row.status,
      updated_at: row.updated_at,
      heartbeat_at: row.heartbeat_at,
      vocals_exists: vocalsExists,
      instrumental_exists: instrumentalExists,
      recommended_action: nextStatus === STEM_STATUSES.COMPLETED ? 'mark-completed' : 'mark-stale',
      next_status: nextStatus,
    };
    recovered.push(entry);
    console.warn(`[StemRecovery] song=${row.song_id} next=${nextStatus} vocals=${vocalsExists} instrumental=${instrumentalExists}`);
    if (dryRun) continue;

    await upsertSongStem(row.song_id, {
      status: nextStatus,
      vocals_url: nextStatus === STEM_STATUSES.COMPLETED ? (row.vocals_url || vocalsUrl) : null,
      instrumental_url: nextStatus === STEM_STATUSES.COMPLETED ? (row.instrumental_url || instrumentalUrl) : null,
      error_message: message,
      failed_at: nextStatus === STEM_STATUSES.STALE ? new Date() : null,
      completed_at: nextStatus === STEM_STATUSES.COMPLETED ? new Date() : null,
      job_id: row.job_id,
      retry_count: Number(row.retry_count) || 0,
    });

    await pool.query(
      `UPDATE stem_separation_jobs
       SET status = ?, progress = ?, error_message = ?, updated_at = NOW(),
           failed_at = CASE WHEN ? = 'stale' THEN NOW() ELSE failed_at END,
           completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END
       WHERE song_id = ? AND status = 'processing'`,
      [nextStatus, nextStatus === STEM_STATUSES.COMPLETED ? 100 : 0, message, nextStatus, nextStatus, row.song_id]
    );
  }

  return recovered;
}

async function retryStem(stemId, user) {
  const [rows] = await pool.query('SELECT * FROM song_stems WHERE id = ? LIMIT 1', [stemId]);
  const stem = rows[0];
  if (!stem) {
    const err = new Error('Khong tim thay stem job');
    err.statusCode = 404;
    throw err;
  }

  await recoverStaleStemJobs({ songId: stem.song_id });
  const [freshRows] = await pool.query('SELECT * FROM song_stems WHERE id = ? LIMIT 1', [stemId]);
  const fresh = freshRows[0] || stem;
  if (ACTIVE_STEM_STATUSES.includes(fresh.status) && !isStemJobTimedOut(fresh)) {
    const err = new Error('Stem job dang xu ly, vui long doi hoac dat lai sau khi bi gian doan');
    err.statusCode = 409;
    throw err;
  }
  if (!RETRYABLE_STEM_STATUSES.has(fresh.status) && fresh.status !== STEM_STATUSES.QUEUED && !isStemJobTimedOut(fresh)) {
    const err = new Error('Chi co the retry job failed, stale hoac processing bi gian doan');
    err.statusCode = 400;
    throw err;
  }

  cleanupPartialStemFiles(fresh.song_id);
  await pool.query(
    `UPDATE song_stems
     SET status = 'failed',
         error_message = NULL,
         vocals_url = NULL,
         instrumental_url = NULL,
         retry_count = COALESCE(retry_count, 0) + 1,
         updated_at = NOW()
     WHERE id = ?`,
    [stemId]
  );

  return requestSeparation(user, fresh.song_id);
}

async function resetStemStatus(stemId) {
  const [rows] = await pool.query('SELECT * FROM song_stems WHERE id = ? LIMIT 1', [stemId]);
  const stem = rows[0];
  if (!stem) {
    const err = new Error('Khong tim thay stem job');
    err.statusCode = 404;
    throw err;
  }
  if (stem.status === STEM_STATUSES.COMPLETED && hasStemOutputFiles(stem.song_id)) {
    const err = new Error('Khong dat lai stem da hoan thanh va co du file');
    err.statusCode = 400;
    throw err;
  }
  await upsertSongStem(stem.song_id, {
    status: STEM_STATUSES.QUEUED,
    error_message: null,
    retry_count: Number(stem.retry_count) || 0,
  });
  return getSongStem(stem.song_id);
}

module.exports = {
  ACTIVE_STEM_STATUSES,
  STALE_ERROR_MESSAGE,
  STEM_STATUSES,
  cleanupPartialStemFiles,
  ensureStemSchema,
  fileExistsAndNonEmpty,
  getJobForUser,
  getLatestJob,
  getInstrumentalDownload,
  getReadyKaraokeSongs,
  getStemTimeoutMinutes,
  hasStemOutputFiles,
  isStemJobTimedOut,
  publicStemUrlExists,
  publicUrlToUploadsPath,
  recoverStaleStemJobs,
  requestSeparation,
  resetStemStatus,
  retryStem,
  stemOutputPaths,
  stemPublicUrls,
  updateJobStatus,
};
