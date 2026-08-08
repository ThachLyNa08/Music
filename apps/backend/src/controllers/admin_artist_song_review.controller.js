const { pool } = require('../config/database');
const notificationService = require('../services/notification.service');
const { getIo, notifyUser } = require('../services/socket.service');
const { findDuplicateAudioHash } = require('../services/audioDuplicate.service');
const { computeFileSha256 } = require('../utils/fileHash.util');
const { resolveUploadUrl } = require('../utils/uploadPathResolver');

const DUPLICATE_APPROVE_REJECTION_REASON = 'File âm thanh đã tồn tại trong thư viện.';

let cachedSongColumns = null;
async function getSongColumns() {
  if (cachedSongColumns) return cachedSongColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM songs');
  cachedSongColumns = new Set(rows.map(row => row.Field));
  return cachedSongColumns;
}

const getMetadataStatus = ({ title, audioUrl, coverUrl, genreId }) => {
  const missing = [];
  if (!title || !String(title).trim()) missing.push('title');
  if (!audioUrl) missing.push('audio');
  if (!coverUrl) missing.push('cover');
  if (!genreId) missing.push('genre');

  if (missing.length === 0) return 'complete';
  if (missing.length === 1 && missing[0] === 'cover') return 'missing_cover';
  if (missing.length === 1 && missing[0] === 'genre') return 'missing_genre';
  return 'incomplete';
};

async function ensureSongAudioHash(song) {
  if (song.audio_hash) return song.audio_hash;
  if (!song.audio_url) return null;

  const resolved = resolveUploadUrl(song.audio_url);
  if (!resolved.ok) return null;

  try {
    const audioHash = await computeFileSha256(resolved.absolutePath);
    await pool.query('UPDATE songs SET audio_hash = ? WHERE id = ?', [audioHash, song.id]);
    return audioHash;
  } catch (error) {
    console.warn('[ArtistSongReview] Failed to compute audio hash before approve:', error.message);
    return null;
  }
}

async function rejectSongForDuplicateApproval(song, adminId, duplicate) {
  await pool.query(
    `UPDATE songs
     SET review_status = 'rejected',
         reviewed_by_admin_id = ?,
         reviewed_at = NOW(),
         rejection_reason = ?,
         can_resubmit = 1,
         resubmit_locked_reason = NULL
     WHERE id = ?`,
    [adminId, DUPLICATE_APPROVE_REJECTION_REASON, song.id]
  );

  pool.query(
    `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, reason, score_snapshot)
     VALUES ('song', ?, ?, ?, 'rejected', ?, ?)`,
    [
      song.id,
      song.artist_id || null,
      adminId,
      DUPLICATE_APPROVE_REJECTION_REASON,
      JSON.stringify({
        duplicateAudio: true,
        duplicateSongId: duplicate.id,
        duplicateReviewStatus: duplicate.review_status,
      }),
    ]
  ).catch(err => console.warn('Failed to log duplicate song rejection action:', err));
}

async function checkDuplicateBeforeApprove(song, adminId) {
  const audioHash = await ensureSongAudioHash(song);
  if (!audioHash) return null;

  const duplicate = await findDuplicateAudioHash(audioHash, song.id, { reviewStatuses: ['approved'] });
  if (!duplicate) return null;

  await rejectSongForDuplicateApproval(song, adminId, duplicate);
  return duplicate;
}

