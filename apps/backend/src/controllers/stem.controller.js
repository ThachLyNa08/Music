const path = require('path');
const stemService = require('../services/stem.service');

function sendError(res, err) {
  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Stem service error',
  });
}

exports.separateSong = async (req, res) => {
  try {
    const job = await stemService.requestSeparation(req.user, req.params.songId);
    return res.status(202).json({ success: true, data: job });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.getJob = async (req, res) => {
  try {
    const job = await stemService.getJobForUser(Number(req.params.jobId), req.user);
    if (!job) return res.status(404).json({ success: false, message: 'Khong tim thay stem job' });
    return res.json({ success: true, data: job });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.getLatestForSong = async (req, res) => {
  try {
    const songId = Number(req.params.songId);
    if (!Number.isInteger(songId) || songId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bai hat khong hop le' });
    }
    const job = await stemService.getLatestJob(req.user.id, songId);
    return res.json({ success: true, data: job });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.getReadySongs = async (req, res) => {
  try {
    const songs = await stemService.getReadyKaraokeSongs({
      limit: req.query.limit
    });
    return res.json({
      success: true,
      data: songs,
      meta: {
        total: songs.length,
        source: 'song_stems_completed'
      }
    });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.downloadInstrumental = async (req, res) => {
  try {
    const filePath = await stemService.getInstrumentalDownload(Number(req.params.jobId), req.user);
    return res.download(filePath, path.basename(filePath));
  } catch (err) {
    return sendError(res, err);
  }
};

exports.downloadSongInstrumental = async (req, res) => {
  try {
    const filePath = await stemService.getInstrumentalDownloadForSong(Number(req.params.songId), req.user);
    return res.download(filePath, path.basename(filePath));
  } catch (err) {
    return sendError(res, err);
  }
};

exports.updateJobFromAiService = async (req, res) => {
  try {
    const expectedToken = process.env.STEM_CALLBACK_TOKEN || process.env.JWT_SECRET || '';
    const providedToken = req.get('x-stem-callback-token') || req.body?.callback_token || '';
    if (!expectedToken || providedToken !== expectedToken) {
      return res.status(401).json({ success: false, message: 'Invalid stem callback token' });
    }

    const job = await stemService.updateJobStatus(Number(req.params.jobId), {
      status: req.body.status,
      progress: req.body.progress,
      vocals_url: req.body.vocals_url,
      instrumental_url: req.body.instrumental_url,
      error_message: req.body.error_message,
      heartbeat_at: req.body.heartbeat_at,
      locked_by: req.body.locked_by,
    });

    return res.json({ success: true, data: job });
  } catch (err) {
    return sendError(res, err);
  }
};
