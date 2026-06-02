const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const songController = require('../controllers/song.controller');
const { authenticate, requireAdmin, optionalAuthenticate } = require('../middleware/auth.middleware');

router.get('/search', optionalAuthenticate, songController.searchSongs);
router.get('/suggestions', songController.getSuggestions);
router.get('/', optionalAuthenticate, songController.getAllSongs);
router.get('/trending', optionalAuthenticate, songController.getTrendingSongs);
router.get('/liked', authenticate, songController.getLikedSongs);
router.get('/:id/auto-continue', optionalAuthenticate, songController.getAutoContinueSongs);
router.get('/:id/detail', optionalAuthenticate, songController.getSongDetail);
router.get('/:id/related', optionalAuthenticate, songController.getRelatedSongs);
router.post('/:id/like', authenticate, songController.likeSong);
router.delete('/:id/like', authenticate, songController.unlikeSong);
router.post('/:id/listen', authenticate, songController.recordListen);

// Admin only route for uploading songs securely
router.post('/upload', 
  authenticate, 
  requireAdmin, 
  upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), 
  songController.uploadSong
);

module.exports = router;
