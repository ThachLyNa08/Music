const { pool } = require('../config/database');
const notificationService = require('../services/notification.service');
const spotifyService = require('../services/spotify.service');

// Helper: optional authenticate - attaches user if token is valid, allows guest otherwise
function getUserId(req) {
  return req.user ? req.user.id : null;
}

// Helper: normalize search text - bỏ dấu, gạch ngang → space
function normalizeSearchText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/&/g, 'and')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: compact version không space
function compactSearchText(value = '') {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

// Helper: lấy genre key từ query
function getGenreKeyFromQuery(q) {
  const normalized = normalizeSearchText(q);
  const compact = compactSearchText(q);

  const genreRules = [
    { key: 'kpop-gen2', names: ['kpop gen 2', 'kpop gen2', 'kpop-gen2', 'k pop gen 2', 'kpop 2'] },
    { key: 'kpop-gen3', names: ['kpop gen 3', 'kpop gen3', 'kpop-gen3', 'k pop gen 3', 'kpop 3'] },
    { key: 'kpop-gen4', names: ['kpop gen 4', 'kpop gen4', 'kpop-gen4', 'k pop gen 4', 'kpop 4'] },
    { key: 'kpop-gen5', names: ['kpop gen 5', 'kpop gen5', 'kpop-gen5', 'k pop gen 5', 'kpop 5'] },
    { key: 'vpop-mainstream', names: ['vpop mainstream', 'vpop-mainstream', 'vpop ms', 'vpop'] },
    { key: 'vpop-genz', names: ['vpop gen z', 'vpop genz', 'vpop-genz', 'vpop gz'] },
    { key: 'vpop-indie-chill', names: ['vpop indie chill', 'vpop indie', 'vpop chill', 'vpop-indie-chill'] },
    { key: 'vpop-bolero-folk', names: ['vpop bolero folk', 'vpop bolero', 'vpop folk', 'vpop-bolero-folk'] },
    { key: 'vpop-rap-hiphop', names: ['vpop rap hiphop', 'vpop rap', 'vpop hiphop', 'vpop hip hop', 'vpop-rap-hiphop'] },
    { key: 'usuk-pop', names: ['usuk pop', 'us uk pop', 'us-uk pop', 'usuk-pop', 'usuk'] },
    { key: 'usuk-rap', names: ['usuk rap', 'us uk rap', 'us-uk rap', 'usuk-rap'] },
    { key: 'usuk-rnb', names: ['usuk rnb', 'usuk r&b', 'us uk rnb', 'us-uk rnb', 'usuk-rnb'] },
    { key: 'usuk-rock-indie', names: ['usuk rock indie', 'usuk rock', 'usuk indie', 'usuk-rock-indie'] },
    { key: 'usuk-edm', names: ['usuk edm', 'us uk edm', 'us-uk edm', 'usuk-edm', 'edm'] },
  ];

  for (const rule of genreRules) {
    const allNames = [rule.key, ...rule.names];
    for (const name of allNames) {
      if (normalizeSearchText(name) === normalized || compactSearchText(name) === compact) {
        return rule.key;
      }
    }
  }

  return null;
}

// Helper: format song from row
function formatSongRow(row, userId = null) {
  return {
    id: row.id,
    title: row.title,
    duration_sec: row.duration_sec,
    audio_url: row.audio_url,
    cover_url: row.cover_url,
    play_count: row.play_count || 0,
    lyrics: row.lyrics,
    album_id: row.album_id,
    album_title: row.album_title,
    album_cover_url: row.album_cover_url,
    album_release_year: row.album_release_year,
    artist_id: row.artist_id,
    artist_name: row.artist_name,
    artist_avatar_url: row.artist_avatar_url,
    artist_followers: row.artist_followers || 0,
    genre_id: row.genre_id,
    genre_name: row.genre_name,
    is_liked: Boolean(row.is_liked),
    like_count: row.like_count || 0,
  };
}

async function hydrateLikedState(rows, userId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const songIds = rows
    .map((row) => Number(row.id || row.song_id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const likedIds = new Set();

  if (userId && songIds.length > 0) {
    const [likes] = await pool.query(
      'SELECT song_id FROM song_likes WHERE user_id = ? AND song_id IN (?)',
      [userId, songIds]
    );
    likes.forEach((row) => likedIds.add(String(row.song_id)));
  }

  rows.forEach((row) => {
    const id = row.id || row.song_id;
    const liked = likedIds.has(String(id)) || row.is_liked === 1 || row.is_liked === true;
    row.is_liked = liked ? 1 : 0;
    row.isLiked = Boolean(liked);
    row.liked = Boolean(liked);
    row.is_favorite = Boolean(liked);
  });

  return rows;
}

exports.uploadSong = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { title, artist_name, album_title, genre_id, duration_sec } = req.body;
    
    if (!title || !artist_name || !genre_id) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (title, artist_name, genre_id)' });
    }

    if (!req.files || !req.files.audio) {
      return res.status(400).json({ success: false, message: 'Thiếu file âm thanh' });
    }

    const audioUrl = '/uploads/audio/' + req.files.audio[0].filename;
    let coverUrl = null;
    if (req.files.cover) {
      coverUrl = '/uploads/images/' + req.files.cover[0].filename;
    }

    // 1. Tìm hoặc tạo Artist
    let [artists] = await conn.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [artist_name]);
    let artistId;
    let isNewArtist = false;
    if (artists.length === 0) {
      const [artistRes] = await conn.query('INSERT INTO artists (name) VALUES (?)', [artist_name]);
      artistId = artistRes.insertId;
      isNewArtist = true;
    } else {
      artistId = artists[0].id;
    }

    // 2. Tìm hoặc tạo Album
    let albumId = null;
    if (album_title) {
      let [albums] = await conn.query('SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1', [album_title, artistId]);
      if (albums.length === 0) {
        const [albumRes] = await conn.query('INSERT INTO albums (title, artist_id) VALUES (?, ?)', [album_title, artistId]);
        albumId = albumRes.insertId;
      } else {
        albumId = albums[0].id;
      }
    }

    // 3. Tạo Song
    const [songRes] = await conn.query(`
      INSERT INTO songs (title, artist_id, album_id, genre_id, duration_sec, audio_url, cover_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [title, artistId, albumId, genre_id, duration_sec || 0, audioUrl, coverUrl]);

    await conn.commit();

    if (isNewArtist && artistId) {
      const { ensureArtistAvatar } = require('../services/artistImage.service');
      ensureArtistAvatar(artistId).catch(error => {
        console.error("Auto fetch artist avatar in uploadSong failed:", error.message);
      });
    }
    
    // Gửi thông báo cho người theo dõi nghệ sĩ (không phải global)
    try {
      const [followers] = await pool.query(
        'SELECT user_id FROM artist_follows WHERE artist_id = ?',
        [artistId]
      );
      
      if (followers.length > 0) {
        const notificationPromises = followers.map(f => 
          notificationService.createNotification({
            userId: f.user_id,
            title: 'Nghệ sĩ bạn theo dõi vừa ra mắt bài hát mới!',
            message: `Nghệ sĩ ${artist_name} vừa phát hành bài hát mới: ${title}`,
            type: 'new_song',
            link: `/song/${songRes.insertId}`
          })
        );
        await Promise.allSettled(notificationPromises);
      }
    } catch (notiErr) {
      console.error('Lỗi khi gửi thông báo cho người theo dõi:', notiErr);
    }

    // Gửi thông báo global
    try {
      await notificationService.createGlobalNotification({
        title: 'Bài hát mới',
        message: `Bài hát ${title} của ${artist_name} vừa được thêm vào hệ thống!`,
        type: 'new_song',
        link: `/song/${songRes.insertId}`
      });
    } catch (notiErr) {
      console.error('Lỗi khi gửi thông báo global:', notiErr);
    }

    res.json({ success: true, message: 'Upload thành công', song_id: songRes.insertId });

  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.getTrendingSongs = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    let [trending] = await pool.query('SELECT * FROM v_trending_songs_weekly ORDER BY listen_count_week DESC LIMIT 10');
    
    if (trending.length < 10) {
      const [popular] = await pool.query(`
        SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url,
               a.name as artist, a.name as artist_name, g.name as genre
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN genres g ON s.genre_id = g.id
        WHERE s.is_active = TRUE
        ORDER BY s.play_count DESC, s.created_at DESC
        LIMIT 10
      `);
      trending = popular;
    }
    await hydrateLikedState(trending, userId);
    res.json({ success: true, data: trending });
  } catch (err) {
    next(err);
  }
};

exports.searchSongs = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);

    if (!q || q.length < 1) {
      return res.json({ success: true, data: { songs: [], artists: [], albums: [], genres: [] } });
    }

    const searchTerm = `%${q}%`;
    const normalizedQ = normalizeSearchText(q);
    const compactQ = compactSearchText(q);
    const qNoAccent = normalizedQ;
    const searchTermNoAccent = `%${normalizedQ}%`;
    const normalizedCompact = compactQ;
    const searchTermCompact = `%${compactQ}%`;

    // Kiểm tra xem query có phải là genre alias không
    const matchedGenreKey = getGenreKeyFromQuery(q);

    // ── 1. Tìm bài hát (hỗ trợ tiếng Việt có dấu + genre aliases) ──
    let songWhere = `
      s.is_active = TRUE
      AND (
        s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?
        OR s.title LIKE ? OR a.name LIKE ?
    `;
    let songParams = [searchTerm, searchTerm, searchTerm, searchTermNoAccent, searchTermNoAccent];

    if (matchedGenreKey) {
      // Match genre key hoặc genre slug
      songWhere += ` OR g.slug = ? OR g.slug LIKE ? OR g.slug LIKE ?`;
      songParams.push(matchedGenreKey, `%${matchedGenreKey}%`, `%${compactQ}%`);
    }

    songWhere += `)`;

    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.artist_id, s.play_count,
             al.title as album, al.id as album_id,
             a.name as artist, a.name as artist_name, g.name as genre
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE ${songWhere}
      ORDER BY
        CASE
          WHEN s.title LIKE ? OR s.title LIKE ? THEN 1
          WHEN a.name LIKE ? OR a.name LIKE ? THEN 2
          WHEN al.title LIKE ? THEN 3
          ELSE 4
        END,
        s.play_count DESC
      LIMIT ?
    `, [...songParams,
      `${q}%`, `${normalizedQ}%`,
      `${q}%`, `${normalizedQ}%`,
      `${q}%`,
      limit
    ]);

    // ── 2. Tìm nghệ sĩ khớp ──
    const [artists] = await pool.query(`
      SELECT a.id, a.name, a.avatar_url, a.bio,
             COUNT(s.id) as song_count,
             COALESCE(SUM(s.play_count), 0) as total_plays,
             (SELECT s2.cover_url FROM songs s2 WHERE s2.artist_id = a.id AND s2.is_active = TRUE
              ORDER BY s2.play_count DESC LIMIT 1) as sample_cover
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      WHERE a.name LIKE ? OR a.name LIKE ?
      GROUP BY a.id
      ORDER BY
        CASE WHEN a.name LIKE ? OR a.name LIKE ? THEN 0 ELSE 1 END,
        total_plays DESC
      LIMIT 5
    `, [searchTerm, searchTermNoAccent, `${q}%`, `${normalizedQ}%`]);

    // ── 3. Tìm album khớp (có fallback: album cover → first song cover) ──
    let albumWhere = `al.title LIKE ? OR al.title LIKE ? OR a.name LIKE ? OR a.name LIKE ?`;
    let albumParams = [searchTerm, searchTermNoAccent, searchTerm, searchTermNoAccent];

    if (matchedGenreKey) {
      // Match album qua songs thuộc genre
      albumWhere = `( ${albumWhere} ) OR EXISTS (
        SELECT 1 FROM songs s2
        JOIN genres g2 ON s2.genre_id = g2.id
        WHERE s2.album_id = al.id AND s2.is_active = TRUE
        AND (g2.slug = ? OR g2.slug LIKE ?)
      )`;
      albumParams.push(matchedGenreKey, `%${matchedGenreKey}%`);
    }

    const [albums] = await pool.query(`
      SELECT
        al.id,
        al.title,
        COALESCE(
          NULLIF(al.cover_url, ''),
          (
            SELECT NULLIF(s2.cover_url, '')
            FROM songs s2
            WHERE s2.album_id = al.id AND s2.is_active = TRUE
            AND NULLIF(s2.cover_url, '') IS NOT NULL
            ORDER BY s2.id ASC
            LIMIT 1
          )
        ) AS cover_url,
        al.release_date,
        a.id as artist_id,
        a.name as artist_name,
        COUNT(s.id) as track_count
      FROM albums al
      JOIN artists a ON al.artist_id = a.id
      LEFT JOIN songs s ON s.album_id = al.id AND s.is_active = TRUE
      WHERE ${albumWhere}
      GROUP BY al.id, al.title, al.cover_url, al.release_date, a.id, a.name
      ORDER BY
        CASE WHEN al.title LIKE ? OR al.title LIKE ? THEN 0 ELSE 1 END,
        track_count DESC
      LIMIT 6
    `, [...albumParams, `${q}%`, `${normalizedQ}%`]);

    // ── 4. Tìm thể loại khớp (hỗ trợ genre aliases) ──
    let genreWhere = `(g.name LIKE ? OR g.name LIKE ? OR g.slug LIKE ? OR g.slug LIKE ?)`;
    let genreParams = [searchTerm, searchTermNoAccent, searchTerm, searchTermNoAccent];

    if (matchedGenreKey) {
      genreWhere = `( ${genreWhere} OR g.slug = ? OR REPLACE(g.slug, '-', '') = ? OR REPLACE(g.slug, '-', ' ') LIKE ?)`;
      genreParams.push(matchedGenreKey, compactQ, `%${compactQ}%`);
    }

    const [genres] = await pool.query(`
      SELECT g.id, g.name, g.slug,
             COUNT(s.id) as song_count
      FROM genres g
      LEFT JOIN songs s ON s.genre_id = g.id AND s.is_active = TRUE
      WHERE ${genreWhere}
      GROUP BY g.id
      ORDER BY song_count DESC
      LIMIT 4
    `, genreParams);

    await hydrateLikedState(songs, userId);

    res.json({ success: true, data: { songs, artists, albums, genres } });
  } catch (err) {
    next(err);
  }
};

