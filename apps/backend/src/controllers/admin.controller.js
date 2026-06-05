const { pool } = require('../config/database');
const path = require('path');

// Hàm ẩn danh một phần email (Security)
function maskEmail(email) {
  if (!email) return '';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.substring(0, 2)}***@${domain}`;
}

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Lấy tổng quan (Users, Songs, Playlists, Revenue)
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalPremium }]] = await pool.query('SELECT COUNT(*) as totalPremium FROM users WHERE premium_expires_at > NOW()');
    const [[{ totalSongs }]] = await pool.query('SELECT COUNT(*) as totalSongs FROM songs');
    const [[{ totalRevenue }]] = await pool.query("SELECT SUM(amount) as totalRevenue FROM payment_transactions WHERE status = 'paid'");

    // 2. Thống kê theo tháng (6 tháng gần nhất) - Doanh thu
    const [revenueByMonth] = await pool.query(`
      SELECT 
        DATE_FORMAT(paid_at, '%Y-%m') as month, 
        SUM(amount) as revenue 
      FROM payment_transactions 
      WHERE status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // 3. Lượt nghe theo thể loại (Top 5)
    const [topGenres] = await pool.query(`
      SELECT g.name, COUNT(lh.id) as listens
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN genres g ON s.genre_id = g.id
      GROUP BY g.id
      ORDER BY listens DESC
      LIMIT 5
    `);

    // 4. Danh sách user mới nhất (Ẩn email để bảo mật)
    const [latestUsers] = await pool.query(`
      SELECT id, display_name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    const secureUsers = latestUsers.map(u => ({
      ...u,
      email: maskEmail(u.email)
    }));

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalPremium,
          totalSongs,
          totalRevenue: totalRevenue || 0
        },
        charts: {
          revenue: revenueByMonth,
          genres: topGenres
        },
        latestUsers: secureUsers
      }
    });

  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu thống kê' });
  }
};

// 1. Quản lý Người dùng
exports.getListeningTrends = async (req, res, next) => {
  try {
    const allowedRanges = {
      today: {
        bucketFormat: '%H:00',
        currentWhere: 'lh.listened_at >= CURDATE()',
        previousWhere: 'lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND lh.listened_at < CURDATE()',
        orderFormat: '%H'
      },
      '7d': {
        bucketFormat: '%d/%m',
        currentWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
        previousWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND lh.listened_at < DATE_SUB(NOW(), INTERVAL 7 DAY)',
        orderFormat: '%Y-%m-%d'
      },
      '30d': {
        bucketFormat: '%d/%m',
        currentWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
        previousWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND lh.listened_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
        orderFormat: '%Y-%m-%d'
      }
    };

    const range = allowedRanges[req.query.range] ? req.query.range : 'today';
    const config = allowedRanges[range];

    const [series] = await pool.query(`
      SELECT
        DATE_FORMAT(lh.listened_at, ?) AS label,
        DATE_FORMAT(lh.listened_at, ?) AS sort_key,
        COUNT(*) AS listens
      FROM listening_history lh
      WHERE ${config.currentWhere}
      GROUP BY label, sort_key
      ORDER BY sort_key ASC
    `, [config.bucketFormat, config.orderFormat]);

    const [topSongs] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.cover_url,
        s.play_count,
        a.name AS artist,
        al.title AS album,
        COUNT(lh.id) AS listens,
        COALESCE(prev.previous_listens, 0) AS previous_listens
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN (
        SELECT song_id, COUNT(*) AS previous_listens
        FROM listening_history lh
        WHERE ${config.previousWhere}
        GROUP BY song_id
      ) prev ON prev.song_id = s.id
      WHERE ${config.currentWhere}
      GROUP BY s.id, s.title, s.cover_url, s.play_count, a.name, al.title, prev.previous_listens
      ORDER BY listens DESC, s.play_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        range,
        series: series.map(item => ({
          label: item.label,
          listens: Number(item.listens || 0)
        })),
        topSongs: topSongs.map(item => ({
          ...item,
          listens: Number(item.listens || 0),
          previous_listens: Number(item.previous_listens || 0)
        }))
      }
    });
  } catch (error) {
    console.error('getListeningTrends Error:', error);
    next(error);
  }
};

exports.getFormData = async (req, res, next) => {
  try {
    const [artists] = await pool.query('SELECT id, name FROM artists ORDER BY name ASC');
    const [albums] = await pool.query('SELECT id, title, artist_id FROM albums ORDER BY title ASC');
    const [genres] = await pool.query('SELECT id, name FROM genres ORDER BY id ASC');
    
    res.json({
      success: true,
      data: { artists, albums, genres }
    });
  } catch (error) {
    console.error('getFormData Error:', error);
    next(error);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.role, u.status, u.premium_expires_at, u.total_listen_sec, u.created_at,
             COUNT(p.id) as playlistCount
      FROM users u
      LEFT JOIN playlists p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('getAllUsers Error:', error);
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true, message: 'Cập nhật vai trò thành công' });
  } catch (error) {
    console.error('updateUserRole Error:', error);
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'locked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    console.error('updateUserStatus Error:', error);
    next(error);
  }
};

exports.updateUserPremium = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { premium_expires_at } = req.body;
    const expiresVal = premium_expires_at ? new Date(premium_expires_at) : null;
    await pool.query('UPDATE users SET premium_expires_at = ? WHERE id = ?', [expiresVal, id]);
    res.json({ success: true, message: 'Cập nhật hạn Premium thành công' });
  } catch (error) {
    console.error('updateUserPremium Error:', error);
    next(error);
  }
};

// 2. Quản lý Bài hát
exports.getAllSongs = async (req, res, next) => {
  try {
    const { group, search, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC', genreId, artistId, status } = req.query;
    
    let query = `
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.is_active, s.play_count, s.created_at,
             CASE 
               WHEN UPPER(g.name) LIKE 'KPOP%' THEN 'KPOP'
               WHEN UPPER(g.name) LIKE 'VPOP%' THEN 'VPOP'
               WHEN UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%' THEN 'USUK'
               ELSE s.market 
             END as market,
             g.name as genre, g.id as genre_id,
             a.name as artist, a.name as artist_name, a.id as artist_id,
             al.title as album, al.id as album_id, al.cover_url as album_cover_url
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        query += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        query += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        query += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }
    if (search) {
      query += ` AND (s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (genreId) {
      query += ` AND s.genre_id = ?`;
      params.push(genreId);
    }
    if (artistId) {
      query += ` AND s.artist_id = ?`;
      params.push(artistId);
    }
    if (status) {
      query += ` AND s.is_active = ?`;
      params.push(status === 'active' ? 1 : 0);
    }

    // Sorting
    const validSortCols = ['created_at', 'title', 'play_count', 'duration_sec'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY s.${sortCol} ${sortDir}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [songs] = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE 1=1
    `;
    const countParams = [];
    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        countQuery += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        countQuery += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        countQuery += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }
    if (search) { countQuery += ` AND (s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?)`; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (genreId) { countQuery += ` AND s.genre_id = ?`; countParams.push(genreId); }
    if (artistId) { countQuery += ` AND s.artist_id = ?`; countParams.push(artistId); }
    if (status) { countQuery += ` AND s.is_active = ?`; countParams.push(status === 'active' ? 1 : 0); }

    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({ 
      success: true, 
      data: songs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getAllSongs Error:', error);
    next(error);
  }
};

exports.updateSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, artist_name, album_title, genre_id, is_active, artist_id: reqArtistId, album_id: reqAlbumId } = req.body;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let artistId = reqArtistId || null;
      let isNewArtist = false;
      if (!artistId && artist_name) {
        let [artists] = await conn.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [artist_name]);
        if (artists.length === 0) {
          const [artistRes] = await conn.query('INSERT INTO artists (name) VALUES (?)', [artist_name]);
          artistId = artistRes.insertId;
          isNewArtist = true;
        } else {
          artistId = artists[0].id;
        }
      }

      let albumId = reqAlbumId || null;
      if (!albumId && album_title && artistId) {
        let [albums] = await conn.query('SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1', [album_title, artistId]);
        if (albums.length === 0) {
          const [albumRes] = await conn.query('INSERT INTO albums (title, artist_id) VALUES (?, ?)', [album_title, artistId]);
          albumId = albumRes.insertId;
        } else {
          albumId = albums[0].id;
        }
      }

      const updateFields = [];
      const updateParams = [];

      if (title !== undefined) { updateFields.push('title = ?'); updateParams.push(title); }
      if (artistId !== null) { updateFields.push('artist_id = ?'); updateParams.push(artistId); }
      if (albumId !== null) { updateFields.push('album_id = ?'); updateParams.push(albumId); }
      if (genre_id !== undefined) { updateFields.push('genre_id = ?'); updateParams.push(genre_id); }
      if (is_active !== undefined) { updateFields.push('is_active = ?'); updateParams.push(is_active); }

      // Handle file uploads if any
      if (req.files) {
        if (req.files.audio && req.files.audio[0]) {
          const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.files.audio[0].path);
          const audioUrl = '/uploads/' + relativePath.split(path.sep).join('/');
          updateFields.push('audio_url = ?');
          updateParams.push(audioUrl);
        }
        if (req.files.cover && req.files.cover[0]) {
          const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.files.cover[0].path);
          const coverUrl = '/uploads/' + relativePath.split(path.sep).join('/');
          updateFields.push('cover_url = ?');
          updateParams.push(coverUrl);
        }
      }

      if (updateFields.length > 0) {
        updateParams.push(id);
        await conn.query(`UPDATE songs SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
      }

      await conn.commit();

      if (isNewArtist && artistId) {
        const { ensureArtistAvatar } = require('../services/artistImage.service');
        ensureArtistAvatar(artistId).catch(error => {
          console.error("Auto fetch artist avatar in updateSong failed:", error.message);
        });
      }

      const { ensureSongCover, ensureAlbumCover } = require('../services/songImage.service');
      ensureSongCover(id).catch(err => {
        console.error(`Auto fetch song cover failed for song ID ${id}:`, err.message);
      });
      if (albumId) {
        ensureAlbumCover(albumId).catch(err => {
          console.error(`Auto fetch album cover failed for album ID ${albumId}:`, err.message);
        });
      }

      res.json({ success: true, message: 'Cập nhật bài hát thành công' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('updateSong Error:', error);
    next(error);
  }
};

exports.deleteSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE songs SET is_active = FALSE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Đã ẩn bài hát thành công (soft delete)' });
  } catch (error) {
    console.error('deleteSong Error:', error);
    next(error);
  }
};

exports.getSongGroupsSummary = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as totalSongs_ALL,
        CAST(SUM(CASE WHEN s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_ALL,
        CAST(SUM(s.play_count) AS UNSIGNED) as totalListens_ALL,

        CAST(SUM(CASE WHEN g.name LIKE 'KPOP%' THEN 1 ELSE 0 END) AS UNSIGNED) as totalSongs_KPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'KPOP%' AND s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_KPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'KPOP%' THEN s.play_count ELSE 0 END) AS UNSIGNED) as totalListens_KPOP,

        CAST(SUM(CASE WHEN g.name LIKE 'VPOP%' THEN 1 ELSE 0 END) AS UNSIGNED) as totalSongs_VPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'VPOP%' AND s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_VPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'VPOP%' THEN s.play_count ELSE 0 END) AS UNSIGNED) as totalListens_VPOP,

        CAST(SUM(CASE WHEN (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') THEN 1 ELSE 0 END) AS UNSIGNED) as totalSongs_USUK,
        CAST(SUM(CASE WHEN (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') AND s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_USUK,
        CAST(SUM(CASE WHEN (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') THEN s.play_count ELSE 0 END) AS UNSIGNED) as totalListens_USUK
      FROM songs s
      LEFT JOIN genres g ON s.genre_id = g.id
    `);

    const row = rows[0] || {};

    const summary = {
      KPOP: { key: 'KPOP', label: 'Kpop', totalSongs: row.totalSongs_KPOP || 0, activeSongs: row.activeSongs_KPOP || 0, totalListens: row.totalListens_KPOP || 0, topCoverUrl: null, topSongTitle: null },
      VPOP: { key: 'VPOP', label: 'Vpop', totalSongs: row.totalSongs_VPOP || 0, activeSongs: row.activeSongs_VPOP || 0, totalListens: row.totalListens_VPOP || 0, topCoverUrl: null, topSongTitle: null },
      USUK: { key: 'USUK', label: 'US-UK', totalSongs: row.totalSongs_USUK || 0, activeSongs: row.activeSongs_USUK || 0, totalListens: row.totalListens_USUK || 0, topCoverUrl: null, topSongTitle: null },
      ALL: { key: 'ALL', label: 'Tất cả bài hát', totalSongs: row.totalSongs_ALL || 0, activeSongs: row.activeSongs_ALL || 0, totalListens: row.totalListens_ALL || 0, topCoverUrl: null, topSongTitle: null }
    };

    const queries = [
      pool.query(`SELECT s.title, s.cover_url FROM songs s LEFT JOIN genres g ON s.genre_id = g.id WHERE g.name LIKE 'KPOP%' ORDER BY s.play_count DESC LIMIT 1`),
      pool.query(`SELECT s.title, s.cover_url FROM songs s LEFT JOIN genres g ON s.genre_id = g.id WHERE g.name LIKE 'VPOP%' ORDER BY s.play_count DESC LIMIT 1`),
      pool.query(`SELECT s.title, s.cover_url FROM songs s LEFT JOIN genres g ON s.genre_id = g.id WHERE (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') ORDER BY s.play_count DESC LIMIT 1`),
      pool.query(`SELECT title, cover_url FROM songs ORDER BY play_count DESC LIMIT 1`),
    ];

    const [[topKpop], [topVpop], [topUsuk], [topAll]] = await Promise.all(queries);

    if (topKpop && topKpop[0]) { summary.KPOP.topSongTitle = topKpop[0].title; summary.KPOP.topCoverUrl = topKpop[0].cover_url; }
    if (topVpop && topVpop[0]) { summary.VPOP.topSongTitle = topVpop[0].title; summary.VPOP.topCoverUrl = topVpop[0].cover_url; }
    if (topUsuk && topUsuk[0]) { summary.USUK.topSongTitle = topUsuk[0].title; summary.USUK.topCoverUrl = topUsuk[0].cover_url; }
    if (topAll && topAll[0]) { summary.ALL.topSongTitle = topAll[0].title; summary.ALL.topCoverUrl = topAll[0].cover_url; }

    res.json({ success: true, data: [summary.KPOP, summary.VPOP, summary.USUK, summary.ALL] });
  } catch (error) {
    console.error('getSongGroupsSummary Error:', error);
    next(error);
  }
};

