const { pool } = require('../config/database');
const { normalizeAiPlaylistIntent } = require('../utils/aiPlaylistSemanticMap');
const { publicSongCondition } = require('../utils/public.utils');

const removeAccents = (str) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

/**
 * Ghép bài hát dựa trên intent bằng cách chấm điểm (scoring).
 * @param {string} promptText
 * @param {Object} rawIntent 
 * @param {number} targetCount 
 * @returns {Promise<Object>}
 */
exports.matchSongs = async (promptText, rawIntent, targetCount) => {
    try {
        const { rawIntent: _raw, normalizedIntent: intent } = normalizeAiPlaylistIntent(rawIntent, promptText);

        const {
            genres = [],
            languages = [],
            keywords = [],
            mood = [],
            context = [],
            activity = [],
            tempo = 'any',
            energy = 'any',
            artists = [],
            artistConstraintMode = 'none',
            allowSimilarArtists = true,
            market
        } = intent || {};

        // 1. Resolve Artists from DB
        const connection = await pool.getConnection();
        let resolvedArtistIds = [];
        let resolvedArtistNames = [];
        let mode = artistConstraintMode;
        let isHard = mode === 'hard';
        let isSoft = mode === 'soft';

        try {
            const [columns] = await connection.query("SHOW COLUMNS FROM songs LIKE 'market'");
            const hasMarketCol = columns.length > 0;

            const [allArtists] = await connection.query(`SELECT id, name FROM artists`);
            const normalizedPrompt = removeAccents(promptText.toLowerCase());
            
            const matchedArtists = new Map();

            const safeArtists = Array.isArray(artists) ? artists.filter(a => a).map(a => removeAccents(String(a).toLowerCase().trim())) : [];
            
            for (const a of allArtists) {
                const normDbName = removeAccents(a.name.toLowerCase().trim());
                if (!normDbName) continue;

                if (safeArtists.includes(normDbName) || safeArtists.some(sa => sa.includes(normDbName) || normDbName.includes(sa))) {
                    matchedArtists.set(a.id, a.name);
                    continue;
                }

                if (normDbName.length > 2 && normalizedPrompt.includes(normDbName)) {
                    matchedArtists.set(a.id, a.name);
                }
            }

            resolvedArtistIds = Array.from(matchedArtists.keys());
            resolvedArtistNames = Array.from(matchedArtists.values());

            if (resolvedArtistIds.length > 0 && mode === 'none') {
                const isOnly = normalizedPrompt.includes('chi co') || normalizedPrompt.includes('chi gom') || normalizedPrompt.includes('only') || normalizedPrompt.includes('cua');
                mode = isOnly ? 'hard' : 'soft';
                isHard = mode === 'hard';
                isSoft = mode === 'soft';
            } else if (resolvedArtistIds.length === 0 && (isHard || isSoft)) {
                return {
                    songs: [],
                    message: "Không tìm thấy nghệ sĩ phù hợp trong hệ thống.",
                    constraints: { artists: resolvedArtistNames, artistConstraintMode: mode, allowSimilarArtists },
                    rawIntent,
                    normalizedIntent: intent
                };
            }

            const safeGenres = Array.isArray(genres) ? genres.filter(g => g).map(g => String(g).toLowerCase()) : [];
            const safeLanguages = Array.isArray(languages) ? languages.filter(l => l).map(l => String(l).toLowerCase()) : [];
            const safeKeywords = [...keywords, ...mood, ...context, ...activity].filter(k => k && typeof k === 'string').map(k => String(k).toLowerCase());

            let sql = `
                SELECT 
                    s.id, s.title, s.duration_sec as duration, s.audio_url as audioUrl,
                    COALESCE(s.cover_url, al.cover_url) as coverUrl,
                    a.name as artist, a.id as artistId,
                    g.name as genre, g.slug as genre_slug,
                    s.language, s.tempo, s.play_count,
                    saf.energy as saf_energy, saf.tempo_level as saf_tempo,
                    saf.mood as saf_mood, saf.vibe as saf_vibe,
                    saf.id as saf_id,
                    (
                        0
            `;
            
            const params = [];

            // 1. Genre Score
            if (safeGenres.length > 0) {
                const genreConditions = safeGenres.map(g => {
                    params.push(`%${g}%`, `%${g}%`);
                    return `(g.slug LIKE ? OR g.name LIKE ?)`;
                }).join(' OR ');
                sql += ` + IF(${genreConditions}, 300, 0)`;
            }

            // 2. Language Score
            if (safeLanguages.length > 0) {
                const placeholders = safeLanguages.map(() => '?').join(',');
                sql += ` + IF(s.language IN (${placeholders}), 50, 0)`;
                safeLanguages.forEach(l => params.push(l));
            }

            // 3. Semantic Score
            if (safeKeywords.length > 0) {
                const kwConditions = safeKeywords.map(k => {
                    params.push(`%${k}%`, `%${k}%`);
                    return `(s.title LIKE ? OR a.name LIKE ?)`;
                }).join(' OR ');
                sql += ` + IF(${kwConditions}, 40, 0)`;
            }

            // Implicit energy/tempo infer from DB
            if (tempo === 'fast' || energy === 'high') {
                sql += ` + IF(s.tempo > 110 OR g.slug LIKE '%edm%' OR g.slug LIKE '%dance%' OR g.slug LIKE '%remix%', 30, 0)`;
            } else if (tempo === 'slow' || energy === 'low' || mood.includes('sad') || mood.includes('chill')) {
                sql += ` + IF(s.tempo < 90 OR g.slug LIKE '%ballad%' OR g.slug LIKE '%lofi%' OR g.slug LIKE '%acoustic%', 30, 0)`;
            }

            // Audio features scoring
            if (energy === 'low') sql += ` + IF(saf.energy = 'low', 50, 0)`;
            if (energy === 'high') sql += ` + IF(saf.energy = 'high', 50, 0)`;
            if (tempo === 'slow') sql += ` + IF(saf.tempo_level = 'slow', 50, 0)`;
            if (tempo === 'fast') sql += ` + IF(saf.tempo_level = 'fast', 50, 0)`;

            if (mood.includes('chill')) {
                sql += ` + IF(saf.mood = 'chill' OR saf.vibe LIKE '%chill%', 50, 0)`;
            }
            if (activity.includes('workout') || activity.includes('gym')) {
                sql += ` + IF(saf.energy = 'high' AND saf.tempo_level = 'fast' AND saf.danceability > 0.6, 60, 0)`;
            }
            if (context.includes('night') || context.includes('sleep')) {
                sql += ` + IF(saf.energy = 'low' AND saf.tempo_level = 'slow', 50, 0)`;
            }
            if (activity.includes('focus') || activity.includes('study') || activity.includes('coding')) {
                sql += ` + IF(saf.tempo_level = 'medium' AND saf.energy IN ('low', 'medium') AND saf.vibe LIKE '%focus%', 50, 0)`;
            }
            
            // Add a small boost to all songs that HAVE audio features to prefer analyzed ones
            sql += ` + IF(saf.id IS NOT NULL, 5, 0)`;

            // 4. Artist Score
            if (resolvedArtistIds.length > 0) {
                const artistPlaceholders = resolvedArtistIds.map(() => '?').join(',');
                sql += ` + IF(s.artist_id IN (${artistPlaceholders}), 500, 0)`;
                resolvedArtistIds.forEach(id => params.push(id));
            }

            // 5. Diversity & Popularity Score
            sql += ` + (LOG10(s.play_count + 1) * 2) + (RAND() * 10)`;
            sql += ` ) as match_score FROM songs s `;
            sql += ` LEFT JOIN artists a ON s.artist_id = a.id `;
            sql += ` LEFT JOIN albums al ON s.album_id = al.id `;
            sql += ` LEFT JOIN genres g ON s.genre_id = g.id `;
            sql += ` LEFT JOIN song_audio_features saf ON saf.song_id = s.id `;
            sql += ` WHERE ${publicSongCondition('s')} `;

            let marketCondition = "";
            let marketFallbackCondition = "";
            const marketParams = [];
            
            if (market) {
                if (hasMarketCol) {
                    marketCondition = ` AND s.market = ? `;
                    marketFallbackCondition = ` AND s.market = ? `;
                    marketParams.push(market);
                } else {
                    if (market === 'VPOP') {
                        marketCondition = ` AND (g.slug IN ('v-pop', 'vpop', 'indie', 'rap') OR s.language = 'vi') `;
                        marketFallbackCondition = marketCondition;
                    } else if (market === 'KPOP') {
                        marketCondition = ` AND (g.slug IN ('k-pop', 'kpop') OR s.language = 'ko') `;
                        marketFallbackCondition = marketCondition;
                    } else if (market === 'USUK') {
                        marketCondition = ` AND (g.slug IN ('usuk', 'pop', 'rnb', 'rock', 'hip-hop') OR s.language = 'en') `;
                        marketFallbackCondition = marketCondition;
                    }
                }
                sql += marketCondition;
                if (marketParams.length > 0) {
                    params.push(...marketParams);
                }
            }

            if (isHard && resolvedArtistIds.length > 0) {
                const artistPlaceholders = resolvedArtistIds.map(() => '?').join(',');
                sql += ` AND s.artist_id IN (${artistPlaceholders}) `;
                resolvedArtistIds.forEach(id => params.push(id));
            }

            sql += ` ORDER BY match_score DESC LIMIT ? `;
            
            const fetchCount = isHard ? targetCount : targetCount * 3;
            params.push(fetchCount);

            const [rows] = await connection.query(sql, params);

            const selectedSongs = [];
            const artistCounts = {};

            let primaryIntent = '';
            if (mood.includes('sad')) primaryIntent = 'nhạc suy/buồn';
            else if (mood.includes('romantic')) primaryIntent = 'nhạc ngôn tình/lãng mạn';
            else if (activity.includes('workout')) primaryIntent = 'tập gym/năng lượng cao';
            else if (activity.includes('study')) primaryIntent = 'chạy deadline/tập trung';
            else if (mood.includes('chill')) primaryIntent = 'chill/chữa lành';
            else if (context.includes('night')) primaryIntent = 'nghe đêm khuya';
            else primaryIntent = intent.playlistName || 'yêu cầu của bạn';

            for (const row of rows) {
                if (selectedSongs.length >= targetCount) break;
                
                const aId = row.artistId;
                if (!artistCounts[aId]) artistCounts[aId] = 0;

                if (isHard || artistCounts[aId] < 2) {
                    let reason = `Phù hợp với yêu cầu ${primaryIntent} vì bài hát thuộc nhóm ${row.genre || 'nhạc nhẹ nhàng'}.`;
                    
                    if (market) {
                        const moodText = mood.length > 0 ? mood.join('/') : (row.saf_mood || 'thư giãn');
                        reason = `Phù hợp vì bài hát thuộc ${market} và có sắc thái ${moodText}.`;
                        if ((isHard || isSoft) && resolvedArtistIds.includes(aId)) {
                            reason = `Thuộc nghệ sĩ ${row.artist}, đúng với nghệ sĩ bạn đã yêu cầu trong ${market}.`;
                        }
                    } else {
                        if ((isHard || isSoft) && resolvedArtistIds.includes(aId)) {
                            reason = `Thuộc nghệ sĩ ${row.artist}, đúng với nghệ sĩ bạn đã yêu cầu.`;
                        } else if (safeGenres.length > 0 && safeGenres.some(g => row.genre_slug && row.genre_slug.includes(g))) {
                            reason = `Được chọn vì thuộc thể loại ${row.genre} phù hợp với yêu cầu.`;
                        } else if (row.saf_id) {
                            let audioFeatureReason = '';
                            if (energy === 'low' || tempo === 'slow') audioFeatureReason = 'âm hưởng nhẹ nhàng, tiết tấu chậm';
                            else if (energy === 'high' || tempo === 'fast') audioFeatureReason = 'năng lượng cao, tiết tấu nhanh';
                            else if (mood.includes('chill')) audioFeatureReason = 'giai điệu thư giãn';
                            
                            if (audioFeatureReason) {
                                reason = `Phù hợp với yêu cầu vì bài hát có ${audioFeatureReason}.`;
                            } else {
                                reason = `Phù hợp với yêu cầu dựa trên nhịp điệu và năng lượng của bài hát.`;
                            }
                        }
                    }

                    selectedSongs.push({
                        id: row.id,
                        title: row.title,
                        artist: row.artist,
                        coverUrl: row.coverUrl,
                        duration: row.duration,
                        audioUrl: row.audioUrl,
                        reason: reason
                    });
                    artistCounts[aId]++;
                }
            }

            if (!isHard && selectedSongs.length < targetCount) {
                const remaining = targetCount - selectedSongs.length;
                const existingIds = selectedSongs.map(s => s.id);
                const notInClause = existingIds.length > 0 ? `AND s.id NOT IN (${existingIds.join(',')})` : '';
                
                let fallbackSql = `
                    SELECT 
                        s.id, s.title, s.duration_sec as duration, s.audio_url as audioUrl,
                        COALESCE(s.cover_url, al.cover_url) as coverUrl,
                        a.name as artist
                    FROM songs s
                    LEFT JOIN artists a ON s.artist_id = a.id
                    LEFT JOIN albums al ON s.album_id = al.id
                    LEFT JOIN genres g ON s.genre_id = g.id
                    WHERE ${publicSongCondition('s')} ${notInClause}
                `;
                const fallbackExecParams = [];
                if (marketCondition) {
                    fallbackSql += marketFallbackCondition;
                    if (marketParams.length > 0) {
                        fallbackExecParams.push(...marketParams);
                    }
                }
                
                fallbackSql += ` ORDER BY s.play_count DESC, RAND() LIMIT ? `;
                fallbackExecParams.push(remaining);

                const [fallbackRows] = await connection.query(fallbackSql, fallbackExecParams);

                for (const row of fallbackRows) {
                    selectedSongs.push({
                        id: row.id,
                        title: row.title,
                        artist: row.artist,
                        coverUrl: row.coverUrl,
                        duration: row.duration,
                        audioUrl: row.audioUrl,
                        reason: 'Gợi ý thêm từ danh sách thịnh hành để đa dạng playlist'
                    });
                }
            }

            let message = null;
            if (selectedSongs.length < targetCount) {
                if (market) {
                    message = `Không đủ bài ${market} phù hợp, hệ thống chỉ tìm được ${selectedSongs.length} bài.`;
                } else if (isHard) {
                    message = `Chỉ tìm thấy ${selectedSongs.length} bài hát phù hợp từ nghệ sĩ đã yêu cầu, nên hệ thống không tự thêm nghệ sĩ khác.`;
                }
            }

            if (process.env.NODE_ENV !== 'production') {
                console.log('\\n--- AI PLAYLIST MATCHING DEBUG ---');
                console.log('Original Prompt:', promptText);
                console.log('Raw Intent:', JSON.stringify(rawIntent, null, 2));
                console.log('Normalized Intent:', JSON.stringify(intent, null, 2));
                console.log('Artist Constraint Mode:', mode);
                console.log('Resolved Artists:', resolvedArtistNames);
                console.log('----------------------------------\\n');
            }

            return {
                songs: selectedSongs,
                message,
                constraints: {
                    artists: resolvedArtistNames,
                    artistConstraintMode: mode,
                    allowSimilarArtists
                },
                rawIntent,
                normalizedIntent: intent,
                matchedMarket: market || null,
                matchedGenres: safeGenres
            };
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in aiPlaylistSongMatcher matchSongs:', error);
        throw error;
    }
};
