const { pool: defaultPool } = require('../config/database');
const { publicSongCondition, effectiveReleaseStatusExpression } = require('../utils/public.utils');
const { tableExists, getExistingColumns } = require('../utils/dbIntrospection');
const { normalizeText } = require('./aiPlaylistIntent.service');

const MARKET_LANGUAGE = {
    VPOP: 'vi',
    KPOP: 'ko',
    USUK: 'en'
};

const GENRE_PATTERNS = {
    pop: ['pop', 'nhac tre', 'nhạc trẻ', 'v-pop', 'vpop', 'k-pop', 'kpop', 'usuk'],
    ballad: ['ballad', 'tinh ca', 'tình ca'],
    rap_hiphop: ['rap', 'hiphop', 'hip hop', 'hip-hop'],
    rnb: ['r&b', 'rnb', 'r n b'],
    edm: ['edm', 'electronic', 'remix', 'vinahouse'],
    rock_indie: ['rock', 'indie'],
    bolero_folk: ['bolero', 'tru tinh', 'trữ tình', 'dan ca', 'dân ca', 'que huong', 'quê hương'],
    acoustic: ['acoustic', 'moc', 'mộc'],
    lofi: ['lofi', 'lo-fi'],
    dance: ['dance', 'nhay', 'nhảy']
};

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function sqlNull(alias) {
    return `NULL AS ${alias}`;
}

function selectColumn(columns, tableAlias, columnName, outputAlias = columnName) {
    return columns[columnName] ? `${tableAlias}.${columnName} AS ${outputAlias}` : sqlNull(outputAlias);
}

function buildInClause(columnSql, values, params) {
    const safe = values.filter((value) => value !== null && value !== undefined);
    if (!safe.length) return null;
    params.push(...safe);
    return `${columnSql} IN (${safe.map(() => '?').join(',')})`;
}

async function getSchemaInfo(db) {
    const [
        songColumns,
        genreColumns,
        audioFeatureColumns,
        hasAudioFeatures
    ] = await Promise.all([
        getExistingColumns('songs', [
            'market',
            'language',
            'tempo',
            'duration_sec',
            'cover_url',
            'audio_url',
            'play_count',
            'release_status'
        ]),
        getExistingColumns('genres', ['name', 'slug']),
        getExistingColumns('song_audio_features', [
            'bpm',
            'tempo',
            'tempo_level',
            'energy_score',
            'energy',
            'danceability',
            'acoustic_score',
            'brightness',
            'mood',
            'vibe'
        ]),
        tableExists('song_audio_features')
    ]);

    return { db, songColumns, genreColumns, audioFeatureColumns, hasAudioFeatures };
}

async function resolveArtistIds(names = [], db = defaultPool) {
    const safeNames = [...new Set((names || []).map((name) => String(name || '').trim()).filter(Boolean))];
    if (!safeNames.length) return [];

    const [rows] = await db.query('SELECT id, name FROM artists');
    const normalizedNeedles = safeNames.map((name) => normalizeText(name)).filter(Boolean);
    const ids = [];

    for (const row of rows) {
        const normalizedName = normalizeText(row.name);
        if (!normalizedName) continue;
        if (normalizedNeedles.some((needle) => normalizedName.includes(needle) || needle.includes(normalizedName))) {
            ids.push(Number(row.id));
        }
    }

    return [...new Set(ids)];
}

function buildMarketCondition(intent, schema, params) {
    const market = intent?.hardConstraints?.market || 'ANY';
    const language = intent?.hardConstraints?.language || MARKET_LANGUAGE[market] || 'any';
    const conditions = [];

    if (market !== 'ANY' && schema.songColumns.market) {
        params.push(market);
        conditions.push('UPPER(TRIM(s.market)) = ?');
    }

    const effectiveLanguage = language !== 'any' ? language : MARKET_LANGUAGE[market];
    if (effectiveLanguage && schema.songColumns.language) {
        params.push(effectiveLanguage);
        conditions.push('LOWER(TRIM(s.language)) = ?');
    }

    if (!conditions.length) return null;
    return `(${conditions.join(' OR ')})`;
}

function buildGenreCondition(intent, schema, params) {
    const genres = intent?.hardConstraints?.genre_family || [];
    const clauses = [];

    for (const genre of genres) {
        const patterns = GENRE_PATTERNS[genre] || [genre];
        const perGenre = [];
        for (const pattern of patterns) {
            if (schema.genreColumns.slug) {
                params.push(`%${pattern}%`);
                perGenre.push('LOWER(g.slug) LIKE LOWER(?)');
            }
            if (schema.genreColumns.name) {
                params.push(`%${pattern}%`);
                perGenre.push('LOWER(g.name) LIKE LOWER(?)');
            }
        }
        if (perGenre.length) clauses.push(`(${perGenre.join(' OR ')})`);
    }

    if (!clauses.length) return null;
    return `(${clauses.join(' OR ')})`;
}

