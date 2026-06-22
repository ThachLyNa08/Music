const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});

const axios = require('axios');
const csv = require('csv-parser');
const { pool } = require('../../src/config/database');
const { normalizeLrclibResponse } = require('../../src/services/lyrics.service');
const {
  searchNhacCuaTuiLyrics,
  fetchNhacCuaTuiLyricPage,
  normalizeNhacCuaTuiLyrics,
} = require('../../src/services/nhaccuatuiLyrics.service');

function resolveProjectRoot() {
  const cwd = process.cwd();

  if (fs.existsSync(path.join(cwd, 'datasets'))) {
    return cwd;
  }

  if (fs.existsSync(path.join(cwd, '..', '..', 'datasets'))) {
    return path.resolve(cwd, '..', '..');
  }

  return path.resolve(__dirname, '..', '..', '..', '..');
}

const PROJECT_ROOT = resolveProjectRoot();
const DEFAULT_CSV_PATH = path.join(PROJECT_ROOT, 'apps', 'backend', 'uploads', 'music');
const ROOT_DIR = PROJECT_ROOT;
const RAW_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'lrclib');
const NHACCUATUI_RAW_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'nhaccuatui');
const FAILED_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'failed');
const STATE_DIR = path.join(PROJECT_ROOT, 'datasets', 'raw', 'lyrics', 'state');
const LRCLIB_GET_URL = 'https://lrclib.net/api/get';
const LYRIC_GROUPS = ['vpop', 'kpop', 'usuk', 'unknown'];

function logDbConfig() {
  console.log('[lyrics-crawl] DB config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    passwordLoaded: Boolean(process.env.DB_PASSWORD),
  });
}

function parseArgs(argv) {
  const options = { limit: 50, offset: null, force: false, delay: 800 };

  for (const arg of argv) {
    const [key, rawValue] = arg.replace(/^--/, '').split('=');
    const value = rawValue === undefined ? true : rawValue;
    if (key === 'file') options.file = value;
    if (key === 'limit') {
      options.limit = Number(value);
      options.limitProvided = true;
    }
    if (key === 'offset') {
      options.offset = Number(value);
      options.offsetProvided = true;
    }
    if (key === 'delay') options.delay = Number(value);
    if (key === 'group') options.group = String(value).toLowerCase();
    if (key === 'retryFailed') options.retryFailed = value === true || value === 'true' || value === '1';
    if (key === 'resetCursor') options.resetCursor = value === true || value === 'true' || value === '1';
    if (key === 'showState') options.showState = value === true || value === 'true' || value === '1';
    if (key === 'force') options.force = value === true || value === 'true' || value === '1';
  }

  options.limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 50;
  options.offset = Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : null;
  options.delay = Number.isInteger(options.delay) && options.delay >= 0 ? options.delay : 800;
  options.file = options.file ? path.resolve(PROJECT_ROOT, options.file) : DEFAULT_CSV_PATH;
  if (options.group && !LYRIC_GROUPS.includes(options.group)) {
    throw new Error(`Invalid --group value: ${options.group}. Use vpop, kpop, usuk, or unknown.`);
  }

  return options;
}

function ensureDirs() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  for (const group of LYRIC_GROUPS) {
    fs.mkdirSync(path.join(RAW_DIR, group), { recursive: true });
    fs.mkdirSync(path.join(NHACCUATUI_RAW_DIR, group), { recursive: true });
    fs.mkdirSync(path.join(FAILED_DIR, group), { recursive: true });
  }
}

