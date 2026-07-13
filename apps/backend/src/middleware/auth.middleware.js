// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Xác thực JWT từ header Authorization: Bearer <token>
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Không có token xác thực' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Xác thực tùy chọn: Nếu có token thì lấy req.user, không có thì bỏ qua (guest)
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
    } catch (err) {
      // Bỏ qua lỗi token hết hạn/không hợp lệ để cho phép khách truy cập
    }
  }
  next();
}

// Chỉ cho phép admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  }
  next();
}

// Kiểm tra tài khoản Premium còn hiệu lực
function requirePremium(req, res, next) {
  const expires = req.user?.premiumExpiresAt;
  if (!expires || new Date(expires) < new Date()) {
    return res.status(403).json({ success: false, message: 'Tính năng này yêu cầu tài khoản Premium' });
  }
  next();
}

async function requireArtist(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Khong co token xac thuc' });
  }
  if (req.user.role !== 'artist') {
    return res.status(403).json({ success: false, message: 'Chi tai khoan nghe si moi duoc truy cap Artist Studio' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.name, a.avatar_url, a.bio, a.region, a.user_id
       FROM artists a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ? AND u.role = 'artist' AND u.status = 'active'
       LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(403).json({ success: false, message: 'Tai khoan nghe si chua lien ket ho so hop le' });
    }
    req.artist = rows[0];
    req.user.artistId = rows[0].id;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate, optionalAuthenticate, requireAdmin, requirePremium, requireArtist };
