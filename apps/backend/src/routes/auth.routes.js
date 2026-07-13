// src/routes/auth.routes.js
const express = require('express');
const { body }  = require('express-validator');
const rateLimit = require('express-rate-limit');
const router  = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Disable caching for auth routes to prevent 304 and stale user state
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Validation rules tái sử dụng
const registerRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
  body('display_name').trim().notEmpty().withMessage('Tên hiển thị không được để trống'),
  body('genre_ids').isArray({ min: 3 }).withMessage('Chọn ít nhất 3 thể loại yêu thích'),
  body('artist_ids').isArray({ min: 1 }).withMessage('Chọn ít nhất 1 nghệ sĩ yêu thích'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

const artistAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/register
router.post('/register', registerRules, authController.register);

// POST /api/auth/login
router.post('/login', loginRules, authController.login);

router.post('/artist/login', artistAuthLimiter, loginRules, authController.artistLogin);

// POST /api/auth/refresh  — cấp lại access token từ refresh token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/logout   — yêu cầu đăng nhập
router.post('/logout', authenticate, authController.logout);

// GET  /api/auth/me       — lấy thông tin user hiện tại
router.get('/me', authenticate, authController.getMe);

module.exports = router;
