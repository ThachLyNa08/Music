const { pool } = require('../config/database');
const { tableExists } = require('../utils/dbIntrospection');
const { normalizeText } = require('./aiPlaylistIntent.service');
const modelService = require('./recommendationModel.service');
const { buildAiPlaylistSongReason } = require('./aiPlaylistReason.service');
const semanticProfileService = require('./songSemanticProfile.service');

const DEFAULT_WEIGHTS = Object.freeze({
    semanticRag: 0.20,
    intentMatch: 0.22,
    bpr: 0.18,
    audioFeature: 0.14,
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

function normalizeMarket(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeArray(values) {
    return (values || []).map((value) => normalizeText(value)).filter(Boolean);
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
    if (Number.isFinite(Number(song.energy_score))) return clamp01(song.energy_score);
    const energy = normalizeText(song.energy);
    if (energy === 'high') return 0.85;
    if (energy === 'medium') return 0.55;
    if (energy === 'low') return 0.25;
    return 0.5;
}

function getTempoScore(song) {
    const level = normalizeText(song.tempo_level);
    if (level === 'fast') return 0.85;
    if (level === 'medium') return 0.55;
    if (level === 'slow') return 0.25;
    const bpm = Number(song.bpm);
    if (!Number.isFinite(bpm)) return 0.5;
    if (bpm >= 115) return 0.85;
    if (bpm <= 90) return 0.25;
    return 0.55;
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
            components.push(getEnergyScore(song) >= 0.65 || Number(song.danceability || 0) >= 0.65 ? 1 : 0.45);
        } else if (['study', 'coding', 'work'].includes(soft.activity)) {
            const energy = getEnergyScore(song);
            components.push(energy >= 0.25 && energy <= 0.7 ? 0.9 : 0.35);
        } else if (['sleep', 'relax', 'coffee', 'healing'].includes(soft.activity)) {
            components.push(getEnergyScore(song) <= 0.6 ? 0.9 : 0.35);
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
    const danceability = Number.isFinite(Number(song.danceability)) ? clamp01(song.danceability) : 0.5;
    const acoustic = Number.isFinite(Number(song.acoustic_score)) ? clamp01(song.acoustic_score) : 0.5;

    if (soft.energy) scores.push(clamp01(scoreBand(energy, soft.energy)));
    if (soft.tempo) scores.push(clamp01(scoreBand(tempo, soft.tempo)));

    const moods = new Set(soft.mood || []);
    if (moods.has('chill') || moods.has('calm') || soft.activity === 'relax' || soft.activity === 'coffee') {
        scores.push(clamp01((1 - energy) * 0.55 + acoustic * 0.45));
    }
    if (moods.has('focus') || ['study', 'coding', 'work'].includes(soft.activity)) {
        const mediumEnergy = 1 - Math.abs(energy - 0.5) / 0.5;
        scores.push(clamp01(mediumEnergy * 0.7 + (1 - danceability) * 0.3));
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

    if (!scores.length) return 0.5;
    return clamp01(scores.reduce((sum, value) => sum + value, 0) / scores.length);
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
        if (mood === 'party' && (getEnergyScore(song) >= 0.72 || Number(song.danceability || 0) >= 0.72)) penalty += 0.15;
        if (mood === 'heartbreak' && (songText.includes('heartbreak') || songText.includes('sad'))) penalty += 0.12;
    }
    for (const energy of neg.energy || []) {
        if (energy === 'high' && getEnergyScore(song) >= 0.68) penalty += 0.22;
        if (energy === 'low' && getEnergyScore(song) <= 0.35) penalty += 0.16;
    }
    for (const keyword of neg.keywords || []) {
        if (songText.includes(normalizeText(keyword))) penalty += 0.08;
    }

    return clamp01(penalty);
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

function calculateBprScores(candidates, userId) {
    const loadResult = modelService.tryLoad();
    if (!loadResult.ok || !loadResult.model || !userId) {
        return {
            scores: new Map(),
            bprAvailable: Boolean(loadResult.ok && loadResult.model),
            userInModel: false
        };
    }

    const model = loadResult.model;
    const userIdx = modelService.getUserIndex(userId);
    if (userIdx < 0) {
        return { scores: new Map(), bprAvailable: true, userInModel: false };
    }

    const rawScores = candidates.map((song) => {
        const songIdx = model.song_index_map?.[String(song.id)];
        if (songIdx === undefined || songIdx < 0) return null;
        let score = dotProduct(model.user_factors[userIdx], model.item_factors[songIdx]);
        if (model.user_biases) score += Number(model.user_biases[userIdx] || 0);
        if (model.item_biases) score += Number(model.item_biases[songIdx] || 0);
        return score;
    });
    const normalized = safeNorm(rawScores);
    const scores = new Map();
    candidates.forEach((song, index) => {
        scores.set(song.id, rawScores[index] === null ? 0 : normalized[index]);
    });

    return { scores, bprAvailable: true, userInModel: true };
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

    for (const item of scored) {
        if (seen.has(item.id)) continue;
        const artistId = item.artist_id || 0;
        const count = artistCounts.get(artistId) || 0;
        if (artistId && count >= artistCap) {
            deferred.push(item);
            continue;
        }
        item.scoreBreakdown.diversity = artistId ? clamp01(1 - count / Math.max(artistCap, 1)) : 0.8;
        selected.push(item);
        seen.add(item.id);
        if (artistId) artistCounts.set(artistId, count + 1);
        if (selected.length >= targetCount) return selected;
    }

    for (const item of deferred) {
        if (selected.length >= targetCount) break;
        if (seen.has(item.id)) continue;
        item.scoreBreakdown.diversity = 0.2;
        selected.push(item);
        seen.add(item.id);
    }

    return selected;
}

async function rankAiPlaylistCandidates({ candidates = [], intent, userId = null, targetCount = 20 }) {
    const safeTarget = Math.max(1, Math.min(Number(targetCount) || 20, 50));
    const uniqueCandidates = [];
    const seen = new Set();
    for (const candidate of candidates) {
        if (!candidate?.id || seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        uniqueCandidates.push(candidate);
    }

    const bpr = calculateBprScores(uniqueCandidates, userId);
    const history = await buildHistoryProfile(userId);
    await semanticProfileService.attachSemanticProfiles(uniqueCandidates);
    const popularityValues = uniqueCandidates.map((song) => Math.log10(Number(song.play_count || 0) + Number(song.like_count || 0) * 5 + 1));
    const normPopularity = safeNorm(popularityValues);

    const scored = uniqueCandidates.map((song, index) => {
        const intentMatch = scoreIntentMatch(song, intent);
        const bprScore = bpr.scores.get(song.id) || 0;
        const audioFeature = scoreAudioFeature(song, intent);
        const userHistory = scoreUserHistory(song, history, intent);
        const popularity = scorePopularity(song, normPopularity[index], intent);
        const penalty = scorePenalty(song, intent);
        const semantic = semanticProfileService.scoreSongByPromptIntent(song, intent);
        const semanticRag = clamp01(song.rag_score || 0);
        const diversity = 0.7;
        const aiScore = clamp01(
            DEFAULT_WEIGHTS.semanticRag * semanticRag
            + DEFAULT_WEIGHTS.intentMatch * intentMatch
            + DEFAULT_WEIGHTS.bpr * bprScore
            + DEFAULT_WEIGHTS.audioFeature * audioFeature
            + DEFAULT_WEIGHTS.userHistory * userHistory
            + DEFAULT_WEIGHTS.popularity * popularity
            + DEFAULT_WEIGHTS.semantic * semantic
            + DEFAULT_WEIGHTS.diversity * diversity
            - penalty
        );

        return {
            ...song,
            aiScore,
            scoreBreakdown: {
                semanticRag: Number(semanticRag.toFixed(4)),
                intentMatch: Number(intentMatch.toFixed(4)),
                bpr: Number(bprScore.toFixed(4)),
                audioFeature: Number(audioFeature.toFixed(4)),
                userHistory: Number(userHistory.toFixed(4)),
                popularity: Number(popularity.toFixed(4)),
                semantic: Number(semantic.toFixed(4)),
                diversity: Number(diversity.toFixed(4)),
                penalty: Number(penalty.toFixed(4))
            }
        };
    });

    scored.sort((a, b) => b.aiScore - a.aiScore || Number(b.play_count || 0) - Number(a.play_count || 0) || a.id - b.id);
    const selected = selectWithDiversity(scored, safeTarget, intent).map((song) => {
        const aiScore = clamp01(
            DEFAULT_WEIGHTS.semanticRag * song.scoreBreakdown.semanticRag
            + DEFAULT_WEIGHTS.intentMatch * song.scoreBreakdown.intentMatch
            + DEFAULT_WEIGHTS.bpr * song.scoreBreakdown.bpr
            + DEFAULT_WEIGHTS.audioFeature * song.scoreBreakdown.audioFeature
            + DEFAULT_WEIGHTS.userHistory * song.scoreBreakdown.userHistory
            + DEFAULT_WEIGHTS.popularity * song.scoreBreakdown.popularity
            + DEFAULT_WEIGHTS.semantic * song.scoreBreakdown.semantic
            + DEFAULT_WEIGHTS.diversity * song.scoreBreakdown.diversity
            - song.scoreBreakdown.penalty
        );
        const rounded = {
            ...song,
            aiScore: Number(aiScore.toFixed(4)),
            scoreBreakdown: Object.fromEntries(
                Object.entries(song.scoreBreakdown).map(([key, value]) => [key, Number(Number(value).toFixed(4))])
            )
        };
        return {
            ...rounded,
            reason: buildAiPlaylistSongReason(rounded, intent, rounded.scoreBreakdown)
        };
    });

    const strategy = bpr.bprAvailable && bpr.userInModel
        ? 'hybrid_bpr_audio_metadata'
        : (selected.length ? 'content_audio_popularity_fallback' : 'popular_fallback');

    return {
        songs: selected,
        rankingMeta: {
            strategy,
            weights: DEFAULT_WEIGHTS,
            bprAvailable: bpr.bprAvailable,
            userInModel: bpr.userInModel
        }
    };
}

module.exports = {
    rankAiPlaylistCandidates,
    DEFAULT_WEIGHTS,
    scoreIntentMatch,
    scoreAudioFeature,
    scorePenalty
};
