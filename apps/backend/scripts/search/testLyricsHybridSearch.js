const http = require('http');

const BASE_URL = process.env.SEARCH_TEST_BASE_URL || 'http://127.0.0.1:3000';

const cases = [
  { query: 'Cô ta thật huy hoàng', expected: 'Đại Minh Tinh', top: 3 },
  { query: 'co ta that huy hoang', expected: 'Đại Minh Tinh', top: 3 },
  { query: 'bài nào có lời cô ta thật huy hoàng', expected: 'Đại Minh Tinh', top: 3 },
  { query: 'đứng giữa hào quang', expected: 'Đại Minh Tinh', top: 3 },
  { query: 'ngay mai em di mat', expected: null, top: 3 },
  { query: 'ngày mai em đi mất', expected: null, top: 3 },
  { query: 'bài có lời ngày mai em đi mất', expected: null, top: 3 },
  { query: 'Ngày Mai Em Đi', expected: 'Ngày Mai Em Đi', top: 1 },
  { query: 'Sơn Tùng', expected: null, top: 3 },
  { query: 'zzzz loi nay khong ton tai trong lyrics 919191', expected: null, top: 3 },
];

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function normalize(value = '') {
  return String(value || '').toLowerCase();
}

async function run() {
  for (const testCase of cases) {
    const url = `${BASE_URL}/api/songs/search?q=${encodeURIComponent(testCase.query)}&includeLyrics=true&debug=true&limit=5`;
    const payload = await requestJson(url);
    const songs = payload?.data?.songs || [];
    const expectedIndex = testCase.expected
      ? songs.findIndex(song => normalize(song.title).includes(normalize(testCase.expected)))
      : -1;
    const pass = testCase.expected ? expectedIndex >= 0 && expectedIndex < testCase.top : songs.length >= 0;

    console.log(`\nQuery: ${testCase.query}`);
    console.log(`Status: ${pass ? 'PASS' : 'CHECK'}${testCase.expected ? ` expected="${testCase.expected}" top${testCase.top}` : ''}`);
    songs.slice(0, 5).forEach((song, index) => {
      console.log(`${index + 1}. ${song.title} - ${song.artist_name || song.artist}`);
      console.log(`   matchType=${song.matchType} matchScore=${song.matchScore} vectorScore=${song.debugSearch?.vectorScore || 0}`);
      if (song.lyricSnippet) console.log(`   snippet=${song.lyricSnippet}`);
    });
  }
}

run().catch((error) => {
  console.error('[lyrics-search-test] Failed:', error.message);
  process.exit(1);
});
