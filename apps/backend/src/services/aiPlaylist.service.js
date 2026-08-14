const { pool } = require('../config/database');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const { clampTargetCount } = require('../utils/aiPlaylistIntentSchema');
const { publicSongCondition } = require('../utils/public.utils');
const { tableExists, columnExists, clearIntrospectionCache } = require('../utils/dbIntrospection');
const { normalizeAiPlaylistIntent } = require('./aiPlaylistIntent.service');
const { getAiPlaylistCandidates } = require('./aiPlaylistCandidate.service');
const { rankAiPlaylistCandidates } = require('./aiPlaylistRanking.service');
const semanticRagService = require('./semanticRag.service');

function shapePreviewSong(song, req) {
    return {
        id: song.id,
        title: song.title,
        artist: song.artist_name || null,
        artist_id: song.artist_id || null,
        album: song.album_title || null,
        album_id: song.album_id || null,
        genre: song.genre_name || null,
        genre_id: song.genre_id || null,
        market: song.market || null,
        language: song.language || null,
        cover_url: normalizeCoverUrl(song.cover_url, req),
        coverUrl: normalizeCoverUrl(song.cover_url, req),
        duration: song.duration,
        audio_url: normalizeCoverUrl(song.audio_url, req),
        audioUrl: normalizeCoverUrl(song.audio_url, req),
        stream_url: normalizeCoverUrl(song.stream_url || song.audio_url, req),
        release_status: song.release_status || null,
        effective_release_status: song.effective_release_status || null,
        aiScore: song.aiScore,
        scoreBreakdown: song.scoreBreakdown,
        reason: song.reason,
        tempoBucket: song.tempo_level || song.tempo_bucket || song.tempoBucket || null,
        normalizedBpm: song.normalized_bpm || song.normalizedBpm || song.bpm || null,
        energyScore: song.energy_score ?? null,
        danceabilityScore: song.danceability_score ?? song.danceability ?? null,
        tempoReason: song.tempoReason || null,
        matchQuality: song.matchQuality || (song.fallbackUsed ? 'partial' : 'strong'),
        fallbackUsed: Boolean(song.fallbackUsed),
        fallbackReason: song.fallbackReason || null
    };
}

function normalizeSongIds(songIds) {
    if (!Array.isArray(songIds)) return [];
    const normalized = songIds.map((id) => {
        if (typeof id === 'number') {
            if (Number.isInteger(id) && id > 0) return id;
            return null;
        }
        const text = String(id ?? '').trim();
        if (!/^[1-9]\d*$/.test(text)) return null;
        return Number(text);
    });
    if (normalized.some((id) => !id)) {
        const err = new Error('Danh sach ID bai hat khong hop le');
        err.statusCode = 400;
        throw err;
    }
    return [...new Set(normalized)];
}

function safeJsonParse(value, fallback = null) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function stringifyJson(value) {
    if (value === undefined || value === null) return null;
    return JSON.stringify(value);
}

function getProviderLabel({ useLLM, intent } = {}) {
    return intent?.raw?.provider || intent?.provider || (useLLM ? 'llm' : 'taxonomy');
}

function buildPreviewSnapshot({ prompt, targetCount, preview }) {
    const songs = (preview?.songs || []).map((song, index) => ({
        ...song,
        id: Number(song.id || song.song_id),
        song_id: Number(song.song_id || song.id),
        title: song.title,
        artist: song.artist || song.artist_name || null,
        artist_name: song.artist_name || song.artist || null,
        cover_url: song.cover_url || song.coverUrl || null,
        coverUrl: song.coverUrl || song.cover_url || null,
        audio_url: song.audio_url || song.audioUrl || song.stream_url || null,
        audioUrl: song.audioUrl || song.audio_url || song.stream_url || null,
        reason: song.reason || null,
        order_index: Number(song.order_index || index + 1)
    }));

    return {
        title: preview?.playlistTitle || preview?.meta?.playlistTitle || buildPlaylistTitle(preview?.intent, prompt),
        description: preview?.description || '',
        prompt,
        requestedCount: clampTargetCount(targetCount || preview?.meta?.targetCount || 20),
        actualCount: songs.length,
        strictMode: !preview?.meta?.relaxedFilters?.length,
        canExpand: Boolean(preview?.meta?.shortage || preview?.meta?.canExpand),
        tags: [
            ...(preview?.intent?.hardConstraints?.genre_family || []),
            ...(preview?.intent?.softPreferences?.mood || []),
            preview?.intent?.softPreferences?.activity
        ].filter(Boolean),
        songs,
        warnings: preview?.warnings || [],
        meta: preview?.meta || {},
        intent: preview?.intent || {}
    };
}

let aiPlaylistHistoryTableReady = false;

