const intentService = require('../services/aiPlaylistIntent.service');
const aiPlaylistService = require('../services/aiPlaylist.service');
const quotaService = require('../services/aiPlaylistQuota.service');
const { clearPlaylistCache } = require('./playlist.controller');

exports.getQuota = async (req, res) => {
    try {
        const quota = await quotaService.getQuotaStatus(req.user.id);
        res.json({ success: true, quota });
    } catch (error) {
        console.error('getQuota Error:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi lấy thông tin quota' });
    }
};

function parseUseLLM(value) {
    if (value === undefined || value === null) return true;
    return value === true || value === 'true';
}

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null) return defaultValue;
    return value === true || value === 'true' || value === 1 || value === '1';
}

exports.previewIntent = async (req, res) => {
    try {
        const { prompt, targetCount, useLLM = true } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập prompt hợp lệ' });
        }

        const intent = await intentService.normalizeAiPlaylistIntent({
            prompt,
            targetCount,
            userId: req.user?.id,
            useLLM: parseUseLLM(useLLM)
        });

        return res.json({ success: true, intent });
    } catch (error) {
        console.error('previewIntent Error:', error);
        return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi phân tích intent AI Playlist' });
    }
};

exports.previewPlaylist = async (req, res) => {
    try {
        const {
            prompt,
            targetCount = parseInt(process.env.AI_PLAYLIST_DEFAULT_SONGS || '20', 10),
            useLLM = true,
            allowExpandedResults = false,
            expandResults = false,
            previousSongIds = []
        } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập prompt hợp lệ' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const quotaBefore = await quotaService.getQuotaStatus(userId);

        if (!quotaBefore.isPremium && quotaBefore.remaining <= 0) {
            return res.status(429).json({
                success: false,
                code: 'AI_PLAYLIST_DAILY_LIMIT_REACHED',
                message: 'Bạn đã dùng hết 3 lượt tạo AI Playlist miễn phí hôm nay. Nâng cấp Premium để tạo không giới hạn hoặc quay lại vào ngày mai.',
                quota: quotaBefore
            });
        }

        const preview = await aiPlaylistService.previewAiPlaylist({
            prompt,
            targetCount,
            userId,
            useLLM: parseUseLLM(useLLM),
            allowExpandedResults: parseBoolean(allowExpandedResults) || parseBoolean(expandResults),
            previousSongIds,
            avoidPreviousSongs: Array.isArray(previousSongIds) && previousSongIds.length > 0,
            req
        });

        if (!preview?.songs?.length) {
            const historyId = await aiPlaylistService.recordFailedGeneration({
                userId,
                prompt,
                targetCount,
                provider: parseUseLLM(useLLM) ? 'llm' : 'taxonomy',
                errorMessage: preview?.message || 'Không tìm được bài hát phù hợp với yêu cầu này.'
            });

            return res.json({
                ...preview,
                history_id: historyId,
                historyId,
                quota: quotaBefore
            });
        }

        const quotaAfter = await quotaService.consumeQuota(userId);
        const historyId = await aiPlaylistService.recordPreviewGeneration({
            userId,
            prompt,
            targetCount,
            preview,
            useLLM: parseUseLLM(useLLM)
        });

        return res.json({
            ...preview,
            history_id: historyId,
            historyId,
            quota: quotaAfter
        });
    } catch (error) {
        console.error('previewPlaylist Error:', error);
        
        if (error.code === 'AI_PLAYLIST_DAILY_LIMIT_REACHED') {
            return res.status(429).json({
                success: false,
                code: error.code,
                message: error.message,
                quota: error.quota
            });
        }

        if (req.user?.id && req.body?.prompt) {
            try {
                await aiPlaylistService.recordFailedGeneration({
                    userId: req.user.id,
                    prompt: req.body.prompt,
                    targetCount: req.body.targetCount || parseInt(process.env.AI_PLAYLIST_DEFAULT_SONGS || '20', 10),
                    provider: parseUseLLM(req.body.useLLM) ? 'llm' : 'taxonomy',
                    errorMessage: error.message || 'Không tìm được bài hát phù hợp với yêu cầu này.'
                });
            } catch (historyError) {
                console.warn('Failed to record AI playlist failed history:', historyError.message);
            }
        }

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Có lỗi xảy ra khi tạo playlist AI'
        });
    }
};

