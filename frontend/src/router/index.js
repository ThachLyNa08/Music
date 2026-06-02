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
      { path: 'profile', name: 'Profile', component: () => import('@/views/profile/ProfileView.vue') },
      { path: 'profile/top-tracks', name: 'ProfileTopTracks', component: () => import('@/views/profile/TopTracksMonthView.vue') },
      { path: 'profile/top-artists', name: 'ProfileTopArtists', component: () => import('@/views/profile/TopArtistsMonthView.vue') },
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

  // Admin Panel
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'AdminDashboard', component: () => import('@/views/admin/AdminDashboard.vue') },
      { path: 'upload', name: 'AdminUpload', component: () => import('@/views/admin/UploadSongView.vue') },
      { path: 'songs', name: 'AdminSongs', component: () => import('@/views/admin/ManageSongs.vue') },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/ManageUsers.vue') },
      {
        path: 'artists',
        name: 'manage-artists',
        component: () => import('@/views/admin/ManageArtists.vue')
      },
      { path: 'transactions', name: 'AdminTransactions', component: () => import('@/views/admin/ManageTransactions.vue') },
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

  // Song detail page is publicly accessible
  if (to.name === 'SongDetail') {
    return // Allow access without auth
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'

  // Nếu đã đăng nhập và là admin, cưỡng chế chuyển hướng vào admin panel
  if (auth.isLoggedIn && auth.isAdmin) {
    // Cho phép logout/callback đi qua, các route khác chuyển về /admin
    if (to.path !== '/login' && !to.meta.requiresAdmin && to.name !== 'SpotifyCallback') {
      return '/admin'
    }
  }

  if (to.meta.guest && auth.isLoggedIn) return '/'
  if (to.meta.requiresAdmin && !auth.isAdmin) return '/'
})

export default router
