// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

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

module.exports = { authenticate, optionalAuthenticate, requireAdmin, requirePremium };
