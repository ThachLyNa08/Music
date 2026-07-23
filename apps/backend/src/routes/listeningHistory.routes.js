const express = require('express');
const router = express.Router();
const listeningHistoryController = require('../controllers/listeningHistory.controller');
const { optionalAuthenticate } = require('../middleware/auth.middleware');

// POST /api/listening-history/track
router.post('/track', optionalAuthenticate, listeningHistoryController.trackListening);

module.exports = router;