function buildArtistNameFallback(names, params, negate = false) {
    const safe = [...new Set((names || []).map((name) => String(name || '').trim()).filter(Boolean))];
    if (!safe.length) return null;
    const clauses = safe.map((name) => {
        params.push(`%${name.toLowerCase()}%`);
        return 'LOWER(a.name) LIKE ?';
    });
    return negate ? `NOT (${clauses.join(' OR ')})` : `(${clauses.join(' OR ')})`;
}

function buildSelectSql(schema) {
    const selectParts = [
        's.id',
        's.title',
        's.artist_id',
        's.album_id',
        's.genre_id',
        selectColumn(schema.songColumns, 's', 'market'),
        selectColumn(schema.songColumns, 's', 'language'),
        selectColumn(schema.songColumns, 's', 'duration_sec', 'duration'),
        selectColumn(schema.songColumns, 's', 'audio_url'),
        'COALESCE(s.cover_url, al.cover_url) AS cover_url',
        selectColumn(schema.songColumns, 's', 'play_count'),
        selectColumn(schema.songColumns, 's', 'release_status'),
        `${effectiveReleaseStatusExpression('s')} AS effective_release_status`,
        'a.name AS artist_name',
        'al.title AS album_title',
        'g.name AS genre_name',
        selectColumn(schema.genreColumns, 'g', 'slug', 'genre_slug')
    ];

    if (schema.hasAudioFeatures) {
        selectParts.push(
            selectColumn(schema.audioFeatureColumns, 'saf', 'bpm'),
            schema.audioFeatureColumns.bpm
                ? 'saf.bpm AS audio_bpm'
                : (schema.songColumns.tempo ? 's.tempo AS audio_bpm' : sqlNull('audio_bpm')),
            selectColumn(schema.audioFeatureColumns, 'saf', 'tempo_level'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'energy_score'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'energy'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'danceability'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'acoustic_score'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'brightness'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'mood'),
            selectColumn(schema.audioFeatureColumns, 'saf', 'vibe')
        );
    } else {
        selectParts.push(
            schema.songColumns.tempo ? 's.tempo AS bpm' : sqlNull('bpm'),
            schema.songColumns.tempo ? 's.tempo AS audio_bpm' : sqlNull('audio_bpm'),
            sqlNull('tempo_level'),
            sqlNull('energy_score'),
            sqlNull('energy'),
            sqlNull('danceability'),
            sqlNull('acoustic_score'),
            sqlNull('brightness'),
            sqlNull('mood'),
            sqlNull('vibe')
        );
    }

    return `
        SELECT ${selectParts.join(',\n               ')}
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        LEFT JOIN albums al ON al.id = s.album_id
        LEFT JOIN genres g ON g.id = s.genre_id
        ${schema.hasAudioFeatures ? 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id' : ''}
    `;
}

async function runCandidateQuery({ intent, db, limit, schema, includeGenre, includeArtists, keepMarket, orderMode }) {
    const params = [];
    const where = [
        publicSongCondition('s'),
        "s.audio_url IS NOT NULL",
        "TRIM(s.audio_url) <> ''"
    ];
    const appliedFilters = ['availability'];
    const relaxedFilters = [];

    const excludeArtistIds = await resolveArtistIds([
        ...(intent?.hardConstraints?.exclude_artists || []),
        ...(intent?.negativeConstraints?.artists || [])
    ], db);
    const includeArtistNames = intent?.hardConstraints?.include_artists || [];
    const includeArtistIds = await resolveArtistIds(includeArtistNames, db);

    if (excludeArtistIds.length) {
        where.push(buildInClause('s.artist_id', excludeArtistIds, params).replace(' IN ', ' NOT IN '));
        appliedFilters.push('exclude_artists');
    }
    const excludeNameFallback = buildArtistNameFallback(intent?.hardConstraints?.exclude_artists || [], params, true);
    if (excludeNameFallback) {
        where.push(excludeNameFallback);
        appliedFilters.push('exclude_artist_names');
    }

    if (keepMarket) {
        const marketCondition = buildMarketCondition(intent, schema, params);
        if (marketCondition) {
            where.push(marketCondition);
            appliedFilters.push('market_language');
        }
    } else {
        relaxedFilters.push('market_language');
    }

    if (includeGenre) {
        const genreCondition = buildGenreCondition(intent, schema, params);
        if (genreCondition) {
            where.push(genreCondition);
            appliedFilters.push('genre_family');
        }
    } else if (intent?.hardConstraints?.genre_family?.length) {
        relaxedFilters.push('genre_family');
    }

    if (includeArtists && includeArtistNames.length) {
        const artistClauses = [];
        const inClause = buildInClause('s.artist_id', includeArtistIds, params);
        if (inClause) artistClauses.push(inClause);
        const nameFallback = buildArtistNameFallback(includeArtistNames, params, false);
        if (nameFallback) artistClauses.push(nameFallback);
        if (artistClauses.length) {
            where.push(`(${artistClauses.join(' OR ')})`);
            appliedFilters.push('include_artists');
        }
    } else if (includeArtistNames.length) {
        relaxedFilters.push('include_artists');
    }

    const orderSql = orderMode === 'popular'
        ? 'ORDER BY COALESCE(s.play_count, 0) DESC, s.id DESC'
        : 'ORDER BY COALESCE(s.play_count, 0) DESC, s.id DESC';

    const sql = `
        ${buildSelectSql(schema)}
        WHERE ${where.join('\n          AND ')}
        ${orderSql}
        LIMIT ?
    `;
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return {
        rows: rows.map(shapeCandidate),
        appliedFilters,
        relaxedFilters
    };
}

