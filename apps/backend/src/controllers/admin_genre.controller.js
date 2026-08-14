const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { jsonToCsv, createCsvFilename, sendCsv } = require('../utils/csv.util');

const GENRE_INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000;
const genreMemoryCache = new Map();
let genreInsightsRefreshPromise = null;
const GENRE_STATUSES = ['active', 'hidden'];
const GENRE_MARKETS = ['VPOP', 'KPOP', 'USUK', 'OTHER'];
const GENRE_ROLES = ['primary', 'secondary'];

function normalizePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizePositiveIdList(values, max = 500, { strict = false } = {}) {
  if (!Array.isArray(values)) return [];
  if (strict && values.length > max) return null;
  const ids = values.map(normalizePositiveId);
  if (strict && ids.some(id => !id)) return null;
  return [...new Set(ids.filter(Boolean))].slice(0, max);
}

function normalizeNonNegativeInteger(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    const error = new Error('Thứ tự sắp xếp không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function normalizeText(value, maxLength, { required = false, field = 'Giá trị' } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      const error = new Error(`${field} là bắt buộc`);
      error.statusCode = 400;
      throw error;
    }
    return undefined;
  }
  const text = String(value).trim();
  if (required && !text) {
    const error = new Error(`${field} là bắt buộc`);
    error.statusCode = 400;
    throw error;
  }
  if (text.length > maxLength) {
    const error = new Error(`${field} không được vượt quá ${maxLength} ký tự`);
    error.statusCode = 400;
    throw error;
  }
  return text || null;
}

function normalizeBoolean(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  const error = new Error('Giá trị boolean không hợp lệ');
  error.statusCode = 400;
  throw error;
}

