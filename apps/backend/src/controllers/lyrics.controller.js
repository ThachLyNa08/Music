const lyricsService = require('../services/lyrics.service');

exports.getSongLyrics = async (req, res, next) => {
  try {
    const result = await lyricsService.getLyricsBySongId(req.params.songId, { publicOnly: true });
    res.status(result.error ? 404 : 200).json(result);
  } catch (err) {
    next(err);
  }
};
