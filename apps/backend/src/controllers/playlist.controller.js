const { pool } = require('../config/database');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const { VALID_SYSTEM_KEYS } = require('../services/systemPlaylist.service');
const { publicSongCondition, publicAlbumCondition } = require('../utils/public.utils');
const systemPlaylistTempoService = require('../services/systemPlaylistTempo.service');
const { getSystemPlaylistTempoMetadata } = require('../config/systemPlaylistTempo.config');

function isValidSystemPlaylist(playlist) {
  return (
    (playlist.is_system === 1 || playlist.is_system === true) &&
    playlist.type === 'system' &&
    VALID_SYSTEM_KEYS.includes(playlist.system_key)
  );
}

function isUserPlaylist(playlist) {
  return (
    !(playlist.is_system === 1 || playlist.is_system === true) &&
    !playlist.system_key &&
    ['manual', 'ai'].includes(playlist.type)
  );
}

function isSystemPlaylistRecord(playlist) {
  return (
    playlist &&
    (
      playlist.type === 'system' ||
      playlist.is_system === 1 ||
      playlist.is_system === true ||
      playlist.is_system === '1' ||
      !!playlist.system_key
    )
  );
}

function isAiPlaylistRecord(playlist) {
  return (
    playlist &&
    (
      playlist.type === 'ai' ||
      playlist.generated_by === 'ai' ||
      playlist.source === 'ai'
    )
  );
}

function isManualEditablePlaylist(playlist) {
  return (
    playlist &&
    String(playlist.type || 'manual').toLowerCase() === 'manual' &&
    !isSystemPlaylistRecord(playlist) &&
    !isAiPlaylistRecord(playlist)
  );
}

function isUserDeletablePlaylist(playlist) {
  return (
    playlist &&
    ['manual', 'ai'].includes(String(playlist.type || 'manual').toLowerCase()) &&
    !isSystemPlaylistRecord(playlist)
  );
}

function normalizeStrictPositiveId(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) return null;
  return Number(text);
}

async function getPlaylistSongs(conn, playlistId, userId) {
  const [songs] = await conn.query(
    `SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        s.cover_url,
        s.artist_id,
        a.name as artist,
        a.name as artist_name,
        s.album_id,
        al.title as album_title,
        s.genre_id,
        g.name as genre_name,
        ps.added_at,
        ps.position,
        IF(sl.user_id IS NULL, 0, 1) AS is_liked
     FROM playlist_songs ps
     JOIN songs s ON ps.song_id = s.id
     JOIN artists a ON s.artist_id = a.id
     LEFT JOIN albums al ON s.album_id = al.id
     LEFT JOIN genres g ON s.genre_id = g.id
     LEFT JOIN song_likes sl ON sl.song_id = s.id AND sl.user_id = ?
     WHERE ps.playlist_id = ? AND ${publicSongCondition('s')}
     ORDER BY ps.position ASC, ps.added_at ASC`,
    [userId, playlistId]
  );

  return songs;
}

function dedupePlaylists(playlists) {
  const seenSystemKeys = new Set();
  return playlists
    .sort((a, b) => {
      if (a.system_key && b.system_key) {
        const aScore = (a.type === 'system' ? 100 : 0) + (a.cover_url ? 10 : 0) + Number(a.total_songs || 0);
        const bScore = (b.type === 'system' ? 100 : 0) + (b.cover_url ? 10 : 0) + Number(b.total_songs || 0);
        if (aScore !== bScore) return bScore - aScore;
      }
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    })
    .filter(playlist => {
      if (!playlist.system_key) return true;
      const key = `${playlist.user_id}:${playlist.system_key}`;
      if (seenSystemKeys.has(key)) return false;
      seenSystemKeys.add(key);
      return true;
    });
}

const playlistsCache = new Map();
const PLAYLISTS_CACHE_TTL = 3 * 60 * 1000;

function clearPlaylistCache(userId) {
  playlistsCache.delete(`user_${userId}`);
}

