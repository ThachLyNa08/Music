const { pool } = require('../config/database');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const { clampTargetCount } = require('../utils/aiPlaylistIntentSchema');
const { publicSongCondition } = require('../utils/public.utils');
const { tableExists } = require('../utils/dbIntrospection');
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
        tempoBucket: song.tempo_bucket || song.tempoBucket || song.tempo_level || null,
        normalizedBpm: song.normalized_bpm || song.normalizedBpm || song.bpm || null,
        energyScore: song.energy_score ?? null,
        danceabilityScore: song.danceability_score ?? song.danceability ?? null,
        tempoReason: song.tempoReason || null
    };
}

function normalizeSongIds(songIds) {
    if (!Array.isArray(songIds)) return [];
    return [...new Set(songIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function buildShortageMeta({ songs, candidates, count, candidateMeta, intent }) {
    const shortage = songs.length < count;
    let shortageReason = null;

    if (shortage) {
        const hardArtists = intent?.hardConstraints?.include_artists || [];
        if (hardArtists.length > 0) {
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

async function previewAiPlaylist({
    prompt,
    targetCount,
    userId = null,
    useLLM = false,
    req = null,
    previousSongIds = [],
    avoidPreviousSongs = false,
    intentOverride = null
}) {
    const count = clampTargetCount(targetCount);
    const intent = intentOverride || await normalizeAiPlaylistIntent({
        prompt,
        targetCount: count,
        userId,
        useLLM
    });

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
        targetCount: count
    });

    const songs = ranked.songs.map((song) => shapePreviewSong(song, req));
    const shortageMeta = buildShortageMeta({ songs, candidates: rankingCandidates, count, candidateMeta, intent });
    const playlistTitle = buildPlaylistTitle(intent, prompt);
    const description = 'Playlist được tạo từ hồ sơ ngữ nghĩa bài hát và lọc lại bằng dữ liệu thật trong MusicFlow.';
    const retrieval = buildRetrievalMeta({ ragResult, candidateMeta, songs });
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

        const [playlistResult] = await conn.query(
            `INSERT INTO playlists (user_id, name, description, cover_url, type, is_public, is_system, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'ai', ?, 0, NOW(), NOW())`,
            [userId, playlistName, finalDescription, firstCover, isPublic]
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

module.exports = {
    previewAiPlaylist,
    refineAiPlaylist,
    saveAiPlaylist,
    shapePreviewSong
};