async function ensureAiPlaylistHistoryTable() {
    if (aiPlaylistHistoryTableReady) return true;
    if (await tableExists('ai_playlist_generation_history')) {
        aiPlaylistHistoryTableReady = true;
        return true;
    }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_playlist_generation_history (
              id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              user_id INT UNSIGNED NOT NULL,
              prompt TEXT NOT NULL,
              target_count INT NOT NULL DEFAULT 20,
              actual_count INT NOT NULL DEFAULT 0,
              status ENUM('preview','saved','failed') NOT NULL DEFAULT 'preview',
              playlist_id INT UNSIGNED NULL,
              provider VARCHAR(50) NULL,
              intent_json LONGTEXT NULL,
              preview_snapshot_json LONGTEXT NULL,
              error_message TEXT NULL,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              INDEX idx_ai_playlist_history_user_created (user_id, created_at),
              INDEX idx_ai_playlist_history_playlist (playlist_id),
              CONSTRAINT fk_ai_playlist_history_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
              CONSTRAINT fk_ai_playlist_history_playlist
                FOREIGN KEY (playlist_id) REFERENCES playlists(id)
                ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        clearIntrospectionCache();
        aiPlaylistHistoryTableReady = true;
        return true;
    } catch (error) {
        console.warn('Unable to ensure AI playlist history table:', error.message);
        return false;
    }
}