exports.getSuggestions = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();

    if (!q || q.length < 1) {
      // Return popular/trending suggestions when no query
      const [popular] = await pool.query(`
        SELECT a.name as text, 'artist' as type, a.id as artist_id
        FROM artists a
        JOIN songs s ON s.artist_id = a.id
        WHERE s.is_active = TRUE
        GROUP BY a.id, a.name
        ORDER BY MAX(s.play_count) DESC
        LIMIT 8
      `);
      return res.json({ success: true, data: popular });
    }

    const normalizedQ = normalizeSearchText(q);
    const compactQ = compactSearchText(q);
    const searchTerm = `${q}%`;
    const searchTermNoAccent = `${normalizedQ}%`;
    const searchTermContains = `%${q}%`;
    const searchTermContainsNoAccent = `%${normalizedQ}%`;

    // Kiểm tra xem query có phải là genre alias không
    const matchedGenreKey = getGenreKeyFromQuery(q);

    // Get song title suggestions (hỗ trợ genre)
    let songWhere = `s.is_active = TRUE AND (s.title LIKE ? OR s.title LIKE ? OR s.title LIKE ? OR s.title LIKE ?`;
    let songParams = [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent];

    if (matchedGenreKey) {
      songWhere += ` OR g.slug = ? OR g.slug LIKE ?`;
      songParams.push(matchedGenreKey, `%${matchedGenreKey}%`);
    }
    songWhere += `)`;

    const [titleSuggestions] = await pool.query(`
      SELECT s.title as text, 'song' as type, a.name as subtitle, s.artist_id, s.id as song_id
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE ${songWhere}
      ORDER BY
        CASE WHEN s.title LIKE ? OR s.title LIKE ? THEN 0 ELSE 1 END,
        s.play_count DESC
      LIMIT 4
    `, [...songParams, searchTerm, searchTermNoAccent]);

    // Get artist suggestions
    const [artistSuggestions] = await pool.query(`
      SELECT a.name as text, 'artist' as type, NULL as subtitle, a.id as artist_id
      FROM artists a
      JOIN songs s ON s.artist_id = a.id
      WHERE s.is_active = TRUE AND (a.name LIKE ? OR a.name LIKE ? OR a.name LIKE ? OR a.name LIKE ?)
      GROUP BY a.id, a.name
      ORDER BY
        CASE WHEN a.name LIKE ? OR a.name LIKE ? THEN 0 ELSE 1 END
      LIMIT 3
    `, [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent, searchTerm, searchTermNoAccent]);

    // Get album suggestions
    const [albumSuggestions] = await pool.query(`
      SELECT al.title as text, 'album' as type, a.name as subtitle, a.id as artist_id, al.id as album_id
      FROM albums al
      JOIN artists a ON al.artist_id = a.id
      WHERE al.title LIKE ? OR al.title LIKE ? OR al.title LIKE ? OR al.title LIKE ?
      ORDER BY
        CASE WHEN al.title LIKE ? OR al.title LIKE ? THEN 0 ELSE 1 END
      LIMIT 2
    `, [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent, searchTerm, searchTermNoAccent]);

    const suggestions = [...artistSuggestions, ...titleSuggestions, ...albumSuggestions].slice(0, 8);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
};

