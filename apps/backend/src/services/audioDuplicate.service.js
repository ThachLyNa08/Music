const { pool } = require('../config/database');

/**
 * Check if an audio file SHA-256 hash already exists in songs table
 * Checks ONLY approved and pending_review statuses.
 * Prioritizes: approved > pending_review
 * @param {string} audioHash - 64-character SHA-256 hex string
 * @param {number|string|null} excludeSongId - Optional song ID to exclude (on resubmit)
 * @returns {Promise<object|null>} Prioritized duplicate song record or null
 */
async function findDuplicateAudioHash(audioHash, excludeSongId = null) {
  if (!audioHash || typeof audioHash !== 'string') {
    return null;
  }

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
      AND s.review_status IN ('approved', 'pending_review')
  `;
  const queryParams = [audioHash];

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

module.exports = {
  findDuplicateAudioHash,
};
