const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const { tableExists, getExistingColumns } = require('../utils/dbIntrospection');
const modelService = require('./recommendationModel.service');
const semanticProfileService = require('./songSemanticProfile.service');
const userTempoProfileService = require('./userTempoProfile.service');
const {
  computeTempoMatchScore,
  computeEnergyMatchScore,
  computeDanceabilityMatchScore,
  buildTempoReason,
} = require('../utils/tempoFeature.util');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const RECENT_LISTEN_DAYS = 30;
const MAX_CANDIDATES = 3000;
const ARTIST_CAP_TOP10 = 2;
const ARTIST_CAP_TOP20 = 4;
const DOMINANT_MARKET_MIN_SHARE = 0.55;
const DOMINANT_MARKET_TOP_SHARE = 0.65;
const SERVING_VERSION = 'v4';
const CORE_MODEL_LABEL = 'LightGCN Hybrid V4';
const SONG_VERIFY_CACHE_TTL_MS = 60 * 1000;
const TEMPO_PROFILE_CONFIDENCE_THRESHOLD = 0.2;

const STRATEGY_LABELS = {
  lightgcn_hybrid_v4: 'LightGCN Hybrid V4',
  content_based_v4: 'Content-Based V4',
  content_based_v4_runtime: 'Content-Based V4 Runtime',
  most_popular_v4: 'Most Popular V4',
  cold_start_v4: 'Cold-start V4',
};

const verifiedSongsCache = new Map();

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

function normalizeFallbackUsed(value, strategy) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return strategy !== 'lightgcn_hybrid_v4';
}

function fallbackChainFrom(value, strategy) {
  if (Array.isArray(value)) return value;
  if (normalizeFallbackUsed(value, strategy)) return [strategy];
  return [];
}

function getServingMetadata(result = {}) {
  const strategy = result.strategy || 'most_popular_v4';
  return {
    strategy,
    strategyLabel: result.strategyLabel || STRATEGY_LABELS[strategy] || CORE_MODEL_LABEL,
    servingVersion: result.servingVersion || SERVING_VERSION,
    coreModel: result.coreModel || CORE_MODEL_LABEL,
    fallbackUsed: normalizeFallbackUsed(result.fallbackUsed, strategy),
    fallbackReason: result.fallbackReason || (normalizeFallbackUsed(result.fallbackUsed, strategy) ? result.reason || 'fallback_required' : null),
    legacyV3Used: false,
    tempoAware: Boolean(result.tempoAware),
  };
}

function withV4Serving(result, overrides = {}) {
  const strategy = overrides.strategy || result.strategy || 'most_popular_v4';
  const fallbackChain = overrides.fallbackChain || fallbackChainFrom(overrides.fallbackUsed ?? result.fallbackUsed, strategy);
  return {
    ...result,
    strategy,
    strategyLabel: overrides.strategyLabel || result.strategyLabel || STRATEGY_LABELS[strategy] || CORE_MODEL_LABEL,
    servingVersion: SERVING_VERSION,
    coreModel: CORE_MODEL_LABEL,
    fallbackUsed: overrides.fallbackUsed ?? normalizeFallbackUsed(result.fallbackUsed, strategy),
    fallbackReason: overrides.fallbackReason ?? result.fallbackReason ?? (normalizeFallbackUsed(overrides.fallbackUsed ?? result.fallbackUsed, strategy) ? result.reason || 'fallback_required' : null),
    fallbackChain,
    legacyV3Used: false,
  };
}

function normalizeServingArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') return {};
  return artifact.recommendations && typeof artifact.recommendations === 'object'
    ? artifact.recommendations
    : artifact;
}

function normalizeServingArtifactStrategy(strategy) {
  if (strategy === 'content_based_v4_runtime' || strategy === 'content_based_fallback') return 'content_based_v4';
  if (strategy === 'popular_fallback') return 'most_popular_v4';
  if (strategy === 'cold_start_preferences') return 'cold_start_v4';
  return strategy || 'most_popular_v4';
}

