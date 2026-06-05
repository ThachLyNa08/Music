const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
});

const axios = require('axios');
const csv = require('csv-parser');
const { pool } = require('../src/config/database');
const { normalizeLrclibResponse } = require('../src/services/lyrics.service');

function resolveProjectRoot() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'datasets'))) return cwd;
  if (fs.existsSync(path.join(cwd, '..', '..', 'datasets'))) return path.resolve(cwd, '..', '..');
  return path.resolve(__dirname, '..', '..', '..');
}

const PROJECT_ROOT = resolveProjectRoot();
const DEFAULT_CSV_CANDIDATES = [
  path.join(PROJECT_ROOT, 'apps', 'backend', 'uploads', 'music', 'music_database_kpop.csv'),
  path.join(PROJECT_ROOT, 'datasets', 'raw', 'music_database_kpop.csv'),
  path.join(PROJECT_ROOT, 'datasets', 'raw', 'music_database.csv'),
];
const DEFAULT_CSV_PATH = DEFAULT_CSV_CANDIDATES.find((filePath) => fs.existsSync(filePath)) || DEFAULT_CSV_CANDIDATES[0];
const GROUP = 'kpop';
const RAW_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'lrclib', GROUP);
const FAILED_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'failed', GROUP);
const STATE_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'state');
const FAILED_FILE = path.join(FAILED_DIR, 'failed-lyrics.json');
const STATE_FILE = path.join(STATE_DIR, 'kpop-crawl-state.json');
const INDEX_FILE = path.join(RAW_DIR, 'lyrics-index.json');
const LRCLIB_GET_URL = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH_URL = 'https://lrclib.net/api/search';

const KPOP_ARTIST_MAPPING = {
  TAEYEON: 'Taeyeon',
  '태연': 'Taeyeon',
  HYO: 'Hyoyeon',
  '효연': 'Hyoyeon',
  TIFFANY: 'Tiffany Young',
  '티파니': 'Tiffany Young',
  YOONA: 'Yoona',
  '윤아': 'Yoona',
  SEOHYUN: 'Seohyun',
  '서현': 'Seohyun',
  YURI: 'Yuri',
  '유리': 'Yuri',
  SUNNY: 'Sunny',
  '써니': 'Sunny',
  SOOYOUNG: 'Sooyoung',
  '수영': 'Sooyoung',
};

function parseArgs(argv) {
  const options = { limit: 50, offset: null, force: false, delay: 800 };

  for (const arg of argv) {
    const [key, rawValue] = arg.replace(/^--/, '').split('=');
    const value = rawValue === undefined ? true : rawValue;
    if (key === 'limit') options.limit = Number(value);
    if (key === 'offset') options.offset = Number(value);
    if (key === 'delay') options.delay = Number(value);
    if (key === 'force') options.force = value === true || value === 'true' || value === '1';
    if (key === 'resetCursor') options.resetCursor = value === true || value === 'true' || value === '1';
    if (key === 'showState') options.showState = value === true || value === 'true' || value === '1';
  }

  options.limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 50;
  options.offset = Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : null;
  options.delay = Number.isInteger(options.delay) && options.delay >= 0 ? options.delay : 800;
  return options;
}

