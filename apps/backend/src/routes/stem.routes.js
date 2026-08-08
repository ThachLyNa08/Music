const express = require('express');
const router = express.Router();
const stemController = require('../controllers/stem.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/songs/:songId/separate', authenticate, stemController.separateSong);
router.get('/songs/ready', authenticate, stemController.getReadySongs);
router.get('/songs/:songId/latest', authenticate, stemController.getLatestForSong);
router.get('/jobs/:jobId', authenticate, stemController.getJob);
router.get('/jobs/:jobId/download/instrumental', authenticate, stemController.downloadInstrumental);
router.patch('/internal/jobs/:jobId', stemController.updateJobFromAiService);

module.exports = router;