exports.getSongStatistics = async (req, res, next) => {
  try {
    const { group } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        whereClause += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        whereClause += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        whereClause += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }

    // Top Songs
    const [topSongs] = await pool.query(`
      SELECT s.title, s.play_count as listens, a.name as artist 
      FROM songs s 
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} 
      ORDER BY s.play_count DESC LIMIT 10
    `, params);

    // Genre Distribution
    const [genreDistribution] = await pool.query(`
      SELECT g.name as label, COUNT(*) as count 
      FROM songs s 
      JOIN genres g ON s.genre_id = g.id 
      ${whereClause} 
      GROUP BY g.id
    `, params);

    // Added Over Time (last 12 months)
    const [addedOverTime] = await pool.query(`
      SELECT DATE_FORMAT(s.created_at, '%Y-%m') as label, COUNT(*) as count 
      FROM songs s 
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} AND s.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY label ORDER BY label ASC
    `, params);

    // Status Distribution
    const [statusDistribution] = await pool.query(`
      SELECT IF(s.is_active=1, 'Active', 'Inactive') as label, COUNT(*) as count 
      FROM songs s 
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} 
      GROUP BY label
    `, params);

    // Missing Metadata Count
    const [[{ missingMetadataCount }]] = await pool.query(`
      SELECT COUNT(*) as missingMetadataCount 
      FROM songs s 
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} AND (s.audio_url IS NULL OR s.cover_url IS NULL OR s.artist_id IS NULL OR s.genre_id IS NULL)
    `, params);

    res.json({
      success: true,
      data: { topSongs, genreDistribution, addedOverTime, statusDistribution, missingMetadataCount }
    });
  } catch (error) {
    console.error('getSongStatistics Error:', error);
    next(error);
  }
};

