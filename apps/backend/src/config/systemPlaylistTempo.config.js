const SYSTEM_PLAYLIST_TEMPO_RULES = {
  morning_vibes: {
    label: 'Morning Vibes',
    timeContext: 'morning',
    targetTempoBuckets: ['medium'],
    energyTarget: 'medium',
    brightnessTarget: 'high',
    danceabilityTarget: 'medium',
    moodHints: ['fresh', 'positive', 'chill'],
    avoidTempoBuckets: ['fast'],
    reason: 'Nhịp vừa và năng lượng dễ chịu, phù hợp buổi sáng.'
  },
  afternoon_vibes: {
    label: 'Afternoon Vibes',
    timeContext: 'afternoon',
    targetTempoBuckets: ['medium', 'fast'],
    energyTarget: 'medium_high',
    brightnessTarget: 'medium_high',
    danceabilityTarget: 'medium',
    moodHints: ['upbeat', 'relax', 'productive'],
    avoidTempoBuckets: [],
    reason: 'Tiết tấu tươi sáng, phù hợp buổi chiều.'
  },
  evening_vibes: {
    label: 'Evening Vibes',
    timeContext: 'evening',
    targetTempoBuckets: ['medium', 'slow'],
    energyTarget: 'low_medium',
    brightnessTarget: 'medium',
    danceabilityTarget: 'low_medium',
    moodHints: ['chill', 'soft', 'calm'],
    avoidTempoBuckets: [],
    reason: 'Nhịp nhẹ, phù hợp không gian buổi tối.'
  },
  night_vibes: {
    label: 'Night Vibes',
    timeContext: 'night',
    targetTempoBuckets: ['slow'],
    energyTarget: 'low',
    brightnessTarget: 'low',
    danceabilityTarget: 'low',
    moodHints: ['sleep', 'chill', 'acoustic', 'soft'],
    avoidTempoBuckets: ['fast'],
    reason: 'Tiết tấu chậm và năng lượng thấp, phù hợp nghe đêm.'
  }
};

function getSystemPlaylistTempoRule(systemKey) {
  return SYSTEM_PLAYLIST_TEMPO_RULES[String(systemKey || '').trim().toLowerCase()] || null;
}

function isTempoAwareSystemPlaylist(systemKey) {
  return Boolean(getSystemPlaylistTempoRule(systemKey));
}

function getSystemPlaylistTempoMetadata(systemKey) {
  const rule = getSystemPlaylistTempoRule(systemKey);
  if (!rule) {
    return {
      tempoAware: false,
      timeContext: null,
      tempoRule: null
    };
  }

  return {
    tempoAware: true,
    timeContext: rule.timeContext,
    tempoRule: {
      targetTempoBuckets: rule.targetTempoBuckets,
      energyTarget: rule.energyTarget,
      brightnessTarget: rule.brightnessTarget,
      danceabilityTarget: rule.danceabilityTarget
    }
  };
}

module.exports = {
  SYSTEM_PLAYLIST_TEMPO_RULES,
  getSystemPlaylistTempoRule,
  getSystemPlaylistTempoMetadata,
  isTempoAwareSystemPlaylist
};
