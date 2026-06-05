const { pool } = require('../config/database');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const {
  SYSTEM_PLAYLIST_BY_KEY,
  MADE_FOR_YOU_ORDER,
  RECOMMENDED_TODAY_ORDER
} = require('../services/systemPlaylist.service');

function getPlaylistUniqueKey(item) {
  return item.system_key || item.id || item.playlist_id || item.name;
}

function uniqueByPlaylist(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = getPlaylistUniqueKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSystemPlaylistConfig(systemKey) {
  const playlist = SYSTEM_PLAYLIST_BY_KEY[systemKey];
  if (!playlist) {
    throw new Error(`Missing system playlist config: ${systemKey}`);
  }
  return playlist;
}

async function getOrCreateSystemPlaylist(conn, userId, playlistConfig, songQuery, queryParams) {
  let systemKey;
  let name;
  let description;

  if (typeof playlistConfig === 'string') {
    systemKey = arguments[8];
    const configuredPlaylist = SYSTEM_PLAYLIST_BY_KEY[systemKey];
    name = configuredPlaylist?.name || arguments[3];
    description = configuredPlaylist?.description || arguments[5];
    songQuery = arguments[6];
    queryParams = arguments[7];
  } else {
    systemKey = playlistConfig.system_key;
    name = playlistConfig.name;
    description = playlistConfig.description;
  }

  const coverUrl = resolvePlaylistCoverUrl(systemKey);

  console.log('[ENSURE PLAYLIST]', {
    userId,
    name,
    system_key: systemKey,
    type: 'system',
    cover_url: coverUrl
  });
  // Check if playlist already exists by system_key to avoid UNIQUE constraint violation
  const [playlists] = await conn.query(
    'SELECT id, type FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1',
    [userId, systemKey]
  );
  
  let playlistId;
  let shouldPopulate = false;
  if (playlists.length === 0) {
    const [result] = await conn.query(
      `INSERT INTO playlists (user_id, name, cover_url, description, type, is_public, system_key, is_system)
       VALUES (?, ?, ?, ?, 'system', 0, ?, 1)`,
      [userId, name, coverUrl, description, systemKey]
    );
    playlistId = result.insertId;
    shouldPopulate = true;
  } else {
    playlistId = playlists[0].id;
    // Cập nhật lại cover_url, type và name nếu cần thiết
    await conn.query(
      `UPDATE playlists
       SET cover_url = ?, type = 'system', name = ?, description = ?, is_system = 1
       WHERE id = ?`,
      [coverUrl, name, description, playlistId]
    );
    
    // Check if empty
    const [songs] = await conn.query('SELECT 1 FROM playlist_songs WHERE playlist_id = ? LIMIT 1', [playlistId]);
    if (songs.length === 0) {
      shouldPopulate = true;
    }
  }
  
  if (shouldPopulate) {
    // Get songs to populate
    const [songs] = await conn.query(songQuery, queryParams);
    if (songs.length > 0) {
      const values = songs.map(s => [playlistId, s.id]);
      await conn.query('INSERT IGNORE INTO playlist_songs (playlist_id, song_id) VALUES ?', [values]);
    }
  }
  
  return playlistId;
}

// Lấy danh sách artist_id mà user đã quan tâm (từ follows và preferences)
async function getFollowedArtistIds(conn, userId) {
  try {
    const [follows] = await conn.query('SELECT artist_id FROM artist_follows WHERE user_id = ?', [userId]);
    const [prefs] = await conn.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [userId]);
    
    const idSet = new Set([...follows.map(r => r.artist_id), ...prefs.map(r => r.artist_id)]);
    const ids = Array.from(idSet);
    return ids.length > 0 ? ids : [0]; // Tránh lỗi SQL Syntax khi mảng rỗng
  } catch (e) {
    return [0];
  }
}

