const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'apps', 'backend');
const BACKEND_ENV_PATH = path.join(BACKEND_DIR, '.env');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'datasets', 'processed', 'artists_for_bio_crawl.csv');

const backendRequire = createRequire(path.join(BACKEND_DIR, 'package.json'));
const mysql = backendRequire('mysql2/promise');

const CSV_HEADERS = [
  'artist_id',
  'artist_name',
  'slug',
  'market',
  'genres',
  'song_count',
  'album_count',
  'avatar_url',
  'existing_bio',
  'bio_status',
  'search_query',
  'wikipedia_url',
  'lastfm_url',
  'spotify_url',
  'wikidata_id',
  'error_message',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing backend .env file: ${filePath}`);
  }

  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const equalsIndex = normalizedLine.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = normalizedLine.slice(0, equalsIndex).trim();
    let value = normalizedLine.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function quoteId(identifier) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
}

function firstExisting(columns, candidates) {
  return candidates.find((column) => columns.has(column)) || null;
}

function selectColumn(columns, alias, columnName, outputAlias, fallback = 'NULL') {
  if (!columnName || !columns.has(columnName)) {
    return `${fallback} AS ${quoteId(outputAlias)}`;
  }

  return `${alias}.${quoteId(columnName)} AS ${quoteId(outputAlias)}`;
}

function trimSqlExpression(expression) {
  return `NULLIF(TRIM(${expression}), '')`;
}

function groupConcatDistinct(expression) {
  const cleanExpression = trimSqlExpression(expression);
  return `GROUP_CONCAT(DISTINCT ${cleanExpression} ORDER BY ${cleanExpression} SEPARATOR '|')`;
}

function buildSongStatsSubquery({ songColumns, genresTable, genreColumns }) {
  if (!songColumns.has('artist_id')) return null;

  const joins = [];
  const hasGenreJoin =
    genresTable &&
    songColumns.has('genre_id') &&
    genreColumns.has('id') &&
    genreColumns.has('name');

  if (hasGenreJoin) {
    joins.push(`LEFT JOIN genres g ON g.${quoteId('id')} = s.${quoteId('genre_id')}`);
  }

  const songCountExpression = songColumns.has('id')
    ? `COUNT(DISTINCT s.${quoteId('id')})`
    : 'COUNT(*)';
  const albumCountExpression = songColumns.has('album_id')
    ? `COUNT(DISTINCT s.${quoteId('album_id')})`
    : '0';
  const marketExpression = songColumns.has('market')
    ? groupConcatDistinct(`s.${quoteId('market')}`)
    : 'NULL';

  const songGenreColumn = firstExisting(songColumns, ['genre', 'genres', 'genre_name']);
  const songSubgenreColumn = firstExisting(songColumns, ['subgenre', 'subgenres', 'subgenre_name']);
  const isActiveWhere = songColumns.has('is_active') ? `WHERE s.${quoteId('is_active')} = TRUE` : '';

  return `
    SELECT
      s.${quoteId('artist_id')} AS artist_id,
      ${songCountExpression} AS song_count,
      ${albumCountExpression} AS song_album_count,
      ${marketExpression} AS song_markets,
      ${hasGenreJoin ? groupConcatDistinct(`g.${quoteId('name')}`) : 'NULL'} AS genre_names,
      ${songGenreColumn ? groupConcatDistinct(`s.${quoteId(songGenreColumn)}`) : 'NULL'} AS song_genres,
      ${songSubgenreColumn ? groupConcatDistinct(`s.${quoteId(songSubgenreColumn)}`) : 'NULL'} AS song_subgenres
    FROM songs s
    ${joins.join('\n')}
    ${isActiveWhere}
    GROUP BY s.${quoteId('artist_id')}
  `;
}

function buildAlbumStatsSubquery({ albumColumns, genresTable, genreColumns }) {
  if (!albumColumns.has('artist_id') || !albumColumns.has('id')) return null;

  const hasGenreJoin =
    genresTable &&
    albumColumns.has('genre_id') &&
    genreColumns.has('id') &&
    genreColumns.has('name');

  return `
    SELECT
      al.${quoteId('artist_id')} AS artist_id,
      COUNT(DISTINCT al.${quoteId('id')}) AS album_count,
      ${hasGenreJoin ? groupConcatDistinct(`ag.${quoteId('name')}`) : 'NULL'} AS album_genres
    FROM albums al
    ${hasGenreJoin ? `LEFT JOIN genres ag ON ag.${quoteId('id')} = al.${quoteId('genre_id')}` : ''}
    GROUP BY al.${quoteId('artist_id')}
  `;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isValidArtistName(value) {
  const name = clean(value);
  if (!name) return false;

  const normalized = name.toLowerCase();
  if (['unknown', 'unknown artist', 'n/a', 'na', 'null', 'undefined'].includes(normalized)) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(name);
}

function splitList(value) {
  return clean(value)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);

  const raw = clean(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
  } catch (_) {
    return splitList(raw);
  }

  return [];
}

function uniqueList(values) {
  const seen = new Set();
  const result = [];

  for (const value of values.map(clean).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function buildGenres(row) {
  return uniqueList([
    ...parseJsonList(row.artist_genres_json),
    ...splitList(row.genre_names),
    ...splitList(row.song_genres),
    ...splitList(row.song_subgenres),
    ...splitList(row.album_genres),
  ]).join('|');
}

function buildSearchQuery(name, market) {
  const firstMarket = clean(market).split('|')[0].toUpperCase();
  if (firstMarket === 'VPOP') return `${name} ca si tieu su`;
  if (firstMarket === 'KPOP') return `${name} K-pop artist biography`;
  return `${name} artist biography`;
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';

  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function buildCsv(rows) {
  return [
    CSV_HEADERS.join(','),
    ...rows.map((row) => CSV_HEADERS.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\r\n');
}

function buildArtistQuery({ artistColumns, songStatsSubquery, albumStatsSubquery }) {
  const joins = [];
  const hasSongStats = Boolean(songStatsSubquery);
  const hasAlbumStats = Boolean(albumStatsSubquery);

  if (songStatsSubquery) {
    joins.push(`LEFT JOIN (${songStatsSubquery}) song_stats ON song_stats.artist_id = a.${quoteId('id')}`);
  }
  if (albumStatsSubquery) {
    joins.push(`LEFT JOIN (${albumStatsSubquery}) album_stats ON album_stats.artist_id = a.${quoteId('id')}`);
  }

  const artistMarketColumn = firstExisting(artistColumns, ['market']);
  const marketExpression = artistMarketColumn
    ? `COALESCE(${trimSqlExpression(`a.${quoteId(artistMarketColumn)}`)}, ${hasSongStats ? 'song_stats.song_markets' : 'NULL'})`
    : (hasSongStats ? 'song_stats.song_markets' : 'NULL');
  const songCountExpression = hasSongStats ? 'COALESCE(song_stats.song_count, 0)' : '0';
  const albumCountParts = [
    hasSongStats ? 'COALESCE(song_stats.song_album_count, 0)' : '0',
    hasAlbumStats ? 'COALESCE(album_stats.album_count, 0)' : '0',
  ];
  const albumCountExpression = `GREATEST(${albumCountParts.join(', ')})`;

  const bioColumn = firstExisting(artistColumns, ['bio']);
  const shortBioColumn = firstExisting(artistColumns, ['short_bio']);
  const bioMissingChecks = [];
  if (bioColumn) bioMissingChecks.push(`(${trimSqlExpression(`a.${quoteId(bioColumn)}`)} IS NULL)`);
  if (shortBioColumn) bioMissingChecks.push(`(${trimSqlExpression(`a.${quoteId(shortBioColumn)}`)} IS NULL)`);
  const missingBioExpression = bioMissingChecks.length ? bioMissingChecks.join(' AND ') : 'TRUE';

  const selectFields = [
    `a.${quoteId('id')} AS artist_id`,
    `a.${quoteId('name')} AS artist_name`,
    selectColumn(artistColumns, 'a', 'slug', 'slug'),
    `${marketExpression} AS market`,
    selectColumn(artistColumns, 'a', 'genres_json', 'artist_genres_json'),
    `${songCountExpression} AS song_count`,
    `${albumCountExpression} AS album_count`,
    selectColumn(artistColumns, 'a', 'avatar_url', 'avatar_url'),
    selectColumn(artistColumns, 'a', 'bio', 'bio'),
    selectColumn(artistColumns, 'a', 'short_bio', 'short_bio'),
    selectColumn(artistColumns, 'a', 'bio_source_url', 'bio_source_url'),
    selectColumn(artistColumns, 'a', 'wikipedia_url', 'wikipedia_url'),
    selectColumn(artistColumns, 'a', 'lastfm_url', 'lastfm_url'),
    selectColumn(artistColumns, 'a', 'spotify_url', 'spotify_url'),
    selectColumn(artistColumns, 'a', 'external_url', 'external_url'),
    selectColumn(artistColumns, 'a', 'spotify_artist_id', 'spotify_artist_id'),
    selectColumn(artistColumns, 'a', 'wikidata_id', 'wikidata_id'),
    selectColumn(artistColumns, 'a', firstExisting(artistColumns, ['error_message', 'bio_error', 'metadata_error']), 'error_message'),
    `${hasSongStats ? 'song_stats.genre_names' : 'NULL'} AS genre_names`,
    `${hasSongStats ? 'song_stats.song_genres' : 'NULL'} AS song_genres`,
    `${hasSongStats ? 'song_stats.song_subgenres' : 'NULL'} AS song_subgenres`,
    `${hasAlbumStats ? 'album_stats.album_genres' : 'NULL'} AS album_genres`,
    `CASE WHEN ${missingBioExpression} THEN 1 ELSE 0 END AS missing_bio`,
  ];

  return `
    SELECT
      ${selectFields.join(',\n      ')}
    FROM artists a
    ${joins.join('\n')}
    WHERE a.${quoteId('name')} IS NOT NULL
      AND TRIM(a.${quoteId('name')}) <> ''
      AND LOWER(TRIM(a.${quoteId('name')})) NOT IN ('unknown', 'unknown artist', 'n/a', 'na', 'null', 'undefined')
    ORDER BY missing_bio DESC, song_count DESC, artist_name ASC
  `;
}

function toCrawlerRow(row) {
  const artistName = clean(row.artist_name);
  const market = clean(row.market);
  const existingBio = clean(row.bio) || clean(row.short_bio);
  const bioStatus = existingBio ? 'existing' : 'pending';
  const bioSourceUrl = clean(row.bio_source_url);
  const explicitWikipediaUrl = clean(row.wikipedia_url);
  const explicitLastfmUrl = clean(row.lastfm_url);
  const explicitSpotifyUrl = clean(row.spotify_url) || clean(row.external_url);
  const spotifyArtistId = clean(row.spotify_artist_id);

  return {
    artist_id: row.artist_id,
    artist_name: artistName,
    slug: clean(row.slug) || slugify(artistName),
    market,
    genres: buildGenres(row),
    song_count: Number(row.song_count || 0),
    album_count: Number(row.album_count || 0),
    avatar_url: clean(row.avatar_url),
    existing_bio: existingBio,
    bio_status: bioStatus,
    search_query: buildSearchQuery(artistName, market),
    wikipedia_url: explicitWikipediaUrl || (/wikipedia\.org/i.test(bioSourceUrl) ? bioSourceUrl : ''),
    lastfm_url: explicitLastfmUrl || (/last\.fm/i.test(bioSourceUrl) ? bioSourceUrl : ''),
    spotify_url: explicitSpotifyUrl || (spotifyArtistId ? `https://open.spotify.com/artist/${spotifyArtistId}` : ''),
    wikidata_id: clean(row.wikidata_id),
    error_message: clean(row.error_message),
  };
}

