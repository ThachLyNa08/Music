const {
    SYNONYM_RULES,
    MARKET_RULES,
    GENRE_RULES,
    ACTIVITY_RULES,
    CONTEXT_RULES,
    FAMILIARITY_RULES,
    POPULARITY_RULES,
    DIVERSITY_RULES,
    NEGATIVE_RULES
} = require('../utils/aiPlaylistSynonyms');
const { isValidLabel } = require('../utils/aiPlaylistLabels');
const {
    createDefaultAiPlaylistIntent,
    sanitizeAiPlaylistIntent,
    clampTargetCount
} = require('../utils/aiPlaylistIntentSchema');

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9&\-\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function addUnique(target, value) {
    if (!value || target.includes(value)) return;
    target.push(value);
}

function removeValues(target, values) {
    if (!Array.isArray(target) || !Array.isArray(values)) return target || [];
    return target.filter((value) => !values.includes(value));
}

function hasPhrase(normalizedPrompt, phrase) {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase) return false;
    const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(normalizedPrompt);
}

function collectRuleMatches(normalizedPrompt, rules) {
    const matches = [];
    for (const rule of rules) {
        const matchedPhrases = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matchedPhrases.length > 0) {
            matches.push({ rule, matchedPhrases });
        }
    }
    return matches;
}

function addMatchedKeywords(intent, id, phrases) {
    for (const phrase of phrases) {
        addUnique(intent.raw.matchedKeywords, `${id}:${phrase}`);
    }
}

function setScalarPreference(intent, field, value) {
    if (!value) return;
    intent.softPreferences[field] = value;
}

function applyMoodRule(intent, match) {
    const { rule, matchedPhrases } = match;
    const apply = rule.apply || {};

    for (const mood of apply.mood || []) {
        addUnique(intent.softPreferences.mood, mood);
    }
    for (const context of apply.context || []) {
        addUnique(intent.softPreferences.context, context);
    }
    if (apply.energy) setScalarPreference(intent, 'energy', apply.energy);
    if (apply.tempo) setScalarPreference(intent, 'tempo', apply.tempo);
    if (apply.mood_intensity) setScalarPreference(intent, 'mood_intensity', apply.mood_intensity);

    addMatchedKeywords(intent, rule.id, matchedPhrases);
}

function applyMarketRules(intent, normalizedPrompt) {
    for (const rule of MARKET_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length === 0) continue;

        intent.hardConstraints.market = rule.market;
        intent.hardConstraints.language = rule.language;
        addMatchedKeywords(intent, `market:${rule.market}`, matched);
        return;
    }
}

function applyGenreRules(intent, normalizedPrompt) {
    for (const rule of GENRE_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length === 0) continue;

        addUnique(intent.hardConstraints.genre_family, rule.genre);
        if (intent.seed.seed_type === 'none' && ['pop', 'ballad', 'rap_hiphop', 'rnb', 'edm', 'lofi'].includes(rule.genre)) {
            intent.seed.seed_type = 'genre_seed';
            intent.seed.genre = rule.genre;
        }
        addMatchedKeywords(intent, `genre:${rule.genre}`, matched);
    }
}

function applyActivityRules(intent, normalizedPrompt) {
    const priority = {
        relax: 1,
        travel: 2,
        coffee: 2,
        driving: 3,
        work: 4,
        study: 4,
        coding: 5,
        healing: 5,
        sleep: 6,
        party: 6,
        gym: 7
    };

    for (const rule of ACTIVITY_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length === 0) continue;

        const current = intent.softPreferences.activity;
        if (!current || (priority[rule.activity] || 0) >= (priority[current] || 0)) {
            intent.softPreferences.activity = rule.activity;
        }
        addMatchedKeywords(intent, `activity:${rule.activity}`, matched);
    }
}

function applyContextRules(intent, normalizedPrompt) {
    for (const rule of CONTEXT_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length === 0) continue;

        addUnique(intent.softPreferences.context, rule.context);
        addMatchedKeywords(intent, `context:${rule.context}`, matched);
    }
}

function applySimplePreferenceRules(intent, normalizedPrompt) {
    for (const rule of FAMILIARITY_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length > 0) {
            intent.softPreferences.familiarity = rule.familiarity;
            addMatchedKeywords(intent, `familiarity:${rule.familiarity}`, matched);
        }
    }

    for (const rule of POPULARITY_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length > 0) {
            intent.softPreferences.popularity = rule.popularity;
            addMatchedKeywords(intent, `popularity:${rule.popularity}`, matched);
        }
    }

    for (const rule of DIVERSITY_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length > 0) {
            intent.softPreferences.diversity = rule.diversity;
            addMatchedKeywords(intent, `diversity:${rule.diversity}`, matched);
        }
    }
}

