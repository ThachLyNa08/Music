import { getImageUrl } from './imageUrl';

export function getPlaylistCover(playlist) {
  if (!playlist) return getImageUrl(null);

  // If the backend already provided a valid absolute URL or a specific /uploads path
  if (playlist.cover_url) {
    return getImageUrl(playlist.cover_url);
  }

  // System covers fallback mapping based on system_key
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
    return getImageUrl(systemCovers[playlist.system_key]);
  }

  // If it's a normal user playlist, use its effective cover or default
  if (playlist.effective_cover_url) {
    return getImageUrl(playlist.effective_cover_url);
  }

  // Default cover for any playlist
  return getImageUrl(null);
}
