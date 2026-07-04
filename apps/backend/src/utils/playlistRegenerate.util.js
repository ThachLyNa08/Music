// apps/backend/src/utils/playlistRegenerate.util.js

const { pool } = require('../config/database');

function calculateOverlapRatio(oldIds = [], newIds = []) {
  if (!oldIds.length || !newIds.length) return 0;
  const oldSet = new Set(oldIds.map(Number));
  const overlap = newIds.filter(id => oldSet.has(Number(id))).length;
  return overlap / newIds.length;
}

function computeOverlapStats(oldIds = [], newIds = []) {
  const oldSet = new Set(oldIds.map(Number));
  const newSet = new Set(newIds.map(Number));
  const overlap = newIds.filter(id => oldSet.has(Number(id))).length;
  const overlapRatio = newIds.length > 0 ? overlap / newIds.length : 0;
  const addedSongs = newIds.filter(id => !oldSet.has(Number(id))).length;
  const removedSongs = oldIds.filter(id => !newSet.has(Number(id))).length;
  return { overlap, overlapRatio, addedSongs, removedSongs, oldSongs: oldSet.size, newSongs: newSet.size };
}

/**
 * Lọc candidate pool để đạt targetSize mà vẫn đảm bảo overlap ratio không vượt quá maxOverlap
 * @param {Array} candidates - Danh sách đã sort theo score (chứa id hoặc object có field .id)
 * @param {Array} oldIds - Danh sách song_id cũ
 * @param {number} targetSize - Số lượng bài hát muốn chọn
 * @param {number} maxOverlap - Ngưỡng overlap lý tưởng (default 0.7)
 */
function selectSongsWithOverlapCheck(candidates, oldIds, targetSize, maxOverlap = 0.70) {
  if (candidates.length <= targetSize) return candidates;
  
  const oldSet = new Set(oldIds.map(Number));
  let selected = candidates.slice(0, targetSize);
  
  let overlap = selected.filter(c => oldSet.has(Number(c.id || c))).length;
  let overlapRatio = overlap / targetSize;
  
  if (overlapRatio > maxOverlap) {
    let oldSelected = selected.filter(c => oldSet.has(Number(c.id || c)));
    let newSelected = selected.filter(c => !oldSet.has(Number(c.id || c)));
    
    const remainingNew = candidates.slice(targetSize).filter(c => !oldSet.has(Number(c.id || c)));
    
    while (oldSelected.length / targetSize > maxOverlap && remainingNew.length > 0) {
      oldSelected.pop(); // Bỏ bài cũ có score thấp nhất
      newSelected.push(remainingNew.shift()); // Thêm bài mới có score cao nhất
    }
    
    // Gộp lại (có thể shuffle hoặc sort lại nếu cần, ở đây chỉ merge)
    selected = [...newSelected, ...oldSelected];
  }
  
  return selected;
}

/**
 * Lấy danh sách ID hiện tại của playlist (để dùng cho overlap check)
 */
async function getPlaylistSongIds(conn, playlistId) {
  const [rows] = await conn.query('SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position', [playlistId]);
  return rows.map(r => Number(r.song_id));
}

/**
 * Lấy các song_id nằm trong system playlists khác cập nhật 7 ngày qua để tránh trùng
 */
async function getRecentSystemPlaylistSongs(conn, excludeKey) {
  const [rows] = await conn.query(`
    SELECT DISTINCT ps.song_id
    FROM playlist_songs ps
    JOIN playlists p ON p.id = ps.playlist_id
    WHERE p.is_system = 1
      AND p.system_key <> ?
      AND p.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  `, [excludeKey]);
  return new Set(rows.map(r => Number(r.song_id)));
}

