const { pool } = require('../config/database');
const { normalizeCoverUrl, resolveArtistAvatar } = require('../utils/imageUrl.util');
const { publicSongCondition, publicAlbumCondition } = require('../utils/public.utils');

exports.getAlbumDetails = async (req, res, next) => {
  try {
    const albumId = req.params.id;
    const userId = req.user?.id || null;

    const [albumRows] = await pool.query(`
      SELECT 
        al.id,
        al.title,
        COALESCE(
          NULLIF(al.cover_url, ''),
          (
            SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
            FROM songs s
            WHERE s.album_id = al.id AND ${publicSongCondition('s')}
            AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
            ORDER BY s.id ASC
            LIMIT 1
          )
        ) AS cover_url,
        al.external_url,
        al.album_type,
        al.total_tracks,
        al.artist_id,
        a.name AS artist_name,
        a.avatar_url AS artist_avatar_url,
        COUNT(s.id) AS song_count,
        COALESCE(SUM(s.duration_sec), 0) AS total_duration_sec,
        COALESCE(SUM(s.play_count), 0) AS total_plays
      FROM albums al
      LEFT JOIN artists a ON al.artist_id = a.id
      LEFT JOIN songs s ON s.album_id = al.id AND ${publicSongCondition('s')}
      WHERE al.id = ? AND ${publicAlbumCondition('al')}
      GROUP BY al.id
      HAVING COUNT(s.id) > 0
    `, [albumId]);

    if (albumRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    const album = albumRows[0];
    album.cover_url = normalizeCoverUrl(album.cover_url, req);
    album.artist_avatar_url = resolveArtistAvatar({ id: album.artist_id, name: album.artist_name, avatar_url: album.artist_avatar_url }, req);

    // Check if user has saved this album
    if (req.user && req.user.id) {
      const [savedRows] = await pool.query(
        'SELECT 1 FROM user_saved_albums WHERE user_id = ? AND album_id = ? LIMIT 1',
        [req.user.id, albumId]
      );
      album.is_saved = savedRows.length > 0;
    } else {
      album.is_saved = false;
    }

    const [songs] = await pool.query(`
      SELECT 
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        s.cover_url,
        s.play_count,
        s.album_id,
        al.title AS album_title,
        s.artist_id,
        a.name AS artist_name,
        s.genre_id,
        g.name AS genre_name,
        IF(sl.user_id IS NULL, 0, 1) AS is_liked
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
      WHERE s.album_id = ? AND ${publicSongCondition('s')}
      ORDER BY s.created_at ASC
    `, [userId, albumId]);

    album.songs = songs;

    res.json({
      success: true,
      data: album
    });
  } catch (err) {
    next(err);
  }
};

exports.addToLibrary = async (req, res, next) => {
  try {
    const albumId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    if (!Number.isFinite(albumId)) {
      return res.status(400).json({ success: false, message: 'Album không hợp lệ' });
    }

    // Check if album exists
    const [albums] = await pool.query(`
      SELECT al.id
      FROM albums al
      WHERE al.id = ?
        AND ${publicAlbumCondition('al')}
        AND EXISTS (
          SELECT 1 FROM songs s
          WHERE s.album_id = al.id AND ${publicSongCondition('s')}
        )
    `, [albumId]);
    if (albums.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy album' });
    }

    await pool.query(
      'INSERT IGNORE INTO user_saved_albums (user_id, album_id, saved_at) VALUES (?, ?, NOW())',
      [userId, albumId]
    );

    return res.json({
      success: true,
      message: 'Đã thêm vào thư viện',
      data: { album_id: albumId, is_saved: true }
    });
  } catch (err) {
    next(err);
  }
};

exports.removeFromLibrary = async (req, res, next) => {
  try {
    const albumId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    await pool.query(
      'DELETE FROM user_saved_albums WHERE user_id = ? AND album_id = ?',
      [userId, albumId]
    );

    return res.json({
      success: true,
      message: 'Đã bỏ khỏi thư viện',
      data: { album_id: albumId, is_saved: false }
    });
  } catch (err) {
    next(err);
  }
};
