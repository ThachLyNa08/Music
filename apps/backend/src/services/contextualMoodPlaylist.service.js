const { pool } = require('../config/database');
const contextualMoodService = require('./contextualMood.service');
const { publicSongCondition } = require('../utils/public.utils');
const { resolvePlaylistCoverUrl } = require('../utils/playlistCover');
const {
  computeOverlapStats,
  selectSongsWithDiversityAndOverlapCheck,
  getPlaylistSongIds,
  evaluateRegenerateQuality,
  calculatePlaylistDiversity
} = require('../utils/playlistRegenerate.util');

const DEFAULT_LIMIT = 25;
const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'];

const SLOT_PLAYLISTS = {
  morning: {
    timeSlot: 'morning',
    system_key: 'morning_vibes',
    name: 'Morning Vibes',
    description: 'Những gợi ý phù hợp để khởi động ngày mới.'
  },
  afternoon: {
    timeSlot: 'afternoon',
    system_key: 'afternoon_vibes',
    name: 'Afternoon Vibes',
    description: 'Những bài hát có năng lượng phù hợp cho buổi chiều.'
  },
  evening: {
    timeSlot: 'evening',
    system_key: 'evening_vibes',
    name: 'Evening Vibes',
    description: 'Những gợi ý nhẹ nhàng cho khoảng thời gian cuối ngày.'
  },
  night: {
    timeSlot: 'night',
    system_key: 'night_vibes',
    name: 'Night Vibes',
    description: 'Những bài hát phù hợp để thư giãn về đêm.'
  }
};

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(40, Math.floor(n));
}

const VIBE_LIMITS = {
  targetSize: 25,
  minCandidateCount: 75,
  maxSameArtistRatio: 0.30,
  maxSameGenreRatio: 0.65,
  minAddedSongs: 8,
  maxOverlap: 0.90 // allow up to 90%
};

function normalizeTimeSlot(timeSlot) {
  const slot = String(timeSlot || '').trim().toLowerCase();
  if (!TIME_SLOTS.includes(slot)) {
    throw new Error(`Invalid timeSlot: ${timeSlot}. Expected one of ${TIME_SLOTS.join(', ')}`);
  }
  return slot;
}

