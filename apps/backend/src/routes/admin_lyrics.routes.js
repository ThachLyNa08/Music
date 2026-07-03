const express = require('express');
const router = express.Router();
const adminLyricsController = require('../controllers/admin_lyrics.controller');

// IMPORTANT: Specific paths must come BEFORE parameterized paths like /:songId
router.get('/summary', adminLyricsController.getSummary);
router.get('/backlog/export', adminLyricsController.exportBacklog);
router.get('/audit/export', adminLyricsController.exportAudit);

// General paths
router.get('/export', adminLyricsController.exportLyrics);
router.get('/', adminLyricsController.getList);

// Parameterized paths
router.get('/:songId', adminLyricsController.getDetail);
router.put('/:songId', adminLyricsController.updateLyrics);

module.exports = router;
