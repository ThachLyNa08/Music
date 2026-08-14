const express = require('express');
const router = express.Router();
const stemController = require('../controllers/stem.controller');
const { authenticate } = require('../middleware/auth.middleware');

function authenticateDownload(req, res, next) {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticate(req, res, next);
}

router.post('/songs/:songId/separate', authenticate, stemController.separateSong);
router.get('/songs/ready', authenticate, stemController.getReadySongs);
router.get('/songs/:songId/latest', authenticate, stemController.getLatestForSong);
router.get('/songs/:songId/download/instrumental', authenticateDownload, stemController.downloadSongInstrumental);
router.get('/jobs/:jobId', authenticate, stemController.getJob);
router.get('/jobs/:jobId/download/instrumental', authenticateDownload, stemController.downloadInstrumental);
router.patch('/internal/jobs/:jobId', stemController.updateJobFromAiService);

module.exports = router;
