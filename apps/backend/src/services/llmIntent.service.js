const { parseIntentWithGroq } = require('./groqIntent.service');
const {
    createDefaultAiPlaylistIntent,
    sanitizeAiPlaylistIntent,
    clampTargetCount
} = require('../utils/aiPlaylistIntentSchema');
const { isValidLabel } = require('../utils/aiPlaylistLabels');

const intentCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCacheKey(prompt, options = {}) {
    return [
        options.mode || 'default',
        options.targetCount || '',
        String(prompt || '').trim().toLowerCase()
    ].join(':');
}

function getCachedIntent(key) {
    const item = intentCache.get(key);
    if (!item) return null;

    if (Date.now() - item.createdAt > CACHE_TTL_MS) {
        intentCache.delete(key);
        return null;
    }

    return item.value;
}

function setCachedIntent(key, value) {
    intentCache.set(key, {
        value,
        createdAt: Date.now()
    });
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/[^a-z0-9&\-\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeArray(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (!value) return [];
    return [String(value).trim()].filter(Boolean);
}

function normalizeEnum(value, allowedValues) {
    if (value == null) return null;
    const normalized = String(value).trim().toLowerCase();
    return allowedValues.includes(normalized) ? normalized : null;
}

function normalizeRhythmValue(value) {
    return normalizeEnum(value, ['low', 'medium', 'high', 'low_or_medium', 'medium_or_high', 'similar']);
}

function hasRhythmIntent(rhythm = {}) {
    return Object.values(rhythm || {}).some((value) => {
        const normalized = normalizeRhythmValue(value);
        return normalized && normalized !== 'similar';
    });
}

function normalizeMode(value) {
    return normalizeEnum(value, [
        'direct_song',
        'direct_artist',
        'direct_album',
        'lyrics_search',
        'mood_context',
        'genre_market',
        'similar_to_song',
        'similar_to_artist',
        'beat_rhythm',
        'karaoke_instrumental',
        'hybrid_seed',
        'unknown'
    ]);
}

function normalizeMarket(value) {
    const market = String(value || '').trim().toUpperCase();
    return ['VPOP', 'KPOP', 'USUK'].includes(market) ? market : null;
}

function normalizeTargetCount(value, fallback = 20) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n <= 10) return 10;
    if (n <= 20) return 20;
    return 30;
}

function detectExplicitMarket(prompt = '') {
    const normalizedPrompt = normalizeText(prompt);
    const rules = [
        { market: 'VPOP', phrases: ['vpop', 'v pop', 'v-pop', 'nhac viet', 'nhac viet nam', 'viet nam', 'vietnamese'] },
        { market: 'KPOP', phrases: ['kpop', 'k pop', 'k-pop', 'nhac han', 'han quoc', 'korean'] },
        { market: 'USUK', phrases: ['usuk', 'us uk', 'us-uk', 'au my', 'nhac au my', 'nhac my', 'nhac anh', 'english'] }
    ];

    for (const rule of rules) {
        if (hasAnyPhrase(normalizedPrompt, rule.phrases)) {
            return rule.market;
        }
    }

    return null;
}

function unique(values) {
    return [...new Set(normalizeArray(values))];
}

function mapGenre(value) {
    const normalized = normalizeText(value);
    const map = {
        pop: 'pop',
        ballad: 'ballad',
        rap: 'rap_hiphop',
        hiphop: 'rap_hiphop',
        'hip hop': 'rap_hiphop',
        rnb: 'rnb',
        'r&b': 'rnb',
        edm: 'edm',
        rock: 'rock_indie',
        indie: 'rock_indie',
        bolero: 'bolero_folk',
        folk: 'bolero_folk',
        acoustic: 'acoustic',
        lofi: 'lofi',
        dance: 'dance'
    };
    return map[normalized] || (isValidLabel('genre_family', normalized) ? normalized : null);
}

function mapMood(value) {
    const normalized = normalizeText(value);
    const map = {
        sad: 'sad',
        buon: 'sad',
        relax: 'chill',
        relaxing: 'chill',
        chill: 'chill',
        calm: 'calm',
        em: 'calm',
        diu: 'calm',
        romantic: 'romantic',
        happy: 'happy',
        energetic: 'energetic',
        party: 'party',
        focus: 'focus',
        nostalgic: 'nostalgic',
        motivation: 'motivational',
        motivational: 'motivational'
    };
    return map[normalized] || (isValidLabel('mood', normalized) ? normalized : null);
}