function ensureDirs() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(FAILED_DIR, { recursive: true });
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeForCompare(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableName(value) {
  return normalizeForCompare(value).replace(/\s+/g, '');
}

function normalizeLrclibSearchTitle(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’`'"]/g, '')
    .replace(/\b(?:official|music video|lyric video|lyrics|audio|visualizer|m\/v|mv|4k|hd)\b/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLrclibSearchArtist(value) {
  return normalizeForCompare(value).replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

function isShortStrictTitle(title) {
  return normalizeLrclibSearchTitle(title).replace(/\s+/g, '').length <= 6;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value) {
  return normalizeForCompare(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'kpop';
}

function stripHangulParentheses(value) {
  return cleanText(value).replace(/\s*\([^)]*[가-힣][^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitRomanizedAndHangul(value) {
  const text = cleanText(value);
  return {
    romanized: cleanText(text.replace(/[가-힣]+/g, ' ')),
    hangul: cleanText((text.match(/[가-힣]+(?:\s+[가-힣]+)*/g) || []).join(' ')),
  };
}

function cleanKpopArtistName(rawArtist) {
  return stripHangulParentheses(rawArtist);
}

function removeWrappedQuotes(value) {
  return cleanText(value).replace(/^['"‘’“”]+|['"‘’“”]+$/g, '').trim();
}

function normalizeQuotes(value) {
  return String(value || '')
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"');
}

function getArtistAliases(mainArtist, originalArtist) {
  const aliases = [mainArtist, originalArtist, cleanKpopArtistName(mainArtist), cleanKpopArtistName(originalArtist)];

  for (const artist of [mainArtist, originalArtist]) {
    const parts = splitRomanizedAndHangul(artist);
    aliases.push(parts.romanized, parts.hangul, parts.romanized.replace(/'/g, ''));
  }

  return aliases
    .map(cleanText)
    .filter(Boolean)
    .filter((value, index, array) => array.findIndex((item) => normalizeComparableName(item) === normalizeComparableName(value)) === index);
}

function toTitleCaseAscii(value) {
  const text = cleanText(value).toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function addUniqueCandidate(candidates, value) {
  const cleaned = cleanText(value);
  if (!cleaned) return;
  if (candidates.some((item) => cleanText(item) === cleaned)) return;
  candidates.push(cleaned);
}

function parseKpopArtistCandidates(rawTitle, csvRow = {}) {
  const quoted = extractQuotedKpopTitle(rawTitle);
  const prefix = quoted?.prefix || parseArtistPrefixFromTitle(rawTitle, csvRow.Main_Artist, csvRow.Original_Artist) || '';
  const parts = splitRomanizedAndHangul(prefix);
  const candidates = [];

  for (const source of [parts.romanized, parts.hangul]) {
    const upper = cleanText(source).toUpperCase();
    addUniqueCandidate(candidates, KPOP_ARTIST_MAPPING[upper]);
    addUniqueCandidate(candidates, KPOP_ARTIST_MAPPING[source]);
  }

  addUniqueCandidate(candidates, parts.romanized);
  addUniqueCandidate(candidates, parts.romanized.replace(/'/g, ''));
  addUniqueCandidate(candidates, parts.hangul);
  addUniqueCandidate(candidates, toTitleCaseAscii(parts.romanized));

  for (const source of [csvRow.Main_Artist, csvRow.Original_Artist, cleanKpopArtistName(csvRow.Main_Artist)]) {
    addUniqueCandidate(candidates, source);
  }

  return candidates;
}

function removeKpopNoise(title) {
  const noiseTerms = [
    'official music video',
    'official video',
    'official mv',
    'music video',
    'performance video',
    'dance practice',
    'choreography video',
    'choreography',
    'relay dance',
    'stage mix',
    'comeback stage',
    'live stage',
    'inkigayo',
    'music bank',
    'm countdown',
    'mnet',
    'sbs',
    'kbs',
    'lyric video',
    'lyrics',
    'audio',
    'visualizer',
    'teaser',
    'trailer',
    'm/v',
    'mv',
    '4k',
    'hd',
  ].map(escapeRegExp).join('|');

  let cleaned = cleanText(title);
  const bracketNoise = new RegExp(`\\s*[\\[(]\\s*(?:${noiseTerms})\\s*[\\])]\\s*`, 'gi');
  const trailingNoise = new RegExp(`\\s*(?:-|–|—|\\||:)?\\s*(?:${noiseTerms})\\s*$`, 'i');

  let previous;
  do {
    previous = cleaned;
    cleaned = cleaned.replace(bracketNoise, ' ');
    cleaned = cleaned.replace(trailingNoise, '');
    cleaned = cleanText(cleaned);
  } while (cleaned !== previous);

  return cleaned;
}

function isValidQuoteOpen(text, index, quote) {
  if (quote !== "'") return true;
  if (index === 0) return true;
  return /[\s\-–—|:([{]/.test(text[index - 1]);
}

function isArtistLikeSegment(segment) {
  const normalized = normalizeForCompare(segment);
  if (!normalized) return true;
  const mapped = KPOP_ARTIST_MAPPING[segment.toUpperCase()] || KPOP_ARTIST_MAPPING[segment];
  return Boolean(mapped) || normalized.length <= 1;
}

function extractQuotedKpopTitle(rawTitle) {
  const text = normalizeQuotes(rawTitle);
  const pairs = [
    ["'", "'"],
    ['"', '"'],
  ];
  const matches = [];

  for (const [open, close] of pairs) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const start = text.indexOf(open, searchFrom);
      if (start < 0) break;
      if (!isValidQuoteOpen(text, start, open)) {
        searchFrom = start + 1;
        continue;
      }

      const end = text.indexOf(close, start + 1);
      if (end < 0) break;

      const value = cleanText(text.slice(start + 1, end));
      const prefix = cleanText(text.slice(0, start));
      const suffix = cleanText(text.slice(end + 1));
      if (value && value.length >= 2 && !isArtistLikeSegment(value)) {
        matches.push({ value, prefix, suffix, start, end });
      }
      searchFrom = end + 1;
    }
  }

  matches.sort((a, b) => b.start - a.start);
  return matches[0] || null;
}

function prefixMatchesArtist(prefix, aliases) {
  const normalizedPrefix = normalizeComparableName(prefix);
  if (!normalizedPrefix) return false;

  return aliases.some((alias) => {
    const normalizedAlias = normalizeComparableName(alias);
    return normalizedAlias && (
      normalizedPrefix === normalizedAlias
      || normalizedPrefix.includes(normalizedAlias)
      || normalizedAlias.includes(normalizedPrefix)
    );
  });
}

function findQuotedTitleSegment(rawTitle) {
  return extractQuotedKpopTitle(rawTitle);
}

function parseArtistPrefixFromTitle(rawTitle, mainArtist, originalArtist) {
  const title = cleanText(rawTitle);
  const aliases = getArtistAliases(mainArtist, originalArtist);
  const separatorMatch = title.match(/\s*(?:-|–|—|\||:)\s*/);
  if (separatorMatch?.index > 0) {
    const prefix = title.slice(0, separatorMatch.index);
    if (prefixMatchesArtist(prefix, aliases)) return cleanText(prefix);
  }

  const quoted = findQuotedTitleSegment(title);
  if (quoted && prefixMatchesArtist(quoted.prefix, aliases)) return quoted.prefix;

  return null;
}

function removeArtistPrefix(title, mainArtist, originalArtist) {
  const aliases = getArtistAliases(mainArtist, originalArtist);
  const separatorMatch = title.match(/\s*(?:-|–|—|\||:)\s*/);
  if (!separatorMatch || separatorMatch.index === undefined) return title;

  const prefix = title.slice(0, separatorMatch.index);
  const suffix = title.slice(separatorMatch.index + separatorMatch[0].length);
  if (prefixMatchesArtist(prefix, aliases) && suffix) return suffix;
  return title;
}

function cleanKpopTrackTitle(rawTitle, mainArtist, originalArtist) {
  const originalTitle = cleanText(normalizeQuotes(rawTitle));
  if (!originalTitle) return originalTitle;

  const quoted = extractQuotedKpopTitle(originalTitle);
  if (quoted) {
    return removeWrappedQuotes(removeKpopNoise(quoted.value)) || originalTitle;
  }

  let cleaned = removeKpopNoise(originalTitle);
  cleaned = removeArtistPrefix(cleaned, mainArtist, originalArtist);
  cleaned = removeKpopNoise(cleaned);
  cleaned = removeWrappedQuotes(cleaned);
  return cleaned || originalTitle;
}

function stripVersionParentheses(title) {
  const versionPattern = /\s*\((?:japanese|korean|english)\s+ver\.?|remix|acoustic|instrumental\)\s*/gi;
  return cleanText(title).replace(versionPattern, ' ').trim();
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`KPOP CSV not found: ${filePath}`));
      return;
    }

    const rows = [];
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream
      .pipe(csv())
      .on('data', (row) => rows.push({ ...row, __sourceFile: path.relative(PROJECT_ROOT, filePath) }))
      .on('error', reject)
      .on('end', () => resolve(rows.filter((row) => normalizeForCompare(row.Genre).includes('kpop'))));
  });
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function defaultState(sourceFile) {
  return {
    group: GROUP,
    sourceFile,
    lastProcessedRow: -1,
    lastRunAt: null,
    summary: {
      crawled: 0,
      skippedRaw: 0,
      skippedImported: 0,
      failed: 0,
      unmatched: 0,
    },
  };
}

function readState(sourceFile) {
  if (!fs.existsSync(STATE_FILE)) return defaultState(sourceFile);
  try {
    return { ...defaultState(sourceFile), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')), sourceFile };
  } catch {
    return defaultState(sourceFile);
  }
}

function writeState(state) {
  writeJson(STATE_FILE, { ...state, group: GROUP, lastRunAt: new Date().toISOString() });
}

function resetState(sourceFile) {
  const state = defaultState(sourceFile);
  writeState(state);
  return state;
}

function addFailure(failure) {
  const failures = readJsonArray(FAILED_FILE);
  const key = `${failure.songId || 'unknown'}|${failure.reason}|${normalizeForCompare(failure.rawTitle || failure.csv?.Title || '')}`;
  const index = failures.findIndex((item) => (
    `${item.songId || 'unknown'}|${item.reason}|${normalizeForCompare(item.rawTitle || item.csv?.Title || '')}` === key
  ));
  const next = { ...failure, failedAt: new Date().toISOString() };
  if (index >= 0) failures[index] = { ...failures[index], ...next };
  else failures.push(next);
  writeJson(FAILED_FILE, failures);
}

function updateIndex(item) {
  const index = readJsonArray(INDEX_FILE);
  const itemIndex = index.findIndex((entry) => String(entry.songId) === String(item.songId));
  if (itemIndex >= 0) index[itemIndex] = item;
  else index.push(item);
  writeJson(INDEX_FILE, index);
}

function hasRaw(songId) {
  if (!fs.existsSync(RAW_DIR)) return false;
  return fs.readdirSync(RAW_DIR).some((fileName) => fileName.startsWith(`song-${songId}-`) && fileName.endsWith('.json'));
}

async function hasImportedLyrics(songId) {
  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM song_lyrics WHERE song_id = ? AND sync_type <> 'NONE' LIMIT 1`,
      [songId]
    );
    return rows.length > 0;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return false;
    throw err;
  }
}

