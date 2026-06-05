require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { normalizeLrclibResponse } = require('../src/services/lyrics.service');
const { normalizeNhacCuaTuiLyrics } = require('../src/services/nhaccuatuiLyrics.service');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const RAW_DIR = path.join(ROOT_DIR, 'datasets', 'raw', 'lyrics', 'lrclib');
const NHACCUATUI_RAW_DIR = path.join(ROOT_DIR, 'datasets', 'raw', 'lyrics', 'nhaccuatui');
const PROCESSED_DIR = path.join(ROOT_DIR, 'datasets', 'processed', 'lyrics');
const LYRIC_GROUPS = ['vpop', 'kpop', 'usuk', 'unknown'];

function parseArgs(argv) {
  const options = { limit: null, songId: null, force: false };

  for (const arg of argv) {
    const [key, rawValue] = arg.replace(/^--/, '').split('=');
    const value = rawValue === undefined ? true : rawValue;
    if (key === 'limit') options.limit = Number(value);
    if (key === 'songId') options.songId = Number(value);
    if (key === 'group') options.group = String(value).toLowerCase();
    if (key === 'force') options.force = value === true || value === 'true' || value === '1';
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) options.limit = null;
  if (!Number.isInteger(options.songId) || options.songId <= 0) options.songId = null;
  if (options.group && !LYRIC_GROUPS.includes(options.group)) {
    throw new Error(`Invalid --group value: ${options.group}. Use vpop, kpop, usuk, or unknown.`);
  }

  return options;
}

function cleanText(value) {
  return String(value || '').trim();
}

function detectLyricsGroup(genre) {
  const normalized = cleanText(genre).toLowerCase();
  if (normalized.includes('vpop') || normalized.startsWith('vpop')) return 'vpop';
  if (normalized.includes('kpop') || normalized.startsWith('kpop')) return 'kpop';
  if (normalized.includes('usuk') || normalized.startsWith('usuk')) return 'usuk';
  return 'unknown';
}

function inferGroupFromRawFile(filePath) {
  const rawFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return detectLyricsGroup(rawFile.csv?.Genre);
}

function getGroups(group) {
  return group ? [group] : LYRIC_GROUPS;
}

function ensureGroupDirs() {
  for (const group of LYRIC_GROUPS) {
    fs.mkdirSync(path.join(RAW_DIR, group), { recursive: true });
    fs.mkdirSync(path.join(NHACCUATUI_RAW_DIR, group), { recursive: true });
    fs.mkdirSync(path.join(PROCESSED_DIR, group), { recursive: true });
  }
}

function getRawFiles(songId, group) {
  const groups = getGroups(group);
  const files = [];

  for (const currentGroup of groups) {
    for (const providerDir of [RAW_DIR, NHACCUATUI_RAW_DIR]) {
      const groupDir = path.join(providerDir, currentGroup);
      if (!fs.existsSync(groupDir)) continue;

      files.push(...fs.readdirSync(groupDir)
        .filter((fileName) => /^song-\d+(?:-[a-z0-9-]+)?\.json$/.test(fileName))
        .filter((fileName) => !songId || fileName.startsWith(`song-${songId}`))
        .map((fileName) => path.join(groupDir, fileName)));
    }
  }

  return files;
}

function plainLyricsToLines(plainLyrics) {
  return String(plainLyrics || '')
    .split(/\r?\n/)
    .map((words) => cleanText(words))
    .filter(Boolean)
    .map((words) => ({ startTimeMs: null, endTimeMs: null, words }));
}

function normalizeRawFile(filePath) {
  const rawFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const provider = rawFile.provider || 'lrclib';
  const normalized = provider === 'nhaccuatui'
    ? normalizeNhacCuaTuiLyrics({
      ...(rawFile.raw || {}),
      providerLyricId: rawFile.providerLyricId,
      sourceUrl: rawFile.sourceUrl,
      confidenceScore: rawFile.confidenceScore,
      plainLyrics: rawFile.plainLyrics,
    })
    : normalizeLrclibResponse(rawFile.raw || rawFile);
  const lines = provider === 'nhaccuatui'
    ? plainLyricsToLines(normalized.plainLyrics)
    : (normalized.lyricsJson.lines || []);

  return {
    songId: rawFile.songId,
    group: detectLyricsGroup(rawFile.csv?.Genre),
    provider: normalized.provider,
    providerLyricId: normalized.providerLyricId,
    syncType: normalized.syncType,
    plainLyrics: normalized.plainLyrics,
    syncedLyrics: normalized.syncedLyrics,
    lines,
    lyricsJson: {
      ...normalized.lyricsJson,
      lines,
      csv: rawFile.csv || null,
      matchedSong: rawFile.matchedSong || null,
      fetchedAt: rawFile.fetchedAt || null,
      fallbackUsed: rawFile.fallbackUsed || false,
      providerPriority: rawFile.providerPriority || (provider === 'nhaccuatui' ? 2 : 1),
    },
    sourceUrl: normalized.sourceUrl,
    confidenceScore: normalized.confidenceScore,
    normalizedAt: new Date().toISOString(),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureGroupDirs();

  const files = getRawFiles(options.songId, options.group).slice(0, options.limit || undefined);
  const normalizedByGroup = new Map(LYRIC_GROUPS.map((group) => [group, []]));
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const normalized = normalizeRawFile(filePath);
      const group = normalized.group || inferGroupFromRawFile(filePath);
      const outputPath = path.join(PROCESSED_DIR, group, `normalized-song-${normalized.songId}.json`);

      if (!options.force && fs.existsSync(outputPath)) {
        skipped += 1;
        normalizedByGroup.get(group).push(JSON.parse(fs.readFileSync(outputPath, 'utf8')));
        continue;
      }

      fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2), 'utf8');
      normalizedByGroup.get(group).push(normalized);
      processed += 1;
    } catch (err) {
      failed += 1;
      console.error(`Normalize failed for ${path.basename(filePath)}: ${err.message}`);
    }
  }

  for (const [group, items] of normalizedByGroup.entries()) {
    if (options.group && group !== options.group) continue;
    const aggregateFile = path.join(PROCESSED_DIR, group, 'normalized-lyrics.json');
    fs.writeFileSync(aggregateFile, JSON.stringify(items, null, 2), 'utf8');
  }

  console.log(`Lyrics normalize done. files=${files.length}, processed=${processed}, skipped=${skipped}, failed=${failed}`);
}

main().catch((err) => {
  console.error('Lyrics normalize failed:', err.message);
  process.exit(1);
});
