const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool } = require('../../src/config/database');
const { normalizeVietnamese } = require('../../src/utils/vietnameseText.util');

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(conn, tableName, indexName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, tableName, columnName, definition) {
  if (!(await columnExists(conn, tableName, columnName))) {
    await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    console.log(`[migration] Added ${tableName}.${columnName}`);
  }
}

async function addIndexIfMissing(conn, tableName, indexName, definition) {
  if (!(await indexExists(conn, tableName, indexName))) {
    await conn.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} ${definition}`);
    console.log(`[migration] Added index ${tableName}.${indexName}`);
  }
}

async function backfillSongs(conn) {
  const [rows] = await conn.query(`
    SELECT id, lyrics
    FROM songs
    WHERE lyrics IS NOT NULL
      AND TRIM(lyrics) <> ''
  `);

  for (const row of rows) {
    await conn.query(
      'UPDATE songs SET lyrics_normalized = ? WHERE id = ?',
      [normalizeVietnamese(row.lyrics), row.id]
    );
  }

  console.log(`[migration] Backfilled songs.lyrics_normalized: ${rows.length}`);
}

async function backfillSongLyrics(conn) {
  const [rows] = await conn.query(`
    SELECT id, COALESCE(NULLIF(plain_lyrics, ''), NULLIF(synced_lyrics, '')) AS lyrics
    FROM song_lyrics
    WHERE COALESCE(NULLIF(plain_lyrics, ''), NULLIF(synced_lyrics, '')) IS NOT NULL
  `);

  for (const row of rows) {
    await conn.query(
      'UPDATE song_lyrics SET lyrics_normalized = ? WHERE id = ?',
      [normalizeVietnamese(row.lyrics), row.id]
    );
  }

  console.log(`[migration] Backfilled song_lyrics.lyrics_normalized: ${rows.length}`);
}

async function run() {
  const conn = await pool.getConnection();
  try {
    await addColumnIfMissing(conn, 'songs', 'lyrics_normalized', 'LONGTEXT NULL');
    await addColumnIfMissing(conn, 'song_lyrics', 'lyrics_normalized', 'LONGTEXT NULL');
    await addIndexIfMissing(conn, 'songs', 'idx_songs_title', '(title)');
    await addIndexIfMissing(conn, 'song_lyrics', 'idx_song_lyrics_song_id', '(song_id)');

    await backfillSongs(conn);
    await backfillSongLyrics(conn);
    console.log('[migration] Lyrics normalized migration complete');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('[migration] Failed to add lyrics_normalized:', error);
  process.exit(1);
});
