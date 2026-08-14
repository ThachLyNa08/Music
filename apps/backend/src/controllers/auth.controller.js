// src/controllers/auth.controller.js
const bcrypt            = require('bcryptjs');
const jwt               = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool }          = require('../config/database');
const { setCache, deleteCache } = require('../config/redis');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const { PERSONALIZED_SYSTEM_PLAYLISTS } = require('../services/systemPlaylist.service');
const artistInvitationService = require('../services/artistAccountInvitation.service');
const { sendSystemEmail } = require('../services/email.service');
const { welcomeEmail } = require('../services/systemEmailTemplates.service');
// Legacy invitation flow is currently unused by direct Artist Account mode.

const EMAIL_MAX_LENGTH = 255;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONBOARDING_MAX_SELECTIONS = 20;

let cachedUserColumns = null;
async function getUserColumns() {
  if (cachedUserColumns) return cachedUserColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM users');
  cachedUserColumns = new Set(rows.map(row => row.Field));
  return cachedUserColumns;
}

function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0)
  )];
}

function normalizeStrictIdList(values, field) {
  if (!Array.isArray(values)) {
    const err = new Error(`${field} must be an array`);
    err.statusCode = 400;
    throw err;
  }
  if (values.length > ONBOARDING_MAX_SELECTIONS) {
    const err = new Error(`${field} must not exceed ${ONBOARDING_MAX_SELECTIONS} items`);
    err.statusCode = 400;
    throw err;
  }
  const normalized = values.map((value) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 ? value : null;
    }
    const text = String(value ?? '').trim();
    if (!/^[1-9]\d*$/.test(text)) return null;
    return Number(text);
  });
  if (normalized.some((value) => !value)) {
    const err = new Error(`${field} contains invalid ID`);
    err.statusCode = 400;
    throw err;
  }
  return [...new Set(normalized)];
}

function normalizeEmailInput(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) {
    const err = new Error('Email is required');
    err.statusCode = 400;
    throw err;
  }
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
    const err = new Error('Email is invalid');
    err.statusCode = 400;
    throw err;
  }
  return email;
}

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

// ── GET /api/auth/check-email ────────────────────
exports.checkEmail = async (req, res, next) => {
  try {
    const email = normalizeEmailInput(req.query.email);
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    return res.json({ success: true, exists: existing.length > 0 });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/register ──────────────────────
exports.register = async (req, res, next) => {
  try {
    // 1. Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const display_name = String(req.body.display_name || '').trim();
    const genreIds = normalizeStrictIdList(req.body.genre_ids, 'genre_ids');
    const artistIds = normalizeStrictIdList(req.body.artist_ids, 'artist_ids');

    if (genreIds.length < 3) {
      return res.status(400).json({ success: false, message: 'Chọn ít nhất 3 thể loại yêu thích khác nhau' });
    }
    if (artistIds.length < 1) {
      return res.status(400).json({ success: false, message: 'Chọn ít nhất 1 nghệ sĩ yêu thích' });
    }

    const [[genreCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM genres WHERE id IN (?)', [genreIds]);
    if (Number(genreCountRow.count) !== genreIds.length) {
      return res.status(400).json({ success: false, message: 'Danh sách thể loại có mục không hợp lệ' });
    }

    const [[artistCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM artists WHERE id IN (?)', [artistIds]);
    if (Number(artistCountRow.count) !== artistIds.length) {
      return res.status(400).json({ success: false, message: 'Danh sách nghệ sĩ có mục không hợp lệ' });
    }

    // 2. Kiểm tra email đã tồn tại chưa
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email đã được sử dụng', code: 'EMAIL_EXISTS' });
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
      if (genreIds.length > 0) {
        const genreValues = genreIds.map((gid) => [userId, gid, 1]);
        await conn.query(
          'INSERT IGNORE INTO user_genre_preferences (user_id, genre_id, weight) VALUES ?',
          [genreValues]
        );
      }

      // 5.1. Lưu sở thích nghệ sĩ ban đầu
      if (artistIds.length > 0) {
        const artistValues = artistIds.map((aid) => [userId, aid, 1]);
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
      user.selected_genres = genreIds;
      user.selected_artists = artistIds;

      // 7. Tạo token
      const { accessToken, refreshToken } = generateTokens(user);

      // 8. Lưu refresh token vào Redis (TTL 30 ngày)
      await setCache(`refresh:${userId}`, refreshToken, 30 * 24 * 3600);

      if (user.email) {
        const email = welcomeEmail({ name: user.display_name || user.email });
        await sendSystemEmail({
          to: user.email,
          subject: email.subject,
          type: 'welcome',
          userId: user.id,
          metadata: { user_id: user.id, source: 'register' },
          text: email.text,
          html: email.html,
        });
      }

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
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng kiểm tra email để gửi khiếu nại nếu cần.',
      });
    }

    // 3. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    // 4. Tạo token
    if (user.role === 'artist') {
      return res.status(403).json({
        success: false,
        code: 'ARTIST_LOGIN_REQUIRED',
        redirectTo: '/artist/login',
      });
    }

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

exports.artistLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const userColumns = await getUserColumns();
    const mustChangeExpr = userColumns.has('must_change_password') ? 'u.must_change_password' : '0 AS must_change_password';
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.display_name, u.role, u.status, ${mustChangeExpr},
              a.id AS artist_id, a.name AS artist_name
       FROM users u
       LEFT JOIN artists a ON a.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Email hoac mat khau khong dung' });
    }

    const user = rows[0];
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Vui long dang nhap tai trang quan tri.', redirectTo: '/admin/login' });
    }
    if (user.role !== 'artist') {
      return res.status(403).json({ success: false, message: 'Day khong phai tai khoan nghe si.' });
    }
    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng kiểm tra email để gửi khiếu nại nếu cần.',
      });
    }
    if (!user.artist_id) {
      return res.status(403).json({ success: false, message: 'Tai khoan nghe si chua lien ket ho so nghe si.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoac mat khau khong dung' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      artistId: user.artist_id,
    };
    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });
    await setCache(`refresh:${user.id}`, refreshToken, 30 * 24 * 3600);

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      display_name: user.display_name,
      role: user.role,
      artistId: user.artist_id,
      artistName: user.artist_name,
      mustChangePassword: Number(user.must_change_password || 0) === 1,
      must_change_password: Number(user.must_change_password || 0) === 1,
    };
    const redirectTo = safeUser.mustChangePassword ? '/artist/change-password' : '/artist/dashboard';

    return res.json({
      success: true,
      message: 'Dang nhap Artist Studio thanh cong',
      user: safeUser,
      accessToken,
      refreshToken,
      redirectTo,
      data: { user: safeUser, accessToken, refreshToken, redirectTo },
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyArtistInvitation = async (req, res, next) => {
  try {
    const data = await artistInvitationService.verifyInvitation(req.query.token);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Khong the xac minh loi moi',
      code: err.code,
    });
  }
};

