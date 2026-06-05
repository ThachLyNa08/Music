const { pool } = require('../config/database');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');

// Lấy danh sách tất cả nghệ sĩ
exports.getAllArtists = async (req, res, next) => {
  try {
    const popular = req.query.popular === 'true';
    const limit = parseInt(req.query.limit, 10) || 50;

    let query = `
      SELECT a.id, a.name, a.bio, a.avatar_url,
             COUNT(s.id) as song_count,
             COALESCE(SUM(s.play_count), 0) as total_plays,
             COUNT(DISTINCT af.id) as follower_count
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      LEFT JOIN artist_follows af ON af.artist_id = a.id
      GROUP BY a.id
    `;
    
    if (popular) {
      query += ` ORDER BY follower_count DESC, total_plays DESC LIMIT ${limit}`;
    } else {
      query += ` ORDER BY total_plays DESC LIMIT ${limit}`;
    }

    const [artists] = await pool.query(query);
    res.json({ success: true, data: artists });
  } catch (err) {
    next(err);
  }
};

// Lấy chi tiết một nghệ sĩ
exports.getArtistById = async (req, res, next) => {
  try {
    const artistId = req.params.id;
    const userId = req.user ? req.user.id : null;

    // Thông tin nghệ sĩ + follower count thật
    const [artists] = await pool.query(`
      SELECT a.id, a.name, a.bio, a.avatar_url, a.created_at,
             COUNT(s.id) as song_count,
             COALESCE(SUM(s.play_count), 0) as total_plays,
             COUNT(DISTINCT af.id) as follower_count
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      LEFT JOIN artist_follows af ON af.artist_id = a.id
      WHERE a.id = ?
      GROUP BY a.id
    `, [artistId]);

    if (artists.length === 0) {
      return res.status(404).json({ success: false, message: 'Nghệ sĩ không tồn tại' });
    }

    const artist = artists[0];

    // Kiểm tra user có đang follow không
    let is_following = false;
    if (userId) {
      const [followCheck] = await pool.query(
        'SELECT id FROM artist_follows WHERE user_id = ? AND artist_id = ? LIMIT 1',
        [userId, artistId]
      );
      is_following = followCheck.length > 0;
    }

    // Counts (Album/Single)
    const [albumCounts] = await pool.query(`
      SELECT 
        SUM(CASE WHEN album_type = 'album' AND total_tracks > 1 THEN 1 ELSE 0 END) as album_count,
        SUM(CASE WHEN album_type = 'single' OR total_tracks <= 1 THEN 1 ELSE 0 END) as single_count
      FROM albums
      WHERE artist_id = ?
    `, [artistId]);
    artist.album_count = albumCounts[0]?.album_count || 0;
    artist.single_count = albumCounts[0]?.single_count || 0;

    // Bài hát phổ biến nhất (top 5) - popular_songs
    const [popularSongs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.play_count,
             al.id as album_id, al.title as album_title, al.album_type,
             a.id as artist_id, a.name as artist_name, g.id as genre_id, g.name as genre_name,
             IF(sl.user_id IS NOT NULL, 1, 0) as is_liked
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE s.artist_id = ? AND s.is_active = TRUE
      ORDER BY s.play_count DESC, s.created_at DESC
      LIMIT 10
    `, [userId, artistId]);

    // Tất cả bài hát - songs
    const [allSongs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.play_count,
             al.id as album_id, al.title as album_title, al.album_type,
             a.id as artist_id, a.name as artist_name, g.id as genre_id, g.name as genre_name,
             IF(sl.user_id IS NOT NULL, 1, 0) as is_liked
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE s.artist_id = ? AND s.is_active = TRUE
      ORDER BY s.play_count DESC, s.created_at DESC
    `, [userId, artistId]);

    // Albums thật
    const [albumRows] = await pool.query(`
      SELECT al.id, al.title, al.release_date, al.album_type, al.total_tracks,
             COALESCE(
               NULLIF(al.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
                 FROM songs s
                 WHERE s.album_id = al.id AND s.is_active = TRUE
                 AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
                 ORDER BY s.id ASC
                 LIMIT 1
               )
             ) AS cover_url
      FROM albums al
      WHERE al.artist_id = ? AND al.album_type = 'album' AND al.total_tracks > 1
      ORDER BY al.release_date DESC, al.created_at DESC
    `, [artistId]);
    
    const albums = albumRows.map(row => ({
      ...row,
      cover_url: normalizeCoverUrl(row.cover_url, req)
    }));

    // Singles
    const [singleRows] = await pool.query(`
      SELECT al.id, al.title, al.release_date, al.album_type, al.total_tracks,
             COALESCE(
               NULLIF(al.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
                 FROM songs s
                 WHERE s.album_id = al.id AND s.is_active = TRUE
                 AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
                 ORDER BY s.id ASC
                 LIMIT 1
               )
             ) AS cover_url
      FROM albums al
      WHERE al.artist_id = ? AND (al.album_type = 'single' OR al.total_tracks <= 1)
      ORDER BY al.release_date DESC, al.created_at DESC
    `, [artistId]);
    
    const singles = singleRows.map(row => ({
      ...row,
      cover_url: normalizeCoverUrl(row.cover_url, req)
    }));

    // Nghệ sĩ liên quan (cùng genre)
    const [relatedArtists] = await pool.query(`
      SELECT DISTINCT a2.id, a2.name, a2.avatar_url,
             COUNT(s2.id) as song_count
      FROM songs s1
      JOIN songs s2 ON s2.genre_id = s1.genre_id AND s2.artist_id != s1.artist_id
      JOIN artists a2 ON a2.id = s2.artist_id
      WHERE s1.artist_id = ? AND s1.is_active = TRUE AND s2.is_active = TRUE
      GROUP BY a2.id
      ORDER BY song_count DESC
      LIMIT 6
    `, [artistId]);

    // Tạo artist_pick
    let artistPick = null;
    if (popularSongs && popularSongs.length > 0) {
      artistPick = {
        type: 'song',
        id: popularSongs[0].id,
        title: popularSongs[0].title,
        subtitle: `Bài hát nổi bật của ${artist.name}`,
        cover_url: popularSongs[0].cover_url || artist.avatar_url
      };
    } else if (albums && albums.length > 0) {
      artistPick = {
        type: 'album',
        id: albums[0].id,
        title: albums[0].title,
        subtitle: `Album mới nhất của ${artist.name}`,
        cover_url: albums[0].cover_url || artist.avatar_url
      };
    } else if (singles && singles.length > 0) {
      artistPick = {
        type: 'album',
        id: singles[0].id,
        title: singles[0].title,
        subtitle: `Đĩa đơn mới nhất của ${artist.name}`,
        cover_url: singles[0].cover_url || artist.avatar_url
      };
    }

    res.json({
      success: true,
      data: {
        ...artist,
        is_following,
        popular_songs: popularSongs,
        songs: allSongs,
        albums: albums,
        singles: singles,
        artist_pick: artistPick,
        fans_also_like: relatedArtists
      }
    });
  } catch (err) {
    next(err);
  }
};

