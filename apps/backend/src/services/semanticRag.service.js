const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { normalizeText } = require('./aiPlaylistIntent.service');

const PROFILE_SOURCE = 'datasets/processed/semantic/profiles/song_semantic_profiles.csv';
const PROFILE_PATH = path.resolve(__dirname, '../../../..', PROFILE_SOURCE);
const DEFAULT_LIMIT = 300;

let cachedIndex = null;
let loadPromise = null;

function splitTags(value) {
    return String(value || '')
        .split(/[;,|]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function numberOrFallback(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function tokenize(value) {
    const normalized = normalizeText(value);
    if (!normalized) return [];
    return normalized
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}

function normalizeField(value) {
    return normalizeText(Array.isArray(value) ? value.join(' ') : value);
}

function buildDoc(row) {
    const doc = {
        song_id: Number(row.song_id),
        title: row.title || '',
        artist: row.artist || '',
        semantic_text: row.semantic_text || '',
        summary_vi: row.summary_vi || '',
        main_theme: row.main_theme || '',
        sub_themes: splitTags(row.sub_themes),
        mood_tags: splitTags(row.mood_tags),
        situation_tags: splitTags(row.situation_tags),
        lyrical_keywords: splitTags(row.lyrical_keywords),
        emotion_intensity: numberOrFallback(row.emotion_intensity, 3),
        meaning_confidence: numberOrFallback(row.meaning_confidence, 0.6),
        evidence_level: row.evidence_level || '',
        review_status: row.review_status || ''
    };

    if (!Number.isInteger(doc.song_id) || doc.song_id <= 0) return null;

    const normalized = {
        title: normalizeField(doc.title),
        artist: normalizeField(doc.artist),
        semantic_text: normalizeField(doc.semantic_text),
        summary_vi: normalizeField(doc.summary_vi),
        main_theme: normalizeField(doc.main_theme),
        sub_themes: normalizeField(doc.sub_themes),
        mood_tags: normalizeField(doc.mood_tags),
        situation_tags: normalizeField(doc.situation_tags),
        lyrical_keywords: normalizeField(doc.lyrical_keywords),
        all: ''
    };
    normalized.all = [
        normalized.title,
        normalized.artist,
        normalized.semantic_text,
        normalized.summary_vi,
        normalized.main_theme,
        normalized.sub_themes,
        normalized.mood_tags,
        normalized.situation_tags,
        normalized.lyrical_keywords
    ].filter(Boolean).join(' ');

    doc.normalized = normalized;
    doc.tokenSet = new Set(tokenize(normalized.all));
    return doc;
}

async function loadIndex() {
    if (cachedIndex) return cachedIndex;
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const documents = [];

        fs.createReadStream(PROFILE_PATH)
            .pipe(csv())
            .on('data', (row) => {
                const doc = buildDoc(row);
                if (doc) documents.push(doc);
            })
            .on('end', () => {
                cachedIndex = {
                    source: PROFILE_SOURCE,
                    loadedAt: new Date().toISOString(),
                    documents,
                    bySongId: new Map(documents.map((doc) => [doc.song_id, doc]))
                };
                resolve(cachedIndex);
            })
            .on('error', (error) => {
                loadPromise = null;
                reject(error);
            });
    });

    return loadPromise;
}

function addTerms(terms, values) {
    for (const value of values || []) {
        const normalized = normalizeText(value);
        if (normalized) terms.add(normalized);
    }
}

function getExpandedTerms(intent = {}) {
    const hard = intent.hardConstraints || {};
    const soft = intent.softPreferences || {};
    const terms = new Set();

    addTerms(terms, soft.mood || []);
    addTerms(terms, soft.context || []);
    addTerms(terms, hard.genre_family || []);
    addTerms(terms, hard.include_artists || []);
    addTerms(terms, hard.market && hard.market !== 'ANY' ? [hard.market] : []);
    addTerms(terms, soft.activity ? [soft.activity] : []);
    addTerms(terms, soft.energy ? [soft.energy, `${soft.energy} energy`] : []);

    const expansions = {
        gym: ['workout', 'tap gym', 'the duc', 'energetic', 'hype', 'dance', 'party', 'high energy'],
        study: ['hoc bai', 'focus', 'tap trung', 'calm', 'chill'],
        coding: ['focus', 'tap trung', 'deep work', 'chill'],
        work: ['focus', 'deadline', 'tap trung'],
        healing: ['chua lanh', 'healing', 'heartbreak', 'calm', 'emotional'],
        relax: ['thu gian', 'relax', 'calm', 'chill'],
        sleep: ['night', 'late night', 'calm', 'soft'],
        night: ['buoi toi', 'dem', 'late night'],
        breakup: ['chia tay', 'that tinh', 'heartbreak', 'healing'],
        energetic: ['nang luong', 'soi dong', 'hype', 'party', 'gym'],
        chill: ['nhe nhang', 'calm', 'relax', 'study'],
        calm: ['nhe nhang', 'soft', 'peaceful', 'healing'],
        sad: ['buon', 'emotional', 'heartbreak', 'lonely'],
        rnb: ['r&b', 'r n b', 'rnb']
    };

    for (const term of [...terms]) {
        addTerms(terms, expansions[term] || []);
    }

    return [...terms];
}

function phraseScore(normalizedField, phrases, weight) {
    let score = 0;
    for (const phrase of phrases) {
        if (!phrase) continue;
        if (normalizedField.includes(phrase)) score += weight;
    }
    return score;
}

function tokenScore(doc, queryTokens) {
    let score = 0;
    for (const token of queryTokens) {
        if (doc.tokenSet.has(token)) score += 2;
    }
    return score;
}

function scoreDocument(doc, query) {
    const phrases = query.phrases;
    let rawScore = 0;

    rawScore += phraseScore(doc.normalized.mood_tags, phrases, 30);
    rawScore += phraseScore(doc.normalized.situation_tags, phrases, 25);
    rawScore += phraseScore(`${doc.normalized.main_theme} ${doc.normalized.sub_themes}`, phrases, 25);
    rawScore += phraseScore(doc.normalized.lyrical_keywords, phrases, 15);
    rawScore += phraseScore(doc.normalized.semantic_text, phrases, 20);
    rawScore += phraseScore(doc.normalized.summary_vi, phrases, 12);
    rawScore += phraseScore(`${doc.normalized.title} ${doc.normalized.artist}`, phrases, 20);
    rawScore += tokenScore(doc, query.tokens);

    const confidence = Math.min(Math.max(Number(doc.meaning_confidence) || 0, 0), 1);
    rawScore += confidence * 10;

    if (normalizeText(doc.evidence_level) === 'lyrics based') rawScore += 5;
    if (normalizeText(doc.review_status) === 'needs review') rawScore *= 0.8;

    return rawScore;
}

function buildRetrievalQuery(prompt, intent) {
    const rawPrompt = String(prompt || intent?.raw?.prompt || '').trim();
    const terms = getExpandedTerms(intent);
    const phraseSource = [rawPrompt, ...terms].join(' ');
    const phrases = [
        normalizeText(rawPrompt),
        ...terms.map((term) => normalizeText(term))
    ].filter(Boolean);

    return {
        rawPrompt,
        expandedText: phraseSource,
        phrases: [...new Set(phrases)],
        tokens: [...new Set(tokenize(phraseSource))]
    };
}

async function retrieveSemanticCandidates({ prompt, intent, limit = DEFAULT_LIMIT } = {}) {
    const index = await loadIndex();
    const query = buildRetrievalQuery(prompt, intent);
    const maxResults = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 1000));

    const scored = index.documents
        .map((doc) => ({ doc, rawScore: scoreDocument(doc, query) }))
        .filter((item) => item.rawScore > 0)
        .sort((a, b) => b.rawScore - a.rawScore || a.doc.song_id - b.doc.song_id)
        .slice(0, maxResults);

    const maxScore = scored[0]?.rawScore || 1;
    const candidates = scored.map((item) => ({
        song_id: item.doc.song_id,
        rag_score: Number(Math.min(item.rawScore / maxScore, 1).toFixed(4)),
        rag_raw_score: Number(item.rawScore.toFixed(4)),
        title: item.doc.title,
        artist: item.doc.artist,
        main_theme: item.doc.main_theme,
        mood_tags: item.doc.mood_tags,
        situation_tags: item.doc.situation_tags
    }));

    return {
        strategy: 'semantic_rag_v1',
        source: PROFILE_SOURCE,
        loadedProfiles: index.documents.length,
        query,
        candidates
    };
}

function getCachedProfileSource() {
    return PROFILE_SOURCE;
}

module.exports = {
    PROFILE_SOURCE,
    retrieveSemanticCandidates,
    getCachedProfileSource,
    loadIndex
};