/**
 * Loại bỏ dấu tiếng Việt để hỗ trợ tìm kiếm không dấu
 * Ví dụ: "Sơn Tùng" → "Son Tung", "Đen Vâu" → "Den Vau"
 */
function removeVietnameseAccents(str) {
  return normalizeSearchText(str);
}

exports.getAllSongs = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.artist_id,
             al.title as album,
             a.name as artist, a.name as artist_name, g.name as genre
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.is_active = TRUE
      ORDER BY s.created_at DESC
    `);
    await hydrateLikedState(songs, userId);
    res.json({ success: true, data: songs });
  } catch (err) {
    next(err);
  }
};

exports.getLikedSongs = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url,
             al.title as album,
             a.name as artist, a.name as artist_name,
             sl.liked_at as dateAdded
      FROM song_likes sl
      JOIN songs s ON sl.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE sl.user_id = ? AND s.is_active = TRUE
      ORDER BY sl.liked_at DESC
    `, [userId]);

    await hydrateLikedState(songs, userId);
    res.json({ success: true, data: songs.map(song => ({
      ...song,
      is_liked: 1,
      isLiked: true,
      liked: true,
      is_favorite: true,
    })) });
  } catch (err) {
    next(err);
  }
};

exports.likeSong = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let songId = req.params.id;

    if (isNaN(songId)) {
      songId = await spotifyService.resolveSpotifyTrack(songId);
    } else {
      songId = Number(songId);
    }

    if (!Number.isInteger(songId) || songId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    const [songs] = await pool.query(
      'SELECT id FROM songs WHERE id = ? AND is_active = TRUE',
      [songId]
    );
    if (songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại' });
    }

    await pool.query(
      'INSERT IGNORE INTO song_likes (user_id, song_id) VALUES (?, ?)',
      [userId, songId]
    );

    res.json({ success: true, message: 'Đã thêm bài hát vào yêu thích' });
  } catch (err) {
    next(err);
  }
};

