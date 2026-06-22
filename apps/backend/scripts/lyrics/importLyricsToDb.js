const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});

const { pool } = require('../../src/config/database');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..', '..');
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
  const options = { limit: null, songId: null, songIds: [], force: false };

  for (const arg of argv) {
    const [key, rawValue] = arg.replace(/^--/, '').split('=');
    const value = rawValue === undefined ? true : rawValue;
    if (key === 'limit') options.limit = Number(value);
    if (key === 'songId') options.songId = Number(value);
    if (key === 'songIds') {
      options.songIds = String(value)
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item > 0);
    }
    if (key === 'group') options.group = String(value).toLowerCase();
    if (key === 'force') options.force = value === true || value === 'true' || value === '1';
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) options.limit = null;
  if (!Number.isInteger(options.songId) || options.songId <= 0) options.songId = null;
  if (options.songId && !options.songIds.includes(options.songId)) options.songIds.unshift(options.songId);
  if (options.group && !LYRIC_GROUPS.includes(options.group)) {
    throw new Error(`Invalid --group value: ${options.group}. Use vpop, kpop, usuk, or unknown.`);
  }

  return options;
}

function getGroups(group) {
  return group ? [group] : LYRIC_GROUPS;
}

function getNormalizedFiles(songIds, group) {
  const files = [];
  const allowedSongIds = new Set(Array.isArray(songIds) ? songIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0) : []);

  for (const currentGroup of getGroups(group)) {
    const groupDir = path.join(PROCESSED_DIR, currentGroup);
    if (!fs.existsSync(groupDir)) continue;

    files.push(...fs.readdirSync(groupDir)
      .filter((fileName) => /^normalized-song-\d+\.json$/.test(fileName))
      .filter((fileName) => {
        if (!allowedSongIds.size) return true;
        const songId = Number(fileName.match(/normalized-song-(\d+)\.json$/)?.[1]);
        return allowedSongIds.has(songId);
      })
      .map((fileName) => path.join(groupDir, fileName)));
  }

  return files;
}

function hasTimestampedSyncedLyrics(value) {
  if (typeof value !== 'string') return false;
  return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(value);
}

function normalizeImportPayload(normalized) {
  const songId = Number(normalized?.songId);
  const plainLyrics = typeof normalized?.plainLyrics === 'string' ? normalized.plainLyrics.trim() : '';
  const rawSyncedLyrics = typeof normalized?.syncedLyrics === 'string' ? normalized.syncedLyrics.trim() : '';
  const syncedLyrics = hasTimestampedSyncedLyrics(rawSyncedLyrics) ? rawSyncedLyrics : '';
  const syncType = typeof normalized?.syncType === 'string' ? normalized.syncType.trim().toUpperCase() : '';
  const provider = typeof normalized?.provider === 'string' ? normalized.provider.trim() : '';
  const providerLyricId = normalized?.providerLyricId !== undefined && normalized?.providerLyricId !== null
    ? String(normalized.providerLyricId).trim()
    : '';

  return {
    songId,
    plainLyrics,
    syncedLyrics,
    syncType,
    provider,
    providerLyricId,
    hasPlainLyrics: Boolean(plainLyrics),
    hasSyncedLyrics: Boolean(syncedLyrics),
  };
}

async function getSongRow(songId) {
  const [rows] = await pool.query(
    `SELECT id, title, lyrics, synced_lyrics, lyrics_sync_type, lyrics_provider, lyrics_provider_id
     FROM songs
     WHERE id = ?
     LIMIT 1`,
    [songId]
  );

  return rows[0] || null;
}

async function importLyricsToSong(normalized, options = {}) {
  const payload = normalizeImportPayload(normalized);
  if (!Number.isInteger(payload.songId) || payload.songId <= 0) {
    throw new Error('songId khong hop le');
  }

  const song = await getSongRow(payload.songId);
  if (!song) {
    return {
      songId: payload.songId,
      title: null,
      hasPlainLyrics: payload.hasPlainLyrics,
      hasSyncedLyrics: payload.hasSyncedLyrics,
      syncType: payload.syncType || null,
      status: 'skipped',
      reason: 'song_not_found',
    };
  }

  const updates = [];
  const params = [];

  if (payload.hasPlainLyrics && (options.force || song.lyrics !== payload.plainLyrics)) {
    updates.push('lyrics = ?');
    params.push(payload.plainLyrics);
  }

  if (payload.hasSyncedLyrics && (options.force || song.synced_lyrics !== payload.syncedLyrics)) {
    updates.push('synced_lyrics = ?');
    params.push(payload.syncedLyrics);
  }

  if (payload.syncType && (options.force || song.lyrics_sync_type !== payload.syncType)) {
    updates.push('lyrics_sync_type = ?');
    params.push(payload.syncType);
  }

  if (payload.provider && (options.force || song.lyrics_provider !== payload.provider)) {
    updates.push('lyrics_provider = ?');
    params.push(payload.provider);
  }

  if (payload.providerLyricId && (options.force || String(song.lyrics_provider_id || '') !== payload.providerLyricId)) {
    updates.push('lyrics_provider_id = ?');
    params.push(payload.providerLyricId);
  }

  if (!updates.length) {
    return {
      songId: payload.songId,
      title: song.title || null,
      hasPlainLyrics: payload.hasPlainLyrics,
      hasSyncedLyrics: payload.hasSyncedLyrics,
      syncType: payload.syncType || song.lyrics_sync_type || null,
      status: 'skipped',
      reason: 'no_changes',
    };
  }

  updates.push('lyrics_updated_at = NOW()');
  params.push(payload.songId);

  await pool.query(
    `UPDATE songs
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params
  );

  return {
    songId: payload.songId,
    title: song.title || null,
    hasPlainLyrics: payload.hasPlainLyrics,
    hasSyncedLyrics: payload.hasSyncedLyrics,
    syncType: payload.syncType || song.lyrics_sync_type || null,
    status: 'updated',
  };
}

function logImportResult(result) {
  console.log(
    `[lyrics-import] songId=${result.songId} title=${JSON.stringify(result.title || '')} hasPlainLyrics=${result.hasPlainLyrics} hasSyncedLyrics=${result.hasSyncedLyrics} syncType=${result.syncType || 'NONE'} status=${result.status}${result.reason ? ` reason=${result.reason}` : ''}`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  logDbConfig();
  const files = getNormalizedFiles(options.songIds, options.group).slice(0, options.limit || undefined);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const normalized = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = await importLyricsToSong(normalized, { force: options.force });
      logImportResult(result);
      if (result.status === 'updated') imported += 1;
      else skipped += 1;
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
