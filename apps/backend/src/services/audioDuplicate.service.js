const { pool } = require('../config/database');

const DEFAULT_REVIEW_STATUSES = ['approved', 'pending_review'];

function normalizeReviewStatuses(reviewStatuses) {
  const statuses = Array.isArray(reviewStatuses) && reviewStatuses.length
    ? reviewStatuses
    : DEFAULT_REVIEW_STATUSES;
  return statuses
    .map(status => String(status || '').trim())
    .filter(Boolean);
}

async function findDuplicateAudioHash(audioHash, excludeSongId = null, options = {}) {
  if (!audioHash || typeof audioHash !== 'string') {
    return null;
  }

  const reviewStatuses = normalizeReviewStatuses(options.reviewStatuses);
  if (!reviewStatuses.length) return null;

  let query = `
    SELECT
      s.id,
      s.title,
      s.artist_id,
      a.name as artist_name,
      s.review_status,
      s.audio_hash,
      s.created_at,
      s.submitted_at
    FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    WHERE s.audio_hash = ?
      AND s.review_status IN (?)
  `;
  const queryParams = [audioHash, reviewStatuses];

  if (excludeSongId) {
    query += ' AND s.id <> ?';
    queryParams.push(excludeSongId);
  }

  query += `
    ORDER BY
      CASE s.review_status
        WHEN 'approved' THEN 1
        WHEN 'pending_review' THEN 2
        ELSE 3
      END ASC,
      s.submitted_at DESC,
      s.id DESC
    LIMIT 1
  `;

  const [rows] = await pool.query(query, queryParams);

  if (rows && rows.length > 0) {
    return rows[0];
  }

  return null;
}

function buildDuplicateAudioPayload(duplicate) {
  if (!duplicate) return null;

  if (duplicate.review_status === 'approved') {
    return {
      statusCode: 409,
      body: {
        success: false,
        code: 'DUPLICATE_AUDIO_EXISTING_SONG',
        message: 'File âm thanh này đã tồn tại trong thư viện MusicFlow.',
        duplicate: {
          song_id: duplicate.id,
          title: duplicate.title,
          artist_name: duplicate.artist_name || null,
        },
      },
    };
  }

  return {
    statusCode: 409,
    body: {
      success: false,
      code: 'DUPLICATE_AUDIO_PENDING_SUBMISSION',
      message: 'File âm thanh này đã được gửi duyệt trước đó.',
      duplicate: {
        submission_id: duplicate.id,
        title: duplicate.title,
        status: duplicate.review_status,
      },
    },
  };
}

module.exports = {
  findDuplicateAudioHash,
  buildDuplicateAudioPayload,
};