exports.activateArtistInvitation = async (req, res, next) => {
  try {
    const result = await artistInvitationService.activateInvitation(req.body);
    return res.json({
      success: true,
      message: 'Kich hoat tai khoan nghe si thanh cong',
      data: result,
      redirectTo: result.redirectTo,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Khong the kich hoat tai khoan nghe si',
      code: err.code,
    });
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
    const userColumns = await getUserColumns();
    const mustChangeExpr = userColumns.has('must_change_password') ? 'u.must_change_password' : '0 AS must_change_password';
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role, u.status, u.premium_expires_at, ${mustChangeExpr},
              a.id AS artist_id
       FROM users u
       LEFT JOIN artists a ON a.user_id = u.id
       WHERE u.id = ?`,
      [payload.id]
    );
    if (!rows.length || rows[0].status === 'locked') {
      await deleteCache(`refresh:${payload.id}`);
      return res.status(401).json({ success: false, message: 'Tài khoản không còn hợp lệ' });
    }

    const user = rows[0];
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        premiumExpiresAt: user.premium_expires_at,
        artistId: user.artist_id || undefined,
        mustChangePassword: Number(user.must_change_password || 0) === 1,
      },
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
    const userColumns = await getUserColumns();
    const mustChangeExpr = userColumns.has('must_change_password') ? 'must_change_password' : '0 AS must_change_password';
    const [rows] = await pool.query(
      `SELECT id, email, display_name, avatar_url, role, status, ${mustChangeExpr},
              premium_plan_id, premium_expires_at, total_listen_sec, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    const user = rows[0];

    if (user.role === 'artist') {
      const [artistRows] = await pool.query(
        'SELECT id, name FROM artists WHERE user_id = ? LIMIT 1',
        [user.id]
      );
      if (artistRows.length) {
        user.artistId = artistRows[0].id;
        user.artist_id = artistRows[0].id;
        user.artistName = artistRows[0].name;
        user.artist_name = artistRows[0].name;
      }
      user.mustChangePassword = Number(user.must_change_password || 0) === 1;
    }

    const [genres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [user.id]);
    const [artists] = await pool.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [user.id]);
    user.selected_genres = genres.map(g => g.genre_id);
    user.selected_artists = artists.map(a => a.artist_id);

    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.__test = {
  EMAIL_MAX_LENGTH,
  ONBOARDING_MAX_SELECTIONS,
  normalizeEmailInput,
  normalizeStrictIdList,
};
