const { pool } = require('../config/database');
const notificationService = require('../services/notification.service');
const spotifyService = require('../services/spotify.service');
const recommendationService = require('../services/recommendation.service');
const { computeTempoMatchScore } = require('../utils/tempoFeature.util');
const { resolveArtistAvatar } = require('../utils/imageUrl.util');
const {
  publicSongCondition,
  publicAlbumCondition,
  normalizeReleasePayload,
  pushReleaseFields,
  buildInsertParts,
} = require('../utils/public.utils');

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
  const syncedLyrics = row.syncedLyrics ?? row.synced_lyrics ?? null
  const lyricsSyncType = row.lyricsSyncType ?? row.lyrics_sync_type ?? null
  const lyricsProvider = row.lyricsProvider ?? row.lyrics_provider ?? null
  const lyricsProviderId = row.lyricsProviderId ?? row.lyrics_provider_id ?? null
  const hasSyncedLyrics = Boolean(typeof syncedLyrics === 'string' && syncedLyrics.includes('[00:'))

  // Ensure play_count is at least like_count for display consistency when historical data is missing or unbalanced
  const rawPlayCount = Number(row.play_count) || 0;
  const rawLikeCount = Number(row.like_count) || 0;
  const displayPlayCount = Math.max(rawPlayCount, rawLikeCount);

  return {
    id: row.id,
    title: row.title,
    duration_sec: row.duration_sec,
    audio_url: row.audio_url,
    cover_url: row.cover_url,
    play_count: displayPlayCount,
    listen_count: displayPlayCount,
    lyrics: row.lyrics,
    syncedLyrics,
    synced_lyrics: syncedLyrics,
    lyricsSyncType,
    lyrics_sync_type: lyricsSyncType,
    lyricsProvider,
    lyrics_provider: lyricsProvider,
    lyricsProviderId,
    lyrics_provider_id: lyricsProviderId,
    hasSyncedLyrics,
    lyrics_updated_at: row.lyrics_updated_at || null,
    album_id: row.album_id,
    album_title: row.album_title,
    album_cover_url: row.album_cover_url,
    album_release_year: row.album_release_year,
    artist_id: row.artist_id,
    artist_name: row.artist_name,
    artist_avatar_url: resolveArtistAvatar({ id: row.artist_id, name: row.artist_name, avatar_url: row.artist_avatar_url }, null),
    artist_followers: row.artist_followers || 0,
    genre_id: row.genre_id,
    genre_name: row.genre_name,
    is_liked: Boolean(row.is_liked),
    like_count: rawLikeCount,
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
    const releasePayload = normalizeReleasePayload(req.body, { defaultStatus: 'published', isCreate: true });

    const missing = [];
    if (!title) missing.push('title');
    if (!artist_name) missing.push('artist_name');
    if (!genre_id) missing.push('genre_id');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        missing,
        message: 'Thiếu thông tin bắt buộc'
      });
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
    const fields = ['title', 'artist_id', 'album_id', 'genre_id', 'duration_sec', 'audio_url', 'cover_url'];
    const values = [title, artistId, albumId, genre_id, duration_sec || 0, audioUrl, coverUrl];
    pushReleaseFields(fields, values, releasePayload, null);
    const insertParts = buildInsertParts(fields, values);
    const [songRes] = await conn.query(
      `INSERT INTO songs (${insertParts.columnSql}) VALUES (${insertParts.placeholderSql})`,
      insertParts.params
    );

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
    let [trending] = await pool.query('SELECT v.*, v.listen_count_week AS weekly_plays FROM v_trending_songs_weekly v ORDER BY v.listen_count_week DESC LIMIT 10');

    if (trending.length < 10) {
      const [popular] = await pool.query(`
        SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url,
               s.play_count, 0 AS weekly_plays,
               a.name as artist, a.name as artist_name, g.name as genre
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN genres g ON s.genre_id = g.id
        WHERE ${publicSongCondition('s')}
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

exports.getRecommendedSongs = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    let recommended = [];

    if (userId) {
      const [follows] = await pool.query('SELECT artist_id FROM artist_follows WHERE user_id = ?', [userId]);
      const [prefs] = await pool.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [userId]);
      const idSet = new Set([...follows.map(r => r.artist_id), ...prefs.map(r => r.artist_id)]);
      const followedArtistIds = Array.from(idSet).length > 0 ? Array.from(idSet) : [0];

      const [prefGenres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [userId]);
      const genreIds = prefGenres.map(g => g.genre_id).length > 0 ? prefGenres.map(g => g.genre_id) : [0];

      const [songs] = await pool.query(`
        SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url,
               a.name as artist, a.name as artist_name, g.name as genre,
               CASE WHEN s.artist_id IN (?) THEN 2 ELSE 0 END +
               CASE WHEN s.genre_id IN (?) THEN 1 ELSE 0 END as match_score
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN genres g ON s.genre_id = g.id
        WHERE ${publicSongCondition('s')}
        ORDER BY match_score DESC, s.play_count DESC, RAND()
        LIMIT 30
      `, [followedArtistIds, genreIds]);

      recommended = songs;
    }

    if (recommended.length === 0) {
      const [popular] = await pool.query(`
        SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url,
               a.name as artist, a.name as artist_name, g.name as genre
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN genres g ON s.genre_id = g.id
        WHERE ${publicSongCondition('s')}
        ORDER BY s.play_count DESC, RAND()
        LIMIT 30
      `);
      recommended = popular;
    }

    await hydrateLikedState(recommended, userId);
    res.json({ success: true, data: recommended });
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
      ${publicSongCondition('s')}
      AND (
        s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?
        OR s.title LIKE ? OR a.name LIKE ?
        OR s.lyrics LIKE ? OR s.lyrics LIKE ?
    `;
    let songParams = [searchTerm, searchTerm, searchTerm, searchTermNoAccent, searchTermNoAccent, searchTerm, searchTermNoAccent];

    if (matchedGenreKey) {
      songWhere += ` OR g.slug = ? OR g.slug LIKE ? OR g.slug LIKE ?`;
      songParams.push(matchedGenreKey, `%${matchedGenreKey}%`, `%${compactQ}%`);
    }

    songWhere += `)`;

    const [rows] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.artist_id, s.play_count, s.lyrics,
             al.title as album, al.id as album_id,
             a.name as artist, a.name as artist_name, a.avatar_url as artist_avatar, g.name as genre
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE ${songWhere}
      LIMIT 100
    `, songParams);

    const scoredSongs = rows.map(row => {
      let score = 0;
      let matchType = 'semantic';
      let matchedSnippet = null;
      let matchedField = null;

      const normTitle = normalizeSearchText(row.title);
      const normQuery = normalizedQ;
      const normArtist = normalizeSearchText(row.artist_name);
      const normAlbum = normalizeSearchText(row.album || '');
      const cleanLyrics = (row.lyrics || '').replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, ' ').replace(/\s+/g, ' ').trim();
      const normLyrics = normalizeSearchText(cleanLyrics);

      if (normTitle === normQuery) {
        score += 120;
        matchType = 'title';
        matchedField = 'title';
      } else if (normTitle.includes(normQuery)) {
        score += 90;
        matchType = 'title';
        matchedField = 'title';
      } else if (normArtist === normQuery || normArtist.includes(normQuery)) {
        score += 80;
        matchType = 'artist';
        matchedField = 'artist';
      } else if (normAlbum && normAlbum.includes(normQuery)) {
        score += 50;
        matchType = 'album';
        matchedField = 'album';
      } else if (normLyrics.includes(normQuery)) {
        score += 45;
        matchType = 'lyrics';
        matchedField = 'lyrics';
        const idx = normLyrics.indexOf(normQuery);
        const start = Math.max(0, idx - 60);
        const end = Math.min(cleanLyrics.length, idx + normQuery.length + 60);
        matchedSnippet = cleanLyrics.substring(start, end).trim();
        if (start > 0) matchedSnippet = '... ' + matchedSnippet;
        if (end < cleanLyrics.length) matchedSnippet = matchedSnippet + ' ...';
      } else {
        const queryTokens = normQuery.split(' ').filter(x => x.length >= 2);
        if (queryTokens.length > 0) {
          const lyricsTokens = new Set(normLyrics.split(' '));
          const matchCount = queryTokens.filter(t => lyricsTokens.has(t)).length;
          if (matchCount === queryTokens.length) {
             score += 30;
             matchType = 'lyrics';
             matchedField = 'lyrics';
          } else if (matchCount > 0) {
             score += 10;
             matchType = 'lyrics';
             matchedField = 'lyrics';
          }
        }
      }

      score += Math.min(Number(row.play_count) || 0, 1000000) / 100000 * 10;

      return {
         ...row,
         _score: score,
         matchType,
         matchedSnippet,
         matchedField
      };
    });

    const songs = scoredSongs
      .filter(s => s._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(row => {
         delete row._score;
         delete row.lyrics;
         return row;
      });

    // ── 2. Tìm nghệ sĩ khớp ──
    const [artists] = await pool.query(`
      SELECT a.id, a.name, a.avatar_url, a.bio,
             COUNT(s.id) as song_count,
             COALESCE(SUM(s.play_count), 0) as total_plays,
             (SELECT s2.cover_url FROM songs s2 WHERE s2.artist_id = a.id AND ${publicSongCondition('s2')}
              ORDER BY s2.play_count DESC LIMIT 1) as sample_cover
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND ${publicSongCondition('s')}
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
        WHERE s2.album_id = al.id AND ${publicSongCondition('s2')}
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
            WHERE s2.album_id = al.id AND ${publicSongCondition('s2')}
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
      LEFT JOIN songs s ON s.album_id = al.id AND ${publicSongCondition('s')}
      WHERE (${albumWhere}) AND ${publicAlbumCondition('al')}
      GROUP BY al.id, al.title, al.cover_url, al.release_date, a.id, a.name
      HAVING track_count > 0
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
      LEFT JOIN songs s ON s.genre_id = g.id AND ${publicSongCondition('s')}
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
        SELECT a.id, a.name as text, 'artist' as type, a.avatar_url
        FROM artists a
        JOIN songs s ON s.artist_id = a.id
        WHERE ${publicSongCondition('s')}
        GROUP BY a.id, a.name, a.avatar_url
        ORDER BY MAX(s.play_count) DESC
        LIMIT 8
      `);
      const normalizedPopular = popular.map(item => ({
        id: item.id,
        type: item.type,
        text: item.text,
        subtitle: null,
        imageUrl: item.avatar_url || null
      }));
      return res.json({ success: true, data: normalizedPopular });
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
    let songWhere = `${publicSongCondition('s')} AND (s.title LIKE ? OR s.title LIKE ? OR s.title LIKE ? OR s.title LIKE ?`;
    let songParams = [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent];

    if (matchedGenreKey) {
      songWhere += ` OR g.slug = ? OR g.slug LIKE ?`;
      songParams.push(matchedGenreKey, `%${matchedGenreKey}%`);
    }
    songWhere += `)`;

    const [titleSuggestions] = await pool.query(`
      SELECT s.id, s.title as text, 'song' as type, a.name as subtitle, s.cover_url, al.cover_url as album_cover
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE ${songWhere}
      ORDER BY
        CASE WHEN s.title LIKE ? OR s.title LIKE ? THEN 0 ELSE 1 END,
        s.play_count DESC
      LIMIT 4
    `, [...songParams, searchTerm, searchTermNoAccent]);

    // Get artist suggestions
    const [artistSuggestions] = await pool.query(`
      SELECT a.id, a.name as text, 'artist' as type, NULL as subtitle, a.avatar_url
      FROM artists a
      JOIN songs s ON s.artist_id = a.id
      WHERE ${publicSongCondition('s')} AND (a.name LIKE ? OR a.name LIKE ? OR a.name LIKE ? OR a.name LIKE ?)
      GROUP BY a.id, a.name, a.avatar_url
      ORDER BY
        CASE WHEN a.name LIKE ? OR a.name LIKE ? THEN 0 ELSE 1 END
      LIMIT 3
    `, [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent, searchTerm, searchTermNoAccent]);

    // Get album suggestions
    const [albumSuggestions] = await pool.query(`
      SELECT al.id, al.title as text, 'album' as type, a.name as subtitle, al.cover_url
      FROM albums al
      JOIN artists a ON al.artist_id = a.id
      WHERE ${publicAlbumCondition('al')}
        AND EXISTS (SELECT 1 FROM songs s WHERE s.album_id = al.id AND ${publicSongCondition('s')})
        AND (al.title LIKE ? OR al.title LIKE ? OR al.title LIKE ? OR al.title LIKE ?)
      ORDER BY
        CASE WHEN al.title LIKE ? OR al.title LIKE ? THEN 0 ELSE 1 END
      LIMIT 2
    `, [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent, searchTerm, searchTermNoAccent]);

    // Get playlist suggestions (Optional, wrapped in try/catch to prevent breaking main suggestions)
    let playlistSuggestions = [];
    try {
      const reqUserId = req.user?.id || null;
      const plWhere = reqUserId
          ? `(p.is_public = 1 OR p.is_system = 1 OR p.user_id = ${pool.escape(reqUserId)})`
          : `(p.is_public = 1 OR p.is_system = 1)`;

      const [pResult] = await pool.query(`
        SELECT p.id, p.name as text, 'playlist' as type, 'Playlist' as subtitle, p.cover_url
        FROM playlists p
        WHERE ${plWhere} AND (p.name LIKE ? OR p.name LIKE ? OR p.name LIKE ? OR p.name LIKE ?)
        ORDER BY
          CASE WHEN p.name LIKE ? OR p.name LIKE ? THEN 0 ELSE 1 END
        LIMIT 2
      `, [searchTerm, searchTermNoAccent, searchTermContains, searchTermContainsNoAccent, searchTerm, searchTermNoAccent]);

      playlistSuggestions = pResult;
    } catch (plErr) {
      console.warn('Playlist suggestion warning:', plErr);
    }

    const rawSuggestions = [...artistSuggestions, ...titleSuggestions, ...albumSuggestions, ...playlistSuggestions];

    const suggestions = rawSuggestions.map(item => {
      let imageUrl = null;
      if (item.type === 'song') {
        imageUrl = item.cover_url || item.album_cover || null;
      } else if (item.type === 'artist') {
        imageUrl = item.avatar_url || item.image_url || null;
      } else if (item.type === 'album') {
        imageUrl = item.cover_url || item.image_url || null;
      } else if (item.type === 'playlist') {
        imageUrl = item.cover_url || item.image_url || null;
      }

      return {
        id: item.id,
        type: item.type,
        text: item.text,
        subtitle: item.subtitle || null,
        imageUrl: imageUrl,
        targetUrl: `/${item.type}/${item.id}`
      };
    });

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
      WHERE ${publicSongCondition('s')}
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
             al.title as album, s.album_id,
             a.name as artist, a.name as artist_name, s.artist_id,
             sl.liked_at as dateAdded
      FROM song_likes sl
      JOIN songs s ON sl.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE sl.user_id = ? AND ${publicSongCondition('s')}
      ORDER BY sl.liked_at DESC
    `, [userId]);

    await hydrateLikedState(songs, userId);
    const items = songs.map(song => ({
      ...song,
      is_liked: 1,
      isLiked: true,
      liked: true,
      is_favorite: true,
    }));
    res.json({
      success: true,
      data: items,
      items,
      ids: items.map(song => song.id)
    });
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
      `SELECT id FROM songs WHERE id = ? AND ${publicSongCondition('songs')}`,
      [songId]
    );
    if (songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại' });
    }

    await pool.query(
      'INSERT IGNORE INTO song_likes (user_id, song_id) VALUES (?, ?)',
      [userId, songId]
    );

    const [[likeCountRow]] = await pool.query(
      'SELECT COUNT(*) AS likeCount FROM song_likes WHERE song_id = ?',
      [songId]
    );

    const likeCount = Number(likeCountRow?.likeCount || 0);
    res.json({
      success: true,
      message: 'Đã thêm bài hát vào yêu thích',
      songId,
      liked: true,
      likeCount,
      data: { songId, liked: true, likeCount }
    });
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

    const [songs] = await pool.query(
      `SELECT id FROM songs WHERE id = ? AND ${publicSongCondition('songs')}`,
      [songId]
    );
    if (songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại' });
    }

    await pool.query(
      'DELETE FROM song_likes WHERE user_id = ? AND song_id = ?',
      [userId, songId]
    );

    const [[likeCountRow]] = await pool.query(
      'SELECT COUNT(*) AS likeCount FROM song_likes WHERE song_id = ?',
      [songId]
    );

    const likeCount = Number(likeCountRow?.likeCount || 0);
    res.json({
      success: true,
      message: 'Đã xóa bài hát khỏi yêu thích',
      songId,
      liked: false,
      likeCount,
      data: { songId, liked: false, likeCount }
    });
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
      `SELECT id FROM songs WHERE id = ? AND ${publicSongCondition('songs')}`,
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
    let shouldIncrementPlayCount = false;

    if (history_id) {
      // Lấy lịch sử cũ để kiểm tra xem đã qua ngưỡng chưa
      const [oldHistory] = await pool.query('SELECT listen_duration, completion_rate FROM listening_history WHERE id = ? AND user_id = ?', [history_id, userId]);
      if (oldHistory.length > 0) {
        const oldDur = oldHistory[0].listen_duration || 0;
        const oldComp = oldHistory[0].completion_rate || 0;
        // Nếu lúc trước CHƯA qua ngưỡng, nhưng bây giờ ĐÃ qua ngưỡng
        if ((oldDur < 30 && oldComp < 0.5) && (listen_duration >= 30 || completion_rate >= 0.5)) {
          shouldIncrementPlayCount = true;
        }
      }

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

      if (listen_duration >= 30 || completion_rate >= 0.5) {
        shouldIncrementPlayCount = true;
      }
    }

    // Cập nhật play_count bài hát nếu vượt mốc hợp lệ
    if (shouldIncrementPlayCount) {
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
        s.synced_lyrics,
        s.lyrics_sync_type,
        s.lyrics_provider,
        s.lyrics_provider_id,
        s.lyrics_updated_at,
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
      WHERE s.id = ? AND ${publicSongCondition('s')}
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
      WHERE id = ? AND ${publicSongCondition('songs')}
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
      WHERE ${publicSongCondition('s')}
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
        WHERE ${publicSongCondition('s')}
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

    try {
      const featureMap = await recommendationService.fetchAudioFeaturesForSongs([
        Number(songId),
        ...relatedSongs.map((row) => row.id),
      ]);
      const seedFeature = featureMap.get(Number(songId));
      if (seedFeature) {
        relatedSongs.sort((a, b) => {
          const fa = featureMap.get(Number(a.id));
          const fb = featureMap.get(Number(b.id));
          const scoreFeature = (row, feature) => {
            if (!feature) return 0.5;
            const tempo = computeTempoMatchScore(feature, { tempoBucket: seedFeature.tempo_bucket });
            const energyDistance = Math.abs(Number(feature.energy_score ?? 0.5) - Number(seedFeature.energy_score ?? 0.5));
            const danceDistance = Math.abs(Number(feature.danceability_score ?? 0.5) - Number(seedFeature.danceability_score ?? 0.5));
            const brightnessDistance = Math.abs(Number(feature.brightness_score ?? 0.5) - Number(seedFeature.brightness_score ?? 0.5));
            const audioSimilarity = tempo * 0.45
              + Math.max(0, 1 - energyDistance) * 0.25
              + Math.max(0, 1 - danceDistance) * 0.20
              + Math.max(0, 1 - brightnessDistance) * 0.10;
            const metadataSimilarity = (row.genre_id === currentSong.genre_id ? 0.25 : 0)
              + (row.artist_id === currentSong.artist_id ? 0.25 : 0)
              + (row.album_id && row.album_id === currentSong.album_id ? 0.1 : 0);
            return audioSimilarity * 0.6 + metadataSimilarity;
          };
          return scoreFeature(b, fb) - scoreFeature(a, fa);
        });
      }
    } catch (audioSimilarityErr) {
      console.warn('[RelatedSongs] audio similarity skipped:', audioSimilarityErr.message);
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
        artist_avatar_url: resolveArtistAvatar({ id: row.artist_id, name: row.artist_name, avatar_url: row.artist_avatar_url }, req),
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
      WHERE id = ? AND ${publicSongCondition('songs')}
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
    const artistCounts = {};

    async function fetchCandidates(extraWhere, extraParams, fetchLimit) {
      if (fetchLimit <= 0) return [];

      const blockedIds = [...selectedIds].map(Number).filter((id) => Number.isInteger(id) && id > 0);
      const notInSql = blockedIds.length
        ? `AND s.id NOT IN (${blockedIds.map(() => '?').join(',')})`
        : '';
      const params = userId ? [userId] : [];
      params.push(...extraParams, ...blockedIds, fetchLimit);

      const [rows] = await pool.query(`
        ${baseSelect}
        WHERE ${publicSongCondition('s')}
          ${extraWhere}
          ${notInSql}
        ORDER BY RAND()
        LIMIT ?
      `, params);

      return rows;
    }

    function addRows(rows) {
      for (const row of rows) {
        if (selectedRows.length >= limit) break;
        const key = String(row.id);
        const aId = String(row.artist_id);

        if (selectedIds.has(key)) continue;

        const count = artistCounts[aId] || 0;
        if (count >= 2) continue; // Bắt buộc: đa dạng nghệ sĩ (tối đa 2 bài / 1 nghệ sĩ)

        selectedIds.add(key);
        selectedRows.push(row);
        artistCounts[aId] = count + 1;
      }
    }

    // 1. Ưu tiên cùng thể loại (lấy dư dả để lọc artist)
    if (genreId) {
      addRows(await fetchCandidates('AND s.genre_id = ?', [genreId], limit * 4));
    }

    // 2. Nếu thiếu, fallback lấy ngẫu nhiên các bài khác
    if (selectedRows.length < limit) {
      addRows(await fetchCandidates('', [], limit * 2));
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
      artist_avatar_url: resolveArtistAvatar({ id: row.artist_id, name: row.artist_name, avatar_url: row.artist_avatar_url }, req),
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