function normalizePlaylistText(value, maxLength, fieldLabel) {
  if (value === undefined) return undefined;
  const text = String(value || '').trim();
  if (text.length > maxLength) {
    const error = new Error(`${fieldLabel} không được vượt quá ${maxLength} ký tự`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function parsePlaylistVisibility(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  const error = new Error('Trạng thái công khai playlist không hợp lệ');
  error.statusCode = 400;
  throw error;
}

exports.createPlaylist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const name = normalizePlaylistText(req.body.name, 255, 'Tên playlist');
    const description = normalizePlaylistText(req.body.description, 1000, 'Mô tả playlist');
    const isPublicVal = parsePlaylistVisibility(req.body.is_public, 0);

    if (!name) return res.status(400).json({ success: false, message: 'Tên playlist là bắt buộc' });

    let coverUrl = null;
    if (req.files && req.files.cover) {
      coverUrl = '/uploads/images/' + req.files.cover[0].filename;
    }

    const [result] = await pool.query(
      `INSERT INTO playlists (user_id, name, description, cover_url, is_public)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, name, description || '', coverUrl, isPublicVal]
    );

    clearPlaylistCache(userId);
    res.json({ success: true, message: 'Tạo playlist thành công', playlist_id: result.insertId });
  } catch (err) {
    next(err);
  }
};

exports.getMyPlaylists = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `user_${userId}`;
    const cached = playlistsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < PLAYLISTS_CACHE_TTL)) {
      return res.json({ success: true, data: cached.data });
    }

    // Get playlists
    const [playlists] = await pool.query(
      `SELECT p.id, p.user_id, p.name, p.description, p.type, p.is_public, p.created_at, p.updated_at, p.cover_url, p.is_system, p.system_key,
             u.display_name as creator_name,
             usp.id AS saved_playlist_id,
             usp.saved_at AS saved_at,
             COALESCE(
               NULLIF(p.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
                 FROM playlist_songs ps2
                 JOIN songs s ON s.id = ps2.song_id
                 WHERE ps2.playlist_id = p.id
                 AND ${publicSongCondition('s')}
                 AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
                 ORDER BY ps2.position ASC, ps2.added_at ASC
                 LIMIT 1
               )
             ) AS effective_cover_url,
             COUNT(ps.song_id) as total_songs,
             GROUP_CONCAT(ps.song_id) as song_ids
       FROM playlists p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
       LEFT JOIN user_saved_playlists usp ON usp.playlist_id = p.id AND usp.user_id = ?
       WHERE (
         (
           p.user_id = ?
           AND (p.is_system = 0 OR p.is_system IS NULL)
           AND p.system_key IS NULL
           AND p.type IN ('manual', 'ai')
         )
         OR
         (
           usp.id IS NOT NULL
         )
       )
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [userId, userId]
    );

    const filteredPlaylists = dedupePlaylists(playlists).filter(pl => (
      isValidSystemPlaylist(pl) || isUserPlaylist(pl)
    ));

    filteredPlaylists.forEach(pl => {
      pl.cover_url = normalizeCoverUrl(pl.cover_url, req);
      pl.effective_cover_url = normalizeCoverUrl(pl.effective_cover_url, req);
      pl.is_owner = String(pl.user_id) === String(userId);
      pl.is_system = isValidSystemPlaylist(pl);
      pl.can_edit = pl.is_owner && isManualEditablePlaylist(pl);
      pl.can_delete = pl.is_owner && isUserDeletablePlaylist(pl);
      pl.is_saved = Boolean(pl.saved_playlist_id);
      delete pl.saved_playlist_id;
      pl.item_type = 'playlist';
      if (pl.is_system) {
        pl.creator_name = 'MusicFlow';
      } else {
        pl.creator_name = pl.creator_name || 'Người dùng';
      }
      pl.song_ids = pl.song_ids ? pl.song_ids.split(',').map(Number) : [];
    });

    // Get saved albums/singles
    const [savedAlbums] = await pool.query(`
      SELECT
        al.id,
        al.title AS name,
        al.title,
        al.album_type,
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
        ar.name AS artist_name,
        ula.saved_at
      FROM user_saved_albums ula
      JOIN albums al ON al.id = ula.album_id
      LEFT JOIN artists ar ON ar.id = al.artist_id
      WHERE ula.user_id = ?
        AND ${publicAlbumCondition('al')}
        AND EXISTS (
          SELECT 1 FROM songs s
          WHERE s.album_id = al.id AND ${publicSongCondition('s')}
        )
      ORDER BY ula.saved_at DESC
    `, [userId]);

    const normalizedAlbums = savedAlbums.map(album => ({
      id: album.id,
      name: album.name,
      title: album.title,
      album_type: album.album_type,
      cover_url: normalizeCoverUrl(album.cover_url, req),
      artist_name: album.artist_name || 'Unknown Artist',
      saved_at: album.saved_at,
      is_saved: true,
      item_type: 'album'
    }));

    // Combine playlists and saved albums, sort by most recent
    const libraryItems = [...filteredPlaylists, ...normalizedAlbums]
      .sort((a, b) => {
        const dateA = new Date(a.saved_at || a.updated_at || a.created_at || 0);
        const dateB = new Date(b.saved_at || b.updated_at || b.created_at || 0);
        return dateB - dateA;
      });

    playlistsCache.set(cacheKey, { data: libraryItems, timestamp: Date.now() });
    res.json({ success: true, data: libraryItems });
  } catch (err) {
    next(err);
  }
};

exports.getPlaylistDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    const [playlists] = await pool.query(`
      SELECT p.id, p.user_id, p.name, p.description, p.type, p.is_public, p.created_at, p.updated_at, p.cover_url, p.is_system, p.system_key,
             u.display_name as creator_name, u.avatar_url as creator_avatar,
             usp.id AS saved_playlist_id,
             COALESCE(
               NULLIF(p.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
                 FROM playlist_songs ps2
                 JOIN songs s ON s.id = ps2.song_id
                 WHERE ps2.playlist_id = p.id
                 AND ${publicSongCondition('s')}
                 AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
                 ORDER BY ps2.position ASC, ps2.added_at ASC
                 LIMIT 1
               )
             ) AS effective_cover_url
      FROM playlists p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN user_saved_playlists usp ON usp.playlist_id = p.id AND usp.user_id = ?
      WHERE p.id = ?
    `, [userId, id]);

    if (playlists.length === 0) return res.status(404).json({ success: false, message: 'Playlist không tồn tại' });

    const playlist = playlists[0];
    playlist.cover_url = normalizeCoverUrl(playlist.cover_url, req);
    playlist.effective_cover_url = normalizeCoverUrl(playlist.effective_cover_url, req);

    const isOwner = String(playlist.user_id) === String(userId);
    const isSystem = playlist.is_system === 1 || playlist.is_system === true || !!playlist.system_key || playlist.type === 'system';

    if (isSystem) {
      playlist.creator_name = 'MusicFlow';
    } else {
      playlist.creator_name = playlist.creator_name || 'Người dùng';
    }

    const isSaved = Boolean(playlist.saved_playlist_id);

    playlist.is_owner = isOwner;
    playlist.is_system = isSystem;
    playlist.can_edit = isOwner && isManualEditablePlaylist(playlist);
    playlist.can_delete = isOwner && isUserDeletablePlaylist(playlist);
    playlist.is_saved = isSaved;
    delete playlist.saved_playlist_id;

    // Check privacy
    const isAdmin = req.user && req.user.role === 'admin';
    if (!playlist.is_public && !isOwner && !isSystem && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem playlist này' });
    }

    const songs = await getPlaylistSongs(pool, id, userId);
    const tempoMetadata = getSystemPlaylistTempoMetadata(playlist.system_key);
    const enriched = await systemPlaylistTempoService.enrichSystemPlaylistSongs(songs, playlist.system_key);

    res.json({
      success: true,
      data: {
        ...playlist,
        ...tempoMetadata,
        audioFeatureCoverage: enriched.tempoStats.audioFeatureCoverage,
        avgBpm: enriched.tempoStats.avgBpm,
        tempoDistribution: enriched.tempoStats.tempoDistribution,
        songs: enriched.songs
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.addSongToPlaylist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    let { song_id } = req.body;

    const [playlists] = await pool.query(`SELECT user_id, type, is_system, system_key FROM playlists WHERE id = ?`, [id]);
    if (playlists.length === 0 || String(playlists[0].user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền sửa playlist này' });
    }
    if (!isManualEditablePlaylist(playlists[0])) {
      return res.status(403).json({ success: false, message: 'Chi co the chinh sua playlist thu cong' });
    }
    if (playlists[0].is_system === 1 || playlists[0].system_key) {
      return res.status(403).json({ success: false, message: 'Không thể thêm bài hát vào playlist hệ thống' });
    }

    if (typeof song_id === 'object' && song_id !== null) {
      song_id = song_id.id || song_id.song_id || song_id.songId;
    }

    if (!song_id || String(song_id).includes('[object Object]')) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    song_id = normalizeStrictPositiveId(song_id);
    if (!song_id) {
      return res.status(400).json({ success: false, message: 'ID bĂ i hĂ¡t khĂ´ng há»£p lá»‡' });
    }

    const [songs] = await pool.query(
      `SELECT id FROM songs s WHERE id = ? AND ${publicSongCondition('s')} LIMIT 1`,
      [song_id]
    );
    if (!songs.length) {
      return res.status(404).json({ success: false, message: 'BĂ i hĂ¡t khĂ´ng tá»“n táº¡i hoáº·c chÆ°a cĂ´ng khai' });
    }

    await pool.query(
      `INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position)
       SELECT ?, ?, COALESCE(MAX(position), -1) + 1
       FROM playlist_songs
       WHERE playlist_id = ?`,
      [id, song_id, id]
    );

    // Update timestamp
    await pool.query(`UPDATE playlists SET updated_at = NOW() WHERE id = ?`, [id]);

    clearPlaylistCache(userId);
    res.json({ success: true, message: 'Đã thêm bài hát vào playlist' });
  } catch (err) {
    next(err);
  }
};

exports.reorderPlaylistSongs = async (req, res, next) => {
  const conn = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { songIds } = req.body;

    if (!Array.isArray(songIds)) {
      return res.status(400).json({ success: false, message: 'songIds must be an array' });
    }

    const normalizedSongIds = songIds.map(Number);
    if (
      normalizedSongIds.some(songId => !Number.isInteger(songId) || songId <= 0) ||
      new Set(normalizedSongIds).size !== normalizedSongIds.length
    ) {
      return res.status(400).json({ success: false, message: 'Invalid songIds' });
    }

    await conn.beginTransaction();

    const [playlists] = await conn.query(
      `SELECT id, user_id, type, is_system, system_key
       FROM playlists
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    const playlist = playlists[0];
    if (!playlist) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    if (String(playlist.user_id) !== String(userId)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Cannot reorder another user playlist' });
    }

    if (!isManualEditablePlaylist(playlist)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Only manual playlists can be reordered' });
    }

    const [playlistSongs] = await conn.query(
      `SELECT song_id
       FROM playlist_songs
       WHERE playlist_id = ?
       FOR UPDATE`,
      [id]
    );

    const existingIds = playlistSongs.map(row => Number(row.song_id));
    const existingSet = new Set(existingIds);
    const requestedSet = new Set(normalizedSongIds);

    if (
      existingIds.length !== normalizedSongIds.length ||
      existingIds.some(songId => !requestedSet.has(songId)) ||
      normalizedSongIds.some(songId => !existingSet.has(songId))
    ) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'songIds must match every song in the playlist'
      });
    }

    for (let index = 0; index < normalizedSongIds.length; index += 1) {
      await conn.query(
        `UPDATE playlist_songs
         SET position = ?
         WHERE playlist_id = ? AND song_id = ?`,
        [index, id, normalizedSongIds[index]]
      );
    }

    await conn.query(`UPDATE playlists SET updated_at = NOW() WHERE id = ?`, [id]);
    await conn.commit();

    const songs = await getPlaylistSongs(pool, id, userId);
    clearPlaylistCache(userId);
    res.json({ success: true, data: { songs } });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.warn('Rollback reorder playlist failed:', rollbackErr);
    }
    next(err);
  } finally {
    conn.release();
  }
};

exports.removeSongFromPlaylist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    let song_id = req.params.song_id || req.body?.song_id;

    const [playlists] = await pool.query(`SELECT user_id, type, is_system, system_key FROM playlists WHERE id = ?`, [id]);
    if (playlists.length === 0 || String(playlists[0].user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền sửa playlist này' });
    }
    if (playlists[0].is_system === 1 || playlists[0].system_key) {
      return res.status(403).json({ success: false, message: 'Không thể xóa bài hát khỏi playlist hệ thống' });
    }
    if (!isManualEditablePlaylist(playlists[0])) {
      return res.status(403).json({ success: false, message: 'Chỉ có thể chỉnh sửa playlist thủ công' });
    }

    if (typeof song_id === 'object' && song_id !== null) {
      song_id = song_id.id || song_id.song_id || song_id.songId;
    }

    if (!song_id || String(song_id).includes('[object Object]')) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    song_id = normalizeStrictPositiveId(song_id);
    if (!song_id) {
      return res.status(400).json({ success: false, message: 'ID bĂ i hĂ¡t khĂ´ng há»£p lá»‡' });
    }

    await pool.query(`DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`, [id, song_id]);
    clearPlaylistCache(userId);
    res.json({ success: true, message: 'Đã xóa bài hát khỏi playlist' });
  } catch (err) {
    next(err);
  }
};

exports.updatePlaylist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const name = normalizePlaylistText(req.body.name, 255, 'Tên playlist');
    const description = normalizePlaylistText(req.body.description, 1000, 'Mô tả playlist');
    const { is_public } = req.body;

    let playlist = req.playlist;
    if (!playlist) {
      const [playlists] = await pool.query(`SELECT user_id, type, is_system, system_key FROM playlists WHERE id = ?`, [id]);
      playlist = playlists[0];
    }
    if (!playlist || String(playlist.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền sửa playlist này' });
    }
    if (playlist.is_system === 1 || playlist.system_key) {
      return res.status(403).json({ success: false, message: 'Không thể đổi tên/ảnh playlist hệ thống' });
    }
    if (!isManualEditablePlaylist(playlist)) {
      return res.status(403).json({ success: false, message: 'Chỉ có thể chỉnh sửa playlist thủ công' });
    }
    if (name !== undefined && !name) {
      return res.status(400).json({ success: false, message: 'Tên playlist là bắt buộc' });
    }

    let coverUrl = null;
    if (req.files && req.files.cover) {
      coverUrl = '/uploads/images/' + req.files.cover[0].filename;
    }

    let isPublicVal = null;
    if (is_public !== undefined && is_public !== null && is_public !== '') {
      isPublicVal = parsePlaylistVisibility(is_public, null);
    }

    const updateFields = [];
    const queryParams = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      queryParams.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      queryParams.push(description);
    }
    if (isPublicVal !== null) {
      updateFields.push('is_public = ?');
      queryParams.push(isPublicVal);
    }
    if (coverUrl !== null) {
      updateFields.push('cover_url = ?');
      queryParams.push(coverUrl);
    }

    if (updateFields.length > 0) {
      queryParams.push(id);
      await pool.query(
        `UPDATE playlists SET ${updateFields.join(', ')} WHERE id = ?`,
        queryParams
      );
    }

    clearPlaylistCache(userId);
    res.json({ success: true, message: 'Đã cập nhật playlist' });
  } catch (err) {
    next(err);
  }
};

exports.deletePlaylist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [playlists] = await pool.query(`SELECT user_id, type, is_system, system_key FROM playlists WHERE id = ?`, [id]);
    if (playlists.length === 0 || String(playlists[0].user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa playlist này' });
    }
    if (playlists[0].is_system === 1 || playlists[0].system_key) {
      return res.status(403).json({ success: false, message: 'Không thể xóa playlist hệ thống' });
    }
    if (!isUserDeletablePlaylist(playlists[0])) {
      return res.status(403).json({ success: false, message: 'Chỉ có thể xóa playlist thủ công' });
    }

    // Xóa playlist_songs trước để tránh lỗi foreign key (nếu database chưa set CASCADE)
    await pool.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [id]);
    await pool.query(`DELETE FROM ai_playlists WHERE playlist_id = ?`, [id]);
    await pool.query(`DELETE FROM playlists WHERE id = ?`, [id]);

    clearPlaylistCache(userId);
    res.json({ success: true, message: 'Đã xóa playlist' });
  } catch (err) {
    next(err);
  }
};

exports.savePlaylistToLibrary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [playlists] = await pool.query(`SELECT user_id, is_system, type FROM playlists WHERE id = ?`, [id]);
    if (playlists.length === 0) {
      return res.status(404).json({ success: false, message: 'Playlist không tồn tại' });
    }

    await pool.query(
      `INSERT IGNORE INTO user_saved_playlists (user_id, playlist_id, saved_at) VALUES (?, ?, NOW())`,
      [userId, id]
    );

    clearPlaylistCache(userId);
    res.json({ success: true, is_saved: true, message: 'Đã thêm playlist vào thư viện' });
  } catch (err) {
    next(err);
  }
};

exports.removeSavedPlaylistFromLibrary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      `DELETE FROM user_saved_playlists WHERE user_id = ? AND playlist_id = ?`,
      [userId, id]
    );

    clearPlaylistCache(userId);
    res.json({ success: true, is_saved: false, message: 'Đã xóa playlist khỏi thư viện' });
  } catch (err) {
    require('fs').writeFileSync('error_log.txt', err.stack || err.toString());
    next(err);
  }
};

exports.clonePlaylist = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [playlists] = await conn.query(
      `SELECT id, user_id, name, description, cover_url, type, is_system, system_key, is_public FROM playlists WHERE id = ?`,
      [id]
    );

    if (playlists.length === 0) {
      return res.status(404).json({ success: false, message: 'Playlist không tồn tại' });
    }

    const playlist = playlists[0];
    const isOwner = String(playlist.user_id) === String(userId);
    const isSystem = isSystemPlaylistRecord(playlist);
    const isAi = isAiPlaylistRecord(playlist);

    if (isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Không thể tạo bản sao chỉnh sửa cho playlist hệ thống.'
      });
    }

    if (!isOwner && !playlist.is_public && !isAi) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập playlist này' });
    }

    await conn.beginTransaction();

    const newName = playlist.name ? playlist.name + ' (Bản sao)' : 'Playlist (Bản sao)';
    const newDescription = playlist.description || '';

    const [insertResult] = await conn.query(
      `INSERT INTO playlists (user_id, name, description, cover_url, type, is_system, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'manual', 0, 0, NOW(), NOW())`,
      [userId, newName, newDescription, playlist.cover_url]
    );

    const newPlaylistId = insertResult.insertId;

    // Copy songs
    await conn.query(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
       SELECT ?, song_id, position, NOW()
       FROM playlist_songs
       WHERE playlist_id = ?
       ORDER BY position ASC, added_at ASC`,
      [newPlaylistId, id]
    );

    await conn.commit();
    clearPlaylistCache(userId);
    res.json({ success: true, message: 'Đã tạo bản sao playlist', playlist_id: newPlaylistId });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.warn('Rollback clone playlist failed:', rollbackErr);
    }
    next(err);
  } finally {
    conn.release();
  }
};

exports.__test = {
  normalizeStrictPositiveId,
  isManualEditablePlaylist,
};
