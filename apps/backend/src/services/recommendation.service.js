const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const modelService = require('./recommendationModel.service');
const semanticProfileService = require('./songSemanticProfile.service');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const RECENT_LISTEN_DAYS = 30;
const MAX_CANDIDATES = 3000;
const ARTIST_CAP_TOP10 = 2;
const ARTIST_CAP_TOP20 = 4;
const DOMINANT_MARKET_MIN_SHARE = 0.55;
const DOMINANT_MARKET_TOP_SHARE = 0.65;

const SERVING_WEIGHTS = {
  bpr: 0.70,
  content_preference: 0.15,
  popularity: 0.10,
  novelty: 0.05,
  artist_repeat_penalty: 0.04,
  recent_artist_penalty: 0.05,
};

function dotProduct(a, b) {
  if (!a || !b) return 0;
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

function safeNorm(arr) {
  if (!arr || !arr.length) return 0;
  let max = -Infinity;
  let min = Infinity;
  for (const v of arr) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const range = max - min || 1;
  return arr.map((v) => (v - min) / range);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMarket(value) {
  const market = String(value || '').trim().toUpperCase();
  return market || null;
}

function scorePreference(listens, completionSum) {
  return asNumber(listens) + asNumber(completionSum);
}

function pickDominant(rows) {
  if (!rows.length) return null;
  return rows.reduce((best, row) => {
    if (!best) return row;
    if (asNumber(row.score) !== asNumber(best.score)) {
      return asNumber(row.score) > asNumber(best.score) ? row : best;
    }
    if (asNumber(row.listens) !== asNumber(best.listens)) {
      return asNumber(row.listens) > asNumber(best.listens) ? row : best;
    }
    return String(row.name || row.market || '').localeCompare(String(best.name || best.market || '')) < 0 ? row : best;
  }, null);
}


function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

async function fetchRecentListenSongIds(userId, options = {}) {
  let sql = `SELECT song_id, MAX(listened_at) as last_played
             FROM listening_history
             WHERE user_id = ?`;
  const params = [userId];

  if (options.listeningWindow) {
    sql += ` AND listened_at >= ? AND listened_at < ?`;
    params.push(options.listeningWindow.startAt, options.listeningWindow.endAt);
  } else {
    sql += ` AND listened_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
    params.push(RECENT_LISTEN_DAYS);
  }
  sql += ` GROUP BY song_id`;

  const [rows] = await pool.query(sql, params);
  const recentSet = new Set(rows.map((r) => Number(r.song_id)));
  const recentList = rows
    .sort((a, b) => new Date(b.last_played) - new Date(a.last_played))
    .map((r) => Number(r.song_id));
  return { recentSet, recentList };
}

async function fetchAllListenedSongIds(userId, options = {}) {
  let sql = `SELECT DISTINCT song_id FROM listening_history WHERE user_id = ?`;
  const params = [userId];

  if (options.listeningWindow) {
    sql += ` AND listened_at >= ? AND listened_at < ?`;
    params.push(options.listeningWindow.startAt, options.listeningWindow.endAt);
  }

  const [rows] = await pool.query(sql, params);
  return new Set(rows.map((r) => Number(r.song_id)));
}

async function fetchCandidateSongs(excludedSongIds, options = {}) {
  const baseSql = `
    SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
           s.cover_url, s.audio_url, s.play_count, s.created_at,
           a.name AS artist_name, al.title AS album_title, g.name AS genre_name
    FROM songs s
    LEFT JOIN artists a ON a.id = s.artist_id
    LEFT JOIN albums al ON al.id = s.album_id
    LEFT JOIN genres g ON g.id = s.genre_id
    WHERE ${publicSongCondition('s')}
      AND s.audio_url IS NOT NULL
      AND s.audio_url <> ''
  `;

  const runQuery = async (extraCondition, extraParams, orderSql, limit) => {
    if (excludedSongIds && excludedSongIds.size) {
      const placeholders = Array.from(excludedSongIds).map(() => '?').join(',');
      const [rows] = await pool.query(
        `${baseSql} ${extraCondition} AND s.id NOT IN (${placeholders}) ${orderSql} LIMIT ?`,
        [...extraParams, ...excludedSongIds, limit]
      );
      return rows;
    }
    const [rows] = await pool.query(
      `${baseSql} ${extraCondition} ${orderSql} LIMIT ?`,
      [...extraParams, limit]
    );
    return rows;
  };

  const preferredMarket = normalizeMarket(options.preferredMarket);
  if (preferredMarket) {
    const preferredRows = await runQuery('AND UPPER(s.market) = ?', [preferredMarket], 'ORDER BY s.play_count DESC, s.id DESC', MAX_CANDIDATES);
    const globalRows = await runQuery('', [], 'ORDER BY s.play_count DESC, s.id DESC', MAX_CANDIDATES);
    const merged = [];
    const seen = new Set();
    for (const row of [...preferredRows, ...globalRows]) {
      const id = Number(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
      if (merged.length >= MAX_CANDIDATES) break;
    }
    return merged;
  }

  if (excludedSongIds && excludedSongIds.size) {
    return runQuery('', [], 'ORDER BY s.play_count DESC, s.id DESC', MAX_CANDIDATES);
  }
  return runQuery('', [], 'ORDER BY s.play_count DESC, s.id DESC', MAX_CANDIDATES);
}

async function buildUserTasteProfile(userId, options = {}) {
  let extraCond = '';
  const params = [userId];
  if (options.listeningWindow) {
    extraCond = ` AND lh.listened_at >= ? AND lh.listened_at < ?`;
    params.push(options.listeningWindow.startAt, options.listeningWindow.endAt);
  }

  const [marketRows] = await pool.query(`
    SELECT UPPER(TRIM(s.market)) AS market,
           COUNT(*) AS listens,
           COALESCE(SUM(lh.completion_rate), 0) AS completion_sum
    FROM listening_history lh
    JOIN songs s ON s.id = lh.song_id
    WHERE lh.user_id = ?${extraCond}
      AND s.market IS NOT NULL
      AND TRIM(s.market) <> ''
    GROUP BY UPPER(TRIM(s.market))
  `, params);

  const [genreRows] = await pool.query(`
    SELECT s.genre_id,
           g.name,
           UPPER(TRIM(s.market)) AS market,
           COUNT(*) AS listens,
           COALESCE(SUM(lh.completion_rate), 0) AS completion_sum
    FROM listening_history lh
    JOIN songs s ON s.id = lh.song_id
    LEFT JOIN genres g ON g.id = s.genre_id
    WHERE lh.user_id = ?${extraCond}
      AND s.genre_id IS NOT NULL
    GROUP BY s.genre_id, g.name, UPPER(TRIM(s.market))
  `, params);

  const markets = marketRows.map((row) => ({
    market: normalizeMarket(row.market),
    listens: asNumber(row.listens),
    completionSum: asNumber(row.completion_sum),
    score: scorePreference(row.listens, row.completion_sum),
  })).filter((row) => row.market);

  const genres = genreRows.map((row) => ({
    genreId: Number(row.genre_id),
    name: row.name || null,
    market: normalizeMarket(row.market),
    listens: asNumber(row.listens),
    completionSum: asNumber(row.completion_sum),
    score: scorePreference(row.listens, row.completion_sum),
  })).filter((row) => Number.isFinite(row.genreId));

  const dominantMarket = pickDominant(markets);
  const dominantGenre = pickDominant(genres);
  const marketTotalScore = markets.reduce((sum, row) => sum + row.score, 0);
  const marketTotalListens = markets.reduce((sum, row) => sum + row.listens, 0);

  return {
    dominantMarket: dominantMarket?.market || null,
    dominantMarketShare: dominantMarket && marketTotalScore > 0 ? dominantMarket.score / marketTotalScore : 0,
    dominantGenreId: dominantGenre?.genreId || null,
    dominantGenreName: dominantGenre?.name || null,
    dominantGenreMarket: dominantGenre?.market || null,
    marketTotalListens,
    markets,
    genres,
  };
}

function buildUserPreferenceMap(userId, options = {}) {
  let extraCond = '';
  const params = [userId];
  if (options.listeningWindow) {
    extraCond = ` AND lh.listened_at >= ? AND lh.listened_at < ?`;
    params.push(options.listeningWindow.startAt, options.listeningWindow.endAt);
  }

  return Promise.all([
    pool.query(`SELECT UPPER(TRIM(s.market)) AS market,
                       COUNT(*) + COALESCE(SUM(lh.completion_rate), 0) AS c
                FROM listening_history lh
                JOIN songs s ON s.id = lh.song_id
                WHERE lh.user_id = ?${extraCond} AND s.market IS NOT NULL AND TRIM(s.market) <> ''
                GROUP BY UPPER(TRIM(s.market))`, params),
    pool.query(`SELECT s.genre_id,
                       COUNT(*) + COALESCE(SUM(lh.completion_rate), 0) AS c
                FROM listening_history lh
                JOIN songs s ON s.id = lh.song_id
                WHERE lh.user_id = ?${extraCond} AND s.genre_id IS NOT NULL
                GROUP BY s.genre_id`, params),
    pool.query(`SELECT s.artist_id,
                       COUNT(*) + COALESCE(SUM(lh.completion_rate), 0) AS c
                FROM listening_history lh
                JOIN songs s ON s.id = lh.song_id
                WHERE lh.user_id = ?${extraCond} AND s.artist_id IS NOT NULL
                GROUP BY s.artist_id
                ORDER BY c DESC LIMIT 50`, params),
    buildUserTasteProfile(userId, options),
  ]).then(([markets, genres, artists, tasteProfile]) => {
    const marketCounts = new Map();
    markets[0].forEach((r) => marketCounts.set(normalizeMarket(r.market), Number(r.c)));
    const genreCounts = new Map();
    genres[0].forEach((r) => genreCounts.set(Number(r.genre_id), Number(r.c)));
    const artistCounts = new Map();
    artists[0].forEach((r) => artistCounts.set(Number(r.artist_id), Number(r.c)));
    return { marketCounts, genreCounts, artistCounts, tasteProfile };
  });
}

async function buildRegistrationPreferenceMap(userId) {
  const [genres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [userId]);
  const [artists] = await pool.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [userId]);

  const genreCounts = new Map();
  genres.forEach(r => genreCounts.set(Number(r.genre_id), 1));
  const artistCounts = new Map();
  artists.forEach(r => artistCounts.set(Number(r.artist_id), 1));
  
  return {
    marketCounts: new Map(),
    genreCounts,
    artistCounts,
    tasteProfile: {
      dominantMarket: null,
      dominantMarketShare: 0,
      dominantGenreId: null,
      dominantGenreName: null,
      dominantGenreMarket: null,
      marketTotalListens: 0,
      markets: [],
      genres: [],
    },
  };
}

function scoreBpr(model, userIdx, song) {
  const songIdx = model.song_index_map[String(song.id)];
  if (songIdx === undefined || songIdx < 0) return null;
  const userVec = model.user_factors[userIdx];
  const itemVec = model.item_factors[songIdx];
  let score = dotProduct(userVec, itemVec);
  if (model.user_biases) score += model.user_biases[userIdx] || 0;
  if (model.item_biases) score += model.item_biases[songIdx] || 0;
  return score;
}

function applyRerank(scored, preferences, recentList, userSemanticPref) {
  const topScores = scored.map((s) => s.bprScore);
  const normBpr = safeNorm(topScores);

  const popularityScores = scored.map((s) => Number(s.play_count || 0));
  const normPop = safeNorm(popularityScores);

  const maxId = Math.max(...scored.map((s) => Number(s.id)), 1);
  const noveltyScores = scored.map((s) => 1 - Number(s.id) / maxId);
  const normNov = safeNorm(noveltyScores);

  const marketTotal = [...preferences.marketCounts.values()].reduce((s, v) => s + v, 0) || 1;
  const genreTotal = [...preferences.genreCounts.values()].reduce((s, v) => s + v, 0) || 1;

  const recentSet = new Set(recentList);
  const recentArtistSet = new Set();
  for (const sid of recentList) {
    const s = scored.find((x) => Number(x.id) === sid);
    if (s && s.artist_id) recentArtistSet.add(Number(s.artist_id));
  }

  const final = scored.map((s, i) => {
    let contentScore = 0;
    const market = normalizeMarket(s.market);
    if (market && preferences.marketCounts.has(market)) {
      contentScore += (preferences.marketCounts.get(market) / marketTotal) * 0.5;
    }
    if (s.genre_id !== null && s.genre_id !== undefined && preferences.genreCounts.has(Number(s.genre_id))) {
      contentScore += (preferences.genreCounts.get(Number(s.genre_id)) / genreTotal) * 0.5;
    }
    let artistBoost = 0;
    if (s.artist_id && preferences.artistCounts.has(Number(s.artist_id))) {
      const strongDominantMarket = preferences.tasteProfile?.dominantMarket
        && preferences.tasteProfile.dominantMarketShare >= DOMINANT_MARKET_MIN_SHARE;
      const sameDominantMarket = normalizeMarket(s.market) === preferences.tasteProfile?.dominantMarket;
      artistBoost = strongDominantMarket && !sameDominantMarket ? 0.02 : 0.1;
    }

    const semanticScore = userSemanticPref ? semanticProfileService.scoreSongBySemanticPreference(s, userSemanticPref) : 0;
    
    const rerankContentScore = clamp01(contentScore + artistBoost);

    const raw =
      0.60 * clamp01(normBpr[i]) +
      0.12 * rerankContentScore +
      0.15 * clamp01(semanticScore) +
      0.08 * clamp01(normPop[i]) +
      0.05 * clamp01(normNov[i]);

    let penalty = 0;
    if (recentSet.has(Number(s.id))) penalty += SERVING_WEIGHTS.recent_artist_penalty;
    if (s.artist_id && recentArtistSet.has(Number(s.artist_id))) penalty += SERVING_WEIGHTS.artist_repeat_penalty;

    return {
      ...s,
      bprRaw: s.bprScore,
      bprNorm: normBpr[i],
      semanticScore,
      finalScore: Math.max(0, raw - penalty),
    };
  });

  final.sort((a, b) => b.finalScore - a.finalScore || Number(a.id) - Number(b.id));
  const guarded = applyDominantMarketGuard(final, preferences, MAX_LIMIT);

  const artistCount = new Map();
  const accepted = [];
  for (const cand of guarded) {
    if (accepted.length >= MAX_LIMIT) break;
    const aid = cand.artist_id !== null && cand.artist_id !== undefined ? Number(cand.artist_id) : null;
    const cnt = aid !== null ? (artistCount.get(aid) || 0) : 0;
    if (accepted.length < 10 && aid !== null && cnt >= ARTIST_CAP_TOP10) continue;
    if (accepted.length < 20 && aid !== null && cnt >= ARTIST_CAP_TOP20) continue;
    accepted.push(cand);
    if (aid !== null) artistCount.set(aid, cnt + 1);
  }
  return accepted;
}

function applyDominantMarketGuard(ranked, preferences, limit) {
  const dominantMarket = preferences.tasteProfile?.dominantMarket || null;
  const dominantShare = preferences.tasteProfile?.dominantMarketShare || 0;
  if (!dominantMarket || dominantShare < DOMINANT_MARKET_MIN_SHARE || ranked.length <= 1) {
    return ranked;
  }

  const normalizedLimit = Math.min(limit || ranked.length, ranked.length);
  const targetCount = Math.min(
    ranked.filter((song) => normalizeMarket(song.market) === dominantMarket).length,
    Math.ceil(normalizedLimit * DOMINANT_MARKET_TOP_SHARE)
  );
  if (targetCount <= 0) return ranked;

  const dominant = ranked.filter((song) => normalizeMarket(song.market) === dominantMarket);
  const others = ranked.filter((song) => normalizeMarket(song.market) !== dominantMarket);
  const result = [];
  let dominantIndex = 0;
  let otherIndex = 0;

  while (result.length < normalizedLimit && (dominantIndex < dominant.length || otherIndex < others.length)) {
    const dominantNeeded = targetCount - dominantIndex;
    const slotsLeft = normalizedLimit - result.length;
    if (dominantNeeded >= slotsLeft && dominantIndex < dominant.length) {
      result.push(dominant[dominantIndex++]);
      continue;
    }

    const nextDominant = dominant[dominantIndex];
    const nextOther = others[otherIndex];
    if (!nextOther || (nextDominant && nextDominant.finalScore >= nextOther.finalScore)) {
      if (nextDominant) result.push(nextDominant), dominantIndex++;
      else result.push(nextOther), otherIndex++;
    } else if (dominantIndex < targetCount && dominantIndex < dominant.length) {
      result.push(nextDominant);
      dominantIndex++;
    } else {
      result.push(nextOther);
      otherIndex++;
    }
  }

  const used = new Set(result.map((song) => Number(song.id)));
  const rest = ranked.filter((song) => !used.has(Number(song.id)));
  return [...result, ...rest];
}

function applyArtistDiversity(ranked, limit) {
  const artistCount = new Map();
  const accepted = [];
  const deferred = [];

  for (const cand of ranked) {
    const aid = cand.artist_id !== null && cand.artist_id !== undefined ? Number(cand.artist_id) : null;
    const cnt = aid !== null ? (artistCount.get(aid) || 0) : 0;
    const top10CapHit = accepted.length < 10 && aid !== null && cnt >= ARTIST_CAP_TOP10;
    const top20CapHit = accepted.length < 20 && aid !== null && cnt >= ARTIST_CAP_TOP20;
    if (top10CapHit || top20CapHit) {
      deferred.push(cand);
      continue;
    }
    accepted.push(cand);
    if (aid !== null) artistCount.set(aid, cnt + 1);
    if (accepted.length >= limit) break;
  }

  if (accepted.length < limit) {
    const used = new Set(accepted.map((song) => Number(song.id)));
    for (const cand of deferred) {
      if (accepted.length >= limit) break;
      if (used.has(Number(cand.id))) continue;
      accepted.push(cand);
      used.add(Number(cand.id));
    }
  }

  return accepted;
}

async function buildBprRecommendations(userId, model, limit, options = {}) {
  const userIdx = modelService.getUserIndex(userId);
  if (userIdx < 0) return { strategy: 'bpr_mf', reason: 'user_not_in_model', items: [] };

  const { recentSet, recentList } = await fetchRecentListenSongIds(userId, options);
  const allListened = await fetchAllListenedSongIds(userId, options);
  const excluded = new Set([...recentSet, ...allListened]);
  excluded.delete(0);

  const preferences = await buildUserPreferenceMap(userId, options);
  const userSemanticPref = await semanticProfileService.buildUserSemanticPreference(userId, options);

  const candidates = await fetchCandidateSongs(excluded, {
    preferredMarket: preferences.tasteProfile?.dominantMarketShare >= DOMINANT_MARKET_MIN_SHARE
      ? preferences.tasteProfile.dominantMarket
      : null,
  });
  if (!candidates.length) return { strategy: 'bpr_mf', reason: 'no_candidates', items: [], tasteProfile: preferences.tasteProfile };

  const scored = [];
  for (const song of candidates) {
    const s = scoreBpr(model, userIdx, song);
    if (s === null) continue;
    scored.push({ ...song, bprScore: s });
  }
  if (!scored.length) return { strategy: 'bpr_mf', reason: 'no_scored', items: [], tasteProfile: preferences.tasteProfile };

  await semanticProfileService.attachSemanticProfiles(scored);
  const reranked = applyRerank(scored, preferences, recentList, userSemanticPref);
  return { strategy: 'bpr_mf_rerank', reason: 'ok', items: reranked.slice(0, limit), tasteProfile: preferences.tasteProfile };
}

async function buildContentBasedRecommendations(userId, limit, options = {}) {
  const listened = await fetchAllListenedSongIds(userId, options);
  const preferences = await buildUserPreferenceMap(userId, options);

  if (preferences.marketCounts.size === 0 && preferences.genreCounts.size === 0 && preferences.artistCounts.size === 0) {
    return { strategy: 'content_based_fallback', reason: 'no_preferences', items: [], tasteProfile: preferences.tasteProfile };
  }

  const marketTotal = [...preferences.marketCounts.values()].reduce((s, v) => s + v, 0) || 1;
  const genreTotal = [...preferences.genreCounts.values()].reduce((s, v) => s + v, 0) || 1;

  const candidates = await fetchCandidateSongs(listened, {
    preferredMarket: preferences.tasteProfile?.dominantMarketShare >= DOMINANT_MARKET_MIN_SHARE
      ? preferences.tasteProfile.dominantMarket
      : null,
  });
  if (!candidates.length) return { strategy: 'content_based_fallback', reason: 'no_candidates', items: [], tasteProfile: preferences.tasteProfile };

  const userSemanticPref = await semanticProfileService.buildUserSemanticPreference(userId, options);
  await semanticProfileService.attachSemanticProfiles(candidates);

  const scored = candidates.map((song) => {
    let score = 0;
    const market = normalizeMarket(song.market);
    if (market && preferences.marketCounts.has(market)) {
      score += (preferences.marketCounts.get(market) / marketTotal) * 0.45;
    }
    if (song.genre_id !== null && song.genre_id !== undefined && preferences.genreCounts.has(Number(song.genre_id))) {
      score += (preferences.genreCounts.get(Number(song.genre_id)) / genreTotal) * 0.35;
    }
    if (song.artist_id && preferences.artistCounts.has(Number(song.artist_id))) {
      const strongDominantMarket = preferences.tasteProfile?.dominantMarket
        && preferences.tasteProfile.dominantMarketShare >= DOMINANT_MARKET_MIN_SHARE;
      const sameDominantMarket = normalizeMarket(song.market) === preferences.tasteProfile?.dominantMarket;
      const rank = [...preferences.artistCounts.entries()].sort((a, b) => b[1] - a[1])
        .findIndex(([aid]) => aid === Number(song.artist_id));
      score += (strongDominantMarket && !sameDominantMarket ? 0.03 : 0.2) * Math.max(0, 1 - rank / 20);
    }
    const dominantMarket = preferences.tasteProfile?.dominantMarket;
    if (dominantMarket && preferences.tasteProfile.dominantMarketShare >= DOMINANT_MARKET_MIN_SHARE) {
      if (normalizeMarket(song.market) === dominantMarket) {
        score += 0.3 * preferences.tasteProfile.dominantMarketShare;
      } else {
        score *= 0.45;
      }
    }

    const semanticScore = userSemanticPref ? semanticProfileService.scoreSongBySemanticPreference(song, userSemanticPref) : 0;

    return { 
      ...song, 
      finalScore: score * 0.65 + semanticScore * 0.35,
      semanticScore,
      cbRaw: score
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore || Number(a.id) - Number(b.id));
  const guarded = applyDominantMarketGuard(scored, preferences, limit);
  const diversified = applyArtistDiversity(guarded, limit);
  return { strategy: 'content_based_fallback', reason: 'ok', items: diversified.slice(0, limit), tasteProfile: preferences.tasteProfile };
}

async function buildPopularRecommendations(userId, limit, options = {}) {
  const listened = await fetchAllListenedSongIds(userId, options);
  const candidates = await fetchCandidateSongs(listened);
  if (!candidates.length) return { strategy: 'popular_fallback', reason: 'no_candidates', items: [] };
  return { strategy: 'popular_fallback', reason: 'ok', items: candidates.slice(0, limit) };
}

async function buildColdStartRecommendations(userId, limit, pref) {
  const genreIds = Array.from(pref.genreCounts.keys());
  const artistIds = Array.from(pref.artistCounts.keys());

  let sql = `
    SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
           s.cover_url, s.audio_url, s.play_count, s.created_at,
           a.name AS artist_name, al.title AS album_title, g.name AS genre_name
    FROM songs s
    LEFT JOIN artists a ON a.id = s.artist_id
    LEFT JOIN albums al ON al.id = s.album_id
    LEFT JOIN genres g ON g.id = s.genre_id
    WHERE ${publicSongCondition('s')}
      AND s.audio_url IS NOT NULL
      AND s.audio_url <> ''
  `;

  let conditions = [];
  let params = [];
  if (genreIds.length > 0) {
    conditions.push(`s.genre_id IN (?)`);
    params.push(genreIds);
  }
  if (artistIds.length > 0) {
    conditions.push(`s.artist_id IN (?)`);
    params.push(artistIds);
  }

  let sqlFinal;
  if (conditions.length > 0) {
    sqlFinal = sql + ` AND (${conditions.join(' OR ')}) ORDER BY s.play_count DESC, s.id DESC LIMIT 500`;
  } else {
    sqlFinal = sql + ` ORDER BY s.play_count DESC, s.id DESC LIMIT 500`;
  }

  const [candidates] = await pool.query(sqlFinal, params);

  const scored = candidates.map((song) => {
    let score = Number(song.play_count || 0) / 10000;
    if (song.genre_id && pref.genreCounts.has(Number(song.genre_id))) {
      score += 1000;
    }
    if (song.artist_id && pref.artistCounts.has(Number(song.artist_id))) {
      score += 2000;
    }
    return { ...song, finalScore: score };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore || Number(a.id) - Number(b.id));

  const artistCount = new Map();
  const genreCount = new Map();
  const accepted = [];
  
  const limitPerGenre = genreIds.length > 0 ? Math.ceil(limit / genreIds.length) + 2 : limit;

  for (const cand of scored) {
    if (accepted.length >= limit) break;
    const aid = cand.artist_id !== null && cand.artist_id !== undefined ? Number(cand.artist_id) : null;
    const gid = cand.genre_id !== null && cand.genre_id !== undefined ? Number(cand.genre_id) : null;
    
    const acnt = aid !== null ? (artistCount.get(aid) || 0) : 0;
    const gcnt = gid !== null ? (genreCount.get(gid) || 0) : 0;

    if (accepted.length < 10 && aid !== null && acnt >= ARTIST_CAP_TOP10) continue;
    if (accepted.length < 20 && aid !== null && acnt >= ARTIST_CAP_TOP20) continue;
    if (aid !== null && acnt >= 4) continue;

    if (genreIds.length > 1 && gid !== null && pref.genreCounts.has(gid)) {
      if (gcnt >= limitPerGenre && cand.finalScore < 2000) continue;
    }

    accepted.push(cand);
    if (aid !== null) artistCount.set(aid, acnt + 1);
    if (gid !== null) genreCount.set(gid, gcnt + 1);
  }

  if (accepted.length < limit) {
    const [popular] = await pool.query(sql + ` ORDER BY s.play_count DESC LIMIT ?`, [limit]);
    const acceptedIds = new Set(accepted.map(a => a.id));
    for (const cand of popular) {
      if (accepted.length >= limit) break;
      if (acceptedIds.has(cand.id)) continue;
      accepted.push({ ...cand, finalScore: 0 });
    }
  }

  return { strategy: 'cold_start_preferences', reason: 'ok', items: accepted };
}

function shapeItem(song, req) {
  return {
    id: Number(song.id),
    title: song.title,
    artist_id: song.artist_id !== null && song.artist_id !== undefined ? Number(song.artist_id) : null,
    artist_name: song.artist_name || null,
    album_id: song.album_id !== null && song.album_id !== undefined ? Number(song.album_id) : null,
    album_title: song.album_title || null,
    genre_id: song.genre_id !== null && song.genre_id !== undefined ? Number(song.genre_id) : null,
    genre_name: song.genre_name || null,
    market: song.market || null,
    duration: song.duration_sec || null,
    cover_url: normalizeCoverUrl(song.cover_url || song.audio_url, req),
    audio_url: normalizeCoverUrl(song.audio_url, req),
    play_count: Number(song.play_count || 0),
    recommendation_score: Number((song.finalScore ?? song.bprScore ?? 0).toFixed(4)),
  };
}

async function getRecommendationsForUser(userId, options = {}) {
  const limit = clampLimit(options.limit);
  const req = options.req || null;

  const result = await getRecommendationsForUserRaw(userId, limit, options);
  const items = result.items.map((s) => shapeItem(s, req));
  return {
    strategy: result.strategy,
    reason: result.reason,
    tasteProfile: result.tasteProfile || null,
    items,
  };
}

async function getRecommendationsForUserRaw(userId, limit, options = {}) {
  const listened = await fetchAllListenedSongIds(userId, options);

  if (listened.size === 0) {
    const pref = await buildRegistrationPreferenceMap(userId);
    if (pref.genreCounts.size > 0 || pref.artistCounts.size > 0) {
      return buildColdStartRecommendations(userId, limit, pref);
    }
    return buildPopularRecommendations(userId, limit, options);
  }

  const loadResult = modelService.tryLoad();
  if (loadResult.ok && loadResult.model) {
    const model = loadResult.model;
    if (modelService.getUserIndex(userId) >= 0) {
      const built = await buildBprRecommendations(userId, model, limit, options);
      if (built.items.length >= Math.min(5, limit)) return built;
    }
    const cb = await buildContentBasedRecommendations(userId, limit, options);
    if (cb.items.length >= Math.min(5, limit)) return cb;
    return buildPopularRecommendations(userId, limit, options);
  }
  console.warn('[recommendation] BPR-MF model unavailable, using fallback. status:', modelService.getLoadStatus());
  const cb = await buildContentBasedRecommendations(userId, limit, options);
  if (cb.items.length >= Math.min(5, limit)) return cb;
  return buildPopularRecommendations(userId, limit, options);
}

function reasonForStrategy(strategy) {
  switch (strategy) {
    case 'bpr_mf':
    case 'bpr_mf_rerank':
      return 'Dựa trên hành vi nghe nhạc tương tự của bạn (BPR-MF)';
    case 'content_based_fallback':
      return 'Dựa trên những bài hát bạn đã nghe gần đây';
    case 'cold_start_preferences':
      return 'Dựa trên thể loại và nghệ sĩ bạn đã chọn khi đăng ký';
    case 'popular_fallback':
      return 'Những bài hát được nghe nhiều gần đây';
    default:
      return 'Gợi ý dành cho bạn';
  }
}

module.exports = {
  getRecommendationsForUser,
  getRecommendationsForUserRaw,
  reasonForStrategy,
  SERVING_WEIGHTS,
  clampLimit,
  buildUserTasteProfile,
  applyDominantMarketGuard,
};
