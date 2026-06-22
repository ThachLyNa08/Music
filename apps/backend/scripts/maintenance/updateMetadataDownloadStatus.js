const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');

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
  if (market === 'KPOP') return 'KPOP';
  if (market === 'VPOP') return 'VPOP';
  if (market === 'USUK') return 'USUK';
  return market || 'OTHER';
}

function marketFolderFromMarket(value) {
  const market = normalizeMarket(value);
  if (market === 'KPOP') return 'Kpop';
  if (market === 'VPOP') return 'Vpop';
  if (market === 'USUK') return 'USUK';
  return 'Other';
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
  const filePath = cleanRelativePath(row.File_Path || row.file_path);
  if (filePath) {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.startsWith('music/final_songs/')) {
      return `/uploads/${filePath}`;
    }
    if (lowerPath.startsWith('final_songs/')) {
      return `/uploads/music/${filePath}`;
    }
    if (/^(kpop|vpop|usuk|other)\//i.test(filePath)) {
      return `/uploads/music/final_songs/${filePath}`;
    }
    return `/uploads/music/final_songs/${marketFolderFromMarket(row.Market)}/${filePath}`;
  }

  const audioUrl = clean(row.Audio_URL || row.audio_url).replace(/\\/g, '/');
  if (!audioUrl) return '';
  if (audioUrl.startsWith('/uploads/')) return audioUrl;
  if (audioUrl.startsWith('uploads/')) return `/${audioUrl}`;
  if (audioUrl.startsWith('music/')) return `/uploads/${audioUrl}`;
  return audioUrl.startsWith('/') ? audioUrl : `/uploads/${audioUrl}`;
}

function physicalPathFromAudioUrl(audioUrl) {
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
    throw new Error('Missing required --file=uploads/music/nct_metadata_pending.csv');
  }
  if (path.isAbsolute(fileArg)) {
    return path.resolve(fileArg);
  }

  const normalizedArg = fileArg.replace(/\\/g, '/');
  const candidates = [
    path.resolve(process.cwd(), fileArg),
    path.resolve(BACKEND_ROOT, fileArg),
  ];
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
    const headers = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (fieldNames) => headers.push(...fieldNames))
      .on('data', (row) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve({ rows, headers }));
  });
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filePath, rows, headers) {
  const finalHeaders = [...headers];
  for (const required of ['Audio_URL', 'Download_Status']) {
    if (!finalHeaders.includes(required)) {
      finalHeaders.push(required);
    }
  }

  const lines = [
    finalHeaders.map(escapeCsv).join(','),
    ...rows.map((row) => finalHeaders.map((header) => escapeCsv(row[header])).join(',')),
  ];

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  let csvPath;
  try {
    csvPath = resolveCsvPath(getArg('file'));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Usage: node scripts/maintenance/updateMetadataDownloadStatus.js --file=uploads/music/nct_metadata_pending.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const { rows, headers } = await readCsv(csvPath);
  const stats = {
    totalRows: rows.length,
    downloaded: 0,
    missingFile: 0,
    fixedAudioUrl: 0,
  };

  console.log(`Reading CSV: ${csvPath}`);

  for (const row of rows) {
    const previousAudioUrl = clean(row.Audio_URL);
    const audioUrl = normalizeAudioUrlFromRow(row);
    const physicalPath = physicalPathFromAudioUrl(audioUrl);
    const exists = Boolean(physicalPath && fs.existsSync(physicalPath));

    if (previousAudioUrl !== audioUrl) {
      stats.fixedAudioUrl += 1;
    }

    row.Audio_URL = audioUrl;
    row.Download_Status = exists ? 'downloaded' : 'missing_file';

    if (exists) {
      stats.downloaded += 1;
    } else {
      stats.missingFile += 1;
    }

    console.log(`${row.Download_Status}: ${clean(row.Title) || '(no title)'}`);
    console.log(`  audio_url: ${audioUrl || '(missing)'}`);
    console.log(`  physical: ${physicalPath || '(invalid audio url)'}`);
  }

  writeCsv(csvPath, rows, headers);

  console.log('\nUpdate summary');
  console.log('==============');
  console.log(`Total rows       : ${stats.totalRows}`);
  console.log(`Set downloaded   : ${stats.downloaded}`);
  console.log(`Set missing_file : ${stats.missingFile}`);
  console.log(`Fixed Audio_URL  : ${stats.fixedAudioUrl}`);
  console.log(`CSV updated      : ${csvPath}`);
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
