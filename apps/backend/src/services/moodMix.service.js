const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const {
  computeOverlapStats,
  selectSongsWithDiversityAndOverlapCheck,
  getPlaylistSongIds,
  getRecentSystemPlaylistSongs,
  evaluateRegenerateQuality,
  calculatePlaylistDiversity
} = require('../utils/playlistRegenerate.util');

const MOODMIX_LIMITS = {
  targetSize: 30,
  minCandidateCount: 90,
  maxSameArtistRatio: 0.30,
  maxSameGenreRatio: 0.65,
  minAddedSongs: 8,
  maxOverlap: 0.90 // allow up to 90%
};

async function hydrateSongsWithAudioFeatures(songIds) {
  if (!songIds || !songIds.length) return [];
  const [rows] = await pool.query(
    `SELECT 
      s.id, 
      s.title, 
      s.artist_id, 
      s.genre_id, 
      g.market,
      a.name as artist_name,
      saf.energy_score,
      saf.danceability,
      saf.acoustic_score,
      saf.brightness,
      saf.tempo_level,
      saf.mood,
      saf.vibe,
      saf.bpm
    FROM songs s
    LEFT JOIN genres g ON g.id = s.genre_id
    LEFT JOIN artists a ON a.id = s.artist_id
    LEFT JOIN song_audio_features saf ON saf.song_id = s.id
    WHERE s.id IN (?)`,
    [songIds]
  );
  return rows;
}

/**
 * Tính toán Mood Mix candidates cho user
 */
