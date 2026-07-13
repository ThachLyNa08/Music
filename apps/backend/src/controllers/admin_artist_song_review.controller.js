const { pool } = require('../config/database');
const notificationService = require('../services/notification.service');

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

exports.getArtistSongReviews = async (req, res, next) => {
  try {
    const { status = 'pending_review', q, page = 1, limit = 20, sort = 'newest' } = req.query;
    const songColumns = await getSongColumns();
    const submissionNoteSelect = songColumns.has('submission_note') ? 's.submission_note,' : 'NULL AS submission_note,';

    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    let whereClause = 'WHERE s.submitted_by_artist_id IS NOT NULL';
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ' AND s.review_status = ?';
      queryParams.push(status);
    }

    if (q) {
      whereClause += ' AND (s.title LIKE ? OR a.name LIKE ?)';
      queryParams.push(`%${q}%`, `%${q}%`);
    }

    let orderBy = 's.submitted_at DESC';
    if (sort === 'oldest') orderBy = 's.submitted_at ASC';

    const countParams = [...queryParams];
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       ${whereClause}`,
      countParams
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec as duration,
        s.review_status, s.submitted_at, s.reviewed_at, s.rejection_reason,
        ${submissionNoteSelect}
        a.id as artist_id, a.name as artist_name, a.avatar_url as artist_avatar_url,
        al.id as album_id, al.title as album_title,
        g.id as genre_id, g.name as genre_name
       FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    const reviews = rows.map(r => ({
      id: r.id,
      title: r.title,
      coverUrl: r.cover_url,
      audioUrl: r.audio_url,
      duration: r.duration,
      reviewStatus: r.review_status,
      metadataStatus: getMetadataStatus({
        title: r.title,
        audioUrl: r.audio_url,
        coverUrl: r.cover_url,
        genreId: r.genre_id
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
    }));

    const [statsRows] = await pool.query(
      `SELECT
        SUM(CASE WHEN review_status = 'pending_review' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
       FROM songs
       WHERE submitted_by_artist_id IS NOT NULL`
    );

    res.json({
      success: true,
      reviews,
      summary: {
        pendingCount: Number(statsRows[0].pending_count || 0),
        approvedCount: Number(statsRows[0].approved_count || 0),
        rejectedCount: Number(statsRows[0].rejected_count || 0)
      },
      pagination: {
        page: Number(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
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
       WHERE s.id = ? AND s.submitted_by_artist_id IS NOT NULL
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

    // Gửi thông báo cho người dùng
    const [songRows] = await pool.query(
      `SELECT s.title, a.id as artist_id, a.name as artist_name, s.genre_id
       FROM songs s
       LEFT JOIN artists a ON s.artist_id = a.id
       WHERE s.id = ?`,
      [songId]
    );

    if (songRows.length > 0) {
      const { title: songTitle, artist_id: artistId, artist_name: artistName, genre_id: genreId } = songRows[0];

      const [targetUsers] = await pool.query(`
        SELECT DISTINCT user_id
        FROM (
          SELECT user_id FROM user_artist_preferences WHERE artist_id = ?
          UNION
          SELECT user_id FROM user_genre_preferences WHERE genre_id = ?
        ) as t
      `, [artistId, genreId]);

      if (targetUsers.length > 0) {
        const notificationsPromises = targetUsers.map(u =>
          notificationService.createNotification({
            userId: u.user_id,
            title: 'Bài hát mới',
            message: `Bài hát "${songTitle}" của ${artistName || 'nghệ sĩ'} vừa được thêm vào hệ thống!`,
            type: 'new_song',
            link: `/song/${songId}`
          }).catch(err => console.error('Failed to notify user', u.user_id, err))
        );
        await Promise.all(notificationsPromises);
      }
    }

    res.json({ success: true, message: 'Đã duyệt và xuất bản bài hát.' });
  } catch (error) {
    next(error);
  }
};

exports.rejectArtistSong = async (req, res, next) => {
  try {
    const songId = req.params.songId;
    const adminId = req.user.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
    }

    const [result] = await pool.query(
      `UPDATE songs
       SET review_status = 'rejected',
           reviewed_by_admin_id = ?,
           reviewed_at = NOW(),
           rejection_reason = ?
       WHERE id = ? AND submitted_by_artist_id IS NOT NULL`,
      [adminId, reason.trim(), songId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

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
      latestPending
    });

  } catch (error) {
    next(error);
  }
};