function applyNegativeRules(intent, normalizedPrompt) {
    for (const rule of NEGATIVE_RULES) {
        const matched = rule.phrases.filter((phrase) => hasPhrase(normalizedPrompt, phrase));
        if (matched.length === 0) continue;

        const apply = rule.apply || {};
        for (const mood of apply.mood || []) {
            addUnique(intent.negativeConstraints.mood, mood);
        }
        for (const genre of apply.genre_family || []) {
            addUnique(intent.negativeConstraints.genre_family, genre);
        }
        for (const energy of apply.energy || []) {
            addUnique(intent.negativeConstraints.energy, energy);
        }
        for (const keyword of apply.keywords || []) {
            addUnique(intent.negativeConstraints.keywords, keyword);
        }
        if (apply.vocal_preference) {
            intent.softPreferences.vocal_preference = apply.vocal_preference;
        }
        if (apply.mood_intensity) {
            intent.softPreferences.mood_intensity = apply.mood_intensity;
        }
        if (apply.energyValue) {
            intent.softPreferences.energy = apply.energyValue;
        }

        addMatchedKeywords(intent, `negative:${rule.id}`, matched);
    }

    intent.softPreferences.mood = removeValues(intent.softPreferences.mood, intent.negativeConstraints.mood);
    intent.hardConstraints.genre_family = removeValues(
        intent.hardConstraints.genre_family,
        intent.negativeConstraints.genre_family
    );
}

function cleanSeedText(value) {
    return String(value || '')
        .replace(/^(cua|vibe cua|bai|ca khuc|nhac|nghe si|ca si)\s+/i, '')
        .replace(/\s+(nhung|ma|de|cho|voi|nhe hon|hon)$/i, '')
        .replace(/[,.!?;:]+$/g, '')
        .trim();
}

function looksLikeSeedText(value) {
    const cleaned = cleanSeedText(value);
    const normalized = normalizeText(cleaned);
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 5) return false;

    const semanticStarts = [
        'sau lang',
        'nhe nhang',
        'buon',
        'chill',
        'vui',
        'soi dong',
        'nao nhiet',
        'hoai niem',
        'tinh cam'
    ];
    if (semanticStarts.some((phrase) => normalized.startsWith(phrase))) return false;

    if (/[A-ZÀ-ỸĐ]{2,}/.test(cleaned)) return true;
    if (/\b[A-ZÀ-ỸĐ][a-zà-ỹđ]+(?:\s+[A-ZÀ-ỸĐ][a-zà-ỹđ]+)+/.test(cleaned)) return true;

    const known = ['son tung', 'son tung m-tp', 'blackpink', 'taylor swift', 'den vau', 'my tam', 'erik', 'hoa minzy'];
    return known.some((artist) => normalized.includes(artist));
}

function restoreOriginalSlice(originalPrompt, normalizedCandidate) {
    const candidate = cleanSeedText(normalizedCandidate);
    if (!candidate) return null;

    const originalWords = String(originalPrompt || '').split(/\s+/);
    const normalizedWords = originalWords.map((word) => normalizeText(word));
    const candidateWords = normalizeText(candidate).split(/\s+/).filter(Boolean);

    for (let i = 0; i <= normalizedWords.length - candidateWords.length; i += 1) {
        const slice = normalizedWords.slice(i, i + candidateWords.length).join(' ');
        if (slice === candidateWords.join(' ')) {
            return cleanSeedText(originalWords.slice(i, i + candidateWords.length).join(' '));
        }
    }

    return candidate;
}