function resolveInputFiles(inputPath) {
  if (!fs.existsSync(inputPath)) {
    if (inputPath === DEFAULT_CSV_PATH) {
      throw new Error(
        'Không tìm thấy CSV mặc định: apps/backend/uploads/music\n'
        + 'Hãy kiểm tra lại file CSV hoặc sửa DEFAULT_CSV_PATH trong crawlLyricsFromLrclib.js'
      );
    }

    throw new Error(`CSV file not found: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(inputPath)
      .filter((fileName) => fileName.toLowerCase().endsWith('.csv'))
      .sort()
      .map((fileName) => path.join(inputPath, fileName));

    if (files.length === 0) {
      throw new Error(`No CSV files found in directory: ${inputPath}`);
    }

    return files;
  }

  if (path.extname(inputPath).toLowerCase() !== '.csv') {
    throw new Error(`Unsupported input file type: ${path.extname(inputPath)}. Please export/convert the song sheet to CSV first.`);
  }

  return [inputPath];
}

function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream
      .pipe(csv())
      .on('data', (row) => rows.push({ ...row, __sourceFile: path.relative(ROOT_DIR, filePath) }))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

async function readCsv(inputPath) {
  const files = resolveInputFiles(inputPath);
  const chunks = [];

  for (const filePath of files) {
    chunks.push(...await readCsvFile(filePath));
  }

  return chunks;
}

function readFailedRows(group) {
  const groups = group ? [group] : LYRIC_GROUPS;
  const rows = [];
  const seen = new Set();

  for (const currentGroup of groups) {
    for (const failure of readFailures(currentGroup)) {
      if (!failure?.csv) continue;
      const key = [
        currentGroup,
        normalizeForCompare(failure.csv.Title || failure.rawTitle || ''),
        normalizeForCompare(failure.csv.Main_Artist || ''),
        failure.songId || '',
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(failure.csv);
    }
  }

  return rows;
}

function detectLyricsGroup(genre) {
  const normalized = cleanText(genre).toLowerCase();
  if (normalized.includes('vpop') || normalized.startsWith('vpop')) return 'vpop';
  if (normalized.includes('kpop') || normalized.startsWith('kpop')) return 'kpop';
  if (normalized.includes('usuk') || normalized.startsWith('usuk')) return 'usuk';
  return 'unknown';
}

function getFailedFile(group) {
  return path.join(FAILED_DIR, group, 'failed-lyrics.json');
}

function readFailures(group) {
  const failedFile = getFailedFile(group);
  if (!fs.existsSync(failedFile)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFailures(group, failures) {
  fs.writeFileSync(getFailedFile(group), JSON.stringify(failures, null, 2), 'utf8');
}

function getStateFile(group) {
  return path.join(STATE_DIR, `${group}-crawl-state.json`);
}

function getDefaultState(group, sourceFile = '') {
  return {
    group,
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

function readCrawlState(group, sourceFile = '') {
  const stateFile = getStateFile(group);
  if (!fs.existsSync(stateFile)) return getDefaultState(group, sourceFile);

  try {
    return {
      ...getDefaultState(group, sourceFile),
      ...JSON.parse(fs.readFileSync(stateFile, 'utf8')),
      sourceFile,
    };
  } catch {
    return getDefaultState(group, sourceFile);
  }
}

function writeCrawlState(group, state) {
  fs.writeFileSync(getStateFile(group), JSON.stringify({
    ...state,
    group,
    lastRunAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

function resetCrawlState(group, sourceFile = '') {
  const state = getDefaultState(group, sourceFile);
  state.lastProcessedRow = -1;
  writeCrawlState(group, state);
  return state;
}

function getFailureKey(failure) {
  const songId = failure.songId || failure?.extra?.songId || failure?.csv?.songId || failure?.csv?.id || 'unknown';
  const title = normalizeForCompare(failure?.csv?.Title || failure.rawTitle || '');
  return `${songId}|${failure.reason}|${title}`;
}

function cleanText(value) {
  return String(value || '').trim();
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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeComparableName(value) {
  return normalizeForCompare(value).replace(/\s+/g, '');
}

function compactSpaces(value) {
  return cleanText(value).replace(/\s+/g, ' ');
}

function removeYoutubeNoiseSuffixes(title) {
  const noisePattern = [
    'official music video',
    'official lyrics video',
    'official lyric video',
    'official video',
    'official audio',
    'official mv',
    'lyrics video',
    'lyric video',
    'music video',
    'performance video',
    'live performance',
    'visualizer',
    'lyrics',
    'audio',
    'live',
    'm/v',
    'mv',
    'hd',
    '4k',
  ].map(escapeRegExp).join('|');

  let cleaned = title;
  const bracketNoise = new RegExp(`\\s*[\\[(]\\s*(?:${noisePattern})\\s*[\\])]\\s*`, 'gi');
  const trailingNoise = new RegExp(`\\s*(?:-|–|—|:)?\\s*(?:${noisePattern})\\s*$`, 'i');

  let previous;
  do {
    previous = cleaned;
    cleaned = cleaned.replace(bracketNoise, ' ');
    cleaned = cleaned.replace(trailingNoise, '');
    cleaned = compactSpaces(cleaned);
  } while (cleaned !== previous);

  return cleaned;
}

function removeArtistPrefix(title, mainArtist, originalArtist) {
  const separatorMatch = title.match(/\s*(?:-|–|—|:)\s*/);
  if (!separatorMatch || separatorMatch.index === undefined) return title;

  const prefix = title.slice(0, separatorMatch.index);
  const suffix = title.slice(separatorMatch.index + separatorMatch[0].length);
  if (!prefix || !suffix) return title;

  const normalizedPrefix = normalizeComparableName(prefix);
  const artists = [mainArtist, originalArtist]
    .map(normalizeComparableName)
    .filter(Boolean);

  if (artists.some((artist) => artist === normalizedPrefix)) {
    return suffix;
  }

  return title;
}

function cleanTrackTitle(rawTitle, mainArtist, originalArtist) {
  const originalTitle = compactSpaces(rawTitle);
  if (!originalTitle) return originalTitle;

  let cleaned = removeYoutubeNoiseSuffixes(originalTitle);
  cleaned = removeArtistPrefix(cleaned, mainArtist, originalArtist);
  cleaned = removeYoutubeNoiseSuffixes(cleaned);
  cleaned = compactSpaces(cleaned);

  return cleaned || originalTitle;
}

function slugify(value) {
  return normalizeForCompare(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'lyrics';
}

function hasRawLyrics(songId, group) {
  const lrclibPath = path.join(RAW_DIR, group, `song-${songId}.json`);
  if (fs.existsSync(lrclibPath)) return true;

  const nctDir = path.join(NHACCUATUI_RAW_DIR, group);
  if (!fs.existsSync(nctDir)) return false;

  return fs.readdirSync(nctDir).some((fileName) => fileName.startsWith(`song-${songId}-`) && fileName.endsWith('.json'));
}

async function hasImportedLyrics(songId) {
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM song_lyrics
       WHERE song_id = ?
         AND sync_type <> 'NONE'
       LIMIT 1`,
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
  const optionalColumns = [
    'duration_sec',
    'duration',
    'audio_url',
    'file_path',
    'youtube_url',
    'source_url',
    'external_url',
  ];

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

  const normalizedValue = value.replace(/\\/g, '/');
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

  const [rows] = await pool.query(
    `SELECT ${selectColumns}
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE LOWER(s.title) = LOWER(?)
       AND LOWER(a.name) = LOWER(?)
     LIMIT 1`,
    [title, artist]
  );
  if (rows[0]) return rows[0];

  const normalizedTitle = normalizeForCompare(title);
  const normalizedArtist = normalizeForCompare(artist);
  const [candidates] = await pool.query(
    `SELECT ${selectColumns}
     FROM songs s
     JOIN artists a ON s.artist_id = a.id
     WHERE s.title LIKE ?
        OR a.name LIKE ?
     LIMIT 50`,
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
  const title = cleanText(row.Title);
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

  return await findSongByTitleArtist(selectColumns, title, mainArtist)
    || await findSongByTitleArtist(selectColumns, title, originalArtist);
}

function getDuration(song) {
  const value = song?.duration_sec ?? song?.duration;
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
}

function addQueryVariant(variants, seen, variant) {
  const trackName = compactSpaces(variant.trackName);
  const artistName = compactSpaces(variant.artistName);
  if (!trackName || !artistName) return;

  const normalizedKey = [
    normalizeForCompare(trackName),
    normalizeForCompare(artistName),
    normalizeForCompare(variant.albumName || ''),
    variant.duration || '',
  ].join('|');

  if (seen.has(normalizedKey)) return;
  seen.add(normalizedKey);
  variants.push({
    trackName,
    artistName,
    albumName: compactSpaces(variant.albumName),
    duration: variant.duration || null,
    strategy: variant.strategy,
  });
}

function buildLrclibQueryVariants(csvRow, matchedSong) {
  const variants = [];
  const seen = new Set();
  const rawTitle = compactSpaces(csvRow.Title);
  const mainArtist = compactSpaces(csvRow.Main_Artist);
  const originalArtist = compactSpaces(csvRow.Original_Artist);
  const albumName = compactSpaces(csvRow.Album);
  const duration = getDuration(matchedSong);
  const cleanTitle = cleanTrackTitle(rawTitle, mainArtist, originalArtist);
  const originalArtistDiffers = originalArtist
    && normalizeComparableName(originalArtist) !== normalizeComparableName(mainArtist);

  addQueryVariant(variants, seen, {
    trackName: cleanTitle,
    artistName: mainArtist,
    albumName,
    duration,
    strategy: 'clean_title_main_artist_album_duration',
  });
  addQueryVariant(variants, seen, {
    trackName: cleanTitle,
    artistName: mainArtist,
    strategy: 'clean_title_main_artist',
  });

  if (originalArtistDiffers) {
    addQueryVariant(variants, seen, {
      trackName: cleanTitle,
      artistName: originalArtist,
      albumName,
      duration,
      strategy: 'clean_title_original_artist_album_duration',
    });
    addQueryVariant(variants, seen, {
      trackName: cleanTitle,
      artistName: originalArtist,
      strategy: 'clean_title_original_artist',
    });
  }

  addQueryVariant(variants, seen, {
    trackName: rawTitle,
    artistName: mainArtist,
    strategy: 'raw_title_main_artist',
  });

  const matchedTitle = compactSpaces(matchedSong?.title || matchedSong?.name);
  const matchedArtist = compactSpaces(matchedSong?.artist || matchedSong?.artist_name);
  if (matchedTitle && normalizeForCompare(matchedTitle) !== normalizeForCompare(rawTitle)) {
    addQueryVariant(variants, seen, {
      trackName: matchedTitle,
      artistName: matchedArtist || mainArtist,
      duration,
      strategy: 'matched_song_title_artist_duration',
    });
    addQueryVariant(variants, seen, {
      trackName: matchedTitle,
      artistName: matchedArtist || mainArtist,
      strategy: 'matched_song_title_artist',
    });
  }

  return variants;
}

function hasLyricsPayload(raw) {
  return Boolean(raw && (raw.syncedLyrics || raw.plainLyrics || raw.instrumental));
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
    headers: {
      'User-Agent': 'MusicFlow lyrics offline crawler (local script)',
    },
  });

  return data;
}

async function fetchLrclib(row, matchedSong, group) {
  const variants = buildLrclibQueryVariants(row, matchedSong);
  const rawTitle = compactSpaces(row.Title);
  const cleanTitle = cleanTrackTitle(rawTitle, row.Main_Artist, row.Original_Artist);
  const triedQueries = [];
  let requestError = null;

  for (const variant of variants) {
    console.log(
      `[lyrics] songId=${matchedSong.id} group=${group} rawTitle="${rawTitle}" `
      + `cleanTitle="${cleanTitle}" artistName="${variant.artistName}" strategy=${variant.strategy}`
    );

    try {
      const raw = await fetchLrclibVariant(variant);
      triedQueries.push({
        trackName: variant.trackName,
        artistName: variant.artistName,
        albumName: variant.albumName || null,
        duration: variant.duration || null,
        strategy: variant.strategy,
        status: 200,
      });

      if (hasLyricsPayload(raw)) {
        return {
          raw,
          queryDebug: {
            rawTitle,
            cleanTitle,
            artistName: variant.artistName,
            albumName: variant.albumName || null,
            duration: variant.duration || null,
            matchedStrategy: variant.strategy,
          },
          triedQueries,
        };
      }
    } catch (err) {
      const status = err.response?.status || null;
      triedQueries.push({
        trackName: variant.trackName,
        artistName: variant.artistName,
        albumName: variant.albumName || null,
        duration: variant.duration || null,
        strategy: variant.strategy,
        status,
      });

      if (status !== 404) {
        requestError = err;
      }
    }
  }

  if (requestError) {
    requestError.queryDebug = { rawTitle, cleanTitle, triedQueries };
    throw requestError;
  }

  return {
    raw: null,
    queryDebug: { rawTitle, cleanTitle, triedQueries },
    triedQueries,
  };
}

async function fetchNhacCuaTuiFallback(row, matchedSong) {
  const rawTitle = compactSpaces(row.Title);
  const cleanTitle = cleanTrackTitle(rawTitle, row.Main_Artist, row.Original_Artist);
  const artistName = compactSpaces(row.Main_Artist) || compactSpaces(row.Original_Artist);
  const searchResult = await searchNhacCuaTuiLyrics({ title: cleanTitle, artist: artistName });

  if (!searchResult.candidate) {
    return {
      normalized: null,
      reason: 'NHACCUATUI_NOT_FOUND',
      queryDebug: {
        rawTitle,
        cleanTitle,
        artistName,
        matchedStrategy: 'nhaccuatui_fallback',
      },
      triedQueries: [{
        trackName: cleanTitle,
        artistName,
        strategy: 'nhaccuatui_fallback',
      }],
    };
  }

  if (searchResult.lowConfidence) {
    return {
      normalized: null,
      reason: 'NHACCUATUI_LOW_CONFIDENCE',
      queryDebug: {
        rawTitle,
        cleanTitle,
        artistName,
        matchedStrategy: 'nhaccuatui_fallback',
        confidenceScore: searchResult.confidenceScore,
        candidate: searchResult.candidate,
      },
      triedQueries: [{
        trackName: cleanTitle,
        artistName,
        strategy: 'nhaccuatui_fallback',
        confidenceScore: searchResult.confidenceScore,
        candidateTitle: searchResult.candidate.title,
        candidateArtist: searchResult.candidate.artist,
      }],
    };
  }

  const page = await fetchNhacCuaTuiLyricPage(searchResult.candidate.url);
  if (!page.plainLyrics) {
    return {
      normalized: null,
      reason: 'NHACCUATUI_NOT_FOUND',
      queryDebug: {
        rawTitle,
        cleanTitle,
        artistName,
        matchedStrategy: 'nhaccuatui_fallback',
        confidenceScore: searchResult.confidenceScore,
        sourceUrl: searchResult.candidate.url,
      },
      triedQueries: [{
        trackName: cleanTitle,
        artistName,
        strategy: 'nhaccuatui_fallback',
        confidenceScore: searchResult.confidenceScore,
      }],
    };
  }

  const raw = {
    providerLyricId: searchResult.candidate.providerLyricId,
    sourceUrl: searchResult.candidate.url,
    candidate: searchResult.candidate,
    confidenceScore: searchResult.confidenceScore,
    plainLyrics: page.plainLyrics,
    page,
  };
  const normalized = normalizeNhacCuaTuiLyrics(raw);

  return {
    normalized,
    raw,
    reason: null,
    queryDebug: {
      rawTitle,
      cleanTitle,
      artistName,
      albumName: compactSpaces(row.Album) || null,
      duration: getDuration(matchedSong),
      matchedStrategy: 'nhaccuatui_fallback',
    },
    triedQueries: [{
      trackName: cleanTitle,
      artistName,
      strategy: 'nhaccuatui_fallback',
      confidenceScore: searchResult.confidenceScore,
      sourceUrl: searchResult.candidate.url,
    }],
  };
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
      Group: detectLyricsGroup(row.Genre),
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

function buildNhacCuaTuiRawOutput(row, matchedSong, fallbackResult) {
  const normalized = fallbackResult.normalized;

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
      Group: detectLyricsGroup(row.Genre),
      Source_File: row.__sourceFile || '',
    },
    matchedSong: {
      id: matchedSong.id,
      title: matchedSong.title,
      artist: matchedSong.artist,
      duration: getDuration(matchedSong),
    },
    provider: 'nhaccuatui',
    providerLyricId: normalized.providerLyricId,
    syncType: normalized.syncType,
    plainLyrics: normalized.plainLyrics,
    syncedLyrics: null,
    sourceUrl: normalized.sourceUrl,
    confidenceScore: normalized.confidenceScore,
    fallbackUsed: true,
    providerPriority: 2,
    fetchedAt: new Date().toISOString(),
    queryDebug: fallbackResult.queryDebug,
    raw: fallbackResult.raw,
  };
}

