const express = require('express');
const router = express.Router();
const artistStudioController = require('../controllers/artistStudio.controller');
const { authenticate, requireArtist } = require('../middleware/auth.middleware');

const upload = require('../middleware/upload.middleware');

router.use(authenticate, requireArtist);

router.get('/me', artistStudioController.getMe);
router.get('/dashboard', artistStudioController.getDashboard);
router.post('/change-password', artistStudioController.changePassword);

router.get('/profile', artistStudioController.getProfile);
router.put('/profile', artistStudioController.updateProfile);
router.post('/profile/avatar', upload.single('avatar'), artistStudioController.uploadAvatar);

router.get('/upload-options', artistStudioController.getUploadOptions);
router.get('/album-song-options', artistStudioController.getAlbumSongOptions);
router.get('/songs', artistStudioController.getSongs);
router.post('/songs', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), artistStudioController.uploadSong);
router.get('/songs/:id', artistStudioController.getSongDetail);

router.get('/albums', artistStudioController.getAlbums);
router.post('/albums', upload.single('cover'), artistStudioController.createAlbum);
router.get('/albums/:id', artistStudioController.getAlbumDetail);

router.post('/songs/:id/resubmit', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), artistStudioController.resubmitSong);
router.post('/albums/:id/resubmit', upload.single('cover'), artistStudioController.resubmitAlbum);

module.exports = router;
