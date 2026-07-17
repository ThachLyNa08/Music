const intentService = require('../services/aiPlaylistIntent.service');
const aiPlaylistService = require('../services/aiPlaylist.service');
const quotaService = require('../services/aiPlaylistQuota.service');

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
    return value === true || value === 'true';
}

exports.previewIntent = async (req, res) => {
    try {
        const { prompt, targetCount, useLLM = false } = req.body;

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
            useLLM = false,
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
            previousSongIds,
            avoidPreviousSongs: Array.isArray(previousSongIds) && previousSongIds.length > 0,
            req
        });

        if (!preview?.songs?.length) {
            return res.json({
                ...preview,
                quota: quotaBefore
            });
        }

        const quotaAfter = await quotaService.consumeQuota(userId);

        return res.json({
            ...preview,
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
            useLLM = false
        } = req.body;

        const result = await aiPlaylistService.refineAiPlaylist({
            originalPrompt,
            refinePrompt,
            previousIntent,
            previousSongIds,
            targetCount,
            userId: req.user?.id || null,
            useLLM: parseUseLLM(useLLM),
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
            req
        });

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