function evaluateRegenerateQuality(stats, targetSize, limits) {
  const warningMsgs = [];
  const sampleSkipReasons = [];
  let status = 'success';
  let message = 'Generated successfully';
  let canApply = true;

  if (stats.candidateCount <= targetSize) {
    warningMsgs.push('Candidate pool too small');
    status = 'warning';
  }

  if (stats.overlapRatio === 1) {
    warningMsgs.push('Playlist content unchanged (100% overlap)');
    status = 'skipped';
    canApply = false;
  } else if (stats.overlapRatio >= 0.9) {
    warningMsgs.push('Playlist content too similar to previous version');
    status = 'skipped';
    canApply = false;
  } else if (stats.overlapRatio > 0.7) {
    warningMsgs.push('Overlap ratio > 70%');
    status = 'warning';
  }

  if (stats.newSongs < Math.floor(targetSize * 0.5) && canApply) {
    warningMsgs.push('Not enough songs selected');
    status = 'failed';
    canApply = false;
  }
  
  if (limits && stats.finalDiversity) {
    const actualArtist = stats.finalDiversity.maxSameArtistRatio;
    const actualGenre = stats.finalDiversity.maxSameGenreRatio;
    const maxArtistSongs = Math.floor(targetSize * limits.maxSameArtistRatio);
    const maxGenreSongs = Math.floor(targetSize * limits.maxSameGenreRatio);
    const exactArtistPassed = (stats.finalDiversity.maxSameArtistCount || 0) <= maxArtistSongs;
    const exactGenrePassed = (stats.finalDiversity.maxSameGenreCount || 0) <= maxGenreSongs;

    if (!exactArtistPassed || !exactGenrePassed) {
      warningMsgs.push(`Final diversity quota failed (artist: ${(actualArtist*100).toFixed(0)}%, genre: ${(actualGenre*100).toFixed(0)}%)`);
      status = 'failed';
      canApply = false;
      sampleSkipReasons.push({
        reason: 'Final exact diversity quota failed',
        actualMaxSameArtistRatio: actualArtist,
        actualMaxSameGenreRatio: actualGenre,
        maxArtistSongs,
        maxGenreSongs,
        targetSize
      });
    } else if (stats.relaxedDiversityUsed) {
      warningMsgs.push('Relaxed diversity backfill used');
      status = status === 'success' ? 'warning' : status;
    }
  }

  if (warningMsgs.length > 0) {
    message = warningMsgs.join('; ');
  }

  return { status, message, canApply, sampleSkipReasons };
}

function calculatePlaylistDiversity(songs) {
  if (!songs || songs.length === 0) {
    return { maxSameArtistCount: 0, maxSameGenreCount: 0, maxSameArtistRatio: 0, maxSameGenreRatio: 0 };
  }
  
  const artistCounts = {};
  const genreCounts = {};
  
  for (const song of songs) {
    const aid = song.artist_id || `unknown_artist_${song.id || song.song_id}`;
    const gid = song.genre_id || `unknown_genre_${song.id || song.song_id}`;
    artistCounts[aid] = (artistCounts[aid] || 0) + 1;
    genreCounts[gid] = (genreCounts[gid] || 0) + 1;
  }
  
  const maxArtistCount = Math.max(...Object.values(artistCounts));
  const maxGenreCount = Math.max(...Object.values(genreCounts));
  
  return {
    maxSameArtistCount: maxArtistCount,
    maxSameGenreCount: maxGenreCount,
    maxSameArtistRatio: maxArtistCount / songs.length,
    maxSameGenreRatio: maxGenreCount / songs.length
  };
}

