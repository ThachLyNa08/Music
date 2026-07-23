const { pool } = require('../config/database');
const { normalizeCoverUrl, resolveArtistAvatar } = require('../utils/imageUrl.util');
const { getArtistTotalPlaysQuery } = require('../utils/artistStats.util');
const { publicSongCondition, publicAlbumCondition } = require('../utils/public.utils');

const popularArtistsCache = new Map();
const POPULAR_ARTISTS_TTL = 300000; // 5 minutes

function parseGenresJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Lấy danh sách tất cả nghệ sĩ
exports.getAllArtists = async (req, res, next) => {
  try {
    const popular = req.query.popular === 'true';
    const limit = parseInt(req.query.limit, 10) || 50;
    const genreIdsParam = req.query.genreIds;
    const marketsParam = req.query.markets;

    let query = `
      SELECT a.id, a.name, a.bio, a.short_bio, a.genres_json, a.country,
             a.popularity, a.followers, a.spotify_artist_id, a.external_url,
             a.avatar_url, a.avatar_source, a.metadata_source, a.metadata_source_url,
             a.metadata_fetched_at,
             COUNT(DISTINCT s.id) as song_count,
             ${getArtistTotalPlaysQuery('a')} as total_plays,
             ${getArtistTotalPlaysQuery('a')} as totalPlays,
             COUNT(DISTINCT af.id) as follower_count
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND ${publicSongCondition('s')}
      LEFT JOIN genres g ON g.id = s.genre_id
      LEFT JOIN artist_follows af ON af.artist_id = a.id
    `;

    let whereConditions = [];
    let queryParams = [];

    if (genreIdsParam) {
      const genreIds = genreIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (genreIds.length > 0) {
        whereConditions.push(`s.genre_id IN (?)`);
        queryParams.push(genreIds);
      }
    }

    if (marketsParam) {
      const marketsList = marketsParam.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
      if (marketsList.length > 0) {
        let marketClauses = [];
        marketsList.forEach(m => {
          if (m === 'VPOP') {
            marketClauses.push(`(a.country = 'VN' OR g.name LIKE '%VPOP%' OR a.genres_json LIKE '%V-Pop%')`);
          } else if (m === 'KPOP') {
            marketClauses.push(`(a.country = 'KR' OR g.name LIKE '%KPOP%' OR a.genres_json LIKE '%K-Pop%')`);
          } else if (m === 'USUK') {
            marketClauses.push(`(a.country IN ('US', 'UK') OR g.name LIKE '%USUK%' OR a.genres_json LIKE '%US-UK%')`);
          } else {
            marketClauses.push(`(g.name LIKE ?)`);
            queryParams.push(`%${m}%`);
          }
        });
        if (marketClauses.length > 0) {
          whereConditions.push(`(${marketClauses.join(' OR ')})`);
        }
      }
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(' AND ');
    }

    query += ` GROUP BY a.id`;

    if (popular) {
      query += ` ORDER BY follower_count DESC, total_plays DESC LIMIT ${limit}`;
    } else {
      query += ` ORDER BY total_plays DESC LIMIT ${limit}`;
    }

    const [artists] = await pool.query(query, queryParams);
    res.json({
      success: true,
      data: artists.map(artist => ({
        ...artist,
        song_count: Number(artist.song_count || 0),
        total_plays: Number(artist.total_plays || 0),
        totalPlays: Number(artist.totalPlays || 0),
        follower_count: Number(artist.follower_count || 0),
        avatar_url: resolveArtistAvatar(artist, req),
        genres: parseGenresJson(artist.genres_json),
      })),
    });
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
      SELECT a.id, a.name, a.bio, a.short_bio, a.genres_json, a.country,
             a.popularity, a.followers, a.spotify_artist_id, a.external_url,
             a.avatar_url, a.avatar_source, a.metadata_source, a.metadata_source_url,
             a.metadata_fetched_at, a.created_at,
             COUNT(DISTINCT s.id) as song_count,
             ${getArtistTotalPlaysQuery('a')} as total_plays,
             ${getArtistTotalPlaysQuery('a')} as totalPlays,
             COUNT(DISTINCT af.id) as follower_count
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND ${publicSongCondition('s')}
      LEFT JOIN artist_follows af ON af.artist_id = a.id
      WHERE a.id = ?
      GROUP BY a.id
    `, [artistId]);

    if (artists.length === 0) {
      return res.status(404).json({ success: false, message: 'Nghệ sĩ không tồn tại' });
    }

    const artist = artists[0];
    artist.genres = parseGenresJson(artist.genres_json);
    artist.avatar_url = resolveArtistAvatar(artist, req);
    artist.song_count = Number(artist.song_count || 0);
    artist.total_plays = Number(artist.total_plays || 0);
    artist.totalPlays = Number(artist.totalPlays || 0);
    artist.follower_count = Number(artist.follower_count || 0);

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
        SUM(CASE WHEN album_type = 'album' AND effective_total_tracks > 1 THEN 1 ELSE 0 END) as album_count,
        SUM(CASE WHEN album_type = 'single' OR (COALESCE(album_type, '') <> 'album' AND effective_total_tracks <= 1) THEN 1 ELSE 0 END) as single_count
      FROM (
        SELECT al.id, al.album_type,
               GREATEST(COALESCE(al.total_tracks, 0), COUNT(s.id)) AS effective_total_tracks
        FROM albums al
        LEFT JOIN songs s ON s.album_id = al.id AND ${publicSongCondition('s')}
        WHERE al.artist_id = ? AND ${publicAlbumCondition('al')}
        GROUP BY al.id, al.album_type, al.total_tracks
      ) album_stats
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
      WHERE s.artist_id = ? AND ${publicSongCondition('s')}
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
      WHERE s.artist_id = ? AND ${publicSongCondition('s')}
      ORDER BY s.play_count DESC, s.created_at DESC
    `, [userId, artistId]);

    // Albums thật
    const [albumRows] = await pool.query(`
      SELECT al.id, al.title, al.release_date, al.album_type,
             GREATEST(COALESCE(al.total_tracks, 0), COUNT(s_count.id)) AS total_tracks,
             COUNT(s_count.id) AS song_count,
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
             ) AS cover_url
      FROM albums al
      LEFT JOIN songs s_count ON s_count.album_id = al.id AND ${publicSongCondition('s_count')}
      WHERE al.artist_id = ? AND ${publicAlbumCondition('al')}
      GROUP BY al.id, al.title, al.release_date, al.created_at, al.album_type, al.total_tracks, al.cover_url
      HAVING al.album_type = 'album' AND total_tracks > 1 AND song_count > 0
      ORDER BY al.release_date DESC, al.created_at DESC
    `, [artistId]);

    const albums = albumRows.map(row => ({
      ...row,
      cover_url: normalizeCoverUrl(row.cover_url, req)
    }));

    // Singles
    const [singleRows] = await pool.query(`
      SELECT al.id, al.title, al.release_date, al.album_type,
             GREATEST(COALESCE(al.total_tracks, 0), COUNT(s_count.id)) AS total_tracks,
             COUNT(s_count.id) AS song_count,
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
             ) AS cover_url
      FROM albums al
      LEFT JOIN songs s_count ON s_count.album_id = al.id AND ${publicSongCondition('s_count')}
      WHERE al.artist_id = ? AND ${publicAlbumCondition('al')}
      GROUP BY al.id, al.title, al.release_date, al.created_at, al.album_type, al.total_tracks, al.cover_url
      HAVING (al.album_type = 'single' OR (COALESCE(al.album_type, '') <> 'album' AND total_tracks <= 1)) AND song_count > 0
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
      WHERE s1.artist_id = ? AND ${publicSongCondition('s1')} AND ${publicSongCondition('s2')}
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
        cover_url: popularSongs[0].cover_url || resolveArtistAvatar(artist, req)
      };
    } else if (albums && albums.length > 0) {
      artistPick = {
        type: 'album',
        id: albums[0].id,
        title: albums[0].title,
        subtitle: `Album mới nhất của ${artist.name}`,
        cover_url: albums[0].cover_url || resolveArtistAvatar(artist, req)
      };
    } else if (singles && singles.length > 0) {
      artistPick = {
        type: 'album',
        id: singles[0].id,
        title: singles[0].title,
        subtitle: `Đĩa đơn mới nhất của ${artist.name}`,
        cover_url: singles[0].cover_url || resolveArtistAvatar(artist, req)
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
        a.id, a.name, a.bio, a.short_bio, a.genres_json, a.country,
        a.popularity, a.followers, a.spotify_artist_id, a.external_url,
        a.avatar_url, a.avatar_source, a.metadata_source, a.metadata_source_url,
        a.metadata_fetched_at,
        COUNT(DISTINCT s.id) as song_count,
        COUNT(DISTINCT af_follower.id) as follower_count,
        af.created_at as followed_at
      FROM artist_follows af
      JOIN artists a ON af.artist_id = a.id
      LEFT JOIN songs s ON s.artist_id = a.id AND ${publicSongCondition('s')}
      LEFT JOIN artist_follows af_follower ON af_follower.artist_id = a.id
      WHERE af.user_id = ?
      GROUP BY a.id
      ORDER BY af.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: artists.map(artist => ({
        ...artist,
        genres: parseGenresJson(artist.genres_json),
      })),
    });
  } catch (err) {
    next(err);
  }
};

// Lấy danh sách nghệ sĩ phổ biến toàn cầu dựa trên listening_history
exports.getPopularArtistsGlobally = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const period = req.query.period || '7d';

    const cacheKey = `popular_artists:limit=${limit}:period=${period}`;
    const cachedData = popularArtistsCache.get(cacheKey);
    const now = Date.now();

    if (cachedData && now - cachedData.timestamp < POPULAR_ARTISTS_TTL) {
      return res.json({ success: true, data: cachedData.data });
    }

    try {
      const dateColumn = 'created_at';

      let timeFilter = '';
      if (period === '7d') {
        timeFilter = `AND lh.${dateColumn} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
      } else if (period === '30d') {
        timeFilter = `AND lh.${dateColumn} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
      } else if (period === 'this_month') {
        timeFilter = `AND lh.${dateColumn} >= DATE_FORMAT(NOW(), '%Y-%m-01')`;
      } else if (period === 'all_time') {
        timeFilter = '';
      }

      const [artists] = await pool.query(`
        WITH ArtistStats AS (
          SELECT
            s.artist_id,
            SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS listen_count,
            COUNT(DISTINCT s.id) AS song_count,
            SUM(lh.listen_duration) AS total_seconds
          FROM listening_history lh
          JOIN songs s ON lh.song_id = s.id
          WHERE 1=1 ${timeFilter}
          GROUP BY s.artist_id
          HAVING listen_count > 0
          ORDER BY listen_count DESC, total_seconds DESC
          LIMIT ?
        )
        SELECT
          a.id,
          a.name,
          a.avatar_url,
          ast.listen_count,
          ast.song_count,
          ast.total_seconds
        FROM ArtistStats ast
        JOIN artists a ON ast.artist_id = a.id
        ORDER BY ast.listen_count DESC, ast.total_seconds DESC
      `, [limit]);

      artists.forEach(a => {
        a.avatar_url = resolveArtistAvatar(a, req);
      });

      popularArtistsCache.set(cacheKey, { timestamp: now, data: artists });

      return res.json({
        success: true,
        data: artists
      });
    } catch (dbError) {
      if (cachedData) {
        console.warn('DB query failed, serving stale popular artists cache:', dbError);
        return res.json({ success: true, data: cachedData.data });
      }
      throw dbError;
    }
  } catch (err) {
    next(err);
  }
};

// Endpoint siêu nhẹ phục vụ riêng cho Onboarding
exports.getOnboardingArtists = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 24;
    const genreIdsParam = req.query.genreIds;
    const marketsParam = req.query.markets;

    let query = `
      SELECT a.id, a.name, a.avatar_url, a.country, a.genres_json, a.followers
      FROM artists a
    `;

    let joins = [];
    let whereConditions = [];
    let queryParams = [];

    if (genreIdsParam) {
      const genreIds = genreIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (genreIds.length > 0) {
        joins.push(`JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE`);
        whereConditions.push(`s.genre_id IN (?)`);
        queryParams.push(genreIds);
      }
    } else if (marketsParam) {
      const marketsList = marketsParam.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
      if (marketsList.length > 0) {
        let marketClauses = [];
        let joinGenres = false;
        marketsList.forEach(m => {
          if (m === 'VPOP') {
            marketClauses.push(`(a.country = 'VN' OR g.name LIKE '%VPOP%' OR a.genres_json LIKE '%V-Pop%')`);
            joinGenres = true;
          } else if (m === 'KPOP') {
            marketClauses.push(`(a.country = 'KR' OR g.name LIKE '%KPOP%' OR a.genres_json LIKE '%K-Pop%')`);
            joinGenres = true;
          } else if (m === 'USUK') {
            marketClauses.push(`(a.country IN ('US', 'UK') OR g.name LIKE '%USUK%' OR a.genres_json LIKE '%US-UK%')`);
            joinGenres = true;
          } else {
            marketClauses.push(`(g.name LIKE ?)`);
            queryParams.push(`%${m}%`);
            joinGenres = true;
          }
        });

        if (joinGenres) {
          joins.push(`LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE`);
          joins.push(`LEFT JOIN genres g ON g.id = s.genre_id`);
        }

        if (marketClauses.length > 0) {
          whereConditions.push(`(${marketClauses.join(' OR ')})`);
        }
      }
    }

    if (joins.length > 0) {
      query += ` ` + [...new Set(joins)].join(' ');
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(' AND ');
    }

    // Luôn GROUP BY để tránh trùng lặp khi JOIN
    query += ` GROUP BY a.id`;

    // Sắp xếp nhanh: a.followers là field tĩnh có sẵn hoặc a.popularity
    query += ` ORDER BY a.followers DESC, a.name ASC LIMIT ?`;
    queryParams.push(limit);

    const [artists] = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: artists.map(artist => ({
        ...artist,
        avatar_url: resolveArtistAvatar(artist, req),
        genres: parseGenresJson(artist.genres_json)
      })),
    });
  } catch (err) {
    next(err);
  }
};
