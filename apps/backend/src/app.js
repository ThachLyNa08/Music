// src/app.js
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');

const app = express();

// ── Middleware bảo mật & logging ─────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Parse body ───────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static files (audio uploads) ─────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ───────────────────────────────────────
app.use('/api/auth',     require('./routes/auth.routes'));
app.use('/api/users',    require('./routes/user.routes'));
app.use('/api/me',       require('./routes/user.routes')); // alias for /api/users/me/*
app.use('/api/songs',    require('./routes/song.routes'));
app.use('/api/artists',  require('./routes/artist.routes'));
app.use('/api/genres',   require('./routes/genre.routes'));
app.use('/api/albums',   require('./routes/album.routes'));
app.use('/api/playlists',require('./routes/playlist.routes'));
app.use('/api/recommend',require('./routes/recommendation.routes'));
app.use('/api/charts',   require('./routes/chart.routes'));
app.use('/api/stem',     require('./routes/stem.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/admin',    require('./routes/admin.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/spotify',  require('./routes/spotify.routes'));
app.use('/api/lyrics',   require('./routes/lyrics.routes'));

// ── Health check ─────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'musicflow-backend' }));

// ── 404 handler ──────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global error handler ─────────────────────────
app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

module.exports = app;
