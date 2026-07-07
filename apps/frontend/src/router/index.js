import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // Public landing
  { path: '/landing', name: 'Landing', component: () => import('@/views/landing/LandingView.vue') },
  { path: '/intro', redirect: '/landing' },

  // Auth
  { path: '/login',    name: 'Login',    component: () => import('@/views/auth/LoginView.vue'),    meta: { guest: true } },
  { path: '/register', name: 'Register', component: () => import('@/views/auth/RegisterView.vue'), meta: { guest: true } },
  { path: '/callback', name: 'SpotifyCallback', component: () => import('@/views/SpotifyCallback.vue'), meta: { requiresAuth: true } },

  // App (cần đăng nhập)
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '',        name: 'Home',    component: () => import('@/views/home/HomeView.vue') },
      { path: 'search',  name: 'Search',  component: () => import('@/views/search/SearchView.vue') },
      { path: 'library', name: 'Library', component: () => import('@/views/library/LibraryView.vue') },
      { path: 'playlist/:id', name: 'PlaylistDetail', component: () => import('@/views/library/PlaylistDetailView.vue') },
      { path: 'recommendations/for-you', name: 'RecommendationForYou', component: () => import('@/views/recommendation/ForYouRecommendationView.vue') },
      { path: 'profile', name: 'Profile', component: () => import('@/views/profile/ProfileView.vue') },
      { path: 'profile/top-tracks', name: 'ProfileTopTracks', component: () => import('@/views/profile/TopTracksMonthView.vue') },
      { path: 'profile/top-artists', name: 'ProfileTopArtists', component: () => import('@/views/profile/TopArtistsMonthView.vue') },
      { path: 'messages', name: 'Messages', component: () => import('@/views/messages/MessagesView.vue') },
      { path: 'users/:id', name: 'PublicUserProfile', component: () => import('@/views/user/PublicUserProfileView.vue') },
      { path: 'me/followed-artists', name: 'FollowedArtists', component: () => import('@/views/library/FollowedArtistsView.vue'), meta: { requiresAuth: true } },
      { path: 'ai', name: 'AIPlaylists', component: () => import('@/views/ai/AiPlaylistView.vue') },
      { path: 'karaoke', name: 'Karaoke', component: () => import('@/views/karaoke/KaraokeView.vue') },
      { path: 'premium', name: 'Premium', component: () => import('@/views/premium/PremiumView.vue') },
      { path: 'charts/:region', name: 'WeeklyChart', component: () => import('@/views/charts/WeeklyChartView.vue') },
      { path: 'liked-songs', name: 'LikedSongs', component: () => import('@/views/library/LikedSongsView.vue') },
      { path: 'song/:id', name: 'SongDetail', component: () => import('@/views/song/SongDetailView.vue') },
      { path: 'artist/:id', name: 'ArtistProfile', component: () => import('@/views/artist/ArtistView.vue') },
      { path: 'artist/:id/discography', name: 'ArtistDiscography', component: () => import('@/views/artist/ArtistDiscographyView.vue') },
      { path: 'album/:id', name: 'AlbumDetail', component: () => import('@/views/album/AlbumDetailView.vue') },
      { path: 'recently-played', name: 'RecentlyPlayed', component: () => import('@/views/library/RecentlyPlayedView.vue') },
    ]
  },

  // Admin Login
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/views/admin/AdminLoginView.vue'),
    meta: { guestAdmin: true }
  },

  // Admin Panel
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/admin/AdminDashboard.vue') },
      { path: 'upload', name: 'AdminUpload', component: () => import('@/views/admin/UploadSongView.vue') },
      { path: 'songs', name: 'AdminSongs', component: () => import('@/views/admin/ManageSongs.vue') },
      { path: 'songs/:id', name: 'AdminSongDetail', component: () => import('@/views/admin/AdminSongDetailView.vue') },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/ManageUsers.vue') },
      {
        path: 'artists',
        name: 'AdminArtists',
        component: () => import('@/views/admin/ManageArtists.vue')
      },
      { path: 'artists/:id/detail', name: 'AdminArtistDetail', component: () => import('@/views/admin/AdminArtistDetailView.vue') },
      { path: 'artists', name: 'manage-artists', redirect: '/admin/artists' },
      { path: 'albums', name: 'AdminAlbums', component: () => import('@/views/admin/AdminAlbumsView.vue') },
      { path: 'albums/:id/detail', name: 'AdminAlbumDetail', component: () => import('@/views/admin/AdminAlbumsView.vue') },
      { path: 'genres', name: 'AdminGenres', component: () => import('@/views/admin/ManageGenres.vue'), meta: { title: 'Thể loại', icon: 'category' } },
      { path: 'stem-jobs', name: 'AdminStemJobs', component: () => import('@/views/admin/AdminStemJobsView.vue'), meta: { title: 'Stem Jobs', icon: 'audio_file' } },
      { path: 'genres/:id', name: 'AdminGenreDetail', component: () => import('@/views/admin/GenreDetailPage.vue') },
      { path: 'playlists', name: 'AdminPlaylists', component: () => import('@/views/admin/AdminPlaylistsView.vue') },
      { path: 'system-playlists', name: 'AdminSystemPlaylists', component: () => import('@/views/admin/AdminSystemPlaylistsView.vue') },
      { path: 'analytics', name: 'AdminListeningAnalytics', component: () => import('@/views/admin/AdminListeningAnalyticsView.vue') },
      { path: 'data-quality', name: 'AdminDataQuality', component: () => import('@/views/admin/AdminDataQualityView.vue') },
      { path: 'data-quality/:type', name: 'AdminDataQualityType', component: () => import('@/views/admin/AdminDataQualityView.vue') },
      { path: 'import', name: 'AdminImport', component: () => import('@/views/admin/AdminPlaceholderView.vue'), meta: { title: 'Import CSV', icon: 'upload_file' } },
      { path: 'music-data-tools', name: 'AdminMusicDataTools', component: () => import('@/views/admin/MusicDataToolsView.vue'), meta: { title: 'Music Data Tools', icon: 'build_circle' } },
      { path: 'lyrics', name: 'AdminLyrics', component: () => import('@/views/admin/AdminLyricsView.vue'), meta: { title: 'Quản lý lyrics', icon: 'lyrics' } },
      { path: 'lyrics/:songId', name: 'AdminLyricsDetail', component: () => import('@/views/admin/AdminLyricsDetailView.vue'), meta: { title: 'Chi tiết lyrics', icon: 'lyrics' } },
      { path: 'maintenance/music-data-tools', redirect: '/admin/music-data-tools' },
      { path: 'maintenance/export-report', name: 'AdminExportReport', component: () => import('@/views/admin/AdminPlaceholderView.vue'), meta: { title: 'Export report', icon: 'download' } },
      { path: 'ai-recommendation', redirect: '/admin/recommendation' },
      { path: 'recommendation', name: 'AdminRecommendation', component: () => import('@/views/admin/AdminRecommendationView.vue') },
      { path: 'ai-playlist-test', name: 'AdminAiPlaylistTest', component: () => import('@/views/admin/AdminAiPlaylistTestView.vue'), meta: { title: 'AI Playlist Test', icon: 'playlist_add_check' } },
      { path: 'ai/model-logs', name: 'AdminModelLogs', component: () => import('@/views/admin/AdminPlaceholderView.vue'), meta: { title: 'Model logs', icon: 'receipt_long' } },
      { path: 'ai/retrain', name: 'AdminRetrain', component: () => import('@/views/admin/AdminPlaceholderView.vue'), meta: { title: 'Retrain', icon: 'model_training' } },
      { path: 'ai-status', name: 'AdminAiStatus', component: () => import('@/views/admin/AdminAiStatusView.vue') },
      { path: 'premium', name: 'AdminPremium', component: () => import('@/views/admin/AdminPremiumView.vue'), meta: { title: 'Premium', icon: 'workspace_premium' } },
      { path: 'payments', name: 'AdminPayments', component: () => import('@/views/admin/ManageTransactions.vue') },
      { path: 'transactions', redirect: '/admin/payments' },
      { path: 'audit-log', name: 'AdminAuditLog', component: () => import('@/views/admin/AdminPlaceholderView.vue'), meta: { title: 'Audit log', icon: 'policy' } },
      { path: 'system-logs', name: 'AdminSystemLogs', component: () => import('@/views/admin/AdminPlaceholderView.vue'), meta: { title: 'System logs', icon: 'terminal' } },
      { path: 'users/:id', name: 'admin-user-detail', component: () => import('@/views/admin/AdminUserDetailView.vue') },
    ]
  },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.isAuthenticated && !auth.user) {
    await auth.fetchMe()
  }

  // Song detail page is publicly accessible
  if (to.name === 'SongDetail') {
    return // Allow access without auth
  }

  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isGuestAdmin = to.matched.some(record => record.meta.guestAdmin)
  const isGuest = to.matched.some(record => record.meta.guest)

  // 1. Xử lý Admin Routes
  if (requiresAdmin) {
    if (!auth.isAuthenticated) return '/admin/login'
    if (auth.userRole !== 'admin') return '/admin/login'
  }

  // 2. Xử lý trang Admin Login
  if (isGuestAdmin) {
    if (auth.isAuthenticated && auth.userRole === 'admin') return '/admin/dashboard'
  }

  // 3. Xử lý User Routes (yêu cầu login)
  if (requiresAuth && !requiresAdmin) {
    if (!auth.isAuthenticated) return '/login'
  }

  // 4. Xử lý trang Login/Register của User
  if (isGuest && auth.isAuthenticated) {
    if (auth.userRole === 'admin') return '/admin/dashboard'
    return '/'
  }
})

export default router
