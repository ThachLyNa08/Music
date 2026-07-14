const { pool } = require('../config/database');

let cachedSongColumns = null;
async function getSongColumns() {
  if (cachedSongColumns) return cachedSongColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM songs');
  cachedSongColumns = new Set(rows.map(row => row.Field));
  return cachedSongColumns;
}

// GET /api/admin/artist-album-reviews
exports.getArtistAlbumReviews = async (req, res) => {
  try {
    const { status = 'pending_review', q, artistId, page = 1, limit = 20, sort = 'newest' } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['al.submitted_by_artist_id IS NOT NULL'];
    const queryParams = [];

    if (status !== 'all') {
      whereConditions.push('al.review_status = ?');
      queryParams.push(status);
    }

    if (artistId) {
      whereConditions.push('al.artist_id = ?');
      queryParams.push(artistId);
    }

    if (q) {
      whereConditions.push('(al.title LIKE ? OR a.name LIKE ?)');
      const searchPattern = `%${q}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const orderClause = sort === 'newest' ? 'ORDER BY al.submitted_at DESC' : 'ORDER BY al.submitted_at ASC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      ${whereClause}
    `;
    const [[{ total }]] = await pool.query(countQuery, queryParams);

    // Data query
    const dataQuery = `
      SELECT
        al.id, al.title, COALESCE(NULLIF(al.cover_url, ''), (SELECT s.cover_url FROM songs s WHERE s.album_id = al.id AND s.cover_url IS NOT NULL AND s.cover_url != '' ORDER BY s.id ASC LIMIT 1)) AS cover_url, al.review_status, al.submitted_at, al.release_date,
        a.id as artist_id, a.name as artist_name, a.avatar_url as artist_avatar,
        (SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) as song_count
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const [albums] = await pool.query(dataQuery, [...queryParams, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: albums,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getArtistAlbumReviews:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET /api/admin/artist-album-reviews/:albumId
exports.getArtistAlbumReviewDetail = async (req, res) => {
  try {
    const { albumId } = req.params;

    const query = `
      SELECT
        al.*,
        COALESCE(NULLIF(al.cover_url, ''), (SELECT s.cover_url FROM songs s WHERE s.album_id = al.id AND s.cover_url IS NOT NULL AND s.cover_url != '' ORDER BY s.id ASC LIMIT 1)) AS cover_url,
        a.name as artist_name, a.avatar_url as artist_avatar,
        g.name as genre_name
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      LEFT JOIN genres g ON al.genre_id = g.id
      WHERE al.id = ? AND al.submitted_by_artist_id IS NOT NULL
      LIMIT 1
    `;
    const [albums] = await pool.query(query, [albumId]);

    if (!albums || albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    const album = albums[0];
    const songColumns = await getSongColumns();
    const durationSelect = songColumns.has('duration_sec')
      ? 'duration_sec as duration'
      : (songColumns.has('duration') ? 'duration' : '0 as duration');
    const songSelectParts = [
      'id',
      'title',
      durationSelect,
      songColumns.has('play_count') ? 'play_count' : '0 as play_count',
      songColumns.has('metadata_status') ? 'metadata_status' : "'unknown' as metadata_status",
      songColumns.has('review_status') ? 'review_status' : "'approved' as review_status",
      songColumns.has('audio_url') ? 'audio_url as audioUrl' : 'NULL as audioUrl',
      songColumns.has('cover_url') ? 'cover_url as coverUrl' : 'NULL as coverUrl',
    ];

    // Fetch songs in album
    const [songs] = await pool.query(`
      SELECT ${songSelectParts.join(', ')}
      FROM songs
      WHERE album_id = ?
    `, [albumId]);

    album.songs = songs;

    res.json({ success: true, data: album });
  } catch (error) {
    console.error('Error in getArtistAlbumReviewDetail:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/admin/artist-album-reviews/:albumId/approve
exports.approveArtistAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const adminId = req.user.id;

    const [albums] = await pool.query('SELECT id FROM albums WHERE id = ? AND submitted_by_artist_id IS NOT NULL', [albumId]);
    if (albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    await pool.query(`
      UPDATE albums
      SET
        review_status = 'approved',
        release_status = CASE WHEN release_date > NOW() THEN 'scheduled' ELSE 'published' END,
        release_at = CASE WHEN release_date IS NOT NULL THEN release_date ELSE NULL END,
        reviewed_by_admin_id = ?,
        reviewed_at = NOW(),
        published_at = COALESCE(published_at, NOW()),
        rejection_reason = NULL
      WHERE id = ?
    `, [adminId, albumId]);

    res.json({ success: true, message: 'Đã duyệt album thành công' });
  } catch (error) {
    console.error('Error in approveArtistAlbum:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/admin/artist-album-reviews/:albumId/reject
exports.rejectArtistAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do từ chối' });
    }

    const [albums] = await pool.query('SELECT id FROM albums WHERE id = ? AND submitted_by_artist_id IS NOT NULL', [albumId]);
    if (albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    await pool.query(`
      UPDATE albums
      SET
        review_status = 'rejected',
        reviewed_by_admin_id = ?,
        reviewed_at = NOW(),
        rejection_reason = ?
      WHERE id = ?
    `, [adminId, reason.trim(), albumId]);

    // Giải phóng bài hát khỏi album để artist có thể dùng lại
    await pool.query('UPDATE songs SET album_id = NULL WHERE album_id = ?', [albumId]);

    res.json({ success: true, message: 'Đã từ chối album' });
  } catch (error) {
    console.error('Error in rejectArtistAlbum:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
