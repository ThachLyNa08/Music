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
const { detectTempoIntent } = require('../utils/tempoFeature.util');

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

    if (
        intent.seed.seed_type === 'genre_seed' &&
        intent.seed.genre &&
        intent.negativeConstraints.genre_family.includes(intent.seed.genre)
    ) {
        intent.seed = {
            seed_type: 'none',
            artist: null,
            song: null,
            genre: null
        };
    }
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

function looksLikeSongSeedText(value) {
    const cleaned = cleanSeedText(value);
    const normalized = normalizeText(cleaned);
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 10) return false;

    const genericStarts = [
        'nhac',
        'playlist',
        'danh sach',
        'vibe',
        'kieu',
        'giong',
        'tuong tu'
    ];
    if (genericStarts.some((phrase) => normalized.startsWith(phrase))) return false;

    return true;
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

    const songSeedMatch = textForHardMatch.match(
        /\b(?:giong|kieu|cung vibe|tuong tu|vibe cua|vibe)\s+(?:bai|ca khuc|track)\s+(.+?)(?:\s+(?:nhung|ma|de|voi)\b|$)/
    );
    if (songSeedMatch) {
        const seedText = restoreOriginalSlice(prompt, songSeedMatch[1]);
        if (seedText && looksLikeSongSeedText(seedText)) {
            intent.seed.seed_type = 'song_seed';
            intent.seed.song = seedText;
            intent.seed.artist = null;
            addMatchedKeywords(intent, 'seed:song', [seedText]);
            textForHardMatch = textForHardMatch.replace(songSeedMatch[0], ' ');
        }
    }

    const seedMatch = textForHardMatch.match(
        /\b(?:giong|kieu|vibe cua|vibe|cung vibe|tuong tu)\s+(.+?)(?:\s+(?:nhung|ma|de|voi)\b|$)/
    );
    if (intent.seed.seed_type === 'none' && seedMatch) {
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

    if (/\b(?:khong co|dung co|loai tru|tru|avoid|exclude|no)\b/.test(normalizedPrompt)) {
        for (const artist of knownArtists) {
            if (!hasPhrase(normalizedPrompt, artist)) continue;
            const restored = restoreOriginalSlice(prompt, artist) || artist;
            addUnique(intent.hardConstraints.exclude_artists, restored);
            addUnique(intent.negativeConstraints.artists, restored);
            addMatchedKeywords(intent, 'exclude_artist', [restored]);
        }
    }

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

function applyCalmFocusEnergyGuard(intent, normalizedPrompt) {
    const hasCalmSignal =
        ['nhe', 'nhe nhang', 'chill', 'thu gian', 'diu', 'binh yen', 'lofi', 'cham']
            .some((phrase) => hasPhrase(normalizedPrompt, phrase)) ||
        (intent.softPreferences.mood || []).some((mood) => ['chill', 'calm'].includes(mood));
    const hasFocusSignal =
        ['hoc bai', 'hoc tap', 'on thi', 'tap trung', 'lam viec', 'coding', 'doc sach', 'study', 'focus', 'work', 'reading']
            .some((phrase) => hasPhrase(normalizedPrompt, phrase)) ||
        ['study', 'work', 'coding'].includes(intent.softPreferences.activity) ||
        (intent.softPreferences.mood || []).includes('focus');

    if (!hasCalmSignal || !hasFocusSignal) return;

    intent.softPreferences.energy = 'low';
    if (intent.softPreferences.tempo === 'fast') {
        intent.softPreferences.tempo = 'medium';
    }
    intent.softPreferences.activity = intent.softPreferences.activity || 'study';
    addUnique(intent.softPreferences.mood, 'chill');
    addUnique(intent.softPreferences.mood, 'calm');
    addUnique(intent.softPreferences.mood, 'focus');
    addUnique(intent.negativeConstraints.energy, 'high');
    addMatchedKeywords(intent, 'guard:calm_focus_low_or_medium', ['low_or_medium_energy', 'avoid_high_energy']);
}

function applyCoffeeActivityGuard(intent, normalizedPrompt) {
    const hasCoffeeSignal = ['ca phe', 'cafe', 'coffee', 'uong ca phe', 'di cafe']
        .some((phrase) => hasPhrase(normalizedPrompt, phrase));
    if (!hasCoffeeSignal) return;

    intent.softPreferences.activity = 'coffee';
    intent.softPreferences.energy = intent.softPreferences.energy === 'high' ? 'medium' : 'low';
    if (intent.softPreferences.tempo === 'fast') {
        intent.softPreferences.tempo = 'medium';
    }
    addUnique(intent.softPreferences.mood, 'chill');
    addUnique(intent.softPreferences.mood, 'calm');
    addUnique(intent.negativeConstraints.energy, 'high');
    addMatchedKeywords(intent, 'guard:coffee_activity', ['coffee']);
}

const COUNT_PATTERNS = [
    /(\d+)\s*(?:bai|songs?|tracks?)/i
];

const BEAT_INSTRUMENTAL_PATTERNS = [
    /\bbeat\s+(?:karaoke|khong loi)\b/i,
    /\b(?:nhac nen khong loi|instrumental|karaoke|tach vocal|lay beat|ban beat cua bai)\b/i
];

const BEAT_SIMILAR_SONG_PATTERNS = [
    /\b(?:beat|nhip|bass|groove)\s+(?:giong|tuong tu|kieu)\s+(?:bai\s+)?(.+?)(?:\s+(?:nhung|ma|de|voi)\b|$)/i,
    /\bnhac\s+co\s+beat\s+kieu\s+(?:bai\s+)?(.+?)(?:\s+(?:nhung|ma|de|voi)\b|$)/i
];

const BEAT_RHYTHM_PATTERNS = [
    /\bbeat\s+(?:manh|cang|day|nhanh|cham|chill|nhe|don dap|bat tai)\b/i,
    /\b(?:bass|nhip|trong)\s+(?:manh|day|ro|nhanh|cham|don dap|bat tai)\b/i,
    /\b(?:groove|dance beat|nhip bat tai)\b/i
];

function parseCountIntent(prompt, fallback = 20) {
    const text = normalizeText(prompt);

    for (const pattern of COUNT_PATTERNS) {
        const match = text.match(pattern);
        if (match?.[1]) return clampTargetCount(match[1]);
    }

    if (/(?:playlist ngan|it bai|vai bai)/i.test(text)) return 10;
    if (/(?:playlist vua|vua du nghe)/i.test(text)) return 20;
    if (/(?:playlist dai|nhieu bai)/i.test(text)) return 30;

    return clampTargetCount(fallback);
}

function normalizeRhythmValue(value) {
    return isValidLabel('rhythm', value) ? value : null;
}

function setRhythm(intent, rhythm = {}) {
    intent.softPreferences.rhythm = {
        beatStrength: normalizeRhythmValue(rhythm.beatStrength),
        bassIntensity: normalizeRhythmValue(rhythm.bassIntensity),
        rhythmDensity: normalizeRhythmValue(rhythm.rhythmDensity),
        groove: normalizeRhythmValue(rhythm.groove)
    };
}

function extractBeatSimilarSeed(prompt, normalizedMatchValue) {
    const restored = restoreOriginalSlice(prompt, normalizedMatchValue);
    return restored && looksLikeSongSeedText(restored) ? restored : cleanSeedText(normalizedMatchValue);
}

function applyBeatRules(intent, prompt, normalizedPrompt) {
    if (BEAT_INSTRUMENTAL_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) {
        intent.mode = 'karaoke_instrumental';
        intent.softPreferences.vocal_preference = 'instrumental_like';
        const titleMatch = normalizedPrompt.match(/\b(?:cua|bai)\s+(.+?)$/i);
        if (titleMatch?.[1]) {
            const songTitle = extractBeatSimilarSeed(prompt, titleMatch[1]);
            if (songTitle) {
                intent.seed.seed_type = 'song_seed';
                intent.seed.song = songTitle;
            }
        }
        addMatchedKeywords(intent, 'mode:karaoke_instrumental', ['beat_instrumental']);
        return;
    }

    for (const pattern of BEAT_SIMILAR_SONG_PATTERNS) {
        const match = normalizedPrompt.match(pattern);
        if (!match?.[1]) continue;
        const songTitle = extractBeatSimilarSeed(prompt, match[1]);
        if (!songTitle) continue;
        intent.mode = 'similar_to_song';
        intent.seed.seed_type = 'song_seed';
        intent.seed.song = songTitle;
        setRhythm(intent, {
            beatStrength: 'similar',
            bassIntensity: 'similar',
            rhythmDensity: 'similar',
            groove: 'similar'
        });
        addMatchedKeywords(intent, 'mode:beat_similar_song', [songTitle]);
        return;
    }

    if (!BEAT_RHYTHM_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) return;

    intent.mode = 'beat_rhythm';
    addMatchedKeywords(intent, 'mode:beat_rhythm', ['beat_rhythm']);

    if (hasPhrase(normalizedPrompt, 'beat cham') || hasPhrase(normalizedPrompt, 'nhip cham') || hasPhrase(normalizedPrompt, 'beat chill') || hasPhrase(normalizedPrompt, 'beat nhe')) {
        intent.softPreferences.tempo = 'slow';
        intent.softPreferences.energy = 'low';
        addUnique(intent.negativeConstraints.energy, 'high');
        addUnique(intent.softPreferences.mood, 'chill');
        addUnique(intent.softPreferences.mood, 'calm');
        setRhythm(intent, {
            beatStrength: 'low_or_medium',
            bassIntensity: 'low_or_medium',
            rhythmDensity: 'low_or_medium',
            groove: 'medium'
        });
        return;
    }

    if (hasPhrase(normalizedPrompt, 'beat bat tai') || hasPhrase(normalizedPrompt, 'nhip bat tai') || hasPhrase(normalizedPrompt, 'groove') || hasPhrase(normalizedPrompt, 'groove ro')) {
        intent.softPreferences.energy = intent.softPreferences.energy === 'low' ? 'medium' : intent.softPreferences.energy;
        setRhythm(intent, {
            beatStrength: 'medium_or_high',
            bassIntensity: 'medium_or_high',
            rhythmDensity: 'medium_or_high',
            groove: 'high'
        });
        return;
    }

    intent.softPreferences.energy = 'high';
    intent.softPreferences.tempo = 'fast';
    if (!intent.softPreferences.activity && (hasPhrase(normalizedPrompt, 'gym') || hasPhrase(normalizedPrompt, 'tap gym') || hasPhrase(normalizedPrompt, 'chay bo'))) {
        intent.softPreferences.activity = 'gym';
    }
    addUnique(intent.softPreferences.mood, 'energetic');
    setRhythm(intent, {
        beatStrength: 'high',
        bassIntensity: 'high',
        rhythmDensity: 'high',
        groove: 'medium_or_high'
    });
}

function applyRuleBasedIntent(prompt, targetCount) {
    const intent = createDefaultAiPlaylistIntent(prompt, parseCountIntent(prompt, targetCount));
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
    applyBeatRules(intent, prompt, normalizedPrompt);
    detectSeedAndArtists(intent, prompt, normalizedPrompt);
    inferPlaylistGoal(intent, normalizedPrompt);

    const tempoIntent = detectTempoIntent(prompt);
    if (tempoIntent) {
        intent.softPreferences.tempo = tempoIntent.tempoBucket;
        intent.softPreferences.energy = tempoIntent.energyTarget;
        if (tempoIntent.activity === 'workout') {
            intent.softPreferences.activity = 'gym';
        } else if (tempoIntent.activity === 'focus') {
            intent.softPreferences.activity = intent.softPreferences.activity || 'study';
        } else if (tempoIntent.activity === 'relax') {
            intent.softPreferences.activity = intent.softPreferences.activity || 'relax';
        } else {
            intent.softPreferences.activity = tempoIntent.activity;
        }
        intent.tempoIntent = tempoIntent;
        addMatchedKeywords(intent, `tempo_intent:${tempoIntent.tempoBucket}`, [tempoIntent.label]);
        if (tempoIntent.activity === 'focus') addUnique(intent.softPreferences.mood, 'focus');
        if (tempoIntent.activity === 'relax') addUnique(intent.softPreferences.mood, 'chill');
        if (tempoIntent.activity === 'party') addUnique(intent.softPreferences.mood, 'party');
        if (tempoIntent.activity === 'workout') addUnique(intent.softPreferences.mood, 'energetic');
    }

    if (intent.negativeConstraints.energy.includes('high') && intent.softPreferences.energy === 'high') {
        const hasCalmSignal = intent.softPreferences.mood.some((mood) => ['chill', 'calm'].includes(mood))
            || hasPhrase(normalizedPrompt, 'nhe nhang')
            || hasPhrase(normalizedPrompt, 'thu gian');
        intent.softPreferences.energy = hasCalmSignal ? 'low' : 'medium';
        if (intent.softPreferences.tempo === 'fast') {
            intent.softPreferences.tempo = hasCalmSignal ? 'slow' : 'medium';
        }
        if (intent.softPreferences.activity === 'party' && intent.negativeConstraints.mood.includes('party')) {
            intent.softPreferences.activity = hasCalmSignal ? 'relax' : null;
        }
        intent.softPreferences.mood = removeValues(intent.softPreferences.mood, intent.negativeConstraints.mood);
        addMatchedKeywords(intent, 'guard:avoid_high_energy', ['avoid_high_energy']);
    }

    applyCalmFocusEnergyGuard(intent, normalizedPrompt);
    applyCoffeeActivityGuard(intent, normalizedPrompt);

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

    if (isValidLabel('mode', llmIntent?.mode)) {
        mapped.mode = llmIntent.mode;
    }

    const rhythm = llmIntent?.softPreferences?.rhythm || llmIntent?.rhythm || {};
    setRhythm(mapped, {
        beatStrength: rhythm.beatStrength,
        bassIntensity: rhythm.bassIntensity,
        rhythmDensity: rhythm.rhythmDensity,
        groove: rhythm.groove
    });

    const seedTitle = llmIntent?.seed?.song_title || llmIntent?.seed?.song || llmIntent?.songTitle || llmIntent?.song_title;
    if (seedTitle && ['similar_to_song', 'karaoke_instrumental'].includes(mapped.mode)) {
        mapped.seed.seed_type = 'song_seed';
        mapped.seed.song = String(seedTitle).trim();
        mapped.seed.artist = null;
    }

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
    if (next.mode === 'unknown' && mapped.mode !== 'unknown') {
        next.mode = mapped.mode;
    }
    if (Object.values(mapped.softPreferences.rhythm || {}).some(Boolean)) {
        next.softPreferences.rhythm = {
            beatStrength: mapped.softPreferences.rhythm.beatStrength || next.softPreferences.rhythm?.beatStrength || null,
            bassIntensity: mapped.softPreferences.rhythm.bassIntensity || next.softPreferences.rhythm?.bassIntensity || null,
            rhythmDensity: mapped.softPreferences.rhythm.rhythmDensity || next.softPreferences.rhythm?.rhythmDensity || null,
            groove: mapped.softPreferences.rhythm.groove || next.softPreferences.rhythm?.groove || null
        };
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

function getIntentDebugSummary(intent = {}) {
    return {
        mode: intent.mode,
        market: intent.hardConstraints?.market,
        genres: intent.hardConstraints?.genre_family,
        includeArtists: intent.hardConstraints?.include_artists,
        excludeArtists: intent.hardConstraints?.exclude_artists,
        mood: intent.softPreferences?.mood,
        context: intent.softPreferences?.context,
        activity: intent.softPreferences?.activity,
        tempo: intent.softPreferences?.tempo,
        energy: intent.softPreferences?.energy,
        targetCount: intent.playlist?.target_count,
        matchedKeywords: intent.raw?.matchedKeywords
    };
}

async function normalizeAiPlaylistIntent(input = {}, options = {}) {
    const prompt = String(input.prompt || '').trim();
    const targetCount = clampTargetCount(input.targetCount);
    const promptTargetCount = parseCountIntent(prompt, targetCount);
    const useLLM = Boolean(input.useLLM ?? options.useLLM);

    if (!prompt) {
        return sanitizeAiPlaylistIntent(createDefaultAiPlaylistIntent('', targetCount));
    }

    let intent = applyRuleBasedIntent(prompt, promptTargetCount);
    let usedLlm = false;

    if (useLLM) {
        const { parseStructuredIntent } = require('./llmIntent.service');
        const intentResult = await parseStructuredIntent(prompt, {
            mode: 'ai_playlist',
            targetCount: promptTargetCount,
            taxonomyIntent: intent
        });

        intent = intentResult.intent;
        usedLlm = intentResult.provider !== 'taxonomy';
        intent.raw = {
            ...(intent.raw || {}),
            provider: intentResult.provider
        };
        applyCoffeeActivityGuard(intent, normalizeText(prompt));

        console.log('[AI Playlist Intent]', {
            provider: intentResult.provider,
            fallbackUsed: intentResult.fallbackUsed,
            fallbackReason: intentResult.fallbackReason,
            parsedIntent: intentResult.parsedIntent,
            intent: process.env.NODE_ENV === 'production' ? getIntentDebugSummary(intent) : intent
        });

        if (intentResult.fallbackReason) {
            addUnique(intent.raw.matchedKeywords, `llm_fallback:${intentResult.fallbackReason}`);
        }
    }

    intent.playlist.target_count = promptTargetCount;
    intent.confidence = calculateConfidence(intent, usedLlm);
    intent.explanation = buildExplanation(intent);

    return sanitizeAiPlaylistIntent(intent);
}

module.exports = {
    normalizeAiPlaylistIntent,
    normalizeText,
    applyRuleBasedIntent
};
