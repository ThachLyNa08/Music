const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { publicSongCondition } = require('../utils/public.utils');
const { resolveArtistAvatar } = require('../utils/imageUrl.util');

async function userColumnExists(columnName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );
  return rows.length > 0;
}

function toPublicUsername(email) {
  if (!email || typeof email !== 'string') return null;
  const username = email.split('@')[0]?.trim();
  return username || null;
}

function listeningTimeExpr(alias = 'lh') {
  return `COALESCE(${alias}.listened_at, ${alias}.created_at)`;
}

function buildListeningTimeFilter(query = {}, defaultRange = 'this_month') {
  const { time_range, month } = query;
  const timeExpr = listeningTimeExpr('lh');

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return `AND ${timeExpr} >= '${month}-01' AND ${timeExpr} < DATE_ADD('${month}-01', INTERVAL 1 MONTH)`;
  }
  if (time_range === 'all_time') {
    return '';
  }
  if (time_range === 'last_30_days' || (!time_range && defaultRange === 'last_30_days')) {
    return `AND ${timeExpr} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }
  if (time_range === 'this_month' || defaultRange === 'this_month') {
    return `AND ${timeExpr} >= DATE_FORMAT(NOW(), '%Y-%m-01')`;
  }

  return '';
}

exports.getPublicProfile = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'User khong hop le' });
    }

    const hasBio = await userColumnExists('bio');
    const [users] = await pool.query(
      `SELECT id, display_name, email, avatar_url, ${hasBio ? 'bio' : 'NULL AS bio'}, created_at
       FROM users
       WHERE id = ? AND role = 'user' AND status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'Khong tim thay nguoi dung' });
    }

    const [publicPlaylists] = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.description,
         p.cover_url,
         p.created_at,
         p.updated_at,
         COUNT(ps.song_id) AS song_count
       FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       WHERE p.user_id = ?
         AND p.is_public = 1
       GROUP BY p.id, p.name, p.description, p.cover_url, p.created_at, p.updated_at
       ORDER BY p.updated_at DESC
       LIMIT 12`,
      [userId]
    );

    const [followedArtists] = await pool.query(
      `SELECT
         a.id,
         a.name,
         a.avatar_url,
         a.avatar_url AS cover_url,
         (SELECT COUNT(*) FROM artist_follows af2 WHERE af2.artist_id = a.id) AS followers_count,
         (SELECT COUNT(*) FROM songs s2 WHERE s2.artist_id = a.id AND ${publicSongCondition('s2')}) AS song_count,
         af.created_at AS followed_at
       FROM artist_follows af
       JOIN artists a ON a.id = af.artist_id
       WHERE af.user_id = ?
       ORDER BY followed_at DESC, a.name ASC
       LIMIT 12`,
      [userId]
    );

    followedArtists.forEach((artist) => {
      artist.avatar_url = resolveArtistAvatar(artist, req);
      artist.cover_url = artist.avatar_url;
      artist.followers_count = Number(artist.followers_count || 0);
      artist.song_count = Number(artist.song_count || 0);
      delete artist.followed_at;
    });

    const user = users[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.display_name,
        username: toPublicUsername(user.email),
        avatar_url: user.avatar_url,
        bio: user.bio || null,
        created_at: user.created_at,
        public_playlists: publicPlaylists,
        followed_artists: followedArtists,
        followed_artists_count: followedArtists.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getProfileStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Get basic stats from v_user_stats view
    const [statRows] = await pool.query(
      `SELECT unique_songs_heard, total_listen_sec, active_days, top_genre
       FROM v_user_stats WHERE user_id = ?`,
      [userId]
    );

    let stats = {
      unique_songs_heard: 0,
      total_listen_sec: 0,
      active_days: 0,
      top_genre: 'Unknown'
    };

    if (statRows.length > 0) {
      stats = statRows[0];
    }

    const timeFilter = buildListeningTimeFilter(req.query, 'last_30_days');

    // 2. Get top artist this month (based on listening history)
    const [artistRows] = await pool.query(`
      SELECT a.id, a.name, SUM(ROUND(s.duration_sec * lh.completion_rate)) as artist_listen_sec
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ? ${timeFilter}
      GROUP BY a.id, a.name
      ORDER BY artist_listen_sec DESC
      LIMIT 1
    `, [userId]);

    const topArtist = artistRows.length > 0 ? {
      name: artistRows[0].name,
      listen_sec: artistRows[0].artist_listen_sec
    } : null;

    // 3. Get top 5 genres (for genre strip)
    const [genreRows] = await pool.query(`
      SELECT g.name, COUNT(lh.id) as count
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN genres g ON s.genre_id = g.id
      WHERE lh.user_id = ?
      GROUP BY g.id, g.name
      ORDER BY count DESC
      LIMIT 5
    `, [userId]);

    const topGenres = genreRows.map(row => row.name);

    return res.json({
      success: true,
      data: {
        stats,
        topArtist,
        topGenres
      }
    });

  } catch (err) {
    next(err);
  }
};

exports.getRecentlyPlayed = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Tăng giới hạn tối đa từ 100 lên 500 để client có thể lấy dữ liệu lịch sử cũ hơn (nhiều ngày trước)
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const timeFilter = buildListeningTimeFilter(req.query, 'all_time');

    const [history] = await pool.query(`
      WITH ranked_history AS (
        SELECT
          lh.*,
          ${listeningTimeExpr('lh')} AS activity_at,
          DATE(${listeningTimeExpr('lh')}) AS listen_date,
          ROW_NUMBER() OVER (
            PARTITION BY lh.user_id, lh.song_id, DATE(${listeningTimeExpr('lh')})
            ORDER BY ${listeningTimeExpr('lh')} DESC
          ) AS rn
        FROM listening_history lh
        WHERE lh.user_id = ? ${timeFilter}
      )
      SELECT
        rh.id AS history_id,
        rh.user_id,
        rh.song_id,
        rh.listen_duration,
        rh.song_duration,
        rh.completion_rate,
        rh.is_completed,
        rh.is_skipped,
        rh.source,
        rh.activity_at AS created_at,

        s.id,
        s.title,
        s.cover_url,
        s.audio_url,
        s.duration_sec,
        s.play_count,
        IF(sl.user_id IS NULL, 0, 1) AS is_liked,

        a.id AS artist_id,
        a.name AS artist_name,

        al.id AS album_id,
        al.title AS album_title,
        al.cover_url AS album_cover_url,
        al.album_type,

        g.id AS genre_id,
        g.name AS genre_name
      FROM ranked_history rh
      JOIN songs s ON rh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE rh.rn = 1
      ORDER BY rh.activity_at DESC
      LIMIT ?
    `, [userId, userId, limit]);

    res.json({
      success: true,
      data: history
    });

  } catch (err) {
    next(err);
  }
};

exports.getFullProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const timeFilter = buildListeningTimeFilter(req.query, 'this_month');

    // 1. User Info
    const [users] = await pool.query(
      'SELECT id, display_name, email, avatar_url, role, premium_expires_at FROM users WHERE id = ?',
      [userId]
    );
    if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
    const user = users[0];
    user.is_premium = user.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    user.spotify_connected = false; // Tạm hardcode false nếu không có field provider
    user.name = user.display_name || 'Người dùng';

    // 2. Stats
    const [statsResult] = await pool.query(`
      SELECT
        COALESCE(SUM(listen_duration), 0) AS total_listening_seconds,
        COUNT(*) AS total_songs_played,
        COUNT(DISTINCT DATE(${listeningTimeExpr('lh')})) AS active_days,
        COUNT(DISTINCT s.artist_id) AS unique_artists,
        COUNT(DISTINCT s.genre_id) AS unique_genres
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      WHERE lh.user_id = ?
    `, [userId]);
    const stats = statsResult[0];

    // 3. Top Genres
    const [topGenres] = await pool.query(`
      SELECT
        g.id,
        g.name,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS user_plays,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS listen_count,
        COUNT(*) AS raw_listen_events,
        SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN genres g ON s.genre_id = g.id
      WHERE lh.user_id = ?
      GROUP BY g.id, g.name
      HAVING user_plays > 0
      ORDER BY user_plays DESC, total_seconds DESC
      LIMIT 8
    `, [userId]);

    // 4. Top Artists This Month
    const [topArtistsMonth] = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.avatar_url,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS user_plays,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS listen_count,
        COUNT(*) AS raw_listen_events,
        SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ? ${timeFilter}
      GROUP BY a.id, a.name, a.avatar_url
      HAVING user_plays > 0
      ORDER BY user_plays DESC, total_seconds DESC
      LIMIT 50
    `, [userId]);

    topArtistsMonth.forEach(a => {
      a.avatar_url = resolveArtistAvatar(a, req);
    });

    // 5. Top Tracks This Month
    const [topTracksMonth] = await pool.query(`
      SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec,
        a.id AS artist_id, a.name AS artist_name,
        al.id AS album_id, al.title AS album_title,
        IF(sl.user_id IS NULL, 0, 1) AS is_liked,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS user_plays,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS listen_count,
        COUNT(*) AS raw_listen_events,
        SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE lh.user_id = ? ${timeFilter}
      GROUP BY s.id, s.title, s.cover_url, s.audio_url, s.duration_sec, a.id, a.name, al.id, al.title, sl.user_id
      HAVING user_plays > 0
      ORDER BY user_plays DESC, total_seconds DESC
      LIMIT 50
    `, [userId, userId]);

    // 6. Recently Played
    const [recentlyPlayed] = await pool.query(`
      WITH ranked_history AS (
        SELECT
          lh.id, lh.song_id, ${listeningTimeExpr('lh')} AS activity_at, lh.source,
          ROW_NUMBER() OVER (
            PARTITION BY lh.user_id, lh.song_id, DATE(${listeningTimeExpr('lh')})
            ORDER BY ${listeningTimeExpr('lh')} DESC
          ) AS rn
        FROM listening_history lh
        WHERE lh.user_id = ?
      )
      SELECT
        rh.id AS history_id, rh.activity_at AS created_at, rh.source,
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec,
        a.id AS artist_id, a.name AS artist_name,
        al.id AS album_id, al.title AS album_title,
        IF(sl.user_id IS NULL, 0, 1) AS is_liked
      FROM ranked_history rh
      JOIN songs s ON rh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE rh.rn = 1
      ORDER BY rh.activity_at DESC
      LIMIT 20
    `, [userId, userId]);

    // 7. Playlists
    const [publicPlaylists] = await pool.query(`
      SELECT
        p.id, p.name, p.cover_url,
        COUNT(ps.song_id) AS song_count
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      WHERE p.user_id = ?
      GROUP BY p.id, p.name, p.cover_url
      ORDER BY p.updated_at DESC
      LIMIT 10
    `, [userId]);

    // 8. Following Artists (Check if table exists, otherwise ignore)
    let followingArtists = [];
    try {
      const [follows] = await pool.query(`
        SELECT a.id, a.name, a.avatar_url, af.created_at AS followed_at
        FROM artist_follows af
        JOIN artists a ON af.artist_id = a.id
        WHERE af.user_id = ?
        ORDER BY af.created_at DESC
        LIMIT 10
      `, [userId]);

      follows.forEach(a => {
        a.avatar_url = resolveArtistAvatar(a, req);
      });

      followingArtists = follows;
    } catch (e) {
      // Table might not exist, ignore safely
    }

    // 8. Following Artists Count (from artist_follows table)
    let followed_artist_count = 0;
    try {
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as count FROM artist_follows WHERE user_id = ?',
        [userId]
      );
      followed_artist_count = countResult[0]?.count || 0;
    } catch (e) {
      // Table might not exist, ignore safely
    }

    res.json({
      success: true,
      data: {
        user,
        stats,
        top_genres: topGenres,
        top_artists_month: topArtistsMonth,
        top_tracks_month: topTracksMonth,
        recently_played: recentlyPlayed,
        public_playlists: publicPlaylists,
        following_artists: followingArtists,
        followed_artist_count
      }
    });

  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, bio } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Tên không được để trống' });
    }

    const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'bio'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN bio TEXT NULL");
    }

    await pool.query(
      'UPDATE users SET display_name = ?, bio = ? WHERE id = ?',
      [name.trim(), bio ? bio.trim() : null, userId]
    );

    const [users] = await pool.query('SELECT id, display_name as name, email, avatar_url, bio FROM users WHERE id = ?', [userId]);

    res.json({ success: true, data: users[0], message: 'Cập nhật hồ sơ thành công' });
  } catch (err) {
    next(err);
  }
};

