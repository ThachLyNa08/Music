const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminGenreController = require('../controllers/admin_genre.controller');
const adminPremiumController = require('../controllers/admin_premium.controller');
const adminPaymentsController = require('../controllers/admin_payments.controller');
const adminRecommendationController = require('../controllers/admin_recommendation.controller');
const adminAiPlaylistTestController = require('../controllers/admin_ai_playlist_test.controller');
const adminStemJobsController = require('../controllers/admin_stem_jobs.controller');
const adminMusicDataToolsController = require('../controllers/admin_music_data_tools.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authenticate, requireAdmin);

// Admin Lyrics Management
const adminLyricsRoutes = require('./admin_lyrics.routes');
router.use('/lyrics', adminLyricsRoutes);
// Music Data Tools
router.get('/music-data-tools/summary', adminMusicDataToolsController.getSummary);
router.get('/music-data-tools/lyrics-backlog/export', adminMusicDataToolsController.exportLyricsBacklog);
router.get('/music-data-tools', adminMusicDataToolsController.getList);
router.get('/music-data-tools/:id', adminMusicDataToolsController.getDetail);
router.post('/music-data-tools/:id/fetch-cover', adminMusicDataToolsController.fetchCover);
router.post('/music-data-tools/:id/analyze-features', adminMusicDataToolsController.analyzeFeatures);
router.post('/music-data-tools/bulk/fetch-cover', adminMusicDataToolsController.bulkFetchCover);
router.post('/music-data-tools/bulk/analyze-features', adminMusicDataToolsController.bulkAnalyzeFeatures);

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
router.get('/system-playlists/system-keys', adminController.getSystemKeys);
router.get('/system-playlists', adminController.getSystemPlaylists);
router.get('/system-playlists/:id', adminController.getSystemPlaylistDetail);
router.post('/system-playlists/:id/regenerate', adminController.regenerateSystemPlaylist);
router.get('/ai-status', adminController.getAiStatus);

// Quản lý Recommendation
router.get('/recommendation/summary', adminRecommendationController.getSummary);
router.get('/recommendation/metrics', adminRecommendationController.getMetrics);
router.get('/recommendation/users/:id/preview', adminRecommendationController.previewRecommendations);

// AI Playlist Test
router.post('/ai-playlist-test/preview', adminAiPlaylistTestController.preview);

// Stem Jobs
router.get('/stem-jobs/summary', adminStemJobsController.getSummary);
router.get('/stem-jobs', adminStemJobsController.getJobs);
router.post('/stem-jobs/:id/retry', adminStemJobsController.retryJob);

// Quản lý người dùng
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id/playlists', adminController.getUserPlaylists);
router.get('/users/:id/engagement-summary', adminController.getEngagementSummary);
router.get('/users/:id/listening-heatmap', adminController.getListeningHeatmap);
router.get('/users/:id/recommendations', adminController.getUserRecommendations);
router.get('/users/:id/detail', adminController.getUserDetail);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id/premium', adminController.updateUserPremium);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Quản lý Premium
router.get('/premium/summary', adminPremiumController.getPremiumSummary);
router.get('/premium/users', adminPremiumController.getPremiumUsers);
router.get('/premium/plans', adminPremiumController.getPremiumPlans);
router.post('/premium/users/:id/update', adminPremiumController.updatePremium);
router.post('/premium/users/:id/cancel', adminPremiumController.cancelPremium);

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

// Quản lý giao dịch (Payments)
router.get('/payments/summary', adminPaymentsController.getPaymentSummary);
router.get('/payments', adminPaymentsController.getPayments);
router.get('/payments/:id', adminPaymentsController.getPaymentDetail);
router.post('/payments/:id/cancel', adminPaymentsController.cancelPayment);
// Backward compatibility cho /transactions (có thể gọi hàm getPayments)
router.get('/transactions', adminPaymentsController.getPayments);

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
router.get('/genres/summary', adminGenreController.getGenresSummary);
router.get('/genres/insights', adminGenreController.getGenresInsights);
router.patch('/genres/bulk-action', adminGenreController.bulkActionGenres);
router.post('/genres/merge', adminGenreController.mergeGenres);
router.post('/genres/bulk-assign', adminGenreController.bulkAssignGenre);
router.get('/genres/:id/songs', adminGenreController.getGenreSongs);
router.get('/genres/:id/detail', adminGenreController.getGenreDetailFull);
router.patch('/genres/:id/taxonomy-flags', adminGenreController.updateTaxonomyFlags);
router.get('/genres/:id', adminGenreController.getGenreDetail);
router.put('/genres/:id', upload.single('genre_cover'), adminGenreController.updateGenre);
router.delete('/genres/:id', adminGenreController.deleteGenre);
router.patch('/genres/:id/status', adminGenreController.updateGenreStatus);
router.patch('/genres/:id/featured', adminGenreController.updateGenreFeatured);
router.get('/genres', adminGenreController.getAllGenres);
router.post('/genres', upload.single('genre_cover'), adminGenreController.createGenre);

module.exports = router;