// Follow một nghệ sĩ
exports.followArtist = async (req, res, next) => {
  try {
    const artistId = req.params.id;
    const userId = req.user.id;

    // Kiểm tra nghệ sĩ có tồn tại không
    const [artists] = await pool.query('SELECT id, name FROM artists WHERE id = ?', [artistId]);
    if (artists.length === 0) {
      return res.status(404).json({ success: false, message: 'Nghệ sĩ không tồn tại' });
    }

    // Insert ignore để tránh trùng lặp
    await pool.query(
      'INSERT IGNORE INTO artist_follows (user_id, artist_id) VALUES (?, ?)',
      [userId, artistId]
    );

    // Lấy số follower mới
    const [[{ follower_count }]] = await pool.query(
      'SELECT COUNT(*) as follower_count FROM artist_follows WHERE artist_id = ?',
      [artistId]
    );

    res.json({
      success: true,
      message: 'Đã theo dõi nghệ sĩ',
      is_following: true,
      follower_count
    });
  } catch (err) {
    next(err);
  }
};

// Unfollow một nghệ sĩ
exports.unfollowArtist = async (req, res, next) => {
  try {
    const artistId = req.params.id;
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM artist_follows WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );

    // Lấy số follower mới
    const [[{ follower_count }]] = await pool.query(
      'SELECT COUNT(*) as follower_count FROM artist_follows WHERE artist_id = ?',
      [artistId]
    );

    res.json({
      success: true,
      message: 'Đã bỏ theo dõi nghệ sĩ',
      is_following: false,
      follower_count
    });
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
