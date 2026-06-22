require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'musicflow';

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
  if (await columnExists(conn, tableName, columnName)) return;
  await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`Added ${tableName}.${columnName}`);
}

async function addIndexIfMissing(conn, tableName, indexName, definition) {
  if (await indexExists(conn, tableName, indexName)) return;
  await conn.query(`ALTER TABLE ${tableName} ADD ${definition}`);
  console.log(`Added index ${tableName}.${indexName}`);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: DB_NAME,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await addColumnIfMissing(conn, 'artists', 'short_bio', 'TEXT NULL');
    await addColumnIfMissing(conn, 'artists', 'genres_json', 'JSON NULL');
    await addColumnIfMissing(conn, 'artists', 'country', 'VARCHAR(100) NULL');
    await addColumnIfMissing(conn, 'artists', 'popularity', 'INT NULL');
    await addColumnIfMissing(conn, 'artists', 'followers', 'INT NULL');
    await addColumnIfMissing(conn, 'artists', 'spotify_artist_id', 'VARCHAR(100) NULL');
    await addColumnIfMissing(conn, 'artists', 'external_url', 'VARCHAR(500) NULL');
    await addColumnIfMissing(conn, 'artists', 'avatar_source', 'VARCHAR(50) NULL');
    await addColumnIfMissing(conn, 'artists', 'metadata_source', 'VARCHAR(50) NULL');
    await addColumnIfMissing(conn, 'artists', 'metadata_source_url', 'VARCHAR(500) NULL');
    await addColumnIfMissing(conn, 'artists', 'metadata_fetched_at', 'DATETIME NULL');

    await addIndexIfMissing(conn, 'artists', 'idx_artists_spotify_artist_id', 'INDEX idx_artists_spotify_artist_id (spotify_artist_id)');
    await addIndexIfMissing(conn, 'artists', 'idx_artists_metadata_fetched_at', 'INDEX idx_artists_metadata_fetched_at (metadata_fetched_at)');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('Artist metadata migration failed:', error);
  process.exit(1);
});
