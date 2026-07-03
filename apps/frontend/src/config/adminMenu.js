export const adminIssueRouteMap = {
  missing_audio: 'missing-audio',
  broken_audio_url: 'broken-audio',
  missing_cover: 'missing-cover',
  missing_lyrics: 'missing-lyrics',
  missing_synced_lyrics: 'missing-synced-lyrics',
  missing_features: 'missing-features',
  album_track_mismatch: 'album-track-mismatch',
  artist_without_song: 'artist-without-song',
  genre_without_song: 'genre-without-song',
  market_other: 'market-other',
}

export const adminIssueTypeMap = Object.fromEntries(
  Object.entries(adminIssueRouteMap).map(([type, routeType]) => [routeType, type])
)

export const adminMenu = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: 'dashboard',
    role: 'admin',
    children: [
      { key: 'dashboard', label: 'Dashboard', icon: 'monitoring', route: { name: 'AdminDashboard' }, role: 'admin' },
    ],
  },
  {
    key: 'music-library',
    label: 'Thư viện nhạc',
    icon: 'library_music',
    role: 'admin',
    children: [
      { key: 'songs', label: 'Bài hát', icon: 'music_note', route: { name: 'AdminSongs' }, role: 'admin' },
      { key: 'lyrics', label: 'Lời bài hát', icon: 'lyrics', route: { name: 'AdminLyrics' }, role: 'admin' },
      { key: 'artists', label: 'Nghệ sĩ', icon: 'person', route: { name: 'AdminArtists' }, role: 'admin' },
      { key: 'albums', label: 'Album', icon: 'album', route: { name: 'AdminAlbums' }, role: 'admin' },
      { key: 'genres', label: 'Thể loại', icon: 'category', route: { name: 'AdminGenres' }, role: 'admin' },
    ],
  },
  {
    key: 'maintenance',
    label: 'Import & Bảo trì',
    icon: 'construction',
    role: 'admin',
    children: [
      { key: 'system-playlists', label: 'Giám sát playlist hệ thống', icon: 'queue_music', route: { name: 'AdminSystemPlaylists' }, role: 'admin' },
      { key: 'import-csv', label: 'Import CSV', icon: 'upload_file', route: { name: 'AdminImport' }, role: 'admin', hidden: true },
      { key: 'music-data-tools', label: 'Music Data Tools', icon: 'build_circle', route: { name: 'AdminMusicDataTools' }, role: 'admin' },
      { key: 'export-report', label: 'Export report', icon: 'download', route: { name: 'AdminExportReport' }, role: 'admin', hidden: true },
    ],
  },
  {
    key: 'ai-recommendation',
    label: 'AI & Recommendation',
    icon: 'auto_awesome',
    role: 'admin',
    children: [
      { key: 'recommendation', label: 'Recommendation', icon: 'recommend', route: { name: 'AdminRecommendation' }, role: 'admin' },
      { key: 'ai-playlist-test', label: 'AI Playlist Test', icon: 'playlist_add_check', route: { name: 'AdminAiPlaylistTest' }, role: 'admin' },
      { key: 'model-logs', label: 'Model logs', icon: 'receipt_long', route: { name: 'AdminModelLogs' }, role: 'admin', hidden: true },
      { key: 'retrain', label: 'Retrain', icon: 'model_training', route: { name: 'AdminRetrain' }, role: 'admin', hidden: true },
    ],
  },
  {
    key: 'users-premium',
    label: 'Người dùng & Premium',
    icon: 'groups',
    role: 'admin',
    children: [
      { key: 'users', label: 'Người dùng', icon: 'manage_accounts', route: { name: 'AdminUsers' }, role: 'admin' },
      { key: 'premium', label: 'Premium', icon: 'workspace_premium', route: { name: 'AdminPremium' }, role: 'admin' },
      { key: 'payments', label: 'Giao dịch', icon: 'payments', route: { name: 'AdminPayments' }, role: 'admin' },
    ],
  },
  {
    key: 'operations',
    label: 'Vận hành',
    icon: 'settings',
    role: 'admin',
    children: [
      { key: 'stem-jobs', label: 'Stem jobs', icon: 'graphic_eq', route: { name: 'AdminStemJobs' }, role: 'admin' },
      { key: 'audit-log', label: 'Audit log', icon: 'policy', route: { name: 'AdminAuditLog' }, role: 'admin', hidden: true },
      { key: 'system-logs', label: 'System logs', icon: 'terminal', route: { name: 'AdminSystemLogs' }, role: 'admin', hidden: true },
    ],
  },
]

export function findAdminMenuItemByRouteName(routeName) {
  for (const group of adminMenu) {
    const child = group.children?.find(item => item.route?.name === routeName)
    if (child) return { group, item: child }
  }
  return null
}