exports.getArtistSongReviews = async (req, res, next) => {
  try {
    const { status = 'pending_review', q, level, flag, artistId, page = 1, limit = 20, sort = 'newest' } = req.query;
    const songColumns = await getSongColumns();
    const submissionNoteSelect = songColumns.has('submission_note') ? 's.submission_note,' : 'NULL AS submission_note,';

    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    let whereClause = "WHERE s.submitted_by_artist_id IS NOT NULL AND s.review_status <> 'draft'";
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ' AND s.review_status = ?';
      queryParams.push(status);
    }

    if (level && ['low', 'medium', 'high'].includes(level)) {
      whereClause += ' AND s.moderation_level = ?';
      queryParams.push(level);
    }

    if (flag) {
      whereClause += ' AND JSON_CONTAINS(s.moderation_flags, JSON_QUOTE(?))';
      queryParams.push(flag);
    }

    if (artistId && artistId !== 'all') {
      whereClause += ' AND s.artist_id = ?';
      queryParams.push(artistId);
    }

    if (q) {
      whereClause += ' AND (s.title LIKE ? OR a.name LIKE ?)';
      queryParams.push(`%${q}%`, `%${q}%`);
    }

    let orderBy = 's.submitted_at DESC';
    if (sort === 'oldest') orderBy = 's.submitted_at ASC';
    else if (sort === 'risk_desc') orderBy = 's.risk_score DESC, s.submitted_at DESC';

    const countParams = [...queryParams];
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       ${whereClause}`,
      countParams
    );
    const total = countRows[0].total;

    // Risk stats for pending songs
    const [riskStatRows] = await pool.query(`
      SELECT
        SUM(CASE WHEN review_status = 'pending_review' THEN 1 ELSE 0 END) as totalPending,
        SUM(CASE WHEN review_status = 'pending_review' AND moderation_level = 'high' THEN 1 ELSE 0 END) as highRiskCount,
        SUM(CASE WHEN review_status = 'pending_review' AND moderation_level = 'medium' THEN 1 ELSE 0 END) as mediumRiskCount,
        SUM(CASE WHEN review_status = 'pending_review' AND moderation_level = 'low' THEN 1 ELSE 0 END) as lowRiskCount
      FROM songs
      WHERE submitted_by_artist_id IS NOT NULL
    `);

    const [rows] = await pool.query(
      `SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec as duration,
        s.review_status, s.submitted_at, s.reviewed_at, s.rejection_reason,
        COALESCE(s.metadata_score, 0) as metadata_score,
        COALESCE(s.risk_score, 0) as risk_score,
        COALESCE(s.moderation_level, 'normal') as moderation_level,
        s.moderation_flags,
        COALESCE(s.resubmission_count, 0) as resubmission_count,
        COALESCE(s.can_resubmit, 1) as can_resubmit,
        s.resubmit_locked_reason,
        s.duplicate_reference_song_id as duplicateReferenceSongId,
        s.duplicate_reference_status as duplicateReferenceStatus,
        s.duplicate_reference_artist_id as duplicateReferenceArtistId,
        ref_s.title as duplicateReferenceTitle,
        ref_a.name as duplicateReferenceArtistName,
        ${submissionNoteSelect}
        a.id as artist_id, a.name as artist_name, a.avatar_url as artist_avatar_url,
        al.id as album_id, al.title as album_title,
        g.id as genre_id, g.name as genre_name
       FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       LEFT JOIN songs ref_s ON s.duplicate_reference_song_id = ref_s.id
       LEFT JOIN artists ref_a ON s.duplicate_reference_artist_id = ref_a.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    const reviews = rows.map(r => {
      let parsedFlags = [];
      try {
        parsedFlags = typeof r.moderation_flags === 'string' ? JSON.parse(r.moderation_flags) : (r.moderation_flags || []);
      } catch (e) {
        parsedFlags = [];
      }

      return {
        id: r.id,
        title: r.title,
        coverUrl: r.cover_url,
        audioUrl: r.audio_url,
        duration: r.duration,
        reviewStatus: r.review_status,
        metadataScore: Number(r.metadata_score || 0),
        riskScore: Number(r.risk_score || 0),
        moderationLevel: r.moderation_level || 'low',
        moderationFlags: parsedFlags,
        resubmissionCount: Number(r.resubmission_count || 0),
        canResubmit: Boolean(r.can_resubmit),
        resubmitLockedReason: r.resubmit_locked_reason || null,
        duplicateReferenceSongId: r.duplicateReferenceSongId || null,
        duplicateReferenceStatus: r.duplicateReferenceStatus || null,
        duplicateReferenceArtistId: r.duplicateReferenceArtistId || null,
        duplicateReferenceTitle: r.duplicateReferenceTitle || null,
        duplicateReferenceArtistName: r.duplicateReferenceArtistName || null,
        metadataStatus: getMetadataStatus({
          title: r.title,
          audioUrl: r.audio_url,
          coverUrl: r.cover_url,
          genreId: r.genre_id,
          duration: r.duration
        }),
        submissionNote: r.submission_note || null,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at,
        rejectionReason: r.rejection_reason,
        artist: r.artist_id ? {
          id: r.artist_id,
          name: r.artist_name,
          avatarUrl: r.artist_avatar_url
        } : null,
        album: r.album_id ? { id: r.album_id, title: r.album_title } : null,
        genre: r.genre_id ? { id: r.genre_id, name: r.genre_name } : null
      };
    });

    res.json({
      success: true,
      reviews,
      pagination: {
        total,
        page: Number(page),
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      stats: {
        totalPending: Number(riskStatRows[0]?.totalPending || 0),
        highRiskCount: Number(riskStatRows[0]?.highRiskCount || 0),
        mediumRiskCount: Number(riskStatRows[0]?.mediumRiskCount || 0),
        lowRiskCount: Number(riskStatRows[0]?.lowRiskCount || 0)
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getArtistSongReviewDetail = async (req, res, next) => {
  try {
    const songId = req.params.songId;
    const songColumns = await getSongColumns();
    const submissionNoteSelect = songColumns.has('submission_note') ? 's.submission_note,' : 'NULL AS submission_note,';

    const [rows] = await pool.query(
      `SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec as duration, s.lyrics,
        s.review_status, s.submitted_at, s.reviewed_at, s.rejection_reason,
        ${submissionNoteSelect}
        a.id as artist_id, a.name as artist_name, a.avatar_url as artist_avatar_url,
        al.id as album_id, al.title as album_title,
        g.id as genre_id, g.name as genre_name
       FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       WHERE s.id = ? AND s.submitted_by_artist_id IS NOT NULL AND s.review_status <> 'draft'
       LIMIT 1`,
      [songId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    const r = rows[0];
    res.json({
      success: true,
      review: {
        id: r.id,
        title: r.title,
        coverUrl: r.cover_url,
        audioUrl: r.audio_url,
        duration: r.duration,
        lyrics: r.lyrics,
        lyricsStatus: r.lyrics ? 'available' : 'missing',
        submissionNote: r.submission_note || null,
        metadataStatus: getMetadataStatus({
          title: r.title,
          audioUrl: r.audio_url,
          coverUrl: r.cover_url,
          genreId: r.genre_id
        }),
        reviewStatus: r.review_status,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at,
        rejectionReason: r.rejection_reason,
        artist: r.artist_id ? {
          id: r.artist_id,
          name: r.artist_name,
          avatarUrl: r.artist_avatar_url
        } : null,
        album: r.album_id ? { id: r.album_id, title: r.album_title } : null,
        genre: r.genre_id ? { id: r.genre_id, name: r.genre_name } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.approveArtistSong = async (req, res, next) => {
  try {
    const songId = req.params.songId;
    const adminId = req.user.id;

    const [pendingRows] = await pool.query(
      `SELECT id, title, artist_id, audio_url, audio_hash, review_status
       FROM songs
       WHERE id = ? AND submitted_by_artist_id IS NOT NULL
       LIMIT 1`,
      [songId]
    );

    if (!pendingRows.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay bai hat' });
    }
    if (pendingRows[0].review_status !== 'pending_review') {
      return res.status(400).json({ success: false, message: 'Bai hat khong o trang thai cho duyet.' });
    }

    const duplicate = await checkDuplicateBeforeApprove(pendingRows[0], adminId);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_AUDIO_ON_APPROVAL',
        message: 'Không thể duyệt vì file âm thanh đã tồn tại trong thư viện.',
        duplicate: {
          song_id: duplicate.id,
          title: duplicate.title,
          artist_name: duplicate.artist_name || null,
        },
      });
    }

    const [result] = await pool.query(
      `UPDATE songs
       SET review_status = 'approved',
           release_status = CASE WHEN release_at > NOW() THEN 'scheduled' ELSE 'published' END,
           reviewed_by_admin_id = ?,
           reviewed_at = NOW(),
           rejection_reason = NULL,
           published_at = COALESCE(published_at, NOW())
       WHERE id = ? AND submitted_by_artist_id IS NOT NULL`,
      [adminId, songId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    const [songDataRows] = await pool.query(
      "SELECT id, title, artist_id, metadata_score, risk_score, moderation_level, moderation_flags, resubmission_count FROM songs WHERE id = ?",
      [songId]
    );

    pool.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, score_snapshot)
       VALUES ('song', ?, ?, ?, 'approved', ?)`,
      [
        songId,
        songDataRows[0]?.artist_id || null,
        adminId,
        JSON.stringify({
          metadataScore: songDataRows[0]?.metadata_score,
          riskScore: songDataRows[0]?.risk_score,
          moderationLevel: songDataRows[0]?.moderation_level
        })
      ]
    ).catch(err => console.warn('Failed to log song approval action:', err));

    try {
      const [songRows] = await pool.query(
        `SELECT s.title, s.cover_url, a.id as artist_id, a.name as artist_name, s.genre_id, a.user_id as artist_user_id
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         WHERE s.id = ?`,
        [songId]
      );

      if (songRows.length > 0) {
        const { title: songTitle, cover_url: coverUrl, artist_id: artistId, artist_name: artistName, artist_user_id: artistUserId } = songRows[0];

        if (artistUserId) {
          await notificationService.notifyArtistContentApproved({
            userId: artistUserId, contentType: 'song', contentId: songId, title: songTitle
          });
        }

        await notificationService.notifyInterestedUsersContentApproved({
          contentType: 'song', contentId: songId, title: songTitle, artistId, artistName: artistName || 'Nghệ sĩ', coverUrl: coverUrl || ''
        });
      }
    } catch (notifErr) {
      console.warn('Notification error on approve (ignored):', notifErr);
    }

    try {
      getIo()?.emit('admin:review_updated');
    } catch (_e) {}

    res.json({ success: true, message: 'Đã duyệt và xuất bản bài hát.' });
  } catch (error) {
    next(error);
  }
};

exports.rejectArtistSong = async (req, res, next) => {
  try {
    const songId = req.params.songId;
    const adminId = req.user.id;
    const { reason, allowResubmit } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
    }

    const [songRows] = await pool.query(
      "SELECT id, title, artist_id, resubmission_count, metadata_score, risk_score, moderation_level FROM songs WHERE id = ? AND submitted_by_artist_id IS NOT NULL",
      [songId]
    );

    if (!songRows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    const songRecord = songRows[0];
    const currentResubmits = songRecord.resubmission_count || 0;
    const canResubmit = (allowResubmit !== false && currentResubmits < 3) ? 1 : 0;
    const lockedReason = canResubmit ? null : reason.trim();

    await pool.query(
      `UPDATE songs
       SET review_status = 'rejected',
           reviewed_by_admin_id = ?,
           reviewed_at = NOW(),
           rejection_reason = ?,
           can_resubmit = ?,
           resubmit_locked_reason = ?
       WHERE id = ?`,
      [adminId, reason.trim(), canResubmit, lockedReason, songId]
    );

    pool.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, reason, score_snapshot)
       VALUES ('song', ?, ?, ?, 'rejected', ?, ?)`,
      [
        songId,
        songRecord.artist_id || null,
        adminId,
        reason.trim(),
        JSON.stringify({
          canResubmit,
          resubmissionCount: currentResubmits,
          metadataScore: songRecord.metadata_score,
          riskScore: songRecord.risk_score
        })
      ]
    ).catch(err => console.warn('Failed to log song rejection action:', err));

    try {
      const [artistRows] = await pool.query(
        `SELECT a.user_id as artist_user_id
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         WHERE s.id = ?`,
        [songId]
      );

      if (artistRows.length > 0 && artistRows[0].artist_user_id) {
        await notificationService.notifyArtistContentRejected({
          userId: artistRows[0].artist_user_id, contentType: 'song', contentId: songId, title: songRecord.title, reason: reason.trim()
        });
      }
    } catch (notifErr) {
      console.warn('Notification error on reject (ignored):', notifErr);
    }

    try {
      getIo()?.emit('admin:review_updated');
    } catch (_e) {}

    res.json({ success: true, message: 'Đã từ chối bài hát.' });
  } catch (error) {
    next(error);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    // Song stats
    const [songStatsRows] = await pool.query(
      `SELECT
        SUM(CASE WHEN review_status = 'pending_review' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
       FROM songs
       WHERE submitted_by_artist_id IS NOT NULL`
    );

    // Album stats
    const [albumStatsRows] = await pool.query(
      `SELECT
        SUM(CASE WHEN review_status = 'pending_review' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
       FROM albums
       WHERE submitted_by_artist_id IS NOT NULL`
    );

    const pendingSongs = Number(songStatsRows[0].pending_count || 0);
    const approvedSongs = Number(songStatsRows[0].approved_count || 0);
    const rejectedSongs = Number(songStatsRows[0].rejected_count || 0);

    const pendingAlbums = Number(albumStatsRows[0].pending_count || 0);
    const approvedAlbums = Number(albumStatsRows[0].approved_count || 0);
    const rejectedAlbums = Number(albumStatsRows[0].rejected_count || 0);

    const pendingTotal = pendingSongs + pendingAlbums;

    // Latest pending from both tables
    const [latestRows] = await pool.query(`
      SELECT
        'song' AS type, s.id, s.title, s.cover_url, s.submitted_at, s.review_status,
        a.name as artist_name
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE s.review_status = 'pending_review' AND s.submitted_by_artist_id IS NOT NULL

      UNION ALL

      SELECT
        'album' AS type, al.id, al.title, al.cover_url, al.submitted_at, al.review_status,
        a.name as artist_name
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      WHERE al.review_status = 'pending_review' AND al.submitted_by_artist_id IS NOT NULL

      ORDER BY submitted_at DESC
      LIMIT 5
    `);

    const latestPending = latestRows.map(r => ({
      type: r.type,
      id: r.id,
      title: r.title,
      coverUrl: r.cover_url,
      submittedAt: r.submitted_at,
      reviewStatus: r.review_status,
      artistName: r.artist_name || 'Không rõ'
    }));

    const [artistRows] = await pool.query(`
      SELECT DISTINCT a.id, a.name, a.avatar_url
      FROM (
        SELECT artist_id FROM songs WHERE submitted_by_artist_id IS NOT NULL AND artist_id IS NOT NULL
        UNION
        SELECT artist_id FROM albums WHERE submitted_by_artist_id IS NOT NULL AND artist_id IS NOT NULL
      ) AS submitted
      JOIN artists a ON submitted.artist_id = a.id
      ORDER BY a.name ASC
    `);

    res.json({
      success: true,
      summary: {
        pendingTotal,
        pendingSongs,
        pendingAlbums,
        approvedSongs,
        approvedAlbums,
        rejectedSongs,
        rejectedAlbums
      },
      latestPending,
      artists: artistRows
    });

  } catch (error) {
    next(error);
  }
};

exports.bulkApproveArtistSongs = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách ID bài hát.' });
    }
    if (ids.length > 50) {
      return res.status(400).json({ success: false, message: 'Tối đa 50 bài hát mỗi lần duyệt.' });
    }

    const [songs] = await pool.query(
      `SELECT s.id, s.title, s.cover_url, s.audio_url, s.audio_hash, s.artist_id, s.review_status, s.moderation_level, s.risk_score, s.metadata_score, s.moderation_flags, a.user_id as artist_user_id, a.name as artist_name
       FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       WHERE s.id IN (?) AND s.submitted_by_artist_id IS NOT NULL`,
      [ids]
    );

    const songMap = new Map(songs.map(s => [s.id, s]));
    const approvedIds = [];
    const skipped = [];

    for (const id of ids) {
      const song = songMap.get(Number(id)) || songMap.get(id);
      if (!song) {
        skipped.push({ id, reason: 'Bài hát không tồn tại hoặc không đủ thẩm quyền.' });
        continue;
      }
      if (song.review_status !== 'pending_review') {
        skipped.push({ id, reason: 'Bài hát không ở trạng thái chờ duyệt.' });
        continue;
      }
      if (song.moderation_level === 'high') {
        skipped.push({ id, reason: 'Rủi ro cao, cần xem chi tiết trước khi duyệt.' });
        continue;
      }
      if (Number(song.risk_score || 0) > 60) {
        skipped.push({ id, reason: 'Điểm rủi ro vượt ngưỡng an toàn (>60).' });
        continue;
      }

      let parsedFlags = [];
      try {
        parsedFlags = typeof song.moderation_flags === 'string' ? JSON.parse(song.moderation_flags) : (song.moderation_flags || []);
      } catch (e) {
        parsedFlags = [];
      }

      if (parsedFlags.includes('invalid_audio_duration') || parsedFlags.includes('duplicate_audio_pending') || parsedFlags.includes('duplicate_audio_approved')) {
        skipped.push({ id, reason: 'Có cờ cảnh báo không đủ điều kiện duyệt hàng loạt.' });
        continue;
      }

      const duplicate = await checkDuplicateBeforeApprove(song, adminId);
      if (duplicate) {
        skipped.push({ id, reason: DUPLICATE_APPROVE_REJECTION_REASON, duplicateSongId: duplicate.id });
        continue;
      }

      approvedIds.push(id);
    }

    if (approvedIds.length > 0) {
      await pool.query(
        `UPDATE songs
         SET review_status = 'approved',
             release_status = CASE WHEN release_at > NOW() THEN 'scheduled' ELSE 'published' END,
             reviewed_by_admin_id = ?,
             reviewed_at = NOW(),
             rejection_reason = NULL,
             published_at = COALESCE(published_at, NOW())
         WHERE id IN (?)`,
        [adminId, approvedIds]
      );

      for (const approvedId of approvedIds) {
        const song = songMap.get(Number(approvedId)) || songMap.get(approvedId);
        if (song) {
          pool.query(
            `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, score_snapshot)
             VALUES ('song', ?, ?, ?, 'approved', ?)`,
            [
              approvedId,
              song.artist_id || null,
              adminId,
              JSON.stringify({
                metadataScore: song.metadata_score,
                riskScore: song.risk_score,
                moderationLevel: song.moderation_level
              })
            ]
          ).catch(err => console.warn('Failed to log song bulk approval action:', err));

          if (song.artist_user_id) {
            try {
              await notificationService.notifyArtistContentApproved({
                userId: song.artist_user_id, contentType: 'song', contentId: approvedId, title: song.title
              });
              await notificationService.notifyInterestedUsersContentApproved({
                contentType: 'song', contentId: approvedId, title: song.title, artistId: song.artist_id, artistName: song.artist_name || 'Nghệ sĩ', coverUrl: song.cover_url || ''
              });
            } catch (err) {
              console.warn('Bulk approve notify error:', err);
            }
          }
        }
      }
    }

    try {
      getIo()?.emit('admin:review_updated');
    } catch (_e) {}

    res.json({
      success: true,
      approvedCount: approvedIds.length,
      skippedCount: skipped.length,
      skipped
    });
  } catch (error) {
    next(error);
  }
};

exports.bulkRejectArtistSongs = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { ids, reason, items, allowResubmit } = req.body;

    if (!ids && !items) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ids hoặc items.' });
    }

    let targetItems = [];
    if (Array.isArray(items) && items.length > 0) {
      targetItems = items;
    } else if (Array.isArray(ids) && ids.length > 0) {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối chung.' });
      }
      targetItems = ids.map(id => ({ id, reason: reason.trim() }));
    } else {
      return res.status(400).json({ success: false, message: 'Danh sách từ chối không hợp lệ.' });
    }

    if (targetItems.length > 50) {
      return res.status(400).json({ success: false, message: 'Tối đa 50 bài hát mỗi lần từ chối.' });
    }

    const itemIds = targetItems.map(i => i.id);
    const [songs] = await pool.query(
      `SELECT s.id, s.title, s.artist_id, s.review_status, s.resubmission_count, s.metadata_score, s.risk_score, s.moderation_level, a.user_id as artist_user_id
       FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       WHERE s.id IN (?) AND s.submitted_by_artist_id IS NOT NULL`,
      [itemIds]
    );

    const songMap = new Map(songs.map(s => [s.id, s]));
    const rejectedList = [];
    const skipped = [];

    for (const item of targetItems) {
      const song = songMap.get(Number(item.id)) || songMap.get(item.id);
      const itemReason = item.reason && String(item.reason).trim();

      if (!song) {
        skipped.push({ id: item.id, reason: 'Bài hát không tồn tại.' });
        continue;
      }
      if (song.review_status !== 'pending_review') {
        skipped.push({ id: item.id, reason: 'Bài hát không ở trạng thái chờ duyệt.' });
        continue;
      }
      if (!itemReason) {
        skipped.push({ id: item.id, reason: 'Thiếu lý do từ chối cho bài hát này.' });
        continue;
      }

      rejectedList.push({ song, reason: itemReason });
    }

    if (skipped.length > 0 && rejectedList.length === 0) {
      return res.status(400).json({ success: false, message: skipped[0].reason, skipped });
    }

    for (const { song, reason: itemReason } of rejectedList) {
      const currentResubmits = song.resubmission_count || 0;
      const canResubmit = (allowResubmit !== false && currentResubmits < 3) ? 1 : 0;
      const lockedReason = canResubmit ? null : itemReason;

      await pool.query(
        `UPDATE songs
         SET review_status = 'rejected',
             reviewed_by_admin_id = ?,
             reviewed_at = NOW(),
             rejection_reason = ?,
             can_resubmit = ?,
             resubmit_locked_reason = ?
         WHERE id = ?`,
        [adminId, itemReason, canResubmit, lockedReason, song.id]
      );

      pool.query(
        `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, reason, score_snapshot)
         VALUES ('song', ?, ?, ?, 'rejected', ?, ?)`,
        [
          song.id,
          song.artist_id || null,
          adminId,
          itemReason,
          JSON.stringify({
            metadataScore: song.metadata_score,
            riskScore: song.risk_score,
            moderationLevel: song.moderation_level
          })
        ]
      ).catch(err => console.warn('Failed to log bulk reject song action:', err));

      if (song.artist_user_id) {
        try {
          await notificationService.notifyArtistContentRejected({
            userId: song.artist_user_id, contentType: 'song', contentId: song.id, title: song.title, reason: itemReason
          });
        } catch (err) {
          console.warn('Bulk reject notify error:', err);
        }
      }
    }

    try {
      getIo()?.emit('admin:review_updated');
    } catch (_e) {}

    res.json({
      success: true,
      rejectedCount: rejectedList.length,
      skippedCount: skipped.length,
      skipped
    });
  } catch (error) {
    next(error);
  }
};
