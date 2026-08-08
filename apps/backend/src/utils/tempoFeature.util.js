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
  if (bpm <= 120) return 'medium';
  return 'fast';
}

function featureBucket(feature = {}) {
  const f = feature || {};
  return f.tempo_level || f.tempoLevel || f.tempo_bucket || f.tempoBucket || getTempoBucket(f.normalized_bpm ?? f.normalizedBpm ?? f.bpm);
}

function featureEnergy(feature = {}) {
  const f = feature || {};
  const direct = f.energy_score ?? f.energyScore;
  if (Number.isFinite(Number(direct))) return clamp01(direct, 0.5);
  const label = normalizeText(f.energy || '');
  if (label === 'high') return 0.85;
  if (label === 'low') return 0.25;
  if (label === 'medium') return 0.55;
  return 0.5;
}

function featureDanceability(feature = {}) {
  const f = feature || {};
  const direct = f.danceability_score ?? f.danceabilityScore ?? f.danceability;
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
  if ((bucket === 'slow' && targetBucket === 'fast') || (bucket === 'fast' && targetBucket === 'slow')) return 0.0;
  if (targetBucket === 'slow' && bucket === 'medium') return 0.4;
  return 0.6;
}

function computeEnergyMatchScore(songFeature, target = {}) {
  if (!songFeature) return 0.5;
  const targetVal = target.energyTarget || target.energy || 'medium';
  const val = featureEnergy(songFeature);
  if (targetVal === 'low') {
    if (val <= 0.35) return 1.0;
    if (val <= 0.50) return clamp01(0.8 - (val - 0.35) * 2);
    if (val >= 0.60) return 0.0;
    return clamp01(0.5 - (val - 0.50) * 5);
  }
  return scoreAround(val, targetVal);
}

function computeDanceabilityMatchScore(songFeature, target = {}) {
  if (!songFeature) return 0.5;
  return scoreAround(featureDanceability(songFeature), target.danceabilityTarget || target.danceability || 'medium');
}

function featureBrightness(feature = {}) {
  const direct = feature.brightness_score ?? feature.brightnessScore ?? feature.brightness;
  if (Number.isFinite(Number(direct))) return clamp01(direct, 0.5);
  const label = normalizeText(feature.brightness || '');
  if (label === 'high') return 0.85;
  if (label === 'low') return 0.25;
  if (label === 'medium') return 0.55;
  return 0.5;
}

function computeBrightnessMatchScore(songFeature, target = {}) {
  if (!songFeature) return 0.5;
  const targetVal = target.brightnessTarget || target.brightness;
  if (!targetVal) return 0.5;
  const val = featureBrightness(songFeature);
  if (targetVal === 'low') {
    if (val <= 0.45) return 1.0;
    if (val <= 0.60) return clamp01(0.8 - (val - 0.45) * 2);
    return clamp01(0.5 - (val - 0.60) * 2);
  }
  return scoreAround(val, targetVal);
}