function addFailure(row, reason, extra = {}) {
  const group = detectLyricsGroup(row.Genre);
  const failures = readFailures(group);
  const nextFailure = {
    reason,
    group,
    csv: row,
    ...extra,
    failedAt: new Date().toISOString(),
  };
  const nextKey = getFailureKey(nextFailure);
  const index = failures.findIndex((failure) => getFailureKey(failure) === nextKey);
  if (index >= 0) {
    failures[index] = { ...failures[index], ...nextFailure };
  } else {
    failures.push(nextFailure);
  }
  writeFailures(group, failures);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGroupSourceFile(rows, group, fallbackPath) {
  const firstRow = rows.find((row) => detectLyricsGroup(row.Genre) === group);
  return firstRow?.__sourceFile || path.relative(ROOT_DIR, fallbackPath);
}

function logRowStatus(processedCount, limit, rowIndex, songId, status) {
  console.log(`[${processedCount}/${limit}] row=${rowIndex} songId=${songId} status=${status}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDirs();

  const rows = options.retryFailed ? readFailedRows(options.group) : await readCsv(options.file);
  const groupedRows = options.group
    ? rows.filter((row) => detectLyricsGroup(row.Genre) === options.group)
    : rows;
  const stateGroup = options.group || 'unknown';
  const sourceFile = getGroupSourceFile(rows, stateGroup, options.file);
  let state = readCrawlState(stateGroup, sourceFile);

  if (options.showState) {
    console.log(state);
    return;
  }

  if (options.resetCursor) {
    state = resetCrawlState(stateGroup, sourceFile);
    console.log(`Reset crawl cursor for group=${stateGroup}`);
    if (!options.limitProvided && !options.offsetProvided && !options.force && !options.retryFailed) {
      console.log(state);
      return;
    }
  }

  logDbConfig();

  const startRow = options.retryFailed
    ? (options.offset ?? 0)
    : (options.offset ?? Math.max(0, Number(state.lastProcessedRow || -1) + 1));
  const songColumns = await getSongColumns();

  let scannedRows = 0;
  let crawled = 0;
  let skippedRaw = 0;
  let skippedImported = 0;
  let failed = 0;
  let unmatched = 0;
  let endRow = startRow - 1;

  for (let rowIndex = startRow; rowIndex < groupedRows.length; rowIndex += 1) {
    if (scannedRows >= options.limit) break;
    const row = groupedRows[rowIndex];
    scannedRows += 1;
    endRow = rowIndex;
    const group = detectLyricsGroup(row.Genre);
    let currentSongId = 'unknown';
    let rowStatus = 'unknown';
    try {
      const matchedSong = await matchSong(row, songColumns);
      if (!matchedSong) {
        unmatched += 1;
        rowStatus = 'unmatched';
        logRowStatus(scannedRows, options.limit, rowIndex, 'unmatched', rowStatus);
        addFailure(row, 'SONG_NOT_MATCHED_IN_DB');
        continue;
      }
      currentSongId = matchedSong.id;

      if (!options.force && hasRawLyrics(matchedSong.id, group)) {
        skippedRaw += 1;
        rowStatus = 'skip raw';
        logRowStatus(scannedRows, options.limit, rowIndex, matchedSong.id, rowStatus);
        continue;
      }

      if (!options.force && await hasImportedLyrics(matchedSong.id)) {
        skippedImported += 1;
        rowStatus = 'skip imported';
        logRowStatus(scannedRows, options.limit, rowIndex, matchedSong.id, rowStatus);
        continue;
      }

      rowStatus = 'crawl';
      logRowStatus(scannedRows, options.limit, rowIndex, matchedSong.id, rowStatus);
      const fetchResult = await fetchLrclib(row, matchedSong, group);
      if (!fetchResult.raw) {
        if (group === 'vpop') {
          const fallbackResult = await fetchNhacCuaTuiFallback(row, matchedSong);
          if (fallbackResult.normalized) {
            const nctOutputPath = path.join(
              NHACCUATUI_RAW_DIR,
              group,
              `song-${matchedSong.id}-${slugify(fallbackResult.queryDebug.cleanTitle)}.json`
            );
            fs.writeFileSync(
              nctOutputPath,
              JSON.stringify(buildNhacCuaTuiRawOutput(row, matchedSong, fallbackResult), null, 2),
              'utf8'
            );
            crawled += 1;
            rowStatus = 'crawled nhaccuatui';
            continue;
          }

          rowStatus = 'failed all providers';
          logRowStatus(scannedRows, options.limit, rowIndex, matchedSong.id, rowStatus);
          addFailure(row, 'ALL_PROVIDERS_NOT_FOUND', {
            songId: matchedSong.id,
            providerFailures: ['LRCLIB_NOT_FOUND', fallbackResult.reason],
            rawTitle: fetchResult.queryDebug.rawTitle,
            cleanTitle: fetchResult.queryDebug.cleanTitle,
            triedQueries: [
              ...fetchResult.triedQueries,
              ...fallbackResult.triedQueries,
            ],
          });
          failed += 1;
          continue;
        }

        rowStatus = 'failed lrclib';
        logRowStatus(scannedRows, options.limit, rowIndex, matchedSong.id, rowStatus);
        addFailure(row, 'LRCLIB_NOT_FOUND', {
          songId: matchedSong.id,
          providerFailures: ['LRCLIB_NOT_FOUND'],
          rawTitle: fetchResult.queryDebug.rawTitle,
          cleanTitle: fetchResult.queryDebug.cleanTitle,
          triedQueries: fetchResult.triedQueries,
        });
        failed += 1;
        continue;
      }

      const outputPath = path.join(RAW_DIR, group, `song-${matchedSong.id}.json`);
      fs.writeFileSync(
        outputPath,
        JSON.stringify(buildRawOutput(row, matchedSong, fetchResult.raw, fetchResult.queryDebug), null, 2),
        'utf8'
      );
      crawled += 1;
      rowStatus = 'crawled lrclib';
    } catch (err) {
      const status = err.response?.status;
      const queryDebug = err.queryDebug || {};
      rowStatus = status === 404 ? 'failed lyrics not found' : 'failed request';
      logRowStatus(scannedRows, options.limit, rowIndex, currentSongId, rowStatus);
      addFailure(row, status === 404 ? 'LYRICS_NOT_FOUND' : 'REQUEST_ERROR', {
        status,
        message: err.message,
        rawTitle: queryDebug.rawTitle || compactSpaces(row.Title),
        cleanTitle: queryDebug.cleanTitle || cleanTrackTitle(row.Title, row.Main_Artist, row.Original_Artist),
        triedQueries: queryDebug.triedQueries || [],
      });
      failed += 1;
    } finally {
      if (!options.retryFailed) {
        state.lastProcessedRow = rowIndex;
        state.summary = { crawled, skippedRaw, skippedImported, failed, unmatched };
        writeCrawlState(stateGroup, state);
      }
      if (options.delay > 0) await sleep(options.delay);
    }
  }

  if (scannedRows === 0 || startRow >= groupedRows.length) {
    console.log(`No more rows to process for group=${stateGroup}.`);
  }

  console.log('Lyrics crawl summary:', {
    group: stateGroup,
    startRow,
    endRow,
    scannedRows,
    crawled,
    skippedRaw,
    skippedImported,
    failed,
    unmatched,
    nextStartRow: endRow + 1,
    limit: options.limit,
  });
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Lyrics crawl failed:', err.message);
      process.exit(1);
    })
    .finally(() => pool.end());
}

module.exports = {
  cleanTrackTitle,
  buildLrclibQueryVariants,
};
