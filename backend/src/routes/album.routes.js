const express = require('express');
const router = express.Router();
const albumController = require('../controllers/album.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');

router.get('/:id', optionalAuthenticate, albumController.getAlbumDetails);
router.post('/:id/library', authenticate, albumController.addToLibrary);
router.delete('/:id/library', authenticate, albumController.removeFromLibrary);

module.exports = router;