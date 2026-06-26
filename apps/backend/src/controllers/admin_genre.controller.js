const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

exports.getAllGenres = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, featured } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    let params = [];
    
    if (search) {
      whereClause += ' AND g.name LIKE ?';
      params.push(`%${search}%`);
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND g.status = ?';
      params.push(status);
    }
    
    if (featured !== undefined && featured !== 'all') {
      whereClause += ' AND g.is_featured = ?';
      params.push(featured === 'true' || featured === '1' ? 1 : 0);
    }

    const { data_status, taxonomy_flag } = req.query;

    // Lọc theo trạng thái dữ liệu (has_data = song_count > 0, no_data = song_count = 0)
    // Để lọc được trên song_count, phải dùng HAVING hoặc join, vì where không áp dụng cho SELECT phụ
    // Cách an toàn hơn: dùng EXISTS / NOT EXISTS
    if (data_status === 'has_data') {
      whereClause += ' AND EXISTS (SELECT 1 FROM songs s WHERE s.genre_id = g.id)';
    } else if (data_status === 'no_data') {
      whereClause += ' AND NOT EXISTS (SELECT 1 FROM songs s WHERE s.genre_id = g.id)';
    }

    if (taxonomy_flag && taxonomy_flag !== 'all') {
      if (taxonomy_flag === 'cold_start') whereClause += ' AND g.use_in_cold_start = 1';
      else if (taxonomy_flag === 'recommendation') whereClause += ' AND g.use_in_recommendation = 1';
      else if (taxonomy_flag === 'ai_playlist') whereClause += ' AND g.use_in_ai_playlist = 1';
    }

    // Lấy danh sách thể loại và tính toán
    const [rows] = await pool.query(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM songs s WHERE s.genre_id = g.id) as song_count,
        (SELECT COUNT(*) FROM user_genre_preferences ugp WHERE ugp.genre_id = g.id) as user_preference_count,
        (
          SELECT SUM(s.play_count) 
          FROM songs s 
          WHERE s.genre_id = g.id
        ) as total_plays,
        (
          SELECT COUNT(lh.id) 
          FROM listening_history lh 
          JOIN songs s ON lh.song_id = s.id 
          WHERE s.genre_id = g.id AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as listens_7d,
        (SELECT COUNT(DISTINCT s.artist_id) FROM songs s WHERE s.genre_id = g.id) as artist_count,
        (SELECT COUNT(DISTINCT s.album_id) FROM songs s WHERE s.genre_id = g.id AND s.album_id IS NOT NULL) as album_count,
        g.market, g.parent_id, g.use_in_recommendation, g.use_in_cold_start, g.use_in_ai_playlist
      FROM genres g
      WHERE ${whereClause}
      ORDER BY song_count DESC, listens_7d DESC, g.name ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [totalRows] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM genres g 
      WHERE ${whereClause}
    `, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: totalRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRows[0].total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getGenreDetail = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM songs s WHERE s.genre_id = g.id) as song_count,
        (SELECT COUNT(*) FROM user_genre_preferences ugp WHERE ugp.genre_id = g.id) as user_preference_count
      FROM genres g 
      WHERE g.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.createGenre = async (req, res, next) => {
  try {
    const { 
      name, slug, description, color, icon, is_featured, sort_order, status,
      market, parent_id, use_in_recommendation, use_in_cold_start, use_in_ai_playlist 
    } = req.body;
    let finalSlug = slug;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên thể loại là bắt buộc' });
    }

    if (!finalSlug) {
      finalSlug = name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
    }

    // Kiểm tra trùng lặp
    const [existing] = await pool.query('SELECT id FROM genres WHERE name = ? OR slug = ?', [name, finalSlug]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Tên hoặc slug đã tồn tại' });
    }

    let cover_url = null;
    if (req.file) {
      cover_url = `/uploads/genres/${req.file.filename}`;
    }

    const [result] = await pool.query(`
      INSERT INTO genres (
        name, slug, description, color, icon, cover_url, is_featured, sort_order, status,
        market, parent_id, use_in_recommendation, use_in_cold_start, use_in_ai_playlist
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, 
      finalSlug, 
      description || null, 
      color || null, 
      icon || null, 
      cover_url, 
      is_featured === 'true' || is_featured === true ? 1 : 0, 
      parseInt(sort_order) || 0, 
      status || 'active',
      market || null,
      parent_id ? parseInt(parent_id) : null,
      use_in_recommendation === undefined ? 1 : (use_in_recommendation === 'true' || use_in_recommendation === true ? 1 : 0),
      use_in_cold_start === undefined ? 1 : (use_in_cold_start === 'true' || use_in_cold_start === true ? 1 : 0),
      use_in_ai_playlist === undefined ? 1 : (use_in_ai_playlist === 'true' || use_in_ai_playlist === true ? 1 : 0)
    ]);

    res.status(201).json({ success: true, message: 'Thêm thể loại thành công', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

exports.updateGenre = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { 
      name, slug, description, color, icon, is_featured, sort_order, status,
      market, parent_id, use_in_recommendation, use_in_cold_start, use_in_ai_playlist 
    } = req.body;
    
    // Kiểm tra tồn tại
    const [current] = await pool.query('SELECT * FROM genres WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });
    }

    // Kiểm tra trùng lặp (trừ chính nó)
    if (name || slug) {
      const checkName = name || current[0].name;
      const checkSlug = slug || current[0].slug;
      const [existing] = await pool.query('SELECT id FROM genres WHERE (name = ? OR slug = ?) AND id != ?', [checkName, checkSlug, id]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Tên hoặc slug đã tồn tại ở thể loại khác' });
      }
    }

    let cover_url = current[0].cover_url;
    if (req.file) {
      cover_url = `/uploads/genres/${req.file.filename}`;
      // Xoá ảnh cũ nếu có (tuỳ chọn)
      if (current[0].cover_url) {
        const oldPath = path.join(__dirname, '../../', current[0].cover_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    await pool.query(`
      UPDATE genres 
      SET name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          description = ?,
          color = ?,
          icon = ?,
          cover_url = ?,
          is_featured = ?,
          sort_order = ?,
          status = COALESCE(?, status),
          market = ?,
          parent_id = ?,
          use_in_recommendation = ?,
          use_in_cold_start = ?,
          use_in_ai_playlist = ?
      WHERE id = ?
    `, [
      name,
      slug,
      description !== undefined ? description : current[0].description,
      color !== undefined ? color : current[0].color,
      icon !== undefined ? icon : current[0].icon,
      cover_url,
      is_featured !== undefined ? (is_featured === 'true' || is_featured === true ? 1 : 0) : current[0].is_featured,
      sort_order !== undefined ? parseInt(sort_order) : current[0].sort_order,
      status,
      market !== undefined ? market : current[0].market,
      parent_id !== undefined ? (parent_id ? parseInt(parent_id) : null) : current[0].parent_id,
      use_in_recommendation !== undefined ? (use_in_recommendation === 'true' || use_in_recommendation === true ? 1 : 0) : current[0].use_in_recommendation,
      use_in_cold_start !== undefined ? (use_in_cold_start === 'true' || use_in_cold_start === true ? 1 : 0) : current[0].use_in_cold_start,
      use_in_ai_playlist !== undefined ? (use_in_ai_playlist === 'true' || use_in_ai_playlist === true ? 1 : 0) : current[0].use_in_ai_playlist,
      id
    ]);

    res.json({ success: true, message: 'Cập nhật thể loại thành công' });
  } catch (err) {
    next(err);
  }
};

exports.deleteGenre = async (req, res, next) => {
  try {
    const id = req.params.id;
    
    // Kiểm tra liên kết
    const [songs] = await pool.query('SELECT id FROM songs WHERE genre_id = ? LIMIT 1', [id]);
    const [prefs] = await pool.query('SELECT user_id FROM user_genre_preferences WHERE genre_id = ? LIMIT 1', [id]);
    
    if (songs.length > 0 || prefs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thể loại đang được sử dụng, chỉ có thể ẩn hoặc gộp.' 
      });
    }

    // Xoá mềm (chuyển sang hidden) thay vì xoá cứng để an toàn
    await pool.query('UPDATE genres SET status = "hidden" WHERE id = ?', [id]);

    res.json({ success: true, message: 'Đã ẩn thể loại' });
  } catch (err) {
    next(err);
  }
};

exports.updateGenreStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE genres SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    next(err);
  }
};

