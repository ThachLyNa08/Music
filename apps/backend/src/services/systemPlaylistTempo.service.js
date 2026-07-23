const recommendationService = require('./recommendation.service');
const { clamp01, getTempoBucket } = require('../utils/tempoFeature.util');
const {
  getSystemPlaylistTempoRule,
  getSystemPlaylistTempoMetadata
} = require('../config/systemPlaylistTempo.config');

const TARGET_VALUE = {
  low: 0.25,
  low_medium: 0.4,
  medium: 0.55,
  medium_high: 0.7,
  high: 0.85
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeScore(value, fallback = 0.5) {
  const n = toNumber(value);
  if (n === null) return fallback;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return clamp01(n / 100);
  return clamp01(n);
}

function getFeatureBucket(feature) {
  if (!feature) return 'unknown';
  const bucket = String(feature.tempo_bucket || feature.tempoLevel || feature.tempo_level || '').toLowerCase();
  if (['slow', 'medium', 'fast'].includes(bucket)) return bucket;
  return getTempoBucket(feature.normalized_bpm ?? feature.normalizedBpm ?? feature.raw_bpm ?? feature.bpm);
}

function matchTargetValue(value, target, tolerance = 0.35) {
  if (value === null || value === undefined) return 0.5;
  const actual = normalizeScore(value, null);
  const targetValue = TARGET_VALUE[target] ?? TARGET_VALUE.medium;
  if (actual === null) return 0.5;
  const diff = Math.abs(actual - targetValue);
  return clamp01(1 - diff / tolerance);
}

function computeTempoContextScore(feature, rule) {
  if (!feature || !rule) return 0.5;
  const bucket = getFeatureBucket(feature);
  if (bucket === 'unknown') return 0.5;
  const energy = normalizeScore(feature.energy_score ?? feature.energyScore, null);

  if ((rule.targetTempoBuckets || []).includes(bucket)) return 1;
  if ((rule.avoidTempoBuckets || []).includes(bucket)) {
    if (energy !== null && energy >= 0.72) return 0.15;
    return 0.3;
  }
  return 0.45;
}

function computeDiversityScore(song, seenState) {
  const artistKey = song.artist_id ?? song.artistId ?? song.artist_name ?? song.artist ?? null;
  const genreKey = song.genre_id ?? song.genreId ?? song.genre_name ?? song.genre ?? null;
  const artistCount = artistKey !== null ? (seenState.artist.get(String(artistKey)) || 0) : 0;
  const genreCount = genreKey !== null ? (seenState.genre.get(String(genreKey)) || 0) : 0;
  let score = 1;
  if (artistCount >= 2) score -= 0.45;
  else if (artistCount === 1) score -= 0.18;
  if (genreCount >= 5) score -= 0.18;
  else if (genreCount >= 3) score -= 0.08;
  return clamp01(score);
}

function rememberDiversity(song, seenState) {
  const artistKey = song.artist_id ?? song.artistId ?? song.artist_name ?? song.artist ?? null;
  const genreKey = song.genre_id ?? song.genreId ?? song.genre_name ?? song.genre ?? null;
  if (artistKey !== null) {
    const key = String(artistKey);
    seenState.artist.set(key, (seenState.artist.get(key) || 0) + 1);
  }
  if (genreKey !== null) {
    const key = String(genreKey);
    seenState.genre.set(key, (seenState.genre.get(key) || 0) + 1);
  }
}

function getBaseScore(song, index, total) {
  const raw = song.score ?? song.finalScore ?? song.recommendation_score ?? song.contextScore ?? null;
  const n = toNumber(raw);
  const rankScore = total ? clamp01(1 - index / Math.max(total - 1, 1)) : 0.5;
  if (n !== null) {
    if (n >= 0 && n <= 1) return n;
    return rankScore;
  }
  return rankScore;
}

function buildTempoReasonForSystemKey(systemKey) {
  const rule = getSystemPlaylistTempoRule(systemKey);
  return rule?.reason || null;
}

function attachSongAudioMetadata(song, feature, systemKey) {
  if (!song) return song;
  if (!feature) return song;

  const next = { ...song };
  const rawBpm = toNumber(feature.raw_bpm ?? feature.bpm);
  const normalizedBpm = toNumber(feature.normalized_bpm ?? feature.normalizedBpm ?? feature.bpm);
  const energyScore = toNumber(feature.energy_score ?? feature.energyScore);
  const danceabilityScore = toNumber(feature.danceability_score ?? feature.danceabilityScore ?? feature.danceability);
  const brightnessScore = toNumber(feature.brightness_score ?? feature.brightnessScore ?? feature.brightness);
  const tempoBucket = getFeatureBucket(feature);

  if (rawBpm !== null) next.bpm = rawBpm;
  if (normalizedBpm !== null) next.normalizedBpm = normalizedBpm;
  if (tempoBucket && tempoBucket !== 'unknown') next.tempoBucket = tempoBucket;
  if (energyScore !== null) next.energyScore = energyScore;
  if (danceabilityScore !== null) next.danceabilityScore = danceabilityScore;
  if (brightnessScore !== null) next.brightnessScore = brightnessScore;
  const reason = buildTempoReasonForSystemKey(systemKey);
  if (reason) next.tempoReason = reason;
  return next;
}

function buildTempoStats(songs, featureMap, systemKey) {
  const ids = (songs || []).map((song) => Number(song.id || song.song_id)).filter(Boolean);
  const distribution = { slow: 0, medium: 0, fast: 0, unknown: 0 };
  let bpmSum = 0;
  let bpmCount = 0;
  let energySum = 0;
  let energyCount = 0;
  let featured = 0;

  ids.forEach((id) => {
    const feature = featureMap?.get(Number(id)) || null;
    if (!feature) {
      distribution.unknown += 1;
      return;
    }
    featured += 1;
    const bucket = getFeatureBucket(feature);
    distribution[bucket] = (distribution[bucket] || 0) + 1;
    const bpm = toNumber(feature.normalized_bpm ?? feature.normalizedBpm ?? feature.bpm);
    if (bpm !== null) {
      bpmSum += bpm;
      bpmCount += 1;
    }
    const energy = toNumber(feature.energy_score ?? feature.energyScore);
    if (energy !== null) {
      energySum += normalizeScore(energy);
      energyCount += 1;
    }
  });

  const total = ids.length;
  const metadata = getSystemPlaylistTempoMetadata(systemKey);
  return {
    ...metadata,
    tempoAwareApplied: Boolean(metadata.tempoAware),
    audioFeatureCoverage: {
      covered: featured,
      total,
      ratio: total ? Number((featured / total).toFixed(4)) : 0
    },
    avgBpm: bpmCount ? Number((bpmSum / bpmCount).toFixed(2)) : null,
    avgEnergy: energyCount ? Number((energySum / energyCount).toFixed(4)) : null,
    tempoDistribution: distribution
  };
}

async function rerankSystemPlaylistCandidates(candidates, systemKey, options = {}) {
  const rule = getSystemPlaylistTempoRule(systemKey);
  const items = Array.isArray(candidates) ? candidates : [];
  if (!items.length || !rule) {
    return {
      items,
      tempoStats: buildTempoStats(items, new Map(), systemKey)
    };
  }

  const featureMap = options.featureMap || await recommendationService.fetchAudioFeaturesForSongs(
    items.map((song) => Number(song.id || song.song_id))
  );

  const firstPass = items.map((song, index) => {
    const songId = Number(song.id || song.song_id);
    const feature = featureMap.get(songId) || null;
    const baseScore = getBaseScore(song, index, items.length);
    const tempoContextScore = computeTempoContextScore(feature, rule);
    const energyMatchScore = matchTargetValue(feature?.energy_score ?? feature?.energyScore, rule.energyTarget);
    const brightnessMatchScore = matchTargetValue(
      feature?.brightness_score ?? feature?.brightnessScore ?? feature?.brightness,
      rule.brightnessTarget
    );
    const danceabilityMatchScore = matchTargetValue(
      feature?.danceability_score ?? feature?.danceabilityScore ?? feature?.danceability,
      rule.danceabilityTarget
    );

    return {
      ...attachSongAudioMetadata(song, feature, systemKey),
      audioFeature: feature,
      baseScore,
      tempoContextScore,
      energyMatchScore,
      brightnessMatchScore,
      danceabilityMatchScore
    };
  }).sort((a, b) => {
    const aPre = a.baseScore * 0.65 + a.tempoContextScore * 0.35;
    const bPre = b.baseScore * 0.65 + b.tempoContextScore * 0.35;
    return bPre - aPre || Number(a.id || a.song_id) - Number(b.id || b.song_id);
  });

  const seenState = { artist: new Map(), genre: new Map() };
  const reranked = firstPass.map((song) => {
    const diversityScore = computeDiversityScore(song, seenState);
    rememberDiversity(song, seenState);
    const finalScore =
      song.baseScore * 0.55
      + song.tempoContextScore * 0.20
      + song.energyMatchScore * 0.10
      + song.brightnessMatchScore * 0.05
      + song.danceabilityMatchScore * 0.05
      + diversityScore * 0.05;

    return {
      ...song,
      diversityScore,
      score: finalScore,
      finalScore,
      tempoAwareApplied: true
    };
  }).sort((a, b) => b.finalScore - a.finalScore || Number(a.id || a.song_id) - Number(b.id || b.song_id));

  return {
    items: reranked,
    tempoStats: buildTempoStats(reranked, featureMap, systemKey)
  };
}

async function enrichSystemPlaylistSongs(songs, systemKey) {
  const rule = getSystemPlaylistTempoRule(systemKey);
  const items = Array.isArray(songs) ? songs : [];
  if (!rule || !items.length) {
    return {
      songs: items,
      tempoStats: buildTempoStats(items, new Map(), systemKey)
    };
  }

  const featureMap = await recommendationService.fetchAudioFeaturesForSongs(
    items.map((song) => Number(song.id || song.song_id))
  );
  return {
    songs: items.map((song) => attachSongAudioMetadata(song, featureMap.get(Number(song.id || song.song_id)) || null, systemKey)),
    tempoStats: buildTempoStats(items, featureMap, systemKey)
  };
}

module.exports = {
  rerankSystemPlaylistCandidates,
  enrichSystemPlaylistSongs,
  buildTempoStats,
  buildTempoReasonForSystemKey,
  attachSongAudioMetadata
};