function selectSongsWithDiversityAndOverlapCheck(candidates, oldIds, targetSize, limits) {
  const { maxSameArtistRatio, maxSameGenreRatio, maxOverlap = 0.90 } = limits;
  const oldSet = new Set(oldIds.map(Number));
  
  const maxPerArtist = Math.floor(targetSize * maxSameArtistRatio);
  const maxPerGenre = Math.floor(targetSize * maxSameGenreRatio);
  
  const selected = [];
  const artistCounts = new Map();
  const genreCounts = new Map();
  const selectedSet = new Set();
  
  let fallbackUsed = false;
  let fallbackReason = null;
  let relaxedDiversityUsed = false;

  const songIdOf = (song) => Number(song.id || song.song_id || song);
  const artistKeyOf = (song) => song.artist_id || `unknown_artist_${songIdOf(song)}`;
  const genreKeyOf = (song) => song.genre_id || `unknown_genre_${songIdOf(song)}`;
  const getCount = (map, key) => map.get(key) || 0;
  const incCount = (map, key) => map.set(key, getCount(map, key) + 1);
  const decCount = (map, key) => {
    const next = getCount(map, key) - 1;
    if (next > 0) map.set(key, next);
    else map.delete(key);
  };

  function canAdd(candidate, artistLimit = maxPerArtist, genreLimit = maxPerGenre) {
    const songId = songIdOf(candidate);
    if (!Number.isFinite(songId) || selectedSet.has(songId)) return false;
    if (getCount(artistCounts, artistKeyOf(candidate)) >= artistLimit) return false;
    if (getCount(genreCounts, genreKeyOf(candidate)) >= genreLimit) return false;
    return true;
  }

  function addCandidate(candidate) {
    const songId = songIdOf(candidate);
    selected.push(candidate);
    selectedSet.add(songId);
    incCount(artistCounts, artistKeyOf(candidate));
    incCount(genreCounts, genreKeyOf(candidate));
  }

  function removeSelectedAt(index) {
    const [removed] = selected.splice(index, 1);
    selectedSet.delete(songIdOf(removed));
    decCount(artistCounts, artistKeyOf(removed));
    decCount(genreCounts, genreKeyOf(removed));
    return removed;
  }

  function chooseBestIndex(pool, artistLimit = maxPerArtist, genreLimit = maxPerGenre) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (!canAdd(c, artistLimit, genreLimit)) continue;
      const gid = genreKeyOf(c);
      let adjustedScore = c.score || 0;
      const currentGenreCount = getCount(genreCounts, gid);
      adjustedScore -= (currentGenreCount / targetSize) * 1.0;
      if (oldSet.has(songIdOf(c))) adjustedScore -= 0.8;
      if (currentGenreCount === 0) adjustedScore += 0.35;
      
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
  
  // Pass 1: strict quota.
  let unselectedCandidates = [...candidates];
  while (selected.length < targetSize && unselectedCandidates.length > 0) {
    const bestIdx = chooseBestIndex(unselectedCandidates);
    if (bestIdx === -1) break;
    addCandidate(unselectedCandidates.splice(bestIdx, 1)[0]);
  }
  
  // Pass 2: re-score the whole remaining pool with novelty pressure, still strict.
  if (selected.length < targetSize) {
    fallbackUsed = true;
    fallbackReason = 'expanded strict diversity backfill used';
    while (selected.length < targetSize && unselectedCandidates.length > 0) {
      const bestIdx = chooseBestIndex(unselectedCandidates);
      if (bestIdx === -1) break;
      addCandidate(unselectedCandidates.splice(bestIdx, 1)[0]);
    }
  }
  
  // Pass 3: only relax by one song when the candidate pool is genuinely small.
  if (selected.length < targetSize && candidates.length < targetSize * 3) {
    fallbackUsed = true;
    fallbackReason = 'small candidate pool required +1 diversity relaxation';
    relaxedDiversityUsed = true;
    const relaxArtist = maxPerArtist + 1;
    const relaxGenre = maxPerGenre + 1;
    while (selected.length < targetSize && unselectedCandidates.length > 0) {
      const bestIdx = chooseBestIndex(unselectedCandidates, relaxArtist, relaxGenre);
      if (bestIdx === -1) break;
      addCandidate(unselectedCandidates.splice(bestIdx, 1)[0]);
    }
  }
  
  // Overlap check: swap old songs with new songs only when the replacement keeps quotas valid.
  let overlap = selected.filter(c => oldSet.has(Number(c.id || c.song_id))).length;
  let overlapRatio = overlap / targetSize;
  
  if (overlapRatio > maxOverlap) {
    const remainingNew = candidates.filter(c => 
      !oldSet.has(songIdOf(c)) && !selectedSet.has(songIdOf(c))
    );
    
    while (overlap / targetSize > maxOverlap && remainingNew.length > 0) {
      const oldIdx = selected
        .map((song, index) => ({ song, index }))
        .filter(item => oldSet.has(songIdOf(item.song)))
        .sort((a, b) => (a.song.score || 0) - (b.song.score || 0))[0]?.index;
      if (oldIdx === undefined) break;

      const removed = removeSelectedAt(oldIdx);
      const replacementIdx = chooseBestIndex(remainingNew, relaxedDiversityUsed ? maxPerArtist + 1 : maxPerArtist, relaxedDiversityUsed ? maxPerGenre + 1 : maxPerGenre);
      if (replacementIdx === -1) {
        addCandidate(removed);
        break;
      }
      addCandidate(remainingNew.splice(replacementIdx, 1)[0]);
      overlap = selected.filter(c => oldSet.has(songIdOf(c))).length;
    }
  }
  
  return { selected, fallbackUsed, fallbackReason, relaxedDiversityUsed, maxArtistSongs: maxPerArtist, maxGenreSongs: maxPerGenre };
}

module.exports = {
  calculateOverlapRatio,
  computeOverlapStats,
  selectSongsWithOverlapCheck,
  selectSongsWithDiversityAndOverlapCheck,
  calculatePlaylistDiversity,
  getPlaylistSongIds,
  getRecentSystemPlaylistSongs,
  evaluateRegenerateQuality
};