exports.updateGenreFeatured = async (req, res, next) => {
  try {
    const { is_featured } = req.body;
    await pool.query('UPDATE genres SET is_featured = ? WHERE id = ?', [is_featured ? 1 : 0, req.params.id]);
    res.json({ success: true, message: 'Cập nhật featured thành công' });
  } catch (err) {
    next(err);
  }
};

exports.mergeGenres = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { sourceGenreId, targetGenreId } = req.body;

    if (!sourceGenreId || !targetGenreId || sourceGenreId == targetGenreId) {
      return res.status(400).json({ success: false, message: 'ID nguồn và đích không hợp lệ' });
    }

    const [genres] = await connection.query('SELECT id FROM genres WHERE id IN (?, ?)', [sourceGenreId, targetGenreId]);
    if (genres.length !== 2) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });
    }

    await connection.beginTransaction();

    // Chuyển bài hát
    const [updateSongs] = await connection.query('UPDATE songs SET genre_id = ? WHERE genre_id = ?', [targetGenreId, sourceGenreId]);
    
    // Nếu có bảng song_genres (multi-genre), cũng cập nhật. Ignore duplicate
    try {
      await connection.query('UPDATE IGNORE song_genres SET genre_id = ? WHERE genre_id = ?', [targetGenreId, sourceGenreId]);
      await connection.query('DELETE FROM song_genres WHERE genre_id = ?', [sourceGenreId]); // Xoá duplicate nếu UPDATE IGNORE không áp dụng được
    } catch(e) {
      // Bỏ qua nếu bảng song_genres chưa tồn tại hoặc lỗi nhẹ
    }

    // Chuyển user preferences (INSERT IGNORE để tránh lỗi duplicate PK, sau đó xoá ở source)
    const [updatePrefs] = await connection.query('INSERT IGNORE INTO user_genre_preferences (user_id, genre_id, weight) SELECT user_id, ?, weight FROM user_genre_preferences WHERE genre_id = ?', [targetGenreId, sourceGenreId]);
    await connection.query('DELETE FROM user_genre_preferences WHERE genre_id = ?', [sourceGenreId]);

    // Ẩn thể loại nguồn
    await connection.query('UPDATE genres SET status = "hidden", name = CONCAT(name, " (Merged)") WHERE id = ?', [sourceGenreId]);

    await connection.commit();
    res.json({ 
      success: true, 
      message: 'Gộp thể loại thành công',
      data: {
        songsMoved: updateSongs.affectedRows,
      }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

exports.getGenreSongs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 's.genre_id = ?';
    let params = [req.params.id];
    
    if (search) {
      whereClause += ' AND (s.title LIKE ? OR a.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(`
      SELECT s.id, s.title, s.cover_url, s.is_active, s.release_status, a.name as artist_name, al.title as album_title
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [totalRows] = await pool.query(`
      SELECT COUNT(*) as total
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      WHERE ${whereClause}
    `, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: totalRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRows[0].total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.bulkAssignGenre = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { songIds, genreId, role = 'primary' } = req.body;
    
    if (!Array.isArray(songIds) || songIds.length === 0 || !genreId) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    await connection.beginTransaction();

    if (role === 'primary') {
      const placeholders = songIds.map(() => '?').join(',');
      await connection.query(`UPDATE songs SET genre_id = ? WHERE id IN (${placeholders})`, [genreId, ...songIds]);
    }
    
    try {
      // Thêm vào bảng song_genres (cho cả primary/secondary nếu dùng multi-genre sau này)
      for (const songId of songIds) {
        await connection.query(
          'INSERT INTO song_genres (song_id, genre_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = ?', 
          [songId, genreId, role, role]
        );
      }
    } catch(e) {
      // Ignored if table doesn't exist
    }

    await connection.commit();
    res.json({ success: true, message: 'Gán thể loại thành công' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// ==========================================
// NEW ENDPOINTS FOR TAXONOMY CENTER
// ==========================================

exports.getGenresSummary = async (req, res, next) => {
  try {
    const [totalRows] = await pool.query(`SELECT COUNT(*) as total FROM genres`);
    const [activeTotalRows] = await pool.query(`SELECT COUNT(*) as active_total FROM genres WHERE status = 'active'`);
    const [emptyActiveRows] = await pool.query(`
      SELECT COUNT(DISTINCT g.id) as empty_active 
      FROM genres g 
      WHERE g.status = 'active' AND NOT EXISTS (SELECT 1 FROM songs s WHERE s.genre_id = g.id)
    `);
    const [featuredRows] = await pool.query(`SELECT COUNT(*) as featured FROM genres WHERE is_featured = 1`);
    
    const [listenRows] = await pool.query(`
      SELECT COUNT(lh.id) as listens_7d
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      WHERE s.genre_id IS NOT NULL AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    const [userPrefRows] = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as users_selected
      FROM user_genre_preferences
    `);

    const [playlistUsageRows] = await pool.query(`
      SELECT COUNT(DISTINCT ps.playlist_id) as playlist_usage
      FROM playlist_songs ps
      JOIN songs s ON ps.song_id = s.id
      WHERE s.genre_id IS NOT NULL
    `);

    res.json({
      success: true,
      data: {
        total: totalRows[0].total,
        active_total: activeTotalRows[0].active_total,
        active_with_data: activeTotalRows[0].active_total - emptyActiveRows[0].empty_active,
        empty_active: emptyActiveRows[0].empty_active,
        featured: featuredRows[0].featured,
        listens_7d: listenRows[0].listens_7d,
        users_selected: userPrefRows[0].users_selected,
        playlist_usage: playlistUsageRows[0].playlist_usage
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getGenresInsights = async (req, res, next) => {
  try {
    // Trending genres
    const [trending] = await pool.query(`
      SELECT g.id, g.name, COUNT(lh.id) as listens
      FROM genres g
      JOIN songs s ON s.genre_id = g.id
      JOIN listening_history lh ON lh.song_id = s.id
      WHERE lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND g.status = 'active'
      GROUP BY g.id
      ORDER BY listens DESC
      LIMIT 3
    `);

    // Missing Data (no cover or no description)
    // Only count active genres that HAVE data or ARE used in taxonomy
    const [missingData] = await pool.query(`
      SELECT COUNT(*) as count FROM genres g
      WHERE (g.cover_url IS NULL OR g.description IS NULL OR g.description = '') 
      AND g.status = 'active'
      AND (
        g.use_in_cold_start = 1 OR g.use_in_recommendation = 1 OR g.use_in_ai_playlist = 1 
        OR EXISTS (SELECT 1 FROM songs WHERE genre_id = g.id)
      )
    `);

    // Few Songs (< 50 songs) and is used in cold_start/recommendation
    const [fewSongs] = await pool.query(`
      SELECT COUNT(*) as count FROM (
        SELECT g.id FROM genres g
        LEFT JOIN songs s ON s.genre_id = g.id
        WHERE g.status = 'active' AND (g.use_in_cold_start = 1 OR g.use_in_recommendation = 1)
        GROUP BY g.id
        HAVING COUNT(s.id) < 50
      ) t
    `);

    // Needs optimization (used in recommendation but have low listening < 50 or low song_count < 10)
    const [needsOpt] = await pool.query(`
      SELECT COUNT(*) as count FROM (
        SELECT g.id FROM genres g
        LEFT JOIN songs s ON s.genre_id = g.id
        LEFT JOIN listening_history lh ON lh.song_id = s.id AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        WHERE (g.use_in_recommendation = 1 OR g.use_in_ai_playlist = 1) AND g.status = 'active'
        GROUP BY g.id
        HAVING COUNT(lh.id) < 50 OR COUNT(DISTINCT s.id) < 10
      ) t
    `);

    res.json({
      success: true,
      data: {
        trending: trending,
        missing_data_count: missingData[0].count,
        few_songs_count: fewSongs[0].count,
        needs_optimization_count: needsOpt[0].count
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getGenreDetailFull = async (req, res, next) => {
  try {
    const genreId = req.params.id;
    
    // Basic info with parent name
    const [genres] = await pool.query(`
      SELECT g.*, p.name as parent_name 
      FROM genres g 
      LEFT JOIN genres p ON g.parent_id = p.id 
      WHERE g.id = ?
    `, [genreId]);
    
    if (genres.length === 0) {
      return res.status(404).json({ success: false, message: 'Genre not found' });
    }
    const genre = genres[0];

    // Stats
    const [statsResult] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM songs WHERE genre_id = ?) as song_count,
        (SELECT COUNT(DISTINCT artist_id) FROM songs WHERE genre_id = ?) as artist_count,
        (SELECT COUNT(DISTINCT album_id) FROM songs WHERE genre_id = ?) as album_count,
        (SELECT COUNT(lh.id) FROM listening_history lh JOIN songs s ON lh.song_id = s.id WHERE s.genre_id = ? AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as listens_7d,
        (SELECT COUNT(lh.id) FROM listening_history lh JOIN songs s ON lh.song_id = s.id WHERE s.genre_id = ? AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as listens_30d,
        (SELECT COUNT(*) FROM user_genre_preferences WHERE genre_id = ?) as users_selected,
        (SELECT COUNT(DISTINCT ps.playlist_id) FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE s.genre_id = ?) as playlist_usage
    `, [genreId, genreId, genreId, genreId, genreId, genreId, genreId]);
    const stats = statsResult[0];

    // Listens trend 30d
    const [trendRaw] = await pool.query(`
      SELECT DATE(lh.listened_at) as date, COUNT(lh.id) as count
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      WHERE s.genre_id = ? AND lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(lh.listened_at)
      ORDER BY date ASC
    `, [genreId]);

    // Fill missing days
    const listens_trend_30d = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = trendRaw.find(t => {
        // Handle timezone/date formatting issues by checking string start
        const dbDate = new Date(t.date);
        dbDate.setMinutes(dbDate.getMinutes() - dbDate.getTimezoneOffset());
        return dbDate.toISOString().split('T')[0] === dateStr;
      });
      listens_trend_30d.push({
        date: dateStr,
        count: found ? found.count : 0
      });
    }

    // Top 20 songs
    const [topSongs] = await pool.query(`
      SELECT s.id, s.title, s.cover_url, s.artist_id, a.name as artist_name, COUNT(lh.id) as listens
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN listening_history lh ON lh.song_id = s.id AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE s.genre_id = ? AND s.is_active = 1
      GROUP BY s.id
      ORDER BY listens DESC, s.id DESC
      LIMIT 20
    `, [genreId]);

    // Top 10 artists
    const [topArtists] = await pool.query(`
      SELECT a.id, a.name, a.avatar_url, 
        COUNT(DISTINCT s.id) as song_count, 
        COUNT(lh.id) as listens
      FROM artists a
      JOIN songs s ON s.artist_id = a.id
      LEFT JOIN listening_history lh ON lh.song_id = s.id AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE s.genre_id = ?
      GROUP BY a.id
      ORDER BY listens DESC, song_count DESC
      LIMIT 10
    `, [genreId]);

    // Related Playlists
    let relatedPlaylists = [];
    try {
      const [rpData] = await pool.query(`
        SELECT p.id, p.name, p.cover_url, p.is_public, COUNT(ps.song_id) as genre_song_count
        FROM playlists p
        JOIN playlist_songs ps ON p.id = ps.playlist_id
        JOIN songs s ON ps.song_id = s.id
        WHERE s.genre_id = ? AND p.is_system = 1
        GROUP BY p.id, p.name, p.cover_url, p.is_public
        ORDER BY genre_song_count DESC
        LIMIT 5
      `, [genreId]);
      
      relatedPlaylists = rpData.map(p => ({
        ...p,
        title: p.name // Map name to title for frontend compatibility
      }));
    } catch (rpErr) {
      console.warn('[Warning] Failed to fetch related playlists for genre:', genreId, rpErr.message);
      relatedPlaylists = [];
    }

    // Data Quality logic
    const data_quality = [];
    if (!genre.cover_url) data_quality.push({ type: 'warning', message: 'Thiếu ảnh Cover' });
    if (!genre.description) data_quality.push({ type: 'warning', message: 'Thiếu mô tả chi tiết' });
    if (stats.song_count < 50) data_quality.push({ type: 'error', message: 'Quá ít bài hát (< 50 bài)' });
    if (stats.listens_30d < 50) data_quality.push({ type: 'error', message: 'Lượt nghe 30 ngày quá thấp (< 50)' });
    if (genre.use_in_cold_start && stats.song_count < 50) {
      data_quality.push({ type: 'error', message: 'Bật Cold Start nhưng chưa đủ bài hát đa dạng' });
    }
    if (genre.use_in_recommendation && stats.listens_30d < 50) {
      data_quality.push({ type: 'warning', message: 'Bật Recommendation nhưng dữ liệu người dùng chưa đủ để AI học' });
    }

    res.json({
      success: true,
      data: {
        ...genre,
        stats,
        listens_trend_30d,
        top_songs: topSongs,
        top_artists: topArtists,
        related_playlists: relatedPlaylists,
        data_quality
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTaxonomyFlags = async (req, res, next) => {
  try {
    const { use_in_recommendation, use_in_cold_start, use_in_ai_playlist } = req.body;
    
    // Build dynamic update
    let updates = [];
    let params = [];
    if (use_in_recommendation !== undefined) {
      updates.push('use_in_recommendation = ?');
      params.push(use_in_recommendation ? 1 : 0);
    }
    if (use_in_cold_start !== undefined) {
      updates.push('use_in_cold_start = ?');
      params.push(use_in_cold_start ? 1 : 0);
    }
    if (use_in_ai_playlist !== undefined) {
      updates.push('use_in_ai_playlist = ?');
      params.push(use_in_ai_playlist ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'Nothing to update' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE genres SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Cập nhật flags thành công' });
  } catch (err) {
    next(err);
  }
};

exports.bulkActionGenres = async (req, res, next) => {
  try {
    const { genreIds, action, value } = req.body;
    
    if (!Array.isArray(genreIds) || genreIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 thể loại' });
    }

    const placeholders = genreIds.map(() => '?').join(',');
    let query = '';
    let params = [];

    switch (action) {
      case 'status':
        query = `UPDATE genres SET status = ? WHERE id IN (${placeholders})`;
        params = [value, ...genreIds];
        break;
      case 'featured':
        query = `UPDATE genres SET is_featured = ? WHERE id IN (${placeholders})`;
        params = [value ? 1 : 0, ...genreIds];
        break;
      case 'taxonomy':
        // value is an object { use_in_recommendation, ... }
        let updates = [];
        let taxonomyParams = [];
        if (value.use_in_recommendation !== undefined) { updates.push('use_in_recommendation = ?'); taxonomyParams.push(value.use_in_recommendation ? 1 : 0); }
        if (value.use_in_cold_start !== undefined) { updates.push('use_in_cold_start = ?'); taxonomyParams.push(value.use_in_cold_start ? 1 : 0); }
        if (value.use_in_ai_playlist !== undefined) { updates.push('use_in_ai_playlist = ?'); taxonomyParams.push(value.use_in_ai_playlist ? 1 : 0); }
        
        if (updates.length > 0) {
          query = `UPDATE genres SET ${updates.join(', ')} WHERE id IN (${placeholders})`;
          params = [...taxonomyParams, ...genreIds];
        } else {
          return res.json({ success: true, message: 'Nothing to update' });
        }
        break;
      default:
        return res.status(400).json({ success: false, message: 'Hành động không hợp lệ' });
    }

    await pool.query(query, params);
    res.json({ success: true, message: 'Thao tác hàng loạt thành công' });
  } catch (err) {
    next(err);
  }
};
