const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool } = require('../src/config/database');
const { computeFileSha256 } = require('../src/utils/fileHash.util');
const { resolveUploadUrl, uploadsRoot } = require('../src/utils/uploadPathResolver');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']);
const FINAL_SONGS_ROOT = path.resolve(__dirname, '../uploads/music/final_songs');

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildAudioFileIndex() {
  const index = new Map();
  const roots = [uploadsRoot, FINAL_SONGS_ROOT];

  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile() || !AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      index.set(normalizeKey(entry.name), fullPath);
      index.set(normalizeKey(path.basename(entry.name, path.extname(entry.name))), fullPath);
    }
  }

  roots.forEach(visit);
  return index;
}

function resolveAudioPath(audioUrl, audioIndex) {
  if (!audioUrl) return null;

  const uploadResolved = resolveUploadUrl(audioUrl);
  if (uploadResolved.ok && fs.existsSync(uploadResolved.absolutePath)) {
    return uploadResolved.absolutePath;
  }

  const clean = String(audioUrl).replace(/\\/g, '/').trim();
  const filename = path.basename(clean);
  const stem = path.basename(filename, path.extname(filename));
  return audioIndex.get(normalizeKey(filename)) || audioIndex.get(normalizeKey(stem)) || null;
}

async function ensureSchema() {
  const [columns] = await pool.query("SHOW COLUMNS FROM songs LIKE 'audio_hash'");
  if (!columns.length) {
    await pool.query('ALTER TABLE songs ADD COLUMN audio_hash VARCHAR(64) NULL');
  }

  const [indexes] = await pool.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'songs'
       AND INDEX_NAME = 'idx_songs_audio_hash'
     LIMIT 1`
  );
  if (!indexes.length) {
    await pool.query('CREATE INDEX idx_songs_audio_hash ON songs(audio_hash)');
  }
}

async function main() {
  const apply = hasArg('apply');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=').slice(1).join('=')) : null;

  await ensureSchema();

  const audioIndex = buildAudioFileIndex();
  const params = [];
  let limitSql = '';
  if (limit && Number.isFinite(limit) && limit > 0) {
    limitSql = ' LIMIT ?';
    params.push(limit);
  }

  const [songs] = await pool.query(
    `SELECT id, title, audio_url
     FROM songs
     WHERE audio_url IS NOT NULL
       AND TRIM(audio_url) <> ''
       AND audio_hash IS NULL
     ORDER BY id${limitSql}`,
    params
  );

  console.log(`[AudioHash] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[AudioHash] Songs pending hash: ${songs.length}`);
  console.log(`[AudioHash] Indexed audio files: ${audioIndex.size}`);

  let updated = 0;
  let missing = 0;
  let failed = 0;

  for (const song of songs) {
    const audioPath = resolveAudioPath(song.audio_url, audioIndex);
    if (!audioPath) {
      missing += 1;
      console.warn(`[AudioHash] Missing file song_id=${song.id} title="${song.title}" audio_url="${song.audio_url}"`);
      continue;
    }

    try {
      const audioHash = await computeFileSha256(audioPath);
      if (apply) {
        await pool.query('UPDATE songs SET audio_hash = ? WHERE id = ?', [audioHash, song.id]);
      }
      updated += 1;
      console.log(`[AudioHash] ${apply ? 'Updated' : 'Would update'} song_id=${song.id} hash=${audioHash}`);
    } catch (error) {
      failed += 1;
      console.warn(`[AudioHash] Failed song_id=${song.id}: ${error.message}`);
    }
  }

  console.log(`[AudioHash] Done. ${apply ? 'updated' : 'would_update'}=${updated}, missing=${missing}, failed=${failed}`);
}

main()
  .catch(error => {
    console.error('[AudioHash] Fatal:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
