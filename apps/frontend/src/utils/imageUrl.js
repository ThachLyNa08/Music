const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:3000'

export const DEFAULT_COVER = '/images/default-cover.svg'

export const DEFAULT_SPECIAL_COVERS = {
  charts: '/uploads/playlist_cover/charts.png',
  library: '/uploads/playlist_cover/library.png',
  topArtists: '/uploads/playlist_cover/top_artists.png',
  followedArtists: '/uploads/playlist_cover/followed_artists.png',
  topTracks: '/uploads/playlist_cover/top_tracks.png',
}

export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return DEFAULT_COVER
  }

  const clean = url.trim()

  if (
    !clean ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === '[object Object]'
  ) {
    return DEFAULT_COVER
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean
  }

  if (clean.startsWith('/uploads')) {
    return `${ASSET_BASE_URL}${clean}`
  }

  if (clean.startsWith('uploads')) {
    return `${ASSET_BASE_URL}/${clean}`
  }

  if (clean.startsWith('/images')) {
    return clean
  }

  if (clean.startsWith('images')) {
    return `/${clean}`
  }

  return clean
}

function getSongCover(song) {
  return (
    song?.cover_url ||
    song?.coverUrl ||
    song?.image_url ||
    song?.imageUrl ||
    song?.thumbnail_url ||
    song?.thumbnailUrl ||
    song?.album_cover ||
    song?.artwork_url ||
    song?.cover ||
    song?.image ||
    ''
  )
}

export const DEFAULT_PLAYLIST_COVER = '/images/default-cover.svg'

export function normalizeCoverUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  if (!clean || clean === 'null' || clean === 'undefined' || clean === 'N/A' || clean === '[object Object]') {
    return null;
  }
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean;
  }
  if (clean.startsWith('/uploads')) {
    return `${ASSET_BASE_URL}${clean}`;
  }
  if (clean.startsWith('uploads')) {
    return `${ASSET_BASE_URL}/${clean}`;
  }
  if (clean.startsWith('/images')) {
    return clean;
  }
  if (clean.startsWith('images')) {
    return `/${clean}`;
  }
  return clean;
}

export function getPlaylistCover(playlist) {
  if (!playlist) return null;

  if (playlist.cover_url) {
    const url = normalizeCoverUrl(playlist.cover_url);
    if (url) return url;
  }

  // 2. Nếu là system playlist nhưng thiếu cover_url (fallback dự phòng)
  const systemCovers = {
    dailymix_01: '/uploads/playlist_cover/dailymix_01.png',
    dailymix_02: '/uploads/playlist_cover/dailymix_02.png',
    dailymix_03: '/uploads/playlist_cover/dailymix_03.png',
    dailymix_04: '/uploads/playlist_cover/dailymix_04.png',
    dailymix_05: '/uploads/playlist_cover/dailymix_05.png',
    dailymix_06: '/uploads/playlist_cover/dailymix_06.png',
    weeklymix: '/uploads/playlist_cover/weeklymix.png',
    moodmix: '/uploads/playlist_cover/moodmix.png',
    favorite_songs: '/uploads/playlist_cover/Favorite_Songs.png',
    morning_vibes: '/uploads/playlist_cover/Morning_Vibes.png',
    afternoon_vibes: '/uploads/playlist_cover/afternoon_vibes.png',
    evening_vibes: '/uploads/playlist_cover/evening_vibes.png',
    night_vibes: '/uploads/playlist_cover/Night_Vibes.png',
    trending_now: '/uploads/playlist_cover/Trending_Now.png',
    recently_played: '/uploads/playlist_cover/Recently_Played.png'
  };

  if (playlist.system_key && systemCovers[playlist.system_key]) {
    return normalizeCoverUrl(systemCovers[playlist.system_key]);
  }

  // 3. Fallback lấy cover từ bài hát (user playlist)
  if (playlist.effective_cover_url) {
    const url = normalizeCoverUrl(playlist.effective_cover_url);
    if (url) return url;
  }
  
  if (playlist.first_song_cover_url) {
    const url = normalizeCoverUrl(playlist.first_song_cover_url);
    if (url) return url;
  }

  const songs = playlist?.songs || playlist?.tracks || playlist?.items || []
  const firstSongWithCover = Array.isArray(songs)
    ? songs.find(song => getSongCover(song))
    : null

  const raw =
    playlist?.coverUrl ||
    playlist?.image_url ||
    playlist?.imageUrl ||
    playlist?.thumbnail_url ||
    playlist?.thumbnailUrl ||
    playlist?.cover ||
    playlist?.image ||
    getSongCover(playlist?.song) ||
    getSongCover(firstSongWithCover)

  if (raw) {
    const url = normalizeCoverUrl(raw);
    if (url) return url;
  }

  return null;
}

export function getItemCover(item) {
  const firstSongWithCover = Array.isArray(item?.songs)
    ? item.songs.find(song => getSongCover(song))
    : null

  const raw =
    item?.cover_url ||
    item?.coverUrl ||
    item?.image_url ||
    item?.imageUrl ||
    item?.thumbnail_url ||
    item?.thumbnailUrl ||
    item?.album_cover ||
    item?.artwork_url ||
    item?.cover ||
    item?.image ||
    getSongCover(item?.song) ||
    getSongCover(firstSongWithCover) ||
    DEFAULT_COVER

  return normalizeImageUrl(raw)
}

// Alias to prevent import errors in components like HomeHero
export const normalizeAssetUrl = normalizeImageUrl;