exports.getHomeRecommendations = async (req, res, next) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 0. Lấy danh sách nghệ sĩ user đã follow
    const followedArtistIds = await getFollowedArtistIds(conn, userId);
    const [systemUsers] = await conn.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
    const globalSystemUserId = systemUsers[0]?.id || userId;

    // 1. Fetch user preferred genres to personalize the Weekly Mix
    const [prefGenres] = await conn.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [userId]);
    let weeklySongQuery, weeklyQueryParams;
    
    if (prefGenres.length > 0) {
      const genreIds = prefGenres.map(g => g.genre_id);
      // Ưu tiên bài từ nghệ sĩ đã follow
      weeklySongQuery = `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (?)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 30
      `;
      weeklyQueryParams = [followedArtistIds, genreIds];
    } else {
      // Không có genre preferences, ưu tiên followed artists
      weeklySongQuery = `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY is_followed_bonus DESC, RAND() 
        LIMIT 30
      `;
      weeklyQueryParams = [followedArtistIds];
    }

    // 2. Ensure all Spotify-like playlists exist for this user
    
    // Weekly Mix - Ưu tiên followed artists + genre preferences
    const weeklyId = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Weekly Mix',
      resolvePlaylistCoverUrl('weeklymix'),
      'Gợi ý âm nhạc hàng tuần được cá nhân hóa dựa trên gu của bạn.',
      weeklySongQuery, weeklyQueryParams,
      'weeklymix'
    );

    // Morning Mix (EDM, Pop, Rock, Indie) - Ưu tiên followed artists
    const morningId = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Morning Mix',
      resolvePlaylistCoverUrl('morning_vibes'),
      'Chào ngày mới với những giai điệu đầy hứng khởi.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (3, 4, 7, 8, 12)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'morning_vibes'
    );

    // Evening Mix (Lofi, Jazz, Ballad, Classical) - Ưu tiên followed artists
    const eveningId = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Evening Mix',
      resolvePlaylistCoverUrl('night_vibes'),
      'Thư giãn cuối ngày với những âm điệu êm dịu.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (1, 2, 6, 9)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'night_vibes'
    );

    // Daily Mix 1 (Pop, R&B, K-pop, V-pop) - Ưu tiên followed artists
    const daily1Id = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Daily Mix 01',
      resolvePlaylistCoverUrl('dailymix_01'),
      'Giai điệu Pop, R&B và nhạc trẻ yêu thích.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (4, 5, 10, 11)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'dailymix_01'
    );

    // Daily Mix 2 (Lofi, Indie) - Ưu tiên followed artists
    const daily2Id = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Daily Mix 02',
      resolvePlaylistCoverUrl('dailymix_02'),
      'Không gian Lofi và Indie mộc mạc.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (1, 12)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'dailymix_02'
    );

    // Daily Mix 3 (EDM, Rock, Hip-hop) - Ưu tiên followed artists
    const daily3Id = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Daily Mix 03',
      resolvePlaylistCoverUrl('dailymix_03'),
      'Giai điệu EDM sảng khoái và Rock mạnh mẽ.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (3, 7, 8)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'dailymix_03'
    );

    // Daily Mix 4
    const daily4Id = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Daily Mix 04',
      resolvePlaylistCoverUrl('dailymix_04'),
      'Giai điệu Ballad và Acoustic sâu lắng.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (2, 6, 9)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'dailymix_04'
    );

    // Daily Mix 5
    const daily5Id = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Daily Mix 05',
      resolvePlaylistCoverUrl('dailymix_05'),
      'Những bản hit nhạc Việt và Châu Á.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (10, 11)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'dailymix_05'
    );

    // Daily Mix 6
    const daily6Id = await getOrCreateSystemPlaylist(
      conn, userId, 'system', 'Daily Mix 06',
      resolvePlaylistCoverUrl('dailymix_06'),
      'Năng lượng mạnh mẽ từ Remix và EDM.',
      `
        SELECT id, 
               CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
        FROM songs 
        WHERE is_active = 1 
        ORDER BY (genre_id IN (3, 8)) DESC, is_followed_bonus DESC, RAND() 
        LIMIT 20
      `, [followedArtistIds],
      'dailymix_06'
    );

    // Ensure the remaining Home system playlists before fetching the response.
    try {
      await getOrCreateSystemPlaylist(
        conn, userId, getSystemPlaylistConfig('moodmix'),
        `SELECT id,
                CASE WHEN artist_id IN (?) THEN 1 ELSE 0 END as is_followed_bonus
         FROM songs WHERE is_active = 1
         ORDER BY is_followed_bonus DESC, RAND()
         LIMIT 25`,
        [followedArtistIds]
      );

      await getOrCreateSystemPlaylist(
        conn, userId, getSystemPlaylistConfig('favorite_songs'),
        `SELECT song_id as id FROM song_likes WHERE user_id = ? ORDER BY liked_at DESC LIMIT 30`,
        [userId]
      );

      await getOrCreateSystemPlaylist(
        conn, userId, getSystemPlaylistConfig('recently_played'),
        `SELECT song_id as id FROM listening_history WHERE user_id = ? GROUP BY song_id ORDER BY MAX(listened_at) DESC LIMIT 30`,
        [userId]
      );

      await getOrCreateSystemPlaylist(
        conn, globalSystemUserId, getSystemPlaylistConfig('trending_now'),
        `SELECT id FROM songs WHERE is_active = 1 ORDER BY play_count DESC LIMIT 30`,
        []
      );
    } catch (error) {
      console.error('[HOME] ensureSystemPlaylistsForUser failed:', error);
      throw error;
    }

    // Update descriptions dynamically for all 6 system playlists based on actual songs
    const allSystemIds = [weeklyId, morningId, eveningId, daily1Id, daily2Id, daily3Id, daily4Id, daily5Id, daily6Id];
    for (const plId of allSystemIds) {
      const [artists] = await conn.query(`
        SELECT DISTINCT a.name 
        FROM playlist_songs ps
        JOIN songs s ON ps.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        WHERE ps.playlist_id = ?
        LIMIT 3
      `, [plId]);
      
      if (artists.length > 0) {
        const artistNames = artists.map(a => a.name).join(', ');
        const dynamicDesc = `${artistNames} và nhiều hơn nữa...`;
        await conn.query('UPDATE playlists SET description = ? WHERE id = ?', [dynamicDesc, plId]);
      }
    }

    await conn.commit();

    // 3. Fetch full playlist details to return to the frontend
    const [playlists] = await conn.query(`
      SELECT p.id, p.name, p.description as \`desc\`, p.type, p.cover_url, p.system_key, p.is_system,
             IF(usp.id IS NULL, 0, 1) AS is_saved,
             COALESCE(
               NULLIF(p.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
                 FROM playlist_songs ps2
                 JOIN songs s ON s.id = ps2.song_id
                 WHERE ps2.playlist_id = p.id
                 AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
                 ORDER BY ps2.position ASC, ps2.added_at ASC
                 LIMIT 1
               )
             ) AS effective_cover_url,
             COUNT(ps.song_id) as total_songs
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      LEFT JOIN user_saved_playlists usp ON usp.playlist_id = p.id AND usp.user_id = ?
      WHERE p.is_system = 1
        AND (
          (p.user_id = ? AND p.system_key <> 'trending_now')
          OR (p.user_id = ? AND p.system_key = 'trending_now')
        )
      GROUP BY p.id
    `, [userId, userId, globalSystemUserId]);

    // Format output
    const listMap = {};
    const madeForYouPlaylists = [];
    playlists.forEach(pl => {
      pl.cover_url = normalizeCoverUrl(pl.cover_url, req);
      pl.effective_cover_url = normalizeCoverUrl(pl.effective_cover_url, req);
      pl.creator_name = 'MusicFlow';
      madeForYouPlaylists.push(pl);
    });

    // Fetch user manual playlists as well
    const [userManualPlaylists] = await conn.query(`
      SELECT p.id, p.name, p.description as \`desc\`, p.type, p.cover_url,
             IF(usp.id IS NULL, 0, 1) AS is_saved,
             COALESCE(
               NULLIF(p.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, ''))
                 FROM playlist_songs ps2
                 JOIN songs s ON s.id = ps2.song_id
                 WHERE ps2.playlist_id = p.id
                 AND COALESCE(NULLIF(s.cover_url, ''), NULLIF(s.audio_url, '')) IS NOT NULL
                 ORDER BY ps2.position ASC, ps2.added_at ASC
                 LIMIT 1
               )
             ) AS effective_cover_url,
             COUNT(ps.song_id) as total_songs
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      LEFT JOIN user_saved_playlists usp ON usp.playlist_id = p.id AND usp.user_id = ?
      WHERE p.user_id = ? AND p.type = 'manual'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 5
    `, [userId, userId]);

    userManualPlaylists.forEach(pl => {
      pl.cover_url = normalizeCoverUrl(pl.cover_url, req);
      pl.effective_cover_url = normalizeCoverUrl(pl.effective_cover_url, req);
    });

    // 4. Lấy followed artists cho trang chủ (8 nghệ sĩ)
    let followedArtistsForHome = [];
    if (followedArtistIds.length > 0 && followedArtistIds[0] !== 0) {
      const [followedArtists] = await conn.query(`
        SELECT a.id, a.name, a.avatar_url,
               COUNT(s.id) as song_count,
               COALESCE(SUM(s.play_count), 0) as total_plays,
               COUNT(DISTINCT af.id) as follower_count
        FROM artists a
        LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
        LEFT JOIN artist_follows af ON af.artist_id = a.id
        WHERE a.id IN (?)
        GROUP BY a.id
        ORDER BY FIELD(a.id, ?)
        LIMIT 8
      `, [followedArtistIds, followedArtistIds.join(',')]);
      followedArtistsForHome = followedArtists;
    }

    // Nếu chưa follow ai, lấy nghệ sĩ phổ biến nhất
    let popularArtistsFallback = [];
    if (followedArtistsForHome.length === 0) {
      const [popularArtists] = await conn.query(`
        SELECT a.id, a.name, a.avatar_url,
               COUNT(s.id) as song_count,
               COALESCE(SUM(s.play_count), 0) as total_plays,
               COUNT(DISTINCT af.id) as follower_count
        FROM artists a
        LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
        LEFT JOIN artist_follows af ON af.artist_id = a.id
        GROUP BY a.id
        ORDER BY total_plays DESC, follower_count DESC
        LIMIT 8
      `);
      popularArtistsFallback = popularArtists;
    }

    // Prepare home response structure matching the new frontend requirements
    
    const SYSTEM_KEYS_MADE_FOR_YOU = MADE_FOR_YOU_ORDER;

    // 1. madeForYouPlaylists: ONLY system personalized playlists
    const finalMadeForYou = uniqueByPlaylist(madeForYouPlaylists)
      .filter(p => p.is_system && SYSTEM_KEYS_MADE_FOR_YOU.includes(p.system_key))
      .sort((a, b) => {
        const aIndex = SYSTEM_KEYS_MADE_FOR_YOU.indexOf(a.system_key);
        const bIndex = SYSTEM_KEYS_MADE_FOR_YOU.indexOf(b.system_key);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

    // 2. userPlaylists: ONLY manual user playlists
    const finalUserPlaylists = uniqueByPlaylist(userManualPlaylists)
      .filter(p => !p.is_system && !p.system_key);

    // 3. quickAccess: 3 items for top greeting grid
    // Combine recently opened / manual / madeForYou, prioritize manual or recently accessed
    let rawQuickAccess = [
      ...finalUserPlaylists,
      ...finalMadeForYou
    ].filter(Boolean);

    const finalQuickAccess = uniqueByPlaylist(rawQuickAccess).slice(0, 3);

    // Track used keys to avoid duplication
    const usedKeys = new Set([
      ...finalQuickAccess.map(getPlaylistUniqueKey),
      ...finalMadeForYou.map(getPlaylistUniqueKey),
      ...finalUserPlaylists.map(getPlaylistUniqueKey)
    ]);

    // Define which system_keys belong to "Gợi ý hôm nay"
    const RECOMMENDED_TODAY_KEYS = RECOMMENDED_TODAY_ORDER;

    // Smart ordering based on time of day
    const currentHour = new Date().getHours();
    let todayOrder;
    if (currentHour >= 5 && currentHour < 12) {
      // Morning: Morning Vibes first
      todayOrder = ['morning_vibes', 'moodmix', 'favorite_songs', 'trending_now', 'recently_played', 'night_vibes'];
    } else if (currentHour >= 18 || currentHour < 5) {
      // Evening/Night: Night Vibes first
      todayOrder = ['night_vibes', 'moodmix', 'favorite_songs', 'trending_now', 'recently_played', 'morning_vibes'];
    } else {
      // Afternoon: Mood Mix first
      todayOrder = ['moodmix', 'favorite_songs', 'trending_now', 'morning_vibes', 'night_vibes', 'recently_played'];
    }

    const finalRecommendedToday = uniqueByPlaylist(madeForYouPlaylists)
      .filter(p => p.is_system && RECOMMENDED_TODAY_KEYS.includes(p.system_key))
      .filter(item => !usedKeys.has(getPlaylistUniqueKey(item)))
      .sort((a, b) => {
        const aIndex = todayOrder.indexOf(a.system_key);
        const bIndex = todayOrder.indexOf(b.system_key);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    
    res.json({
      success: true,
      data: {
        quickAccess: finalQuickAccess,
        madeForYouPlaylists: finalMadeForYou,
        recommendedToday: finalRecommendedToday,
        userPlaylists: finalUserPlaylists,
        recentlyPlayed: [],
        trendingSongs: [],
        artistsForYou: followedArtistsForHome.length > 0 ? followedArtistsForHome : popularArtistsFallback,
        followed_artists: followedArtistsForHome,
        popular_artists: popularArtistsFallback, // fallback khi chưa follow ai
        has_followed_artists: followedArtistIds.length > 0
      }
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Home Recommendations Error:", err.message);
    try {
      require('fs').writeFileSync(require('path').join(__dirname, '../../error.log'), err.stack);
    } catch(e) {}
    res.status(500).json({
      success: false,
      message: 'Không thể tải gợi ý trang chủ',
      error: err.message
    });
  } finally {
    conn.release();
  }
};
