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
        ) as listens_7d
      FROM genres g
      WHERE ${whereClause}
      ORDER BY g.sort_order ASC, g.id DESC
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
    const { name, slug, description, color, icon, is_featured, sort_order, status } = req.body;
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
      INSERT INTO genres (name, slug, description, color, icon, cover_url, is_featured, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, 
      finalSlug, 
      description || null, 
      color || null, 
      icon || null, 
      cover_url, 
      is_featured === 'true' || is_featured === true ? 1 : 0, 
      parseInt(sort_order) || 0, 
      status || 'active'
    ]);

    res.status(201).json({ success: true, message: 'Thêm thể loại thành công', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

exports.updateGenre = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { name, slug, description, color, icon, is_featured, sort_order, status } = req.body;
    
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
          status = COALESCE(?, status)
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