exports.bulkUpdateSongsStatus = async (req, res, next) => {
  try {
    const { songIds, status } = req.body;
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách bài hát rỗng' });
    }
    const isActive = status === 'active' ? 1 : 0;
    await pool.query('UPDATE songs SET is_active = ? WHERE id IN (?)', [isActive, songIds]);
    res.json({ success: true, message: `Đã cập nhật trạng thái cho ${songIds.length} bài hát` });
  } catch (error) {
    console.error('bulkUpdateSongsStatus Error:', error);
    next(error);
  }
};

exports.bulkUpdateSongsMarket = async (req, res, next) => {
  try {
    const { songIds, market } = req.body;
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách bài hát rỗng' });
    }
    if (!['VPOP', 'KPOP', 'USUK', 'OTHER'].includes(market)) {
      return res.status(400).json({ success: false, message: 'Market không hợp lệ' });
    }
    await pool.query('UPDATE songs SET market = ? WHERE id IN (?)', [market, songIds]);
    res.json({ success: true, message: `Đã gán nhóm ${market} cho ${songIds.length} bài hát` });
  } catch (error) {
    console.error('bulkUpdateSongsMarket Error:', error);
    next(error);
  }
};

exports.getMetadataIssues = async (req, res, next) => {
  try {
    const [issues] = await pool.query(`
      SELECT s.id, s.title,
        CASE WHEN s.cover_url IS NULL THEN 1 ELSE 0 END as missingCover,
        CASE WHEN s.audio_url IS NULL THEN 1 ELSE 0 END as missingAudio,
        CASE WHEN s.artist_id IS NULL THEN 1 ELSE 0 END as missingArtist,
        CASE WHEN s.genre_id IS NULL THEN 1 ELSE 0 END as missingGenre
      FROM songs s
      WHERE s.cover_url IS NULL OR s.audio_url IS NULL OR s.artist_id IS NULL OR s.genre_id IS NULL
      LIMIT 100
    `);
    res.json({ success: true, data: issues });
  } catch (error) {
    console.error('getMetadataIssues Error:', error);
    next(error);
  }
};

