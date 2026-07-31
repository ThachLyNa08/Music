const { pool } = require('../config/database');
const { getIo, notifyUser } = require('../services/socket.service');
const notificationService = require('../services/notification.service');

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
    const { status = 'pending_review', q, artistId, level, flag, page = 1, limit = 20, sort = 'newest' } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['al.submitted_by_artist_id IS NOT NULL'];
    const queryParams = [];

    if (status !== 'all') {
      whereConditions.push('al.review_status = ?');
      queryParams.push(status);
    }

    if (level && ['low', 'medium', 'high'].includes(level)) {
      whereConditions.push('al.moderation_level = ?');
      queryParams.push(level);
    }

    if (flag) {
      whereConditions.push('JSON_CONTAINS(al.moderation_flags, JSON_QUOTE(?))');
      queryParams.push(flag);
    }

    if (artistId && artistId !== 'all') {
      whereConditions.push('al.artist_id = ?');
      queryParams.push(artistId);
    }

    if (q) {
      whereConditions.push('(al.title LIKE ? OR a.name LIKE ?)');
      const searchPattern = `%${q}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY al.submitted_at DESC';
    if (sort === 'oldest') orderClause = 'ORDER BY al.submitted_at ASC';
    else if (sort === 'risk_desc') orderClause = 'ORDER BY al.risk_score DESC, al.submitted_at DESC';

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
        al.id, al.title, COALESCE(NULLIF(al.cover_url, ''), (SELECT s.cover_url FROM songs s WHERE s.album_id = al.id AND s.cover_url IS NOT NULL AND s.cover_url != '' ORDER BY s.id ASC LIMIT 1)) AS cover_url, al.review_status, al.submitted_at, al.release_date, al.rejection_reason,
        COALESCE(al.metadata_score, 0) as metadata_score,
        COALESCE(al.risk_score, 0) as risk_score,
        COALESCE(al.moderation_level, 'normal') as moderation_level,
        al.moderation_flags,
        COALESCE(al.resubmission_count, 0) as resubmission_count,
        COALESCE(al.can_resubmit, 1) as can_resubmit,
        al.resubmit_locked_reason,
        a.id as artist_id, a.name as artist_name, a.avatar_url as artist_avatar,
        (SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) as song_count
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const [albums] = await pool.query(dataQuery, [...queryParams, parseInt(limit), parseInt(offset)]);

    const formattedAlbums = albums.map(a => {
      let parsedFlags = [];
      try {
        parsedFlags = typeof a.moderation_flags === 'string' ? JSON.parse(a.moderation_flags) : (a.moderation_flags || []);
      } catch (e) {
        parsedFlags = [];
      }

      return {
        id: a.id,
        title: a.title,
        coverUrl: a.cover_url,
        reviewStatus: a.review_status,
        submittedAt: a.submitted_at,
        releaseDate: a.release_date,
        rejectionReason: a.rejection_reason,
        metadataScore: Number(a.metadata_score || 0),
        riskScore: Number(a.risk_score || 0),
        moderationLevel: a.moderation_level || 'low',
        moderationFlags: parsedFlags,
        resubmissionCount: Number(a.resubmission_count || 0),
        canResubmit: Boolean(a.can_resubmit),
        resubmitLockedReason: a.resubmit_locked_reason || null,
        artist: a.artist_id ? { id: a.artist_id, name: a.artist_name, avatarUrl: a.artist_avatar } : null,
        songCount: Number(a.song_count || 0)
      };
    });

    res.json({
      success: true,
      data: formattedAlbums,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit) || 1
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

    const [albums] = await pool.query('SELECT al.id, al.title, al.cover_url, al.artist_id, al.metadata_score, al.risk_score, al.moderation_level, a.user_id as artist_user_id, a.name as artist_name FROM albums al LEFT JOIN artists a ON al.artist_id = a.id WHERE al.id = ? AND al.submitted_by_artist_id IS NOT NULL', [albumId]);
    if (albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    const albumRecord = albums[0];

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

    pool.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, score_snapshot)
       VALUES ('album', ?, ?, ?, 'approved', ?)`,
      [
        albumId,
        albumRecord.artist_id || null,
        adminId,
        JSON.stringify({
          metadataScore: albumRecord.metadata_score,
          riskScore: albumRecord.risk_score,
          moderationLevel: albumRecord.moderation_level
        })
      ]
    ).catch(err => console.warn('Failed to log album approval action:', err));

    try {
      if (albumRecord.artist_user_id) {
        await notificationService.notifyArtistContentApproved({
          userId: albumRecord.artist_user_id, contentType: 'album', contentId: albumId, title: albumRecord.title
        });
        await notificationService.notifyInterestedUsersContentApproved({
          contentType: 'album', contentId: albumId, title: albumRecord.title, artistId: albumRecord.artist_id, artistName: albumRecord.artist_name || 'Nghệ sĩ', coverUrl: albumRecord.cover_url || ''
        });
      }
    } catch (notifErr) {
      console.warn('Notification error on album approve (ignored):', notifErr);
    }

    try {
      getIo()?.emit('admin:review_updated');
    } catch (_e) {}

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
    const { reason, allowResubmit } = req.body;
    const adminId = req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do từ chối' });
    }

    const [albums] = await pool.query('SELECT al.id, al.title, al.artist_id, al.resubmission_count, al.metadata_score, al.risk_score, a.user_id as artist_user_id FROM albums al LEFT JOIN artists a ON al.artist_id = a.id WHERE al.id = ? AND al.submitted_by_artist_id IS NOT NULL', [albumId]);
    if (albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    const albumRecord = albums[0];
    const currentResubmits = albumRecord.resubmission_count || 0;
    const canResubmit = (allowResubmit !== false && currentResubmits < 3) ? 1 : 0;
    const lockedReason = canResubmit ? null : reason.trim();

    await pool.query(`
      UPDATE albums
      SET
        review_status = 'rejected',
        reviewed_by_admin_id = ?,
        reviewed_at = NOW(),
        rejection_reason = ?,
        can_resubmit = ?,
        resubmit_locked_reason = ?
      WHERE id = ?
    `, [adminId, reason.trim(), canResubmit, lockedReason, albumId]);

    pool.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, reason, score_snapshot)
       VALUES ('album', ?, ?, ?, 'rejected', ?, ?)`,
      [
        albumId,
        albumRecord.artist_id || null,
        adminId,
        reason.trim(),
        JSON.stringify({
          canResubmit,
          resubmissionCount: currentResubmits,
          metadataScore: albumRecord.metadata_score,
          riskScore: albumRecord.risk_score
        })
      ]
    ).catch(err => console.warn('Failed to log album rejection action:', err));

    try {
      if (albumRecord.artist_user_id) {
        await notificationService.notifyArtistContentRejected({
          userId: albumRecord.artist_user_id, contentType: 'album', contentId: albumId, title: albumRecord.title, reason: reason.trim()
        });
      }
    } catch (notifErr) {
      console.warn('Notification error on album reject (ignored):', notifErr);
    }

    try {
      getIo()?.emit('admin:review_updated');
    } catch (_e) {}

    res.json({ success: true, message: 'Đã từ chối album' });
  } catch (error) {
    console.error('Error in rejectArtistAlbum:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/admin/artist-album-reviews/bulk-approve
exports.bulkApproveArtistAlbums = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách ID album.' });
    }
    if (ids.length > 50) {
      return res.status(400).json({ success: false, message: 'Tối đa 50 album mỗi lần duyệt.' });
    }

    const [albums] = await pool.query(
      `SELECT al.id, al.title, al.cover_url, al.artist_id, al.review_status, al.moderation_level, al.risk_score, al.metadata_score, a.user_id as artist_user_id, a.name as artist_name,
              (SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id AND s.review_status = 'approved') as approved_song_count
       FROM albums al
       LEFT JOIN artists a ON al.artist_id = a.id
       WHERE al.id IN (?) AND al.submitted_by_artist_id IS NOT NULL`,
      [ids]
    );

    const albumMap = new Map(albums.map(a => [a.id, a]));
    const approvedIds = [];
    const skipped = [];

    for (const id of ids) {
      const album = albumMap.get(Number(id)) || albumMap.get(id);
      if (!album) {
        skipped.push({ id, reason: 'Album không tồn tại hoặc không đủ thẩm quyền.' });
        continue;
      }
      if (album.review_status !== 'pending_review') {
        skipped.push({ id, reason: 'Album không ở trạng thái chờ duyệt.' });
        continue;
      }
      if (album.moderation_level === 'high') {
        skipped.push({ id, reason: 'Rủi ro cao, cần xem chi tiết trước khi duyệt.' });
        continue;
      }
      if (Number(album.risk_score || 0) > 60) {
        skipped.push({ id, reason: 'Điểm rủi ro vượt ngưỡng an toàn (>60).' });
        continue;
      }
      if (Number(album.approved_song_count || 0) === 0) {
        skipped.push({ id, reason: 'Album phải có ít nhất 1 bài hát đã được duyệt.' });
        continue;
      }

      approvedIds.push(id);
    }

    if (approvedIds.length > 0) {
      await pool.query(
        `UPDATE albums
         SET review_status = 'approved',
             release_status = CASE WHEN release_date > NOW() THEN 'scheduled' ELSE 'published' END,
             release_at = CASE WHEN release_date IS NOT NULL THEN release_date ELSE NULL END,
             reviewed_by_admin_id = ?,
             reviewed_at = NOW(),
             published_at = COALESCE(published_at, NOW()),
             rejection_reason = NULL
         WHERE id IN (?)`,
        [adminId, approvedIds]
      );

      for (const approvedId of approvedIds) {
        const album = albumMap.get(Number(approvedId)) || albumMap.get(approvedId);
        if (album) {
          pool.query(
            `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, score_snapshot)
             VALUES ('album', ?, ?, ?, 'approved', ?)`,
            [
              approvedId,
              album.artist_id || null,
              adminId,
              JSON.stringify({
                metadataScore: album.metadata_score,
                riskScore: album.risk_score,
                moderationLevel: album.moderation_level
              })
            ]
          ).catch(err => console.warn('Failed to log album bulk approval action:', err));

          if (album.artist_user_id) {
            try {
              await notificationService.notifyArtistContentApproved({
                userId: album.artist_user_id, contentType: 'album', contentId: approvedId, title: album.title
              });
              await notificationService.notifyInterestedUsersContentApproved({
                contentType: 'album', contentId: approvedId, title: album.title, artistId: album.artist_id, artistName: album.artist_name || 'Nghệ sĩ', coverUrl: album.cover_url || ''
              });
            } catch (err) {
              console.warn('Bulk approve album notify error:', err);
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
    console.error('Error in bulkApproveArtistAlbums:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/admin/artist-album-reviews/bulk-reject
exports.bulkRejectArtistAlbums = async (req, res) => {
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
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do từ chối chung.' });
      }
      targetItems = ids.map(id => ({ id, reason: reason.trim() }));
    } else {
      return res.status(400).json({ success: false, message: 'Danh sách từ chối không hợp lệ.' });
    }

    if (targetItems.length > 50) {
      return res.status(400).json({ success: false, message: 'Tối đa 50 album mỗi lần từ chối.' });
    }

    const itemIds = targetItems.map(i => i.id);
    const [albums] = await pool.query(
      `SELECT al.id, al.title, al.artist_id, al.review_status, al.resubmission_count, al.metadata_score, al.risk_score, a.user_id as artist_user_id
       FROM albums al
       LEFT JOIN artists a ON al.artist_id = a.id
       WHERE al.id IN (?) AND al.submitted_by_artist_id IS NOT NULL`,
      [itemIds]
    );

    const albumMap = new Map(albums.map(a => [a.id, a]));
    const rejectedList = [];
    const skipped = [];

    for (const item of targetItems) {
      const album = albumMap.get(Number(item.id)) || albumMap.get(item.id);
      const itemReason = item.reason && String(item.reason).trim();

      if (!album) {
        skipped.push({ id: item.id, reason: 'Album không tồn tại.' });
        continue;
      }
      if (album.review_status !== 'pending_review') {
        skipped.push({ id: item.id, reason: 'Album không ở trạng thái chờ duyệt.' });
        continue;
      }
      if (!itemReason) {
        skipped.push({ id: item.id, reason: 'Thiếu lý do từ chối cho album này.' });
        continue;
      }

      rejectedList.push({ album, reason: itemReason });
    }

    if (skipped.length > 0 && rejectedList.length === 0) {
      return res.status(400).json({ success: false, message: skipped[0].reason, skipped });
    }

    if (rejectedList.length > 0) {
      for (const { album, reason: itemReason } of rejectedList) {
        const currentResubmits = album.resubmission_count || 0;
        const canResubmit = (allowResubmit !== false && currentResubmits < 3) ? 1 : 0;
        const lockedReason = canResubmit ? null : itemReason;

        await pool.query(
          `UPDATE albums
           SET review_status = 'rejected',
               reviewed_by_admin_id = ?,
               reviewed_at = NOW(),
               rejection_reason = ?,
               can_resubmit = ?,
               resubmit_locked_reason = ?
           WHERE id = ?`,
          [adminId, itemReason, canResubmit, lockedReason, album.id]
        );

        pool.query(
          `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, admin_id, action, reason, score_snapshot)
           VALUES ('album', ?, ?, ?, 'rejected', ?, ?)`,
          [
            album.id,
            album.artist_id || null,
            adminId,
            itemReason,
            JSON.stringify({
              metadataScore: album.metadata_score,
              riskScore: album.risk_score,
              moderationLevel: album.moderation_level
            })
          ]
        ).catch(err => console.warn('Failed to log bulk reject album action:', err));

        if (album.artist_user_id) {
          try {
            await notificationService.notifyArtistContentRejected({
              userId: album.artist_user_id, contentType: 'album', contentId: album.id, title: album.title, reason: itemReason
            });
          } catch (err) {
            console.warn('Bulk reject album notify error:', err);
          }
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
    console.error('Error in bulkRejectArtistAlbums:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
