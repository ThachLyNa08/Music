const PERSONALIZED_SYSTEM_PLAYLISTS = [
  {
    system_key: 'dailymix_01',
    name: 'Daily Mix 01',
    coverBaseName: 'dailymix_01',
    description: 'Playlist ca nhan hoa dua tren thoi quen nghe nhac cua ban'
  },
  {
    system_key: 'dailymix_02',
    name: 'Daily Mix 02',
    coverBaseName: 'dailymix_02',
    description: 'Playlist ca nhan hoa dua tren thoi quen nghe nhac cua ban'
  },
  {
    system_key: 'dailymix_03',
    name: 'Daily Mix 03',
    coverBaseName: 'dailymix_03',
    description: 'Playlist ca nhan hoa dua tren thoi quen nghe nhac cua ban'
  },
  {
    system_key: 'dailymix_04',
    name: 'Daily Mix 04',
    coverBaseName: 'dailymix_04',
    description: 'Playlist ca nhan hoa dua tren thoi quen nghe nhac cua ban'
  },
  {
    system_key: 'dailymix_05',
    name: 'Daily Mix 05',
    coverBaseName: 'dailymix_05',
    description: 'Playlist ca nhan hoa dua tren thoi quen nghe nhac cua ban'
  },
  {
    system_key: 'dailymix_06',
    name: 'Daily Mix 06',
    coverBaseName: 'dailymix_06',
    description: 'Playlist ca nhan hoa dua tren thoi quen nghe nhac cua ban'
  },
  {
    system_key: 'weekly_mix',
    name: 'Weekly Mix',
    coverBaseName: 'weeklymix',
    description: 'Tong hop am nhac phu hop voi ban trong tuan'
  },
  {
    system_key: 'morning_vibes',
    name: 'Morning Vibes',
    coverBaseName: 'Morning_Vibes',
    description: 'Những gợi ý phù hợp để khởi động ngày mới.'
  },
  {
    system_key: 'afternoon_vibes',
    name: 'Afternoon Vibes',
    coverBaseName: 'afternoon_vibes',
    description: 'Những bài hát có năng lượng phù hợp cho buổi chiều.'
  },
  {
    system_key: 'evening_vibes',
    name: 'Evening Vibes',
    coverBaseName: 'evening_vibes',
    description: 'Những gợi ý nhẹ nhàng cho khoảng thời gian cuối ngày.'
  },
  {
    system_key: 'night_vibes',
    name: 'Night Vibes',
    coverBaseName: 'Night_Vibes',
    description: 'Những bài hát phù hợp để thư giãn về đêm.'
  },
  {
    system_key: 'moodmix',
    name: 'Mood Mix',
    coverBaseName: 'moodmix',
    description: 'Âm nhạc phù hợp với tâm trạng của bạn'
  },
  {
    system_key: 'favorite_songs',
    name: 'Favorite Songs',
    coverBaseName: 'Favorite_Songs',
    description: 'Nhung bai hat ban da yeu thich'
  },
  {
    system_key: 'recently_played',
    name: 'Recently Played',
    coverBaseName: 'Recently_Played',
    description: 'Tiep tuc nghe nhung gi ban vua phat'
  },
  {
    system_key: 'top_tracks',
    name: 'Top Tracks',
    coverBaseName: 'top_tracks',
    description: 'Nhung bai hat ban nghe nhieu nhat'
  }
];

const OPTIONAL_SYSTEM_PLAYLISTS = [
  {
    system_key: 'genre_deep_dive',
    name: 'Genre Deep Dive',
    coverBaseName: 'genre_deep_dive',
    description: 'Kham pha sau hon cac the loai am nhac ban yeu thich'
  }
];

const GLOBAL_SYSTEM_PLAYLISTS = [
  {
    system_key: 'trending_now',
    name: 'Trending Now',
    coverBaseName: 'Trending_Now',
    description: 'Nhung bai hat dang thinh hanh'
  }
];

const MADE_FOR_YOU_ORDER = [
  'weekly_mix',
  'dailymix_01',
  'dailymix_02',
  'dailymix_03',
  'dailymix_04',
  'dailymix_05',
  'dailymix_06',
  'moodmix'
];

const RECOMMENDED_TODAY_ORDER = [
  'morning_vibes',
  'afternoon_vibes',
  'evening_vibes',
  'night_vibes',
  'moodmix',
  'favorite_songs',
  'trending_now',
  'recently_played',
  'top_tracks'
];

const ALL_SYSTEM_PLAYLISTS = [
  ...PERSONALIZED_SYSTEM_PLAYLISTS,
  ...GLOBAL_SYSTEM_PLAYLISTS,
  ...OPTIONAL_SYSTEM_PLAYLISTS
];

const VALID_SYSTEM_KEYS = ALL_SYSTEM_PLAYLISTS.map(playlist => playlist.system_key);

const SYSTEM_PLAYLIST_BY_KEY = ALL_SYSTEM_PLAYLISTS.reduce((map, playlist) => {
  map[playlist.system_key] = playlist;
  return map;
}, {});

module.exports = {
  PERSONALIZED_SYSTEM_PLAYLISTS,
  GLOBAL_SYSTEM_PLAYLISTS,
  OPTIONAL_SYSTEM_PLAYLISTS,
  ALL_SYSTEM_PLAYLISTS,
  VALID_SYSTEM_KEYS,
  SYSTEM_PLAYLIST_BY_KEY,
  MADE_FOR_YOU_ORDER,
  RECOMMENDED_TODAY_ORDER
};