function detectSeedAndArtists(intent, prompt, normalizedPrompt) {
    let textForHardMatch = normalizedPrompt;

    const seedMatch = textForHardMatch.match(
        /\b(?:giong|kieu|vibe cua|vibe|cung vibe|tuong tu)\s+(.+?)(?:\s+(?:nhung|ma|de|cho|voi)\b|$)/
    );
    if (seedMatch) {
        const seedText = restoreOriginalSlice(prompt, seedMatch[1]);
        if (seedText && looksLikeSeedText(seedText)) {
            intent.seed.seed_type = 'artist_seed';
            intent.seed.artist = seedText;
            addMatchedKeywords(intent, 'seed:artist', [seedText]);
            textForHardMatch = textForHardMatch.replace(seedMatch[0], ' ');
        }
    }

    const hardArtistMatch = textForHardMatch.match(
        /\b(?:chi lay|chi nghe|toan bai|uu tien bai cua|nhac cua|bai cua|playlist cua|chi|nghe|mo|uu tien|cua)\s+(.+?)(?:\s+(?:nhung|ma|de|cho|voi)\b|$)/
    );
    if (hardArtistMatch) {
        const artist = restoreOriginalSlice(prompt, hardArtistMatch[1]);
        if (artist && looksLikeSeedText(artist)) {
            addUnique(intent.hardConstraints.include_artists, artist);
            if (intent.seed.seed_type === 'none') {
                intent.seed.seed_type = 'artist_seed';
                intent.seed.artist = artist;
            }
            addMatchedKeywords(intent, 'include_artist', [artist]);
        }
    }

    const excludeArtistMatch = normalizedPrompt.match(/\b(?:dung|khong|tranh)\s+(?:nhac cua|bai cua|ca si|nghe si)?\s*(.+)$/);
    if (excludeArtistMatch && /\b(ca si|nghe si|nhac cua|bai cua)\b/.test(normalizedPrompt)) {
        const artist = restoreOriginalSlice(prompt, excludeArtistMatch[1]);
        if (artist) {
            addUnique(intent.hardConstraints.exclude_artists, artist);
            addUnique(intent.negativeConstraints.artists, artist);
            addMatchedKeywords(intent, 'exclude_artist', [artist]);
        }
    }

    const knownArtists = [
        'Son Tung',
        'Son Tung M-TP',
        'BLACKPINK',
        'Taylor Swift',
        'Den Vau',
        'My Tam',
        'Erik',
        'Hoa Minzy'
    ];
    if (intent.seed.seed_type !== 'none' || intent.hardConstraints.include_artists.length > 0) return;

    for (const artist of knownArtists) {
        if (!hasPhrase(normalizedPrompt, artist)) continue;
        const restored = restoreOriginalSlice(prompt, artist) || artist;
        intent.seed.seed_type = 'artist_seed';
        intent.seed.artist = restored;
        addMatchedKeywords(intent, 'artist_mention', [restored]);
        break;
    }
}

function inferPlaylistGoal(intent, normalizedPrompt) {
    if (hasPhrase(normalizedPrompt, 'quick mix') || hasPhrase(normalizedPrompt, 'vai bai')) {
        intent.playlist.goal = 'quick_mix';
        return;
    }
    if (hasPhrase(normalizedPrompt, 'kham pha') || hasPhrase(normalizedPrompt, 'bai moi') || hasPhrase(normalizedPrompt, 'la la')) {
        intent.playlist.goal = 'explore';
        return;
    }
    if (hasPhrase(normalizedPrompt, 'gu cua toi') || hasPhrase(normalizedPrompt, 'bai hay nghe')) {
        intent.playlist.goal = 'replay_favorites';
    }
}

function applyRuleBasedIntent(prompt, targetCount) {
    const intent = createDefaultAiPlaylistIntent(prompt, targetCount);
    const normalizedPrompt = normalizeText(prompt);

    if (!normalizedPrompt) {
        intent.explanation = 'Prompt trống, chưa đủ dữ liệu để hiểu ý định tạo playlist.';
        return intent;
    }

    applyMarketRules(intent, normalizedPrompt);
    applyGenreRules(intent, normalizedPrompt);

    for (const match of collectRuleMatches(normalizedPrompt, SYNONYM_RULES)) {
        applyMoodRule(intent, match);
    }

    applyActivityRules(intent, normalizedPrompt);
    applyContextRules(intent, normalizedPrompt);
    applySimplePreferenceRules(intent, normalizedPrompt);
    applyNegativeRules(intent, normalizedPrompt);
    detectSeedAndArtists(intent, prompt, normalizedPrompt);
    inferPlaylistGoal(intent, normalizedPrompt);

    if (hasPhrase(normalizedPrompt, 'nhe hon')) {
        intent.softPreferences.energy = intent.softPreferences.energy === 'high' ? 'medium' : 'low';
        intent.softPreferences.mood_intensity = 'light';
        addMatchedKeywords(intent, 'modifier:lighter', ['nhe hon']);
    }

    if (hasPhrase(normalizedPrompt, 'cham')) {
        intent.softPreferences.tempo = 'slow';
        addMatchedKeywords(intent, 'tempo:slow', ['cham']);
    }

    if (hasPhrase(normalizedPrompt, 'nhanh')) {
        intent.softPreferences.tempo = 'fast';
        addMatchedKeywords(intent, 'tempo:fast', ['nhanh']);
    }

    if (hasPhrase(normalizedPrompt, 'that chay') || hasPhrase(normalizedPrompt, 'that boc')) {
        intent.softPreferences.energy = 'high';
        intent.softPreferences.tempo = 'fast';
        intent.softPreferences.mood_intensity = 'deep';
    }

    return intent;
}

