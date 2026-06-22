const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');

const stats = {
  totalRows: 0,
  downloadedRows: 0,
  importedSongs: 0,
  skippedDuplicates: 0,
  skippedMissingFile: 0,
  skippedInvalidRows: 0,
  skippedStatus: 0,
  skippedPending: 0,
  skippedMissingFileStatus: 0,
  failedRows: 0,
  createdArtists: 0,
  createdAlbums: 0,
  createdGenres: 0,
  updatedDuplicates: 0,
};

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeMarket(value) {
  const market = clean(value).toUpperCase();
  if (['KPOP', 'VPOP', 'USUK', 'OTHER'].includes(market)) return market;
  return market || 'OTHER';
}

function marketFolderFromMarket(value) {
  const market = normalizeMarket(value);
  if (market === 'KPOP') return 'Kpop';
  if (market === 'VPOP') return 'Vpop';
  if (market === 'USUK') return 'USUK';
  return 'Other';
}

function slugify(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(clean(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function cleanRelativePath(value) {
  let relativePath = clean(value).replace(/\\/g, '/');
  while (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }
  if (relativePath.toLowerCase().startsWith('uploads/')) {
    relativePath = relativePath.slice('uploads/'.length);
  }
  return relativePath;
}

function normalizeAudioUrlFromRow(row) {
  const audioUrl = clean(row.Audio_URL || row.audio_url);
  if (audioUrl) {
    if (audioUrl.startsWith('/uploads/')) return audioUrl;
    if (audioUrl.startsWith('uploads/')) return `/${audioUrl}`;
    if (audioUrl.startsWith('music/')) return `/uploads/${audioUrl}`;
    return audioUrl.startsWith('/') ? audioUrl : `/uploads/${audioUrl}`;
  }

  const filePath = cleanRelativePath(row.File_Path || row.file_path);
  if (!filePath) return '';
  if (filePath.toLowerCase().startsWith('music/final_songs/')) {
    return `/uploads/${filePath}`;
  }
  if (filePath.toLowerCase().startsWith('final_songs/')) {
    return `/uploads/music/${filePath}`;
  }
  if (/^(kpop|vpop|usuk|other)\//i.test(filePath)) {
    return `/uploads/music/final_songs/${filePath}`;
  }
  return `/uploads/music/final_songs/${marketFolderFromMarket(row.Market)}/${filePath}`;
}

function uploadsPathFromAudioUrl(audioUrl) {
  const normalizedUrl = clean(audioUrl).replace(/\\/g, '/');
  if (!normalizedUrl.startsWith('/uploads/')) return null;

  const relativeToUploads = normalizedUrl.slice('/uploads/'.length);
  const resolvedPath = path.resolve(UPLOADS_DIR, relativeToUploads);
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) && resolvedPath !== UPLOADS_DIR) {
    return null;
  }
  return resolvedPath;
}

function resolveCsvPath(fileArg) {
  if (!fileArg) {
    throw new Error('Missing required --file=path/to/metadata.csv');
  }

  if (path.isAbsolute(fileArg)) {
    return path.resolve(fileArg);
  }

  const candidates = [
    path.resolve(process.cwd(), fileArg),
    path.resolve(BACKEND_ROOT, fileArg),
  ];

  const normalizedArg = fileArg.replace(/\\/g, '/');
  if (normalizedArg.startsWith('../uploads/')) {
    candidates.push(path.resolve(BACKEND_ROOT, normalizedArg.slice('../'.length)));
  }
  if (normalizedArg.startsWith('uploads/')) {
    candidates.push(path.resolve(BACKEND_ROOT, normalizedArg));
  }

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Field));
}

