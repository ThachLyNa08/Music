const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
});

const { pool } = require('../src/config/database');
const { saveLyrics } = require('../src/services/lyrics.service');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const PROCESSED_DIR = path.join(ROOT_DIR, 'datasets', 'processed', 'lyrics');
const LYRIC_GROUPS = ['vpop', 'kpop', 'usuk', 'unknown'];

function logDbConfig() {
  console.log('[lyrics-import] DB config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    passwordLoaded: Boolean(process.env.DB_PASSWORD),
  });
}

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

function getGroups(group) {
  return group ? [group] : LYRIC_GROUPS;
}

function getNormalizedFiles(songId, group) {
  const files = [];

  for (const currentGroup of getGroups(group)) {
    const groupDir = path.join(PROCESSED_DIR, currentGroup);
    if (!fs.existsSync(groupDir)) continue;

    files.push(...fs.readdirSync(groupDir)
      .filter((fileName) => /^normalized-song-\d+\.json$/.test(fileName))
      .filter((fileName) => !songId || fileName === `normalized-song-${songId}.json`)
      .map((fileName) => path.join(groupDir, fileName)));
  }

  return files;
}

async function getExistingLyrics(songId) {
  const [rows] = await pool.query(
    'SELECT provider, sync_type FROM song_lyrics WHERE song_id = ? LIMIT 1',
    [songId]
  );
  return rows[0] || null;
}

function getLyricsPriority(lyrics) {
  const provider = String(lyrics?.provider || '').toLowerCase();
  const syncType = String(lyrics?.sync_type || lyrics?.syncType || 'NONE').toUpperCase();

  if (provider === 'lrclib' && syncType === 'LINE_SYNCED') return 4;
  if (provider === 'lrclib' && syncType === 'PLAIN_TEXT') return 3;
  if (provider === 'nhaccuatui' && syncType === 'PLAIN_TEXT') return 2;
  if (syncType === 'PLAIN_TEXT') return 1;
  return 0;
}

async function shouldImportLyrics(normalized, force) {
  if (force) return true;

  const existing = await getExistingLyrics(normalized.songId);
  if (!existing) return true;

  const existingPriority = getLyricsPriority(existing);
  const incomingPriority = getLyricsPriority(normalized);

  if (existing.sync_type === 'LINE_SYNCED') return false;
  if (existingPriority > 0 && incomingPriority <= existingPriority) return false;

  return true;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  logDbConfig();
  const files = getNormalizedFiles(options.songId, options.group).slice(0, options.limit || undefined);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const normalized = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!await shouldImportLyrics(normalized, options.force)) {
        skipped += 1;
        continue;
      }

      await saveLyrics(normalized.songId, normalized);
      imported += 1;
    } catch (err) {
      failed += 1;
      console.error(`Import failed for ${path.basename(filePath)}: ${err.message}`);
    }
  }

  console.log(`Lyrics import done. files=${files.length}, imported=${imported}, skipped=${skipped}, failed=${failed}`);
}

main()
  .catch((err) => {
    console.error('Lyrics import failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
