const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const userController = require('../controllers/user.controller');

router.get('/me/stats', authenticate, userController.getProfileStats);
router.get('/me/profile', authenticate, userController.getFullProfile);
router.get('/me/followed-artists', authenticate, userController.getFollowedArtists);
router.put('/me/profile', authenticate, userController.updateProfile);
router.post('/me/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);
router.get('/me/recently-played', authenticate, userController.getRecentlyPlayed);
router.get('/:id/public-profile', authenticate, userController.getPublicProfile);

module.exports = router;
