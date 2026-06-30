const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.resolve(__dirname, '../../apps/backend/package.json'));
backendRequire('dotenv').config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const { pool } = require('../../apps/backend/src/config/database');

const FAILED_LYRICS_DIRS = [
  'datasets/raw/lyrics/failed/kpop',
  'datasets/raw/lyrics/failed/usuk',
  'datasets/raw/lyrics/failed/vpop',
  'datasets/raw/lyrics/failed/unknown'
];

const OUTPUT_CSV_PATH = path.join(__dirname, '../../datasets/processed/lyrics/missing-lyrics-backlog.csv');

function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getFailedTitle(item) {
  return item.title
    || item.song_title
    || item.songTitle
    || item.track_title
    || item.trackTitle
    || item.track_name
    || item.trackName
    || item.name
    || item.query_title
    || item.queryTitle
    || item.rawTitle
    || item.cleanTitle
    || item.input?.title
    || item.song?.title
    || item.csv?.Title
    || '';
}

function getFailedArtist(item) {
  return item.artist_name
    || item.artistName
    || item.artist
    || item.artist_names
    || item.artistNames
    || item.primary_artist
    || item.primaryArtist
    || item.query_artist
    || item.queryArtist
    || item.rawArtist
    || item.input?.artist
    || item.song?.artist_name
    || item.song?.artist
    || item.csv?.Main_Artist
    || item.csv?.Original_Artist
    || '';
}

function getFailedReason(item) {
  return item.reason
    || item.error
    || item.error_message
    || item.errorMessage
    || item.status
    || item.message
    || item.result
    || item.failed_reason
    || item.lrclib_error
    || 'lrclib_failed';
}

function normalizeTitleStr(str) {
  if (!str) return '';
  let s = str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\(feat\.[^)]*\)/g, '');
  s = s.replace(/\[feat\.[^\]]*\]/g, '');
  s = s.replace(/\(ft\.[^)]*\)/g, '');
  s = s.replace(/ft\..+$/g, '');
  s = s.replace(/feat\..+$/g, '');
  s = s.replace(/remix/g, '');
  s = s.replace(/official/g, '');
  s = s.replace(/mv/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  return s;
}

function normalizeArtistStr(str) {
  if (!str) return '';
  let s = str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  if (['girlsgeneration', 'snsd'].includes(s)) return 'snsd';
  return s;
}

function getMarket(songMarket, genreName) {
  if (songMarket && songMarket.trim() !== '' && songMarket.toUpperCase() !== 'OTHER') {
    return songMarket.toLowerCase();
  }
  if (!genreName) return 'unknown';
  const genre = genreName.toLowerCase();
  if (genre.includes('k-pop') || genre.includes('kpop')) return 'kpop';
  if (genre.includes('v-pop') || genre.includes('vpop') || genre.includes('việt')) return 'vpop';
  if (genre.includes('us-uk') || genre.includes('usuk')) return 'usuk';
  return 'unknown';
}

async function exportBacklog() {
  try {
    console.log('Fetching missing lyrics from DB...');
    const [missingSongs] = await pool.query(`
      SELECT 
        s.id AS song_id, 
        s.title, 
        s.market,
        a.name AS artist_name, 
        al.title AS album_name,
        g.name AS genre_name
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      WHERE sl.song_id IS NULL OR TRIM(sl.plain_lyrics) = '' OR sl.plain_lyrics IS NULL
    `);
    
    console.log(`Found ${missingSongs.length} songs missing lyrics in DB.`);

    const failedItems = [];
    let failedItemsWithTitleArtist = 0;

    for (const dir of FAILED_LYRICS_DIRS) {
      const fullPath = path.join(__dirname, '../../', dir, 'failed-lyrics.json');
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(content);
          const market = dir.split('/').pop();
          
          for (const item of data) {
            item._market = market;
            item._source_file = `${dir}/failed-lyrics.json`;
            item._reason = getFailedReason(item);
            
            const rawTitle = getFailedTitle(item);
            const rawArtist = getFailedArtist(item);
            
            item._norm_title = normalizeTitleStr(rawTitle);
            item._norm_artist = normalizeArtistStr(rawArtist);
            
            if (rawTitle && rawArtist) {
              failedItemsWithTitleArtist++;
            }
            
            failedItems.push(item);
          }
        } catch (e) {
          console.warn(`[WARNING] Failed to parse JSON ${fullPath}: ${e.message}`);
        }
      }
    }
    
    console.log(`Loaded ${failedItems.length} failed items from JSON files.`);
    console.log(`Failed items with extracted title/artist: ${failedItemsWithTitleArtist}`);

    const csvLines = [];
    // Header
    csvLines.push('song_id,title,artist_name,album_name,market,lyrics_status,synced_lyrics_status,lrclib_failed_reason,source_failed_file');

    let matchedCount = 0;
    let matchedBySongId = 0;
    let matchedByTitleArtist = 0;
    let unmatched = 0;

    for (const song of missingSongs) {
      const sTitleNorm = normalizeTitleStr(song.title);
      const sArtistNorm = normalizeArtistStr(song.artist_name);
      
      let matchedItem = failedItems.find(f => (f.id || f.song_id || f.songId) == song.song_id);
      
      if (matchedItem) {
        matchedBySongId++;
      } else {
        matchedItem = failedItems.find(f => f._norm_title === sTitleNorm && f._norm_artist === sArtistNorm);
        if (matchedItem) {
          matchedByTitleArtist++;
        }
      }

      let market = getMarket(song.market, song.genre_name);
      let reason = 'missing_in_db_not_found_in_lrclib_failed_log';
      let sourceFile = 'none';
      
      if (matchedItem) {
        matchedCount++;
        reason = matchedItem._reason;
        sourceFile = matchedItem._source_file;
      } else {
        unmatched++;
      }

      const row = [
        song.song_id,
        song.title,
        song.artist_name,
        song.album_name,
        market,
        'missing',
        'missing',
        reason,
        sourceFile
      ];
      
      csvLines.push(row.map(escapeCSV).join(','));
    }

    const outputDir = path.dirname(OUTPUT_CSV_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Add BOM for Excel UTF-8
    fs.writeFileSync(OUTPUT_CSV_PATH, '\uFEFF' + csvLines.join('\n'), 'utf8');
    console.log(`Successfully exported backlog to ${OUTPUT_CSV_PATH}`);
    console.log(`Matched total: ${matchedCount} (By ID: ${matchedBySongId}, By Title/Artist: ${matchedByTitleArtist})`);
    console.log(`Unmatched (missing in DB but not in failed log): ${unmatched}`);

  } catch (err) {
    console.error('Error during export:', err);
  } finally {
    await pool.end();
  }
}

exportBacklog();
