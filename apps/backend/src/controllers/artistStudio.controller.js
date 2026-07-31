const { pool } = require('../config/database');
const { resolveArtistAvatar } = require('../utils/imageUrl.util');
const { getArtistStats } = require('../services/artistStats.service');
const notificationService = require('../services/notification.service');
const { evaluateSongSubmission, evaluateAlbumSubmission } = require('../services/artistContentModeration.service');
const { calculateFileSha256 } = require('../utils/fileHash.util');
const { findDuplicateAudioHash } = require('../services/audioDuplicate.service');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) return resolve(null);
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

let cachedUserColumns = null;
async function getUserColumns() {
  if (cachedUserColumns) return cachedUserColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM users');
  cachedUserColumns = new Set(rows.map(row => row.Field));
  return cachedUserColumns;
}

let schemaEnsured = false;
async function ensureModerationSchema() {
  if (schemaEnsured) return;
  try {
    const modCols = [
      { name: 'metadata_score', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'risk_score', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'moderation_level', def: "VARCHAR(20) NOT NULL DEFAULT 'normal'" },
      { name: 'moderation_flags', def: 'JSON NULL' },
      { name: 'resubmission_count', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'can_resubmit', def: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'resubmit_locked_reason', def: 'TEXT NULL' },
      { name: 'audio_hash', def: 'VARCHAR(64) NULL' },
      { name: 'audio_file_size', def: 'BIGINT NULL' },
      { name: 'audio_mime_type', def: 'VARCHAR(100) NULL' },
      { name: 'duplicate_reference_song_id', def: 'INT NULL' },
      { name: 'duplicate_reference_status', def: 'VARCHAR(30) NULL' },
      { name: 'duplicate_reference_artist_id', def: 'INT NULL' }
    ];

    for (const col of modCols) {
      try { await pool.query(`ALTER TABLE songs ADD COLUMN ${col.name} ${col.def}`); } catch (e) {}
      try { await pool.query(`ALTER TABLE albums ADD COLUMN ${col.name} ${col.def}`); } catch (e) {}
    }
    try { await pool.query('CREATE INDEX idx_songs_audio_hash ON songs(audio_hash)'); } catch (e) {}
    try { await pool.query('CREATE INDEX idx_songs_duplicate_reference_song_id ON songs(duplicate_reference_song_id)'); } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_content_review_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_type ENUM('song', 'album') NOT NULL,
        content_id INT NOT NULL,
        artist_id INT NULL,
        admin_id INT NULL,
        action ENUM('submitted', 'approved', 'rejected', 'resubmitted') NOT NULL,
        reason TEXT NULL,
        score_snapshot JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_content (content_type, content_id),
        INDEX idx_artist (artist_id),
        INDEX idx_action (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});

    schemaEnsured = true;
  } catch (err) {
    console.warn('Auto migration ensure failed:', err.message);
  }
}

let cachedSongColumns = null;
async function getSongColumns() {
  await ensureModerationSchema();
  if (cachedSongColumns) return cachedSongColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM songs');
  cachedSongColumns = new Set(rows.map(row => row.Field));
  return cachedSongColumns;
}

let cachedGenreColumns = null;
async function getGenreColumns() {
  if (cachedGenreColumns) return cachedGenreColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM genres');
  cachedGenreColumns = new Set(rows.map(row => row.Field));
  return cachedGenreColumns;
}

let cachedArtistColumns = null;
async function getArtistColumns() {
  if (cachedArtistColumns) return cachedArtistColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM artists');
  cachedArtistColumns = new Set(rows.map(row => row.Field));
  return cachedArtistColumns;
}

let cachedAlbumColumns = null;
async function getAlbumColumns() {
  await ensureModerationSchema();
  if (cachedAlbumColumns) return cachedAlbumColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM albums');
  cachedAlbumColumns = new Set(rows.map(row => row.Field));
  return cachedAlbumColumns;
}

const normalizeGenreToken = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

async function resolveArtistUploadGenre(artistId) {
  const artistColumns = await getArtistColumns();
  const directGenreColumns = ['genre_id', 'primary_genre_id', 'main_genre_id', 'sub_genre_id'];
  const selectParts = ['a.id', 'a.name'];

  directGenreColumns.forEach((column) => {
    if (artistColumns.has(column)) selectParts.push(`a.${column}`);
  });
  if (artistColumns.has('genres_json')) selectParts.push('a.genres_json');

  const [artistRows] = await pool.query(
    `SELECT ${selectParts.join(', ')}
     FROM artists a
     WHERE a.id = ?
     LIMIT 1`,
    [artistId]
  );

  if (!artistRows.length) return null;
  const artist = artistRows[0];

  for (const column of directGenreColumns) {
    if (artistColumns.has(column) && artist[column]) {
      const [genreRows] = await pool.query('SELECT id, name, slug FROM genres WHERE id = ? LIMIT 1', [artist[column]]);
      if (genreRows.length) {
        return { artist, genre: genreRows[0] };
      }
    }
  }

  if (artistColumns.has('genres_json') && artist.genres_json) {
    let parsed = [];
    try {
      parsed = typeof artist.genres_json === 'string' ? JSON.parse(artist.genres_json) : artist.genres_json;
    } catch (_error) {
      parsed = [];
    }

    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const candidateId = first && typeof first === 'object' ? (first.id || first.genre_id || first.genreId) : null;
    const candidateName = first && typeof first === 'object' ? (first.name || first.slug || first.code) : first;

    if (candidateId) {
      const [genreRows] = await pool.query('SELECT id, name, slug FROM genres WHERE id = ? LIMIT 1', [candidateId]);
      if (genreRows.length) {
        return { artist, genre: genreRows[0] };
      }
    }

    if (candidateName) {
      const token = normalizeGenreToken(candidateName);
      const [genreRows] = await pool.query(
        'SELECT id, name, slug FROM genres WHERE LOWER(name) = ? OR LOWER(slug) = ? LIMIT 1',
        [token, token]
      );
      if (genreRows.length) {
        return { artist, genre: genreRows[0] };
      }
    }
  }

  const [fallbackRows] = await pool.query(
    `SELECT g.id, g.name, g.slug
     FROM songs s
     JOIN genres g ON g.id = s.genre_id
     WHERE s.artist_id = ? AND s.genre_id IS NOT NULL
     GROUP BY g.id, g.name, g.slug
     ORDER BY COUNT(*) DESC
     LIMIT 1`,
    [artistId]
  );

  return {
    artist,
    genre: fallbackRows[0] || null
  };
}

const getMetadataStatus = ({ title, audioUrl, coverUrl, genreId }) => {
  const missing = [];
  if (!title || !String(title).trim()) missing.push('title');
  if (!audioUrl) missing.push('audio');
  if (!coverUrl) missing.push('cover');
  if (!genreId) missing.push('genre');

  if (missing.length === 0) return 'complete';
  if (missing.length === 1 && missing[0] === 'cover') return 'missing_cover';
  if (missing.length === 1 && missing[0] === 'genre') return 'missing_genre';
  return 'incomplete';
};

const isAllowedUpload = (file, allowedExts, allowedMimes) => {
  if (!file) return false;
  const ext = path.extname(file.originalname || '').toLowerCase();
  return allowedExts.includes(ext) && allowedMimes.includes(file.mimetype);
};

