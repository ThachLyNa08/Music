const axios = require('axios');

// Tìm trang Wikipedia dựa trên tên nghệ sĩ
async function searchWikipedia(artistName, lang = 'vi') {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php`;
    const response = await axios.get(url, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: artistName,
        utf8: 1,
        format: 'json'
      },
      timeout: 8000
    });

    if (response.data && response.data.query && response.data.query.search) {
      return response.data.query.search;
    }
    return [];
  } catch (error) {
    console.error(`[Wikipedia] Lỗi tìm kiếm ${artistName} (${lang}):`, error.message);
    return [];
  }
}

// Lấy extract (đoạn tóm tắt) của một trang bằng pageid
async function getWikipediaExtract(pageId, lang = 'vi') {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php`;
    const response = await axios.get(url, {
      params: {
        action: 'query',
        prop: 'extracts|info',
        pageids: pageId,
        exintro: 1,
        explaintext: 1,
        inprop: 'url',
        format: 'json'
      },
      timeout: 8000
    });

    if (response.data && response.data.query && response.data.query.pages) {
      const page = response.data.query.pages[pageId];
      if (page) {
        return {
          extract: page.extract || '',
          url: page.fullurl || `https://${lang}.wikipedia.org/?curid=${pageId}`
        };
      }
    }
    return null;
  } catch (error) {
    console.error(`[Wikipedia] Lỗi lấy extract pageId ${pageId} (${lang}):`, error.message);
    return null;
  }
}

// Heuristic: kiểm tra xem trang có liên quan đến âm nhạc không
function isMusicRelated(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const keywords = [
    'ca sĩ', 'nhạc sĩ', 'rapper', 'nghệ sĩ', 'nhóm nhạc', 'singer',
    'musician', 'band', 'artist', 'songwriter', 'vocalist', 'guitarist',
    'âm nhạc', 'music'
  ];
  return keywords.some(kw => lower.includes(kw));
}

// Làm sạch và chuẩn hóa bio
function normalizeArtistBio(rawBio) {
  if (!rawBio) return '';
  // Xóa các khoảng trắng dư thừa
  let clean = rawBio.replace(/\s+/g, ' ').trim();
  // Giới hạn độ dài tối đa (khoảng 1500 ký tự)
  if (clean.length > 1500) {
    clean = clean.substring(0, 1500) + '...';
  }
  return clean;
}

// Rút gọn bio (short_bio)
function buildShortBio(normalizedBio) {
  if (!normalizedBio) return '';
  // Lấy 2 câu đầu tiên hoặc giới hạn ~300 ký tự
  const sentences = normalizedBio.split(/(?<=[.!?])\s+/);
  let short = sentences.slice(0, 2).join(' ').trim();
  if (short.length > 300) {
    short = short.substring(0, 297) + '...';
  }
  return short;
}

// Lấy thông tin bio từ Wikipedia với fallback ngôn ngữ
async function fetchWikipediaArtistBio(artistName) {
  const langs = ['vi', 'en'];

  for (const lang of langs) {
    const results = await searchWikipedia(artistName, lang);
    if (results.length > 0) {
      // Ưu tiên kết quả đầu tiên (hoặc tìm kết quả match hoàn toàn tên)
      for (const item of results.slice(0, 3)) {
        // Có thể check title match
        const pageData = await getWikipediaExtract(item.pageid, lang);
        if (pageData && pageData.extract) {
          // Kiểm tra xem đoạn extract có liên quan đến âm nhạc không
          if (isMusicRelated(pageData.extract) || isMusicRelated(item.snippet)) {
            const bio = normalizeArtistBio(pageData.extract);
            // Nếu độ dài < 80 ký tự thì bỏ qua
            if (bio.length >= 80) {
              const shortBio = buildShortBio(bio);
              return {
                bio,
                shortBio,
                sourceUrl: pageData.url,
                source: 'wikipedia'
              };
            }
          }
        }
      }
    }
  }
  return null;
}

module.exports = {
  fetchWikipediaArtistBio,
  normalizeArtistBio,
  buildShortBio
};
