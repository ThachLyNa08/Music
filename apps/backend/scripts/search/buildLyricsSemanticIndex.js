const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool } = require('../../src/config/database');
const { normalizeVietnamese } = require('../../src/utils/vietnameseText.util');
const { INDEX_PATH, buildSparseVector } = require('../../src/services/lyricsSemanticSearch.service');

function stripLrcMetadata(value = '') {
  return String(value || '')
    .replace(/\[[0-9]{1,2}:[0-9]{2}(?:[.:][0-9]{1,3})?\]/g, ' ')
    .replace(/\[(?:ar|al|ti|by|offset|length|re|ve):[^\]]*\]/gi, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function pickLyrics(row) {
  const candidates = [
    ['song_lyrics.plain_lyrics', row.plain_lyrics],
    ['songs.lyrics', row.song_lyrics],
    ['song_lyrics.synced_lyrics', row.table_synced_lyrics],
    ['songs.synced_lyrics', row.song_synced_lyrics],
  ];

  for (const [source, value] of candidates) {
    if (value && String(value).trim()) {
      return { source, lyrics: stripLrcMetadata(value) };
    }
  }

  return null;
}

function chunkLyrics(lyrics = '') {
  const lines = String(lyrics)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < lines.length; i += 3) {
    const chunkLines = lines.slice(i, i + 3);
    if (chunkLines.join(' ').length < 12 && i + 3 < lines.length) {
      chunkLines.push(lines[i + 3]);
      i += 1;
    }
    chunks.push(chunkLines.join(' / '));
  }
  return chunks;
}

async function run() {
  const [rows] = await pool.query(`
    SELECT
      s.id AS song_id,
      s.lyrics AS song_lyrics,
      s.synced_lyrics AS song_synced_lyrics,
      sl.plain_lyrics,
      sl.synced_lyrics AS table_synced_lyrics
    FROM songs s
    LEFT JOIN song_lyrics sl ON sl.song_id = s.id
    WHERE COALESCE(
      NULLIF(sl.plain_lyrics, ''),
      NULLIF(s.lyrics, ''),
      NULLIF(sl.synced_lyrics, ''),
      NULLIF(s.synced_lyrics, '')
    ) IS NOT NULL
  `);

  const chunks = [];
  for (const row of rows) {
    const selected = pickLyrics(row);
    if (!selected) continue;

    const lyricChunks = chunkLyrics(selected.lyrics);
    lyricChunks.forEach((chunkText, index) => {
      const normalized = normalizeVietnamese(chunkText);
      if (!normalized || normalized.length < 8) return;
      const { vector, norm } = buildSparseVector(normalized);
      chunks.push({
        song_id: Number(row.song_id),
        chunk_index: index,
        original_text: chunkText,
        normalized_text: normalized,
        vector,
        norm,
        source: selected.source,
        updated_at: new Date().toISOString(),
      });
    });
  }

  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify({
    version: 1,
    algorithm: 'local_sparse_word_char_ngram_cosine',
    chunking: '2-4 lyric lines',
    generated_at: new Date().toISOString(),
    total_songs_seen: rows.length,
    total_chunks: chunks.length,
    chunks,
  }, null, 2), 'utf8');

  console.log(`[lyrics-index] Songs scanned: ${rows.length}`);
  console.log(`[lyrics-index] Chunks indexed: ${chunks.length}`);
  console.log(`[lyrics-index] Wrote ${INDEX_PATH}`);
  await pool.end();
}

run().catch(async (error) => {
  console.error('[lyrics-index] Failed:', error);
  try { await pool.end(); } catch {}
  process.exit(1);
});