async function runSemanticRagCandidateQuery({ intent, db, limit, schema, ragCandidates = [], includeGenre, includeArtists, keepMarket }) {
    const ids = [...new Set((ragCandidates || [])
        .map((item) => Number(item.song_id))
        .filter((id) => Number.isInteger(id) && id > 0))];

    if (!ids.length) {
        return {
            rows: [],
            appliedFilters: ['availability', 'semantic_rag_ids'],
            relaxedFilters: [],
            fallbackUsed: false
        };
    }

    const ragScoreById = new Map();
    const ragRankById = new Map();
    ragCandidates.forEach((item, index) => {
        const id = Number(item.song_id);
        if (!Number.isInteger(id) || id <= 0) return;
        ragScoreById.set(id, Number(item.rag_score || 0));
        if (!ragRankById.has(id)) ragRankById.set(id, index);
    });

    const params = [];
    const where = [
        publicSongCondition('s'),
        "s.audio_url IS NOT NULL",
        "TRIM(s.audio_url) <> ''"
    ];
    const appliedFilters = ['availability', 'semantic_rag_ids'];
    const relaxedFilters = [];

    const inClause = buildInClause('s.id', ids, params);
    if (inClause) where.push(inClause);

    const excludeArtistIds = await resolveArtistIds([
        ...(intent?.hardConstraints?.exclude_artists || []),
        ...(intent?.negativeConstraints?.artists || [])
    ], db);
    const includeArtistNames = intent?.hardConstraints?.include_artists || [];
    const includeArtistIds = await resolveArtistIds(includeArtistNames, db);

    if (excludeArtistIds.length) {
        where.push(buildInClause('s.artist_id', excludeArtistIds, params).replace(' IN ', ' NOT IN '));
        appliedFilters.push('exclude_artists');
    }
    const excludeNameFallback = buildArtistNameFallback(intent?.hardConstraints?.exclude_artists || [], params, true);
    if (excludeNameFallback) {
        where.push(excludeNameFallback);
        appliedFilters.push('exclude_artist_names');
    }

    if (keepMarket) {
        const marketCondition = buildMarketCondition(intent, schema, params);
        if (marketCondition) {
            where.push(marketCondition);
            appliedFilters.push('market_language');
        }
    } else {
        relaxedFilters.push('market_language');
    }

    if (includeGenre) {
        const genreCondition = buildGenreCondition(intent, schema, params);
        if (genreCondition) {
            where.push(genreCondition);
            appliedFilters.push('genre_family');
        }
    } else if (intent?.hardConstraints?.genre_family?.length) {
        relaxedFilters.push('genre_family');
    }

    if (includeArtists && includeArtistNames.length) {
        const artistClauses = [];
        const artistInClause = buildInClause('s.artist_id', includeArtistIds, params);
        if (artistInClause) artistClauses.push(artistInClause);
        const nameFallback = buildArtistNameFallback(includeArtistNames, params, false);
        if (nameFallback) artistClauses.push(nameFallback);
        if (artistClauses.length) {
            where.push(`(${artistClauses.join(' OR ')})`);
            appliedFilters.push('include_artists');
        }
    } else if (includeArtistNames.length) {
        relaxedFilters.push('include_artists');
    }

    const sql = `
        ${buildSelectSql(schema)}
        WHERE ${where.join('\n          AND ')}
        LIMIT ?
    `;
    params.push(Math.max(limit, ids.length));

    const [rows] = await db.query(sql, params);
    const shaped = rows.map((row) => {
        const candidate = shapeCandidate(row);
        candidate.rag_score = Number(ragScoreById.get(candidate.id) || 0);
        candidate.rag_rank = ragRankById.get(candidate.id) ?? 999999;
        return candidate;
    });

    shaped.sort((a, b) => (b.rag_score || 0) - (a.rag_score || 0) || (a.rag_rank || 0) - (b.rag_rank || 0));

    return {
        rows: shaped.slice(0, limit),
        appliedFilters,
        relaxedFilters,
        fallbackUsed: shaped.length < ids.length
    };
}

