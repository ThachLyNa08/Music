const aiAssistantService = require('../services/aiAssistant.service');

exports.musicAssistant = async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required',
      });
    }

    const data = await aiAssistantService.getMusicAssistantResult({
      prompt,
      autoPlay: Boolean(req.body?.autoPlay),
      source: req.body?.source || 'search_bar',
      currentSongId: req.body?.currentSongId || null,
      userId: req.user?.id || null,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