function mergeArray(target, values, validatorGroup) {
    for (const value of values || []) {
        if (!validatorGroup || isValidLabel(validatorGroup, value)) {
            addUnique(target, value);
        }
    }
}

function mapLegacyLlmIntent(llmIntent) {
    const mapped = createDefaultAiPlaylistIntent('', llmIntent?.targetCount);
    const moodMap = {
        sad: 'sad',
        heartbreak: 'heartbreak',
        chill: 'chill',
        calm: 'calm',
        romantic: 'romantic',
        happy: 'happy',
        energetic: 'energetic',
        party: 'party',
        focus: 'focus',
        nostalgic: 'nostalgic',
        motivation: 'motivational',
        motivational: 'motivational'
    };
    const genreMap = {
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

    mergeArray(
        mapped.softPreferences.mood,
        (llmIntent?.mood || []).map((value) => moodMap[normalizeText(value)]).filter(Boolean),
        'mood'
    );
    mergeArray(
        mapped.hardConstraints.genre_family,
        (llmIntent?.genres || []).map((value) => genreMap[normalizeText(value)]).filter(Boolean),
        'genre_family'
    );

    const language = (llmIntent?.languages || [])[0];
    if (isValidLabel('language', language)) {
        mapped.hardConstraints.language = language;
    }
    if (mapped.hardConstraints.language === 'vi') mapped.hardConstraints.market = 'VPOP';
    if (mapped.hardConstraints.language === 'ko') mapped.hardConstraints.market = 'KPOP';
    if (mapped.hardConstraints.language === 'en') mapped.hardConstraints.market = 'USUK';

    if (isValidLabel('tempo', llmIntent?.tempo)) mapped.softPreferences.tempo = llmIntent.tempo;
    if (isValidLabel('energy', llmIntent?.energy)) mapped.softPreferences.energy = llmIntent.energy;

    const activity = (llmIntent?.activity || [])[0];
    if (isValidLabel('activity', activity)) mapped.softPreferences.activity = activity;

    mergeArray(mapped.softPreferences.context, llmIntent?.context || [], 'context');
    mergeArray(mapped.negativeConstraints.keywords, llmIntent?.explicitExclusions || []);

    if (Array.isArray(llmIntent?.artists) && llmIntent.artists.length > 0) {
        const firstArtist = String(llmIntent.artists[0]).trim();
        if (llmIntent.artistConstraintMode === 'hard') {
            mergeArray(mapped.hardConstraints.include_artists, llmIntent.artists);
        } else {
            mapped.seed.seed_type = 'artist_seed';
            mapped.seed.artist = firstArtist;
        }
    }

    return sanitizeAiPlaylistIntent(mapped);
}

function mergeLlmIntent(ruleIntent, llmIntent) {
    if (!llmIntent) return ruleIntent;

    const next = JSON.parse(JSON.stringify(ruleIntent));
    const mapped = mapLegacyLlmIntent(llmIntent);

    if (next.hardConstraints.market === 'ANY' && mapped.hardConstraints.market !== 'ANY') {
        next.hardConstraints.market = mapped.hardConstraints.market;
        next.hardConstraints.language = mapped.hardConstraints.language;
    }

    mergeArray(next.hardConstraints.genre_family, mapped.hardConstraints.genre_family, 'genre_family');
    mergeArray(next.hardConstraints.include_artists, mapped.hardConstraints.include_artists);
    mergeArray(next.softPreferences.mood, mapped.softPreferences.mood, 'mood');
    mergeArray(next.softPreferences.context, mapped.softPreferences.context, 'context');
    mergeArray(next.negativeConstraints.keywords, mapped.negativeConstraints.keywords);

    if (next.seed.seed_type === 'none' && mapped.seed.seed_type !== 'none') {
        next.seed = mapped.seed;
    }
    if (next.softPreferences.activity === null && mapped.softPreferences.activity) {
        next.softPreferences.activity = mapped.softPreferences.activity;
    }
    if (next.softPreferences.energy === 'medium' && mapped.softPreferences.energy !== 'medium') {
        next.softPreferences.energy = mapped.softPreferences.energy;
    }
    if (next.softPreferences.tempo === 'medium' && mapped.softPreferences.tempo !== 'medium') {
        next.softPreferences.tempo = mapped.softPreferences.tempo;
    }

    addUnique(next.raw.matchedKeywords, 'llm:intent_merge');
    return next;
}

function buildExplanation(intent) {
    const parts = [];
    const { hardConstraints, softPreferences, seed, negativeConstraints } = intent;

    if (hardConstraints.market !== 'ANY') {
        parts.push(`hiểu thị trường ${hardConstraints.market}`);
    }
    if (hardConstraints.genre_family.length > 0) {
        parts.push(`thể loại ${hardConstraints.genre_family.join(', ')}`);
    }
    if (softPreferences.mood.length > 0) {
        parts.push(`mood ${softPreferences.mood.join(', ')}`);
    }
    if (softPreferences.activity) {
        parts.push(`ngữ cảnh hoạt động ${softPreferences.activity}`);
    }
    if (softPreferences.context.length > 0) {
        parts.push(`bối cảnh ${softPreferences.context.join(', ')}`);
    }
    if (seed.seed_type !== 'none') {
        parts.push(`dùng ${seed.artist || seed.song || seed.genre} làm seed mềm`);
    }
    if (
        negativeConstraints.mood.length > 0 ||
        negativeConstraints.genre_family.length > 0 ||
        negativeConstraints.energy.length > 0 ||
        negativeConstraints.keywords.length > 0
    ) {
        parts.push('ghi nhận ràng buộc phủ định để tránh chọn quá lệch ý');
    }

    if (parts.length === 0) {
        return 'Hệ thống chưa thấy tín hiệu mạnh, nên giữ intent cân bằng để bước ranking có thêm không gian chọn bài.';
    }

    return `Hệ thống ${parts.join('; ')}. Các mood/ngữ cảnh được xem là ưu tiên mềm để tránh playlist bị rỗng.`;
}

function calculateConfidence(intent, usedLlm) {
    let score = 0.35;
    const matchedCount = intent.raw.matchedKeywords.length;

    score += Math.min(matchedCount * 0.035, 0.3);
    if (intent.hardConstraints.market !== 'ANY') score += 0.1;
    if (intent.hardConstraints.genre_family.length > 0) score += 0.06;
    if (intent.softPreferences.mood.length > 0) score += 0.1;
    if (intent.softPreferences.activity) score += 0.06;
    if (intent.seed.seed_type !== 'none') score += 0.08;
    if (intent.negativeConstraints.mood.length > 0 || intent.negativeConstraints.energy.length > 0) score += 0.06;
    if (usedLlm) score += 0.04;

    return Number(Math.min(score, 0.95).toFixed(2));
}

async function normalizeAiPlaylistIntent(input = {}, options = {}) {
    const prompt = String(input.prompt || '').trim();
    const targetCount = clampTargetCount(input.targetCount);
    const useLLM = Boolean(input.useLLM ?? options.useLLM);

    if (!prompt) {
        return sanitizeAiPlaylistIntent(createDefaultAiPlaylistIntent('', targetCount));
    }

    let intent = applyRuleBasedIntent(prompt, targetCount);
    let usedLlm = false;

    if (useLLM) {
        try {
            const geminiService = require('./geminiPlaylist.service');
            const llmIntent = await geminiService.extractIntent(prompt);
            intent = mergeLlmIntent(intent, llmIntent);
            usedLlm = true;
        } catch (error) {
            addUnique(intent.raw.matchedKeywords, `llm_error:${error.message}`);
        }
    }

    intent.playlist.target_count = targetCount;
    intent.confidence = calculateConfidence(intent, usedLlm);
    intent.explanation = buildExplanation(intent);

    return sanitizeAiPlaylistIntent(intent);
}

module.exports = {
    normalizeAiPlaylistIntent,
    normalizeText,
    applyRuleBasedIntent
};
