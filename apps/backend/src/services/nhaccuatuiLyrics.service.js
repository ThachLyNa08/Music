const axios = require('axios');

const SEARCH_URL = 'https://www.nhaccuatui.com/tim-kiem/bai-hat';
const MIN_CONFIDENCE = 0.75;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

function normalizeForCompare(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeForCompare(value).split(' ').filter(Boolean));
}

function similarity(a, b) {
  const tokensA = tokenSet(a);
  const tokensB = tokenSet(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }

  return (2 * intersection) / (tokensA.size + tokensB.size);
}

function extractProviderId(url) {
  const match = String(url || '').match(/\.([A-Za-z0-9_-]+)\.html(?:$|\?)/);
  return match ? match[1] : null;
}

function extractSearchCandidates(html) {
  const candidates = [];
  const itemRegex = /<li[^>]*class="[^"]*(?:sn_search_single_song|sn_search_returns_list_song)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const itemMatches = [...String(html || '').matchAll(itemRegex)];
  const blocks = itemMatches.length > 0
    ? itemMatches.map((match) => match[1])
    : String(html || '').split(/<li/gi).slice(1).map((block) => `<li${block}`);

  for (const block of blocks) {
    const linkMatch = block.match(/href="([^"]*nhaccuatui\.com\/bai-hat\/[^"]+\.html[^"]*)"/i)
      || block.match(/href="(\/bai-hat\/[^"]+\.html[^"]*)"/i);
    if (!linkMatch) continue;

    const rawUrl = decodeHtml(linkMatch[1]);
    const url = rawUrl.startsWith('http') ? rawUrl : `https://www.nhaccuatui.com${rawUrl}`;
    const titleMatch = block.match(/title="([^"]+)"/i)
      || block.match(/<a[^>]+class="[^"]*(?:name_song|name_song_search)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const artistMatch = block.match(/<a[^>]+class="[^"]*(?:name_singer|name_singer_search)[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<h4[^>]*>[\s\S]*?<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i);

    candidates.push({
      title: cleanText(stripTags(titleMatch?.[1] || '')),
      artist: cleanText(stripTags(artistMatch?.[1] || '')),
      url,
      providerLyricId: extractProviderId(url),
    });
  }

  return candidates.filter((candidate) => candidate.title && candidate.url);
}

function scoreCandidate(candidate, title, artist) {
  const titleScore = similarity(candidate.title, title);
  const artistScore = similarity(candidate.artist, artist);
  const confidenceScore = Number(((titleScore * 0.65) + (artistScore * 0.35)).toFixed(2));

  return {
    ...candidate,
    titleScore,
    artistScore,
    confidenceScore,
  };
}

async function searchNhacCuaTuiLyrics({ title, artist }) {
  const query = cleanText(`${title} ${artist}`);
  const { data } = await axios.get(SEARCH_URL, {
    params: { q: query },
    timeout: 15000,
    headers: {
      'User-Agent': 'MusicFlow lyrics offline crawler (local script)',
    },
  });

  const candidates = extractSearchCandidates(data)
    .map((candidate) => scoreCandidate(candidate, title, artist))
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const best = candidates[0] || null;
  if (!best) {
    return { candidate: null, candidates, confidenceScore: 0, lowConfidence: false };
  }

  const lowConfidence = best.confidenceScore < MIN_CONFIDENCE || best.artistScore < 0.45;
  return { candidate: best, candidates, confidenceScore: best.confidenceScore, lowConfidence };
}

function extractLyricsFromHtml(html) {
  const source = String(html || '');
  const patterns = [
    /<p[^>]+id="divLyric"[^>]*>([\s\S]*?)<\/p>/i,
    /<div[^>]+id="divLyric"[^>]*>([\s\S]*?)<\/div>/i,
    /<p[^>]+class="[^"]*pd_lyric[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    /<div[^>]+class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const text = cleanText(stripTags(match?.[1] || '').replace(/\n\s*/g, '\n'));
    if (text && !/chưa có lời bài hát|dang cap nhat loi/i.test(normalizeForCompare(text))) {
      return text;
    }
  }

  return null;
}

async function fetchNhacCuaTuiLyricPage(url) {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'MusicFlow lyrics offline crawler (local script)',
    },
  });

  return {
    url,
    plainLyrics: extractLyricsFromHtml(data),
    htmlLength: String(data || '').length,
  };
}

function normalizeNhacCuaTuiLyrics(raw) {
  const plainLyrics = cleanText(raw?.plainLyrics || '');

  return {
    provider: 'nhaccuatui',
    providerLyricId: raw?.providerLyricId || extractProviderId(raw?.sourceUrl),
    syncType: plainLyrics ? 'PLAIN_TEXT' : 'NONE',
    plainLyrics: plainLyrics || null,
    syncedLyrics: null,
    lyricsJson: {
      provider: 'nhaccuatui',
      raw,
      lines: plainLyrics
        ? plainLyrics.split(/\r?\n/).map((words) => cleanText(words)).filter(Boolean)
        : [],
    },
    sourceUrl: raw?.sourceUrl || raw?.url || null,
    confidenceScore: Number(raw?.confidenceScore) || 0,
  };
}

module.exports = {
  MIN_CONFIDENCE,
  searchNhacCuaTuiLyrics,
  fetchNhacCuaTuiLyricPage,
  normalizeNhacCuaTuiLyrics,
};
