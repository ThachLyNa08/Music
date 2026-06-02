const { pool } = require('../config/database');

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

    // 2. Get top artist this month (based on listening history)
    const [artistRows] = await pool.query(`
      SELECT a.id, a.name, SUM(ROUND(s.duration_sec * lh.completion_rate)) as artist_listen_sec
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ? AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);

    const [history] = await pool.query(`
      WITH ranked_history AS (
        SELECT 
          lh.*,
          DATE(lh.listened_at) AS listen_date,
          ROW_NUMBER() OVER (
            PARTITION BY lh.user_id, lh.song_id, DATE(lh.listened_at)
            ORDER BY lh.listened_at DESC
          ) AS rn
        FROM listening_history lh
        WHERE lh.user_id = ?
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
        rh.listened_at,
        
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
      ORDER BY rh.listened_at DESC
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
        COUNT(DISTINCT DATE(listened_at)) AS active_days,
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
        COUNT(*) AS listen_count, 
        SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN genres g ON s.genre_id = g.id
      WHERE lh.user_id = ?
      GROUP BY g.id, g.name
      ORDER BY listen_count DESC, total_seconds DESC
      LIMIT 8
    `, [userId]);

    // 4. Top Artists This Month
    const [topArtistsMonth] = await pool.query(`
      SELECT 
        a.id, 
        a.name, 
        a.avatar_url, 
        COUNT(*) AS listen_count, 
        SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ? AND lh.listened_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
      GROUP BY a.id, a.name, a.avatar_url
      ORDER BY listen_count DESC, total_seconds DESC
      LIMIT 50
    `, [userId]);

    // 5. Top Tracks This Month
    const [topTracksMonth] = await pool.query(`
      SELECT 
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec,
        a.id AS artist_id, a.name AS artist_name,
        al.id AS album_id, al.title AS album_title,
        IF(sl.user_id IS NULL, 0, 1) AS is_liked,
        COUNT(*) AS listen_count, SUM(lh.listen_duration) AS total_seconds
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE lh.user_id = ? AND lh.listened_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
      GROUP BY s.id, s.title, s.cover_url, s.audio_url, s.duration_sec, a.id, a.name, al.id, al.title, sl.user_id
      ORDER BY listen_count DESC, total_seconds DESC
      LIMIT 50
    `, [userId, userId]);

    // 6. Recently Played
    const [recentlyPlayed] = await pool.query(`
      WITH ranked_history AS (
        SELECT 
          lh.id, lh.song_id, lh.listened_at, lh.source,
          ROW_NUMBER() OVER (
            PARTITION BY lh.user_id, lh.song_id, DATE(lh.listened_at)
            ORDER BY lh.listened_at DESC
          ) AS rn
        FROM listening_history lh
        WHERE lh.user_id = ?
      )
      SELECT 
        rh.id AS history_id, rh.listened_at, rh.source,
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
      ORDER BY rh.listened_at DESC
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
exports.getFollowedArtists = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [artists] = await pool.query(`
      SELECT 
        a.id, a.name, a.bio, a.avatar_url,
        COUNT(DISTINCT s.id) as song_count,
        COUNT(DISTINCT af_follower.id) as follower_count,
        af.created_at as followed_at
      FROM artist_follows af
      JOIN artists a ON af.artist_id = a.id
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      LEFT JOIN artist_follows af_follower ON af_follower.artist_id = a.id
      WHERE af.user_id = ?
      GROUP BY a.id
      ORDER BY af.created_at DESC
    `, [userId]);

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