async function createGenerationHistory({
    userId,
    prompt,
    targetCount,
    actualCount = 0,
    status = 'preview',
    playlistId = null,
    provider = null,
    intent = null,
    previewSnapshot = null,
    errorMessage = null
}) {
    if (!userId) return null;
    if (!(await ensureAiPlaylistHistoryTable())) {
        console.warn('AI playlist history was not recorded because the history table is unavailable');
        return null;
    }

    const [result] = await pool.query(
        `INSERT INTO ai_playlist_generation_history
         (user_id, prompt, target_count, actual_count, status, playlist_id, provider, intent_json, preview_snapshot_json, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId,
            String(prompt || '').trim(),
            clampTargetCount(targetCount),
            Number(actualCount || 0),
            status,
            playlistId,
            provider,
            stringifyJson(intent),
            stringifyJson(previewSnapshot),
            errorMessage ? String(errorMessage).slice(0, 500) : null
        ]
    );

    return result.insertId;
}

async function markHistorySaved({ conn, historyId, userId, playlistId }) {
    if (!historyId || !(await ensureAiPlaylistHistoryTable())) return false;
    const executor = conn || pool;
    const [result] = await executor.query(
        `UPDATE ai_playlist_generation_history
         SET status = 'saved', playlist_id = ?
         WHERE id = ? AND user_id = ? AND status = 'preview'`,
        [playlistId, historyId, userId]
    );
    return result.affectedRows > 0;
}

function shapeHistorySummary(row, req) {
    return {
        id: row.id,
        prompt: row.prompt,
        target_count: row.target_count,
        actual_count: row.actual_count,
        status: row.status,
        playlist_id: row.playlist_id,
        cover_url: normalizeCoverUrl(row.cover_url, req),
        created_at: row.created_at,
        error_message: row.status === 'failed' ? row.error_message : undefined
    };
}

function shapeHistoryDetail(row, req) {
    const preview = safeJsonParse(row.preview_snapshot_json, null);
    if (preview?.songs) {
        preview.songs = preview.songs.map((song) => ({
            ...song,
            id: Number(song.id || song.song_id),
            song_id: Number(song.song_id || song.id),
            cover_url: normalizeCoverUrl(song.cover_url || song.coverUrl, req),
            coverUrl: normalizeCoverUrl(song.coverUrl || song.cover_url, req),
            audio_url: normalizeCoverUrl(song.audio_url || song.audioUrl || song.stream_url, req),
            audioUrl: normalizeCoverUrl(song.audioUrl || song.audio_url || song.stream_url, req),
            stream_url: normalizeCoverUrl(song.stream_url || song.audio_url || song.audioUrl, req)
        }));
    }

    return {
        id: row.id,
        prompt: row.prompt,
        target_count: row.target_count,
        actual_count: row.actual_count,
        status: row.status,
        playlist_id: row.playlist_id,
        provider: row.provider,
        created_at: row.created_at,
        error_message: row.error_message,
        intent: safeJsonParse(row.intent_json, null),
        preview
    };
}

function buildCalmShortageLabel(intent) {
    const soft = intent?.softPreferences || {};
    const moods = new Set((soft.mood || []).map((value) => String(value).toLowerCase()));
    const contexts = new Set((soft.context || []).map((value) => String(value).toLowerCase()));
    const activity = Array.isArray(soft.activity) ? soft.activity[0] : soft.activity;

    if (['study', 'coding', 'work'].includes(activity) || moods.has('focus')) {
        return 'chill/study';
    }
    if (moods.has('sad') || moods.has('heartbreak') || contexts.has('night') || contexts.has('late_night') || activity === 'relax') {
        return 'buồn nhẹ/thư giãn';
    }
    return 'nhẹ nhàng';
}

function buildShortageMeta({ songs, candidates, count, candidateMeta, intent, rankingMeta }) {
    const shortage = songs.length < count;
    let shortageReason = null;

    if (shortage) {
        const hardArtists = intent?.hardConstraints?.include_artists || [];
        if (rankingMeta?.strictCalmEnergyGuard) {
            const blocked = Number(rankingMeta?.debugCounts?.blockedHighEnergyCount || 0);
            const label = buildCalmShortageLabel(intent);
            shortageReason = `MusicFlow chỉ tìm được ${songs.length}/${count} bài phù hợp với ${label}. Hệ thống không tự thêm bài High energy để đủ số lượng${blocked ? ` (${blocked} bài High energy đã bị loại).` : '.'}`;
        } else if (hardArtists.length > 0) {
            shortageReason = `Không đủ bài hợp lệ của ${hardArtists.join(', ')} trong hệ thống (tìm được ${songs.length}/${count} bài).`;
        } else {
            shortageReason = `MusicFlow chỉ tìm được ${songs.length}/${count} bài phù hợp sau khi đã nới bộ lọc.`;
        }
    }

    return {
        shortage,
        shortageReason,
        candidateCount: candidates.length,
        returned: songs.length,
        relaxedFilters: candidateMeta.relaxedFilters || []
    };
}

function buildPlaylistTitle(intent, sourcePrompt) {
    const parts = [];
    if (intent?.hardConstraints?.market && intent.hardConstraints.market !== 'ANY') parts.push(intent.hardConstraints.market);
    if (intent?.hardConstraints?.genre_family?.[0]) parts.push(intent.hardConstraints.genre_family[0].replace('_', ' '));
    if (intent?.softPreferences?.mood?.[0]) parts.push(intent.softPreferences.mood[0]);
    if (intent?.softPreferences?.activity) parts.push(intent.softPreferences.activity);
    if (parts.length) return parts.join(' ').replace(/\b\w/g, (char) => char.toUpperCase()).slice(0, 120);

    return String(sourcePrompt || 'AI Playlist').trim().replace(/^tao playlist\s+/i, '').slice(0, 120) || 'AI Playlist';
}

function buildRetrievalMeta({ ragResult, candidateMeta, songs }) {
    const ragSongs = songs.filter((song) => Number.isFinite(Number(song.scoreBreakdown?.semanticRag)));
    const averageRagScore = ragSongs.length
        ? ragSongs.reduce((sum, song) => sum + Number(song.scoreBreakdown.semanticRag || 0), 0) / ragSongs.length
        : 0;

    return {
        strategy: ragResult?.strategy || 'semantic_rag_v1',
        semanticProfileSource: ragResult?.source || semanticRagService.getCachedProfileSource(),
        retrievedCandidates: ragResult?.candidates?.length || 0,
        usedCandidates: songs.length,
        averageRagScore: Number(averageRagScore.toFixed(4)),
        loadedProfiles: ragResult?.loadedProfiles || 0,
        fallbackUsed: Boolean(candidateMeta?.fallbackUsed)
    };
}

function countMarketCandidates(candidates, intent) {
    const market = intent?.hardConstraints?.market;
    if (!market || market === 'ANY') return candidates.length;
    return candidates.filter((song) => String(song.market || '').toUpperCase() === market).length;
}

async function previewAiPlaylist({
    prompt,
    targetCount,
    userId = null,
    useLLM = false,
    allowExpandedResults = false,
    req = null,
    previousSongIds = [],
    avoidPreviousSongs = false,
    intentOverride = null
}) {
    let count = clampTargetCount(targetCount);
    const intent = intentOverride || await normalizeAiPlaylistIntent({
        prompt,
        targetCount: count,
        userId,
        useLLM
    });
    count = clampTargetCount(intent?.playlist?.target_count || count);
    if (intent?.playlist) {
        intent.playlist.target_count = count;
    }

    const previousSet = new Set(normalizeSongIds(previousSongIds));
    const candidateLimit = Math.max(count * 8, 120);
    const ragResult = await semanticRagService.retrieveSemanticCandidates({
        prompt,
        intent,
        limit: 300
    });
    const { candidates, candidateMeta } = await getAiPlaylistCandidates({
        intent,
        userId,
        limit: candidateLimit,
        targetCount: count,
        pool,
        ragCandidates: ragResult.candidates
    });

    let rankingCandidates = candidates;
    let avoidedPreviousSongs = false;
    if (avoidPreviousSongs && previousSet.size > 0) {
        const filtered = candidates.filter((song) => !previousSet.has(Number(song.id)));
        if (filtered.length >= Math.min(count, 5)) {
            rankingCandidates = filtered;
            avoidedPreviousSongs = true;
        }
    }

    const ranked = await rankAiPlaylistCandidates({
        candidates: rankingCandidates,
        intent,
        userId,
        targetCount: count,
        allowExpandedResults
    });

    const songs = ranked.songs.map((song) => shapePreviewSong(song, req));
    const shortageMeta = buildShortageMeta({
        songs,
        candidates: rankingCandidates,
        count,
        candidateMeta,
        intent,
        rankingMeta: ranked.rankingMeta
    });
    const playlistTitle = buildPlaylistTitle(intent, prompt);
    const description = 'Playlist được tạo từ hồ sơ ngữ nghĩa bài hát và lọc lại bằng dữ liệu thật trong MusicFlow.';
    const retrieval = buildRetrievalMeta({ ragResult, candidateMeta, songs });
    const rankingDebug = ranked.rankingMeta.debugCounts || {};
    const rankingFallbackUsed = Number(ranked.rankingMeta.fallbackSongCount || 0) > 0;
    if (rankingFallbackUsed) {
        retrieval.fallbackUsed = true;
    }
    const warnings = shortageMeta.shortage
        ? [{
            type: 'SHORTAGE',
            message: shortageMeta.shortageReason
        }]
        : [];

    if (retrieval.fallbackUsed && intent?.hardConstraints?.market && intent.hardConstraints.market !== 'ANY') {
        warnings.push({
            type: 'RAG_FALLBACK',
            message: `Semantic RAG không đủ ứng viên ${intent.hardConstraints.market}; MusicFlow đã dùng thêm nguồn ứng viên DB nhưng vẫn giữ lọc market khi có thể.`
        });
    }

    console.log('[AI Playlist RAG Preview]', {
        prompt: String(prompt || '').slice(0, 300),
        intent: {
            market: intent?.hardConstraints?.market,
            genres: intent?.hardConstraints?.genre_family,
            artists: intent?.hardConstraints?.include_artists,
            mood: intent?.softPreferences?.mood,
            context: intent?.softPreferences?.context,
            activity: intent?.softPreferences?.activity,
            energy: intent?.softPreferences?.energy,
            targetCount: count
        },
        retrievalStrategy: retrieval.strategy,
        retrievedCount: retrieval.retrievedCandidates,
        finalCount: songs.length,
        fallbackUsed: retrieval.fallbackUsed
    });

    console.log('[AI Playlist Pipeline Debug]', {
        prompt: String(prompt || '').slice(0, 300),
        intent,
        retrievedCount: ragResult?.candidates?.length || 0,
        afterSongIdExtract: [...new Set((ragResult?.candidates || [])
            .map((item) => Number(item.song_id || item.id || item.songId))
            .filter((id) => Number.isInteger(id) && id > 0))].length,
        afterDbValidate: candidates.length,
        afterMarketFilter: countMarketCandidates(candidates, intent),
        afterIntentFilter: rankingDebug.afterIntentFilter ?? null,
        afterEnergyFilter: rankingDebug.afterEnergyFilter ?? null,
        afterDiversity: rankingDebug.afterDiversity ?? null,
        finalCount: songs.length,
        fallbackUsed: retrieval.fallbackUsed,
        rankingFallbackUsed,
        rankingDebug
    });

    return {
        success: true,
        playlistTitle,
        description,
        intent,
        normalizedIntent: intent,
        songs,
        warnings,
        retrieval,
        strategy: ranked.rankingMeta.strategy,
        tempoAware: Boolean(ranked.rankingMeta.tempoAware),
        detectedTempoIntent: ranked.rankingMeta.detectedTempoIntent,
        source: 'ai_playlist_hybrid',
        meta: {
            strategy: ranked.rankingMeta.strategy,
            candidateStrategy: candidateMeta.strategy,
            playlistTitle,
            description,
            retrieval,
            targetCount: count,
            returned: songs.length,
            bprAvailable: ranked.rankingMeta.bprAvailable,
            userInModel: ranked.rankingMeta.userInModel,
            ...shortageMeta,
            avoidedPreviousSongs,
            candidateMeta,
            rankingMeta: ranked.rankingMeta
        },
        canSave: songs.length > 0
    };
}

function mergeIntentForRefine(previousIntent, refineIntent) {
    if (!previousIntent) return refineIntent;
    const merged = JSON.parse(JSON.stringify(previousIntent));

    const mergeArray = (target, values) => {
        if (!Array.isArray(target)) return [...new Set(values || [])];
        for (const value of values || []) {
            if (value && !target.includes(value)) target.push(value);
        }
        return target;
    };

    if (refineIntent.hardConstraints?.market && refineIntent.hardConstraints.market !== 'ANY') {
        merged.hardConstraints.market = refineIntent.hardConstraints.market;
        merged.hardConstraints.language = refineIntent.hardConstraints.language;
    }
    mergeArray(merged.hardConstraints.genre_family, refineIntent.hardConstraints?.genre_family);
    mergeArray(merged.hardConstraints.include_artists, refineIntent.hardConstraints?.include_artists);
    mergeArray(merged.hardConstraints.exclude_artists, refineIntent.hardConstraints?.exclude_artists);

    mergeArray(merged.softPreferences.mood, refineIntent.softPreferences?.mood);
    mergeArray(merged.softPreferences.context, refineIntent.softPreferences?.context);
    if (refineIntent.softPreferences?.activity) merged.softPreferences.activity = refineIntent.softPreferences.activity;
    if (refineIntent.softPreferences?.energy && refineIntent.raw?.matchedKeywords?.length) {
        merged.softPreferences.energy = refineIntent.softPreferences.energy;
    }
    if (refineIntent.softPreferences?.tempo && refineIntent.raw?.matchedKeywords?.length) {
        merged.softPreferences.tempo = refineIntent.softPreferences.tempo;
    }
    if (refineIntent.softPreferences?.mood_intensity) {
        merged.softPreferences.mood_intensity = refineIntent.softPreferences.mood_intensity;
    }
    if (refineIntent.softPreferences?.vocal_preference !== 'any') {
        merged.softPreferences.vocal_preference = refineIntent.softPreferences.vocal_preference;
    }
    if (refineIntent.softPreferences?.familiarity !== 'balanced') {
        merged.softPreferences.familiarity = refineIntent.softPreferences.familiarity;
    }
    if (refineIntent.softPreferences?.popularity !== 'balanced') {
        merged.softPreferences.popularity = refineIntent.softPreferences.popularity;
    }
    if (refineIntent.softPreferences?.diversity !== 'balanced') {
        merged.softPreferences.diversity = refineIntent.softPreferences.diversity;
    }

    if (refineIntent.seed?.seed_type && refineIntent.seed.seed_type !== 'none') {
        merged.seed = refineIntent.seed;
    }

    mergeArray(merged.negativeConstraints.mood, refineIntent.negativeConstraints?.mood);
    mergeArray(merged.negativeConstraints.genre_family, refineIntent.negativeConstraints?.genre_family);
    mergeArray(merged.negativeConstraints.energy, refineIntent.negativeConstraints?.energy);
    mergeArray(merged.negativeConstraints.artists, refineIntent.negativeConstraints?.artists);
    mergeArray(merged.negativeConstraints.keywords, refineIntent.negativeConstraints?.keywords);

    merged.playlist.target_count = refineIntent.playlist?.target_count || merged.playlist.target_count;
    merged.confidence = Math.max(Number(merged.confidence || 0), Number(refineIntent.confidence || 0));
    merged.explanation = `${merged.explanation || ''} Đã tinh chỉnh thêm: ${refineIntent.explanation || 'cập nhật theo yêu cầu mới.'}`.trim();
    merged.raw = {
        prompt: `${previousIntent.raw?.prompt || ''}\nTinh chỉnh: ${refineIntent.raw?.prompt || ''}`.trim(),
        matchedKeywords: mergeArray(merged.raw?.matchedKeywords || [], refineIntent.raw?.matchedKeywords || [])
    };

    return merged;
}

async function refineAiPlaylist({
    originalPrompt = '',
    refinePrompt = '',
    previousIntent = null,
    previousSongIds = [],
    targetCount,
    userId = null,
    useLLM = false,
    allowExpandedResults = false,
    req = null
}) {
    const cleanRefine = String(refinePrompt || '').trim();
    if (!cleanRefine) {
        const err = new Error('Refine prompt không được để trống');
        err.statusCode = 400;
        throw err;
    }

    const count = clampTargetCount(targetCount || previousIntent?.playlist?.target_count);
    const refineIntent = await normalizeAiPlaylistIntent({
        prompt: cleanRefine,
        targetCount: count,
        userId,
        useLLM
    });
    const baseIntent = previousIntent || await normalizeAiPlaylistIntent({
        prompt: originalPrompt,
        targetCount: count,
        userId,
        useLLM: false
    });
    const mergedIntent = mergeIntentForRefine(baseIntent, refineIntent);
    mergedIntent.playlist.target_count = count;

    const preview = await previewAiPlaylist({
        prompt: `${originalPrompt}\n${cleanRefine}`.trim(),
        targetCount: count,
        userId,
        useLLM: false,
        allowExpandedResults,
        req,
        previousSongIds,
        avoidPreviousSongs: true,
        intentOverride: mergedIntent
    });

    return {
        ...preview,
        meta: {
            ...preview.meta,
            refined: true,
            avoidedPreviousSongs: preview.meta.avoidedPreviousSongs
        }
    };
}

function buildAiPlaylistName({ name, intent, sourcePrompt }) {
    const clean = String(name || '').trim();
    if (clean) return clean.slice(0, 120);

    const parts = [];
    if (intent?.hardConstraints?.market && intent.hardConstraints.market !== 'ANY') parts.push(intent.hardConstraints.market);
    if (intent?.softPreferences?.mood?.length) parts.push(intent.softPreferences.mood[0]);
    if (intent?.softPreferences?.context?.length) parts.push(intent.softPreferences.context[0]);
    if (parts.length) return parts.join(' ').slice(0, 120);

    return String(sourcePrompt || 'AI Playlist').trim().slice(0, 80) || 'AI Playlist';
}

async function saveAiPlaylist({
    userId,
    name,
    description,
    sourcePrompt,
    intent,
    songIds,
    visibility = 'private',
    historyId = null,
    provider = null,
    req = null
}) {
    if (!userId) {
        const err = new Error('Bạn cần đăng nhập để lưu playlist');
        err.statusCode = 401;
        throw err;
    }

    const uniqueSongIds = normalizeSongIds(songIds);
    if (!uniqueSongIds.length) {
        const err = new Error('Danh sách bài hát trống');
        err.statusCode = 400;
        throw err;
    }

    const playlistName = buildAiPlaylistName({ name, intent, sourcePrompt });
    if (!playlistName) {
        const err = new Error('Tên playlist không được để trống');
        err.statusCode = 400;
        throw err;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const placeholders = uniqueSongIds.map(() => '?').join(',');
        const [availableSongs] = await conn.query(
            `SELECT id, COALESCE(NULLIF(cover_url, ''), NULLIF(audio_url, '')) AS cover_url
             FROM songs s
             WHERE id IN (${placeholders})
               AND ${publicSongCondition('s')}
               AND s.audio_url IS NOT NULL
               AND TRIM(s.audio_url) <> ''
             FOR UPDATE`,
            uniqueSongIds
        );
        const availableSet = new Set(availableSongs.map((song) => Number(song.id)));
        const missing = uniqueSongIds.filter((id) => !availableSet.has(id));
        if (missing.length) {
            const err = new Error(`Có ${missing.length} bài hát không còn khả dụng`);
            err.statusCode = 400;
            throw err;
        }

        const firstCover = availableSongs.find((song) => Number(song.id) === uniqueSongIds[0])?.cover_url
            || availableSongs.find((song) => song.cover_url)?.cover_url
            || null;
        const isPublic = visibility === 'public' ? 1 : 0;
        const sourceLine = sourcePrompt ? `AI prompt: ${String(sourcePrompt).slice(0, 500)}` : 'AI Playlist';
        const safeDescription = String(description || 'Playlist được tạo từ AI Playlist.').trim();
        const finalDescription = `${safeDescription}\n\n${sourceLine}`.slice(0, 2000);

        const playlistColumns = ['user_id', 'name', 'description', 'cover_url', 'type', 'is_public', 'is_system', 'created_at', 'updated_at'];
        const playlistValues = [userId, playlistName, finalDescription, firstCover, 'ai', isPublic, 0];
        const valueSql = ['?', '?', '?', '?', '?', '?', '?', 'NOW()', 'NOW()'];

        if (await columnExists('playlists', 'ai_prompt')) {
            playlistColumns.push('ai_prompt');
            playlistValues.push(sourcePrompt || '');
            valueSql.push('?');
        }
        if (await columnExists('playlists', 'ai_intent_json')) {
            playlistColumns.push('ai_intent_json');
            playlistValues.push(stringifyJson(intent || {}));
            valueSql.push('?');
        }
        if (await columnExists('playlists', 'ai_provider')) {
            playlistColumns.push('ai_provider');
            playlistValues.push(provider || getProviderLabel({ intent }));
            valueSql.push('?');
        }

        const [playlistResult] = await conn.query(
            `INSERT INTO playlists (${playlistColumns.join(', ')})
             VALUES (${valueSql.join(', ')})`,
            playlistValues
        );
        const playlistId = playlistResult.insertId;

        const playlistSongsData = uniqueSongIds.map((songId, index) => [playlistId, songId, index]);
        await conn.query(
            `INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ?`,
            [playlistSongsData]
        );

        if (await tableExists('ai_playlists')) {
            await conn.query(
                `INSERT INTO ai_playlists (user_id, prompt_text, extracted_params, playlist_id, status)
                 VALUES (?, ?, ?, ?, 'completed')`,
                [userId, sourcePrompt || '', JSON.stringify(intent || {}), playlistId]
            );
        }

        if (historyId) {
            await markHistorySaved({ conn, historyId, userId, playlistId });
        }

        await conn.commit();

        return {
            success: true,
            playlist: {
                id: playlistId,
                name: playlistName,
                type: 'ai',
                cover_url: normalizeCoverUrl(firstCover, req),
                song_count: uniqueSongIds.length
            },
            redirectUrl: `/playlist/${playlistId}`
        };
    } catch (error) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            console.warn('Rollback save AI playlist failed:', rollbackErr);
        }
        throw error;
    } finally {
        conn.release();
    }
}

async function recordPreviewGeneration({ userId, prompt, targetCount, preview, useLLM }) {
    const snapshot = buildPreviewSnapshot({ prompt, targetCount, preview });
    const historyId = await createGenerationHistory({
        userId,
        prompt,
        targetCount,
        actualCount: snapshot.actualCount,
        status: 'preview',
        provider: getProviderLabel({ useLLM, intent: preview?.intent }),
        intent: preview?.intent || null,
        previewSnapshot: snapshot
    });

    return historyId;
}

async function recordFailedGeneration({ userId, prompt, targetCount, provider = null, errorMessage }) {
    return createGenerationHistory({
        userId,
        prompt,
        targetCount,
        actualCount: 0,
        status: 'failed',
        provider,
        errorMessage: errorMessage || 'Khong tim duoc bai hat phu hop voi yeu cau nay.'
    });
}

async function listGenerationHistory({ userId, limit = 10, req = null }) {
    if (!userId) {
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
    }
    if (!(await ensureAiPlaylistHistoryTable())) {
        return [];
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);
    const [rows] = await pool.query(
        `SELECT id, prompt, target_count, actual_count, status, playlist_id,
                NULL AS cover_url, error_message, created_at
         FROM ai_playlist_generation_history
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [userId, safeLimit]
    );

    return rows.map((row) => shapeHistorySummary(row, req));
}

