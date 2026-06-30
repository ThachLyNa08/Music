const { pool } = require('../config/database');
const aiPlaylistService = require('../services/aiPlaylist.service');

exports.preview = async (req, res) => {
    try {
        let { prompt, targetCount, userId, useLLM } = req.body;

        // 1. Validate prompt
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập prompt để tạo playlist thử nghiệm'
            });
        }
        prompt = prompt.trim();
        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập prompt để tạo playlist thử nghiệm'
            });
        }

        // 2. Normalize and validate targetCount
        targetCount = parseInt(targetCount, 10) || 20;
        if (targetCount < 5) targetCount = 5;
        if (targetCount > 30) targetCount = 30;

        // 3. Handle and validate userId
        let validUserId = null;
        if (userId !== undefined && userId !== null && userId !== '') {
            validUserId = parseInt(userId, 10);
            if (isNaN(validUserId) || validUserId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID không hợp lệ'
                });
            }

            // Check if user exists
            const [[user]] = await pool.query('SELECT id FROM users WHERE id = ?', [validUserId]);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy user với ID = ${validUserId}`
                });
            }
        }
        // IMPORTANT: We do not use req.user.id if userId is null, to allow generic cold-start

        // 4. Handle LLM toggle (mocked check for now, aiPlaylistService handles the actual LLM call or fallback)
        let useLLMRequested = Boolean(useLLM);
        let useLLMApplied = useLLMRequested;
        let llmUnavailableReason = null;
        
        if (useLLMRequested && !process.env.GEMINI_API_KEY) {
            useLLMApplied = false;
            llmUnavailableReason = 'LLM API key is not configured';
        }

        const startMs = Date.now();

        // 5. Call service
        const previewResult = await aiPlaylistService.previewAiPlaylist({
            prompt,
            targetCount,
            userId: validUserId,
            useLLM: useLLMApplied,
            req
        });

        const elapsedMs = Date.now() - startMs;

        // 6. Format Response
        const { intent, songs, warnings, strategy, meta } = previewResult;

        // Format items specifically as requested
        const items = songs.map(song => ({
            song_id: song.id,
            title: song.title,
            artist_id: song.artist_id,
            artist_name: song.artist, // shapePreviewSong returns artist
            cover_url: song.cover_url || song.coverUrl,
            market: song.market,
            genre: song.genre,
            strategy: typeof song.reason === 'object' ? (song.reason?.strategy || strategy) : strategy || 'rule_based_hybrid',
            reason: typeof song.reason === 'object' ? (song.reason?.explanation || 'Phù hợp với yêu cầu') : (song.reason || 'Phù hợp với yêu cầu'),
            score: song.aiScore || 0
        }));

        res.json({
            success: true,
            data: {
                title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''), // Simple title based on prompt
                intent: {
                    mood: intent?.mood || null,
                    activity: intent?.activity || null,
                    market: intent?.market || null,
                    genres: intent?.genres || [],
                    artists: intent?.artists || [],
                    energy: intent?.energy || null,
                    targetCount: intent?.targetCount || targetCount,
                    familiarity: intent?.familiarity || null,
                    popularity: intent?.popularity || null,
                    diversity: intent?.diversity || null
                },
                items,
                diagnostics: {
                    strategy: meta?.strategy || strategy,
                    candidateCount: meta?.candidateCount || 0,
                    fallbackTier: meta?.fallbackTier || null,
                    elapsedMs,
                    useLLMRequested,
                    useLLMApplied,
                    llmUnavailableReason,
                    warnings: warnings || []
                }
            }
        });

    } catch (error) {
        console.error('Error in Admin AI Playlist Test Preview:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo playlist thử nghiệm'
        });
    }
};