exports.unlikeSong = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let songId = req.params.id;

    if (isNaN(songId)) {
      songId = await spotifyService.resolveSpotifyTrack(songId);
    } else {
      songId = Number(songId);
    }

    if (!Number.isInteger(songId) || songId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    await pool.query(
      'DELETE FROM song_likes WHERE user_id = ? AND song_id = ?',
      [userId, songId]
    );

    res.json({ success: true, message: 'Đã xóa bài hát khỏi yêu thích' });
  } catch (err) {
    next(err);
  }
};

exports.recordListen = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let songId = req.params.id;
    let { history_id, listen_duration, song_duration, completion_rate, is_completed, is_skipped, skip_at_sec, source, in_progress } = req.body;

    if (isNaN(songId)) {
      songId = await spotifyService.resolveSpotifyTrack(songId);
    } else {
      songId = Number(songId);
    }

    if (!Number.isInteger(songId) || songId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    const [songs] = await pool.query(
      'SELECT id FROM songs WHERE id = ? AND is_active = TRUE',
      [songId]
    );
    if (songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại' });
    }

    const [likes] = await pool.query(
      'SELECT 1 FROM song_likes WHERE user_id = ? AND song_id = ? LIMIT 1',
      [userId, songId]
    );
    const liked = likes.length > 0;

    listen_duration = Number(listen_duration) || 0;
    song_duration = Number(song_duration) || 0;
    
    // Nếu frontend không gửi completion_rate thì backend tự tính
    if (completion_rate === undefined && song_duration > 0) {
      completion_rate = listen_duration / song_duration;
    } else {
      completion_rate = Number(completion_rate) || 0;
    }

    if (is_completed === undefined) {
      is_completed = completion_rate >= 0.8;
    }

    if (is_skipped === undefined) {
      if (skip_at_sec !== undefined && skip_at_sec !== null) {
        is_skipped = true;
      } else {
        is_skipped = listen_duration < 30 && completion_rate < 0.3 && !in_progress;
      }
    }

    // Tính implicit rating theo yêu cầu
    let implicit_rating = 0;
    if (is_completed) implicit_rating = 5.0;
    else if (completion_rate >= 0.6) implicit_rating = 4.0;
    else if (completion_rate >= 0.3) implicit_rating = 3.0;
    else if (is_skipped) implicit_rating = 1.0;
    else if (in_progress) implicit_rating = 2.0; // Tạm thời
    
    if (liked) implicit_rating = Math.min(5.0, implicit_rating + 1.0);

    let finalHistoryId = history_id;

    if (history_id) {
      await pool.query(`
        UPDATE listening_history 
        SET listen_duration = ?, completion_rate = ?, is_completed = ?, is_skipped = ?, implicit_rating = ?
        WHERE id = ? AND user_id = ?
      `, [listen_duration, completion_rate, is_completed, is_skipped, implicit_rating, history_id, userId]);
    } else {
      const [insertRes] = await pool.query(`
        INSERT INTO listening_history (
          user_id, song_id, listen_duration, song_duration, completion_rate,
          is_completed, is_skipped, source, implicit_rating, listened_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        songId,
        listen_duration,
        song_duration,
        completion_rate,
        is_completed,
        is_skipped,
        source || 'unknown',
        implicit_rating
      ]);
      finalHistoryId = insertRes.insertId;
    }

    // Cập nhật play_count bài hát nếu nghe đủ lâu (chỉ cập nhật 1 lần nếu là insert mới hoặc vượt mốc)
    if ((listen_duration >= 30 || completion_rate >= 0.5) && !history_id) {
      await pool.query('UPDATE songs SET play_count = COALESCE(play_count, 0) + 1 WHERE id = ?', [songId]);
    }

    res.json({ 
      success: true, 
      message: 'Đã ghi nhận lịch sử nghe nhạc',
      data: {
        history_id: finalHistoryId,
        implicit_rating,
        completion_rate
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/songs/:id/detail
// Returns full song detail with album, artists, genre, like status
// ─────────────────────────────────────────────
exports.getSongDetail = async (req, res, next) => {
  try {
    const songId = req.params.id;
    const userId = getUserId(req);

    if (isNaN(songId)) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    const [songs] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        s.cover_url,
        s.play_count,
        s.lyrics,
        s.artist_id,
        a.name AS artist_name,
        a.avatar_url AS artist_avatar_url,
        (SELECT COUNT(*) FROM artist_follows af WHERE af.artist_id = a.id) AS artist_followers,
        s.album_id,
        al.title AS album_title,
        al.cover_url AS album_cover_url,
        al.release_date AS album_release_year,
        s.genre_id,
        g.name AS genre_name,
        (SELECT COUNT(*) FROM song_likes sl2 WHERE sl2.song_id = s.id) AS like_count,
        ${userId ? '(SELECT 1 FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ?) AS is_liked' : 'FALSE AS is_liked'}
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.id = ? AND s.is_active = TRUE
    `, userId ? [userId, songId] : [songId]);

    if (songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại' });
    }

    const song = formatSongRow(songs[0], userId);

    // Additional artists (song_artists table if exists)
    let artists = [{
      id: song.artist_id,
      name: song.artist_name,
      avatar_url: song.artist_avatar_url,
      followers_count: song.artist_followers,
      is_following: false,
    }];

    // Check following status for main artist
    if (userId) {
      try {
        const [[followingCheck]] = await pool.query(
          'SELECT 1 FROM artist_follows WHERE user_id = ? AND artist_id = ? LIMIT 1',
          [userId, song.artist_id]
        );
        if (followingCheck) {
          artists[0].is_following = true;
        }
      } catch (err) {
        // Ignore error if table doesn't exist
      }
    }

    // Check if song_artists table exists and has additional artists
    try {
      const [extraArtists] = await pool.query(`
        SELECT a.id, a.name, a.avatar_url,
               (SELECT COUNT(*) FROM artist_follows af WHERE af.artist_id = a.id) AS followers_count
               ${userId ? `, (SELECT 1 FROM artist_follows af WHERE af.artist_id = a.id AND af.user_id = ?) AS is_following` : ', FALSE AS is_following'}
        FROM song_artists sa
        JOIN artists a ON sa.artist_id = a.id
        WHERE sa.song_id = ? AND sa.artist_id != ?
      `, userId ? [userId, songId, song.artist_id] : [songId, song.artist_id]);

      if (extraArtists.length > 0) {
        const extraArtistsMapped = extraArtists.map(a => ({
          id: a.id,
          name: a.name,
          avatar_url: a.avatar_url,
          followers_count: a.followers_count || 0,
          is_following: Boolean(a.is_following),
        }));
        artists = [artists[0], ...extraArtistsMapped];
      }
    } catch (err) {
      // song_artists table may not exist, continue with single artist
    }

    // Get genre info
    const genres = [];
    if (song.genre_id) {
      genres.push({ id: song.genre_id, name: song.genre_name || 'Khác' });
    }

    res.json({
      success: true,
      data: {
        ...song,
        artists,
        genres,
        artist: {
          id: song.artist_id,
          name: song.artist_name,
          avatar_url: song.artist_avatar_url,
          followers_count: song.artist_followers,
          is_following: artists[0]?.is_following || false,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/songs/:id/related
// Returns similar songs based on genre and artist
// ─────────────────────────────────────────────
exports.getRelatedSongs = async (req, res, next) => {
  try {
    const songId = req.params.id;
    const userId = getUserId(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 20);

    if (isNaN(songId)) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }

    const [[currentSong]] = await pool.query(`
      SELECT id, genre_id, artist_id, album_id
      FROM songs
      WHERE id = ? AND is_active = TRUE
    `, [songId]);

    if (!currentSong) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại' });
    }

    const userLikeSelect = userId
      ? ', (SELECT 1 FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ?) AS is_liked'
      : ', FALSE AS is_liked';

    const baseSelect = `
      SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        s.cover_url,
        s.play_count,
        s.artist_id,
        a.name AS artist_name,
        a.avatar_url AS artist_avatar_url,
        s.album_id,
        al.title AS album_title,
        al.title AS album_name,
        al.cover_url AS album_cover_url,
        s.genre_id,
        g.name AS genre_name,
        (SELECT COUNT(*) FROM song_likes sl2 WHERE sl2.song_id = s.id) AS like_count
        ${userLikeSelect}
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
    `;

    const relatedParams = userId ? [userId] : [];
    relatedParams.push(
      Number(songId),
      currentSong.genre_id,
      currentSong.genre_id,
      currentSong.artist_id,
      currentSong.album_id,
      currentSong.album_id,
      currentSong.genre_id,
      currentSong.genre_id,
      currentSong.artist_id,
      currentSong.album_id,
      currentSong.album_id,
      limit
    );

    const [primaryRows] = await pool.query(`
      ${baseSelect}
      WHERE s.is_active = TRUE
        AND s.id != ?
        AND (
          (? IS NOT NULL AND s.genre_id = ?)
          OR s.artist_id = ?
          OR (? IS NOT NULL AND s.album_id = ?)
        )
      ORDER BY
        CASE WHEN ? IS NOT NULL AND s.genre_id = ? THEN 0 ELSE 1 END,
        CASE WHEN s.artist_id = ? THEN 0 ELSE 1 END,
        CASE WHEN ? IS NOT NULL AND s.album_id = ? THEN 0 ELSE 1 END,
        s.play_count DESC,
        RAND()
      LIMIT ?
    `, relatedParams);

    const relatedSongs = [];
    const seenIds = new Set([String(songId)]);

    for (const row of primaryRows) {
      const key = String(row.id);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        relatedSongs.push(row);
      }
    }

    if (relatedSongs.length < limit) {
      const fallbackParams = userId ? [userId] : [];
      fallbackParams.push(Number(songId), limit * 2);

      const [fallbackRows] = await pool.query(`
        ${baseSelect}
        WHERE s.is_active = TRUE
          AND s.id != ?
        ORDER BY s.play_count DESC, s.created_at DESC
        LIMIT ?
      `, fallbackParams);

      for (const row of fallbackRows) {
        const key = String(row.id);
        if (!seenIds.has(key)) {
          seenIds.add(key);
          relatedSongs.push(row);
        }
        if (relatedSongs.length >= limit) break;
      }
    }

    res.json({
      success: true,
      data: relatedSongs.map(row => ({
        id: row.id,
        title: row.title,
        duration_sec: row.duration_sec,
        audio_url: row.audio_url,
        cover_url: row.cover_url || row.album_cover_url,
        play_count: row.play_count || 0,
        artist_id: row.artist_id,
        artist_name: row.artist_name,
        artist_avatar_url: row.artist_avatar_url,
        album_id: row.album_id,
        album_title: row.album_title,
        album_name: row.album_name || row.album_title,
        album_cover_url: row.album_cover_url,
        genre_id: row.genre_id,
        genre_name: row.genre_name,
        like_count: row.like_count || 0,
        is_liked: Boolean(row.is_liked),
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/songs/:id/auto-continue
// Continue playback after the current queue ends: same artist, then same genre, then popular.
exports.getAutoContinueSongs = async (req, res, next) => {
  try {
    const songId = Number(req.params.id);
    const userId = getUserId(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 30);

    if (!Number.isInteger(songId) || songId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bai hat khong hop le' });
    }

    const excludeIds = new Set([String(songId)]);
    const rawExcludeIds = Array.isArray(req.query.excludeIds)
      ? req.query.excludeIds.join(',')
      : (req.query.excludeIds || '');

    rawExcludeIds
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
      .forEach((value) => excludeIds.add(String(value)));

    const [[currentSong]] = await pool.query(`
      SELECT id, genre_id, artist_id, album_id
      FROM songs
      WHERE id = ? AND is_active = TRUE
    `, [songId]);

    if (!currentSong) {
      return res.status(404).json({ success: false, message: 'Bai hat khong ton tai' });
    }

    const requestedArtistId = Number(req.query.artistId);
    const requestedGenreId = Number(req.query.genreId);
    const artistId = Number.isInteger(requestedArtistId) && requestedArtistId > 0
      ? requestedArtistId
      : currentSong.artist_id;
    const genreId = Number.isInteger(requestedGenreId) && requestedGenreId > 0
      ? requestedGenreId
      : currentSong.genre_id;

    const userLikeSelect = userId
      ? ', (SELECT 1 FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ?) AS is_liked'
      : ', FALSE AS is_liked';

    const baseSelect = `
      SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.audio_url,
        s.cover_url,
        s.play_count,
        s.artist_id,
        a.name AS artist_name,
        a.avatar_url AS artist_avatar_url,
        s.album_id,
        al.title AS album_title,
        al.title AS album_name,
        al.cover_url AS album_cover_url,
        s.genre_id,
        g.name AS genre_name,
        (SELECT COUNT(*) FROM song_likes sl2 WHERE sl2.song_id = s.id) AS like_count
        ${userLikeSelect}
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
    `;

    const selectedRows = [];
    const selectedIds = new Set(excludeIds);

    async function fetchCandidates(extraWhere, extraParams, needed) {
      if (needed <= 0) return [];

      const blockedIds = [...selectedIds].map(Number).filter((id) => Number.isInteger(id) && id > 0);
      const notInSql = blockedIds.length
        ? `AND s.id NOT IN (${blockedIds.map(() => '?').join(',')})`
        : '';
      const params = userId ? [userId] : [];
      params.push(...extraParams, ...blockedIds, needed);

      const [rows] = await pool.query(`
        ${baseSelect}
        WHERE s.is_active = TRUE
          ${extraWhere}
          ${notInSql}
        ORDER BY s.play_count DESC, s.created_at DESC, RAND()
        LIMIT ?
      `, params);

      return rows;
    }

    async function addRows(rows) {
      for (const row of rows) {
        const key = String(row.id);
        if (selectedIds.has(key)) continue;
        selectedIds.add(key);
        selectedRows.push(row);
        if (selectedRows.length >= limit) break;
      }
    }

    if (artistId) {
      await addRows(await fetchCandidates('AND s.artist_id = ?', [artistId], limit - selectedRows.length));
    }

    if (genreId && selectedRows.length < limit) {
      await addRows(await fetchCandidates('AND s.genre_id = ?', [genreId], limit - selectedRows.length));
    }

    if (selectedRows.length < limit) {
      await addRows(await fetchCandidates('', [], limit - selectedRows.length));
    }

    const songs = selectedRows.slice(0, limit).map(row => ({
      id: row.id,
      title: row.title,
      duration_sec: row.duration_sec,
      duration: row.duration_sec,
      audio_url: row.audio_url,
      cover_url: row.cover_url || row.album_cover_url,
      play_count: row.play_count || 0,
      artist_id: row.artist_id,
      artist_name: row.artist_name,
      artist_avatar_url: row.artist_avatar_url,
      album_id: row.album_id,
      album_title: row.album_title,
      album_name: row.album_name || row.album_title,
      album_cover_url: row.album_cover_url,
      genre_id: row.genre_id,
      genre_name: row.genre_name,
      like_count: row.like_count || 0,
      is_liked: Boolean(row.is_liked),
    }));

    res.json({
      success: true,
      data: { songs },
    });
  } catch (err) {
    next(err);
  }
};