async function getOrCreateGenre(connection, genreName) {
  const name = clean(genreName);
  const [existing] = await connection.query('SELECT id FROM genres WHERE name = ? LIMIT 1', [name]);
  if (existing.length) return existing[0].id;

  const slug = slugify(name);
  const [bySlug] = await connection.query('SELECT id FROM genres WHERE slug = ? LIMIT 1', [slug]);
  if (bySlug.length) return bySlug[0].id;

  const [result] = await connection.query('INSERT INTO genres (name, slug) VALUES (?, ?)', [name, slug]);
  stats.createdGenres += 1;
  return result.insertId;
}

async function getOrCreateArtist(connection, artistName) {
  const name = clean(artistName);
  const [existing] = await connection.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [name]);
  if (existing.length) return existing[0].id;

  const [result] = await connection.query('INSERT INTO artists (name) VALUES (?)', [name]);
  stats.createdArtists += 1;
  return result.insertId;
}

async function getOrCreateAlbum(connection, albumTitle, artistId, genreId, coverUrl, albumColumns) {
  const title = clean(albumTitle) || 'Single';
  const albumType = title.toLowerCase() === 'single' ? 'single' : 'album';
  const [existing] = await connection.query(
    'SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1',
    [title, artistId]
  );
  if (existing.length) {
    const updates = [];
    const values = [];

    if (coverUrl && albumColumns.has('cover_url')) {
      updates.push('cover_url = COALESCE(NULLIF(cover_url, ""), ?)');
      values.push(coverUrl);
    }
    if (albumColumns.has('album_type') && albumType === 'album') {
      updates.push("album_type = CASE WHEN album_type IS NULL OR album_type = '' OR album_type = 'single' THEN ? ELSE album_type END");
      values.push(albumType);
    }

    if (updates.length) {
      values.push(existing[0].id);
      await connection.query(
        `UPDATE albums SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
    return existing[0].id;
  }

  const fields = ['artist_id', 'genre_id', 'title'];
  const values = [artistId, genreId, title];
  if (albumColumns.has('album_type')) {
    fields.push('album_type');
    values.push(albumType);
  }
  if (albumColumns.has('total_tracks')) {
    fields.push('total_tracks');
    values.push(0);
  }
  if (albumColumns.has('cover_url')) {
    fields.push('cover_url');
    values.push(coverUrl || null);
  }

  const placeholders = fields.map(() => '?').join(', ');
  const [result] = await connection.query(
    `INSERT INTO albums (${fields.map((field) => `\`${field}\``).join(', ')}) VALUES (${placeholders})`,
    values
  );
  stats.createdAlbums += 1;
  return result.insertId;
}

async function syncAlbumTrackCount(connection, albumId, albumColumns) {
  if (!albumColumns.has('total_tracks')) return;

  const [[{ count }]] = await connection.query(
    'SELECT COUNT(*) AS count FROM songs WHERE album_id = ? AND is_active = 1',
    [albumId]
  );

  const updates = ['total_tracks = ?'];
  const values = [count, albumId];
  await connection.query(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`, values);
}

async function findDuplicateSong(connection, title, artistId, albumId, audioUrl) {
  const [byAudio] = await connection.query('SELECT * FROM songs WHERE audio_url = ? LIMIT 1', [audioUrl]);
  if (byAudio.length) return byAudio[0];

  const [byIdentity] = await connection.query(
    'SELECT * FROM songs WHERE title = ? AND artist_id = ? AND album_id = ? LIMIT 1',
    [title, artistId, albumId]
  );
  return byIdentity[0] || null;
}

async function updateDuplicateIfUseful(connection, duplicate, { coverUrl, market, genreId }, songColumns) {
  const updates = [];
  const values = [];

  if (coverUrl && songColumns.has('cover_url') && !clean(duplicate.cover_url)) {
    updates.push('cover_url = ?');
    values.push(coverUrl);
  }

  if (songColumns.has('market') && normalizeMarket(duplicate.market) === 'OTHER' && market !== 'OTHER') {
    updates.push('market = ?');
    values.push(market);
  }

  if (songColumns.has('genre_id') && !duplicate.genre_id && genreId) {
    updates.push('genre_id = ?');
    values.push(genreId);
  }

  if (!updates.length) return false;

  values.push(duplicate.id);
  await connection.query(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`, values);
  stats.updatedDuplicates += 1;
  return true;
}

async function insertSong(connection, song, songColumns) {
  const fields = ['title', 'artist_id', 'album_id', 'genre_id', 'duration_sec', 'audio_url'];
  const values = [
    song.title,
    song.artistId,
    song.albumId,
    song.genreId,
    song.durationSec,
    song.audioUrl,
  ];

  if (songColumns.has('cover_url')) {
    fields.push('cover_url');
    values.push(song.coverUrl || null);
  }
  if (songColumns.has('market')) {
    fields.push('market');
    values.push(song.market);
  }
  if (songColumns.has('is_active')) {
    fields.push('is_active');
    values.push(1);
  }

  const placeholders = fields.map(() => '?').join(', ');
  await connection.query(
    `INSERT INTO songs (${fields.map((field) => `\`${field}\``).join(', ')}) VALUES (${placeholders})`,
    values
  );
}

function getDownloadStatus(row) {
  if (!Object.prototype.hasOwnProperty.call(row, 'Download_Status')) return 'downloaded';
  return clean(row.Download_Status).toLowerCase();
}

function validateRow(row) {
  const title = clean(row.Title);
  const mainArtist = clean(row.Main_Artist);
  const genre = clean(row.Genre);
  const market = normalizeMarket(row.Market);
  const audioUrl = normalizeAudioUrlFromRow(row);

  if (!title || !mainArtist || !genre || !market || !audioUrl) {
    return { ok: false, title, mainArtist, genre, market, audioUrl };
  }

  return { ok: true, title, mainArtist, genre, market, audioUrl };
}

async function main() {
  const fileArg = getArg('file');
  let csvPath;
  try {
    csvPath = resolveCsvPath(fileArg);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Usage: node scripts/maintenance/importSongsFromMetadataCsv.js --file=../uploads/music/nct_metadata_pending.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Reading CSV: ${csvPath}`);
  const rows = await readCsv(csvPath);
  stats.totalRows = rows.length;
  stats.downloadedRows = rows.filter((row) => getDownloadStatus(row) === 'downloaded').length;
  const pendingRows = rows.filter((row) => getDownloadStatus(row) === 'pending').length;
  const missingFileRows = rows.filter((row) => getDownloadStatus(row) === 'missing_file').length;

  console.log(`Total rows: ${stats.totalRows}`);
  console.log(`Rows with Download_Status=downloaded: ${stats.downloadedRows}`);
  console.log(`Rows with Download_Status=pending: ${pendingRows}`);
  console.log(`Rows with Download_Status=missing_file: ${missingFileRows}`);

  const connection = await pool.getConnection();
  try {
    const albumColumns = await getColumns(connection, 'albums');
    const songColumns = await getColumns(connection, 'songs');

    console.log(`Album title column: ${albumColumns.has('title') ? 'albums.title' : 'NOT FOUND'}`);
    if (!albumColumns.has('title')) {
      throw new Error('Unsupported schema: albums.title column is missing.');
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 1;

      try {
        const downloadStatus = getDownloadStatus(row);
        if (downloadStatus !== 'downloaded') {
          stats.skippedStatus += 1;
          if (downloadStatus === 'pending') {
            stats.skippedPending += 1;
            console.log(`[${rowNumber}/${rows.length}] Skipped because Download_Status is pending: ${clean(row.Title) || '(no title)'}`);
          } else if (downloadStatus === 'missing_file') {
            stats.skippedMissingFileStatus += 1;
            console.log(`[${rowNumber}/${rows.length}] skipped because Download_Status is missing_file: ${clean(row.Title) || '(no title)'}`);
          } else {
            console.log(`[${rowNumber}/${rows.length}] skipped because Download_Status is ${downloadStatus || '(blank)'}: ${clean(row.Title) || '(no title)'}`);
          }
          continue;
        }

        const validated = validateRow(row);
        if (!validated.ok) {
          stats.skippedInvalidRows += 1;
          console.log(`[${rowNumber}/${rows.length}] invalid row: missing required fields`);
          continue;
        }

        const physicalPath = uploadsPathFromAudioUrl(validated.audioUrl);
        if (!physicalPath || !fs.existsSync(physicalPath)) {
          stats.skippedMissingFile += 1;
          console.log(`[${rowNumber}/${rows.length}] missing file: ${validated.title}`);
          console.log(`  audio_url: ${validated.audioUrl}`);
          console.log(`  physical: ${physicalPath || '(invalid audio url)'}`);
          continue;
        }

        const coverUrl = clean(row.Cover_URL);
        const albumTitle = clean(row.Album) || 'Single';
        const durationSec = toInt(row.Duration_Sec, 0);

        const genreId = await getOrCreateGenre(connection, validated.genre);
        const artistId = await getOrCreateArtist(connection, validated.mainArtist);
        const albumId = await getOrCreateAlbum(connection, albumTitle, artistId, genreId, coverUrl, albumColumns);

        const duplicate = await findDuplicateSong(
          connection,
          validated.title,
          artistId,
          albumId,
          validated.audioUrl
        );

        if (duplicate) {
          await updateDuplicateIfUseful(
            connection,
            duplicate,
            { coverUrl, market: validated.market, genreId },
            songColumns
          );
          await syncAlbumTrackCount(connection, albumId, albumColumns);
          stats.skippedDuplicates += 1;
          console.log(`[${rowNumber}/${rows.length}] duplicate skipped: ${validated.title}`);
          continue;
        }

        await insertSong(connection, {
          title: validated.title,
          artistId,
          albumId,
          genreId,
          durationSec,
          audioUrl: validated.audioUrl,
          coverUrl,
          market: validated.market,
        }, songColumns);

        stats.importedSongs += 1;
        await syncAlbumTrackCount(connection, albumId, albumColumns);
        console.log(`[${rowNumber}/${rows.length}] imported: ${validated.title} -> ${validated.audioUrl}`);
      } catch (err) {
        stats.failedRows += 1;
        console.error(`[${rowNumber}/${rows.length}] failed row: ${clean(row.Title) || '(no title)'} - ${err.message}`);
      }
    }
  } finally {
    connection.release();
    await pool.end();
  }

  console.log('\nImport summary');
  console.log('==============');
  console.log(`Total rows            : ${stats.totalRows}`);
  console.log(`Downloaded rows       : ${stats.downloadedRows}`);
  console.log(`Imported songs        : ${stats.importedSongs}`);
  console.log(`Skipped duplicates    : ${stats.skippedDuplicates}`);
  console.log(`Skipped missing files : ${stats.skippedMissingFile}`);
  console.log(`Skipped invalid rows  : ${stats.skippedInvalidRows}`);
  console.log(`Skipped status        : ${stats.skippedStatus}`);
  console.log(`Skipped pending       : ${stats.skippedPending}`);
  console.log(`Skipped missing_file  : ${stats.skippedMissingFileStatus}`);
  console.log(`Failed rows           : ${stats.failedRows}`);
  console.log(`Created artists       : ${stats.createdArtists}`);
  console.log(`Created albums        : ${stats.createdAlbums}`);
  console.log(`Created genres        : ${stats.createdGenres}`);
  console.log(`Updated duplicates    : ${stats.updatedDuplicates}`);

  console.log('\nSQL check:');
  console.log(`
SELECT s.id, s.title, a.name AS artist, al.title AS album, g.name AS genre, s.market, s.audio_url
FROM songs s
JOIN artists a ON a.id = s.artist_id
LEFT JOIN albums al ON al.id = s.album_id
LEFT JOIN genres g ON g.id = s.genre_id
ORDER BY s.created_at DESC
LIMIT 20;
`.trim());
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  await pool.end();
  process.exit(1);
});
