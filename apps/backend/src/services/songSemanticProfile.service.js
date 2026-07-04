const { pool } = require('../config/database');

function safeJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function clampScore(value, max = 10) {
    return Math.min(Number(value) || 0, max);
}

async function getProfilesBySongIds(songIds) {
    if (!songIds || !songIds.length) return new Map();

    const placeholders = songIds.map(() => '?').join(',');
    const [rows] = await pool.query(
        `SELECT * FROM song_semantic_profiles WHERE song_id IN (${placeholders})`,
        songIds
    );

    const profileMap = new Map();
    for (const row of rows) {
        profileMap.set(Number(row.song_id), {
            ...row,
            sub_themes: safeJsonArray(row.sub_themes),
            mood_tags: safeJsonArray(row.mood_tags),
            situation_tags: safeJsonArray(row.situation_tags),
            lyrical_keywords: safeJsonArray(row.lyrical_keywords),
            emotion_intensity: Number(row.emotion_intensity) || 3,
            meaning_confidence: Number(row.meaning_confidence) || 0.6,
        });
    }
    return profileMap;
}

async function attachSemanticProfiles(songs) {
    if (!songs || !songs.length) return;
    const songIds = songs.map((s) => Number(s.id)).filter(id => !isNaN(id));
    if (!songIds.length) return;

    try {
        const profileMap = await getProfilesBySongIds(songIds);
        let attachedCount = 0;
        for (const song of songs) {
            const profile = profileMap.get(Number(song.id));
            if (profile) {
                song.semanticProfile = profile;
                attachedCount++;
            } else {
                song.semanticProfile = null;
            }
        }
        if (process.argv.includes('--debug')) {
            console.log(`[Recommendation] Semantic profiles attached: ${attachedCount}/${songs.length}`);
        }
    } catch (err) {
        console.error('[Recommendation] Failed to attach semantic profiles:', err.message);
        // Fallback: make sure all songs at least have null
        for (const song of songs) {
            if (song.semanticProfile === undefined) song.semanticProfile = null;
        }
    }
}

