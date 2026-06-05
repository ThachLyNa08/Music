const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artist.controller');

const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');

router.get('/', artistController.getAllArtists);
router.get('/:id', optionalAuthenticate, artistController.getArtistById);

// Các route cần auth
router.post('/:id/follow', authenticate, artistController.followArtist);
router.delete('/:id/follow', authenticate, artistController.unfollowArtist);

module.exports = router;
