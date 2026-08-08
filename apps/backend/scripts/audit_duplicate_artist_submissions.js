const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool } = require('../src/config/database');
const { computeFileSha256 } = require('../src/utils/fileHash.util');
const { resolveUploadUrl } = require('../src/utils/uploadPathResolver');

const REJECTION_REASON = 'File âm thanh đã tồn tại trong thư viện.';

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

async function ensureAudioHash(song) {
  if (song.audio_hash) return song.audio_hash;
  if (!song.audio_url) return null;

  const resolved = resolveUploadUrl(song.audio_url);
  if (!resolved.ok) {
    console.warn(`[DuplicateAudit] Cannot resolve audio path for submission_id=${song.id} reason=${resolved.reason}`);
    return null;
  }

  try {
    const audioHash = await computeFileSha256(resolved.absolutePath);
    await pool.query('UPDATE songs SET audio_hash = ? WHERE id = ?', [audioHash, song.id]);
    return audioHash;
  } catch (error) {
    console.warn(`[DuplicateAudit] Cannot compute hash for submission_id=${song.id}: ${error.message}`);
    return null;
  }
}

async function findDuplicateForSubmission(song, audioHash) {
  const [approvedRows] = await pool.query(
    `SELECT s.id, s.title, s.review_status, a.name AS artist_name
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE s.audio_hash = ?
       AND s.audio_hash IS NOT NULL
       AND s.audio_hash <> ''
       AND s.id <> ?
       AND s.review_status = 'approved'
     ORDER BY s.id ASC
     LIMIT 1`,
    [audioHash, song.id]
  );
  if (approvedRows.length) return approvedRows[0];

  const [pendingRows] = await pool.query(
    `SELECT s.id, s.title, s.review_status, a.name AS artist_name
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE s.audio_hash = ?
       AND s.audio_hash IS NOT NULL
       AND s.audio_hash <> ''
       AND s.id <> ?
       AND s.review_status = 'pending_review'
       AND s.submitted_by_artist_id IS NOT NULL
     ORDER BY s.submitted_at ASC, s.id ASC
     LIMIT 1`,
    [audioHash, song.id]
  );
  return pendingRows[0] || null;
}

async function rejectSubmission(song, duplicate) {
  await pool.query(
    `UPDATE songs
     SET review_status = 'rejected',
         reviewed_at = NOW(),
         rejection_reason = ?,
         can_resubmit = 1,
         resubmit_locked_reason = NULL
     WHERE id = ?`,
    [REJECTION_REASON, song.id]
  );

  await pool.query(
    `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, action, reason, score_snapshot)
     VALUES ('song', ?, ?, 'rejected', ?, ?)`,
    [
      song.id,
      song.artist_id || null,
      REJECTION_REASON,
      JSON.stringify({
        duplicateAudioAudit: true,
        duplicateSongId: duplicate.id,
        duplicateReviewStatus: duplicate.review_status,
      }),
    ]
  ).catch(error => {
    console.warn(`[DuplicateAudit] Failed to log rejection for submission_id=${song.id}: ${error.message}`);
  });
}

async function main() {
  const apply = hasArg('apply');
  const [submissions] = await pool.query(
    `SELECT s.id, s.title, s.artist_id, s.audio_url, s.audio_hash, s.review_status, a.name AS artist_name
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE s.review_status = 'pending_review'
       AND s.submitted_by_artist_id IS NOT NULL
       AND s.audio_url IS NOT NULL
       AND TRIM(s.audio_url) <> ''
     ORDER BY s.submitted_at ASC, s.id ASC`
  );

  console.log(`[DuplicateAudit] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[DuplicateAudit] Pending artist submissions: ${submissions.length}`);

  let duplicateCount = 0;
  for (const submission of submissions) {
    const audioHash = await ensureAudioHash(submission);
    if (!audioHash) continue;

    const duplicate = await findDuplicateForSubmission(submission, audioHash);
    if (!duplicate) continue;

    duplicateCount += 1;
    console.log(JSON.stringify({
      submission_id: submission.id,
      title: submission.title,
      artist: submission.artist_name,
      audio_hash: audioHash,
      duplicate_song_id: duplicate.id,
      duplicate_song_title: duplicate.title,
      duplicate_artist: duplicate.artist_name,
      duplicate_status: duplicate.review_status,
      recommended_action: 'reject_duplicate_audio',
    }));

    if (apply) {
      await rejectSubmission(submission, duplicate);
    }
  }

  console.log(`[DuplicateAudit] Done. duplicates=${duplicateCount}, ${apply ? 'rejected' : 'would_reject'}=${duplicateCount}`);
}

main()
  .catch(error => {
    console.error('[DuplicateAudit] Fatal:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