function inferGenreFamily(row) {
    const raw = normalizeText(`${row.genre_slug || ''} ${row.genre_name || ''}`);
    for (const [family, patterns] of Object.entries(GENRE_PATTERNS)) {
        if (patterns.some((pattern) => raw.includes(normalizeText(pattern)))) return family;
    }
    return null;
}

function shapeCandidate(row) {
    const bpm = numberOrNull(row.audio_bpm ?? row.bpm);
    return {
        id: Number(row.id),
        title: row.title,
        duration: numberOrNull(row.duration),
        audio_url: row.audio_url || null,
        stream_url: row.audio_url || null,
        cover_url: row.cover_url || null,
        artist_id: row.artist_id !== null && row.artist_id !== undefined ? Number(row.artist_id) : null,
        artist_name: row.artist_name || null,
        album_id: row.album_id !== null && row.album_id !== undefined ? Number(row.album_id) : null,
        album_title: row.album_title || null,
        genre_id: row.genre_id !== null && row.genre_id !== undefined ? Number(row.genre_id) : null,
        genre_name: row.genre_name || null,
        genre_slug: row.genre_slug || null,
        genre_family: inferGenreFamily(row),
        market: row.market || null,
        language: row.language || null,
        play_count: Number(row.play_count || 0),
        listen_count: Number(row.play_count || 0),
        like_count: Number(row.like_count || 0),
        bpm,
        tempo_level: row.tempo_level || null,
        energy_score: numberOrNull(row.energy_score),
        energy: row.energy || null,
        danceability: numberOrNull(row.danceability),
        acoustic_score: numberOrNull(row.acoustic_score),
        brightness: numberOrNull(row.brightness),
        mood: row.mood || null,
        vibe: row.vibe || null,
        release_status: row.release_status || null,
        effective_release_status: row.effective_release_status || null
    };
}

function mergeUniqueCandidates(groups, limit) {
    const seen = new Set();
    const merged = [];
    for (const group of groups) {
        for (const candidate of group) {
            if (seen.has(candidate.id)) continue;
            seen.add(candidate.id);
            merged.push(candidate);
            if (merged.length >= limit) return merged;
        }
    }
    return merged;
}

