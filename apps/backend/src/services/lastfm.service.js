const axios = require('axios');
const { normalizeArtistBio, buildShortBio } = require('./wikipedia.service');

// Lấy thông tin bio từ Last.fm
async function fetchLastfmArtistBio(artistName) {
  const apiKey = process.env.LASTFM_API_KEY;
  const baseUrl = process.env.LASTFM_API_BASE_URL || 'https://ws.audioscrobbler.com/2.0/';

  if (!apiKey) {
    // Bỏ qua nếu không cấu hình API Key
    return null;
  }

  try {
    const response = await axios.get(baseUrl, {
      params: {
        method: 'artist.getinfo',
        artist: artistName,
        api_key: apiKey,
        format: 'json'
      },
      timeout: 8000
    });

    if (response.data && response.data.artist) {
      const artist = response.data.artist;
      let rawContent = artist.bio && artist.bio.content ? artist.bio.content : '';
      
      // Loại bỏ "Read more on Last.fm" hoặc các link HTML
      rawContent = rawContent.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1'); // Xóa thẻ a, giữ lại text
      // Xóa tag HTML khác nếu có
      rawContent = rawContent.replace(/<[^>]+>/g, '');
      // Xóa cụm "Read more on Last.fm"
      rawContent = rawContent.replace(/Read more on Last\.fm.*/gi, '');

      const bio = normalizeArtistBio(rawContent);

      if (bio.length >= 80) {
        return {
          bio,
          shortBio: buildShortBio(bio),
          sourceUrl: artist.url || `https://www.last.fm/music/${encodeURIComponent(artistName)}`,
          source: 'lastfm'
        };
      }
    }
    return null;
  } catch (error) {
    console.error(`[Last.fm] Lỗi lấy bio cho ${artistName}:`, error.message);
    return null;
  }
}

module.exports = {
  fetchLastfmArtistBio
};
