// src/controllers/auth.controller.js
const bcrypt            = require('bcryptjs');
const jwt               = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool }          = require('../config/database');
const { setCache, deleteCache } = require('../config/redis');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const { PERSONALIZED_SYSTEM_PLAYLISTS } = require('../services/systemPlaylist.service');

// ── Helper: tạo cặp token ────────────────────────
function generateTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

  return { accessToken, refreshToken };
}

// ── POST /api/auth/register ──────────────────────
exports.register = async (req, res, next) => {
  try {
    // 1. Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, display_name, genre_ids, artist_ids } = req.body;

    // 2. Kiểm tra email đã tồn tại chưa
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email đã được sử dụng' });
    }

    // 3. Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // 4. Insert user vào DB (dùng transaction)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)`,
        [email, password_hash, display_name]
      );
      const userId = result.insertId;

      // 5. Lưu sở thích thể loại ban đầu (Cold Start)
      if (genre_ids && genre_ids.length > 0) {
        const genreValues = genre_ids.map((gid) => [userId, gid, 1]);
        await conn.query(
          'INSERT IGNORE INTO user_genre_preferences (user_id, genre_id, weight) VALUES ?',
          [genreValues]
        );
      }

      // 5.1. Lưu sở thích nghệ sĩ ban đầu
      if (artist_ids && artist_ids.length > 0) {
        const artistValues = artist_ids.map((aid) => [userId, aid, 1]);
        await conn.query(
          'INSERT IGNORE INTO user_artist_preferences (user_id, artist_id, weight) VALUES ?',
          [artistValues]
        );
      }

      // 5.2. Khởi tạo danh sách phát hệ thống cá nhân hóa
      for (const pl of PERSONALIZED_SYSTEM_PLAYLISTS) {
        const coverUrl = resolvePlaylistCoverUrl(pl.system_key);
        await conn.query(
          `INSERT INTO playlists (user_id, name, description, cover_url, is_system, type, system_key)
           VALUES (?, ?, ?, ?, 1, 'system', ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             description = VALUES(description),
             cover_url = VALUES(cover_url),
             is_system = 1,
             type = 'system',
             updated_at = NOW()`,
          [userId, pl.name, pl.description, coverUrl, pl.system_key]
        );
      }

      await conn.commit();

      // 6. Lấy thông tin user vừa tạo
      const [users] = await conn.query(
        'SELECT id, email, display_name, role FROM users WHERE id = ?', [userId]
      );
      const user = users[0];
      user.selected_genres = genre_ids || [];
      user.selected_artists = artist_ids || [];

      // 7. Tạo token
      const { accessToken, refreshToken } = generateTokens(user);

      // 8. Lưu refresh token vào Redis (TTL 30 ngày)
      await setCache(`refresh:${userId}`, refreshToken, 30 * 24 * 3600);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký thành công',
        data: { user, accessToken, refreshToken },
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ─────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // 1. Tìm user
    const [rows] = await pool.query(
      `SELECT id, email, password_hash, display_name, role, status,
              premium_plan_id, premium_expires_at
       FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    const user = rows[0];

    // 2. Kiểm tra tài khoản bị khoá
    if (user.status === 'locked') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khoá' });
    }

    // 3. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    // 4. Tạo token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      premiumExpiresAt: user.premium_expires_at,
    };
    const accessToken  = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

    await setCache(`refresh:${user.id}`, refreshToken, 30 * 24 * 3600);

    // Xoá password_hash trước khi trả về
    delete user.password_hash;

    // Lấy sở thích
    const [genres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [user.id]);
    const [artists] = await pool.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [user.id]);
    user.selected_genres = genres.map(g => g.genre_id);
    user.selected_artists = artists.map(a => a.artist_id);

    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: { user, accessToken, refreshToken },
    });

  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/refresh ───────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Thiếu refresh token' });
    }

    // 1. Xác thực refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token không hợp lệ' });
    }

    // 2. Kiểm tra trong Redis
    const { getCache } = require('../config/redis');
    const stored = await getCache(`refresh:${payload.id}`);
    if (stored !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token đã bị thu hồi' });
    }

    // 3. Lấy thông tin user mới nhất
    const [rows] = await pool.query(
      'SELECT id, email, role, status, premium_expires_at FROM users WHERE id = ?',
      [payload.id]
    );
    if (!rows.length || rows[0].status === 'locked') {
      return res.status(401).json({ success: false, message: 'Tài khoản không hợp lệ' });
    }

    const user = rows[0];
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, premiumExpiresAt: user.premium_expires_at },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({ success: true, data: { accessToken: newAccessToken } });

  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await deleteCache(`refresh:${req.user.id}`);
    return res.json({ success: true, message: 'Đăng xuất thành công' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ─────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, display_name, avatar_url, role, status,
              premium_plan_id, premium_expires_at, total_listen_sec, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    const user = rows[0];

    const [genres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [user.id]);
    const [artists] = await pool.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [user.id]);
    user.selected_genres = genres.map(g => g.genre_id);
    user.selected_artists = artists.map(a => a.artist_id);

    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