async function getSongColumns() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'songs'`
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

function buildSelectColumns(columns) {
  const optionalColumns = ['duration_sec', 'duration', 'audio_url', 'file_path', 'youtube_url', 'source_url', 'external_url'];
  const select = ['s.id', 's.title', 'a.name AS artist'];
  for (const column of optionalColumns) {
    if (columns.has(column)) select.push(`s.${column}`);
  }
  return select.join(', ');
}

async function findSongByColumn(selectColumns, column, value) {
  if (!value) return null;
  const [rows] = await pool.query(
    `SELECT ${selectColumns}
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE s.${column} = ?
     LIMIT 1`,
    [value]
  );
  if (rows[0]) return rows[0];

  const normalizedValue = String(value).replace(/\\/g, '/');
  const [likeRows] = await pool.query(
    `SELECT ${selectColumns}
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE REPLACE(s.${column}, '\\\\', '/') LIKE ?
     LIMIT 1`,
    [`%${normalizedValue}%`]
  );
  return likeRows[0] || null;
}

async function findSongByTitleArtist(selectColumns, title, artist) {
  if (!title || !artist) return null;

  const [exactRows] = await pool.query(
    `SELECT ${selectColumns}
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE LOWER(s.title) = LOWER(?)
       AND LOWER(a.name) = LOWER(?)
     LIMIT 1`,
    [title, artist]
  );
  if (exactRows[0]) return exactRows[0];

  const normalizedTitle = normalizeForCompare(title);
  const normalizedArtist = normalizeForCompare(artist);
  const [candidates] = await pool.query(
    `SELECT ${selectColumns}
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE s.title LIKE ? OR a.name LIKE ?
     LIMIT 80`,
    [`%${title}%`, `%${artist}%`]
  );

  return candidates.find((row) => (
    normalizeForCompare(row.title) === normalizedTitle
    && normalizeForCompare(row.artist) === normalizedArtist
  )) || null;
}

async function matchSong(row, columns) {
  const selectColumns = buildSelectColumns(columns);
  const youtubeUrl = cleanText(row.YouTube_URL);
  const filePath = cleanText(row.File_Path);
  const rawTitle = cleanText(row.Title);
  const cleanTitle = cleanKpopTrackTitle(rawTitle, row.Main_Artist, row.Original_Artist);
  const mainArtist = cleanText(row.Main_Artist);
  const originalArtist = cleanText(row.Original_Artist);

  for (const column of ['youtube_url', 'source_url', 'external_url']) {
    if (columns.has(column)) {
      const found = await findSongByColumn(selectColumns, column, youtubeUrl);
      if (found) return found;
    }
  }

  for (const column of ['audio_url', 'file_path']) {
    if (columns.has(column)) {
      const found = await findSongByColumn(selectColumns, column, filePath);
      if (found) return found;
    }
  }

  return await findSongByTitleArtist(selectColumns, cleanTitle, mainArtist)
    || await findSongByTitleArtist(selectColumns, cleanTitle, originalArtist)
    || await findSongByTitleArtist(selectColumns, rawTitle, mainArtist)
    || await findSongByTitleArtist(selectColumns, rawTitle, originalArtist);
}

function getDuration(song) {
  const value = song?.duration_sec ?? song?.duration;
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
}

function addVariant(variants, seen, variant) {
  const trackName = cleanText(variant.trackName);
  const artistName = cleanText(variant.artistName);
  if (!trackName || !artistName) return;

  const key = [
    normalizeForCompare(trackName),
    normalizeForCompare(artistName),
    normalizeForCompare(variant.albumName || ''),
    variant.duration || '',
    variant.strategy || '',
  ].join('|');
  if (seen.has(key)) return;
  seen.add(key);
  variants.push({
    trackName,
    artistName,
    albumName: cleanText(variant.albumName),
    duration: variant.duration || null,
    strategy: variant.strategy,
  });
}

function buildKpopLrclibQueryVariants(csvRow, matchedSong) {
  const variants = [];
  const seen = new Set();
  const rawTitle = cleanText(csvRow.Title);
  const cleanTitle = cleanKpopTrackTitle(rawTitle, csvRow.Main_Artist, csvRow.Original_Artist);
  const mainArtist = cleanText(csvRow.Main_Artist);
  const originalArtist = cleanText(csvRow.Original_Artist);
  const artistCandidates = parseKpopArtistCandidates(rawTitle, csvRow);
  const albumName = cleanText(csvRow.Album);
  const duration = getDuration(matchedSong);

  artistCandidates.forEach((artistName, index) => {
    addVariant(variants, seen, {
      trackName: cleanTitle,
      artistName,
      albumName,
      duration,
      strategy: index === 0 ? 'quoted_title_primary_artist_candidate' : `quoted_title_artist_candidate_${index + 1}`,
    });
  });
  addVariant(variants, seen, { trackName: cleanTitle, artistName: mainArtist, albumName, duration, strategy: 'quoted_title_main_artist' });
  addVariant(variants, seen, { trackName: cleanTitle, artistName: originalArtist, albumName, duration, strategy: 'quoted_title_original_artist' });
  addVariant(variants, seen, {
    trackName: matchedSong?.title,
    artistName: matchedSong?.artist,
    duration,
    strategy: 'matched_song_title_artist',
  });
  addVariant(variants, seen, { trackName: rawTitle, artistName: mainArtist, strategy: 'raw_title_main_artist' });

  const noVersionTitle = stripVersionParentheses(cleanTitle);
  if (noVersionTitle && normalizeForCompare(noVersionTitle) !== normalizeForCompare(cleanTitle)) {
    addVariant(variants, seen, { trackName: noVersionTitle, artistName: mainArtist, strategy: 'clean_title_without_version_main_artist' });
  }

  return variants;
}

async function fetchLrclibVariant(variant) {
  const params = {
    track_name: variant.trackName,
    artist_name: variant.artistName,
  };
  if (variant.albumName) params.album_name = variant.albumName;
  if (variant.duration) params.duration = variant.duration;

  const { data } = await axios.get(LRCLIB_GET_URL, {
    params,
    timeout: 15000,
    headers: { 'User-Agent': 'MusicFlow KPOP lyrics offline crawler (local script)' },
  });
  return data;
}

function hasLyricsPayload(raw) {
  return Boolean(raw && (raw.syncedLyrics || raw.plainLyrics || raw.instrumental));
}

function candidateTitleMatches(candidateTitle, cleanTitle) {
  const normalizedCandidate = normalizeLrclibSearchTitle(candidateTitle);
  const normalizedClean = normalizeLrclibSearchTitle(cleanTitle);
  if (!normalizedCandidate || !normalizedClean) return false;
  if (isShortStrictTitle(cleanTitle)) return normalizedCandidate === normalizedClean;
  return normalizedCandidate === normalizedClean || normalizedCandidate.includes(normalizedClean) || normalizedClean.includes(normalizedCandidate);
}

function candidateArtistMatches(candidateArtist, artistCandidates) {
  const normalizedCandidate = normalizeLrclibSearchArtist(candidateArtist);
  if (!normalizedCandidate) return false;

  return artistCandidates.some((artist) => {
    const normalizedArtist = normalizeLrclibSearchArtist(artist);
    return normalizedArtist
      && (
        normalizedCandidate === normalizedArtist
        || normalizedCandidate.includes(normalizedArtist)
        || normalizedArtist.includes(normalizedCandidate)
      );
  });
}

async function searchLrclibFallback(cleanTitle, artistCandidates) {
  for (const artistName of artistCandidates) {
    const query = `${cleanTitle} ${artistName}`.trim();
    const { data } = await axios.get(LRCLIB_SEARCH_URL, {
      params: { q: query },
      timeout: 15000,
      headers: { 'User-Agent': 'MusicFlow KPOP lyrics offline crawler (local script)' },
    });
    const results = Array.isArray(data) ? data : [];
    console.log(`[kpop-search] query="${query}" results=${results.length}`);

    for (const candidate of results) {
      const candidateTitle = candidate.trackName || candidate.name || candidate.title || '';
      const candidateArtist = candidate.artistName || candidate.artist || '';
      const titleAccepted = candidateTitleMatches(candidateTitle, cleanTitle);
      const artistAccepted = titleAccepted && candidateArtistMatches(candidateArtist, artistCandidates);
      const selected = Boolean(titleAccepted && artistAccepted && hasLyricsPayload(candidate));
      console.log(
        `[kpop-candidate] title="${candidateTitle}" artist="${candidateArtist}" `
        + `titleAccepted=${titleAccepted} artistAccepted=${artistAccepted} selected=${selected}`
      );

      if (selected) {
        return {
          raw: candidate,
          query,
          artistName,
          strategy: 'lrclib_search_fallback',
        };
      }
    }
  }

  return null;
}

async function fetchLrclib(row, matchedSong) {
  const variants = buildKpopLrclibQueryVariants(row, matchedSong);
  const rawTitle = cleanText(row.Title);
  const cleanTitle = cleanKpopTrackTitle(rawTitle, row.Main_Artist, row.Original_Artist);
  const artistCandidates = parseKpopArtistCandidates(rawTitle, row);
  const triedQueries = [];
  let requestError = null;

  console.log(`[kpop-clean] raw="${rawTitle}" cleanTitle="${cleanTitle}" artists=${JSON.stringify(artistCandidates)}`);

  for (const variant of variants) {
    console.log(`[kpop-query] trackName="${variant.trackName}" artistName="${variant.artistName}" strategy=${variant.strategy}`);
    try {
      const raw = await fetchLrclibVariant(variant);
      triedQueries.push({ ...variant, status: 200 });
      if (hasLyricsPayload(raw)) {
        return {
          raw,
          triedQueries,
          queryDebug: {
            rawTitle,
            cleanTitle,
            artistName: variant.artistName,
            albumName: variant.albumName || null,
            duration: variant.duration || null,
            matchedStrategy: variant.strategy,
          },
        };
      }
    } catch (err) {
      const status = err.response?.status || null;
      triedQueries.push({ ...variant, status });
      if (status !== 404) requestError = err;
    }
  }

  if (requestError) {
    requestError.queryDebug = { rawTitle, cleanTitle, triedQueries };
    throw requestError;
  }

  const searchResult = await searchLrclibFallback(cleanTitle, artistCandidates);
  if (searchResult) {
    triedQueries.push({
      trackName: cleanTitle,
      artistName: searchResult.artistName,
      strategy: searchResult.strategy,
      status: 200,
      query: searchResult.query,
    });
    return {
      raw: searchResult.raw,
      triedQueries,
      queryDebug: {
        rawTitle,
        cleanTitle,
        artistName: searchResult.artistName,
        albumName: null,
        duration: null,
        matchedStrategy: searchResult.strategy,
      },
    };
  }

  return { raw: null, triedQueries, queryDebug: { rawTitle, cleanTitle, triedQueries } };
}

function buildRawOutput(row, matchedSong, raw, queryDebug) {
  const normalized = normalizeLrclibResponse(raw);
  return {
    songId: matchedSong.id,
    csv: {
      Title: row.Title || '',
      Main_Artist: row.Main_Artist || '',
      Original_Artist: row.Original_Artist || '',
      Album: row.Album || '',
      Genre: row.Genre || '',
      YouTube_URL: row.YouTube_URL || '',
      Cover_URL: row.Cover_URL || '',
      File_Path: row.File_Path || '',
      Group: GROUP,
      Source_File: row.__sourceFile || '',
    },
    matchedSong: {
      id: matchedSong.id,
      title: matchedSong.title,
      artist: matchedSong.artist,
      duration: getDuration(matchedSong),
    },
    provider: 'lrclib',
    providerLyricId: normalized.providerLyricId,
    syncType: normalized.syncType,
    plainLyrics: normalized.plainLyrics,
    syncedLyrics: normalized.syncedLyrics,
    fetchedAt: new Date().toISOString(),
    queryDebug,
    raw,
  };
}

function logDbConfig() {
  console.log('[kpop-lyrics-crawl] DB config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    passwordLoaded: Boolean(process.env.DB_PASSWORD),
  });
}

function logRowStatus(processedCount, limit, rowIndex, songId, status, title) {
  console.log(`[${processedCount}/${limit}] row=${rowIndex} songId=${songId} status=${status} title="${title || ''}"`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDirs();

  const rows = await readCsv(DEFAULT_CSV_PATH);
  const sourceFile = path.relative(PROJECT_ROOT, DEFAULT_CSV_PATH);
  let state = readState(sourceFile);

  if (options.showState) {
    console.log(state);
    return;
  }

  if (options.resetCursor) {
    state = resetState(sourceFile);
    console.log('Reset KPOP crawl cursor');
    console.log(state);
    return;
  }

  logDbConfig();

  const startRow = options.offset ?? Math.max(0, Number(state.lastProcessedRow || -1) + 1);
  const songColumns = await getSongColumns();
  let endRow = startRow - 1;
  let processed = 0;
  let crawled = 0;
  let failed = 0;
  let unmatched = 0;
  let skippedRaw = 0;
  let skippedImported = 0;

  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
    if (processed >= options.limit) break;
    const row = rows[rowIndex];
    processed += 1;
    endRow = rowIndex;
    let songId = 'unknown';

    try {
      const matchedSong = await matchSong(row, songColumns);
      const cleanTitle = cleanKpopTrackTitle(row.Title, row.Main_Artist, row.Original_Artist);
      if (!matchedSong) {
        unmatched += 1;
        logRowStatus(processed, options.limit, rowIndex, 'unmatched', 'unmatched', cleanTitle);
        addFailure({
          reason: 'SONG_NOT_MATCHED_IN_DB',
          rawTitle: row.Title || '',
          cleanTitle,
          csv: row,
        });
        continue;
      }

      songId = matchedSong.id;

      if (!options.force && hasRaw(songId)) {
        skippedRaw += 1;
        logRowStatus(processed, options.limit, rowIndex, songId, 'skip raw', cleanTitle);
        continue;
      }

      if (!options.force && await hasImportedLyrics(songId)) {
        skippedImported += 1;
        logRowStatus(processed, options.limit, rowIndex, songId, 'skip imported', cleanTitle);
        continue;
      }

      logRowStatus(processed, options.limit, rowIndex, songId, 'crawl', cleanTitle);
      const fetchResult = await fetchLrclib(row, matchedSong);
      if (!fetchResult.raw) {
        failed += 1;
        console.log(`[failed] songId=${songId} reason=LYRICS_NOT_FOUND`);
        addFailure({
          reason: 'LYRICS_NOT_FOUND',
          songId,
          rawTitle: row.Title || '',
          cleanTitle: fetchResult.queryDebug.cleanTitle,
          csv: row,
          triedQueries: fetchResult.triedQueries,
        });
        continue;
      }

      const output = buildRawOutput(row, matchedSong, fetchResult.raw, fetchResult.queryDebug);
      const fileName = `song-${songId}-${slugify(matchedSong.artist || row.Main_Artist)}-${slugify(fetchResult.queryDebug.cleanTitle)}.json`;
      const outputPath = path.join(RAW_DIR, fileName);
      writeJson(outputPath, output);
      updateIndex({
        songId,
        title: matchedSong.title,
        artist: matchedSong.artist,
        album: row.Album || '',
        group: GROUP,
        genre: row.Genre || '',
        file: path.relative(PROJECT_ROOT, outputPath),
        provider: 'lrclib',
        providerLyricId: output.providerLyricId,
        syncType: output.syncType,
        fetchedAt: output.fetchedAt,
      });
      crawled += 1;
      console.log(`[success] songId=${songId} provider=lrclib syncType=${output.syncType}`);
    } catch (err) {
      failed += 1;
      const queryDebug = err.queryDebug || {};
      console.log(`[failed] songId=${songId} reason=REQUEST_ERROR`);
      addFailure({
        reason: err.response?.status === 404 ? 'LYRICS_NOT_FOUND' : 'REQUEST_ERROR',
        songId,
        rawTitle: row.Title || '',
        cleanTitle: queryDebug.cleanTitle || cleanKpopTrackTitle(row.Title, row.Main_Artist, row.Original_Artist),
        csv: row,
        triedQueries: queryDebug.triedQueries || [],
        message: err.message,
      });
    } finally {
      state.lastProcessedRow = rowIndex;
      state.summary = { crawled, skippedRaw, skippedImported, failed, unmatched };
      writeState(state);
      if (options.delay > 0) await sleep(options.delay);
    }
  }

  if (processed === 0 || startRow >= rows.length) {
    console.log('No more KPOP rows to process.');
  }

  console.log('KPOP lyrics crawl summary:', {
    group: GROUP,
    startRow,
    endRow,
    crawled,
    failed,
    unmatched,
    skippedRaw,
    skippedImported,
    nextStartRow: endRow + 1,
  });
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('KPOP lyrics crawl failed:', err.message);
      process.exit(1);
    })
    .finally(() => pool.end());
}

module.exports = {
  cleanKpopTrackTitle,
  cleanKpopArtistName,
  buildKpopLrclibQueryVariants,
  candidateTitleMatches,
  candidateArtistMatches,
};
