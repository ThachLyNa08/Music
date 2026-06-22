const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminGenreController = require('../controllers/admin_genre.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authenticate, requireAdmin);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/dashboard/overview', adminController.getDashboardStats);
router.get('/dashboard/summary', adminController.getDashboardSummary);
router.get('/listening-trends', adminController.getListeningTrends);

router.get('/top-artists-trends', adminController.getTopArtistTrends);
router.get('/data-quality/summary', adminController.getDataQualitySummary);
router.get('/data-quality/issues', adminController.getDataQualityIssues);
router.get('/listening-analytics', adminController.getListeningAnalytics);
router.get('/system-playlists/summary', adminController.getSystemPlaylistsSummary);
router.post('/system-playlists/regenerate-all', adminController.regenerateAllSystemPlaylists);
router.get('/system-playlists', adminController.getSystemPlaylists);
router.get('/system-playlists/:id', adminController.getSystemPlaylistDetail);
router.post('/system-playlists/:id/regenerate', adminController.regenerateSystemPlaylist);
router.get('/ai-status', adminController.getAiStatus);

// Quản lý người dùng
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id/playlists', adminController.getUserPlaylists);
router.get('/users/:id/engagement-summary', adminController.getEngagementSummary);
router.get('/users/:id/listening-heatmap', adminController.getListeningHeatmap);
router.get('/users/:id/detail', adminController.getUserDetail);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id/premium', adminController.updateUserPremium);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Quản lý bài hát
router.get('/songs/groups/summary', adminController.getSongGroupsSummary);
router.get('/songs/statistics', adminController.getSongStatistics);
router.patch('/songs/bulk-status', adminController.bulkUpdateSongsStatus);
router.patch('/songs/bulk-market', adminController.bulkUpdateSongsMarket);
router.get('/songs/metadata-issues', adminController.getMetadataIssues);
router.get('/songs', adminController.getAllSongs);
router.get('/songs/:id/detail', adminController.getSongDetail);
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
// Quan ly album
router.get('/albums/form-data', adminController.getAdminAlbumFormData);
router.get('/albums/available-songs', adminController.getAvailableSongsForAlbum);
router.get('/albums/stats', adminController.getAdminAlbumsStats);
router.get('/albums', adminController.getAdminAlbums);
router.get('/albums/:id/detail', adminController.getAdminAlbumDetail);
router.post('/albums', upload.single('cover'), adminController.createAdminAlbum);
router.put('/albums/:id', upload.single('cover'), adminController.updateAdminAlbum);
router.put('/albums/:id/songs/reorder', adminController.reorderAdminAlbumSongs);
router.delete('/albums/:id', adminController.deleteAdminAlbum);

// Quan ly nghe si
router.get('/artists', adminController.getAllArtists);
router.post('/artists/sync-missing-metadata', adminController.syncMissingArtistMetadata);
router.post('/artists/sync-missing-bio', adminController.syncMissingArtistBio);
router.get('/artists/metadata-issues', adminController.getArtistMetadataIssues);
router.post('/artists/:id/sync-metadata', adminController.syncArtistMetadata);
router.post('/artists/:id/sync-bio', adminController.syncArtistBio);
router.get('/artists/:id/detail', adminController.getArtistDetailFull);
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
router.delete('/artists/:id', adminController.deleteArtist);
// Đồng bộ nhạc
router.post('/sync-music', adminController.syncMusic);

// Quản lý thể loại (Genres)
router.post('/genres/merge', adminGenreController.mergeGenres);
router.post('/genres/bulk-assign', adminGenreController.bulkAssignGenre);
router.get('/genres/:id/songs', adminGenreController.getGenreSongs);
router.get('/genres/:id', adminGenreController.getGenreDetail);
router.put('/genres/:id', upload.single('genre_cover'), adminGenreController.updateGenre);
router.delete('/genres/:id', adminGenreController.deleteGenre);
router.patch('/genres/:id/status', adminGenreController.updateGenreStatus);
router.patch('/genres/:id/featured', adminGenreController.updateGenreFeatured);
router.get('/genres', adminGenreController.getAllGenres);
router.post('/genres', upload.single('genre_cover'), adminGenreController.createGenre);

module.exports = router;