function buildTempoReason(songFeature, target = {}) {
  const targetActivity = target.activity;
  const targetBucket = target.tempoBucket || target.preferredTempoBucket;

  if (!songFeature) {
    if (targetActivity === 'workout' || targetActivity === 'party' || targetBucket === 'fast') {
      return targetActivity === 'party'
        ? 'Tiết tấu nhanh, năng lượng cao, phù hợp không khí sôi động.'
        : 'Tiết tấu nhanh, năng lượng cao, phù hợp tập luyện.';
    }
    if (targetActivity === 'focus' || targetBucket === 'medium') {
      return 'Nhịp vừa phải, phù hợp để tập trung.';
    }
    if (targetActivity === 'focus') {
      return actualEnergy >= 0.65
        ? 'Bài có năng lượng cao hơn intent học bài, chỉ nên dùng khi mở rộng kết quả.'
        : 'Năng lượng vẫn ở mức thấp/vừa; tempo nhanh hơn mong muốn nên được xếp sau các bài khớp hơn.';
    }
    if (targetActivity === 'focus') {
      return actualEnergy >= 0.65
        ? 'Bài có năng lượng cao hơn intent học bài, chỉ nên dùng khi mở rộng kết quả.'
        : 'Năng lượng vẫn ở mức thấp/vừa; tempo nhanh hơn mong muốn nên được xếp sau các bài khớp hơn.';
    }
    if (targetActivity === 'relax' || targetBucket === 'slow') {
      return 'Tiết tấu chậm, êm dịu, rất phù hợp để thư giãn buổi tối.';
    }
    return 'Phù hợp với nhịp độ nghe gần đây của bạn.';
  }

  const actualBucket = featureBucket(songFeature);
  const actualEnergy = featureEnergy(songFeature);

  if ((actualBucket === 'fast' || actualEnergy >= 0.75) && targetActivity === 'focus') {
    return actualEnergy >= 0.65
      ? 'Bài có năng lượng cao hơn intent học bài, chỉ nên dùng khi mở rộng kết quả.'
      : 'Năng lượng vẫn ở mức thấp/vừa; tempo nhanh hơn mong muốn nên được xếp sau các bài khớp hơn.';
  }

  if (actualBucket === 'fast' || actualEnergy >= 0.75) {
    if (targetActivity === 'party') return 'Tiết tấu nhanh, năng lượng cao, phù hợp không khí sôi động.';
    if (targetActivity === 'workout') return 'Tiết tấu nhanh, năng lượng cao, thúc đẩy động lực tập luyện.';
    if (targetActivity === 'relax' || targetBucket === 'slow') {
      return actualEnergy >= 0.65
        ? 'Giai điệu nhanh với nguồn năng lượng cao, tạo điểm nhấn sôi động cho danh sách.'
        : 'Tiết tấu nhanh, mang lại nhịp điệu tươi vui và năng lượng tích cực cho trải nghiệm nghe.';
    }
    return 'Tiết tấu nhanh, mang lại giai điệu sôi nổi và năng lượng tích cực.';
  }

  if (actualBucket === 'slow') {
    if (actualEnergy >= 0.65) {
      return 'Tiết tấu chậm rãi nhưng sở hữu cao trào cảm xúc sâu lắng và mạnh mẽ.';
    }
    if (targetActivity === 'relax' || targetBucket === 'slow') {
      return 'Tiết tấu chậm, êm dịu, rất phù hợp để thư giãn buổi tối.';
    }
    return 'Tiết tấu chậm rãi, mang lại không khí nhẹ nhàng và sâu lắng.';
  }

  if (actualBucket === 'medium') {
    if (actualEnergy >= 0.65) {
      return 'Nhịp điệu vừa phải, điểm xuyết cao trào cảm xúc sống động và lôi cuốn.';
    }
    if (targetActivity === 'relax' || targetBucket === 'slow') {
      return 'Nhịp điệu vừa phải, êm dịu, mang lại cảm giác thư thái và thoải mái.';
    }
    if (targetActivity === 'focus' || targetBucket === 'medium') {
      return 'Nhịp vừa phải, ổn định, phù hợp để giữ sự tập trung.';
    }
    return 'Giai điệu hài hòa với nhịp độ vừa phải, dễ nghe trong nhiều hoàn cảnh.';
  }

  if (actualEnergy >= 0.65) {
    return 'Giai điệu mang cao trào cảm xúc mạnh mẽ, tạo điểm nhấn sâu lắng.';
  }
  if (targetActivity === 'relax' || targetBucket === 'slow') {
    return 'Giai điệu êm dịu, mang lại không khí thư thái và nhẹ nhàng.';
  }
  return 'Phù hợp với nhịp độ nghe gần đây của bạn.';
}


function detectTempoIntent(text = '') {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const includesAny = (terms) => terms.some((term) => normalized.includes(normalizeText(term)));

  const fastTerms = [
    'nhanh', 'soi dong', 'boc', 'chay', 'manh', 'dance', 'party', 'tap gym', 'gym', 'workout', 'chay bo', 'cardio',
    'beat manh', 'beat cang', 'beat day', 'bass manh', 'bass day', 'nhip manh', 'nhip nhanh', 'nhip don dap',
    'trong ro', 'dance beat', 'beat de quay', 'beat de gym', 'beat de chay bo', 'quay'
  ];
  const mediumTerms = ['tiet tau vua', 'vua phai', 'hoc bai', 'lam viec', 'tap trung', 'coding', 'doc sach', 'study', 'focus', 'work', 'reading'];
  const slowTerms = [
    'cham', 'nhe', 'nhe nhang', 'chill', 'thu gian', 'buoi toi', 'toi', 'ngu', 'acoustic', 'sau lang', 'buon', 'suy', 'diu', 'lofi', 'binh yen',
    'beat cham', 'nhip cham', 'beat chill', 'beat nhe'
  ];

  if (includesAny(fastTerms)) {
    return {
      tempoBucket: 'fast',
      energyTarget: 'high',
      danceabilityTarget: 'high',
      activity: includesAny(['party', 'dance']) ? 'party' : 'workout',
      label: includesAny(['party', 'dance']) ? 'Nhạc nhanh · Năng lượng cao · Party' : 'Nhạc nhanh · Năng lượng cao · Tập luyện',
    };
  }

  if (includesAny(slowTerms) && includesAny(mediumTerms)) {
    return {
      tempoBucket: 'medium',
      energyTarget: 'low',
      danceabilityTarget: 'low',
      brightnessTarget: 'low',
      activity: 'focus',
      label: 'Light tempo - Low/medium energy - Focus',
    };
  }

  if (includesAny(slowTerms)) {
    return {
      tempoBucket: 'slow',
      energyTarget: 'low',
      danceabilityTarget: 'low',
      brightnessTarget: 'low',
      activity: 'relax',
      label: 'Slow tempo - Low energy - Relax',
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
      brightnessTarget: 'low',
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
  computeBrightnessMatchScore,
  buildTempoReason,
  detectTempoIntent,
  clamp01,
};