// 3. Quản lý Giao dịch
exports.getAllTransactions = async (req, res, next) => {
  try {
    const [transactions] = await pool.query(`
      SELECT t.id, t.payment_code AS order_code, t.payment_code, t.amount, t.provider,
             UPPER(t.status) AS status, t.paid_at, t.created_at,
             u.display_name as user_name, u.email as user_email,
             p.name as plan_name
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      JOIN premium_plans p ON t.plan_id = p.id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('getAllTransactions Error:', error);
    next(error);
  }
};

// 4. Quản lý Nghệ sĩ
exports.getAllArtists = async (req, res, next) => {
  try {
    const [artists] = await pool.query(`
      SELECT a.id, a.name, a.bio, a.avatar_url, a.region, a.created_at,
             COUNT(s.id) as song_count,
             COALESCE(SUM(s.play_count), 0) as total_plays
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    res.json({ success: true, data: artists });
  } catch (error) {
    console.error('getAllArtists Error:', error);
    next(error);
  }
};

exports.getArtistDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [artists] = await pool.query('SELECT * FROM artists WHERE id = ?', [id]);
    
    if (artists.length === 0) {
      return res.status(404).json({ success: false, message: 'Nghệ sĩ không tồn tại' });
    }
    
    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.play_count, s.is_active, s.created_at,
             s.artist_id, s.album_id, s.genre_id,
             a.name as artist_name, al.title as album, g.name as genre
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.artist_id = ?
      ORDER BY s.created_at DESC
    `, [id]);

    res.json({ success: true, data: { ...artists[0], songs } });
  } catch (error) {
    console.error('getArtistDetails Error:', error);
    next(error);
  }
};

exports.createArtist = async (req, res, next) => {
  try {
    const { name, bio, region } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên nghệ sĩ là bắt buộc' });

    let avatarUrl = null;
    if (req.file) {
      const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.file.path);
      avatarUrl = '/uploads/' + relativePath.split(path.sep).join('/');
    }

    const [result] = await pool.query(
      'INSERT INTO artists (name, bio, region, avatar_url) VALUES (?, ?, ?, ?)',
      [name, bio, region || 'Khác', avatarUrl]
    );

    const artistId = result.insertId;
    if (artistId && !avatarUrl) {
      const { ensureArtistAvatar } = require('../services/artistImage.service');
      ensureArtistAvatar(artistId).catch(error => {
        console.error("Auto fetch artist avatar failed:", error.message);
      });
    }

    res.json({ success: true, message: 'Thêm nghệ sĩ thành công' });
  } catch (error) {
    console.error('createArtist Error:', error);
    next(error);
  }
};

exports.updateArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, bio, region } = req.body;

    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) { updateFields.push('name = ?'); updateParams.push(name); }
    if (bio !== undefined) { updateFields.push('bio = ?'); updateParams.push(bio); }
    if (region !== undefined) { updateFields.push('region = ?'); updateParams.push(region); }

    if (req.file) {
      const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.file.path);
      const avatarUrl = '/uploads/' + relativePath.split(path.sep).join('/');
      updateFields.push('avatar_url = ?');
      updateParams.push(avatarUrl);
    }

    if (updateFields.length > 0) {
      updateParams.push(id);
      await pool.query(`UPDATE artists SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    }

    res.json({ success: true, message: 'Cập nhật nghệ sĩ thành công' });
  } catch (error) {
    console.error('updateArtist Error:', error);
    next(error);
  }
};

