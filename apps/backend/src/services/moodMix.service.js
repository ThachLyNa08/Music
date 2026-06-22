const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');

/**
 * Tính toán Mood Mix candidates cho user
 */
async function getMoodMixCandidates(userId, options = {}) {
  const limit = options.limit || 30;
  const maxPerArtist = 3;

  // Lấy danh sách nhạc user nghe gần đây (30 ngày)
  // và xác định dominant mood
  const [recentMoods] = await pool.query(`
    SELECT saf.mood, COUNT(*) as count
    FROM listening_history lh
    JOIN song_audio_features saf ON lh.song_id = saf.song_id
    WHERE lh.user_id = ? AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND saf.mood IS NOT NULL
    GROUP BY saf.mood
    ORDER BY count DESC
    LIMIT 1
  `, [userId]);

  const dominantMood = recentMoods.length > 0 ? recentMoods[0].mood : null;

  // Lấy các bài hát ưu tiên:
  // - liked
  // - recent history
  // - mood match
  const [candidates] = await pool.query(`
    SELECT 
      s.id, 
      s.title, 
      s.artist_id,
      a.name as artist_name,
      saf.mood,
      saf.vibe,
      COALESCE(lh_stats.recent_listens, 0) as recent_listens,
      COALESCE(lh_stats.avg_completion_rate, 0) as avg_completion_rate,
      COALESCE(lh_stats.skip_count, 0) as skip_count,
      IF(sl.song_id IS NOT NULL, 1, 0) as is_liked,
      IF(saf.mood = ?, 1, 0) as is_mood_match
    FROM songs s
    JOIN artists a ON s.artist_id = a.id
    LEFT JOIN song_audio_features saf ON s.id = saf.song_id
    LEFT JOIN song_likes sl ON s.id = sl.song_id AND sl.user_id = ?
    LEFT JOIN (
      SELECT song_id, 
             COUNT(*) as recent_listens,
             AVG(completion_rate) as avg_completion_rate,
             SUM(IF(skip_at_sec IS NOT NULL AND skip_at_sec < 30, 1, 0)) as skip_count
      FROM listening_history
      WHERE user_id = ? AND listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY song_id
    ) lh_stats ON s.id = lh_stats.song_id
    WHERE ${publicSongCondition('s')}
      AND (sl.song_id IS NOT NULL OR lh_stats.song_id IS NOT NULL OR saf.mood = ?)
  `, [dominantMood, userId, userId, dominantMood]);

  // Tính score
  for (const c of candidates) {
    let score = 0;
    score += c.recent_listens * 1.0;
    score += c.is_liked * 3.0;
    score += c.avg_completion_rate * 3.0;
    score -= c.skip_count * 1.0;
    score += c.is_mood_match * 2.0;
    c.score = score;
  }

  // Sắp xếp
  candidates.sort((a, b) => b.score - a.score);

  // Lọc cap artist
  const finalSongs = [];
  const artistCounts = {};
  for (const c of candidates) {
    if (!artistCounts[c.artist_id]) artistCounts[c.artist_id] = 0;
    if (artistCounts[c.artist_id] < maxPerArtist) {
      finalSongs.push(c);
      artistCounts[c.artist_id]++;
      if (finalSongs.length >= limit) break;
    }
  }

  // Fallback nếu thiếu (Trending)
  if (finalSongs.length < limit) {
    const fallbackLimit = limit - finalSongs.length;
    const existingIds = finalSongs.map(s => s.id);
    const excludeCondition = existingIds.length > 0 ? `AND s.id NOT IN (${existingIds.join(',')})` : '';
    
    const [fallbackSongs] = await pool.query(`
      SELECT s.id, s.title, s.artist_id, a.name as artist_name, saf.mood, saf.vibe, 0 as score
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN song_audio_features saf ON s.id = saf.song_id
      WHERE ${publicSongCondition('s')} ${excludeCondition}
      ORDER BY s.play_count DESC
      LIMIT ?
    `, [fallbackLimit]);

    for (const f of fallbackSongs) {
      f.is_fallback = true;
      finalSongs.push(f);
    }
  }

  return {
    dominantMood,
    items: finalSongs,
    candidateCount: candidates.length,
    duplicateCount: 0 // handled by cap and set
  };
}

async function generateMoodMixForUser(userId, options = {}) {
  const limit = options.limit || 30;
  const dryRun = options.dryRun || false;

  const result = await getMoodMixCandidates(userId, { limit });

  if (dryRun) {
    return result;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const systemKey = 'moodmix';
    const name = 'Mood Mix';
    const description = 'Âm nhạc phù hợp với tâm trạng của bạn';
    const coverUrl = resolvePlaylistCoverUrl(systemKey);

    // 1. Kiểm tra playlist có tồn tại không
    const [playlists] = await conn.query(
      'SELECT id FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1',
      [userId, systemKey]
    );

    let playlistId;
    if (playlists.length === 0) {
      const [insertRes] = await conn.query(
        `INSERT INTO playlists (user_id, name, cover_url, description, type, is_public, system_key, is_system)
         VALUES (?, ?, ?, ?, 'system', 0, ?, 1)`,
        [userId, name, coverUrl, description, systemKey]
      );
      playlistId = insertRes.insertId;
    } else {
      playlistId = playlists[0].id;
      // Cập nhật description, name, type (không set cover_url nếu không cần, nhưng cứ set để đảm bảo)
      await conn.query(
        `UPDATE playlists
         SET cover_url = IFNULL(cover_url, ?), type = 'system', name = ?, description = ?, is_system = 1, updated_at = NOW()
         WHERE id = ?`,
        [coverUrl, name, description, playlistId]
      );
    }

    // 2. Xóa các bài cũ
    await conn.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlistId]);

    // 3. Insert bài mới
    if (result.items.length > 0) {
      const values = result.items.map((s, index) => [playlistId, s.id, index + 1]);
      await conn.query('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ?', [values]);
    }

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function generateMoodMixForAllUsers(options = {}) {
  // Lấy danh sách users
  const [users] = await pool.query('SELECT id FROM users WHERE status = "active"');
  let successCount = 0;
  
  for (const u of users) {
    try {
      await generateMoodMixForUser(u.id, options);
      successCount++;
    } catch (e) {
      console.error(`Error generating Mood Mix for user ${u.id}:`, e);
    }
  }
  return successCount;
}

module.exports = {
  getMoodMixCandidates,
  generateMoodMixForUser,
  generateMoodMixForAllUsers
};