function normalizeGenreStatus(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const status = String(value).trim();
  if (!GENRE_STATUSES.includes(status)) {
    const error = new Error('Trạng thái thể loại không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  return status;
}

function normalizeGenreMarket(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const market = String(value).trim().toUpperCase();
  if (!GENRE_MARKETS.includes(market)) {
    const error = new Error('Market thể loại không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  return market;
}

function slugifyGenre(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCachedValue(cacheKey) {
  const entry = genreMemoryCache.get(cacheKey);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

function setCachedValue(cacheKey, value, ttlMs = GENRE_INSIGHTS_CACHE_TTL_MS) {
  genreMemoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function toPositiveInt(value, fallback, max = 1000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.floor(n));
}

function getListenTimeColumn() {
  return 'created_at';
}

exports.getAllGenres = async (req, res, next) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 100000);
    const limit = toPositiveInt(req.query.limit, 10, 100);
    const { search, status, featured } = req.query;
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
          WHERE s.genre_id = g.id AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
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
    const name = normalizeText(req.body.name, 100, { required: true, field: 'Tên thể loại' });
    const description = normalizeText(req.body.description, 1000, { field: 'Mô tả' });
    const color = normalizeText(req.body.color, 20, { field: 'Màu sắc' });
    const icon = normalizeText(req.body.icon, 50, { field: 'Icon' });
    const sortOrder = normalizeNonNegativeInteger(req.body.sort_order, 0);
    const status = normalizeGenreStatus(req.body.status, 'active');
    const market = normalizeGenreMarket(req.body.market, null);
    const parentId = req.body.parent_id === undefined || req.body.parent_id === null || req.body.parent_id === ''
      ? null
      : normalizePositiveId(req.body.parent_id);
    let finalSlug = normalizeText(req.body.slug, 100, { field: 'Slug' });

    if (!finalSlug) {
      finalSlug = slugifyGenre(name);
    } else {
      finalSlug = slugifyGenre(finalSlug);
    }
    if (!finalSlug) {
      return res.status(400).json({ success: false, message: 'Slug thể loại không hợp lệ' });
    }
    if (req.body.parent_id !== undefined && req.body.parent_id !== null && req.body.parent_id !== '' && !parentId) {
      return res.status(400).json({ success: false, message: 'Thể loại cha không hợp lệ' });
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
      normalizeBoolean(req.body.is_featured, 0),
      sortOrder,
      status,
      market,
      parentId,
      normalizeBoolean(req.body.use_in_recommendation, 1),
      normalizeBoolean(req.body.use_in_cold_start, 1),
      normalizeBoolean(req.body.use_in_ai_playlist, 1)
    ]);

    res.status(201).json({ success: true, message: 'Thêm thể loại thành công', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

exports.updateGenre = async (req, res, next) => {
  try {
    const id = req.params.id;
    const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
    const hasSlug = Object.prototype.hasOwnProperty.call(req.body, 'slug');
    const name = hasName ? normalizeText(req.body.name, 100, { required: true, field: 'Tên thể loại' }) : undefined;
    const description = Object.prototype.hasOwnProperty.call(req.body, 'description')
      ? normalizeText(req.body.description, 1000, { field: 'Mô tả' })
      : undefined;
    const color = Object.prototype.hasOwnProperty.call(req.body, 'color')
      ? normalizeText(req.body.color, 20, { field: 'Màu sắc' })
      : undefined;
    const icon = Object.prototype.hasOwnProperty.call(req.body, 'icon')
      ? normalizeText(req.body.icon, 50, { field: 'Icon' })
      : undefined;
    let slug = hasSlug ? normalizeText(req.body.slug, 100, { field: 'Slug' }) : undefined;
    if (slug !== undefined && slug !== null) {
      slug = slugifyGenre(slug);
      if (!slug) return res.status(400).json({ success: false, message: 'Slug thể loại không hợp lệ' });
    }
    const status = normalizeGenreStatus(req.body.status, undefined);
    const market = Object.prototype.hasOwnProperty.call(req.body, 'market')
      ? normalizeGenreMarket(req.body.market, null)
      : undefined;
    const parentId = Object.prototype.hasOwnProperty.call(req.body, 'parent_id')
      ? (req.body.parent_id === null || req.body.parent_id === '' ? null : normalizePositiveId(req.body.parent_id))
      : undefined;
    if (Object.prototype.hasOwnProperty.call(req.body, 'parent_id') && req.body.parent_id !== null && req.body.parent_id !== '' && !parentId) {
      return res.status(400).json({ success: false, message: 'Thể loại cha không hợp lệ' });
    }
    if (parentId && Number(parentId) === Number(id)) {
      return res.status(400).json({ success: false, message: 'Thể loại không thể là cha của chính nó' });
    }
    const sortOrder = Object.prototype.hasOwnProperty.call(req.body, 'sort_order')
      ? normalizeNonNegativeInteger(req.body.sort_order)
      : undefined;

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
      req.body.is_featured !== undefined ? normalizeBoolean(req.body.is_featured, current[0].is_featured) : current[0].is_featured,
      sortOrder !== undefined ? sortOrder : current[0].sort_order,
      status,
      market !== undefined ? market : current[0].market,
      parentId !== undefined ? parentId : current[0].parent_id,
      req.body.use_in_recommendation !== undefined ? normalizeBoolean(req.body.use_in_recommendation, current[0].use_in_recommendation) : current[0].use_in_recommendation,
      req.body.use_in_cold_start !== undefined ? normalizeBoolean(req.body.use_in_cold_start, current[0].use_in_cold_start) : current[0].use_in_cold_start,
      req.body.use_in_ai_playlist !== undefined ? normalizeBoolean(req.body.use_in_ai_playlist, current[0].use_in_ai_playlist) : current[0].use_in_ai_playlist,
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

    // Xoá cứng vì đã kiểm tra không có liên kết (bài hát, sở thích người dùng)
    await pool.query('DELETE FROM genres WHERE id = ?', [id]);

    res.json({ success: true, message: 'Đã xóa thể loại hoàn toàn' });
  } catch (err) {
    next(err);
  }
};

exports.updateGenreStatus = async (req, res, next) => {
  try {
    const id = normalizePositiveId(req.params.id);
    const status = normalizeGenreStatus(req.body.status);
    if (!id) return res.status(400).json({ success: false, message: 'ID thể loại không hợp lệ' });
    const [result] = await pool.query('UPDATE genres SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    next(err);
  }
};

exports.updateGenreFeatured = async (req, res, next) => {
  try {
    const id = normalizePositiveId(req.params.id);
    const isFeatured = normalizeBoolean(req.body.is_featured);
    if (!id) return res.status(400).json({ success: false, message: 'ID thể loại không hợp lệ' });
    if (isFeatured === undefined) return res.status(400).json({ success: false, message: 'Thiếu trạng thái featured' });
    const [result] = await pool.query('UPDATE genres SET is_featured = ? WHERE id = ?', [isFeatured, id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });
    res.json({ success: true, message: 'Cập nhật featured thành công' });
  } catch (err) {
    next(err);
  }
};

exports.mergeGenres = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const sourceGenreId = normalizePositiveId(req.body.sourceGenreId);
    const targetGenreId = normalizePositiveId(req.body.targetGenreId);

    if (!sourceGenreId || !targetGenreId || sourceGenreId === targetGenreId) {
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
    const songIds = normalizePositiveIdList(req.body.songIds, 500);
    const genreId = normalizePositiveId(req.body.genreId);
    const role = String(req.body.role || 'primary').trim();

    if (songIds.length === 0 || !genreId) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }
    if (!GENRE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò thể loại không hợp lệ' });
    }

    const [[genreRow]] = await connection.query('SELECT id FROM genres WHERE id = ? LIMIT 1', [genreId]);
    if (!genreRow) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });
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
      WHERE s.genre_id IS NOT NULL AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
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
      WHERE lh.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND g.status = 'active'
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
        LEFT JOIN listening_history lh ON lh.song_id = s.id AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
        (SELECT COUNT(lh.id) FROM listening_history lh JOIN songs s ON lh.song_id = s.id WHERE s.genre_id = ? AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as listens_7d,
        (SELECT COUNT(lh.id) FROM listening_history lh JOIN songs s ON lh.song_id = s.id WHERE s.genre_id = ? AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as listens_30d,
        (SELECT COUNT(*) FROM user_genre_preferences WHERE genre_id = ?) as users_selected,
        (SELECT COUNT(DISTINCT ps.playlist_id) FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE s.genre_id = ?) as playlist_usage
    `, [genreId, genreId, genreId, genreId, genreId, genreId, genreId]);
    const stats = statsResult[0];

    // Listens trend 30d
    const [trendRaw] = await pool.query(`
      SELECT DATE(lh.created_at) as date, COUNT(lh.id) as count
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      WHERE s.genre_id = ? AND lh.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(lh.created_at)
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
      LEFT JOIN listening_history lh ON lh.song_id = s.id AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
      LEFT JOIN listening_history lh ON lh.song_id = s.id AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
    const id = normalizePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID thể loại không hợp lệ' });
    const { use_in_recommendation, use_in_cold_start, use_in_ai_playlist } = req.body;

    // Build dynamic update
    let updates = [];
    let params = [];
    if (use_in_recommendation !== undefined) {
      updates.push('use_in_recommendation = ?');
      params.push(normalizeBoolean(use_in_recommendation));
    }
    if (use_in_cold_start !== undefined) {
      updates.push('use_in_cold_start = ?');
      params.push(normalizeBoolean(use_in_cold_start));
    }
    if (use_in_ai_playlist !== undefined) {
      updates.push('use_in_ai_playlist = ?');
      params.push(normalizeBoolean(use_in_ai_playlist));
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'Nothing to update' });
    }

    params.push(id);
    const [result] = await pool.query(`UPDATE genres SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại' });

    res.json({ success: true, message: 'Cập nhật flags thành công' });
  } catch (err) {
    next(err);
  }
};

exports.bulkActionGenres = async (req, res, next) => {
  try {
    const genreIds = normalizePositiveIdList(req.body.genreIds, 500, { strict: true });
    const action = String(req.body.action || '').trim();
    const { value } = req.body;

    if (!genreIds || genreIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID thể loại không hợp lệ' });
    }

    const placeholders = genreIds.map(() => '?').join(',');
    let query = '';
    let params = [];

    switch (action) {
      case 'status':
        query = `UPDATE genres SET status = ? WHERE id IN (${placeholders})`;
        params = [normalizeGenreStatus(value), ...genreIds];
        break;
      case 'featured':
        {
          const featuredValue = normalizeBoolean(value);
          if (featuredValue === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu trạng thái featured' });
          }
        query = `UPDATE genres SET is_featured = ? WHERE id IN (${placeholders})`;
          params = [featuredValue, ...genreIds];
        }
        break;
      case 'taxonomy':
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return res.status(400).json({ success: false, message: 'Giá trị taxonomy không hợp lệ' });
        }
        // value is an object { use_in_recommendation, ... }
        let updates = [];
        let taxonomyParams = [];
        if (value.use_in_recommendation !== undefined) { updates.push('use_in_recommendation = ?'); taxonomyParams.push(normalizeBoolean(value.use_in_recommendation)); }
        if (value.use_in_cold_start !== undefined) { updates.push('use_in_cold_start = ?'); taxonomyParams.push(normalizeBoolean(value.use_in_cold_start)); }
        if (value.use_in_ai_playlist !== undefined) { updates.push('use_in_ai_playlist = ?'); taxonomyParams.push(normalizeBoolean(value.use_in_ai_playlist)); }

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

    const [result] = await pool.query(query, params);
    res.json({ success: true, message: 'Thao tác hàng loạt thành công', affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

exports.exportGenres = async (req, res, next) => {
  try {
    const { search, status, featured, data_status, taxonomy_flag } = req.query;

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

    const [rows] = await pool.query(`
      SELECT g.id as genre_id, g.name, g.market, p.name as parent_name,
        (SELECT COUNT(*) FROM songs s WHERE s.genre_id = g.id) as song_count,
        (
          SELECT COUNT(lh.id)
          FROM listening_history lh
          JOIN songs s ON lh.song_id = s.id
          WHERE s.genre_id = g.id AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as listens_7d,
        CASE WHEN g.is_featured = 1 THEN 'Có' ELSE 'Không' END as is_featured,
        CASE WHEN g.use_in_recommendation = 1 THEN 'Có' ELSE 'Không' END as use_in_recommendation,
        CASE WHEN g.use_in_cold_start = 1 THEN 'Có' ELSE 'Không' END as use_in_cold_start,
        CASE WHEN g.use_in_ai_playlist = 1 THEN 'Có' ELSE 'Không' END as use_in_ai_playlist,
        g.status
      FROM genres g
      LEFT JOIN genres p ON g.parent_id = p.id
      WHERE ${whereClause}
      ORDER BY song_count DESC, listens_7d DESC, g.name ASC
      LIMIT 10000
    `, params);

    const columns = [
      { header: 'Genre ID', key: 'genre_id' },
      { header: 'Name', key: 'name' },
      { header: 'Market', key: 'market' },
      { header: 'Parent Name', key: 'parent_name' },
      { header: 'Song Count', key: 'song_count' },
      { header: 'Listens 7D', key: 'listens_7d' },
      { header: 'Featured', key: 'is_featured' },
      { header: 'Recommendation', key: 'use_in_recommendation' },
      { header: 'Cold Start', key: 'use_in_cold_start' },
      { header: 'AI Playlist', key: 'use_in_ai_playlist' },
      { header: 'Status', key: 'status' }
    ];

    const csvContent = jsonToCsv(rows, columns);
    const filename = createCsvFilename('genres');
    return sendCsv(res, filename, csvContent);
  } catch (err) {
    console.error('exportGenres Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getGenreOptions = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, parent_id, market
      FROM genres
      ORDER BY name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getAllGenres = async (req, res, next) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 100000);
    const limit = toPositiveInt(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;
    const { search, status, featured, data_status, taxonomy_flag } = req.query;

    let whereClause = '1=1';
    const params = [];

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

    const [rows] = await pool.query(`
      SELECT g.id, g.name, g.slug, g.description, g.cover_url, g.color, g.icon,
             g.status, g.is_featured, g.sort_order, g.created_at, g.updated_at,
             g.market, g.parent_id, g.use_in_recommendation, g.use_in_cold_start, g.use_in_ai_playlist,
             COALESCE(song_stats.song_count, 0) AS song_count,
             COALESCE(song_stats.artist_count, 0) AS artist_count,
             COALESCE(song_stats.album_count, 0) AS album_count,
             COALESCE(song_stats.total_plays, 0) AS total_plays,
             0 AS listens_7d,
             0 AS user_preference_count
      FROM genres g
      LEFT JOIN (
        SELECT genre_id,
               COUNT(*) AS song_count,
               COUNT(DISTINCT artist_id) AS artist_count,
               COUNT(DISTINCT album_id) AS album_count,
               SUM(COALESCE(play_count, 0)) AS total_plays
        FROM songs
        WHERE genre_id IS NOT NULL
        GROUP BY genre_id
      ) song_stats ON song_stats.genre_id = g.id
      WHERE ${whereClause}
      ORDER BY COALESCE(song_stats.song_count, 0) DESC, g.name ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [totalRows] = await pool.query(`
      SELECT COUNT(*) as total
      FROM genres g
      WHERE ${whereClause}
    `, params);

    const genreIds = rows.map((row) => Number(row.id)).filter(Number.isInteger);
    if (genreIds.length) {
      const placeholders = genreIds.map(() => '?').join(',');
      const [listenRows] = await pool.query(`
        SELECT s.genre_id, COUNT(*) AS listens_7d
        FROM listening_history lh
        JOIN songs s ON s.id = lh.song_id
        WHERE lh.${getListenTimeColumn()} >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND s.genre_id IN (${placeholders})
        GROUP BY s.genre_id
      `, genreIds);
      const listenMap = new Map(listenRows.map((row) => [Number(row.genre_id), Number(row.listens_7d || 0)]));

      const [prefRows] = await pool.query(`
        SELECT genre_id, COUNT(*) AS user_preference_count
        FROM user_genre_preferences
        WHERE genre_id IN (${placeholders})
        GROUP BY genre_id
      `, genreIds);
      const prefMap = new Map(prefRows.map((row) => [Number(row.genre_id), Number(row.user_preference_count || 0)]));

      rows.forEach((row) => {
        row.listens_7d = listenMap.get(Number(row.id)) || 0;
        row.user_preference_count = prefMap.get(Number(row.id)) || 0;
      });
    }

    const total = Number(totalRows[0].total || 0);
    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getGenresInsights = async (req, res, next) => {
  try {
    const cacheKey = 'admin_genres_insights';
    const cached = getCachedValue(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        meta: { cache: 'hit', refreshing: false }
      });
    }

    const [trending] = await pool.query(`
      SELECT g.id, g.name, recent.listen_count AS listens
      FROM (
        SELECT s.genre_id, COUNT(*) AS listen_count
        FROM listening_history lh
        JOIN songs s ON s.id = lh.song_id
        WHERE lh.${getListenTimeColumn()} >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND s.genre_id IS NOT NULL
        GROUP BY s.genre_id
      ) recent
      JOIN genres g ON g.id = recent.genre_id
      WHERE g.status = 'active'
      ORDER BY recent.listen_count DESC
      LIMIT 3
    `);

    const [missingData] = await pool.query(`
      SELECT COUNT(*) as count
      FROM genres g
      WHERE (g.cover_url IS NULL OR g.description IS NULL OR g.description = '')
        AND g.status = 'active'
        AND (
          g.use_in_cold_start = 1 OR g.use_in_recommendation = 1 OR g.use_in_ai_playlist = 1
          OR EXISTS (SELECT 1 FROM songs WHERE genre_id = g.id)
        )
    `);

    const [fewSongs] = await pool.query(`
      SELECT COUNT(*) as count
      FROM genres g
      LEFT JOIN (
        SELECT genre_id, COUNT(*) AS song_count
        FROM songs
        WHERE genre_id IS NOT NULL
        GROUP BY genre_id
      ) song_counts ON song_counts.genre_id = g.id
      WHERE g.status = 'active'
        AND (g.use_in_cold_start = 1 OR g.use_in_recommendation = 1)
        AND COALESCE(song_counts.song_count, 0) < 50
    `);

    const [needsOpt] = await pool.query(`
      SELECT COUNT(*) as count
      FROM genres g
      LEFT JOIN (
        SELECT genre_id, COUNT(*) AS song_count
        FROM songs
        WHERE genre_id IS NOT NULL
        GROUP BY genre_id
      ) song_counts ON song_counts.genre_id = g.id
      LEFT JOIN (
        SELECT s.genre_id, COUNT(*) AS listen_count
        FROM listening_history lh
        JOIN songs s ON s.id = lh.song_id
        WHERE lh.${getListenTimeColumn()} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND s.genre_id IS NOT NULL
        GROUP BY s.genre_id
      ) listen_counts ON listen_counts.genre_id = g.id
      WHERE (g.use_in_recommendation = 1 OR g.use_in_ai_playlist = 1)
        AND g.status = 'active'
        AND (COALESCE(listen_counts.listen_count, 0) < 50 OR COALESCE(song_counts.song_count, 0) < 10)
    `);

    const data = {
      trending,
      missing_data_count: Number(missingData[0].count || 0),
      few_songs_count: Number(fewSongs[0].count || 0),
      needs_optimization_count: Number(needsOpt[0].count || 0)
    };
    setCachedValue(cacheKey, data);

    res.json({
      success: true,
      data,
      meta: { cache: 'miss', refreshing: false }
    });
  } catch (err) {
    next(err);
  }
};

async function computeGenreInsightsData() {
  const [trending] = await pool.query(`
    SELECT g.id, g.name, recent.listen_count AS listens
    FROM (
      SELECT s.genre_id, COUNT(*) AS listen_count
      FROM listening_history lh
      JOIN songs s ON s.id = lh.song_id
      WHERE lh.${getListenTimeColumn()} >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND s.genre_id IS NOT NULL
      GROUP BY s.genre_id
    ) recent
    JOIN genres g ON g.id = recent.genre_id
    WHERE g.status = 'active'
    ORDER BY recent.listen_count DESC
    LIMIT 3
  `);

  const [missingData] = await pool.query(`
    SELECT COUNT(*) as count
    FROM genres g
    WHERE (g.cover_url IS NULL OR g.description IS NULL OR g.description = '')
      AND g.status = 'active'
      AND (
        g.use_in_cold_start = 1 OR g.use_in_recommendation = 1 OR g.use_in_ai_playlist = 1
        OR EXISTS (SELECT 1 FROM songs WHERE genre_id = g.id)
      )
  `);

  const [fewSongs] = await pool.query(`
    SELECT COUNT(*) as count
    FROM genres g
    LEFT JOIN (
      SELECT genre_id, COUNT(*) AS song_count
      FROM songs
      WHERE genre_id IS NOT NULL
      GROUP BY genre_id
    ) song_counts ON song_counts.genre_id = g.id
    WHERE g.status = 'active'
      AND (g.use_in_cold_start = 1 OR g.use_in_recommendation = 1)
      AND COALESCE(song_counts.song_count, 0) < 50
  `);

  const [needsOpt] = await pool.query(`
    SELECT COUNT(*) as count
    FROM genres g
    LEFT JOIN (
      SELECT genre_id, COUNT(*) AS song_count
      FROM songs
      WHERE genre_id IS NOT NULL
      GROUP BY genre_id
    ) song_counts ON song_counts.genre_id = g.id
    LEFT JOIN (
      SELECT s.genre_id, COUNT(*) AS listen_count
      FROM listening_history lh
      JOIN songs s ON s.id = lh.song_id
      WHERE lh.${getListenTimeColumn()} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND s.genre_id IS NOT NULL
      GROUP BY s.genre_id
    ) listen_counts ON listen_counts.genre_id = g.id
    WHERE (g.use_in_recommendation = 1 OR g.use_in_ai_playlist = 1)
      AND g.status = 'active'
      AND (COALESCE(listen_counts.listen_count, 0) < 50 OR COALESCE(song_counts.song_count, 0) < 10)
  `);

  return {
    trending,
    missing_data_count: Number(missingData[0].count || 0),
    few_songs_count: Number(fewSongs[0].count || 0),
    needs_optimization_count: Number(needsOpt[0].count || 0)
  };
}

function refreshGenreInsightsCache() {
  if (genreInsightsRefreshPromise) return genreInsightsRefreshPromise;
  genreInsightsRefreshPromise = computeGenreInsightsData()
    .then((data) => {
      setCachedValue('admin_genres_insights', data);
      return data;
    })
    .catch((err) => {
      console.warn('[AdminGenres] insights refresh failed:', err.message);
      return null;
    })
    .finally(() => {
      genreInsightsRefreshPromise = null;
    });
  return genreInsightsRefreshPromise;
}

exports.getGenresInsights = async (req, res, next) => {
  try {
    const cacheKey = 'admin_genres_insights';
    const cached = getCachedValue(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        meta: { cache: 'hit', refreshing: false }
      });
    }

    refreshGenreInsightsCache();
    return res.json({
      success: true,
      data: {
        trending: [],
        missing_data_count: 0,
        few_songs_count: 0,
        needs_optimization_count: 0
      },
      meta: { cache: 'miss', refreshing: true }
    });
  } catch (err) {
    next(err);
  }
};