// Lấy danh sách nghệ sĩ đã follow
exports.verifyCurrentPassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword } = req.body || {};

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu hiện tại',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = ? AND role = 'user' AND status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản người dùng không hợp lệ',
      });
    }

    const currentOk = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!currentOk) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không đúng',
        code: 'CURRENT_PASSWORD_INCORRECT',
      });
    }

    return res.json({
      success: true,
      message: 'Mật khẩu hiện tại chính xác',
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin mật khẩu',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới tối thiểu 6 ký tự',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu xác nhận không khớp',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = ? AND role = 'user' AND status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản người dùng không hợp lệ',
      });
    }

    const user = rows[0];
    const currentOk = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentOk) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không đúng',
        code: 'CURRENT_PASSWORD_INCORRECT',
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới không được trùng mật khẩu hiện tại',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công',
    });
  } catch (err) {
    next(err);
  }
};

exports.getFollowedArtists = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [artists] = await pool.query(`
      SELECT
        a.id, a.name, a.bio, a.avatar_url,
        (SELECT COUNT(*) FROM songs s2 WHERE s2.artist_id = a.id AND ${publicSongCondition('s2')}) as song_count,
        (SELECT COUNT(*) FROM artist_follows af2 WHERE af2.artist_id = a.id) as follower_count,
        af.created_at as followed_at
      FROM artist_follows af
      JOIN artists a ON af.artist_id = a.id
      WHERE af.user_id = ?
      ORDER BY af.created_at DESC
    `, [userId]);

    artists.forEach(a => {
      a.avatar_url = resolveArtistAvatar(a, req);
    });

    res.json({
      success: true,
      data: artists
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh tải lên' });
    }

    const avatarUrl = '/uploads/images/' + req.file.filename;

    await pool.query(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, userId]
    );

    res.json({ success: true, data: { avatar_url: avatarUrl }, message: 'Cập nhật ảnh đại diện thành công' });
  } catch (err) {
    next(err);
  }
};