exports.deleteArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Check if artist has songs
    const [songs] = await pool.query('SELECT id FROM songs WHERE artist_id = ? LIMIT 1', [id]);
    if (songs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không thể xóa nghệ sĩ vì hệ thống đang có bài hát của nghệ sĩ này. Hãy xóa các bài hát trước.' 
      });
    }

    await pool.query('DELETE FROM artists WHERE id = ?', [id]);
    res.json({ success: true, message: 'Xóa nghệ sĩ thành công' });
  } catch (error) {
    console.error('deleteArtist Error:', error);
    next(error);
  }
};

// 5. Đồng bộ nhạc từ CSV
exports.syncMusic = async (req, res, next) => {
  const fs = require('fs');
  const readline = require('readline');
  const path = require('path');

  const csvPath = path.join(__dirname, '..', '..', '..', 'music', 'Spotify and Youtube', 'Spotify_Youtube.csv');

  const coverImages = [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80',
    'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&q=80',
    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=500&q=80',
    'https://images.unsplash.com/photo-1487180142328-054b783fc471?w=500&q=80',
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&q=80',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&q=80',
    'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500&q=80',
  ];

  try {
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ success: false, message: `CSV not found: ${csvPath}` });
    }

    // Parse CSV
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += char; }
      }
      result.push(current.trim());
      return result;
    }

    let header = null;
    const rawTracks = [];

    for await (const line of rl) {
      if (!line.trim()) continue;
      const parsed = parseCSVLine(line);
      if (!header) { header = parsed; continue; }

      const artist = parsed[1];
      const trackName = parsed[3];
      const albumName = parsed[4];
      const uri = parsed[6];
      const tempo = parseFloat(parsed[16]) || 120.0;
      const durationMs = parseFloat(parsed[17]) || 180000;
      const durationSec = Math.round(durationMs / 1000);
      const streams = parseFloat(parsed[27]) || 0;

      if (artist && trackName && uri && uri.startsWith('spotify:track:')) {
        rawTracks.push({ artist, trackName, albumName: albumName || 'Single', uri, tempo, durationSec, streams });
      }
    }

    // Sort by streams
    rawTracks.sort((a, b) => b.streams - a.streams);

    // Priority artists
    const priorityArtists = ['blackpink', 'sơn tùng', 'sơn tùng m-tp', 'đen', 'đen vâu', 'jack', 'tlinh', 
      'vũ.', 'hoàng thuỳ linh', 'lisa', 'jennie', 'rosé', 'jisoo', 'bigbang', 'bts', 
      'taylor swift', 'ed sheeran', 'ariana grande', 'the weeknd', 'dua lipa',
      'michael jackson', 'eminem', 'drake', 'justin bieber', 'billie eilish',
      'adele', 'bruno mars', 'post malone', 'imagine dragons', 'maroon 5'];

    const uniqueTracks = [];
    const seen = new Set();

    // First pass: priority artists
    for (const t of rawTracks) {
      const key = `${t.trackName.toLowerCase()}|||${t.artist.toLowerCase()}`;
      const artistLower = t.artist.toLowerCase();
      if (priorityArtists.some(pa => artistLower.includes(pa)) && !seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(t);
      }
    }

    // Second pass: fill remaining up to 500
    for (const t of rawTracks) {
      if (uniqueTracks.length >= 500) break;
      const key = `${t.trackName.toLowerCase()}|||${t.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(t);
      }
    }

    // Insert to DB
    const conn = await pool.getConnection();
    let songCount = 0;
    const newArtistIds = [];
    const newSongIds = [];
    try {
      await conn.beginTransaction();

      for (let i = 0; i < uniqueTracks.length; i++) {
        const track = uniqueTracks[i];
        const genreId = (i % 12) + 1;
        const coverUrl = coverImages[i % coverImages.length];

        // Artist
        let [artists] = await conn.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [track.artist]);
        let artistId;
        if (artists.length === 0) {
          const [r] = await conn.query('INSERT INTO artists (name) VALUES (?)', [track.artist]);
          artistId = r.insertId;
          newArtistIds.push(artistId);
        } else { artistId = artists[0].id; }

        // Album
        let albumId = null;
        let finalAlbumName = track.albumName;
        let albumType = 'unknown';
        let totalTracks = 0;

        if (!finalAlbumName || finalAlbumName.toLowerCase() === 'single') {
          finalAlbumName = `${track.trackName} - Single`;
          albumType = 'single';
          totalTracks = 1;
        }

        if (finalAlbumName) {
          let [albums] = await conn.query('SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1', [finalAlbumName, artistId]);
          if (albums.length === 0) {
            const [r] = await conn.query('INSERT INTO albums (title, artist_id, genre_id, cover_url, album_type, total_tracks) VALUES (?, ?, ?, ?, ?, ?)', [finalAlbumName, artistId, genreId, coverUrl, albumType, totalTracks]);
            albumId = r.insertId;
          } else { albumId = albums[0].id; }
        }

        // Song
        let [songs] = await conn.query('SELECT id FROM songs WHERE audio_url = ? OR (title = ? AND artist_id = ?)', [track.uri, track.trackName, artistId]);
        if (songs.length === 0) {
          const [songRes] = await conn.query(`
            INSERT INTO songs (album_id, artist_id, genre_id, title, duration_sec, audio_url, cover_url, tempo, language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [albumId, artistId, genreId, track.trackName, track.durationSec, track.uri, null, track.tempo, 'en']);
          songCount++;
          newSongIds.push(songRes.insertId);
        }
      }

      await conn.commit();

      if (newArtistIds.length > 0) {
        const { ensureArtistAvatar } = require('../services/artistImage.service');
        for (const id of newArtistIds) {
          ensureArtistAvatar(id).catch(err => {
            console.error(`Sync avatar failed for artist ID ${id}:`, err.message);
          });
        }
      }

      if (newSongIds.length > 0) {
        const { ensureSongCover } = require('../services/songImage.service');
        // Chạy ngầm việc fetch cover cho các bài mới
        setImmediate(async () => {
          for (const sId of newSongIds) {
            await ensureSongCover(sId);
            // Delay một chút để không spam API
            await new Promise(r => setTimeout(r, 1000));
          }
        });
      }
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({
      success: true,
      message: `Đồng bộ thành công! Đã thêm ${songCount} bài hát mới từ ${uniqueTracks.length} bài hát đã chọn.`,
      data: { totalParsed: rawTracks.length, selected: uniqueTracks.length, newSongs: songCount }
    });
  } catch (error) {
    console.error('syncMusic Error:', error);
    next(error);
  }
};
