function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), 1);
}

function normalizeBpm(rawBpm) {
  const bpm = Number(rawBpm);
  if (!Number.isFinite(bpm) || bpm <= 0) return null;
  if (bpm < 70) return Number((bpm * 2).toFixed(2));
  if (bpm > 180) return Number((bpm / 2).toFixed(2));
  return Number(bpm.toFixed(2));
}

function getTempoBucket(normalizedBpm) {
  const bpm = Number(normalizedBpm);
  if (!Number.isFinite(bpm) || bpm <= 0) return 'unknown';
  if (bpm < 90) return 'slow';
  if (bpm < 120) return 'medium';
  return 'fast';
}

function featureBucket(feature = {}) {
  return feature.tempo_bucket || feature.tempoBucket || feature.tempo_level || feature.tempoLevel || getTempoBucket(feature.normalized_bpm ?? feature.normalizedBpm ?? feature.bpm);
}

function featureEnergy(feature = {}) {
  const direct = feature.energy_score ?? feature.energyScore;
  if (Number.isFinite(Number(direct))) return clamp01(direct, 0.5);
  const label = normalizeText(feature.energy || '');
  if (label === 'high') return 0.85;
  if (label === 'low') return 0.25;
  if (label === 'medium') return 0.55;
  return 0.5;
}

function featureDanceability(feature = {}) {
  const direct = feature.danceability_score ?? feature.danceabilityScore ?? feature.danceability;
  return Number.isFinite(Number(direct)) ? clamp01(direct, 0.5) : 0.5;
}

function targetValue(target) {
  if (target === 'low') return 0.25;
  if (target === 'high') return 0.85;
  return 0.55;
}

function scoreAround(value, target) {
  const targetScore = targetValue(target);
  const distance = Math.abs(clamp01(value, 0.5) - targetScore);
  const maxDistance = target === 'high' ? 0.85 : target === 'low' ? 0.75 : 0.55;
  return clamp01(1 - distance / Math.max(maxDistance, 0.01));
}

function computeTempoMatchScore(songFeature, target = {}) {
  if (!songFeature) return 0.5;
  const targetBucket = target.tempoBucket || target.preferredTempoBucket || target.tempo_bucket;
  const bucket = featureBucket(songFeature);
  if (!targetBucket || targetBucket === 'unknown') return 0.5;
  if (!bucket || bucket === 'unknown') return 0.5;
  if (bucket === targetBucket) return 1;
  if ((bucket === 'slow' && targetBucket === 'fast') || (bucket === 'fast' && targetBucket === 'slow')) return 0.25;
  return 0.6;
}

function computeEnergyMatchScore(songFeature, target = {}) {
  if (!songFeature) return 0.5;
  return scoreAround(featureEnergy(songFeature), target.energyTarget || target.energy || 'medium');
}

function computeDanceabilityMatchScore(songFeature, target = {}) {
  if (!songFeature) return 0.5;
  return scoreAround(featureDanceability(songFeature), target.danceabilityTarget || target.danceability || 'medium');
}

function buildTempoReason(songFeature, target = {}) {
  const activity = target.activity;
  const bucket = target.tempoBucket || target.preferredTempoBucket || featureBucket(songFeature);
  if (activity === 'workout' || activity === 'party' || bucket === 'fast') {
    return activity === 'party'
      ? 'Tiết tấu nhanh, năng lượng cao, phù hợp không khí sôi động.'
      : 'Tiết tấu nhanh, năng lượng cao, phù hợp tập luyện.';
  }
  if (activity === 'focus' || bucket === 'medium') {
    return 'Nhịp vừa phải, phù hợp để tập trung.';
  }
  if (activity === 'relax' || bucket === 'slow') {
    return 'Tiết tấu chậm, phù hợp thư giãn buổi tối.';
  }
  return 'Phù hợp với nhịp độ nghe gần đây của bạn.';
}

function detectTempoIntent(text = '') {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const includesAny = (terms) => terms.some((term) => normalized.includes(normalizeText(term)));

  const fastTerms = ['nhanh', 'soi dong', 'boc', 'chay', 'manh', 'dance', 'party', 'tap gym', 'gym', 'workout', 'chay bo', 'cardio'];
  const mediumTerms = ['tiet tau vua', 'vua phai', 'hoc bai', 'lam viec', 'tap trung', 'coding', 'doc sach'];
  const slowTerms = ['cham', 'nhe', 'chill', 'thu gian', 'buoi toi', 'ngu', 'acoustic', 'sau lang'];

  if (includesAny(fastTerms)) {
    return {
      tempoBucket: 'fast',
      energyTarget: 'high',
      danceabilityTarget: 'high',
      activity: includesAny(['party', 'dance']) ? 'party' : 'workout',
      label: includesAny(['party', 'dance']) ? 'Nhạc nhanh · Năng lượng cao · Party' : 'Nhạc nhanh · Năng lượng cao · Tập luyện',
    };
  }

  if (includesAny(mediumTerms)) {
    return {
      tempoBucket: 'medium',
      energyTarget: 'medium',
      danceabilityTarget: 'medium',
      activity: 'focus',
      label: 'Tiết tấu vừa · Năng lượng vừa · Tập trung',
    };
  }

  if (includesAny(slowTerms)) {
    return {
      tempoBucket: 'slow',
      energyTarget: 'low',
      danceabilityTarget: 'low',
      activity: 'relax',
      label: 'Nhạc chậm · Năng lượng nhẹ · Thư giãn',
    };
  }

  return null;
}

module.exports = {
  normalizeBpm,
  getTempoBucket,
  computeTempoMatchScore,
  computeEnergyMatchScore,
  computeDanceabilityMatchScore,
  buildTempoReason,
  detectTempoIntent,
  clamp01,
};
