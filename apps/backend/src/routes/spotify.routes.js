const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const spotifyController = require('../controllers/spotify.controller');
const { authenticate } = require('../middleware/auth.middleware');

const spotifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(spotifyLimiter);

router.get('/search', spotifyController.searchSpotify);

router.use(authenticate);

router.get('/authorize', spotifyController.getAuthorizeUrl);
router.post('/callback', spotifyController.handleCallback);
router.get('/status', spotifyController.getStatus);
router.get('/player-token', spotifyController.getPlaybackToken);
router.get('/playlists/:id', spotifyController.getPlaylist);
router.delete('/disconnect', spotifyController.disconnect);

module.exports = router;
