const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.resolve(__dirname, '../../apps/backend/package.json'));
backendRequire('dotenv').config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const { pool } = require('../../apps/backend/src/config/database');

const OUTPUT_CSV_PATH = path.join(__dirname, '../../datasets/processed/lyrics/low-quality-lyrics-report.csv');

function checkLyricsQuality(text, title = '', artist = '') {
  const result = {
    isLowQuality: false,
    reason: null,
    warnings: [],
    needsReview: false,
    stats: { plainLength: 0, lineCount: 0, uniqueLineRatio: 0, maxRepeatedLineRatio: 0 }
  };

  if (!text || typeof text !== 'string') {
    result.isLowQuality = true;
    result.reason = 'lyrics_empty';
    return result;
  }

  const cleanText = text.trim();
  const plainLength = cleanText.length;
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const lineCount = lines.length;

  result.stats.plainLength = plainLength;
  result.stats.lineCount = lineCount;

  if (plainLength < 30 && lineCount < 2) {
    result.isLowQuality = true;
    result.reason = 'lyrics_too_short';
    return result;
  }

  const lineOccurrences = {};
  let maxRepeatedLineCount = 0;
  
  lines.forEach(line => {
    const normLine = line.toLowerCase();
    lineOccurrences[normLine] = (lineOccurrences[normLine] || 0) + 1;
    if (lineOccurrences[normLine] > maxRepeatedLineCount) {
      maxRepeatedLineCount = lineOccurrences[normLine];
    }
  });

  const uniqueLineCount = Object.keys(lineOccurrences).length;
  const uniqueLineRatio = lineCount > 0 ? uniqueLineCount / lineCount : 0;
  const maxRepeatedLineRatio = lineCount > 0 ? maxRepeatedLineCount / lineCount : 0;

  result.stats.uniqueLineRatio = uniqueLineRatio;
  result.stats.maxRepeatedLineRatio = maxRepeatedLineRatio;

  if (maxRepeatedLineRatio > 0.5) {
    result.warnings.push('lyrics_repeated_lines');
    result.needsReview = true;
  } else if (uniqueLineRatio < 0.20 && lineCount >= 8) {
    result.warnings.push('lyrics_low_unique_ratio');
    result.needsReview = true;
  }

  // Check if lyrics is just the title/artist repeated
  const uniqueLinesArr = Object.keys(lineOccurrences);
  const safeTitle = (title || '').toLowerCase().trim();
  const safeArtist = (artist || '').toLowerCase().trim();
  
  if (safeTitle || safeArtist) {
    let allLinesAreJustMetadata = true;
    for (const line of uniqueLinesArr) {
      // Remove basic punctuation to check metadata
      const cleanLine = line.replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, '').trim();
      const matchTitle = safeTitle && (cleanLine === safeTitle || cleanLine.includes(safeTitle) || safeTitle.includes(cleanLine));
      const matchArtist = safeArtist && (cleanLine === safeArtist || cleanLine.includes(safeArtist) || safeArtist.includes(cleanLine));
      
      if (!matchTitle && !matchArtist) {
        allLinesAreJustMetadata = false;
        break;
      }
    }
    
    if (allLinesAreJustMetadata) {
      result.isLowQuality = true;
      result.reason = 'lyrics_artist_or_title_only';
    }
  }

  return result;
}

function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function runAudit() {
  try {
    console.log('Fetching songs with plain lyrics...');
    
    // Check which plain lyrics column exists
    const [columns] = await pool.query('SHOW COLUMNS FROM song_lyrics');
    const colNames = columns.map(c => c.Field);
    const plainCol = colNames.includes('plain_lyrics') ? 'plain_lyrics' : (colNames.includes('lyrics') ? 'lyrics' : null);
    
    if (!plainCol) {
      console.log('No plain_lyrics or lyrics column found in song_lyrics table.');
      process.exit(1);
    }

    const [rows] = await pool.query(`
      SELECT 
        sl.song_id, 
        sl.${plainCol} AS plain_lyrics, 
        s.title, 
        a.name AS artist_name 
      FROM song_lyrics sl
      LEFT JOIN songs s ON sl.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE sl.${plainCol} IS NOT NULL AND TRIM(sl.${plainCol}) != ''
    `);

    console.log(`Found ${rows.length} songs with plain lyrics. Validating quality...`);

    const lowQualityItems = [];

    for (const row of rows) {
      const quality = checkLyricsQuality(row.plain_lyrics, row.title, row.artist_name);
      
      if (quality.isLowQuality || quality.needsReview) {
        let sample = (row.plain_lyrics || '').replace(/\s+/g, ' ').trim().substring(0, 80);
        lowQualityItems.push({
          song_id: row.song_id,
          title: row.title,
          artist_name: row.artist_name,
          is_low_quality: quality.isLowQuality ? 'true' : 'false',
          reason: quality.reason || '',
          warnings: quality.warnings.join(';'),
          plain_length: quality.stats?.plainLength || 0,
          line_count: quality.stats?.lineCount || 0,
          unique_line_ratio: (quality.stats?.uniqueLineRatio || 0).toFixed(4),
          max_repeated_line_ratio: (quality.stats?.maxRepeatedLineRatio || 0).toFixed(4),
          sample: sample
        });
      }
    }

    console.log(`Found ${lowQualityItems.length} lyrics needing review or marked as low quality.`);
    
    const outputDir = path.dirname(OUTPUT_CSV_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const headers = ['song_id', 'title', 'artist_name', 'is_low_quality', 'reason', 'warnings', 'plain_length', 'line_count', 'unique_line_ratio', 'max_repeated_line_ratio', 'sample'];
    let csvContent = headers.join(',') + '\n';

    for (const item of lowQualityItems) {
      const row = [
        item.song_id,
        item.title,
        item.artist_name,
        item.is_low_quality,
        item.reason,
        item.warnings,
        item.plain_length,
        item.line_count,
        item.unique_line_ratio,
        item.max_repeated_line_ratio,
        item.sample
      ];
      csvContent += row.map(escapeCSV).join(',') + '\n';
    }

    fs.writeFileSync(OUTPUT_CSV_PATH, csvContent, 'utf8');
    console.log(`Audit report saved to: ${OUTPUT_CSV_PATH}`);

  } catch (err) {
    console.error('Error during audit:', err);
  } finally {
    await pool.end();
  }
}

runAudit();
