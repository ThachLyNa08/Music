const fs = require('fs');
const path = require('path');
const { SYSTEM_PLAYLIST_BY_KEY } = require('../services/systemPlaylist.service');

const COVER_BASENAME_MAP = {
  dailymix_01: 'dailymix_01',
  dailymix_02: 'dailymix_02',
  dailymix_03: 'dailymix_03',
  dailymix_04: 'dailymix_04',
  dailymix_05: 'dailymix_05',
  dailymix_06: 'dailymix_06',
  weeklymix: 'weeklymix',
  moodmix: 'moodmix',
  favorite_songs: 'Favorite_Songs',
  morning_vibes: 'Morning_Vibes',
  night_vibes: 'Night_Vibes',
  trending_now: 'Trending_Now',
  recently_played: 'Recently_Played'
};

function resolvePlaylistCoverUrl(systemKey) {
  if (!systemKey) return null;

  const baseName = SYSTEM_PLAYLIST_BY_KEY[systemKey]?.coverBaseName || COVER_BASENAME_MAP[systemKey];
  if (!baseName) return null;

  const coverDir = path.join(__dirname, '..', '..', 'uploads', 'playlist_cover');

  if (!fs.existsSync(coverDir)) {
    console.warn('[playlistCover] Folder not found:', coverDir);
    return null;
  }

  const files = fs.readdirSync(coverDir);
  const matchedFile = files.find(file => {
    const parsed = path.parse(file);
    return parsed.name === baseName;
  });

  if (!matchedFile) {
    console.warn('[playlistCover] Cover not found for:', systemKey, baseName);
    return null;
  }

  return `/uploads/playlist_cover/${matchedFile}`;
}

module.exports = {
  resolvePlaylistCoverUrl
};