async function getAiPlaylistCandidates({
    intent,
    userId = null,
    limit = 120,
    targetCount = 20,
    pool = defaultPool,
    ragCandidates = []
}) {
    const db = pool;
    const candidateLimit = Math.max(Number(limit) || 120, targetCount * 5, 100);
    const minimumUseful = Math.max(targetCount * 2, 10);
    const schema = await getSchemaInfo(db);
    const attempts = [];
    const safeRagCandidates = Array.isArray(ragCandidates) ? ragCandidates : [];

    if (safeRagCandidates.length) {
        const ragStrict = await runSemanticRagCandidateQuery({
            intent,
            db,
            limit: candidateLimit,
            schema,
            ragCandidates: safeRagCandidates,
            includeGenre: true,
            includeArtists: true,
            keepMarket: true
        });
        attempts.push({ name: 'semantic_rag_strict', ...ragStrict });

        if (ragStrict.rows.length >= minimumUseful) {
            return {
                candidates: ragStrict.rows,
                candidateMeta: {
                    strategy: 'semantic_rag_strict',
                    appliedFilters: ragStrict.appliedFilters,
                    relaxedFilters: [],
                    totalCandidates: ragStrict.rows.length,
                    ragCandidates: safeRagCandidates.length,
                    fallbackUsed: false
                }
            };
        }

        const ragRelaxedGenre = await runSemanticRagCandidateQuery({
            intent,
            db,
            limit: candidateLimit,
            schema,
            ragCandidates: safeRagCandidates,
            includeGenre: false,
            includeArtists: true,
            keepMarket: true
        });
        attempts.push({ name: 'semantic_rag_relaxed_genre', ...ragRelaxedGenre });
        const mergedRag = mergeUniqueCandidates([ragStrict.rows, ragRelaxedGenre.rows], candidateLimit);

        if (mergedRag.length >= minimumUseful) {
            return {
                candidates: mergedRag,
                candidateMeta: {
                    strategy: 'semantic_rag_relaxed',
                    appliedFilters: ragRelaxedGenre.appliedFilters,
                    relaxedFilters: ['genre_family'],
                    totalCandidates: mergedRag.length,
                    ragCandidates: safeRagCandidates.length,
                    fallbackUsed: false
                }
            };
        }
    }

    const tier1 = await runCandidateQuery({
        intent,
        db,
        limit: candidateLimit,
        schema,
        includeGenre: true,
        includeArtists: true,
        keepMarket: true,
        orderMode: 'strict'
    });
    attempts.push({ name: 'strict', ...tier1 });
    if (tier1.rows.length >= minimumUseful) {
        return {
            candidates: tier1.rows,
            candidateMeta: {
                strategy: 'strict',
                appliedFilters: tier1.appliedFilters,
                relaxedFilters: [],
                totalCandidates: tier1.rows.length,
                ragCandidates: safeRagCandidates.length,
                fallbackUsed: safeRagCandidates.length > 0
            }
        };
    }

    const tier2 = await runCandidateQuery({
        intent,
        db,
        limit: candidateLimit,
        schema,
        includeGenre: false,
        includeArtists: true,
        keepMarket: true,
        orderMode: 'relaxed'
    });
    attempts.push({ name: 'relaxed_genre', ...tier2 });
    const mergedTier2 = mergeUniqueCandidates([tier1.rows, tier2.rows], candidateLimit);
    if (mergedTier2.length >= minimumUseful) {
        return {
            candidates: mergedTier2,
            candidateMeta: {
                strategy: 'relaxed',
                appliedFilters: tier2.appliedFilters,
                relaxedFilters: ['genre_family'],
                totalCandidates: mergedTier2.length,
                ragCandidates: safeRagCandidates.length,
                fallbackUsed: safeRagCandidates.length > 0
            }
        };
    }

    const hasHardArtist = (intent?.hardConstraints?.include_artists || []).length > 0;

    const tier3 = await runCandidateQuery({
        intent,
        db,
        limit: candidateLimit,
        schema,
        includeGenre: false,
        includeArtists: hasHardArtist,
        keepMarket: true,
        orderMode: 'relaxed'
    });
    attempts.push({ name: 'relaxed_artist', ...tier3 });
    const mergedTier3 = mergeUniqueCandidates([mergedTier2, tier3.rows], candidateLimit);
    if (mergedTier3.length >= Math.min(targetCount, minimumUseful)) {
        return {
            candidates: mergedTier3,
            candidateMeta: {
                strategy: 'relaxed',
                appliedFilters: tier3.appliedFilters,
                relaxedFilters: ['genre_family', hasHardArtist ? null : 'include_artists'].filter(Boolean),
                totalCandidates: mergedTier3.length,
                ragCandidates: safeRagCandidates.length,
                fallbackUsed: safeRagCandidates.length > 0
            }
        };
    }

    const tier4 = await runCandidateQuery({
        intent,
        db,
        limit: candidateLimit,
        schema,
        includeGenre: false,
        includeArtists: hasHardArtist,
        keepMarket: (intent?.hardConstraints?.market || 'ANY') !== 'ANY',
        orderMode: 'popular'
    });
    attempts.push({ name: 'popular_fallback', ...tier4 });
    const mergedTier4 = mergeUniqueCandidates([mergedTier3, tier4.rows], candidateLimit);

    return {
        candidates: mergedTier4,
        candidateMeta: {
            strategy: mergedTier4.length ? 'fallback' : 'empty',
            appliedFilters: tier4.appliedFilters,
            relaxedFilters: ['genre_family', hasHardArtist ? null : 'include_artists', 'soft_audio_mood'].filter(Boolean),
            totalCandidates: mergedTier4.length,
            ragCandidates: safeRagCandidates.length,
            fallbackUsed: safeRagCandidates.length > 0,
            attempts: attempts.map((attempt) => ({
                name: attempt.name,
                total: attempt.rows.length,
                appliedFilters: attempt.appliedFilters,
                relaxedFilters: attempt.relaxedFilters
            })),
            userId
        }
    };
}

module.exports = {
    getAiPlaylistCandidates,
    inferGenreFamily,
    GENRE_PATTERNS,
    MARKET_LANGUAGE
};