exports.refinePlaylist = async (req, res) => {
    try {
        const {
            originalPrompt = '',
            refinePrompt,
            previousIntent,
            previousSongIds = [],
            targetCount = parseInt(process.env.AI_PLAYLIST_DEFAULT_SONGS || '20', 10),
            useLLM = true,
            allowExpandedResults = false,
            expandResults = false
        } = req.body;

        const result = await aiPlaylistService.refineAiPlaylist({
            originalPrompt,
            refinePrompt,
            previousIntent,
            previousSongIds,
            targetCount,
            userId: req.user?.id || null,
            useLLM: parseUseLLM(useLLM),
            allowExpandedResults: parseBoolean(allowExpandedResults) || parseBoolean(expandResults),
            req
        });

        return res.json(result);
    } catch (error) {
        console.error('refinePlaylist Error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Có lỗi xảy ra khi tinh chỉnh AI Playlist'
        });
    }
};

exports.savePlaylist = async (req, res) => {
    try {
        const result = await aiPlaylistService.saveAiPlaylist({
            userId: req.user.id,
            name: req.body.name,
            description: req.body.description,
            sourcePrompt: req.body.sourcePrompt || req.body.prompt,
            intent: req.body.intent,
            songIds: req.body.songIds,
            visibility: req.body.visibility || 'private',
            historyId: req.body.history_id || req.body.historyId || null,
            req
        });
        clearPlaylistCache(req.user.id);

        return res.status(201).json({
            ...result,
            playlistId: result.playlist.id
        });
    } catch (error) {
        console.error('savePlaylist Error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Lỗi khi lưu playlist AI'
        });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const items = await aiPlaylistService.listGenerationHistory({
            userId: req.user.id,
            limit: req.query.limit || 10,
            req
        });

        return res.json({ success: true, items });
    } catch (error) {
        console.error('getHistory Error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Không thể lấy lịch sử AI Playlist'
        });
    }
};

exports.getHistoryDetail = async (req, res) => {
    try {
        const item = await aiPlaylistService.getGenerationHistoryDetail({
            userId: req.user.id,
            historyId: req.params.id,
            req
        });

        return res.json({ success: true, item });
    } catch (error) {
        console.error('getHistoryDetail Error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Không thể xem lại preview AI Playlist'
        });
    }
};

exports.saveHistory = async (req, res) => {
    try {
        const result = await aiPlaylistService.saveGenerationHistory({
            userId: req.user.id,
            historyId: req.params.id,
            visibility: req.body.visibility || 'private',
            req
        });
        clearPlaylistCache(req.user.id);

        return res.status(201).json(result);
    } catch (error) {
        console.error('saveHistory Error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code,
            message: error.code === 'PREVIEW_SNAPSHOT_EXPIRED'
                ? 'Một số bài hát trong preview cũ không còn khả dụng. Vui lòng dùng lại prompt để tạo preview mới.'
                : (error.message || 'Không thể lưu playlist từ preview cũ')
        });
    }
};

exports.getSuggestions = async (req, res) => {
    res.json({
        success: true,
        data: [
            'Nhạc Việt buồn nhẹ nghe buổi tối',
            'Kpop nhẹ nhàng để học bài',
            'USUK R&B đêm khuya',
            'Nhạc tập gym thật cháy',
            'Nhạc chill uống cà phê',
            'Nhạc trẻ trẻ nhưng không quá ồn',
            'Nhạc buồn nhưng đừng quá thảm',
            'Nhạc hoài niệm có chiều sâu',
            'Nhạc tập trung chạy deadline',
            'Nhạc tình yêu ngọt ngào'
        ]
    });
};
