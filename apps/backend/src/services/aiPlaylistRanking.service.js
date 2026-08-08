const { pool } = require('../config/database');
const { tableExists } = require('../utils/dbIntrospection');
const { publicSongCondition } = require('../utils/public.utils');
const { normalizeText } = require('./aiPlaylistIntent.service');
const modelService = require('./recommendationModel.service');
const { buildAiPlaylistSongReason } = require('./aiPlaylistReason.service');
const semanticProfileService = require('./songSemanticProfile.service');
const recommendationService = require('./recommendation.service');
const {
    computeTempoMatchScore,
    computeEnergyMatchScore,
    computeDanceabilityMatchScore,
    buildTempoReason
} = require('../utils/tempoFeature.util');

const DEFAULT_WEIGHTS = Object.freeze({
    semanticRag: 0.20,
    intentMatch: 0.26,
    bpr: 0.10,
    audioFeature: 0.18,
    userHistory: 0.08,
    popularity: 0.08,
    semantic: 0.08,
    diversity: 0.02
});

function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(n, 0), 1);
}

function normalize01(value, fallback = null) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp01(n > 1 ? n / 100 : n);
}

function normalizeMarket(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeArray(values) {
    return (values || []).map((value) => normalizeText(value)).filter(Boolean);
}

function normalizeDuplicateText(value) {
    return normalizeText(value)
        .replace(/\b(?:official|audio|video|mv|lyrics?|lyric|karaoke|remaster(?:ed)?|live|version|ver|single)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getDuplicateKeys(song) {
    const title = normalizeDuplicateText(song?.title);
    const artist = normalizeDuplicateText(song?.artist_name || song?.artist || '');
    if (!title) return [];
    return [
        `title_artist:${title}:${artist || 'unknown'}`,
        `title:${title}`
    ];
}

function hasDuplicateSong(song, seenDuplicateKeys) {
    return getDuplicateKeys(song).some((key) => seenDuplicateKeys.has(key));
}

function markDuplicateSong(song, seenDuplicateKeys) {
    for (const key of getDuplicateKeys(song)) {
        seenDuplicateKeys.add(key);
    }
}

function hasTextMatch(haystack, needles) {
    const normalized = normalizeText(haystack);
    return needles.some((needle) => normalized.includes(normalizeText(needle)));
}

function safeNorm(values) {
    const nums = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (!nums.length) return values.map(() => 0);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    return values.map((value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return (n - min) / range;
    });
}

function dotProduct(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return 0;
    const len = Math.min(a.length, b.length);
    let score = 0;
    for (let i = 0; i < len; i += 1) score += Number(a[i] || 0) * Number(b[i] || 0);
    return score;
}

function getEnergyScore(song) {
    const normalized = normalize01(song.energy_score);
    if (normalized !== null) return normalized;
    const energy = normalizeText(song.energy);
    if (energy === 'high') return 0.85;
    if (energy === 'medium') return 0.55;
    if (energy === 'low') return 0.25;
    return 0.5;
}

function getTempoScore(song) {
    const level = normalizeText(song.tempo_level || song.tempo_bucket || song.tempoBucket);
    if (level === 'fast') return 0.85;
    if (level === 'medium') return 0.55;
    if (level === 'slow') return 0.25;
    const bpm = Number(song.normalized_bpm ?? song.normalizedBpm ?? song.bpm);
    if (!Number.isFinite(bpm)) return 0.5;
    if (bpm > 120) return 0.85;
    if (bpm < 90) return 0.25;
    return 0.55;
}

function getBpmValue(song) {
    const bpm = Number(song.normalized_bpm ?? song.normalizedBpm ?? song.raw_bpm ?? song.bpm);
    return Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}

function scoreBpmSimilarity(song, seedFeature) {
    const bpm = getBpmValue(song);
    const seedBpm = getBpmValue(seedFeature);
    if (bpm === null || seedBpm === null) return 0.5;
    return clamp01(1 - Math.min(Math.abs(bpm - seedBpm) / 60, 1));
}

function scoreFeatureDistance(value, target) {
    const normalizedValue = normalize01(value, 0.5);
    const normalizedTarget = normalize01(target, 0.5);
    return clamp01(1 - Math.abs(normalizedValue - normalizedTarget));
}

function scoreSeedAudioSimilarity(song, seedFeature) {
    if (!seedFeature) return 0.5;
    return clamp01(
        scoreBpmSimilarity(song, seedFeature) * 0.22
        + scoreFeatureDistance(song.energy_score, seedFeature.energy_score) * 0.22
        + scoreFeatureDistance(song.danceability ?? song.danceability_score, seedFeature.danceability_score ?? seedFeature.danceability) * 0.18
        + scoreFeatureDistance(song.loudness, seedFeature.loudness) * 0.14
        + scoreFeatureDistance(song.dynamic_complexity, seedFeature.dynamic_complexity) * 0.14
        + scoreFeatureDistance(song.brightness ?? song.brightness_score, seedFeature.brightness_score ?? seedFeature.brightness) * 0.10
    );
}

function scoreSeedTitleCandidate(row, seedTitle) {
    const title = normalizeText(row.title);
    const query = normalizeText(seedTitle);
    if (!title || !query) return 0;
    if (title === query) return 100;
    if (title.includes(query) || query.includes(title)) return 80;
    const titleTokens = new Set(title.split(/\s+/).filter(Boolean));
    const queryTokens = query.split(/\s+/).filter(Boolean);
    if (!queryTokens.length) return 0;
    const matched = queryTokens.filter((token) => titleTokens.has(token) || title.includes(token)).length;
    return matched / queryTokens.length * 60;
}

function getSeedSearchTokens(seedTitle) {
    const rawTokens = String(seedTitle || '')
        .split(/\s+/)
        .map((token) => token.replace(/[^\p{L}\p{N}]/gu, '').trim())
        .filter((token) => token.length >= 2);
    const normalizedTokens = normalizeText(seedTitle)
        .split(/\s+/)
        .filter((token) => token.length >= 2);
    return [...new Set([...rawTokens, ...normalizedTokens])].slice(0, 12);
}

async function fetchSeedRowsByTitle(seedTitle) {
    const tokens = getSeedSearchTokens(seedTitle);
    const clauses = ['LOWER(s.title) LIKE LOWER(?)'];
    const params = [`%${seedTitle}%`];

    for (const token of tokens) {
        clauses.push('LOWER(s.title) LIKE LOWER(?)');
        params.push(`%${token}%`);
    }

    const [rows] = await pool.query(`
        SELECT s.id, s.title, s.artist_id, a.name AS artist_name
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        WHERE ${publicSongCondition('s')}
          AND s.audio_url IS NOT NULL
          AND TRIM(s.audio_url) <> ''
          AND (${clauses.join(' OR ')})
        LIMIT 80
    `, params);

    return rows;
}

async function fetchSeedRowsByCatalogScan() {
    const [rows] = await pool.query(`
        SELECT s.id, s.title, s.artist_id, a.name AS artist_name
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        WHERE ${publicSongCondition('s')}
          AND s.audio_url IS NOT NULL
          AND TRIM(s.audio_url) <> ''
    `);

    return rows;
}

async function resolveSeedSongForAudioSimilarity(intent) {
    if (intent?.mode !== 'similar_to_song' || intent?.seed?.seed_type !== 'song_seed' || !intent?.seed?.song) {
        return {
            enabled: false,
            resolved: false,
            song: null,
            feature: null,
            featureAvailable: false
        };
    }

    const seedTitle = String(intent.seed.song || '').trim();
    let rows = await fetchSeedRowsByTitle(seedTitle);
    let ranked = rows
        .map((row) => ({ ...row, _seedScore: scoreSeedTitleCandidate(row, seedTitle) }))
        .filter((row) => row._seedScore >= 25)
        .sort((a, b) => b._seedScore - a._seedScore || Number(a.id) - Number(b.id));

    if (!ranked.length) {
        rows = await fetchSeedRowsByCatalogScan();
        ranked = rows
            .map((row) => ({ ...row, _seedScore: scoreSeedTitleCandidate(row, seedTitle) }))
            .filter((row) => row._seedScore >= 45)
            .sort((a, b) => b._seedScore - a._seedScore || Number(a.id) - Number(b.id));
    }

    const song = ranked[0] || null;
    if (!song) {
        return {
            enabled: true,
            resolved: false,
            song: null,
            feature: null,
            featureAvailable: false
        };
    }

    const featureMap = await recommendationService.fetchAudioFeaturesForSongs([Number(song.id)]);
    const feature = featureMap.get(Number(song.id)) || null;
    return {
        enabled: true,
        resolved: true,
        song,
        feature,
        featureAvailable: Boolean(feature)
    };
}

function getRhythmPreference(soft = {}) {
    const rhythm = soft.rhythm || {};
    const values = Object.values(rhythm).map((value) => normalizeText(value)).filter(Boolean);
    if (values.includes('similar')) return 'similar';
    if (values.includes('high') || values.includes('medium_or_high')) return 'high';
    if (values.includes('low') || values.includes('low_or_medium')) return 'low';
    if (soft.energy === 'high' || soft.tempo === 'fast') return 'high';
    if (soft.energy === 'low' || soft.tempo === 'slow') return 'low';
    return null;
}

function scoreRhythmMatch(song, intent) {
    const soft = intent?.softPreferences || {};
    const preference = getRhythmPreference(soft);
    if (!preference || preference === 'similar') return 0.5;

    const energy = getEnergyScore(song);
    const tempo = getTempoScore(song);
    const danceability = normalize01(song.danceability ?? song.danceability_score, 0.5);
    const loudness = normalize01(song.loudness, 0.5);
    const dynamicComplexity = normalize01(song.dynamic_complexity, 0.5);
    const brightness = normalize01(song.brightness ?? song.brightness_score, 0.5);
    const calmFit = normalize01(song.calm_fit_score, null);
    const studySuitability = normalize01(song.study_suitability_score, null);

    if (preference === 'low') {
        return clamp01(
            (1 - energy) * 0.26
            + (tempo <= 0.58 ? 1 : Math.max(0, 1 - tempo)) * 0.18
            + (calmFit !== null ? calmFit : (1 - brightness)) * 0.20
            + (studySuitability !== null ? studySuitability : (1 - danceability)) * 0.16
            + (1 - dynamicComplexity) * 0.12
            + (1 - loudness) * 0.08
        );
    }

    return clamp01(
        energy * 0.28
        + danceability * 0.22
        + loudness * 0.16
        + dynamicComplexity * 0.16
        + tempo * 0.10
        + brightness * 0.08
    );
}

function getActivityValue(intent) {
    const activity = intent?.softPreferences?.activity;
    return Array.isArray(activity) ? activity[0] : activity;
}

function isCalmEnergyIntent(intent) {
    const soft = intent?.softPreferences || {};
    const moods = new Set(soft.mood || []);
    const contexts = new Set(soft.context || []);
    const activity = getActivityValue(intent);

    return (
        soft.energy === 'low' ||
        soft.tempo === 'slow' ||
        intent?.tempoIntent?.energyTarget === 'low' ||
        intent?.tempoIntent?.tempoBucket === 'slow' ||
        moods.has('chill') ||
        moods.has('calm') ||
        moods.has('focus') ||
        moods.has('sad') ||
        moods.has('heartbreak') ||
        contexts.has('relax') ||
        contexts.has('night') ||
        contexts.has('late_night') ||
        contexts.has('sleep') ||
        contexts.has('breakup') ||
        ['relax', 'sleep', 'healing', 'study', 'coding', 'work'].includes(activity)
    );
}

function isHighEnergySong(song) {
    const energyLabel = normalizeText(song.energy || '');
    return energyLabel === 'high' || getEnergyScore(song) >= 0.65;
}

function isFastTempoSong(song) {
    return getTempoScore(song) >= 0.78;
}

function isCalmIntentEnergyConflict(song, intent) {
    return isCalmEnergyIntent(intent) && isHighEnergySong(song);
}

function promptAllowsHighEnergy(intent) {
    const soft = intent?.softPreferences || {};
    const moods = new Set(soft.mood || []);
    const contexts = new Set(soft.context || []);
    const negativeEnergy = normalizeArray(intent?.negativeConstraints?.energy || []);
    const activity = normalizeText(getActivityValue(intent));

    if (negativeEnergy.includes('high')) return false;
    if (soft.energy === 'high' || intent?.tempoIntent?.energyTarget === 'high') return true;
    if (moods.has('energetic') || moods.has('party')) return true;
    if (contexts.has('party') || contexts.has('workout')) return true;
    return ['gym', 'workout', 'running', 'party', 'dance'].includes(activity);
}

function isExpandedResultMode(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function canUseHighEnergyForCalmIntent(intent, allowExpandedResults) {
    return promptAllowsHighEnergy(intent) || isExpandedResultMode(allowExpandedResults);
}

function getCalmFitScore(song, intent) {
    if (!isCalmEnergyIntent(intent)) return 0.5;
    const precomputedCalmFit = normalize01(song.calm_fit_score);
    if (precomputedCalmFit !== null) return precomputedCalmFit;
    const energy = getEnergyScore(song);
    const tempo = getTempoScore(song);
    const danceability = normalize01(song.danceability ?? song.danceability_score, 0.5);
    const penalty = Number(song?.scoreBreakdown?.penalty || 0);
    const energyFit = energy <= 0.55 ? 1 : (energy <= 0.65 ? 0.45 : Math.max(0, 0.25 - (energy - 0.65)));
    const tempoFit = tempo <= 0.58 ? 1 : (tempo <= 0.72 ? 0.45 : Math.max(0, 0.25 - (tempo - 0.72)));
    const focusFit = ['study', 'coding', 'work'].includes(getActivityValue(intent))
        ? clamp01(1 - Math.max(0, danceability - 0.58) * 1.8)
        : 0.7;
    return clamp01(energyFit * 0.50 + tempoFit * 0.30 + focusFit * 0.15 + (1 - penalty) * 0.05);
}

function getIntentPriorityTier(song, intent) {
    if (!isCalmEnergyIntent(intent)) return 0;
    if (isCalmIntentEnergyConflict(song, intent)) return 2;
    if (Number(song?.scoreBreakdown?.penalty || 0) >= 0.75) return 2;
    if (Number(song?.scoreBreakdown?.penalty || 0) >= 0.45) return 1;
    return 0;
}

function compareRankedSongs(a, b, intent) {
    const tierDiff = getIntentPriorityTier(a, intent) - getIntentPriorityTier(b, intent);
    if (tierDiff !== 0) return tierDiff;
    const fallbackDiff = Number(Boolean(a.aiFallback)) - Number(Boolean(b.aiFallback));
    if (fallbackDiff !== 0) return fallbackDiff;
    if (isCalmEnergyIntent(intent)) {
        const energyDiff = getEnergyScore(a) - getEnergyScore(b);
        if (Math.abs(energyDiff) > 0.0001) return energyDiff;
        const calmDiff = getCalmFitScore(b, intent) - getCalmFitScore(a, intent);
        if (Math.abs(calmDiff) > 0.0001) return calmDiff;
        const tempoDiff = getTempoScore(a) - getTempoScore(b);
        if (Math.abs(tempoDiff) > 0.0001) return tempoDiff;
    }
    return b.aiScore - a.aiScore || Number(b.play_count || 0) - Number(a.play_count || 0) || Number(a.id) - Number(b.id);
}

function scoreBand(value, target) {
    if (target === 'low') return 1 - Math.abs(value - 0.25) / 0.75;
    if (target === 'high') return 1 - Math.abs(value - 0.85) / 0.85;
    return 1 - Math.abs(value - 0.55) / 0.55;
}

function scoreIntentMatch(song, intent) {
    const hard = intent?.hardConstraints || {};
    const soft = intent?.softPreferences || {};
    const components = [];

    if (hard.market && hard.market !== 'ANY') {
        components.push(normalizeMarket(song.market) === hard.market ? 1 : 0);
    } else {
        components.push(0.65);
    }

    if (hard.language && hard.language !== 'any') {
        components.push(normalizeText(song.language) === normalizeText(hard.language) ? 1 : 0.4);
    }

    if (hard.genre_family?.length) {
        components.push(hard.genre_family.includes(song.genre_family) ? 1 : 0.35);
    }

    const songMoodText = `${song.mood || ''} ${song.vibe || ''} ${song.genre_name || ''} ${song.genre_slug || ''}`;
    if (soft.mood?.length) {
        const moodNeedles = normalizeArray(soft.mood);
        components.push(hasTextMatch(songMoodText, moodNeedles) ? 1 : 0.45);
    }

    if (soft.context?.length) {
        const contextText = `${song.mood || ''} ${song.vibe || ''} ${song.genre_name || ''}`;
        components.push(hasTextMatch(contextText, normalizeArray(soft.context)) ? 0.85 : 0.5);
    }

    if (soft.activity) {
        if (['gym', 'party'].includes(soft.activity)) {
            components.push(getEnergyScore(song) >= 0.65 || normalize01(song.danceability ?? song.danceability_score, 0) >= 0.65 ? 1 : 0.45);
        } else if (['study', 'coding', 'work'].includes(soft.activity)) {
            const energy = getEnergyScore(song);
            components.push(energy >= 0.25 && energy <= 0.7 ? 0.9 : 0.35);
        } else if (['sleep', 'relax', 'coffee', 'healing'].includes(soft.activity)) {
            components.push(getEnergyScore(song) <= 0.55 ? 1.0 : 0.0);
        } else {
            components.push(0.6);
        }
    }

    if (!components.length) return 0.5;
    return clamp01(components.reduce((sum, value) => sum + value, 0) / components.length);
}

function scoreAudioFeature(song, intent) {
    const soft = intent?.softPreferences || {};
    const scores = [];
    const energy = getEnergyScore(song);
    const tempo = getTempoScore(song);
    const danceability = normalize01(song.danceability ?? song.danceability_score, 0.5);
    const acoustic = normalize01(song.acoustic_score, 0.5);
    const studySuitability = normalize01(song.study_suitability_score);
    const calmFit = normalize01(song.calm_fit_score);

    if (soft.energy) scores.push(clamp01(scoreBand(energy, soft.energy)));
    if (soft.tempo) scores.push(clamp01(scoreBand(tempo, soft.tempo)));

    const moods = new Set(soft.mood || []);
    if (moods.has('chill') || moods.has('calm') || soft.activity === 'relax' || soft.activity === 'coffee') {
        scores.push(calmFit !== null ? calmFit : clamp01((1 - energy) * 0.65 + (1 - tempo) * 0.35));
    }
    if (moods.has('focus') || ['study', 'coding', 'work'].includes(soft.activity)) {
        const mediumEnergy = 1 - Math.abs(energy - 0.5) / 0.5;
        scores.push(studySuitability !== null ? studySuitability : clamp01(mediumEnergy * 0.7 + (1 - danceability) * 0.3));
    }
    if (moods.has('party') || moods.has('energetic') || ['gym', 'party'].includes(soft.activity)) {
        scores.push(clamp01(energy * 0.55 + danceability * 0.45));
    }
    if (moods.has('sad') || moods.has('heartbreak') || moods.has('nostalgic')) {
        scores.push(clamp01((1 - tempo) * 0.4 + (1 - energy) * 0.35 + acoustic * 0.25));
    }
    if (soft.vocal_preference === 'less_vocal' || soft.vocal_preference === 'instrumental_like') {
        scores.push(clamp01(acoustic * 0.55 + (1 - danceability) * 0.2 + (1 - energy) * 0.25));
    }
    if (intent?.mode === 'beat_rhythm' || Object.values(soft.rhythm || {}).some(Boolean)) {
        scores.push(scoreRhythmMatch(song, intent));
    }

    if (!scores.length) return 0.5;
    return clamp01(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function scoreTempoAware(song, intent) {
    const tempoIntent = intent?.tempoIntent;
    if (!tempoIntent) {
        return {
            tempoMatch: 0.5,
            energyMatch: 0.5,
            danceabilityMatch: 0.5,
            reason: null
        };
    }

    const feature = {
        tempo_level: song.tempo_level || song.tempo_bucket,
        normalized_bpm: song.normalized_bpm || song.bpm,
        energy_score: song.energy_score,
        danceability_score: song.danceability_score || song.danceability
    };
    return {
        tempoMatch: computeTempoMatchScore(feature, tempoIntent),
        energyMatch: computeEnergyMatchScore(feature, tempoIntent),
        danceabilityMatch: computeDanceabilityMatchScore(feature, tempoIntent),
        reason: buildTempoReason(feature, tempoIntent)
    };
}

function scorePenalty(song, intent) {
    const neg = intent?.negativeConstraints || {};
    let penalty = 0;
    const songText = normalizeText(`${song.genre_family || ''} ${song.genre_name || ''} ${song.genre_slug || ''} ${song.mood || ''} ${song.vibe || ''}`);

    for (const genre of neg.genre_family || []) {
        if (song.genre_family === genre || songText.includes(normalizeText(genre))) penalty += 0.22;
    }
    for (const mood of neg.mood || []) {
        if (songText.includes(normalizeText(mood))) penalty += 0.2;
        if (mood === 'party' && (getEnergyScore(song) >= 0.72 || normalize01(song.danceability, 0) >= 0.72)) penalty += 0.15;
        if (mood === 'heartbreak' && (songText.includes('heartbreak') || songText.includes('sad'))) penalty += 0.12;
    }
    for (const energy of neg.energy || []) {
        if (energy === 'high' && getEnergyScore(song) >= 0.68) penalty += 0.22;
        if (energy === 'low' && getEnergyScore(song) <= 0.35) penalty += 0.16;
    }
    for (const keyword of neg.keywords || []) {
        if (songText.includes(normalizeText(keyword))) penalty += 0.08;
    }

    const soft = intent?.softPreferences || {};
    const isLowEnergyIntent =
        (soft.energy === 'low') ||
        (soft.tempo === 'slow') ||
        (intent?.tempoIntent?.energyTarget === 'low') ||
        (intent?.tempoIntent?.tempoBucket === 'slow') ||
        (soft.mood || []).some(m => ['chill', 'calm', 'focus', 'sad', 'heartbreak'].includes(m)) ||
        (soft.context || []).some(c => ['relax', 'night', 'late_night', 'sleep', 'breakup'].includes(c)) ||
        ['relax', 'sleep', 'healing', 'study', 'coding', 'work'].includes(getActivityValue(intent));

    if (isLowEnergyIntent) {
        const eScore = getEnergyScore(song);
        const tScore = getTempoScore(song);
        if (eScore >= 0.65) penalty += 0.65;
        else if (eScore >= 0.58) penalty += 0.28;
        if (tScore >= 0.78) penalty += 0.50;
        else if (tScore >= 0.70) penalty += 0.25;
        if (songText.includes('dance') || songText.includes('edm') || songText.includes('remix') || songText.includes('vinahouse')) {
            penalty += 0.55;
        }
    }

    return clamp01(penalty);
}

function buildFallbackReason(song, intent) {
    if (!isCalmIntentEnergyConflict(song, intent)) {
        return null;
    }

    const soft = intent?.softPreferences || {};
    const target = soft.activity === 'study' || soft.activity === 'coding' || soft.activity === 'work' || (soft.mood || []).includes('focus')
        ? 'tập trung'
        : 'chill/nhẹ nhàng';

    return `Khớp một phần với ${target}: bài này được dùng để bù số lượng ứng viên, nên năng lượng có thể cao hơn intent ban đầu.`;
}

function buildNearMatchReason(song, intent) {
    if (!isCalmIntentEnergyConflict(song, intent)) return null;
    const target = ['study', 'coding', 'work'].includes(getActivityValue(intent))
        ? 'tap trung/hoc bai'
        : 'chill/nhe nhang';
    const energy = getEnergyScore(song);
    const tempo = getTempoScore(song);
    const energyText = energy < 0.65 ? 'energy thap hon nhieu bai KPOP khac' : 'energy hoi cao hon intent';
    const tempoText = tempo <= 0.58 ? 'tempo khong qua nhanh' : 'tempo con nhanh';
    return `Gan phu hop nhat voi ${target}: ${energyText}, ${tempoText}, duoc uu tien vi catalog KPOP hien thieu bai low/medium ro rang.`;
}

async function buildHistoryProfile(userId) {
    if (!userId) {
        return {
            artistCounts: new Map(),
            genreCounts: new Map(),
            likedSongIds: new Set(),
            followedArtistIds: new Set(),
            recentSongIds: new Set(),
            skippedSongIds: new Set()
        };
    }

    const profile = {
        artistCounts: new Map(),
        genreCounts: new Map(),
        likedSongIds: new Set(),
        followedArtistIds: new Set(),
        recentSongIds: new Set(),
        skippedSongIds: new Set()
    };

    if (await tableExists('listening_history')) {
        const [historyRows] = await pool.query(`
            SELECT s.artist_id,
                   s.genre_id,
                   lh.song_id,
                   MAX(lh.listened_at) AS last_listened_at,
                   COUNT(*) AS listens,
                   SUM(CASE WHEN COALESCE(lh.is_skipped, 0) = 1 THEN 1 ELSE 0 END) AS skips,
                   AVG(COALESCE(lh.completion_rate, 0)) AS avg_completion
            FROM listening_history lh
            JOIN songs s ON s.id = lh.song_id
            WHERE lh.user_id = ?
            GROUP BY s.artist_id, s.genre_id, lh.song_id
        `, [userId]);

        for (const row of historyRows) {
            const listens = Number(row.listens || 0);
            const completion = Number(row.avg_completion || 0);
            const skips = Number(row.skips || 0);
            if (row.artist_id) {
                profile.artistCounts.set(Number(row.artist_id), (profile.artistCounts.get(Number(row.artist_id)) || 0) + listens + completion);
            }
            if (row.genre_id) {
                profile.genreCounts.set(Number(row.genre_id), (profile.genreCounts.get(Number(row.genre_id)) || 0) + listens + completion);
            }
            if (row.last_listened_at && Date.now() - new Date(row.last_listened_at).getTime() < 7 * 24 * 60 * 60 * 1000) {
                profile.recentSongIds.add(Number(row.song_id));
            }
            if (skips >= Math.max(2, listens * 0.6)) {
                profile.skippedSongIds.add(Number(row.song_id));
            }
        }
    }

    if (await tableExists('song_likes')) {
        const [likes] = await pool.query('SELECT song_id FROM song_likes WHERE user_id = ?', [userId]);
        likes.forEach((row) => profile.likedSongIds.add(Number(row.song_id)));
    }

    if (await tableExists('artist_follows')) {
        const [follows] = await pool.query('SELECT artist_id FROM artist_follows WHERE user_id = ?', [userId]);
        follows.forEach((row) => profile.followedArtistIds.add(Number(row.artist_id)));
    }

    return profile;
}

function scoreUserHistory(song, profile, intent) {
    let score = 0;
    const artistTotal = [...profile.artistCounts.values()].reduce((sum, value) => sum + value, 0) || 1;
    const genreTotal = [...profile.genreCounts.values()].reduce((sum, value) => sum + value, 0) || 1;

    if (song.artist_id && profile.artistCounts.has(song.artist_id)) {
        score += Math.min(profile.artistCounts.get(song.artist_id) / artistTotal, 0.5);
    }
    if (song.genre_id && profile.genreCounts.has(song.genre_id)) {
        score += Math.min(profile.genreCounts.get(song.genre_id) / genreTotal, 0.35);
    }
    if (profile.likedSongIds.has(song.id)) score += 0.35;
    if (song.artist_id && profile.followedArtistIds.has(song.artist_id)) score += 0.25;

    if (profile.recentSongIds.has(song.id) && !['familiar', 'replay_favorites'].includes(intent?.softPreferences?.familiarity)) {
        score -= 0.15;
    }
    if (profile.skippedSongIds.has(song.id)) score -= 0.25;

    return clamp01(score);
}

function normalizeRecommendationArtifact(artifact) {
    if (!artifact || typeof artifact !== 'object') return {};
    if (artifact.recommendations && typeof artifact.recommendations === 'object') return artifact.recommendations;
    if (artifact.lightgcn && typeof artifact.lightgcn === 'object') return artifact.lightgcn;
    return artifact;
}

function getRecommendationItemsForUser(artifact, userId) {
    const recMap = normalizeRecommendationArtifact(artifact);
    const entry = recMap[String(userId)];
    if (!entry) return [];
    if (Array.isArray(entry)) return entry;
    return entry.items || entry.recommendations || entry.songs || [];
}

function getRecommendationItemScore(item) {
    return Number(item.finalScore ?? item.final_score ?? item.hybrid_score ?? item.model_score ?? item.score ?? 0);
}

function buildPersonalizationScoreMap(candidates, recItems) {
    const candidateIds = new Set(candidates.map((song) => Number(song.id)));
    const rawScores = [];
    const rawBySong = new Map();

    for (const item of recItems || []) {
        const songId = Number(item.song_id ?? item.id ?? item.songId);
        if (!candidateIds.has(songId)) continue;
        const score = getRecommendationItemScore(item);
        if (!Number.isFinite(score)) continue;
        rawBySong.set(songId, score);
        rawScores.push(score);
    }

    const normalized = safeNorm(candidates.map((song) => rawBySong.has(Number(song.id)) ? rawBySong.get(Number(song.id)) : null));
    const scores = new Map();
    candidates.forEach((song, index) => {
        scores.set(Number(song.id), rawBySong.has(Number(song.id)) ? normalized[index] : 0);
    });

    return {
        scores,
        matchedCandidateCount: rawBySong.size,
        hasScores: rawScores.length > 0
    };
}

function calculateBprScores(candidates, userId) {
    if (!userId) {
        return {
            scores: new Map(),
            bprAvailable: false,
            userInModel: false,
            source: 'anonymous'
        };
    }

    const servingResult = typeof modelService.tryLoadArtifact === 'function'
        ? modelService.tryLoadArtifact('serving')
        : { ok: false };
    if (servingResult.ok && servingResult.model) {
        const servingItems = getRecommendationItemsForUser(servingResult.model, userId);
        if (servingItems.length > 0) {
            const scoreMap = buildPersonalizationScoreMap(candidates, servingItems);
            return {
                ...scoreMap,
                bprAvailable: true,
                userInModel: scoreMap.hasScores,
                source: scoreMap.hasScores ? 'lightgcn_hybrid_v4_serving' : 'lightgcn_hybrid_v4_serving_no_candidate_overlap'
            };
        }
    }

    const lightgcnResult = typeof modelService.tryLoadArtifact === 'function'
        ? modelService.tryLoadArtifact('lightgcn')
        : modelService.tryLoad();
    const lightgcnItems = lightgcnResult.ok && lightgcnResult.model
        ? getRecommendationItemsForUser(lightgcnResult.model, userId)
        : [];
    if (lightgcnItems.length > 0) {
        const scoreMap = buildPersonalizationScoreMap(candidates, lightgcnItems);
        return {
            ...scoreMap,
            bprAvailable: true,
            userInModel: scoreMap.hasScores,
            source: scoreMap.hasScores ? 'lightgcn_hybrid_v4_artifact' : 'lightgcn_hybrid_v4_artifact_no_candidate_overlap'
        };
    }

    return {
        scores: new Map(),
        bprAvailable: Boolean(servingResult.ok || lightgcnResult.ok),
        userInModel: false,
        source: servingResult.ok || lightgcnResult.ok ? 'user_not_in_lightgcn_v4' : 'lightgcn_v4_unavailable'
    };
}

function scorePopularity(song, normPopularity, intent) {
    const preference = intent?.softPreferences?.popularity || 'balanced';
    const base = clamp01(normPopularity);
    if (preference === 'trending' || preference === 'popular') return base;
    if (preference === 'hidden_gems') return clamp01(1 - Math.abs(base - 0.35) / 0.65);
    return clamp01(base * 0.75 + 0.15);
}

function getArtistCap(intent) {
    const hardArtists = intent?.hardConstraints?.include_artists || [];
    if (hardArtists.length > 0) return intent?.playlist?.target_count || 50;
    if (intent?.seed?.seed_type === 'artist_seed') return 8;
    if (intent?.softPreferences?.diversity === 'diverse_artist') return 2;
    return 3;
}

function selectWithDiversity(scored, targetCount, intent) {
    const artistCap = getArtistCap(intent);
    const selected = [];
    const deferred = [];
    const artistCounts = new Map();
    const seen = new Set();
    const seenDuplicateKeys = new Set();

    for (const item of scored) {
        if (seen.has(item.id)) continue;
        if (hasDuplicateSong(item, seenDuplicateKeys)) continue;
        const artistId = item.artist_id || 0;
        const count = artistCounts.get(artistId) || 0;
        if (artistId && count >= artistCap) {
            deferred.push(item);
            continue;
        }
        item.scoreBreakdown.diversity = artistId ? clamp01(1 - count / Math.max(artistCap, 1)) : 0.8;
        selected.push(item);
        seen.add(item.id);
        markDuplicateSong(item, seenDuplicateKeys);
        if (artistId) artistCounts.set(artistId, count + 1);
        if (selected.length >= targetCount) return selected;
    }

    for (const item of deferred) {
        if (selected.length >= targetCount) break;
        if (seen.has(item.id)) continue;
        if (hasDuplicateSong(item, seenDuplicateKeys)) continue;
        item.scoreBreakdown.diversity = 0.2;
        selected.push(item);
        seen.add(item.id);
        markDuplicateSong(item, seenDuplicateKeys);
    }

    return selected;
}

function summarizeAnalysisVersions(songs) {
    const versions = [...new Set(
        (songs || [])
            .map((song) => String(song.analysis_version || '').trim())
            .filter(Boolean)
    )];
    if (!versions.length) return null;
    return versions.length === 1 ? versions[0] : versions;
}

async function rankAiPlaylistCandidates({ candidates = [], intent, userId = null, targetCount = 20, allowExpandedResults = false }) {
    const safeTarget = Math.max(1, Math.min(Number(targetCount) || 20, 50));
    const uniqueCandidates = [];
    const seen = new Set();
    const seenDuplicateKeys = new Set();
    let duplicateCandidateCount = 0;
    for (const candidate of candidates) {
        if (!candidate?.id || seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        if (hasDuplicateSong(candidate, seenDuplicateKeys)) {
            duplicateCandidateCount += 1;
            continue;
        }
        markDuplicateSong(candidate, seenDuplicateKeys);
        uniqueCandidates.push(candidate);
    }

    const bpr = calculateBprScores(uniqueCandidates, userId);
    const history = await buildHistoryProfile(userId);
    await semanticProfileService.attachSemanticProfiles(uniqueCandidates);
    const seedAudioContext = await resolveSeedSongForAudioSimilarity(intent);
    const seedAudioSimilarityUsed = Boolean(seedAudioContext.enabled && seedAudioContext.resolved && seedAudioContext.featureAvailable);
    const popularityValues = uniqueCandidates.map((song) => Math.log10(Number(song.play_count || 0) + Number(song.like_count || 0) * 5 + 1));
    const normPopularity = safeNorm(popularityValues);

    const scored = uniqueCandidates.map((song, index) => {
        const intentMatch = scoreIntentMatch(song, intent);
        const bprScore = bpr.scores.get(song.id) || 0;
        const audioFeature = scoreAudioFeature(song, intent);
        const tempoAware = scoreTempoAware(song, intent);
        const userHistory = scoreUserHistory(song, history, intent);
        const popularity = scorePopularity(song, normPopularity[index], intent);
        const penalty = scorePenalty(song, intent);
        const semantic = semanticProfileService.scoreSongByPromptIntent(song, intent);
        const semanticRag = clamp01(song.rag_score || 0);
        const diversity = 0.7;
        const seedAudioSimilarity = seedAudioSimilarityUsed
            ? scoreSeedAudioSimilarity(song, seedAudioContext.feature)
            : null;
        const baseScoreBeforeSeed = clamp01(
            DEFAULT_WEIGHTS.semanticRag * semanticRag
            + DEFAULT_WEIGHTS.intentMatch * intentMatch
            + DEFAULT_WEIGHTS.bpr * bprScore
            + DEFAULT_WEIGHTS.audioFeature * audioFeature
            + (intent?.tempoIntent ? 0.12 * tempoAware.tempoMatch + 0.08 * tempoAware.energyMatch + 0.05 * tempoAware.danceabilityMatch : 0)
            + DEFAULT_WEIGHTS.userHistory * userHistory
            + DEFAULT_WEIGHTS.popularity * popularity
            + DEFAULT_WEIGHTS.semantic * semantic
            + DEFAULT_WEIGHTS.diversity * diversity
        );
        const baseScore = seedAudioSimilarityUsed
            ? clamp01(baseScoreBeforeSeed * 0.58 + seedAudioSimilarity * 0.42)
            : baseScoreBeforeSeed;
        const aiScore = baseScore - penalty * 5;

        return {
            ...song,
            aiScore,
            scoreBreakdown: {
                semanticRag: Number(semanticRag.toFixed(4)),
                intentMatch: Number(intentMatch.toFixed(4)),
                bpr: Number(bprScore.toFixed(4)),
                audioFeature: Number(audioFeature.toFixed(4)),
                tempoMatch: Number(tempoAware.tempoMatch.toFixed(4)),
                energyMatch: Number(tempoAware.energyMatch.toFixed(4)),
                danceabilityMatch: Number(tempoAware.danceabilityMatch.toFixed(4)),
                userHistory: Number(userHistory.toFixed(4)),
                popularity: Number(popularity.toFixed(4)),
                semantic: Number(semantic.toFixed(4)),
                diversity: Number(diversity.toFixed(4)),
                seedAudioSimilarity: seedAudioSimilarity !== null ? Number(seedAudioSimilarity.toFixed(4)) : null,
                penalty: Number(penalty.toFixed(4))
            },
            tempoReason: tempoAware.reason
        };
    });

    const isCalmIntent = isCalmEnergyIntent(intent);
    const allowHighEnergyForCalm = canUseHighEnergyForCalmIntent(intent, allowExpandedResults);
    const strictCalmEnergyGuard = isCalmIntent && !allowHighEnergyForCalm;
    scored.sort((a, b) => compareRankedSongs(a, b, intent));
    const validScored = scored.filter(s => {
        if (strictCalmEnergyGuard) {
            return !isCalmIntentEnergyConflict(s, intent);
        }
        if (isCalmIntent) return getIntentPriorityTier(s, intent) < 2 || getCalmFitScore(s, intent) >= 0.30;
        return s.aiScore > 0 || s.scoreBreakdown.intentMatch >= 0.45 || s.scoreBreakdown.audioFeature >= 0.45;
    });
    let primaryScored = strictCalmEnergyGuard
        ? validScored
        : isCalmIntent
        ? validScored.filter((song) => getIntentPriorityTier(song, intent) === 0)
        : validScored;
    if (isCalmIntent && !strictCalmEnergyGuard && primaryScored.length === 0) {
        primaryScored = validScored.slice(0, safeTarget);
    }
    const fallbackScored = isCalmIntent
        ? scored
            .filter((song) => !primaryScored.some((primary) => primary.id === song.id))
            .sort((a, b) => compareRankedSongs(a, b, intent))
        : [];
    const primarySelected = selectWithDiversity(primaryScored, safeTarget, intent);
    const selectedBase = primarySelected.length >= safeTarget
        ? primarySelected
        : [
            ...primarySelected,
            ...selectWithDiversity(
                fallbackScored.filter((song) => !primarySelected.some((selectedSong) => selectedSong.id === song.id)),
                safeTarget - primarySelected.length,
                intent
            ).map((song) => ({
                ...song,
                aiFallback: true,
                fallbackReason: buildFallbackReason(song, intent) || 'Khớp một phần do không đủ ứng viên phù hợp hoàn toàn.'
            }))
        ];

    const selected = selectedBase.map((song) => {
        const rawScoreBeforeSeed = DEFAULT_WEIGHTS.semanticRag * song.scoreBreakdown.semanticRag
            + DEFAULT_WEIGHTS.intentMatch * song.scoreBreakdown.intentMatch
            + DEFAULT_WEIGHTS.bpr * song.scoreBreakdown.bpr
            + DEFAULT_WEIGHTS.audioFeature * song.scoreBreakdown.audioFeature
            + (intent?.tempoIntent ? 0.12 * song.scoreBreakdown.tempoMatch + 0.08 * song.scoreBreakdown.energyMatch + 0.05 * song.scoreBreakdown.danceabilityMatch : 0)
            + DEFAULT_WEIGHTS.userHistory * song.scoreBreakdown.userHistory
            + DEFAULT_WEIGHTS.popularity * song.scoreBreakdown.popularity
            + DEFAULT_WEIGHTS.semantic * song.scoreBreakdown.semantic
            + DEFAULT_WEIGHTS.diversity * song.scoreBreakdown.diversity;
        const rawScore = seedAudioSimilarityUsed
            ? clamp01(rawScoreBeforeSeed * 0.58 + Number(song.scoreBreakdown.seedAudioSimilarity || 0.5) * 0.42) - song.scoreBreakdown.penalty * 5
            : rawScoreBeforeSeed - song.scoreBreakdown.penalty * 5;
        const aiScore = clamp01(Math.max(0, rawScore));
        const rounded = {
            ...song,
            aiScore: Number(aiScore.toFixed(4)),
            scoreBreakdown: Object.fromEntries(
                Object.entries(song.scoreBreakdown).map(([key, value]) => [key, Number(Number(value).toFixed(4))])
            )
        };
        const fallbackReason = rounded.aiFallback
            ? (rounded.fallbackReason || buildFallbackReason(rounded, intent))
            : null;
        const nearMatchReason = !rounded.aiFallback
            ? buildNearMatchReason(rounded, intent)
            : null;
        return {
            ...rounded,
            matchQuality: rounded.aiFallback ? 'partial' : (nearMatchReason ? 'near' : 'strong'),
            fallbackUsed: Boolean(rounded.aiFallback),
            fallbackReason,
            reason: fallbackReason || nearMatchReason || rounded.tempoReason || buildAiPlaylistSongReason(rounded, intent, rounded.scoreBreakdown)
        };
    });

    const strategy = bpr.bprAvailable && bpr.userInModel
        ? 'semantic_rag_lightgcn_v4_intent_guarded'
        : (selected.length ? 'content_audio_popularity_fallback' : 'popular_fallback');

    return {
        songs: selected,
        rankingMeta: {
            strategy,
            weights: DEFAULT_WEIGHTS,
            tempoAware: Boolean(intent?.tempoIntent),
            beatRhythmIntent: intent?.mode === 'beat_rhythm',
            rhythmPreferences: intent?.softPreferences?.rhythm || null,
            seedAudioSimilarityUsed,
            seedSongResolved: Boolean(seedAudioContext.enabled && seedAudioContext.resolved),
            seedSongId: seedAudioContext.song ? Number(seedAudioContext.song.id) : null,
            seedSongTitle: seedAudioContext.song?.title || intent?.seed?.song || null,
            seedFeatureAvailable: Boolean(seedAudioContext.featureAvailable),
            detectedTempoIntent: intent?.tempoIntent || null,
            bprAvailable: bpr.bprAvailable,
            userInModel: bpr.userInModel,
            personalizationSource: bpr.source,
            personalizedCandidateCount: bpr.matchedCandidateCount || 0,
            calmEnergyIntent: isCalmIntent,
            strictCalmEnergyGuard,
            allowExpandedResults: isExpandedResultMode(allowExpandedResults),
            highEnergyAllowedByPrompt: promptAllowsHighEnergy(intent),
            fallbackSongCount: selected.filter((song) => song.fallbackUsed).length,
            strictLowEnergy: strictCalmEnergyGuard,
            validCount: validScored.length,
            goodCount: primarySelected.length,
            softCount: primaryScored.length,
            partialCount: selected.filter((song) => song.fallbackUsed).length,
            actualCount: selected.length,
            requestedCount: safeTarget,
            highEnergyTop5Count: selected.slice(0, 5).filter((song) => isCalmIntentEnergyConflict(song, intent)).length,
            analysisVersionUsed: summarizeAnalysisVersions(selected),
            debugCounts: {
                inputCandidates: uniqueCandidates.length,
                duplicateCandidateCount,
                scored: scored.length,
                afterIntentFilter: validScored.length,
                afterEnergyFilter: primaryScored.length,
                blockedHighEnergyCount: strictCalmEnergyGuard
                    ? scored.filter((song) => isCalmIntentEnergyConflict(song, intent)).length
                    : 0,
                fastTempoFinalCount: selected.filter((song) => isFastTempoSong(song)).length,
                fallbackPool: fallbackScored.length,
                afterDiversity: selectedBase.length,
                finalCount: selected.length,
                validCount: validScored.length,
                goodCount: primarySelected.length,
                softCount: primaryScored.length,
                partialCount: selected.filter((song) => song.fallbackUsed).length,
                actualCount: selected.length,
                requestedCount: safeTarget,
                highEnergyFinalCount: selected.filter((song) => isCalmIntentEnergyConflict(song, intent)).length,
                highEnergyTop5Count: selected.slice(0, 5).filter((song) => isCalmIntentEnergyConflict(song, intent)).length,
                analysisVersionUsed: summarizeAnalysisVersions(selected),
                seedAudioSimilarityUsed,
                seedSongResolved: Boolean(seedAudioContext.enabled && seedAudioContext.resolved),
                seedSongId: seedAudioContext.song ? Number(seedAudioContext.song.id) : null,
                seedFeatureAvailable: Boolean(seedAudioContext.featureAvailable),
                averageSeedAudioSimilarityTop5: seedAudioSimilarityUsed && selected.slice(0, 5).length
                    ? Number((selected.slice(0, 5).reduce((sum, song) => sum + Number(song.scoreBreakdown?.seedAudioSimilarity || 0), 0) / selected.slice(0, 5).length).toFixed(4))
                    : null,
                partialTop3Count: selected.slice(0, 3).filter((song) => song.fallbackUsed).length,
                averageCalmFitTop5: selected.slice(0, 5).length
                    ? Number((selected.slice(0, 5).reduce((sum, song) => sum + getCalmFitScore(song, intent), 0) / selected.slice(0, 5).length).toFixed(4))
                    : 0
            }
        }
    };
}

module.exports = {
    rankAiPlaylistCandidates,
    DEFAULT_WEIGHTS,
    scoreIntentMatch,
    scoreAudioFeature,
    scorePenalty,
    isCalmEnergyIntent,
    isCalmIntentEnergyConflict
};
