const { pool } = require('../config/database');

async function assertCanEditPlaylist(req, res, next) {
  try {
    const userId = req.user.id;
    const playlistId = req.params.id;

    const [rows] = await pool.query(
      `SELECT id, user_id, type, is_system, system_key
       FROM playlists
       WHERE id = ?`,
      [playlistId]
    );

    const playlist = rows[0];

    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist không tồn tại' });
    }

    const ownerId = playlist.user_id;
    const isOwner = String(ownerId) === String(userId);
    const isSystem =
      playlist.is_system === 1 ||
      playlist.is_system === true ||
      playlist.is_system === '1' ||
      playlist.type === 'system';
    const playlistType = String(playlist.type || 'manual').toLowerCase();

    if (isSystem || playlist.system_key || playlistType !== 'manual') {
      return res.status(403).json({
        success: false,
        message: 'Không thể chỉnh sửa playlist do hệ thống tạo'
      });
    }

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa playlist này'
      });
    }

    // Gắn thông tin playlist vào request để dùng tiếp nếu cần
    req.playlist = playlist;
    next();
  } catch (err) {
    next(err);
  }
}

async function assertCanDeletePlaylist(req, res, next) {
  try {
    const userId = req.user.id;
    const playlistId = req.params.id;

    const [rows] = await pool.query(
      `SELECT id, user_id, type, is_system, system_key
       FROM playlists
       WHERE id = ?`,
      [playlistId]
    );

    const playlist = rows[0];

    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist khong ton tai' });
    }

    const isOwner = String(playlist.user_id) === String(userId);
    const isSystem =
      playlist.is_system === 1 ||
      playlist.is_system === true ||
      playlist.is_system === '1' ||
      playlist.type === 'system' ||
      !!playlist.system_key;
    const playlistType = String(playlist.type || 'manual').toLowerCase();

    if (isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Khong the xoa playlist he thong'
      });
    }

    if (!['manual', 'ai'].includes(playlistType)) {
      return res.status(403).json({
        success: false,
        message: 'Khong the xoa playlist nay'
      });
    }

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen xoa playlist nay'
      });
    }

    req.playlist = playlist;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { assertCanEditPlaylist, assertCanDeletePlaylist };
