// src/middleware/auth.middleware.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { ensureSystemEmailAppealSchema } = require('../services/systemEmailAppealSchema.service');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function getAppealStateForLockedUser(user) {
  const [appeals] = await pool.query(
    `SELECT id, status, created_at
     FROM account_lock_appeals
     WHERE user_id = ?
       AND (? IS NULL OR created_at >= ?)
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id, user.locked_at || null, user.locked_at || null]
  );
  if (appeals.length) {
    return {
      token: null,
      submitted: true,
      status: appeals[0].status,
      created_at: appeals[0].created_at,
    };
  }

  if (Number(user.lock_appeal_allowed) !== 1) {
    return { token: null, submitted: false, status: null, created_at: null };
  }

  const expiresAt = user.lock_appeal_token_expires_at
    ? new Date(user.lock_appeal_token_expires_at)
    : null;

  if (user.lock_appeal_token && expiresAt && expiresAt > new Date()) {
    return { token: user.lock_appeal_token, submitted: false, status: null, created_at: null };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `UPDATE users
     SET lock_appeal_token = ?,
         lock_appeal_token_hash = ?,
         lock_appeal_token_expires_at = ?
     WHERE id = ?`,
    [rawToken, hashToken(rawToken), tokenExpiresAt, user.id]
  );
  user.lock_appeal_token_expires_at = tokenExpiresAt;
  return { token: rawToken, submitted: false, status: null, created_at: null };
}

function invalidToken(res) {
  return res.status(401).json({
    success: false,
    message: 'Token không hợp lệ hoặc đã hết hạn',
  });
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Không có token xác thực',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    await ensureSystemEmailAppealSchema();

    const [rows] = await pool.query(
      `SELECT id, email, role, status, display_name, locked_at, locked_reason,
              lock_appeal_allowed, lock_appeal_token, lock_appeal_token_expires_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [payload.id]
    );

    if (!rows.length) return invalidToken(res);

    const dbUser = rows[0];
    req.user = {
      ...payload,
      id: dbUser.id,
      email: dbUser.email || payload.email,
      role: dbUser.role || payload.role,
      status: dbUser.status,
    };

    if (dbUser.status === 'locked') {
      const appealState = await getAppealStateForLockedUser(dbUser);
      return res.status(423).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng gửi khiếu nại nếu cần.',
        data: {
          user_id: dbUser.id,
          email: dbUser.email,
          display_name: dbUser.display_name,
          locked_at: dbUser.locked_at,
          locked_reason: dbUser.locked_reason,
          allow_appeal: Number(dbUser.lock_appeal_allowed) === 1,
          appeal_token: appealState.token,
          appeal_submitted: appealState.submitted,
          appeal_status: appealState.status,
          appeal_created_at: appealState.created_at,
          appeal_token_expires_at: dbUser.lock_appeal_token_expires_at,
        },
      });
    }

    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return invalidToken(res);
    }
    return next(err);
  }
}

function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Guest access is still allowed when the optional token is invalid.
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  }
  next();
}

function requirePremium(req, res, next) {
  const expires = req.user?.premiumExpiresAt;
  if (!expires || new Date(expires) < new Date()) {
    return res.status(403).json({
      success: false,
      message: 'Tính năng này yêu cầu tài khoản Premium',
    });
  }
  next();
}

async function requireArtist(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Không có token xác thực' });
  }
  if (req.user.role !== 'artist') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ tài khoản nghệ sĩ mới được truy cập Artist Studio',
    });
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
      return res.status(403).json({
        success: false,
        message: 'Tài khoản nghệ sĩ chưa liên kết hồ sơ hợp lệ',
      });
    }
    req.artist = rows[0];
    req.user.artistId = rows[0].id;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate, optionalAuthenticate, requireAdmin, requirePremium, requireArtist };