async function main() {
  const env = parseEnvFile(BACKEND_ENV_PATH);
  const connection = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME || 'musicflow',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    charset: 'utf8mb4',
  });

  try {
    if (!(await tableExists(connection, 'artists'))) {
      throw new Error('Missing required table: artists');
    }

    const artistColumns = await getColumns(connection, 'artists');
    if (!artistColumns.has('id') || !artistColumns.has('name')) {
      throw new Error('Table artists must have id and name columns');
    }

    const hasSongs = await tableExists(connection, 'songs');
    const hasAlbums = await tableExists(connection, 'albums');
    const hasGenres = await tableExists(connection, 'genres');
    const songColumns = hasSongs ? await getColumns(connection, 'songs') : new Set();
    const albumColumns = hasAlbums ? await getColumns(connection, 'albums') : new Set();
    const genreColumns = hasGenres ? await getColumns(connection, 'genres') : new Set();

    const songStatsSubquery = hasSongs
      ? buildSongStatsSubquery({ songColumns, genresTable: hasGenres, genreColumns })
      : null;
    const albumStatsSubquery = hasAlbums
      ? buildAlbumStatsSubquery({ albumColumns, genresTable: hasGenres, genreColumns })
      : null;

    const query = buildArtistQuery({
      artistColumns,
      songStatsSubquery,
      albumStatsSubquery,
    });

    const [rows] = await connection.query(query);
    const crawlerRows = rows.filter((row) => isValidArtistName(row.artist_name)).map(toCrawlerRow);

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `\uFEFF${buildCsv(crawlerRows)}\r\n`, 'utf8');

    const pendingCount = crawlerRows.filter((row) => row.bio_status === 'pending').length;

    console.log(`Tong so nghe si export: ${crawlerRows.length}`);
    console.log(`File CSV: ${OUTPUT_PATH}`);
    console.log(`So nghe si pending can crawl: ${pendingCount}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Export artists for bio crawl failed: ${error.message}`);
  process.exit(1);
});
