const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlist.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { assertCanEditPlaylist, assertCanDeletePlaylist } = require('../middleware/playlist.middleware');
const upload = require('../middleware/upload.middleware');

// Public route (optional auth to check privacy)
// We use a custom auth middleware here or just handle token safely inside controller
router.get('/:id', function(req, res, next) {
  // Optional auth
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch(e) {}
  }
  next();
}, playlistController.getPlaylistDetail);

// Protected routes
router.use(authenticate);
router.get('/', playlistController.getMyPlaylists);
router.post('/', upload.fields([{ name: 'cover', maxCount: 1 }]), playlistController.createPlaylist);

// Save / Unsave system playlist
router.post('/:id/save', playlistController.savePlaylistToLibrary);
router.delete('/:id/save', playlistController.removeSavedPlaylistFromLibrary);

// Playlist modifications
router.patch('/:id', assertCanEditPlaylist, upload.fields([{ name: 'cover', maxCount: 1 }]), playlistController.updatePlaylist);
router.delete('/:id', assertCanDeletePlaylist, playlistController.deletePlaylist);
router.patch('/:id/songs/reorder', assertCanEditPlaylist, playlistController.reorderPlaylistSongs);
router.post('/:id/songs', assertCanEditPlaylist, playlistController.addSongToPlaylist);
router.delete('/:id/songs/:song_id', assertCanEditPlaylist, playlistController.removeSongFromPlaylist);
router.post('/:id/clone', playlistController.clonePlaylist);

module.exports = router;
