const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authenticate, requireAdmin);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/listening-trends', adminController.getListeningTrends);

// Quản lý người dùng
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id/premium', adminController.updateUserPremium);

// Quản lý bài hát
router.get('/songs/groups/summary', adminController.getSongGroupsSummary);
router.get('/songs/statistics', adminController.getSongStatistics);
router.patch('/songs/bulk-status', adminController.bulkUpdateSongsStatus);
router.patch('/songs/bulk-market', adminController.bulkUpdateSongsMarket);
router.get('/songs/metadata-issues', adminController.getMetadataIssues);
router.get('/songs', adminController.getAllSongs);
router.put(
  '/songs/:id', 
  upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), 
  adminController.updateSong
);
router.delete('/songs/:id', adminController.deleteSong);

// Quản lý giao dịch
router.get('/transactions', adminController.getAllTransactions);

// Metadata cho Admin
router.get('/form-data', adminController.getFormData);

// Quản lý nghệ sĩ
router.get('/artists', adminController.getAllArtists);
router.get('/artists/:id', adminController.getArtistDetails);
router.post(
  '/artists',
  upload.single('avatar'),
  adminController.createArtist
);
router.put(
  '/artists/:id',
  upload.single('avatar'),
  adminController.updateArtist
);
// Đồng bộ nhạc
router.post('/sync-music', adminController.syncMusic);

module.exports = router;