async function getGenerationHistoryDetail({ userId, historyId, req = null }) {
    if (!userId) {
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
    }
    if (!(await ensureAiPlaylistHistoryTable())) {
        const err = new Error('Khong tim thay lich su AI Playlist');
        err.statusCode = 404;
        throw err;
    }

    const [rows] = await pool.query(
        `SELECT id, user_id, prompt, target_count, actual_count, status, playlist_id,
                provider, intent_json, preview_snapshot_json, error_message, created_at
         FROM ai_playlist_generation_history
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [historyId, userId]
    );

    if (!rows.length) {
        const err = new Error('Khong tim thay lich su AI Playlist');
        err.statusCode = 404;
        throw err;
    }

    return shapeHistoryDetail(rows[0], req);
}

async function saveGenerationHistory({ userId, historyId, visibility = 'private', req = null }) {
    if (!userId) {
        const err = new Error('Ban can dang nhap de luu playlist');
        err.statusCode = 401;
        throw err;
    }
    if (!(await ensureAiPlaylistHistoryTable())) {
        const err = new Error('Khong tim thay lich su AI Playlist');
        err.statusCode = 404;
        throw err;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [historyRows] = await conn.query(
            `SELECT id, user_id, prompt, target_count, status, playlist_id, provider, intent_json, preview_snapshot_json
             FROM ai_playlist_generation_history
             WHERE id = ? AND user_id = ?
             LIMIT 1
             FOR UPDATE`,
            [historyId, userId]
        );

        if (!historyRows.length) {
            const err = new Error('Khong tim thay lich su AI Playlist');
            err.statusCode = 404;
            throw err;
        }

        const history = historyRows[0];
        if (history.status !== 'preview') {
            const err = new Error(history.status === 'saved' ? 'Preview nay da duoc luu thanh playlist' : 'Preview nay khong the luu');
            err.statusCode = 400;
            throw err;
        }

        const snapshot = safeJsonParse(history.preview_snapshot_json, null);
        const snapshotSongs = Array.isArray(snapshot?.songs) ? snapshot.songs : [];
        const seenSongIds = new Set();
        const songIds = [];
        for (const song of snapshotSongs) {
            const id = Number(song.song_id || song.id);
            if (Number.isInteger(id) && id > 0 && !seenSongIds.has(id)) {
                seenSongIds.add(id);
                songIds.push(id);
            }
        }

        if (!snapshot || !songIds.length) {
            const err = new Error('Preview snapshot khong con kha dung');
            err.statusCode = 400;
            err.code = 'PREVIEW_SNAPSHOT_EXPIRED';
            throw err;
        }

        const placeholders = songIds.map(() => '?').join(',');
        const [availableSongs] = await conn.query(
            `SELECT id, COALESCE(NULLIF(cover_url, ''), NULLIF(audio_url, '')) AS cover_url
             FROM songs s
             WHERE id IN (${placeholders})
               AND ${publicSongCondition('s')}
               AND s.audio_url IS NOT NULL
               AND TRIM(s.audio_url) <> ''
             FOR UPDATE`,
            songIds
        );
        const availableSet = new Set(availableSongs.map((song) => Number(song.id)));
        const missing = songIds.filter((id) => !availableSet.has(id));
        if (missing.length) {
            const err = new Error('Mot so bai hat trong preview cu khong con kha dung. Vui long dung lai prompt de tao preview moi.');
            err.statusCode = 400;
            err.code = 'PREVIEW_SNAPSHOT_EXPIRED';
            throw err;
        }

        const playlistName = buildAiPlaylistName({
            name: snapshot.title,
            intent: safeJsonParse(history.intent_json, snapshot.intent || {}),
            sourcePrompt: history.prompt
        });
        const firstCover = availableSongs.find((song) => Number(song.id) === songIds[0])?.cover_url
            || availableSongs.find((song) => song.cover_url)?.cover_url
            || null;
        const isPublic = visibility === 'public' ? 1 : 0;
        const sourceLine = history.prompt ? `AI prompt: ${String(history.prompt).slice(0, 500)}` : 'AI Playlist';
        const safeDescription = String(snapshot.description || 'Playlist duoc luu tu preview AI Playlist cu.').trim();
        const finalDescription = `${safeDescription}\n\n${sourceLine}`.slice(0, 2000);
        const intent = safeJsonParse(history.intent_json, snapshot.intent || {});

        const playlistColumns = ['user_id', 'name', 'description', 'cover_url', 'type', 'is_public', 'is_system', 'created_at', 'updated_at'];
        const playlistValues = [userId, playlistName, finalDescription, firstCover, 'ai', isPublic, 0];
        const valueSql = ['?', '?', '?', '?', '?', '?', '?', 'NOW()', 'NOW()'];
        if (await columnExists('playlists', 'ai_prompt')) {
            playlistColumns.push('ai_prompt');
            playlistValues.push(history.prompt || '');
            valueSql.push('?');
        }
        if (await columnExists('playlists', 'ai_intent_json')) {
            playlistColumns.push('ai_intent_json');
            playlistValues.push(stringifyJson(intent || {}));
            valueSql.push('?');
        }
        if (await columnExists('playlists', 'ai_provider')) {
            playlistColumns.push('ai_provider');
            playlistValues.push(history.provider || getProviderLabel({ intent }));
            valueSql.push('?');
        }

        const [playlistResult] = await conn.query(
            `INSERT INTO playlists (${playlistColumns.join(', ')})
             VALUES (${valueSql.join(', ')})`,
            playlistValues
        );
        const playlistId = playlistResult.insertId;

        const playlistSongsData = songIds.map((songId, index) => [playlistId, songId, index]);
        await conn.query(
            `INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ?`,
            [playlistSongsData]
        );

        if (await tableExists('ai_playlists')) {
            await conn.query(
                `INSERT INTO ai_playlists (user_id, prompt_text, extracted_params, playlist_id, status)
                 VALUES (?, ?, ?, ?, 'completed')`,
                [userId, history.prompt || '', JSON.stringify(intent || {}), playlistId]
            );
        }

        await conn.query(
            `UPDATE ai_playlist_generation_history
             SET status = 'saved', playlist_id = ?
             WHERE id = ? AND user_id = ?`,
            [playlistId, historyId, userId]
        );

        await conn.commit();

        return {
            success: true,
            playlist_id: playlistId,
            playlistId,
            playlist: {
                id: playlistId,
                name: playlistName,
                type: 'ai',
                cover_url: normalizeCoverUrl(firstCover, req),
                song_count: songIds.length
            },
            message: 'Da luu playlist tu preview cu.',
            redirectUrl: `/playlist/${playlistId}`
        };
    } catch (error) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            console.warn('Rollback save AI playlist history failed:', rollbackErr);
        }
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = {
    normalizeSongIds,
    previewAiPlaylist,
    refineAiPlaylist,
    saveAiPlaylist,
    recordPreviewGeneration,
    recordFailedGeneration,
    listGenerationHistory,
    getGenerationHistoryDetail,
    saveGenerationHistory,
    shapePreviewSong
};