function mapContext(value) {
    const normalized = normalizeText(value);
    const map = {
        night: 'night',
        evening: 'night',
        'buoi toi': 'night',
        late_night: 'late_night',
        rain: 'rain',
        rainy: 'rain',
        deadline: 'deadline',
        breakup: 'breakup',
        lonely: 'lonely',
        love: 'love',
        nostalgia: 'nostalgia',
        weekend: 'weekend',
        morning: 'morning',
        afternoon: 'afternoon'
    };
    return map[normalized] || (isValidLabel('context', normalized) ? normalized : null);
}

function mapActivity(value) {
    const normalized = normalizeText(value);
    const map = {
        study: 'study',
        focus: 'study',
        work: 'work',
        coding: 'coding',
        gym: 'gym',
        workout: 'gym',
        running: 'gym',
        sleep: 'sleep',
        party: 'party',
        relax: 'relax',
        healing: 'healing',
        travel: 'travel',
        coffee: 'coffee',
        driving: 'driving'
    };
    return map[normalized] || (isValidLabel('activity', normalized) ? normalized : null);
}

function hasAnyPhrase(normalizedPrompt, phrases) {
    return phrases.some((phrase) => {
        const normalizedPhrase = normalizeText(phrase);
        return normalizedPhrase && new RegExp(`(^|\\s)${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(normalizedPrompt);
    });
}

function isPositiveRomanticPrompt(prompt, fallbackIntent = {}) {
    const normalizedPrompt = normalizeText(prompt);
    const hasRomanticSignal =
        hasAnyPhrase(normalizedPrompt, ['tinh yeu', 'yeu', 'ngot ngao', 'lang man', 'ngon tinh', 'tinh cam'])
        || (fallbackIntent?.softPreferences?.mood || []).includes('romantic')
        || (fallbackIntent?.softPreferences?.context || []).includes('love');
    const hasSadSignal = hasAnyPhrase(normalizedPrompt, [
        'buon',
        'sad',
        'suy',
        'co don',
        'tam trang',
        'that tinh',
        'chia tay',
        'heartbreak',
        'luy'
    ]);

    return hasRomanticSignal && !hasSadSignal;
}

function validateAndNormalizeIntent(rawIntent, fallbackIntent = {}) {
    const intent = rawIntent && typeof rawIntent === 'object' ? rawIntent : {};
    const legacyMinutesKey = ['duration', 'minutes'].join('_');
    const legacyMinutesCamelKey = ['duration', 'Minutes'].join('');
    if (intent.playlist?.[legacyMinutesKey] != null) {
        delete intent.playlist[legacyMinutesKey];
    }
    if (intent[legacyMinutesKey] != null) {
        delete intent[legacyMinutesKey];
    }
    if (intent[legacyMinutesCamelKey] != null) {
        delete intent[legacyMinutesCamelKey];
    }
    const normalized = {
        action: fallbackIntent.forceAction || normalizeEnum(intent.action, ['search', 'create_playlist', 'play']) || fallbackIntent.action || 'search',
        mode: normalizeMode(intent.mode) || fallbackIntent.mode || null,
        market: normalizeMarket(intent.market) || fallbackIntent.market || null,
        genres: unique(intent.genres),
        artists: unique(intent.artists),
        includeArtists: unique(intent.includeArtists),
        excludeArtists: unique(intent.excludeArtists),
        mood: unique(intent.mood),
        context: unique(intent.context),
        activity: mapActivity(intent.activity) || fallbackIntent.activity || null,
        tempo: normalizeEnum(intent.tempo, ['slow', 'medium', 'fast', 'slow_or_medium']) || fallbackIntent.tempo || null,
        energy: normalizeEnum(intent.energy, ['low', 'medium', 'high', 'low_or_medium']) || fallbackIntent.energy || null,
        avoidEnergy: normalizeEnum(intent.avoidEnergy, ['low', 'medium', 'high']) || fallbackIntent.avoidEnergy || null,
        excludeGenres: unique(intent.excludeGenres),
        rhythm: {
            beatStrength: normalizeRhythmValue(intent.softPreferences?.rhythm?.beatStrength ?? intent.rhythm?.beatStrength),
            bassIntensity: normalizeRhythmValue(intent.softPreferences?.rhythm?.bassIntensity ?? intent.rhythm?.bassIntensity),
            rhythmDensity: normalizeRhythmValue(intent.softPreferences?.rhythm?.rhythmDensity ?? intent.rhythm?.rhythmDensity),
            groove: normalizeRhythmValue(intent.softPreferences?.rhythm?.groove ?? intent.rhythm?.groove)
        },
        seedSongTitle: intent.seed?.song_title || intent.seed?.song || intent.songTitle || intent.song_title || null,
        targetCount: normalizeTargetCount(intent.targetCount ?? intent.playlist?.target_count, fallbackIntent.targetCount || 20),
        confidence: Number(intent.confidence || 0)
    };

    const textSignals = [
        ...normalized.mood,
        ...normalized.context,
        normalized.activity
    ].map((x) => String(x || '').toLowerCase());

    const isChillStudy =
        textSignals.some((x) => ['chill', 'calm', 'focus', 'study', 'relax', 'sad'].includes(x)) ||
        ['study', 'focus', 'sleep', 'relax'].includes(String(normalized.activity || '').toLowerCase());

    if (isChillStudy && normalized.energy === 'high') {
        normalized.energy = 'low_or_medium';
        normalized.avoidEnergy = 'high';
    }

    if (isChillStudy && !normalized.avoidEnergy) {
        normalized.avoidEnergy = 'high';
    }

    if (hasRhythmIntent(normalized.rhythm) && !['karaoke_instrumental', 'similar_to_song'].includes(normalized.mode)) {
        normalized.mode = 'beat_rhythm';
    }

    if (normalized.mode === 'similar_to_song' && normalized.seedSongTitle) {
        normalized.rhythm = {
            beatStrength: normalized.rhythm.beatStrength || 'similar',
            bassIntensity: normalized.rhythm.bassIntensity || 'similar',
            rhythmDensity: normalized.rhythm.rhythmDensity || 'similar',
            groove: normalized.rhythm.groove || 'similar'
        };
    }

    if (normalized.mode === 'beat_rhythm') {
        if (normalized.rhythm.beatStrength === 'high' || normalized.rhythm.bassIntensity === 'high') {
            normalized.energy = normalized.energy || 'high';
        }
        if (normalized.rhythm.beatStrength === 'low_or_medium') {
            normalized.energy = 'low_or_medium';
            normalized.avoidEnergy = 'high';
        }
    }

    return normalized;
}

function addUnique(target, value) {
    if (!value || target.includes(value)) return;
    target.push(value);
}

function applyPromptGuardsToNormalizedIntent(normalized, prompt = '', fallbackIntent = {}) {
    if (!normalized || typeof normalized !== 'object') return normalized;

    if (isPositiveRomanticPrompt(prompt, fallbackIntent)) {
        normalized.mood = normalized.mood.filter((mood) => {
            const mappedMood = mapMood(mood);
            return !['sad', 'chill'].includes(mappedMood);
        });
        if (['low', 'low_or_medium'].includes(normalized.energy)) {
            normalized.energy = fallbackIntent?.softPreferences?.energy || 'medium';
        }
        if (['slow', 'slow_or_medium'].includes(normalized.tempo)) {
            normalized.tempo = fallbackIntent?.softPreferences?.tempo || 'medium';
        }
        if (normalized.avoidEnergy === 'high') {
            normalized.avoidEnergy = null;
        }
    }

    return normalized;
}

function applyEnergy(intent, value) {
    if (value === 'low_or_medium') {
        intent.softPreferences.energy = 'low';
        return;
    }
    if (isValidLabel('energy', value)) {
        intent.softPreferences.energy = value;
    }
}

function applyTempo(intent, value) {
    if (value === 'slow_or_medium') {
        intent.softPreferences.tempo = 'slow';
        return;
    }
    if (isValidLabel('tempo', value)) {
        intent.softPreferences.tempo = value;
    }
}

function mapFlatIntentToPlaylistIntent(flatIntent, fallbackIntent = {}, prompt = '', targetCount) {
    const fallback = fallbackIntent?.hardConstraints ? fallbackIntent : createDefaultAiPlaylistIntent(prompt, targetCount);
    const normalized = validateAndNormalizeIntent(flatIntent, {
        forceAction: 'create_playlist',
        targetCount: clampTargetCount(targetCount || fallback?.playlist?.target_count)
    });
    const next = JSON.parse(JSON.stringify(fallback));
    applyPromptGuardsToNormalizedIntent(normalized, prompt, fallback);
    const explicitMarket = detectExplicitMarket(prompt);
    if (!explicitMarket && (!fallback?.hardConstraints?.market || fallback.hardConstraints.market === 'ANY')) {
        normalized.market = null;
    }

    if ((!next.hardConstraints.market || next.hardConstraints.market === 'ANY') && normalized.market) {
        next.hardConstraints.market = normalized.market;
        next.hardConstraints.language = { VPOP: 'vi', KPOP: 'ko', USUK: 'en' }[normalized.market] || 'any';
    }

    for (const genre of normalized.genres.map(mapGenre).filter(Boolean)) {
        addUnique(next.hardConstraints.genre_family, genre);
    }

    for (const genre of normalized.excludeGenres.map(mapGenre).filter(Boolean)) {
        addUnique(next.negativeConstraints.genre_family, genre);
        next.hardConstraints.genre_family = next.hardConstraints.genre_family.filter((item) => item !== genre);
    }

    for (const artist of [...normalized.artists, ...normalized.includeArtists]) {
        addUnique(next.hardConstraints.include_artists, artist);
    }

    for (const artist of normalized.excludeArtists) {
        addUnique(next.hardConstraints.exclude_artists, artist);
        addUnique(next.negativeConstraints.artists, artist);
    }

    for (const mood of normalized.mood.map(mapMood).filter(Boolean)) {
        addUnique(next.softPreferences.mood, mood);
    }

    for (const context of normalized.context.map(mapContext).filter(Boolean)) {
        addUnique(next.softPreferences.context, context);
    }

    if (normalized.activity) next.softPreferences.activity = normalized.activity;
    if (normalized.energy) applyEnergy(next, normalized.energy);
    if (normalized.tempo) applyTempo(next, normalized.tempo);
    if (normalized.avoidEnergy) addUnique(next.negativeConstraints.energy, normalized.avoidEnergy);
    if (normalized.mode) next.mode = normalized.mode;
    if (normalized.seedSongTitle && ['similar_to_song', 'karaoke_instrumental'].includes(normalized.mode)) {
        next.seed.seed_type = 'song_seed';
        next.seed.song = String(normalized.seedSongTitle).trim();
        next.seed.artist = null;
    }
    next.softPreferences.rhythm = {
        beatStrength: normalized.rhythm.beatStrength || next.softPreferences.rhythm?.beatStrength || null,
        bassIntensity: normalized.rhythm.bassIntensity || next.softPreferences.rhythm?.bassIntensity || null,
        rhythmDensity: normalized.rhythm.rhythmDensity || next.softPreferences.rhythm?.rhythmDensity || null,
        groove: normalized.rhythm.groove || next.softPreferences.rhythm?.groove || null
    };

    next.playlist.goal = 'create_playlist';

    next.playlist.target_count = clampTargetCount(normalized.targetCount || targetCount || next.playlist.target_count);
    next.playlist.include_seed_song = flatIntent?.playlist?.include_seed_song !== false;
    next.playlist.allow_expanded_results = flatIntent?.playlist?.allow_expanded_results === true;
    next.confidence = Math.max(Number(next.confidence || 0), Math.min(Math.max(normalized.confidence || 0, 0), 1));
    next.raw.prompt = prompt || next.raw.prompt || '';
    addUnique(next.raw.matchedKeywords, 'llm:intent_merge');
    addUnique(next.raw.matchedKeywords, `llm:provider:${flatIntent?._provider || 'unknown'}`);

    return sanitizeAiPlaylistIntent(next);
}

function mergeAssistantIntent(fallbackIntent = {}, flatIntent = {}, options = {}) {
    const normalized = validateAndNormalizeIntent(flatIntent, {
        action: fallbackIntent.action || 'search',
        market: Array.isArray(fallbackIntent.market) ? fallbackIntent.market[0] : fallbackIntent.market,
        energy: fallbackIntent.energy,
        targetCount: fallbackIntent.targetCount || 20
    });
    const next = { ...fallbackIntent };
    const keywords = new Set(next.keywords || []);
    const explicitMarket = detectExplicitMarket(options.prompt || fallbackIntent.rawPrompt || fallbackIntent.normalizedPrompt || '');

    next.action = normalized.action || next.action || 'search';
    next.mode = normalized.mode || next.mode;
    if (hasRhythmIntent(normalized.rhythm) && !['karaoke_instrumental', 'similar_to_song'].includes(next.mode)) {
        next.mode = 'beat_rhythm';
    }
    if (normalized.seedSongTitle && ['similar_to_song', 'karaoke_instrumental'].includes(normalized.mode)) {
        next.seedSongQuery = String(normalized.seedSongTitle).trim();
    }
    if (normalized.market && explicitMarket) next.market = [normalized.market];
    if (normalized.energy === 'low_or_medium') next.energy = 'low';
    else if (normalized.energy) next.energy = normalized.energy;

    for (const value of [
        ...normalized.genres,
        ...normalized.mood,
        ...normalized.context,
        normalized.activity,
        normalized.tempo,
        normalized.avoidEnergy ? `avoid_${normalized.avoidEnergy}_energy` : null
    ]) {
        const keyword = normalizeText(value);
        if (keyword) keywords.add(keyword);
    }

    next.keywords = [...keywords].filter(Boolean).slice(0, 12);
    next.llmIntentApplied = true;
    next.llmProvider = flatIntent?._provider || 'unknown';
    if (Object.values(normalized.rhythm || {}).some(Boolean)) {
        next.rhythm = normalized.rhythm;
    }
    return next;
}

function mergeIntent(fallbackIntent, llmIntent, options = {}) {
    if (options.mode === 'ai_search') {
        return mergeAssistantIntent(fallbackIntent, llmIntent, options);
    }

    return mapFlatIntentToPlaylistIntent(
        llmIntent,
        fallbackIntent,
        options.prompt,
        options.targetCount
    );
}

async function parseIntentWithGemini(prompt, options = {}) {
    try {
        const geminiService = require('./geminiPlaylist.service');
        if (typeof geminiService.parseIntentWithGemini === 'function') {
            return geminiService.parseIntentWithGemini(prompt, options);
        }
        if (typeof geminiService.extractIntent !== 'function') {
            return { ok: false, provider: 'gemini', reason: 'GEMINI_UNAVAILABLE' };
        }
        const intent = await geminiService.extractIntent(prompt, options);
        return { ok: true, provider: 'gemini', intent };
    } catch (error) {
        return {
            ok: false,
            provider: 'gemini',
            reason: error?.code || error?.name || 'GEMINI_INTENT_FAILED'
        };
    }
}

function getTaxonomyIntent(prompt, options = {}) {
    if (options.taxonomyIntent) return options.taxonomyIntent;

    if (options.mode === 'ai_search' && typeof options.taxonomyParser === 'function') {
        return options.taxonomyParser(prompt, options);
    }

    const { applyRuleBasedIntent } = require('./aiPlaylistIntent.service');
    return applyRuleBasedIntent(prompt, options.targetCount);
}

async function parseStructuredIntent(prompt, options = {}) {
    const cacheKey = getCacheKey(prompt, options);
    const cached = getCachedIntent(cacheKey);

    if (cached) {
        return {
            ...cached,
            cacheHit: true
        };
    }

    const taxonomyIntent = getTaxonomyIntent(prompt, options);

    if (process.env.LLM_ENABLED !== 'true') {
        const result = {
            provider: 'taxonomy',
            intent: taxonomyIntent,
            fallbackUsed: true,
            fallbackReason: 'LLM_DISABLED'
        };

        setCachedIntent(cacheKey, result);
        return result;
    }

    const groqResult = await parseIntentWithGroq(prompt, options);

    if (groqResult.ok) {
        const llmIntent = { ...groqResult.intent, _provider: 'groq' };
        const parsedIntent = applyPromptGuardsToNormalizedIntent(validateAndNormalizeIntent(groqResult.intent, {
            forceAction: options.mode === 'ai_playlist' ? 'create_playlist' : undefined,
            targetCount: options.targetCount || 20
        }), prompt, taxonomyIntent);
        const result = {
            provider: 'groq',
            intent: mergeIntent(taxonomyIntent, llmIntent, { ...options, prompt }),
            fallbackUsed: false,
            parsedIntent
        };

        setCachedIntent(cacheKey, result);
        return result;
    }

    let geminiResult = null;

    if (process.env.LLM_FALLBACK_PROVIDER === 'gemini') {
        geminiResult = await parseIntentWithGemini(prompt, options);

        if (geminiResult.ok) {
            const llmIntent = { ...geminiResult.intent, _provider: 'gemini' };
            const parsedIntent = applyPromptGuardsToNormalizedIntent(validateAndNormalizeIntent(geminiResult.intent, {
                forceAction: options.mode === 'ai_playlist' ? 'create_playlist' : undefined,
                targetCount: options.targetCount || 20
            }), prompt, taxonomyIntent);
            const result = {
                provider: 'gemini',
                intent: mergeIntent(taxonomyIntent, llmIntent, { ...options, prompt }),
                fallbackUsed: true,
                fallbackReason: groqResult.reason,
                parsedIntent
            };

            setCachedIntent(cacheKey, result);
            return result;
        }
    }

    const result = {
        provider: 'taxonomy',
        intent: taxonomyIntent,
        fallbackUsed: true,
        fallbackReason: geminiResult?.reason
            ? `${groqResult.reason};${geminiResult.reason}`
            : groqResult.reason
    };

    setCachedIntent(cacheKey, result);
    return result;
}

module.exports = {
    parseStructuredIntent,
    validateAndNormalizeIntent,
    mergeIntent
};
