const fs = require('fs');
const path = require('path');
const { normalizeLyricsQueryIntent, normalizeVietnamese, escapeHtml } = require('../utils/vietnameseText.util');

const INDEX_PATH = path.resolve(__dirname, '../../../../storage/search/lyrics_semantic_index/index.json');
const SEMANTIC_THRESHOLD = 0.55;
const MAX_CHUNKS_TO_SCAN = 150000;

const STOP_WORDS = new Set([
  'anh', 'em', 'co', 'ta', 'toi', 'minh', 'nguoi', 'la', 'that', 'va', 'cua',
  'cho', 'de', 'voi', 'nhu', 'trong', 'mot', 'nhung', 'tung', 'nay', 'kia',
  'do', 'day', 'roi', 'mai', 'hay', 'khong', 'coi', 'con', 'chung', 'thi',
  'nhau', 'oi', 'yeu',
]);

let cache = {
  mtimeMs: 0,
  index: null,
  unavailable: false,
};

let initPromise = null;

function tokenize(value = '') {
  return normalizeVietnamese(value)
    .split(' ')
    .filter(token => token.length >= 2);
}

function addWeighted(vector, key, weight) {
  if (!key) return;
  vector[key] = (vector[key] || 0) + weight;
}

function buildSparseVector(value = '') {
  const normalized = normalizeVietnamese(value);
  const tokens = normalized.split(' ').filter(Boolean);
  const vector = {};

  tokens.forEach((token) => {
    if (token.length >= 2 && !STOP_WORDS.has(token)) addWeighted(vector, `w:${token}`, 2.4);
    if (token.length >= 4) {
      for (let n = 3; n <= 4; n += 1) {
        for (let i = 0; i <= token.length - n; i += 1) {
          addWeighted(vector, `c:${token.slice(i, i + n)}`, 0.55);
        }
      }
    }
  });

  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (!STOP_WORDS.has(tokens[i]) || !STOP_WORDS.has(tokens[i + 1])) {
      addWeighted(vector, `b:${tokens[i]}_${tokens[i + 1]}`, 1.2);
    }
  }

  const norm = Math.sqrt(Object.values(vector).reduce((sum, val) => sum + val * val, 0)) || 1;
  return { vector, norm };
}

function cosine(queryVec, queryNorm, chunk) {
  const vector = chunk.vector || {};
  const chunkNorm = Number(chunk.norm || 1);
  let dot = 0;
  for (const [key, value] of Object.entries(queryVec)) {
    if (vector[key]) dot += value * vector[key];
  }
  return dot / (queryNorm * chunkNorm || 1);
}

function loadIndexFromDisk() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.warn(`[LyricsSemanticSearch] index unavailable, fallback to keyword lyrics search: missing ${INDEX_PATH}`);
    cache = { ...cache, unavailable: true };
    return null;
  }

  const stat = fs.statSync(INDEX_PATH);
  if (cache.index && cache.mtimeMs === stat.mtimeMs) return cache.index;

  const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
  const songCount = new Set(chunks.map(chunk => Number(chunk.song_id)).filter(Boolean)).size;
  cache = { mtimeMs: stat.mtimeMs, index: parsed, unavailable: false };
  console.log(`[LyricsSemanticSearch] index loaded chunks=${chunks.length} songs=${songCount}`);
  return parsed;
}

function initializeLyricsSemanticIndex() {
  if (cache.index) return Promise.resolve(cache.index);
  if (initPromise) return initPromise;

  initPromise = Promise.resolve()
    .then(() => loadIndexFromDisk())
    .catch((error) => {
      cache = { mtimeMs: 0, index: null, unavailable: true };
      console.warn(`[LyricsSemanticSearch] index unavailable, fallback to keyword lyrics search: ${error.message}`);
      return null;
    });

  return initPromise;
}

async function ensureLyricsSemanticIndexReady() {
  if (cache.index || cache.unavailable) return cache.index;
  console.log('[LyricsSemanticSearch] waiting for index ready...');
  return initializeLyricsSemanticIndex();
}

function isLyricsSemanticIndexReady() {
  return Boolean(cache.index && Array.isArray(cache.index.chunks));
}

function highlightSemanticSnippet(snippet, query = '') {
  const importantTokens = new Set(tokenize(query).filter(token => !STOP_WORDS.has(token) && token.length >= 3));
  const escaped = escapeHtml(snippet || '');
  if (!escaped || importantTokens.size === 0) return escaped || null;

  return escaped.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const normalized = normalizeVietnamese(word);
    return importantTokens.has(normalized) ? `<mark>${word}</mark>` : word;
  });
}

function searchLyricsSemantic(query, options = {}) {
  const index = cache.index;
  if (!index) {
    console.warn('[LyricsSemanticSearch] index unavailable, fallback to keyword lyrics search');
  }
  const intentQuery = normalizeLyricsQueryIntent(query);
  if (!index || !Array.isArray(index.chunks) || !intentQuery) return [];

  const { vector, norm } = buildSparseVector(intentQuery);
  const chunks = index.chunks.slice(0, options.maxChunks || MAX_CHUNKS_TO_SCAN);
  const bestBySong = new Map();

  for (const chunk of chunks) {
    const score = cosine(vector, norm, chunk);
    if (score < (options.threshold || SEMANTIC_THRESHOLD)) continue;

    const current = bestBySong.get(Number(chunk.song_id));
    if (!current || score > current.vectorScore) {
      bestBySong.set(Number(chunk.song_id), {
        songId: Number(chunk.song_id),
        vectorScore: Number(score.toFixed(4)),
        lyricSnippet: chunk.original_text,
        highlightedSnippet: highlightSemanticSnippet(chunk.original_text, intentQuery),
        matchedChunk: {
          chunkIndex: chunk.chunk_index,
          source: chunk.source,
          normalizedText: chunk.normalized_text,
        },
      });
    }
  }

  return Array.from(bestBySong.values())
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, options.limit || 20);
}

module.exports = {
  INDEX_PATH,
  SEMANTIC_THRESHOLD,
  buildSparseVector,
  initializeLyricsSemanticIndex,
  ensureLyricsSemanticIndexReady,
  isLyricsSemanticIndexReady,
  searchLyricsSemantic,
};