async function getServingArtifactResult(userId, limit) {
  const loadResult = typeof modelService.tryLoadArtifact === 'function'
    ? modelService.tryLoadArtifact('serving')
    : { ok: false };
  if (!loadResult.ok || !loadResult.model) return null;

  const servingMap = normalizeServingArtifact(loadResult.model);
  const entry = servingMap[String(userId)];
  if (!entry) return null;

  const recs = Array.isArray(entry) ? entry : (entry.items || entry.recommendations || []);
  if (!Array.isArray(recs) || recs.length === 0) return null;

  const songIds = recs.map((r) => r.song_id ?? r.id);
  const validSongs = await fetchValidSongs(songIds);
  if (validSongs.length < Math.min(5, limit)) return null;

  const scoreMap = new Map();
  recs.forEach((r) => scoreMap.set(Number(r.song_id ?? r.id), r.finalScore ?? r.final_score ?? r.score ?? 0));
  validSongs.forEach((song) => {
    song.finalScore = scoreMap.get(Number(song.id)) || 0;
  });

  const strategy = normalizeServingArtifactStrategy(entry.strategy);
  const fallbackUsed = entry.fallbackUsed ?? strategy !== 'lightgcn_hybrid_v4';
  const fallbackReason = entry.fallbackReason || (fallbackUsed ? entry.reason || 'user_not_in_lightgcn_serving_artifact' : null);
  const layered = await applyTempoAwareLayer(userId, {
    strategy,
    strategyLabel: entry.strategyLabel || STRATEGY_LABELS[strategy],
    reason: entry.reason || 'serving_artifact',
    items: validSongs.slice(0, limit),
  }, limit);
  return withV4Serving(layered, {
    strategy,
    strategyLabel: entry.strategyLabel || STRATEGY_LABELS[strategy],
    fallbackUsed,
    fallbackReason,
    fallbackChain: entry.fallbackChain || (fallbackUsed ? ['content_based_v4', 'most_popular_v4'] : []),
  });
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

async function fetchAudioFeaturesForSongs(songIds) {
  const ids = [...new Set((songIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length || !(await tableExists('song_audio_features'))) return new Map();

  const columns = await getExistingColumns('song_audio_features', [
    'raw_bpm',
    'normalized_bpm',
    'tempo_bucket',
    'tempo_level',
    'bpm',
    'energy_score',
    'danceability_score',
    'danceability',
    'brightness_score',
    'brightness',
    'tempo_confidence',
    'tempo_stability',
    'extractor',
    'extracted_at',
    'status',
  ]);
  const rawBpmExpr = columns.raw_bpm ? 'raw_bpm' : (columns.bpm ? 'bpm' : 'NULL');
  const normalizedBpmExpr = columns.normalized_bpm ? 'normalized_bpm' : (columns.bpm ? 'bpm' : (columns.raw_bpm ? 'raw_bpm' : 'NULL'));
  const bucketExpr = columns.tempo_bucket ? 'tempo_bucket' : (columns.tempo_level ? 'tempo_level' : "'unknown'");
  const danceExpr = columns.danceability_score ? 'danceability_score' : (columns.danceability ? 'danceability' : 'NULL');
  const brightnessExpr = columns.brightness_score ? 'brightness_score' : (columns.brightness ? 'brightness' : 'NULL');
  const statusCond = columns.status ? "AND COALESCE(status, 'completed') = 'completed'" : '';
  const placeholders = ids.map(() => '?').join(',');

  const [rows] = await pool.query(`
    SELECT song_id,
           ${rawBpmExpr} AS raw_bpm,
           ${normalizedBpmExpr} AS normalized_bpm,
           ${bucketExpr} AS tempo_bucket,
           energy_score,
           ${danceExpr} AS danceability_score,
           ${brightnessExpr} AS brightness_score,
           ${columns.tempo_confidence ? 'tempo_confidence' : 'NULL'} AS tempo_confidence,
           ${columns.tempo_stability ? 'tempo_stability' : 'NULL'} AS tempo_stability,
           ${columns.extractor ? 'extractor' : 'NULL'} AS extractor,
           ${columns.extracted_at ? 'extracted_at' : 'NULL'} AS extracted_at
    FROM song_audio_features
    WHERE song_id IN (${placeholders})
      ${statusCond}
  `, ids);

  const map = new Map();
  rows.forEach((row) => map.set(Number(row.song_id), row));
  return map;
}

function computeDiversityScore(song, index) {
  const novelty = 1 - Math.min(index / 100, 1);
  const popularity = Math.log10(Number(song.play_count || 0) + 1) / 7;
  return clamp01(novelty * 0.65 + popularity * 0.35);
}

async function applyTempoAwareLayer(userId, result, limit) {
  const items = Array.isArray(result?.items) ? result.items : [];
  if (!items.length || result.strategy !== 'lightgcn_hybrid_v4') {
    return {
      ...result,
      tempoAware: false,
      tempoProfile: null,
      audioFeatureCoverage: { covered: 0, total: items.length, ratio: 0 },
    };
  }

  const tempoProfile = await userTempoProfileService.buildUserTempoProfile(userId);
  const enabled = Number(tempoProfile.confidence || 0) >= TEMPO_PROFILE_CONFIDENCE_THRESHOLD
    && Boolean(tempoProfile.preferredTempoBucket);
  const featureMap = await fetchAudioFeaturesForSongs(items.map((song) => song.id));
  const target = {
    tempoBucket: tempoProfile.preferredTempoBucket,
    energyTarget: tempoProfile.avgEnergy !== null && tempoProfile.avgEnergy < 0.4 ? 'low' : (tempoProfile.avgEnergy !== null && tempoProfile.avgEnergy > 0.65 ? 'high' : 'medium'),
    danceabilityTarget: tempoProfile.avgDanceability !== null && tempoProfile.avgDanceability < 0.4 ? 'low' : (tempoProfile.avgDanceability !== null && tempoProfile.avgDanceability > 0.65 ? 'high' : 'medium'),
  };

  const scored = items.map((song, index) => {
    const feature = featureMap.get(Number(song.id)) || null;
    const lightgcnScore = clamp01(song.finalScore ?? song.score ?? 0.5, 0.5);
    const tempoAffinityScore = enabled ? computeTempoMatchScore(feature, target) : 0.5;
    const energyMatchScore = enabled ? computeEnergyMatchScore(feature, target) : 0.5;
    const danceabilityMatchScore = enabled ? computeDanceabilityMatchScore(feature, target) : 0.5;
    const diversityScore = computeDiversityScore(song, index);
    const finalScore = enabled
      ? lightgcnScore * 0.70
        + tempoAffinityScore * 0.15
        + energyMatchScore * 0.07
        + danceabilityMatchScore * 0.05
        + diversityScore * 0.03
      : song.finalScore ?? song.score ?? 0;

    return {
      ...song,
      finalScore,
      lightgcnScore,
      tempoAffinityScore,
      energyMatchScore,
      danceabilityMatchScore,
      diversityScore,
      audioFeature: feature,
      tempoReason: feature && enabled ? buildTempoReason(feature, target) : null,
    };
  });

  if (enabled) {
    scored.sort((a, b) => b.finalScore - a.finalScore || Number(a.id) - Number(b.id));
  }

  return {
    ...result,
    items: scored.slice(0, limit),
    tempoAware: enabled && featureMap.size > 0,
    tempoProfile,
    audioFeatureCoverage: {
      covered: featureMap.size,
      total: items.length,
      ratio: items.length ? Number((featureMap.size / items.length).toFixed(4)) : 0,
    },
  };
}

function shapeItem(song, req) {
  const item = {
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
  if (song.audioFeature) {
    if (song.audioFeature.raw_bpm !== null && song.audioFeature.raw_bpm !== undefined) item.bpm = Number(song.audioFeature.raw_bpm);
    if (song.audioFeature.normalized_bpm !== null && song.audioFeature.normalized_bpm !== undefined) item.normalizedBpm = Number(song.audioFeature.normalized_bpm);
    if (song.audioFeature.tempo_bucket && song.audioFeature.tempo_bucket !== 'unknown') item.tempoBucket = song.audioFeature.tempo_bucket;
    if (song.audioFeature.energy_score !== null && song.audioFeature.energy_score !== undefined) item.energyScore = Number(song.audioFeature.energy_score);
    if (song.audioFeature.danceability_score !== null && song.audioFeature.danceability_score !== undefined) item.danceabilityScore = Number(song.audioFeature.danceability_score);
    if (song.tempoReason) item.tempoReason = song.tempoReason;
  }
  return item;
}

async function getRecommendationsForUser(userId, options = {}) {
  const limit = clampLimit(options.limit);
  const req = options.req || null;

  const result = await getRecommendationsForUserRaw(userId, limit, options);
  const items = result.items.map((s) => shapeItem(s, req));
  const serving = getServingMetadata(result);
  return {
    ...serving,
    fallbackChain: result.fallbackChain || fallbackChainFrom(result.fallbackUsed, serving.strategy),
    reason: result.reason,
    tasteProfile: result.tasteProfile || null,
    tempoAware: Boolean(result.tempoAware),
    tempoProfile: result.tempoProfile || null,
    audioFeatureCoverage: result.audioFeatureCoverage || { covered: 0, total: items.length, ratio: 0 },
    feedbackStatus: result.feedbackStatus || null,
    items,
  };
}

async function fetchValidSongs(songIds) {
  if (!songIds || songIds.length === 0) return [];
  const normalizedIds = songIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (!normalizedIds.length) return [];
  const cacheKey = normalizedIds.join(',');
  const cached = verifiedSongsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows.map((row) => ({ ...row }));
  }

  const placeholders = normalizedIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
            s.cover_url, s.audio_url, s.play_count, s.created_at,
            a.name AS artist_name, al.title AS album_title, g.name AS genre_name
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     LEFT JOIN albums al ON al.id = s.album_id
     LEFT JOIN genres g ON g.id = s.genre_id
     WHERE ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
       AND s.id IN (${placeholders})`,
    normalizedIds
  );

  const songMap = new Map();
  rows.forEach(r => songMap.set(Number(r.id), r));

  const validSongs = [];
  normalizedIds.forEach(id => {
    if (songMap.has(Number(id))) {
      validSongs.push(songMap.get(Number(id)));
    }
  });
  verifiedSongsCache.set(cacheKey, {
    rows: validSongs.map((row) => ({ ...row })),
    expiresAt: Date.now() + SONG_VERIFY_CACHE_TTL_MS,
  });
  if (verifiedSongsCache.size > 200) {
    const firstKey = verifiedSongsCache.keys().next().value;
    verifiedSongsCache.delete(firstKey);
  }
  return validSongs.map((row) => ({ ...row }));
}

async function getUserFeedbackStatus(userId) {
  const [[histRow]] = await pool.query('SELECT COUNT(*) AS listen_count FROM listening_history WHERE user_id = ?', [userId]);
  const [[likeRow]] = await pool.query('SELECT COUNT(*) AS like_count FROM song_likes WHERE user_id = ?', [userId]);
  const [[playlistSongRow]] = await pool.query(
    `SELECT COUNT(*) AS playlist_song_count 
     FROM playlist_songs ps 
     JOIN playlists p ON p.id = ps.playlist_id 
     WHERE p.user_id = ? AND p.type = 'manual'`, 
    [userId]
  );
  const [prefGenres] = await pool.query('SELECT genre_id FROM user_genre_preferences WHERE user_id = ?', [userId]);
  const [prefArtists] = await pool.query('SELECT artist_id FROM user_artist_preferences WHERE user_id = ?', [userId]);

  const listenCount = Number(histRow?.listen_count || 0);
  const likeCount = Number(likeRow?.like_count || 0);
  const playlistSongCount = Number(playlistSongRow?.playlist_song_count || 0);

  // Cold Start threshold: listenCount < 5 AND likeCount === 0 AND playlistSongCount === 0
  const hasImplicitFeedback = listenCount >= 5 || likeCount > 0 || playlistSongCount > 0;
  const hasOnboardingPreferences = prefGenres.length > 0 || prefArtists.length > 0;
  const isColdStartUser = !hasImplicitFeedback;

  return {
    listenCount,
    likeCount,
    playlistSongCount,
    hasImplicitFeedback,
    hasOnboardingPreferences,
    isColdStartUser,
    prefGenreIds: prefGenres.map(g => g.genre_id),
    prefArtistIds: prefArtists.map(a => a.artist_id),
  };
}

const coldStartCache = new Map();
const coldStartInFlight = new Map();

async function buildMultiTierColdStartRecommendations(userId, limit, feedbackStatus, options = {}) {
  const {
    context = 'home'
  } = options;
  const defaultCandidateLimit = context === 'vibes' ? limit : Math.max(limit * 3, 60);
  const candidateLimit = options.candidateLimit !== undefined ? options.candidateLimit : defaultCandidateLimit;

  const targetCount = Math.max(limit, candidateLimit);
  const accepted = [];
  const seenSongIds = new Set();

  function addCandidates(songs, sourceTag) {
    for (const song of songs) {
      if (accepted.length >= targetCount) break;
      const songId = Number(song.id);
      if (!seenSongIds.has(songId)) {
        seenSongIds.add(songId);
        accepted.push({ ...song, recommendation_source: sourceTag });
      }
    }
  }

  const { prefGenreIds, prefArtistIds } = feedbackStatus;
  const getTierFetchLimit = () => Math.min(Math.max(targetCount - accepted.length + 15, 20), 100);

  const baseSelect = `
      SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
             s.cover_url, s.audio_url, s.play_count, s.created_at,
             a.name AS artist_name, al.title AS album_title, g.name AS genre_name
      FROM songs s
      LEFT JOIN artists a ON a.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE ${publicSongCondition('s')}
        AND s.audio_url IS NOT NULL AND s.audio_url <> ''
  `;

  // Tier 1a: Onboarding Artists (Prioritized & Interleaved)
  if (prefArtistIds.length > 0 && accepted.length < targetCount) {
    const sql = baseSelect + ` AND s.artist_id IN (?) ORDER BY s.play_count DESC, s.id DESC LIMIT ${getTierFetchLimit()}`;
    const [tier1aSongs] = await pool.query(sql, [prefArtistIds]);
    console.log(`[ColdStart][ctx=${context}] Tier 1a (Onboarding Artists): found ${tier1aSongs.length} songs.`);

    const songsByArtist = new Map();
    for (const song of tier1aSongs) {
      const aId = Number(song.artist_id);
      if (!songsByArtist.has(aId)) songsByArtist.set(aId, []);
      songsByArtist.get(aId).push(song);
    }

    const orderedArtistIds = prefArtistIds.map(id => Number(id)).filter(id => songsByArtist.has(id));
    for (const aId of songsByArtist.keys()) {
      if (!orderedArtistIds.includes(aId)) orderedArtistIds.push(aId);
    }

    const balancedTier1a = [];
    let addedAny = true;
    let roundIdx = 0;
    while (addedAny) {
      addedAny = false;
      for (const aId of orderedArtistIds) {
        const list = songsByArtist.get(aId);
        if (list && roundIdx < list.length) {
          balancedTier1a.push(list[roundIdx]);
          addedAny = true;
        }
      }
      roundIdx++;
    }

    addCandidates(balancedTier1a, 'onboarding_artists');
  }

  // Tier 1b: Onboarding Genres (Interleaved)
  if (accepted.length < targetCount && prefGenreIds.length > 0) {
    const sql = baseSelect + ` AND s.genre_id IN (?) ORDER BY s.play_count DESC, s.id DESC LIMIT ${getTierFetchLimit()}`;
    const [tier1bSongs] = await pool.query(sql, [prefGenreIds]);
    console.log(`[ColdStart][ctx=${context}] Tier 1b (Onboarding Genres): found ${tier1bSongs.length} songs.`);

    const songsByGenre = new Map();
    for (const song of tier1bSongs) {
      const gId = Number(song.genre_id);
      if (!songsByGenre.has(gId)) songsByGenre.set(gId, []);
      songsByGenre.get(gId).push(song);
    }

    const orderedGenreIds = prefGenreIds.map(id => Number(id)).filter(id => songsByGenre.has(id));
    for (const gId of songsByGenre.keys()) {
      if (!orderedGenreIds.includes(gId)) orderedGenreIds.push(gId);
    }

    const balancedTier1b = [];
    let addedAny = true;
    let roundIdx = 0;
    while (addedAny) {
      addedAny = false;
      for (const gId of orderedGenreIds) {
        const list = songsByGenre.get(gId);
        if (list && roundIdx < list.length) {
          balancedTier1b.push(list[roundIdx]);
          addedAny = true;
        }
      }
      roundIdx++;
    }

    addCandidates(balancedTier1b, 'onboarding_genres');
  }

  // Tier 3: Time-based / Contextual Global System Playlists
  if (accepted.length < targetCount) {
    const [tier3Songs] = await pool.query(`
      SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
             s.cover_url, s.audio_url, s.play_count, s.created_at,
             a.name AS artist_name, al.title AS album_title, g.name AS genre_name
      FROM playlist_songs ps
      JOIN playlists p ON p.id = ps.playlist_id
      JOIN songs s ON s.id = ps.song_id
      LEFT JOIN artists a ON a.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE p.is_system = 1 AND ${publicSongCondition('s')}
      ORDER BY ps.added_at DESC LIMIT ${getTierFetchLimit()}
    `);
    console.log(`[ColdStart][ctx=${context}] Tier 3 (Time-Based): found ${tier3Songs.length} songs.`);
    addCandidates(tier3Songs, 'time_based_global_playlist');
  }

  // Tier 4: Trending / Popular Songs
  if (accepted.length < targetCount) {
    const [tier4Songs] = await pool.query(`
      SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
             s.cover_url, s.audio_url, s.play_count, s.created_at,
             a.name AS artist_name, al.title AS album_title, g.name AS genre_name
      FROM songs s
      LEFT JOIN artists a ON a.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE ${publicSongCondition('s')}
        AND s.audio_url IS NOT NULL AND s.audio_url <> ''
      ORDER BY s.play_count DESC, s.id DESC LIMIT ${getTierFetchLimit()}
    `);
    console.log(`[ColdStart][ctx=${context}] Tier 4 (Trending): found ${tier4Songs.length} songs.`);
    addCandidates(tier4Songs, 'trending_fallback');
  }

  // Tier 5: Diverse Discovery (popular songs with random order)
  if (accepted.length < targetCount) {
    const [tier5Songs] = await pool.query(`
      SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
             s.cover_url, s.audio_url, s.play_count, s.created_at,
             a.name AS artist_name, al.title AS album_title, g.name AS genre_name
      FROM songs s
      LEFT JOIN artists a ON a.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE ${publicSongCondition('s')}
        AND s.audio_url IS NOT NULL AND s.audio_url <> ''
      ORDER BY RAND() LIMIT ${getTierFetchLimit()}
    `);
    console.log(`[ColdStart][ctx=${context}] Tier 5 (Diverse Discovery): found ${tier5Songs.length} songs.`);
    addCandidates(tier5Songs, 'diverse_discovery');
  }

  // Tier 6: Default Active Songs
  if (accepted.length < targetCount) {
    const [tier6Songs] = await pool.query(`
      SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
             s.cover_url, s.audio_url, s.play_count, s.created_at,
             a.name AS artist_name, al.title AS album_title, g.name AS genre_name
      FROM songs s
      LEFT JOIN artists a ON a.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE ${publicSongCondition('s')}
      ORDER BY s.id DESC LIMIT ${getTierFetchLimit()}
    `);
    console.log(`[ColdStart][ctx=${context}] Tier 6 (Default Active): found ${tier6Songs.length} songs.`);
    addCandidates(tier6Songs, 'default_active_songs');
  }

  console.log(`[ColdStart][ctx=${context}] Final accepted items count: ${accepted.length}`);
  const primarySource = feedbackStatus.hasOnboardingPreferences ? 'onboarding_preferences' : 'trending_fallback';

  return {
    strategy: feedbackStatus.hasOnboardingPreferences ? 'cold_start_preferences' : 'most_popular_v4',
    reason: primarySource === 'onboarding_preferences'
      ? 'Dựa trên sở thích ban đầu và xu hướng hiện tại'
      : 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay',
    source: primarySource,
    items: accepted.slice(0, limit),
  };
}

async function getColdStartRecommendations(userId, options = {}) {
  const {
    limit = 20,
    context = 'home',
    vibeKey = null,
    useCache = true,
    feedbackStatus: customFeedbackStatus = null
  } = options;
  const defaultCandidateLimit = context === 'vibes' ? limit : Math.max(limit * 3, 60);
  const candidateLimit = options.candidateLimit !== undefined ? options.candidateLimit : defaultCandidateLimit;

  const cacheKey = `coldstart:${userId}:${context}:${vibeKey || 'default'}`;

  if (useCache && coldStartCache.has(cacheKey)) {
    const cached = coldStartCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 mins TTL
      return {
        ...cached.data,
        items: cached.data.items.slice(0, limit)
      };
    }
  }

  if (coldStartInFlight.has(cacheKey)) {
    const data = await coldStartInFlight.get(cacheKey);
    return {
      ...data,
      items: data.items.slice(0, limit)
    };
  }

  const promise = (async () => {
    const feedbackStatus = customFeedbackStatus || await getUserFeedbackStatus(userId);
    const result = await buildMultiTierColdStartRecommendations(userId, limit, feedbackStatus, options);
    if (useCache) {
      coldStartCache.set(cacheKey, { timestamp: Date.now(), data: result });
    }
    return result;
  })();

  coldStartInFlight.set(cacheKey, promise);
  try {
    const res = await promise;
    return res;
  } finally {
    coldStartInFlight.delete(cacheKey);
  }
}

async function getRecommendationsForUserRaw(userId, limit, options = {}) {
  const feedbackStatus = options.feedbackStatus || await getUserFeedbackStatus(userId);

  if (feedbackStatus.hasImplicitFeedback) {
    if (!options.bypassServingArtifact) {
      const servingResult = await getServingArtifactResult(userId, limit);
      if (servingResult && servingResult.items?.length >= Math.min(5, limit)) {
        return { ...servingResult, feedbackStatus };
      }
    }

    const loadResult = typeof modelService.tryLoadArtifact === 'function'
      ? modelService.tryLoadArtifact('lightgcn')
      : modelService.tryLoad();
    const lightgcn = loadResult.model?.lightgcn || loadResult.model;
    const recs = loadResult.ok && lightgcn ? lightgcn[String(userId)] : null;

    if (recs && recs.length > 0) {
      const songIds = recs.map(r => r.song_id || r.id);
      const validSongs = await fetchValidSongs(songIds);

      const scoreMap = new Map();
      recs.forEach(r => scoreMap.set(Number(r.song_id || r.id), r.finalScore ?? r.final_score ?? r.score ?? 0));
      validSongs.forEach(s => s.finalScore = scoreMap.get(Number(s.id)));

      if (validSongs.length >= Math.min(5, limit)) {
        const layered = await applyTempoAwareLayer(userId, {
          strategy: 'lightgcn_hybrid_v4',
          reason: 'ok',
          items: validSongs.slice(0, limit)
        }, limit);
        return withV4Serving(layered, { fallbackUsed: false, feedbackStatus });
      }
    }

    const cb = await buildContentBasedRecommendations(userId, limit, options);
    if (cb.items.length >= Math.min(5, limit)) {
      return withV4Serving(cb, {
        strategy: 'content_based_v4',
        fallbackUsed: true,
        fallbackReason: 'user_not_in_lightgcn_model',
        fallbackChain: ['content_based_v4', 'most_popular_v4'],
        feedbackStatus,
      });
    }
  }

  // Cold Start user or insufficient model results -> execute 6-tier fallback pipeline
  const coldStartResult = await getColdStartRecommendations(userId, {
    limit,
    feedbackStatus,
    context: options.context || 'home',
    vibeKey: options.vibeKey || null,
    useCache: options.useCache !== false
  });

  return withV4Serving(coldStartResult, {
    strategy: feedbackStatus.hasOnboardingPreferences ? 'cold_start_preferences' : 'most_popular_v4',
    fallbackUsed: true,
    fallbackReason: feedbackStatus.hasOnboardingPreferences ? 'cold_start_preferences' : 'no_history_or_preferences',
    fallbackChain: ['cold_start_preferences', 'content_based_cold_start', 'time_based_global', 'most_popular_v4'],
    source: coldStartResult.source,
    reason: coldStartResult.reason,
    feedbackStatus, // Pass it up
  });
}

function reasonForStrategy(strategy, source) {
  if (source === 'onboarding_preferences' || strategy === 'cold_start_preferences') {
    return 'Dựa trên sở thích ban đầu và xu hướng hiện tại';
  }
  switch (strategy) {
    case 'lightgcn_hybrid_v4':
    case 'bpr_hybrid_v4':
      return 'Dựa trên hành vi nghe nhạc tương tự của bạn';
    case 'content_based_v4':
    case 'content_based_v4_runtime':
    case 'content_based_fallback':
      return 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay';
    case 'cold_start_preferences':
    case 'cold_start_v4':
      return 'Dựa trên sở thích ban đầu và xu hướng hiện tại';
    case 'most_popular_v4':
    case 'popular_fallback':
      return 'Những bài hát được nghe nhiều gần đây';
    default:
      return 'Những bài hát phù hợp để bạn bắt đầu nghe hôm nay';
  }
}

module.exports = {
  getRecommendationsForUser,
  getRecommendationsForUserRaw,
  getColdStartRecommendations,
  getServingMetadata,
  getUserFeedbackStatus,
  reasonForStrategy,
  SERVING_WEIGHTS,
  clampLimit,
  buildUserTasteProfile,
  applyDominantMarketGuard,
  fetchAudioFeaturesForSongs,
};