async function getMoodMixCandidates(userId, options = {}) {
  const limit = options.limit || 30;
  const targetCandidateCount = Math.max(180, limit * 6);
  
  const candidateCountByTier = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
  const candidates = [];
  const seenIds = new Set();
  let missingAudioFeatureCount = 0;

  // Lấy dominant mood và top genres/markets
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

  const [topGenres] = await pool.query(`
    SELECT s.genre_id, COUNT(*) as count
    FROM listening_history lh
    JOIN songs s ON lh.song_id = s.id
    WHERE lh.user_id = ? AND s.genre_id IS NOT NULL
    GROUP BY s.genre_id
    ORDER BY count DESC
    LIMIT 3
  `, [userId]);
  const genreIds = topGenres.map(g => g.genre_id);

  // --- Tier 1: Personalized history & mood match ---
  const [tier1Songs] = await pool.query(`
    SELECT s.id, 
      COALESCE(lh_stats.recent_listens, 0) * 1.0 +
      IF(sl.song_id IS NOT NULL, 3.0, 0) -
      COALESCE(lh_stats.skip_count, 0) * 1.0 +
      IF(saf.mood = ?, 2.0, 0) as base_score
    FROM songs s
    LEFT JOIN song_audio_features saf ON s.id = saf.song_id
    LEFT JOIN song_likes sl ON s.id = sl.song_id AND sl.user_id = ?
    LEFT JOIN (
      SELECT song_id, COUNT(*) as recent_listens,
             SUM(IF(skip_at_sec IS NOT NULL AND skip_at_sec < 30, 1, 0)) as skip_count
      FROM listening_history
      WHERE user_id = ? AND listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY song_id
    ) lh_stats ON s.id = lh_stats.song_id
    WHERE ${publicSongCondition('s')}
      AND (sl.song_id IS NOT NULL OR lh_stats.song_id IS NOT NULL OR saf.mood = ?)
    ORDER BY base_score DESC
    LIMIT 60
  `, [dominantMood, userId, userId, dominantMood]);

  if (tier1Songs.length > 0) {
    const hydrated = await hydrateSongsWithAudioFeatures(tier1Songs.map(s => s.id));
    const scoreMap = new Map(tier1Songs.map(s => [s.id, s.base_score]));
    for (const h of hydrated) {
      if (!seenIds.has(h.id)) {
        seenIds.add(h.id);
        h.score = scoreMap.get(h.id);
        if (!h.energy_score && !h.mood) {
          h.score -= 0.25;
          missingAudioFeatureCount++;
        }
        h.tier = 1;
        candidates.push(h);
        candidateCountByTier.tier1++;
      }
    }
  }

  // --- Tier 2: Popular matching user's genres + audio features ---
  const tier2Target = Math.max(100, limit * 2);
  if (candidates.length < tier2Target && genreIds.length > 0) {
    const limit2 = tier2Target - candidates.length;
    const [tier2Songs] = await pool.query(`
      SELECT s.id, s.play_count
      FROM songs s
      JOIN song_audio_features saf ON s.id = saf.song_id
      WHERE ${publicSongCondition('s')}
        AND s.genre_id IN (?)
        ${seenIds.size > 0 ? `AND s.id NOT IN (${Array.from(seenIds).join(',')})` : ''}
      ORDER BY s.play_count DESC
      LIMIT ?
    `, [genreIds, limit2 + 20]); // pull a bit extra

    if (tier2Songs.length > 0) {
      const hydrated = await hydrateSongsWithAudioFeatures(tier2Songs.map(s => s.id));
      for (const h of hydrated) {
        if (!seenIds.has(h.id) && candidates.length < tier2Target) {
          seenIds.add(h.id);
          h.score = 0; // fallback base score
          h.tier = 2;
          candidates.push(h);
          candidateCountByTier.tier2++;
        }
      }
    }
  }

  // --- Tier 3: Popular in genre (allow missing audio features) ---
  const tier3Target = Math.max(130, limit * 3);
  if (candidates.length < tier3Target && genreIds.length > 0) {
    const limit3 = tier3Target - candidates.length;
    const [tier3Songs] = await pool.query(`
      SELECT s.id, s.play_count
      FROM songs s
      WHERE ${publicSongCondition('s')}
        AND s.genre_id IN (?)
        ${seenIds.size > 0 ? `AND s.id NOT IN (${Array.from(seenIds).join(',')})` : ''}
      ORDER BY s.play_count DESC
      LIMIT ?
    `, [genreIds, limit3]);

    if (tier3Songs.length > 0) {
      const hydrated = await hydrateSongsWithAudioFeatures(tier3Songs.map(s => s.id));
      for (const h of hydrated) {
        if (!seenIds.has(h.id)) {
          seenIds.add(h.id);
          h.score = 0;
          if (!h.energy_score && !h.mood) {
            h.score -= 0.25;
            missingAudioFeatureCount++;
          }
          h.tier = 3;
          candidates.push(h);
          candidateCountByTier.tier3++;
        }
      }
    }
  }

  // --- Tier 4: Safe popular fallback (with audio features) ---
  if (candidates.length < targetCandidateCount) {
    const limit4 = targetCandidateCount - candidates.length;
    const [tier4Songs] = await pool.query(`
      SELECT s.id, s.play_count
      FROM songs s
      LEFT JOIN song_audio_features saf ON s.id = saf.song_id
      WHERE ${publicSongCondition('s')}
        ${seenIds.size > 0 ? `AND s.id NOT IN (${Array.from(seenIds).join(',')})` : ''}
      ORDER BY IF(saf.song_id IS NOT NULL, 1, 0) DESC, s.play_count DESC
      LIMIT ?
    `, [limit4]);

    if (tier4Songs.length > 0) {
      const hydrated = await hydrateSongsWithAudioFeatures(tier4Songs.map(s => s.id));
      for (const h of hydrated) {
        if (!seenIds.has(h.id)) {
          seenIds.add(h.id);
          h.score = 0;
          if (!h.energy_score && !h.mood) {
            h.score -= 0.25;
            missingAudioFeatureCount++;
          }
          h.tier = 4;
          candidates.push(h);
          candidateCountByTier.tier4++;
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  
  let fallbackUsed = candidateCountByTier.tier2 > 0 || candidateCountByTier.tier3 > 0 || candidateCountByTier.tier4 > 0;
  let fallbackReason = fallbackUsed ? "insufficient tier 1 mood/audio candidates" : null;

  return {
    dominantMood,
    candidates,
    candidateCount: candidates.length,
    candidateCountByTier,
    missingAudioFeatureRatio: candidates.length > 0 ? missingAudioFeatureCount / candidates.length : 0,
    fallbackUsed,
    fallbackReason
  };
}

async function generateMoodMixForUser(userId, options = {}) {
  const limit = options.limit || 30;
  const dryRun = options.dryRun || false;

  const targetSize = MOODMIX_LIMITS.targetSize;
  const { dominantMood, candidates, candidateCount, candidateCountByTier, missingAudioFeatureRatio, fallbackUsed: candFallback, fallbackReason: candReason } = await getMoodMixCandidates(userId, { limit: targetSize });

  // Normalize candidates if needed
  for (const c of candidates) {
    c.id = c.id || c.song_id;
    c.song_id = c.song_id || c.id;
  }

  // Lấy playlist cũ nếu có (bỏ qua transaction lock/insert nếu dryRun)
  const [playlists] = await pool.query(
    'SELECT id FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1',
    [userId, 'moodmix']
  );

  let playlistId = playlists.length > 0 ? playlists[0].id : null;
  let oldSongIds = [];
  if (playlistId) {
    const [rows] = await pool.query('SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position', [playlistId]);
    oldSongIds = rows.map(r => Number(r.song_id));
  }
  
  const oldSongSet = new Set(oldSongIds);
  for (const c of candidates) {
    if (oldSongSet.has(c.id)) {
      c.score -= 0.8;
    }
  }

  const {
    selected: finalObjs,
    fallbackUsed: divFallback,
    fallbackReason: divReason,
    relaxedDiversityUsed,
    maxArtistSongs,
    maxGenreSongs
  } = selectSongsWithDiversityAndOverlapCheck(
    candidates, oldSongIds, targetSize, MOODMIX_LIMITS
  );
  
  const finalIds = finalObjs.map(c => Number(c.id));
  const finalDiversity = calculatePlaylistDiversity(finalObjs);
  const overlapStats = computeOverlapStats(oldSongIds, finalIds);
  let evalResult = evaluateRegenerateQuality({ ...overlapStats, candidateCount, finalDiversity, relaxedDiversityUsed }, targetSize, MOODMIX_LIMITS);
  const exactArtistPassed = finalDiversity.maxSameArtistCount <= maxArtistSongs;
  const exactGenrePassed = finalDiversity.maxSameGenreCount <= maxGenreSongs;
  const finalDiversityPassed = exactArtistPassed && exactGenrePassed;
  
  if (finalObjs.length < targetSize) {
    evalResult = { status: 'failed', message: `selectedCount < targetSize under diversity quota (${finalObjs.length} < ${targetSize})`, canApply: false };
  } else {
    if (candidateCount < MOODMIX_LIMITS.minCandidateCount) {
      evalResult.status = 'warning';
      evalResult.message = `Candidate pool too small (${candidateCount} < ${MOODMIX_LIMITS.minCandidateCount})`;
    }
    if (overlapStats.addedSongs < MOODMIX_LIMITS.minAddedSongs && evalResult.canApply) {
      if (overlapStats.addedSongs >= 6 && overlapStats.overlapRatio <= 0.80 && finalDiversityPassed) {
        evalResult.status = 'warning';
        evalResult.message = `Not enough added songs (${overlapStats.addedSongs} < ${MOODMIX_LIMITS.minAddedSongs}) but allowed due to exact diversity quota pass`;
      } else {
        evalResult.status = 'failed';
        evalResult.message = `Not enough added songs (${overlapStats.addedSongs} < ${MOODMIX_LIMITS.minAddedSongs})`;
        evalResult.canApply = false;
      }
    }
    if (overlapStats.overlapRatio >= 0.9 && evalResult.canApply) {
      evalResult.status = 'failed';
      evalResult.message = `Overlap ratio too high (${overlapStats.overlapRatio} >= 0.90)`;
      evalResult.canApply = false;
    }
  }

  const summary = {
      userId,
      systemKey: 'moodmix',
      candidateCount,
      candidateCountByTier,
      missingAudioFeatureRatio,
      ...overlapStats,
      actualMaxSameArtistRatio: finalDiversity.maxSameArtistRatio,
      actualMaxSameGenreRatio: finalDiversity.maxSameGenreRatio,
      actualMaxSameArtistCount: finalDiversity.maxSameArtistCount,
      actualMaxSameGenreCount: finalDiversity.maxSameGenreCount,
      maxArtistSongs,
      maxGenreSongs,
      finalDiversityPassed,
      maxSameArtistLimit: MOODMIX_LIMITS.maxSameArtistRatio,
      maxSameGenreLimit: MOODMIX_LIMITS.maxSameGenreRatio,
      fallbackUsed: candFallback || divFallback,
      fallbackReason: candReason || divReason,
      relaxedDiversityUsed,
      sampleSkipReasons: evalResult.sampleSkipReasons || [],
      status: evalResult.status,
      message: evalResult.message,
      insertedSongs: 0,
      canApply: evalResult.canApply,
      created: !playlistId,
      selectedCount: finalObjs.length
  };

  if (dryRun) {
    return summary;
  }
  
  // Thao tác DB
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const systemKey = 'moodmix';
    const name = 'Mood Mix';
    const description = 'Âm nhạc phù hợp với tâm trạng của bạn';
    const coverUrl = resolvePlaylistCoverUrl(systemKey);

    if (!playlistId) {
      const [insertRes] = await conn.query(
        `INSERT INTO playlists (user_id, name, cover_url, description, type, is_public, system_key, is_system)
          VALUES (?, ?, ?, ?, 'system', 0, ?, 1)`,
        [userId, name, coverUrl, description, systemKey]
      );
      playlistId = insertRes.insertId;
    } else {
      await conn.query(
        `UPDATE playlists SET updated_at = NOW(), cover_url = ? WHERE id = ?`,
        [coverUrl, playlistId]
      );
    }

    if (evalResult.canApply) {
      // Xóa bài cũ và thêm bài mới
      await conn.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
      
      const values = finalIds.map((songId, idx) => [playlistId, songId, idx]);
      if (values.length > 0) {
        await conn.query(
          'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ?',
          [values]
        );
      }
      summary.insertedSongs = values.length;
    }
    
    await conn.commit();
    return summary;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function generateMoodMixForAllUsers(options = {}) {
  const [users] = await pool.query('SELECT id FROM users WHERE status = "active"');
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  let totalCandidates = 0;
  let totalOverlap = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalPlaylistsCreated = 0;
  let totalPlaylistsUpdated = 0;
  let totalInserted = 0;
  let totalMissingAudio = 0;
  
  const aggregateTiers = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
  const sampleSkipReasons = new Set();
  const sampleWarnings = new Set();
  let anyFallbackUsed = false;
  let fallbackReasons = new Set();
  
  let totalMaxArtistRatio = 0;
  let totalMaxGenreRatio = 0;
  let worstMaxArtistRatio = 0;
  let worstMaxGenreRatio = 0;
  let failedDiversityPlaylists = 0;
  
  for (const u of users) {
    try {
      const summary = await generateMoodMixForUser(u.id, options);
      
      if (summary.candidateCountByTier) {
        aggregateTiers.tier1 += summary.candidateCountByTier.tier1 || 0;
        aggregateTiers.tier2 += summary.candidateCountByTier.tier2 || 0;
        aggregateTiers.tier3 += summary.candidateCountByTier.tier3 || 0;
        aggregateTiers.tier4 += summary.candidateCountByTier.tier4 || 0;
      }
      totalMissingAudio += summary.missingAudioFeatureRatio || 0;
      if (summary.fallbackUsed) {
        anyFallbackUsed = true;
        if (summary.fallbackReason) fallbackReasons.add(summary.fallbackReason);
      }
      
      if (summary.canApply) {
        successCount++;
        totalCandidates += summary.candidateCount;
        totalOverlap += summary.overlapRatio;
        totalAdded += summary.addedSongs;
        totalRemoved += summary.removedSongs;
        totalInserted += summary.insertedSongs;
        totalMaxArtistRatio += summary.actualMaxSameArtistRatio || 0;
        totalMaxGenreRatio += summary.actualMaxSameGenreRatio || 0;
        worstMaxArtistRatio = Math.max(worstMaxArtistRatio, summary.actualMaxSameArtistRatio || 0);
        worstMaxGenreRatio = Math.max(worstMaxGenreRatio, summary.actualMaxSameGenreRatio || 0);
        if (summary.created) totalPlaylistsCreated++;
        else totalPlaylistsUpdated++;
        
        if (summary.status === 'warning') {
           sampleWarnings.add(summary.message);
        }
      } else {
        if (summary.overlapRatio >= 0.9) skippedCount++;
        else failedCount++;
        
        if (summary.message && summary.message !== 'Generated successfully') {
          sampleSkipReasons.add(JSON.stringify({
            userId: summary.userId,
            reason: summary.message,
            candidateCount: summary.candidateCount,
            selectedCount: summary.selectedCount,
            addedSongs: summary.addedSongs,
            actualArtistRatio: summary.actualMaxSameArtistRatio,
            actualGenreRatio: summary.actualMaxSameGenreRatio
          }));
        }
        if (!summary.finalDiversityPassed) failedDiversityPlaylists++;
      }
    } catch (e) {
      console.error(`Error generating Mood Mix for user ${u.id}:`, e);
      failedCount++;
      sampleSkipReasons.add(JSON.stringify({
        userId: u.id,
        reason: e.message
      }));
    }
  }
  
  const totalProcessed = users.length;
  const avgOverlap = successCount > 0 ? totalOverlap / successCount : 0;
  const avgArtistRatio = successCount > 0 ? totalMaxArtistRatio / successCount : 0;
  const avgGenreRatio = successCount > 0 ? totalMaxGenreRatio / successCount : 0;
  
  const successRate = totalProcessed > 0 ? successCount / totalProcessed : 0;
  let batchStatus = 'success';
  if (successRate < 0.75) batchStatus = 'failed';
  else if (successRate < 0.90) batchStatus = 'warning';
  
  let finalDiversityPassed = true;
  if (failedDiversityPlaylists > 0) finalDiversityPassed = false;
  
  let canApply = successRate >= 0.85 && finalDiversityPassed;
  
  return {
    systemKey: 'moodmix',
    targetSize: MOODMIX_LIMITS.targetSize,
    playlistsProcessed: totalProcessed,
    playlistsCreated: totalPlaylistsCreated,
    playlistsUpdated: totalPlaylistsUpdated,
    successCount,
    skippedCount,
    failedCount,
    successRate: Number(successRate.toFixed(3)),
    songsInserted: totalInserted,
    candidateCount: totalProcessed > 0 ? Math.round((aggregateTiers.tier1 + aggregateTiers.tier2 + aggregateTiers.tier3 + aggregateTiers.tier4) / totalProcessed) : 0,
    candidateCountByTier: {
      tier1: totalProcessed > 0 ? Math.round(aggregateTiers.tier1 / totalProcessed) : 0,
      tier2: totalProcessed > 0 ? Math.round(aggregateTiers.tier2 / totalProcessed) : 0,
      tier3: totalProcessed > 0 ? Math.round(aggregateTiers.tier3 / totalProcessed) : 0,
      tier4: totalProcessed > 0 ? Math.round(aggregateTiers.tier4 / totalProcessed) : 0
    },
    missingAudioFeatureRatio: totalProcessed > 0 ? totalMissingAudio / totalProcessed : 0,
    overlapRatio: avgOverlap ? Number(avgOverlap.toFixed(2)) : 0,
    addedSongs: successCount > 0 ? Math.round(totalAdded / successCount) : 0,
    removedSongs: successCount > 0 ? Math.round(totalRemoved / successCount) : 0,
    actualMaxSameArtistRatio: avgArtistRatio ? Number(avgArtistRatio.toFixed(2)) : 0,
    actualMaxSameGenreRatio: avgGenreRatio ? Number(avgGenreRatio.toFixed(2)) : 0,
    worstMaxSameArtistRatio: Number(worstMaxArtistRatio.toFixed(2)),
    worstMaxSameGenreRatio: Number(worstMaxGenreRatio.toFixed(2)),
    failedDiversityPlaylists,
    maxSameArtistLimit: MOODMIX_LIMITS.maxSameArtistRatio,
    maxSameGenreLimit: MOODMIX_LIMITS.maxSameGenreRatio,
    finalDiversityPassed,
    fallbackUsed: anyFallbackUsed,
    fallbackReason: anyFallbackUsed ? Array.from(fallbackReasons).join('; ') : '',
    sampleWarnings: Array.from(sampleWarnings).slice(0, 10),
    sampleSkipReasons: Array.from(sampleSkipReasons).slice(0, 10),
    status: batchStatus,
    message: batchStatus === 'failed' ? `Batch success rate too low (${successCount}/${totalProcessed}) or diversity failed` : 'Generated successfully',
    canApply
  };
}

module.exports = {
  getMoodMixCandidates,
  generateMoodMixForUser,
  generateMoodMixForAllUsers
};
