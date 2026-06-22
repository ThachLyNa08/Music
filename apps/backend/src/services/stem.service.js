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

function isMissingSongStemsTable(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' && /song_stems/i.test(err.message || '');
}

function getBackendBaseUrl() {
  return process.env.BACKEND_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

function getAiServiceUrl() {
  return (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
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
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) return null;
  return resolved;
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
    vocalsPath: path.join(stemDir, 'vocals.mp3'),
    instrumentalPath: path.join(stemDir, 'instrumental.mp3'),
  };
}

function hasStemOutputFiles(songId) {
  const { vocalsPath, instrumentalPath } = stemOutputPaths(songId);
  return fs.existsSync(vocalsPath) && fs.existsSync(instrumentalPath);
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
  return rows[0]?.title || 'bài hát này';
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
    const err = new Error('Không có quyền xem job này');
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
  await upsertSongStem(songId, {
    status: 'pending',
    error_message: null,
  });

  const [result] = await pool.query(
    `INSERT INTO stem_separation_jobs
      (user_id, song_id, status, progress, input_audio_url, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, ?, NOW(), NOW())`,
    [userId, songId, inputAudioUrl]
  );
  const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [result.insertId]);
  return normalizeJob(rows[0]);
}

async function upsertSongStem(songId, patch) {
  const allowedStatus = new Set(['pending', 'processing', 'completed', 'failed']);
  const status = patch.status && allowedStatus.has(patch.status) ? patch.status : 'pending';
  const vocalsUrl = patch.vocals_url !== undefined ? patch.vocals_url : null;
  const instrumentalUrl = patch.instrumental_url !== undefined ? patch.instrumental_url : null;
  const errorMessage = patch.error_message !== undefined ? patch.error_message : null;
  const processedAtSql = status === 'completed' ? 'NOW()' : 'NULL';

  try {
    await pool.query(
      `INSERT INTO song_stems
        (song_id, status, vocals_url, instrumental_url, error_message, processed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${processedAtSql}, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         vocals_url = COALESCE(VALUES(vocals_url), vocals_url),
         instrumental_url = COALESCE(VALUES(instrumental_url), instrumental_url),
         error_message = VALUES(error_message),
         processed_at = CASE WHEN VALUES(status) = 'completed' THEN NOW() ELSE processed_at END,
         updated_at = NOW()`,
      [songId, status, vocalsUrl, instrumentalUrl, errorMessage]
    );
  } catch (err) {
    if (isMissingSongStemsTable(err)) return;
    throw err;
  }
}

async function updateJobStatus(jobId, patch) {
  const allowedStatus = new Set(['pending', 'processing', 'completed', 'failed']);
  const fields = [];
  const values = [];
  const [beforeRows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
  const previousJob = normalizeJob(beforeRows[0]);

  if (patch.status !== undefined) {
    if (!allowedStatus.has(patch.status)) {
      const err = new Error('Trạng thái stem job không hợp lệ');
      err.statusCode = 400;
      throw err;
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
  ]) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value || null);
    }
  }

  if (!fields.length) {
    const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
    return normalizeJob(rows[0]);
  }

  values.push(jobId);
  await pool.query(
    `UPDATE stem_separation_jobs SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
    values
  );

  const [rows] = await pool.query('SELECT * FROM stem_separation_jobs WHERE id = ? LIMIT 1', [jobId]);
  const job = normalizeJob(rows[0]);
  if (job) {
    await upsertSongStem(job.song_id, {
      status: job.status,
      vocals_url: job.vocals_url,
      instrumental_url: job.instrumental_url,
      error_message: job.error_message,
    });
    await maybeCreateStemNotification(job, previousJob);
  }
  emitJobUpdate(job);
  return job;
}

async function maybeCreateStemNotification(job, previousJob) {
  if (!job?.user_id || !['completed', 'failed'].includes(job.status)) return;
  if (previousJob?.status === job.status) return;

  try {
    const songTitle = await getSongTitle(job.song_id);
    if (job.status === 'completed') {
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
    console.error('create stem notification failed:', err.message);
  }
}

function emitJobUpdate(job) {
  if (!job) return;
  const io = getIo();
  if (!io) return;

  notifyUser(io, job.user_id, 'stem:job-updated', job);
  if (job.status === 'completed') notifyUser(io, job.user_id, 'stem:job-completed', job);
  if (job.status === 'failed') notifyUser(io, job.user_id, 'stem:job-failed', job);
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
    await axios.post(`${getAiServiceUrl()}/api/stem/jobs`, payload, { timeout: 5000 });
  } catch (err) {
    await updateJobStatus(job.id, {
      status: 'failed',
      progress: 0,
      error_message: `Không thể gửi job sang AI service: ${err.message}`,
    });
  }
}

async function requestSeparation(user, songId) {
  const userId = getUserId(user);
  if (!userId) {
    const err = new Error('Cần đăng nhập để tách stem');
    err.statusCode = 401;
    throw err;
  }

  const normalizedSongId = Number(songId);
  if (!Number.isInteger(normalizedSongId) || normalizedSongId <= 0) {
    const err = new Error('ID bài hát không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  const song = await getSong(normalizedSongId);
  if (!song) {
    const err = new Error('Bài hát không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  const inputPath = publicUrlToUploadsPath(song.audio_url);
  if (!inputPath || !fs.existsSync(inputPath)) {
    const err = new Error('Bài hát chưa có file audio cục bộ hợp lệ để tách stem');
    err.statusCode = 400;
    throw err;
  }

  const songStem = await getSongStem(normalizedSongId, userId);
  if (songStem?.status === 'completed' && songStem.vocals_url && songStem.instrumental_url) {
    if (hasStemOutputFiles(normalizedSongId)) return songStem;
    await upsertSongStem(normalizedSongId, {
      status: 'failed',
      error_message: 'Stem record completed but output files are missing',
    });
  }
  if (songStem?.status === 'processing' || songStem?.status === 'pending') {
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
      status: 'completed',
      progress: 100,
      vocals_url: vocalsUrl,
      instrumental_url: instrumentalUrl,
      error_message: null,
    });
  }

  const activeJob = await getActiveJob(userId, normalizedSongId);
  if (activeJob) return activeJob;

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
    const err = new Error('Không tìm thấy stem job');
    err.statusCode = 404;
    throw err;
  }
  if (job.status !== 'completed' || !job.instrumental_url) {
    const err = new Error('Beat chưa sẵn sàng để tải');
    err.statusCode = 400;
    throw err;
  }
  if (!(await isPremiumUser(getUserId(user)))) {
    const err = new Error('Tính năng tải beat yêu cầu tài khoản Premium');
    err.statusCode = 403;
    throw err;
  }

  const filePath = publicUrlToUploadsPath(job.instrumental_url);
  if (!filePath || !filePath.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(filePath)) {
    const err = new Error('Không tìm thấy file beat');
    err.statusCode = 404;
    throw err;
  }
  return filePath;
}

module.exports = {
  getJobForUser,
  getLatestJob,
  getInstrumentalDownload,
  requestSeparation,
  updateJobStatus,
};