async function buildUserSemanticPreference(userId, options = {}) {
    let lhCond = '';
    const lhParams = [userId];
    if (options.listeningWindow) {
        lhCond = ` AND lh.listened_at >= ? AND lh.listened_at < ?`;
        lhParams.push(options.listeningWindow.startAt, options.listeningWindow.endAt);
    }

    try {
        // Query listening history
        const [historyRows] = await pool.query(`
            SELECT lh.song_id, COUNT(*) as listens, SUM(lh.completion_rate) as completion_sum, MAX(lh.listened_at) as last_played
            FROM listening_history lh
            WHERE lh.user_id = ? ${lhCond}
            GROUP BY lh.song_id
        `, lhParams);

        // Query liked songs
        let likedSongIds = new Set();
        try {
            const [likedRows] = await pool.query(`SELECT song_id FROM song_likes WHERE user_id = ?`, [userId]);
            likedRows.forEach(r => likedSongIds.add(Number(r.song_id)));
        } catch (err) {
            // Ignore if song_likes doesn't exist or errors out
        }

        const songIds = new Set();
        historyRows.forEach(r => songIds.add(Number(r.song_id)));
        likedSongIds.forEach(id => songIds.add(id));

        const profileMap = await getProfilesBySongIds(Array.from(songIds));
        
        const themes = new Map();
        const moods = new Map();
        const situations = new Map();
        const keywords = new Map();
        let totalEmotion = 0;
        let countEmotion = 0;

        const now = new Date();

        for (const id of songIds) {
            const profile = profileMap.get(id);
            if (!profile) continue;

            const history = historyRows.find(r => Number(r.song_id) === id);
            const isLiked = likedSongIds.has(id);
            
            let weight = 1.0;
            if (history) {
                weight += Number(history.listens) * 0.1;
                weight += Number(history.completion_sum || 0) * 0.1;
                
                const daysSincePlayed = (now - new Date(history.last_played)) / (1000 * 60 * 60 * 24);
                if (daysSincePlayed <= 30) weight *= 1.2;
            }
            if (isLiked) weight *= 1.5;

            // Apply source/quality weights
            if (profile.evidence_level === 'metadata_only') weight *= 0.75;
            if (profile.review_status === 'needs_review') weight *= 0.50;

            const addWeight = (map, key, increment) => {
                if (!key) return;
                map.set(key, (map.get(key) || 0) + increment * weight);
            };

            addWeight(themes, profile.main_theme, 3.0);
            profile.mood_tags.forEach(t => addWeight(moods, t, 1.6));
            profile.situation_tags.forEach(t => addWeight(situations, t, 1.4));
            profile.lyrical_keywords.forEach(k => addWeight(keywords, k, 0.4));

            if (profile.emotion_intensity) {
                totalEmotion += profile.emotion_intensity * weight;
                countEmotion += weight;
            }
        }

        // Clamp the maps to prevent unbounded growth from users listening to 10k songs
        const clampMap = (map, max) => {
            const newMap = new Map();
            for (const [k, v] of map.entries()) {
                newMap.set(k, clampScore(v, max));
            }
            return newMap;
        };

        const result = {
            themes: clampMap(themes, 50),
            moods: clampMap(moods, 30),
            situations: clampMap(situations, 30),
            keywords: clampMap(keywords, 10),
            avgEmotionIntensity: countEmotion > 0 ? totalEmotion / countEmotion : 5,
            profileCount: profileMap.size
        };

        if (process.argv.includes('--debug')) {
            console.log(`[Recommendation] Semantic preference profileCount: ${result.profileCount}`);
        }

        return result;

    } catch (err) {
        console.error('[Recommendation] Failed to build semantic preference:', err.message);
        return {
            themes: new Map(), moods: new Map(), situations: new Map(), keywords: new Map(),
            avgEmotionIntensity: 5, profileCount: 0
        };
    }
}

function getQualityMultiplier(profile) {
    if (!profile) return 1;
    let quality = 1.0;
    if (profile.evidence_level === 'metadata_only') quality *= 0.75;
    if (profile.review_status === 'needs_review') quality *= 0.50;
    
    const confidence = Number(profile.meaning_confidence);
    if (!isNaN(confidence)) {
        quality *= clamp01(confidence);
    }
    
    return clamp01(quality);
}

function scoreSongBySemanticPreference(song, userPref) {
    if (!song || !song.semanticProfile || !userPref || userPref.profileCount === 0) return 0;
    
    const profile = song.semanticProfile;
    let score = 0;

    // Normalize userPref maxes to calculate 0..1 overlap
    const maxTheme = Math.max(...userPref.themes.values(), 1);
    const maxMood = Math.max(...userPref.moods.values(), 1);
    const maxSituation = Math.max(...userPref.situations.values(), 1);
    const maxKeyword = Math.max(...userPref.keywords.values(), 1);

    if (profile.main_theme && userPref.themes.has(profile.main_theme)) {
        score += (userPref.themes.get(profile.main_theme) / maxTheme) * 0.35;
    }

    if (profile.mood_tags.length > 0) {
        let moodScore = 0;
        for (const m of profile.mood_tags) {
            if (userPref.moods.has(m)) moodScore += userPref.moods.get(m) / maxMood;
        }
        score += clamp01(moodScore) * 0.25;
    }

    if (profile.situation_tags.length > 0) {
        let sitScore = 0;
        for (const s of profile.situation_tags) {
            if (userPref.situations.has(s)) sitScore += userPref.situations.get(s) / maxSituation;
        }
        score += clamp01(sitScore) * 0.20;
    }

    if (profile.lyrical_keywords.length > 0) {
        let kwScore = 0;
        for (const k of profile.lyrical_keywords) {
            if (userPref.keywords.has(k)) kwScore += userPref.keywords.get(k) / maxKeyword;
        }
        score += clamp01(kwScore) * 0.10;
    }

    const intensityDiff = Math.abs((profile.emotion_intensity || 5) - userPref.avgEmotionIntensity);
    const emotionScore = Math.max(0, 1 - (intensityDiff / 10));
    score += emotionScore * 0.10;

    const finalScore = clamp01(score) * getQualityMultiplier(profile);
    return finalScore;
}

