require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pool } = require('../../src/config/database');

const DEFAULT_ARTIST = 'BLACKPINK';
const DEFAULT_ALBUMS = ['THE ALBUM', 'DEADLINE', 'BORN PINK'];

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-').replace(/-+/g, '-') || 'album';
}

function parseAlbumsArg(value) {
  if (!clean(value)) return DEFAULT_ALBUMS;
  return value
    .split(',')
    .map((item) => clean(item))
    .filter(Boolean);
}

async function getColumns(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Field));
}

async function downloadImageToLocal(imageUrl, album) {
  const uploadDir = path.join(process.cwd(), 'uploads', 'img', 'albums');
  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `${slugify(album.title)}-${album.id}.jpg`;
  const localFilePath = path.join(uploadDir, filename);
  const localUrl = `/uploads/img/albums/${filename}`;

  const response = await axios({
    method: 'get',
    url: imageUrl,
    responseType: 'stream',
    timeout: 20000,
  });

  const writer = fs.createWriteStream(localFilePath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return localUrl;
}

async function main() {
  const artistName = clean(getArg('artist')) || DEFAULT_ARTIST;
  const albumTitles = parseAlbumsArg(getArg('albums'));
  const albumColumns = await getColumns('albums');

  console.log(`Artist: ${artistName}`);
  console.log(`Albums: ${albumTitles.join(', ')}`);

  const [albums] = await pool.query(
    `
      SELECT al.id, al.title, al.cover_url, al.cover_source,
             al.album_type, al.total_tracks, COUNT(s.id) AS song_count
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN songs s ON s.album_id = al.id AND s.is_active = 1
      WHERE a.name = ? AND al.title IN (?)
      GROUP BY al.id, al.title, al.cover_url, al.cover_source, al.album_type, al.total_tracks
      ORDER BY al.title
    `,
    [artistName, albumTitles]
  );

  const foundTitles = new Set(albums.map((album) => album.title));
  for (const title of albumTitles) {
    if (!foundTitles.has(title)) {
      console.log(`[missing] Album not found in DB: ${title}`);
    }
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const album of albums) {
    const coverUrl = clean(album.cover_url);
    console.log(`\nAlbum: ${album.title} (#${album.id})`);
    console.log(`  current cover_url: ${coverUrl || '(blank)'}`);

    if (coverUrl.startsWith('/uploads/img/albums/')) {
      skipped += 1;
      console.log('  status: skipped, cover already local');
      continue;
    }

    if (!/^https?:\/\//i.test(coverUrl)) {
      failed += 1;
      console.log('  status: failed, cover_url is empty or not downloadable');
      continue;
    }

    try {
      const localUrl = await downloadImageToLocal(coverUrl, album);
      const updates = ['cover_url = ?'];
      const values = [localUrl];

      if (albumColumns.has('cover_source')) {
        updates.push("cover_source = 'metadata'");
      }
      if (albumColumns.has('cover_fetched_at')) {
        updates.push('cover_fetched_at = NOW()');
      }
      if (albumColumns.has('total_tracks')) {
        updates.push('total_tracks = GREATEST(COALESCE(total_tracks, 0), ?)');
        values.push(album.song_count || 0);
      }
      if (albumColumns.has('album_type') && (album.song_count || 0) > 1) {
        updates.push("album_type = 'album'");
      }

      values.push(album.id);
      await pool.query(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`, values);

      downloaded += 1;
      console.log(`  saved: ${localUrl}`);
      console.log('  status: downloaded');
    } catch (error) {
      failed += 1;
      console.log(`  status: failed, ${error.message}`);
    }
  }

  console.log('\nSummary');
  console.log('=======');
  console.log(`Matched albums : ${albums.length}`);
  console.log(`Downloaded     : ${downloaded}`);
  console.log(`Skipped        : ${skipped}`);
  console.log(`Failed         : ${failed}`);
}

main()
  .catch((error) => {
    console.error('Fetch selected album covers failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