const cleanupUploadedFiles = (files = []) => {
  files.filter(Boolean).forEach((file) => {
    if (!file.path) return;
    fs.unlink(file.path, () => {});
  });
};

exports.getMe = async (req, res, next) => {
  try {
    const userColumns = await getUserColumns();
    const mustChangeExpr = userColumns.has('must_change_password') ? 'u.must_change_password' : '0 AS must_change_password';
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.email, u.display_name, u.role, u.status AS user_status,
              ${mustChangeExpr},
              u.created_at AS user_created_at,
              a.id AS artist_id, a.name AS artist_name, a.bio, a.avatar_url,
              a.short_bio, a.country, a.created_at AS artist_created_at
       FROM users u
       JOIN artists a ON a.user_id = u.id
       WHERE u.id = ? AND u.role = 'artist'
       LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay ho so nghe si' });
    }

    const row = rows[0];

    const stats = await getArtistStats(row.artist_id);

    return res.json({
      success: true,
      data: {
        user: {
          id: row.user_id,
          email: row.email,
          role: row.role,
          status: row.user_status,
          mustChangePassword: Number(row.must_change_password || 0) === 1
        },
        artist: {
          id: row.artist_id,
          name: row.artist_name,
          bio: row.bio || row.short_bio,
          avatarUrl: resolveArtistAvatar({ id: row.artist_id, name: row.artist_name, avatar_url: row.avatar_url }, req),
          coverUrl: null,
          market: row.country,
          mainGenre: null
        },
        stats: {
          totalSongs: Number(stats.totalSongs || 0),
          totalAlbums: Number(stats.totalAlbums || 0),
          totalPlays: Number(stats.totalPlays || 0),
          totalLikes: Number(stats.totalLikes || 0),
          totalFollowers: Number(stats.totalFollowers || 0)
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const artistColumns = await getArtistColumns();
    const hasGenre = artistColumns.has('primary_genre_id');
    const genreJoin = hasGenre ? 'LEFT JOIN genres g ON g.id = a.primary_genre_id' : '';
    const genreSelect = hasGenre ? 'g.name AS genre_name' : 'NULL AS genre_name';

    const [rows] = await pool.query(
      `SELECT
         a.id AS artist_id,
         a.name AS artist_name,
         a.avatar_url,
         u.email,
         u.status AS user_status,
         ${genreSelect}
       FROM users u
       JOIN artists a ON a.user_id = u.id
       ${genreJoin}
       WHERE u.id = ? AND u.role = 'artist'
       LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay ho so nghe si' });
    }
    const artistRow = rows[0];
    const artistId = artistRow.artist_id;

    // Summary stats
    const stats = await getArtistStats(artistId);

    // Top Songs
    const [topSongs] = await pool.query(`
      SELECT s.id, s.title, s.play_count, s.cover_url, al.title AS album_title
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ? AND s.review_status = 'approved'
      ORDER BY s.play_count DESC
      LIMIT 5
    `, [artistId]);

    // Recent Content (Union songs and albums)
    const [recentContent] = await pool.query(`
      (SELECT id, title, 'song' AS type, review_status, created_at, rejection_reason, cover_url
       FROM songs
       WHERE artist_id = ?)
      UNION ALL
      (SELECT id, title, 'album' AS type, review_status, created_at, rejection_reason, cover_url
       FROM albums
       WHERE submitted_by_artist_id = ?)
      ORDER BY created_at DESC
      LIMIT 5
    `, [artistId, artistId]);

    // Listen Trend
    const range = req.query.range || '7d';
    let bucketCount = 7;
    let currentWhere = `lh.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;

    if (range === 'today') {
      bucketCount = 24;
      currentWhere = `lh.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`;
    } else if (range === '30d') {
      bucketCount = 30;
      currentWhere = `lh.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
    } else if (range === '90d') {
      bucketCount = 90;
      currentWhere = `lh.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
    }

    const bucketSelect = range === 'today'
      ? `DATE_FORMAT(CONVERT_TZ(lh.created_at, '+00:00', '+07:00'), '%H:00')`
      : `DATE_FORMAT(CONVERT_TZ(lh.created_at, '+00:00', '+07:00'), '%Y-%m-%d')`;

    let listenTrend = [];
    try {
      const [trendRows] = await pool.query(`
        SELECT
          ${bucketSelect} AS bucket_key,
          SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS listens
        FROM listening_history lh
        JOIN songs s ON lh.song_id = s.id
        WHERE s.artist_id = ? AND ${currentWhere}
        GROUP BY bucket_key
      `, [artistId]);

      const pad = value => String(value).padStart(2, '0');
      const formatLocalDateKey = date => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
      };
      const formatLocalDateLabel = date => {
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1);
        return `${day}/${month}`;
      };

      const buckets = range === 'today'
        ? Array.from({ length: 24 }, (_, hour) => ({
          key: `${pad(hour)}:00`,
          label: `${pad(hour)}:00`
        }))
        : Array.from({ length: bucketCount }, (_, index) => {
          const date = new Date();
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() - (bucketCount - 1 - index));
          return {
            key: formatLocalDateKey(date),
            label: formatLocalDateLabel(date)
          };
        });

      listenTrend = buckets.map(bucket => {
        const row = trendRows.find(item => item.bucket_key === bucket.key);
        return {
          label: bucket.label,
          listens: Number(row?.listens || 0)
        };
      });
    } catch (err) {
      console.error('Error fetching listenTrend:', err);
    }

    // Heatmap Data (Last 90 days)
    let heatmapData = [];
    try {
      const [heatmapRows] = await pool.query(`
        SELECT
          DAYOFWEEK(CONVERT_TZ(lh.created_at, '+00:00', '+07:00')) as day_of_week,
          HOUR(CONVERT_TZ(lh.created_at, '+00:00', '+07:00')) as hour_of_day,
          COUNT(*) as listens
        FROM listening_history lh
        JOIN songs s ON lh.song_id = s.id
        WHERE s.artist_id = ? AND lh.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY day_of_week, hour_of_day
      `, [artistId]);

      heatmapData = heatmapRows.map(row => ({
        dayOfWeek: row.day_of_week, // 1 = Sunday, 2 = Monday, ..., 7 = Saturday
        hourOfDay: row.hour_of_day,
        listens: row.listens
      }));
    } catch (err) {
      console.error('Error fetching heatmapData:', err);
    }

    return res.json({
      success: true,
      data: {
        artist: {
          id: artistRow.artist_id,
          name: artistRow.artist_name,
          email: artistRow.email,
          avatarUrl: resolveArtistAvatar({ id: artistRow.artist_id, name: artistRow.artist_name, avatar_url: artistRow.avatar_url }, req),
          genreName: artistRow.genre_name,
          status: artistRow.user_status
        },
        summary: {
          totalPlays: stats.totalPlays,
          totalSongs: stats.totalSongs,
          totalAlbums: stats.totalAlbums,
          pendingSongs: stats.pendingSongs,
          pendingAlbums: stats.pendingAlbums,
          totalLikes: stats.totalLikes,
          newLikesThisWeek: stats.newLikesThisWeek || 0,
          totalFollowers: stats.totalFollowers || 0
        },
        topSongs: topSongs.map(s => ({
          id: s.id,
          title: s.title,
          album: s.album_title,
          playCount: Number(s.play_count || 0),
          coverUrl: resolveArtistAvatar({ avatar_url: s.cover_url }, req)
        })),
        recentContent: recentContent.map(c => ({
          id: c.id,
          type: c.type,
          title: c.title,
          reviewStatus: c.review_status,
          createdAt: c.created_at,
          rejectionReason: c.rejection_reason,
          coverUrl: resolveArtistAvatar({ avatar_url: c.cover_url }, req)
        })),
        listenTrend: listenTrend || [],
        heatmapData: heatmapData || []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    const userColumns = await getUserColumns();
    if (!userColumns.has('must_change_password')) {
      return res.status(500).json({
        success: false,
        message: 'Chua chay migration artist_direct_accounts: thieu users.must_change_password',
        code: 'artist_account_schema_missing',
      });
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Vui long nhap day du thong tin mat khau' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Mat khau moi toi thieu 6 ky tu' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mat khau xac nhan khong khop' });
    }

    const [rows] = await pool.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = ? AND role = 'artist' AND status = 'active'
       LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(403).json({ success: false, message: 'Tai khoan nghe si khong hop le' });
    }

    const user = rows[0];
    const currentOk = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentOk) {
      return res.status(400).json({ success: false, message: 'Mat khau hien tai khong dung' });
    }
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ success: false, message: 'Mat khau moi khong duoc trung mat khau hien tai' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [passwordHash, req.user.id]
    );

    return res.json({
      success: true,
      message: 'Doi mat khau thanh cong.',
      redirectTo: '/artist/dashboard',
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const userColumns = await getUserColumns();
    const mustChangeExpr = userColumns.has('must_change_password') ? 'u.must_change_password' : '0 AS must_change_password';
    const [rows] = await pool.query(
      `SELECT u.email, u.status AS user_status,
              ${mustChangeExpr},
              a.id AS artist_id, a.name AS artist_name, a.bio, a.avatar_url,
              a.short_bio, a.country, a.region
       FROM users u
       JOIN artists a ON a.user_id = u.id
       WHERE u.id = ? AND u.role = 'artist'
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay ho so nghe si' });
    }

    const row = rows[0];

    return res.json({
      success: true,
      profile: {
        id: row.artist_id,
        name: row.artist_name,
        bio: row.bio || row.short_bio,
        avatarUrl: resolveArtistAvatar({ id: row.artist_id, name: row.artist_name, avatar_url: row.avatar_url }, req),
        coverUrl: null, // Chua co cover_url trong DB
        market: row.region || row.country,
        generation: null, // Chua co trong DB
        contactEmail: null,
        managementCompany: null,
        representativeName: null,
        contactNote: null
      },
      account: {
        email: row.email,
        status: row.user_status,
        mustChangePassword: Number(row.must_change_password || 0) === 1
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { bio } = req.body;

    // Check ownership
    const [rows] = await pool.query(
      `SELECT a.id FROM artists a WHERE a.user_id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay ho so nghe si' });
    }

    // Chi cho phep update bio
    await pool.query(
      `UPDATE artists SET bio = ? WHERE user_id = ?`,
      [bio ? bio.substring(0, 2000) : null, req.user.id]
    );

    // Get updated profile
    return exports.getProfile(req, res, next);
  } catch (error) {
    next(error);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui long chon file anh' });
    }

    const avatarPath = `/uploads/images/${req.file.filename}`;

    // Update DB
    const [result] = await pool.query(
      `UPDATE artists SET avatar_url = ? WHERE user_id = ?`,
      [avatarPath, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Khong tim thay ho so nghe si' });
    }

    return res.json({
      success: true,
      message: 'Da cap nhat anh dai dien.',
      avatarUrl: `${req.protocol}://${req.get('host')}${avatarPath}`
    });
  } catch (error) {
    next(error);
  }
};

exports.getUploadOptions = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const artistGenre = await resolveArtistUploadGenre(artistId);

    const [albums] = await pool.query(
      `SELECT id, title, cover_url, release_status, review_status
       FROM albums
       WHERE artist_id = ? AND review_status = 'approved'
       ORDER BY created_at DESC, title ASC`,
      [artistId]
    );

    return res.json({
      success: true,
      artist: artistGenre ? {
        id: artistGenre.artist.id,
        name: artistGenre.artist.name,
        genreId: artistGenre.genre?.id || null,
        genreName: artistGenre.genre?.name || null
      } : null,
      albums: albums.map(a => ({
        id: a.id,
        title: a.title,
        coverUrl: a.cover_url,
        releaseStatus: a.release_status
      }))
    });
  } catch (error) {
    next(error);
  }
};

exports.getSongs = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const { q, status, page = 1, limit = 20, sort = 'newest' } = req.query;
    const songColumns = await getSongColumns();
    const submissionNoteSelect = songColumns.has('submission_note') ? 's.submission_note,' : 'NULL AS submission_note,';

    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    let whereClause = 'WHERE s.artist_id = ?';
    const queryParams = [artistId];
    const countParams = [artistId];

    if (q) {
      whereClause += ' AND s.title LIKE ?';
      const searchStr = `%${q}%`;
      queryParams.push(searchStr);
      countParams.push(searchStr);
    }

    if (status) {
      whereClause += ' AND s.review_status = ?';
      queryParams.push(status);
      countParams.push(status);
    }

    let orderBy = 's.created_at DESC';
    if (sort === 'most_played') orderBy = 's.play_count DESC';
    else if (sort === 'most_liked') orderBy = 'like_count DESC';
    else if (sort === 'title_asc') orderBy = 's.title ASC';
    else if (sort === 'title_desc') orderBy = 's.title DESC';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM songs s ${whereClause}`,
      countParams
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec as duration,
        s.play_count, s.created_at,
        s.review_status, s.rejection_reason, s.resubmission_count, s.can_resubmit, s.resubmit_locked_reason, s.submitted_at, s.reviewed_at,
        ${submissionNoteSelect}
        s.lyrics,
        al.id as album_id, al.title as album_title,
        g.id as genre_id, g.name as genre_name, g.slug as genre_code,
        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS like_count
       FROM songs s
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    const songs = rows.map(r => {
      const hasAudio = !!r.audio_url;
      const hasCover = !!r.cover_url;
      const metadataStatus = getMetadataStatus({
        title: r.title,
        audioUrl: r.audio_url,
        coverUrl: r.cover_url,
        genreId: r.genre_id
      });

      return {
        id: r.id,
        title: r.title,
        coverUrl: r.cover_url,
        audioUrl: r.audio_url,
        duration: r.duration,
        album: r.album_id ? { id: r.album_id, title: r.album_title } : null,
        genre: r.genre_id ? { id: r.genre_id, name: r.genre_name, code: r.genre_code } : null,
        playCount: r.play_count,
        likeCount: r.like_count,
        hasAudio,
        hasCover,
        lyricsStatus: r.lyrics ? 'available' : 'missing',
        metadataStatus,
        submissionNote: r.submission_note || null,
        createdAt: r.created_at,
        reviewStatus: r.review_status,
        rejectionReason: r.rejection_reason,
        resubmissionCount: r.resubmission_count || 0,
        canResubmit: r.can_resubmit !== 0,
        resubmitLockedReason: r.resubmit_locked_reason,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at
      };
    });

    let completeMetadata = 0, missingAudio = 0, missingCover = 0, totalPlays = 0;
    let approvedCount = 0, pendingCount = 0, rejectedCount = 0;

    // Always fetch global stats for the artist's songs regardless of search/filter
    const [statsRows] = await pool.query(
      `SELECT
        SUM(play_count) as total_plays,
        SUM(CASE WHEN title IS NOT NULL AND title <> '' AND audio_url IS NOT NULL AND cover_url IS NOT NULL AND genre_id IS NOT NULL THEN 1 ELSE 0 END) as complete_meta,
        SUM(CASE WHEN audio_url IS NULL THEN 1 ELSE 0 END) as missing_audio,
        SUM(CASE WHEN audio_url IS NOT NULL AND cover_url IS NULL THEN 1 ELSE 0 END) as missing_cover,
        SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN review_status = 'pending_review' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        COUNT(*) as absolute_total
       FROM songs WHERE artist_id = ?`,
      [artistId]
    );

    if (statsRows.length && statsRows[0].absolute_total > 0) {
      totalPlays = Number(statsRows[0].total_plays || 0);
      completeMetadata = Number(statsRows[0].complete_meta || 0);
      missingAudio = Number(statsRows[0].missing_audio || 0);
      missingCover = Number(statsRows[0].missing_cover || 0);
      approvedCount = Number(statsRows[0].approved_count || 0);
      pendingCount = Number(statsRows[0].pending_count || 0);
      rejectedCount = Number(statsRows[0].rejected_count || 0);
    }

    res.json({
      success: true,
      songs,
      summary: {
        totalSongs: Number(statsRows[0]?.absolute_total || 0),
        completeMetadata,
        missingAudio,
        missingCover,
        totalPlays,
        approvedCount,
        pendingCount,
        rejectedCount
      },
      pagination: {
        page: Number(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getSongDetail = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const songId = req.params.id;
    const songColumns = await getSongColumns();
    const submissionNoteSelect = songColumns.has('submission_note') ? 's.submission_note,' : 'NULL AS submission_note,';

    const [rows] = await pool.query(
      `SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec as duration, s.lyrics,
        s.play_count, s.created_at,
        s.review_status, s.rejection_reason, s.resubmission_count, s.can_resubmit, s.resubmit_locked_reason, s.submitted_at, s.reviewed_at,
        ${submissionNoteSelect}
        al.id as album_id, al.title as album_title,
        g.id as genre_id, g.name as genre_name, g.slug as genre_code,
        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS like_count
       FROM songs s
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       WHERE s.id = ? AND s.artist_id = ?
       LIMIT 1`,
      [songId, artistId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay bai hat hoac bai hat khong thuoc quyen so huu cua ban' });
    }

    const r = rows[0];
    const hasAudio = !!r.audio_url;
    const hasCover = !!r.cover_url;
    const metadataStatus = getMetadataStatus({
      title: r.title,
      audioUrl: r.audio_url,
      coverUrl: r.cover_url,
      genreId: r.genre_id
    });

    res.json({
      success: true,
      song: {
        id: r.id,
        title: r.title,
        coverUrl: r.cover_url,
        audioUrl: r.audio_url,
        duration: r.duration,
        album: r.album_id ? { id: r.album_id, title: r.album_title } : null,
        genre: r.genre_id ? { id: r.genre_id, name: r.genre_name, code: r.genre_code } : null,
        playCount: r.play_count,
        likeCount: r.like_count,
        lyrics: r.lyrics || null,
        lyricsStatus: r.lyrics ? 'available' : 'missing',
        metadataStatus,
        submissionNote: r.submission_note || null,
        createdAt: r.created_at,
        reviewStatus: r.review_status,
        rejectionReason: r.rejection_reason,
        resubmissionCount: r.resubmission_count || 0,
        canResubmit: r.can_resubmit !== 0,
        resubmitLockedReason: r.resubmit_locked_reason,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadSong = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const userId = req.user.id;
    const { title, albumId, lyrics, submissionNote, reviewNote } = req.body;
    const uploadedFiles = [
      ...(req.files?.audio || []),
      ...(req.files?.cover || [])
    ];

    if (!title || !title.trim()) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Ten bai hat la bat buoc.' });
    }

    let audioUrl = null;
    let coverUrl = null;

    if (req.files) {
      if (req.files.audio && req.files.audio.length > 0) {
        if (!isAllowedUpload(req.files.audio[0], ['.mp3', '.wav', '.m4a'], ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'])) {
          cleanupUploadedFiles(uploadedFiles);
          return res.status(400).json({ success: false, message: 'File audio chi ho tro mp3, wav, m4a.' });
        }
        audioUrl = '/uploads/audio/' + req.files.audio[0].filename;
      }
      if (req.files.cover && req.files.cover.length > 0) {
        if (!isAllowedUpload(req.files.cover[0], ['.jpg', '.jpeg', '.png', '.webp'], ['image/jpeg', 'image/png', 'image/webp'])) {
          cleanupUploadedFiles(uploadedFiles);
          return res.status(400).json({ success: false, message: 'Anh bia chi ho tro jpg, jpeg, png, webp.' });
        }
        coverUrl = '/uploads/images/' + req.files.cover[0].filename;
      }
    }

    if (!audioUrl) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'File am thanh la bat buoc.' });
    }

    let audioHash = null;
    let audioFileSize = null;
    let audioMimeType = null;

    if (req.files && req.files.audio && req.files.audio[0]) {
      const audioFile = req.files.audio[0];
      audioFileSize = audioFile.size || null;
      audioMimeType = audioFile.mimetype || null;

      try {
        audioHash = await calculateFileSha256(audioFile.path);
      } catch (err) {
        console.error('Error calculating file SHA-256 hash:', err);
      }
    }

    let dupSong = null;
    if (audioHash) {
      dupSong = await findDuplicateAudioHash(audioHash);
      if (dupSong) {
        cleanupUploadedFiles(uploadedFiles);
        if (dupSong.review_status === 'approved') {
          return res.status(409).json({
            success: false,
            code: 'DUPLICATE_AUDIO_APPROVED',
            message: 'File audio này đã tồn tại trong hệ thống ở một bài hát đã được duyệt.'
          });
        }
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_AUDIO_PENDING',
          message: 'File audio này đang trùng với một bài hát khác đang chờ duyệt. Vui lòng kiểm tra lại trước khi gửi.'
        });
      }
    }

    const artistGenre = await resolveArtistUploadGenre(artistId);
    const genre = artistGenre?.genre?.id || null;
    if (!genre) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Nghệ sĩ chưa được gán thể loại, không thể gửi bài hát.' });
    }

    const album = albumId ? parseInt(albumId, 10) : null;
    if (albumId && !album) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Album khong hop le.' });
    }
    if (album) {
      const [albumRows] = await pool.query(
        'SELECT id FROM albums WHERE id = ? AND artist_id = ? LIMIT 1',
        [album, artistId]
      );
      if (!albumRows.length) {
        cleanupUploadedFiles(uploadedFiles);
        return res.status(400).json({ success: false, message: 'Album khong thuoc nghe si hien tai.' });
      }
    }

    const [approvedSongRows] = await pool.query(
      "SELECT COUNT(*) as count FROM songs WHERE artist_id = ? AND review_status = 'approved'",
      [artistId]
    );
    const approvedSongCount = approvedSongRows[0]?.count || 0;

    const [dupRows] = await pool.query(
      "SELECT COUNT(*) as count FROM songs WHERE artist_id = ? AND LOWER(title) = LOWER(?)",
      [artistId, title.trim()]
    );
    const duplicateTitleCount = dupRows[0]?.count || 0;

    const songColumns = await getSongColumns();
    const songEvalResult = evaluateSongSubmission({
      title: title.trim(),
      coverUrl,
      audioUrl,
      lyrics,
      genreId: genre,
      submissionNote: submissionNote || reviewNote,
      duration: null,
      resubmissionCount: 0,
    }, {
      approvedSongCount,
      duplicateTitleCount,
    });

    const fields = [
      'title',
      'artist_id',
      'genre_id',
      'album_id',
      'audio_url',
      'cover_url',
      'lyrics',
      'review_status',
      'submitted_by_artist_id',
      'submitted_by_user_id',
      'submitted_at',
      'rejection_reason',
      'play_count'
    ];
    const placeholders = ['?', '?', '?', '?', '?', '?', '?', "'pending_review'", '?', '?', 'NOW()', 'NULL', '0'];
    const values = [
      title.trim(), artistId, genre, album || null, audioUrl, coverUrl, lyrics || null, artistId, userId
    ];

    if (songColumns.has('metadata_score')) {
      fields.push('metadata_score', 'risk_score', 'moderation_level', 'moderation_flags');
      placeholders.push('?', '?', '?', '?');
      values.push(
        songEvalResult.metadataScore,
        songEvalResult.riskScore,
        songEvalResult.moderationLevel,
        JSON.stringify(songEvalResult.moderationFlags)
      );
    }

    if (songColumns.has('audio_hash') && audioHash) {
      fields.push('audio_hash');
      placeholders.push('?');
      values.push(audioHash);
    }
    if (songColumns.has('audio_file_size') && audioFileSize) {
      fields.push('audio_file_size');
      placeholders.push('?');
      values.push(audioFileSize);
    }
    if (songColumns.has('audio_mime_type') && audioMimeType) {
      fields.push('audio_mime_type');
      placeholders.push('?');
      values.push(audioMimeType);
    }

    if (songColumns.has('submission_note')) {
      const reviewIndex = fields.indexOf('review_status');
      fields.splice(reviewIndex, 0, 'submission_note');
      placeholders.splice(reviewIndex, 0, '?');
      values.splice(7, 0, submissionNote || reviewNote || null);
    }

    const [result] = await pool.query(
      `INSERT INTO songs (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );
    const newSongId = result.insertId;

    pool.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, action, score_snapshot)
       VALUES ('song', ?, ?, 'submitted', ?)`,
      [newSongId, artistId, JSON.stringify(songEvalResult)]
    ).catch(err => console.warn('Failed to log song submission:', err));

    res.json({
      success: true,
      message: 'Bài hát đã được gửi Admin duyệt.',
      songId: result.insertId
    });

    // Notify admins and artist
    try {
      await notificationService.notifyAdminsNewArtistSubmission({
        contentType: 'song', contentId: newSongId, title: title.trim(), artistId, artistName: req.artist?.name || 'Nghệ sĩ'
      });
      await notificationService.notifyArtistSubmissionReceived({
        userId, contentType: 'song', contentId: newSongId, title: title.trim()
      });
    } catch (err) {
      console.warn('Notification service error:', err);
    }
  } catch (error) {
    next(error);
  }
};

// GET /api/artist/albums
exports.getAlbums = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const albumColumns = await getAlbumColumns();
    const songColumns = await getSongColumns();
    const approvedSongCountSql = songColumns.has('review_status')
      ? "(SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id AND s.review_status = 'approved') as approvedSongCount"
      : "(SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) as approvedSongCount";
    const orderColumn = albumColumns.has('created_at') ? 'al.created_at' : 'al.id';

    const selectParts = [
      'al.id',
      'al.title as name',
      albumColumns.has('cover_url') ? `COALESCE(NULLIF(al.cover_url, ''), (SELECT s.cover_url FROM songs s WHERE s.album_id = al.id AND s.cover_url IS NOT NULL AND s.cover_url != '' ORDER BY s.id ASC LIMIT 1)) as coverUrl` : 'NULL as coverUrl',
      albumColumns.has('description') ? 'al.description' : 'NULL as description',
      albumColumns.has('release_date') ? 'al.release_date as releaseDate' : 'NULL as releaseDate',
      albumColumns.has('review_status') ? 'al.review_status as reviewStatus' : "'approved' as reviewStatus",
      albumColumns.has('submitted_at') ? 'al.submitted_at as submittedAt' : 'NULL as submittedAt',
      albumColumns.has('reviewed_at') ? 'al.reviewed_at as reviewedAt' : 'NULL as reviewedAt',
      albumColumns.has('rejection_reason') ? 'al.rejection_reason as rejectionReason' : 'NULL as rejectionReason',
      albumColumns.has('resubmission_count') ? 'al.resubmission_count as resubmissionCount' : '0 as resubmissionCount',
      albumColumns.has('can_resubmit') ? 'al.can_resubmit as canResubmit' : '1 as canResubmit',
      albumColumns.has('resubmit_locked_reason') ? 'al.resubmit_locked_reason as resubmitLockedReason' : 'NULL as resubmitLockedReason',
      albumColumns.has('submission_note') ? 'al.submission_note as submissionNote' : 'NULL as submissionNote',
      albumColumns.has('published_at') ? 'al.published_at as publishedAt' : 'NULL as publishedAt',
      '(SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) as songCount',
      approvedSongCountSql
    ];

    const query = `
      SELECT ${selectParts.join(', ')}
      FROM albums al
      WHERE al.artist_id = ?
      ORDER BY ${orderColumn} DESC
    `;
    const [albums] = await pool.query(query, [artistId]);

    res.json({ success: true, albums });
  } catch (error) {
    next(error);
  }
};

// GET /api/artist/albums/:id
exports.getAlbumDetail = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const albumId = req.params.id;
    const albumColumns = await getAlbumColumns();
    const songColumns = await getSongColumns();
    const albumSelectParts = [
      'al.id',
      'al.title as name',
      albumColumns.has('cover_url') ? `COALESCE(NULLIF(al.cover_url, ''), (SELECT s.cover_url FROM songs s WHERE s.album_id = al.id AND s.cover_url IS NOT NULL AND s.cover_url != '' ORDER BY s.id ASC LIMIT 1)) as coverUrl` : 'NULL as coverUrl',
      albumColumns.has('description') ? 'al.description' : 'NULL as description',
      albumColumns.has('release_date') ? 'al.release_date as releaseDate' : 'NULL as releaseDate',
      albumColumns.has('review_status') ? 'al.review_status as reviewStatus' : "'approved' as reviewStatus",
      albumColumns.has('submitted_at') ? 'al.submitted_at as submittedAt' : 'NULL as submittedAt',
      albumColumns.has('reviewed_at') ? 'al.reviewed_at as reviewedAt' : 'NULL as reviewedAt',
      albumColumns.has('rejection_reason') ? 'al.rejection_reason as rejectionReason' : 'NULL as rejectionReason',
      albumColumns.has('resubmission_count') ? 'al.resubmission_count as resubmissionCount' : '0 as resubmissionCount',
      albumColumns.has('can_resubmit') ? 'al.can_resubmit as canResubmit' : '1 as canResubmit',
      albumColumns.has('resubmit_locked_reason') ? 'al.resubmit_locked_reason as resubmitLockedReason' : 'NULL as resubmitLockedReason',
      albumColumns.has('submission_note') ? 'al.submission_note as submissionNote' : 'NULL as submissionNote',
      albumColumns.has('published_at') ? 'al.published_at as publishedAt' : 'NULL as publishedAt',
    ];

    const [albums] = await pool.query(`
      SELECT ${albumSelectParts.join(', ')}
      FROM albums al
      WHERE al.id = ? AND al.artist_id = ?
    `, [albumId, artistId]);

    if (albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    const album = albums[0];
    const durationSelect = songColumns.has('duration_sec')
      ? 'duration_sec as duration'
      : (songColumns.has('duration') ? 'duration' : '0 as duration');
    const songSelectParts = [
      'id',
      'title',
      durationSelect,
      songColumns.has('play_count') ? 'play_count' : '0 as play_count',
      songColumns.has('cover_url') ? 'cover_url' : 'NULL as cover_url',
      songColumns.has('review_status') ? 'review_status' : "'approved' as review_status",
    ];
    const orderParts = [];
    if (songColumns.has('track_number')) orderParts.push('track_number ASC');
    if (songColumns.has('created_at')) orderParts.push('created_at ASC');
    orderParts.push('id ASC');

    const [songs] = await pool.query(`
      SELECT ${songSelectParts.join(', ')}
      FROM songs
      WHERE album_id = ? AND artist_id = ?
      ORDER BY ${orderParts.join(', ')}
    `, [albumId, artistId]);

    album.songs = songs;

    res.json({ success: true, album });
  } catch (error) {
    next(error);
  }
};

exports.getAlbumSongOptions = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const rawAlbumId = req.query.albumId || req.query.currentAlbumId;
    const albumId = (rawAlbumId && rawAlbumId !== 'null' && rawAlbumId !== 'undefined') ? parseInt(rawAlbumId, 10) : null;
    const songColumns = await getSongColumns();
    const orderClause = songColumns.has('created_at') ? 'ORDER BY created_at DESC' : 'ORDER BY id DESC';
    const selectParts = ['id', 'title', 'cover_url AS coverUrl', 'duration_sec AS duration', 'play_count AS playCount'];
    if (songColumns.has('submitted_at')) {
      selectParts.push('submitted_at AS approvedAt');
    }
    const queryStr = `
      SELECT ${selectParts.join(', ')}
      FROM songs
      WHERE artist_id = ? AND review_status = 'approved' AND (album_id IS NULL${(albumId && !isNaN(albumId)) ? ' OR album_id = ?' : ''})
      ${orderClause}
    `;
    const queryParams = (albumId && !isNaN(albumId)) ? [artistId, albumId] : [artistId];
    const [songs] = await pool.query(queryStr, queryParams);
    res.json({ success: true, songs });
  } catch (error) {
    next(error);
  }
};

// POST /api/artist/albums
exports.createAlbum = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const artistId = req.artist.id;
    const { title, description, releaseDate, submissionNote } = req.body;
    let songIds = [];
    if (req.body.songIds) {
      try {
        songIds = JSON.parse(req.body.songIds);
      } catch (e) {
        throw new Error('Định dạng songIds không hợp lệ');
      }
    }

    if (!title) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (title)' });
    }

    if (!Array.isArray(songIds) || songIds.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Phải chọn ít nhất 1 bài hát cho album' });
    }

    // Validate songIds integers and remove duplicates
    songIds = [...new Set(songIds)].map(id => parseInt(id, 10));
    if (songIds.some(isNaN)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    // Verify songs in DB
    const [validSongs] = await connection.query(`
      SELECT id FROM songs
      WHERE id IN (?) AND artist_id = ? AND review_status = 'approved' AND album_id IS NULL
    `, [songIds, artistId]);

    if (validSongs.length !== songIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Một hoặc nhiều bài hát không hợp lệ hoặc đã thuộc album khác' });
    }

    const albumColumns = await getAlbumColumns();
    const artistGenre = await resolveArtistUploadGenre(artistId);
    const genreId = artistGenre?.genre?.id || null;

    let coverUrl = null;
    if (req.file) {
      coverUrl = '/uploads/images/' + req.file.filename;
    }

    const fields = ['artist_id', 'title'];
    const placeholders = ['?', '?'];
    const values = [artistId, title];

    if (albumColumns.has('genre_id')) {
      fields.push('genre_id');
      placeholders.push('?');
      values.push(genreId);
    }
    if (albumColumns.has('description')) {
      fields.push('description');
      placeholders.push('?');
      values.push(description || null);
    }
    if (albumColumns.has('cover_url')) {
      fields.push('cover_url');
      placeholders.push('?');
      values.push(coverUrl);
    }
    if (albumColumns.has('release_date')) {
      fields.push('release_date');
      placeholders.push('?');
      values.push(releaseDate || null);
    }
    if (albumColumns.has('release_at')) {
      fields.push('release_at');
      placeholders.push('?');
      values.push(releaseDate || null);
    }
    if (albumColumns.has('submission_note')) {
      fields.push('submission_note');
      placeholders.push('?');
      values.push(submissionNote || null);
    }
    if (albumColumns.has('review_status')) {
      fields.push('review_status');
      placeholders.push('?');
      values.push('pending_review');
    }
    if (albumColumns.has('submitted_by_artist_id')) {
      fields.push('submitted_by_artist_id');
      placeholders.push('?');
      values.push(artistId);
    }
    if (albumColumns.has('submitted_by_user_id')) {
      fields.push('submitted_by_user_id');
      placeholders.push('?');
      values.push(req.user.id);
    }
    if (albumColumns.has('submitted_at')) {
      fields.push('submitted_at');
      placeholders.push('NOW()');
    }

    const [approvedSongRows] = await connection.query(
      "SELECT COUNT(*) as count FROM songs WHERE artist_id = ? AND review_status = 'approved'",
      [artistId]
    );
    const approvedSongCount = approvedSongRows[0]?.count || 0;

    const [dupAlbumRows] = await connection.query(
      "SELECT COUNT(*) as count FROM albums WHERE artist_id = ? AND LOWER(title) = LOWER(?)",
      [artistId, title.trim()]
    );
    const duplicateTitleCount = dupAlbumRows[0]?.count || 0;

    const albumEvalResult = evaluateAlbumSubmission({
      title: title.trim(),
      coverUrl,
      description,
      submissionNote,
      resubmissionCount: 0,
    }, validSongs, {
      approvedSongCount,
      duplicateTitleCount,
    });

    fields.push('metadata_score', 'risk_score', 'moderation_level', 'moderation_flags');
    placeholders.push('?', '?', '?', '?');
    values.push(
      albumEvalResult.metadataScore,
      albumEvalResult.riskScore,
      albumEvalResult.moderationLevel,
      JSON.stringify(albumEvalResult.moderationFlags)
    );

    const query = `INSERT INTO albums (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await connection.query(query, values);
    const newAlbumId = result.insertId;

    await connection.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, action, score_snapshot)
       VALUES ('album', ?, ?, 'submitted', ?)`,
      [newAlbumId, artistId, JSON.stringify(albumEvalResult)]
    ).catch(err => console.warn('Failed to log album submission:', err));

    // Update songs with album_id and track_number
    const songColumns = await getSongColumns();
    const hasTrackNumber = songColumns.has('track_number');

    for (let i = 0; i < songIds.length; i++) {
      if (hasTrackNumber) {
        await connection.query('UPDATE songs SET album_id = ?, track_number = ? WHERE id = ?', [newAlbumId, i + 1, songIds[i]]);
      } else {
        await connection.query('UPDATE songs SET album_id = ? WHERE id = ?', [newAlbumId, songIds[i]]);
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Album đã được gửi Admin duyệt.',
      album: {
        id: newAlbumId,
        title,
        reviewStatus: 'pending_review'
      }
    });

    // Notify admins and artist
    try {
      await notificationService.notifyAdminsNewArtistSubmission({
        contentType: 'album', contentId: newAlbumId, title: title.trim(), artistId, artistName: req.artist?.name || 'Nghệ sĩ'
      });
      await notificationService.notifyArtistSubmissionReceived({
        userId: req.user.id, contentType: 'album', contentId: newAlbumId, title: title.trim()
      });
    } catch (err) {
      console.warn('Notification service error:', err);
    }
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

exports.resubmitSong = async (req, res, next) => {
  try {
    const artistId = req.artist.id;
    const songId = parseInt(req.params.id, 10);
    const { title, lyrics, submissionNote } = req.body;
    const uploadedFiles = [
      ...(req.files?.audio || []),
      ...(req.files?.cover || [])
    ];

    if (!title || !title.trim()) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Tên bài hát là bắt buộc.' });
    }

    const [songRows] = await pool.query(
      "SELECT * FROM songs WHERE id = ? AND artist_id = ? AND review_status = 'rejected'",
      [songId, artistId]
    );

    if (!songRows.length) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Không thể gửi lại bài hát này. Có thể bài hát không thuộc về bạn, không tồn tại hoặc không ở trạng thái bị từ chối.' });
    }

    const songRecord = songRows[0];
    if (songRecord.can_resubmit === 0 || songRecord.resubmission_count >= 3) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Nội dung đã đạt số lần gửi lại tối đa. Vui lòng liên hệ quản trị viên.' });
    }

    let audioUrl = songRecord.audio_url;
    let coverUrl = songRecord.cover_url;
    let audioHash = songRecord.audio_hash || null;
    let audioFileSize = songRecord.audio_file_size || null;
    let audioMimeType = songRecord.audio_mime_type || null;

    if (req.files) {
      if (req.files.audio && req.files.audio.length > 0) {
        const audioFile = req.files.audio[0];
        if (!isAllowedUpload(audioFile, ['.mp3', '.wav', '.m4a'], ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'])) {
          cleanupUploadedFiles(uploadedFiles);
          return res.status(400).json({ success: false, message: 'File audio chỉ hỗ trợ mp3, wav, m4a.' });
        }

        let newHash = null;
        try {
          newHash = await calculateFileSha256(audioFile.path);
        } catch (err) {
          console.error('Error calculating resubmit audio SHA-256 hash:', err);
        }

        if (newHash) {
          const dupSong = await findDuplicateAudioHash(newHash, songId);
          if (dupSong) {
            cleanupUploadedFiles(uploadedFiles);
            if (dupSong.review_status === 'approved') {
              return res.status(409).json({
                success: false,
                code: 'DUPLICATE_AUDIO_APPROVED',
                message: 'File audio này đã tồn tại trong hệ thống ở một bài hát đã được duyệt.'
              });
            }
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_AUDIO_PENDING',
              message: 'File audio này đang trùng với một bài hát khác đang chờ duyệt. Vui lòng kiểm tra lại trước khi gửi.'
            });
          }
          audioHash = newHash;
        }

        audioUrl = '/uploads/audio/' + audioFile.filename;
        audioFileSize = audioFile.size || null;
        audioMimeType = audioFile.mimetype || null;
      }
      if (req.files.cover && req.files.cover.length > 0) {
        if (!isAllowedUpload(req.files.cover[0], ['.jpg', '.jpeg', '.png', '.webp'], ['image/jpeg', 'image/png', 'image/webp'])) {
          cleanupUploadedFiles(uploadedFiles);
          return res.status(400).json({ success: false, message: 'Ảnh bìa chỉ hỗ trợ jpg, jpeg, png, webp.' });
        }
        coverUrl = '/uploads/images/' + req.files.cover[0].filename;
      }
    }

    const artistGenre = await resolveArtistUploadGenre(artistId);
    const genreId = artistGenre?.genre?.id || null;

    const [approvedSongRows] = await pool.query(
      "SELECT COUNT(*) as count FROM songs WHERE artist_id = ? AND review_status = 'approved'",
      [artistId]
    );
    const approvedSongCount = approvedSongRows[0]?.count || 0;

    const [dupRows] = await pool.query(
      "SELECT COUNT(*) as count FROM songs WHERE artist_id = ? AND id != ? AND LOWER(title) = LOWER(?)",
      [artistId, songId, title.trim()]
    );
    const duplicateTitleCount = dupRows[0]?.count || 0;

    const nextResubmitCount = (songRecord.resubmission_count || 0) + 1;
    const songEvalResult = evaluateSongSubmission({
      title: title.trim(),
      coverUrl,
      audioUrl,
      lyrics,
      genreId,
      submissionNote,
      duration: songRecord.duration_sec || songRecord.duration || null,
      resubmissionCount: nextResubmitCount,
    }, {
      approvedSongCount,
      duplicateTitleCount,
    });

    const songColumns = await getSongColumns();
    const updateFields = [
      'title = ?',
      'lyrics = ?',
      'audio_url = ?',
      'cover_url = ?',
      'review_status = ?',
      'rejection_reason = NULL',
      'reviewed_at = NULL',
      'reviewed_by_admin_id = NULL',
      'submitted_at = NOW()',
      'resubmission_count = resubmission_count + 1',
      'can_resubmit = 1',
      'resubmit_locked_reason = NULL',
      'metadata_score = ?',
      'risk_score = ?',
      'moderation_level = ?',
      'moderation_flags = ?'
    ];
    const values = [
      title.trim(), lyrics || null, audioUrl, coverUrl, 'pending_review',
      songEvalResult.metadataScore, songEvalResult.riskScore, songEvalResult.moderationLevel, JSON.stringify(songEvalResult.moderationFlags)
    ];

    if (genreId) {
      updateFields.push('genre_id = ?');
      values.push(genreId);
    }

    if (songColumns.has('submission_note')) {
      updateFields.push('submission_note = ?');
      values.push(submissionNote || null);
    }

    if (songColumns.has('audio_hash') && audioHash) {
      updateFields.push('audio_hash = ?');
      values.push(audioHash);
    }
    if (songColumns.has('audio_file_size') && audioFileSize) {
      updateFields.push('audio_file_size = ?');
      values.push(audioFileSize);
    }
    if (songColumns.has('audio_mime_type') && audioMimeType) {
      updateFields.push('audio_mime_type = ?');
      values.push(audioMimeType);
    }
    if (songColumns.has('duplicate_reference_song_id') && typeof resubmitDupRef !== 'undefined' && resubmitDupRef) {
      updateFields.push('duplicate_reference_song_id = ?', 'duplicate_reference_status = ?', 'duplicate_reference_artist_id = ?');
      values.push(resubmitDupRef.id, resubmitDupRef.review_status, resubmitDupRef.artist_id);
    }

    values.push(songId);

    await pool.query(
      `UPDATE songs SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    pool.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, action, score_snapshot)
       VALUES ('song', ?, ?, 'resubmitted', ?)`,
      [songId, artistId, JSON.stringify(songEvalResult)]
    ).catch(err => console.warn('Failed to log song resubmission:', err));

    res.json({
      success: true,
      message: 'Bài hát đã được gửi lại để Admin duyệt.',
      song: {
        id: songId,
        title: title.trim(),
        reviewStatus: 'pending_review'
      }
    });

    try {
      await notificationService.notifyAdminsNewArtistSubmission({
        contentType: 'song', contentId: songId, title: title.trim(), artistId, artistName: req.artist?.name || 'Nghệ sĩ'
      });
      await notificationService.notifyArtistSubmissionReceived({
        userId: req.user.id, contentType: 'song', contentId: songId, title: title.trim()
      });
    } catch (err) {
      console.warn('Notification service error:', err);
    }

  } catch (error) {
    cleanupUploadedFiles(req.files ? [...(req.files.audio || []), ...(req.files.cover || [])] : []);
    next(error);
  }
};

exports.resubmitAlbum = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const artistId = req.artist.id;
    const albumId = parseInt(req.params.id, 10);
    const { title, description, releaseDate, submissionNote } = req.body;
    let songIds = [];
    if (req.body.songIds) {
      try {
        songIds = JSON.parse(req.body.songIds);
      } catch (e) {
        throw new Error('Định dạng songIds không hợp lệ');
      }
    }

    if (!title || !title.trim()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (title)' });
    }

    if (!Array.isArray(songIds) || songIds.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Phải chọn ít nhất 1 bài hát cho album' });
    }

    songIds = [...new Set(songIds)].map(id => parseInt(id, 10));
    if (songIds.some(isNaN)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    const [albumRows] = await connection.query(
      "SELECT * FROM albums WHERE id = ? AND artist_id = ? AND review_status = 'rejected'",
      [albumId, artistId]
    );

    if (!albumRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Không thể gửi lại album này. Có thể album không thuộc về bạn, không tồn tại hoặc không ở trạng thái bị từ chối.' });
    }

    const albumRecord = albumRows[0];
    if (albumRecord.can_resubmit === 0 || albumRecord.resubmission_count >= 3) {
      cleanupUploadedFiles([req.file]);
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Nội dung đã đạt số lần gửi lại tối đa. Vui lòng liên hệ quản trị viên.' });
    }

    // Verify songs in DB
    const [validSongs] = await connection.query(`
      SELECT id FROM songs
      WHERE id IN (?) AND artist_id = ? AND review_status = 'approved' AND (album_id IS NULL OR album_id = ?)
    `, [songIds, artistId, albumId]);

    if (validSongs.length !== songIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Một hoặc nhiều bài hát không hợp lệ hoặc đã thuộc album khác' });
    }

    const albumColumns = await getAlbumColumns();
    let coverUrl = albumRecord.cover_url;
    if (req.file) {
      coverUrl = '/uploads/images/' + req.file.filename;
    }

    const [approvedSongRows] = await connection.query(
      "SELECT COUNT(*) as count FROM songs WHERE artist_id = ? AND review_status = 'approved'",
      [artistId]
    );
    const approvedSongCount = approvedSongRows[0]?.count || 0;

    const [dupAlbumRows] = await connection.query(
      "SELECT COUNT(*) as count FROM albums WHERE artist_id = ? AND id != ? AND LOWER(title) = LOWER(?)",
      [artistId, albumId, title.trim()]
    );
    const duplicateTitleCount = dupAlbumRows[0]?.count || 0;

    const nextResubmitCount = (albumRecord.resubmission_count || 0) + 1;
    const albumEvalResult = evaluateAlbumSubmission({
      title: title.trim(),
      coverUrl,
      description,
      submissionNote,
      resubmissionCount: nextResubmitCount,
    }, validSongs, {
      approvedSongCount,
      duplicateTitleCount,
    });

    const updateFields = [
      'title = ?',
      'cover_url = ?',
      'review_status = ?',
      'rejection_reason = NULL',
      'reviewed_at = NULL',
      'reviewed_by_admin_id = NULL',
      'submitted_at = NOW()',
      'resubmission_count = resubmission_count + 1',
      'can_resubmit = 1',
      'resubmit_locked_reason = NULL',
      'metadata_score = ?',
      'risk_score = ?',
      'moderation_level = ?',
      'moderation_flags = ?'
    ];
    const values = [
      title.trim(),
      coverUrl,
      'pending_review',
      albumEvalResult.metadataScore,
      albumEvalResult.riskScore,
      albumEvalResult.moderationLevel,
      JSON.stringify(albumEvalResult.moderationFlags)
    ];

    if (albumColumns.has('description')) {
      updateFields.push('description = ?');
      values.push(description || null);
    }
    if (albumColumns.has('release_date')) {
      updateFields.push('release_date = ?');
      values.push(releaseDate || null);
    }
    if (albumColumns.has('release_at')) {
      updateFields.push('release_at = ?');
      values.push(releaseDate || null);
    }
    if (albumColumns.has('submission_note')) {
      updateFields.push('submission_note = ?');
      values.push(submissionNote || null);
    }

    values.push(albumId);

    await connection.query(
      `UPDATE albums SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    await connection.query(
      `INSERT INTO artist_content_review_logs (content_type, content_id, artist_id, action, score_snapshot)
       VALUES ('album', ?, ?, 'resubmitted', ?)`,
      [albumId, artistId, JSON.stringify(albumEvalResult)]
    ).catch(err => console.warn('Failed to log album resubmission:', err));

    // Clear old links
    await connection.query('UPDATE songs SET album_id = NULL WHERE album_id = ?', [albumId]);

    // Update new links
    const songColumns = await getSongColumns();
    const hasTrackNumber = songColumns.has('track_number');
    for (let i = 0; i < songIds.length; i++) {
      if (hasTrackNumber) {
        await connection.query('UPDATE songs SET album_id = ?, track_number = ? WHERE id = ?', [albumId, i + 1, songIds[i]]);
      } else {
        await connection.query('UPDATE songs SET album_id = ? WHERE id = ?', [albumId, songIds[i]]);
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Album đã được gửi lại để Admin duyệt.',
      album: {
        id: albumId,
        title: title.trim(),
        reviewStatus: 'pending_review'
      }
    });

    try {
      await notificationService.notifyAdminsNewArtistSubmission({
        contentType: 'album', contentId: albumId, title: title.trim(), artistId, artistName: req.artist?.name || 'Nghệ sĩ'
      });
      await notificationService.notifyArtistSubmissionReceived({
        userId: req.user.id, contentType: 'album', contentId: albumId, title: title.trim()
      });
    } catch (err) {
      console.warn('Notification service error:', err);
    }

  } catch (error) {
    if (req.file) cleanupUploadedFiles([req.file]);
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};