function scoreSongByPromptIntent(song, normalizedIntent) {
    if (!song || !song.semanticProfile || !normalizedIntent) return 0;
    
    const profile = song.semanticProfile;
    const hard = normalizedIntent.hardConstraints || {};
    const soft = normalizedIntent.softPreferences || {};
    
    let mainThemeMatch = 0;
    let moodOverlap = 0;
    let situationOverlap = 0;
    let keywordMatch = 0;

    // Soft mood logic mapped to main_theme and mood_tags
    const moods = new Set(soft.mood || []);
    if (moods.has('romantic') && profile.main_theme === 'love') mainThemeMatch = 1;
    if ((moods.has('sad') || moods.has('melancholic') || moods.has('emotional')) && profile.main_theme === 'heartbreak') mainThemeMatch = 1;
    if ((moods.has('calm') || moods.has('chill') || moods.has('gentle')) && profile.main_theme === 'healing') mainThemeMatch = 1;
    if ((moods.has('party') || moods.has('energetic')) && profile.main_theme === 'party') mainThemeMatch = 1;
    
    // Explicit themes from matchedKeywords if we implemented that logic (fallback to main_theme string match)
    if (normalizedIntent.raw?.matchedKeywords) {
        if (normalizedIntent.raw.matchedKeywords.some(k => k.includes('heartbreak') || k.includes('thất tình'))) {
            if (profile.main_theme === 'heartbreak') mainThemeMatch = 1;
        }
    }

    if (mainThemeMatch === 0) {
        // If main theme doesn't hit strong shortcuts, give partial credit for general theme relevance
        mainThemeMatch = 0.5;
    }

    if (soft.mood && soft.mood.length > 0) {
        const overlap = profile.mood_tags.filter(m => soft.mood.includes(m)).length;
        moodOverlap = clamp01(overlap / Math.max(1, soft.mood.length));
    } else {
        moodOverlap = 0.5;
    }

    // Context / Activity mapping
    const contextActivityTarget = new Set(soft.context || []);
    if (soft.activity) contextActivityTarget.add(soft.activity);

    if (contextActivityTarget.size > 0) {
        const overlap = profile.situation_tags.filter(s => contextActivityTarget.has(s)).length;
        situationOverlap = clamp01(overlap / contextActivityTarget.size);
    } else {
        situationOverlap = 0.5;
    }

    if (normalizedIntent.raw?.matchedKeywords && profile.lyrical_keywords) {
        const intentKeys = normalizedIntent.raw.matchedKeywords.map(k => k.toLowerCase());
        const overlap = profile.lyrical_keywords.filter(k => intentKeys.some(ik => ik.includes(k.toLowerCase()))).length;
        keywordMatch = clamp01(overlap / 2); // 2 matches is 100%
    }

    const confidenceBonus = clamp01(Number(profile.meaning_confidence) || 0.6);

    let semanticScore = (mainThemeMatch * 0.35) +
                        (moodOverlap * 0.25) +
                        (situationOverlap * 0.25) +
                        (keywordMatch * 0.10) +
                        (confidenceBonus * 0.05);

    return clamp01(semanticScore) * getQualityMultiplier(profile);
}

module.exports = {
    safeJsonArray,
    clamp01,
    clampScore,
    getProfilesBySongIds,
    attachSemanticProfiles,
    buildUserSemanticPreference,
    scoreSongBySemanticPreference,
    scoreSongByPromptIntent
};
