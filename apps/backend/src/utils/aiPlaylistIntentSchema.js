const { filterValidLabels, isValidLabel } = require('./aiPlaylistLabels');

const MIN_TARGET_COUNT = 5;
const MAX_TARGET_COUNT = 50;
const DEFAULT_TARGET_COUNT = 20;

function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

function clampTargetCount(value) {
    return clampNumber(value, MIN_TARGET_COUNT, MAX_TARGET_COUNT, DEFAULT_TARGET_COUNT);
}

function uniqueStrings(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function createDefaultAiPlaylistIntent(prompt = '', targetCount = DEFAULT_TARGET_COUNT) {
    return {
        hardConstraints: {
            market: 'ANY',
            language: 'any',
            genre_family: [],
            include_artists: [],
            exclude_artists: []
        },
        softPreferences: {
            mood: [],
            mood_intensity: 'medium',
            tempo: 'medium',
            energy: 'medium',
            activity: null,
            context: [],
            vocal_preference: 'any',
            familiarity: 'balanced',
            popularity: 'balanced',
            diversity: 'balanced'
        },
        seed: {
            seed_type: 'none',
            artist: null,
            song: null,
            genre: null
        },
        negativeConstraints: {
            mood: [],
            genre_family: [],
            energy: [],
            artists: [],
            keywords: []
        },
        playlist: {
            goal: 'create_playlist',
            target_count: clampTargetCount(targetCount),
            duration_minutes: null
        },
        confidence: 0.0,
        explanation: '',
        raw: {
            prompt: prompt || '',
            matchedKeywords: []
        }
    };
}

function sanitizeAiPlaylistIntent(intent) {
    const safe = createDefaultAiPlaylistIntent(intent?.raw?.prompt || '', intent?.playlist?.target_count);

    safe.hardConstraints.market = isValidLabel('market', intent?.hardConstraints?.market)
        ? intent.hardConstraints.market
        : safe.hardConstraints.market;
    safe.hardConstraints.language = isValidLabel('language', intent?.hardConstraints?.language)
        ? intent.hardConstraints.language
        : safe.hardConstraints.language;
    safe.hardConstraints.genre_family = filterValidLabels('genre_family', intent?.hardConstraints?.genre_family)
        .filter((label) => label !== 'any');
    safe.hardConstraints.include_artists = uniqueStrings(intent?.hardConstraints?.include_artists);
    safe.hardConstraints.exclude_artists = uniqueStrings(intent?.hardConstraints?.exclude_artists);

    safe.softPreferences.mood = filterValidLabels('mood', intent?.softPreferences?.mood);
    safe.softPreferences.mood_intensity = isValidLabel('mood_intensity', intent?.softPreferences?.mood_intensity)
        ? intent.softPreferences.mood_intensity
        : safe.softPreferences.mood_intensity;
    safe.softPreferences.tempo = isValidLabel('tempo', intent?.softPreferences?.tempo)
        ? intent.softPreferences.tempo
        : safe.softPreferences.tempo;
    safe.softPreferences.energy = isValidLabel('energy', intent?.softPreferences?.energy)
        ? intent.softPreferences.energy
        : safe.softPreferences.energy;
    safe.softPreferences.activity = isValidLabel('activity', intent?.softPreferences?.activity)
        ? intent.softPreferences.activity
        : null;
    safe.softPreferences.context = filterValidLabels('context', intent?.softPreferences?.context);
    safe.softPreferences.vocal_preference = isValidLabel('vocal_preference', intent?.softPreferences?.vocal_preference)
        ? intent.softPreferences.vocal_preference
        : safe.softPreferences.vocal_preference;
    safe.softPreferences.familiarity = isValidLabel('familiarity', intent?.softPreferences?.familiarity)
        ? intent.softPreferences.familiarity
        : safe.softPreferences.familiarity;
    safe.softPreferences.popularity = isValidLabel('popularity', intent?.softPreferences?.popularity)
        ? intent.softPreferences.popularity
        : safe.softPreferences.popularity;
    safe.softPreferences.diversity = isValidLabel('diversity', intent?.softPreferences?.diversity)
        ? intent.softPreferences.diversity
        : safe.softPreferences.diversity;

    safe.seed.seed_type = isValidLabel('seed_type', intent?.seed?.seed_type) ? intent.seed.seed_type : 'none';
    safe.seed.artist = intent?.seed?.artist ? String(intent.seed.artist).trim() : null;
    safe.seed.song = intent?.seed?.song ? String(intent.seed.song).trim() : null;
    safe.seed.genre = isValidLabel('genre_family', intent?.seed?.genre) && intent.seed.genre !== 'any' ? intent.seed.genre : null;

    if (safe.seed.seed_type === 'none') {
        safe.seed.artist = null;
        safe.seed.song = null;
        safe.seed.genre = null;
    }

    safe.negativeConstraints.mood = filterValidLabels('mood', intent?.negativeConstraints?.mood);
    safe.negativeConstraints.genre_family = filterValidLabels('genre_family', intent?.negativeConstraints?.genre_family)
        .filter((label) => label !== 'any');
    safe.negativeConstraints.energy = filterValidLabels('energy', intent?.negativeConstraints?.energy);
    safe.negativeConstraints.artists = uniqueStrings(intent?.negativeConstraints?.artists);
    safe.negativeConstraints.keywords = uniqueStrings(intent?.negativeConstraints?.keywords);

    safe.playlist.goal = isValidLabel('playlist_goal', intent?.playlist?.goal) ? intent.playlist.goal : 'create_playlist';
    safe.playlist.target_count = clampTargetCount(intent?.playlist?.target_count);
    safe.playlist.duration_minutes = intent?.playlist?.duration_minutes !== null
        && intent?.playlist?.duration_minutes !== undefined
        && Number.isFinite(Number(intent?.playlist?.duration_minutes))
        ? Number(intent.playlist.duration_minutes)
        : null;

    const confidence = Number(intent?.confidence);
    safe.confidence = Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0;
    safe.explanation = String(intent?.explanation || '').trim();
    safe.raw.prompt = String(intent?.raw?.prompt || '');
    safe.raw.matchedKeywords = uniqueStrings(intent?.raw?.matchedKeywords);
    if (intent?.tempoIntent && typeof intent.tempoIntent === 'object') {
        safe.tempoIntent = {
            tempoBucket: intent.tempoIntent.tempoBucket || null,
            energyTarget: intent.tempoIntent.energyTarget || null,
            danceabilityTarget: intent.tempoIntent.danceabilityTarget || null,
            activity: intent.tempoIntent.activity || null,
            label: intent.tempoIntent.label || null
        };
    }

    return safe;
}

module.exports = {
    MIN_TARGET_COUNT,
    MAX_TARGET_COUNT,
    DEFAULT_TARGET_COUNT,
    clampTargetCount,
    createDefaultAiPlaylistIntent,
    sanitizeAiPlaylistIntent,
    uniqueStrings
};