function dedupeSongItems(items) {
  const seen = new Set();
  const deduped = [];
  let duplicateCount = 0;

  for (const item of Array.isArray(items) ? items : []) {
    const songId = Number(item.id || item.song_id);
    if (!Number.isInteger(songId) || songId <= 0) continue;
    if (seen.has(songId)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(songId);
    deduped.push({ ...item, id: songId });
  }

  return { deduped, duplicateCount };
}

async function ensureContextualMoodPlaylist(conn, userId, config, songIds) {
  const coverUrl = resolvePlaylistCoverUrl(config.system_key);
  const [existing] = await conn.query(
    `SELECT id FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1`,
    [userId, config.system_key]
  );

  let playlistId;
  let created = false;

  if (existing.length) {
    playlistId = existing[0].id;
    await conn.query(
      `UPDATE playlists
       SET name = ?, description = ?, cover_url = ?, type = 'system',
           is_system = 1, is_public = 0, updated_at = NOW()
       WHERE id = ?`,
      [config.name, config.description, coverUrl, playlistId]
    );
  } else {
    const [result] = await conn.query(
      `INSERT INTO playlists
         (user_id, name, description, cover_url, type, is_public, is_system, system_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'system', 0, 1, ?, NOW(), NOW())`,
      [userId, config.name, config.description, coverUrl, config.system_key]
    );
    playlistId = result.insertId;
    created = true;
  }

  await conn.query(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId]);

  if (songIds.length) {
    const values = songIds.map((songId, index) => [playlistId, songId, index, new Date()]);
    await conn.query(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES ?`,
      [values]
    );
  }

  return { playlistId, created, insertedSongs: songIds.length };
}

async function generateContextualMoodPlaylistForSlot(userId, timeSlot, options = {}) {
  const slot = normalizeTimeSlot(timeSlot);
  const config = SLOT_PLAYLISTS[slot];
  const limit = clampLimit(options.limit);
  const dryRun = options.dryRun === true;

  const conn = options.conn || await pool.getConnection();
  const ownsConnection = !options.conn;

  try {
    const config = SLOT_PLAYLISTS[slot];
    
    // Find existing playlist to get oldSongIds
    const [existingPlaylists] = await conn.query(
      `SELECT id FROM playlists WHERE user_id = ? AND system_key = ? LIMIT 1`,
      [userId, config.system_key]
    );
    let oldSongIds = [];
    if (existingPlaylists.length > 0) {
      oldSongIds = await getPlaylistSongIds(conn, existingPlaylists[0].id);
    }
    
    const recommendation = await contextualMoodService.getContextualMoodRecommendations(userId, {
      timeSlot: slot,
      limit: limit * 5,
      now: options.now,
      req: options.req || null
    });

    const { deduped, duplicateCount } = dedupeSongItems(recommendation.items);
    
    const oldSongSet = new Set(oldSongIds);
    // Format candidateObjs with fallback score if not present
    const candidateObjs = deduped.map((item, idx) => {
      let score = item.recommendation_score || (deduped.length - idx);
      if (oldSongSet.has(Number(item.id))) {
        score -= 0.8;
      }
      return {
        ...item,
        id: Number(item.id),
        score
      };
    }).sort((a,b) => b.score - a.score);

    const targetSize = VIBE_LIMITS.targetSize;
    const {
      selected: refinedObjs,
      fallbackUsed,
      fallbackReason,
      relaxedDiversityUsed,
      maxArtistSongs,
      maxGenreSongs
    } = selectSongsWithDiversityAndOverlapCheck(
      candidateObjs, oldSongIds, targetSize, VIBE_LIMITS
    );
    const songIds = refinedObjs.map(c => Number(c.id));
    
    const topSongs = refinedObjs.slice(0, 5).map((item, index) => ({
      position: index + 1,
      id: Number(item.id),
      title: item.title,
      artist_name: item.artist_name || item.artist || null,
      recommendation_score: item.recommendation_score || item.score,
      mood_reason: item.mood_reason || null
    }));
    
    const overlapStats = computeOverlapStats(oldSongIds, songIds);
    const finalDiversity = calculatePlaylistDiversity(refinedObjs);
    let evalResult = evaluateRegenerateQuality({ ...overlapStats, candidateCount: candidateObjs.length, finalDiversity, relaxedDiversityUsed }, targetSize, VIBE_LIMITS);
    const exactArtistPassed = finalDiversity.maxSameArtistCount <= maxArtistSongs;
    const exactGenrePassed = finalDiversity.maxSameGenreCount <= maxGenreSongs;
    const finalDiversityPassed = exactArtistPassed && exactGenrePassed;
    
    if (refinedObjs.length < targetSize) {
      evalResult = { status: 'failed', message: `selectedCount < targetSize under diversity quota (${refinedObjs.length} < ${targetSize})`, canApply: false };
    } else {
      if (candidateObjs.length < VIBE_LIMITS.minCandidateCount) {
        evalResult.status = 'warning';
        evalResult.message = `Candidate count ${candidateObjs.length} < ${VIBE_LIMITS.minCandidateCount}`;
      }
      if (overlapStats.addedSongs < VIBE_LIMITS.minAddedSongs && evalResult.canApply) {
        if (overlapStats.addedSongs >= 6 && overlapStats.overlapRatio < 0.70) {
          evalResult.status = 'warning';
          evalResult.message = (evalResult.message || '') + `; Not enough added songs (${overlapStats.addedSongs} < ${VIBE_LIMITS.minAddedSongs}) but allowed due to good diversity and overlap`;
        } else {
          evalResult.status = 'failed';
          evalResult.message = `Not enough added songs (${overlapStats.addedSongs} < ${VIBE_LIMITS.minAddedSongs})`;
          evalResult.canApply = false;
        }
      }
      if (overlapStats.overlapRatio >= 0.9 && evalResult.canApply) {
        evalResult.status = 'failed';
        evalResult.message = `Overlap ratio too high (${overlapStats.overlapRatio} >= 0.90)`;
        evalResult.canApply = false;
      }
    }

    const baseResult = {
      userId: Number(userId),
      timeSlot: slot,
      systemKey: config.system_key,
      name: config.name,
      itemCount: songIds.length,
      candidateCount: candidateObjs.length,
      candidateCountByTier: recommendation.candidateCountByTier || null,
      missingAudioFeatureRatio: recommendation.missingAudioFeatureRatio || 0,
      fallbackUsed,
      fallbackReason,
      ...overlapStats,
      actualMaxSameArtistRatio: finalDiversity.maxSameArtistRatio,
      actualMaxSameGenreRatio: finalDiversity.maxSameGenreRatio,
      actualMaxSameArtistCount: finalDiversity.maxSameArtistCount,
      actualMaxSameGenreCount: finalDiversity.maxSameGenreCount,
      maxArtistSongs,
      maxGenreSongs,
      finalDiversityPassed,
      maxSameArtistLimit: VIBE_LIMITS.maxSameArtistRatio,
      maxSameGenreLimit: VIBE_LIMITS.maxSameGenreRatio,
      relaxedDiversityUsed,
      sampleSkipReasons: evalResult.sampleSkipReasons || [],
      status: evalResult.status,
      message: evalResult.message,
      canApply: evalResult.canApply,
      topSongs,
      dryRun
    };

    if (dryRun) {
      if (ownsConnection) conn.release();
      return {
        ...baseResult,
        playlistId: null,
        created: false,
        insertedSongs: 0
      };
    }

    if (evalResult.canApply) {
      if (ownsConnection) await conn.beginTransaction();
      const writeResult = await ensureContextualMoodPlaylist(conn, userId, config, songIds);
      if (ownsConnection) await conn.commit();
      return {
        ...baseResult,
        ...writeResult
      };
    } else {
      return baseResult;
    }
  } catch (err) {
    if (ownsConnection) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.warn('[ContextualMoodPlaylist] rollback failed:', rollbackErr.message);
      }
    }
    throw err;
  } finally {
    if (ownsConnection) conn.release();
  }
}

async function generateContextualMoodPlaylistsForUser(userId, options = {}) {
  const requestedSlots = options.timeSlot ? [normalizeTimeSlot(options.timeSlot)] : TIME_SLOTS;
  const results = [];

  for (const slot of requestedSlots) {
    const result = await generateContextualMoodPlaylistForSlot(userId, slot, options);
    results.push(result);
  }

  return {
    userId: Number(userId),
    dryRun: options.dryRun === true,
    playlistsProcessed: results.length,
    playlistsCreated: results.filter((item) => item.created).length,
    playlistsUpdated: results.filter((item) => !item.created && !item.dryRun).length,
    songsInserted: results.reduce((sum, item) => sum + Number(item.insertedSongs || 0), 0),
    candidateCount: results.reduce((sum, item) => sum + (item.candidateCount || 0), 0),
    candidateCountByTier: {
      tier1: results.reduce((sum, item) => sum + (item.candidateCountByTier?.tier1 || 0), 0),
      tier2: results.reduce((sum, item) => sum + (item.candidateCountByTier?.tier2 || 0), 0),
      tier3: results.reduce((sum, item) => sum + (item.candidateCountByTier?.tier3 || 0), 0),
      tier4: results.reduce((sum, item) => sum + (item.candidateCountByTier?.tier4 || 0), 0)
    },
    missingAudioFeatureRatioSum: results.reduce((sum, item) => sum + (item.missingAudioFeatureRatio || 0), 0),
    overlapRatioSum: results.reduce((sum, item) => sum + (item.overlapRatio || 0), 0),
    addedSongs: results.reduce((sum, item) => sum + (item.addedSongs || 0), 0),
    removedSongs: results.reduce((sum, item) => sum + (item.removedSongs || 0), 0),
    artistRatioSum: results.reduce((sum, item) => sum + (item.actualMaxSameArtistRatio || 0), 0),
    genreRatioSum: results.reduce((sum, item) => sum + (item.actualMaxSameGenreRatio || 0), 0),
    fallbackUsed: results.some(item => item.fallbackUsed),
    fallbackReasons: results.map(item => item.fallbackReason).filter(Boolean),
    results
  };
}

async function getEligibleUserIds(limit = null) {
  const params = [];
  let limitSql = '';
  if (Number.isInteger(limit) && limit > 0) {
    limitSql = ' LIMIT ?';
    params.push(limit);
  }
  const [rows] = await pool.query(
    `SELECT id
     FROM users
     WHERE (role IS NULL OR role <> 'admin')
       AND (status IS NULL OR status = 'active')
     ORDER BY id${limitSql}`,
    params
  );
  return rows.map((row) => Number(row.id)).filter(Number.isInteger);
}

async function generateContextualMoodPlaylistsForAllUsers(options = {}) {
  const userIds = Array.isArray(options.userIds) && options.userIds.length
    ? options.userIds.map(Number).filter(Number.isInteger)
    : await getEligibleUserIds(options.userLimit);

  const summary = {
    dryRun: options.dryRun === true,
    totalUsers: userIds.length,
    usersProcessed: 0,
    usersSucceeded: 0,
    playlistsProcessed: 0,
    playlistsSucceeded: 0,
    playlistsCreated: 0,
    playlistsUpdated: 0,
    songsInserted: 0,
    candidateCountSum: 0,
    aggregateTiers: { tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
    missingAudioFeatureRatioSum: 0,
    overlapRatioSum: 0,
    artistRatioSum: 0,
    genreRatioSum: 0,
    worstArtistRatio: 0,
    worstGenreRatio: 0,
    failedDiversityPlaylists: 0,
    addedSongsSum: 0,
    removedSongsSum: 0,
    playlistsSkipped: 0,
    playlistsFailed: 0,
    anyFallbackUsed: false,
    fallbackReasons: new Set(),
    sampleSkipReasons: new Set(),
    sampleWarnings: new Set(),
    errors: 0,
    perSlotStats: {
      morning_vibes: { processed: 0, succeeded: 0, skipped: 0, failed: 0, addedSongsSum: 0, overlapSum: 0, artistSum: 0, genreSum: 0 },
      afternoon_vibes: { processed: 0, succeeded: 0, skipped: 0, failed: 0, addedSongsSum: 0, overlapSum: 0, artistSum: 0, genreSum: 0 },
      evening_vibes: { processed: 0, succeeded: 0, skipped: 0, failed: 0, addedSongsSum: 0, overlapSum: 0, artistSum: 0, genreSum: 0 },
      night_vibes: { processed: 0, succeeded: 0, skipped: 0, failed: 0, addedSongsSum: 0, overlapSum: 0, artistSum: 0, genreSum: 0 }
    },
    results: []
  };

  for (const userId of userIds) {
    try {
      const result = await generateContextualMoodPlaylistsForUser(userId, options);
      summary.usersProcessed += 1;
      summary.playlistsProcessed += result.playlistsProcessed;
      summary.playlistsCreated += result.playlistsCreated;
      summary.playlistsUpdated += result.playlistsUpdated;
      summary.songsInserted += result.songsInserted;
      summary.candidateCountSum += result.candidateCount;
      if (result.candidateCountByTier) {
        summary.aggregateTiers.tier1 += result.candidateCountByTier.tier1 || 0;
        summary.aggregateTiers.tier2 += result.candidateCountByTier.tier2 || 0;
        summary.aggregateTiers.tier3 += result.candidateCountByTier.tier3 || 0;
        summary.aggregateTiers.tier4 += result.candidateCountByTier.tier4 || 0;
      }
      summary.missingAudioFeatureRatioSum += result.missingAudioFeatureRatioSum || 0;
      summary.overlapRatioSum += result.overlapRatioSum || 0;
      summary.addedSongsSum += result.addedSongs || 0;
      summary.removedSongsSum += result.removedSongs || 0;
      summary.artistRatioSum += result.artistRatioSum || 0;
      summary.genreRatioSum += result.genreRatioSum || 0;
      
      if (result.fallbackUsed) {
        summary.anyFallbackUsed = true;
        result.fallbackReasons.forEach(r => summary.fallbackReasons.add(r));
      }
      
      let hasSuccessSlot = false;
      for (const slotResult of result.results) {
        const slotKey = slotResult.systemKey || slotResult.name.toLowerCase().replace(' ', '_');
        if (!summary.perSlotStats[slotKey]) summary.perSlotStats[slotKey] = { processed: 0, succeeded: 0, skipped: 0, failed: 0, addedSongsSum: 0, overlapSum: 0, artistSum: 0, genreSum: 0 };
        
        summary.perSlotStats[slotKey].processed++;
        summary.perSlotStats[slotKey].addedSongsSum += slotResult.addedSongs || 0;
        summary.perSlotStats[slotKey].overlapSum += slotResult.overlapRatio || 0;
        
        if (slotResult.canApply) {
          hasSuccessSlot = true;
          summary.playlistsSucceeded++;
          summary.perSlotStats[slotKey].succeeded++;
          summary.perSlotStats[slotKey].artistSum += slotResult.actualMaxSameArtistRatio || 0;
          summary.perSlotStats[slotKey].genreSum += slotResult.actualMaxSameGenreRatio || 0;
          summary.worstArtistRatio = Math.max(summary.worstArtistRatio, slotResult.actualMaxSameArtistRatio || 0);
          summary.worstGenreRatio = Math.max(summary.worstGenreRatio, slotResult.actualMaxSameGenreRatio || 0);
          
          if (slotResult.status === 'warning') {
            summary.sampleWarnings.add(slotResult.message);
          }
        } else if (slotResult.overlapRatio >= 0.9) {
          summary.playlistsSkipped++;
          summary.perSlotStats[slotKey].skipped++;
        } else {
          summary.playlistsFailed++;
          summary.perSlotStats[slotKey].failed++;
        }
        if (!slotResult.finalDiversityPassed) {
          summary.failedDiversityPlaylists++;
        }
        
        if (!slotResult.canApply && slotResult.message && slotResult.message !== 'Generated successfully') {
          summary.sampleSkipReasons.add(slotResult.message);
        }
      }
      
      if (hasSuccessSlot) summary.usersSucceeded++;

      summary.results.push(result);
    } catch (err) {
      summary.errors += 1;
      summary.playlistsFailed += TIME_SLOTS.length; // rough estimate
      summary.sampleSkipReasons.add(err.message);
      summary.results.push({ userId, error: err.message });
    }
  }

  const totalValidPlaylists = summary.playlistsProcessed || 1;
  const successPlaylists = summary.playlistsSucceeded || 1;
  summary.candidateCount = Math.round(summary.candidateCountSum / totalValidPlaylists);
  summary.candidateCountByTier = {
    tier1: Math.round(summary.aggregateTiers.tier1 / totalValidPlaylists),
    tier2: Math.round(summary.aggregateTiers.tier2 / totalValidPlaylists),
    tier3: Math.round(summary.aggregateTiers.tier3 / totalValidPlaylists),
    tier4: Math.round(summary.aggregateTiers.tier4 / totalValidPlaylists)
  };
  summary.missingAudioFeatureRatio = summary.missingAudioFeatureRatioSum / totalValidPlaylists;
  summary.overlapRatio = Number((summary.overlapRatioSum / totalValidPlaylists).toFixed(2));
  summary.addedSongs = Math.round(summary.addedSongsSum / totalValidPlaylists);
  summary.removedSongs = Math.round(summary.removedSongsSum / totalValidPlaylists);
  
  const avgArtistRatio = summary.artistRatioSum / successPlaylists;
  const avgGenreRatio = summary.genreRatioSum / successPlaylists;
  summary.actualMaxSameArtistRatio = summary.playlistsSucceeded > 0 ? Number(avgArtistRatio.toFixed(2)) : 0;
  summary.actualMaxSameGenreRatio = summary.playlistsSucceeded > 0 ? Number(avgGenreRatio.toFixed(2)) : 0;
  summary.maxSameArtistLimit = VIBE_LIMITS.maxSameArtistRatio;
  summary.maxSameGenreLimit = VIBE_LIMITS.maxSameGenreRatio;
  
  const successRate = summary.playlistsProcessed > 0 ? summary.playlistsSucceeded / summary.playlistsProcessed : 0;
  summary.playlistSuccessRate = Number(successRate.toFixed(3));
  
  let batchStatus = 'success';
  if (successRate < 0.75) batchStatus = 'failed';
  else if (successRate < 0.90) batchStatus = 'warning';
  
  let finalDiversityPassed = true;
  if (summary.failedDiversityPlaylists > 0) finalDiversityPassed = false;
  summary.finalDiversityPassed = finalDiversityPassed;
  summary.worstMaxSameArtistRatio = Number(summary.worstArtistRatio.toFixed(2));
  summary.worstMaxSameGenreRatio = Number(summary.worstGenreRatio.toFixed(2));
  
  // Format perSlotStats and check per-slot success rates
  let allSlotsPassed = true;
  Object.keys(summary.perSlotStats).forEach(key => {
    const s = summary.perSlotStats[key];
    if (s.processed > 0) {
      s.successRate = Number((s.succeeded / s.processed).toFixed(3));
      if (s.successRate < 0.85) allSlotsPassed = false;
      s.avgAddedSongs = Math.round(s.addedSongsSum / s.processed);
      s.avgOverlapRatio = Number((s.overlapSum / s.processed).toFixed(2));
      s.actualMaxSameArtistRatio = s.succeeded > 0 ? Number((s.artistSum / s.succeeded).toFixed(2)) : 0;
      s.actualMaxSameGenreRatio = s.succeeded > 0 ? Number((s.genreSum / s.succeeded).toFixed(2)) : 0;
    }
    delete s.addedSongsSum;
    delete s.overlapSum;
    delete s.artistSum;
    delete s.genreSum;
  });
  
  summary.fallbackUsed = summary.anyFallbackUsed;
  summary.fallbackReason = Array.from(summary.fallbackReasons).join('; ');
  summary.sampleWarnings = Array.from(summary.sampleWarnings).slice(0, 10);
  summary.sampleSkipReasons = Array.from(summary.sampleSkipReasons).slice(0, 10);
  
  summary.status = batchStatus;
  summary.message = batchStatus === 'failed' ? `Batch success rate too low (${summary.playlistsSucceeded}/${summary.playlistsProcessed}) or diversity failed` : 'Generated successfully';
  summary.canApply = successRate >= 0.85 && finalDiversityPassed && allSlotsPassed;
  
  if (!allSlotsPassed && summary.canApply === false && successRate >= 0.85) {
      summary.message = `Batch overall success rate ok, but one or more slots failed (< 0.85).`;
  }
  
  delete summary.candidateCountSum;
  delete summary.aggregateTiers;
  delete summary.missingAudioFeatureRatioSum;
  delete summary.overlapRatioSum;
  delete summary.addedSongsSum;
  delete summary.removedSongsSum;
  delete summary.artistRatioSum;
  delete summary.genreRatioSum;
  delete summary.worstArtistRatio;
  delete summary.worstGenreRatio;
  delete summary.skippedCount;
  delete summary.failedCount;
  delete summary.anyFallbackUsed;
  delete summary.fallbackReasons;
  delete summary.results;
  delete summary.errors;

  return summary;
}

module.exports = {
  TIME_SLOTS,
  SLOT_PLAYLISTS,
  generateContextualMoodPlaylistForSlot,
  generateContextualMoodPlaylistsForUser,
  generateContextualMoodPlaylistsForAllUsers,
  getEligibleUserIds
};
