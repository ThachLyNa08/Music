const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.resolve(__dirname, '../../apps/backend/package.json'));
backendRequire('dotenv').config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const axios = backendRequire('axios');
const csvParser = backendRequire('csv-parser');
const { pool } = require('../../apps/backend/src/config/database');

const LRCLIB_GET = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
const BACKLOG_CSV_PATH = path.join(__dirname, '../../datasets/processed/lyrics/missing-lyrics-backlog.csv');
const RESULT_CSV_PATH = path.join(__dirname, '../../datasets/processed/lyrics/crawl-missing-lyrics-result.csv');
const RESULT_JSON_PATH = path.join(__dirname, '../../datasets/processed/lyrics/crawl-missing-lyrics-result.json');
const FAILED_CSV_PATH = path.join(__dirname, '../../datasets/processed/lyrics/crawl-missing-lyrics-failed.csv');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    limit: 100,
    market: null,
    onlyUnmatched: false,
    onlyFailed: false,
    retryFailed: false,
    updateDb: false,
    delay: 1000,
    timeout: 30000
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--only-unmatched') options.onlyUnmatched = true;
    if (arg === '--only-failed') options.onlyFailed = true;
    if (arg === '--retry-failed') options.retryFailed = true;
    if (arg === '--update-db') options.updateDb = true;
    if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--market=')) options.market = arg.split('=')[1];
    if (arg.startsWith('--delay=')) options.delay = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--timeout=')) options.timeout = parseInt(arg.split('=')[1], 10);
  }
  return options;
}

function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve([]);
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        for (const key in data) {
          if (key.charCodeAt(0) === 0xFEFF) {
            const newKey = key.slice(1);
            data[newKey] = data[key];
            delete data[key];
          }
        }
        results.push(data);
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
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
  s = s.replace(/audio/g, '');
  s = s.replace(/mv/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  return s.trim();
}

function normalizeArtistStr(str) {
  if (!str) return '';
  let s = str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9, ]/g, '');
  if (s.includes('girlsgeneration') || s.includes('snsd')) return 'snsd';
  return s.trim();
}

function checkArtistMatch(resArtistRaw, targetArtistRaw) {
  const res = normalizeArtistStr(resArtistRaw).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const tar = normalizeArtistStr(targetArtistRaw).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  
  const resClean = res.replace(/\s+/g, '');
  const tarClean = tar.replace(/\s+/g, '');
  
  if (resClean === tarClean) return true;
  if (resClean.includes(tarClean) || tarClean.includes(resClean)) return true;

  const tarParts = tar.split(' ').filter(Boolean);
  const resParts = res.split(' ').filter(Boolean);
  
  if (tarParts.length === 2 && resParts.length === 2) {
    if (tarParts[0] === resParts[1] && tarParts[1] === resParts[0]) {
      return true;
    }
  }
  return false;
}

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

function buildTitleArtistCandidates(rawTitle, rawArtist) {
  const candidates = [];
  candidates.push({ title: rawTitle, artist: rawArtist });
  const pairs = [];
  const addPair = (t, a, r) => pairs.push({ title: t.trim(), artist: a.trim(), reason: r });
  
  const originalTitle = rawTitle.trim();
  const originalArtist = rawArtist.trim();
  
  let quoteMatch = originalTitle.match(/"(.*?)"/);
  if (!quoteMatch) quoteMatch = originalTitle.match(/“(.*?)”/);
  if (!quoteMatch) quoteMatch = originalTitle.match(/‘(.*?)’/);
  if (!quoteMatch) {
    const singleQuoteMatch = originalTitle.match(/'(.*?)'/g);
    if (singleQuoteMatch && singleQuoteMatch.length > 0) {
      let bestMatch = null;
      for (const m of singleQuoteMatch) {
        if (m.length > 4) bestMatch = m.replace(/^'|'$/g, '');
      }
      if (bestMatch) quoteMatch = [null, bestMatch];
    }
  }

  if (quoteMatch) {
    const extracted = quoteMatch[1];
    addPair(extracted, originalArtist, 'quote_extraction');
    if (extracted.includes("'")) {
      addPair(extracted.replace(/'/g, ''), originalArtist, 'quote_extraction_no_apostrophe');
    }
  }

  const upperTitle = originalTitle.toUpperCase();

  if (upperTitle.startsWith('TAEYANG')) {
    const remainder = originalTitle.substring(7).trim();
    const t = quoteMatch ? quoteMatch[1] : remainder;
    addPair(t, 'TAEYANG', 'taeyang_prefix');
    addPair(t, 'Taeyang', 'taeyang_prefix');
    if (t.includes("'")) {
      addPair(t.replace(/'/g, ''), 'TAEYANG', 'taeyang_prefix_no_apostrophe');
    }
  }
  
  if (upperTitle.startsWith('GD X TAEYANG')) {
    const remainder = originalTitle.substring(12).trim();
    const t = quoteMatch ? quoteMatch[1] : remainder;
    addPair(t, 'GD X TAEYANG', 'gd_x_taeyang_prefix');
    addPair(t, 'G-DRAGON', 'gd_x_taeyang_prefix');
    addPair(t, 'TAEYANG', 'gd_x_taeyang_prefix');
  } else if (upperTitle.startsWith('G-DRAGON')) {
    const remainder = originalTitle.substring(8).trim();
    const t = quoteMatch ? quoteMatch[1] : remainder;
    addPair(t, 'G-DRAGON', 'gdragon_prefix');
    addPair(t, 'G Dragon', 'gdragon_prefix');
    addPair(t, 'GDragon', 'gdragon_prefix');
    
    if (remainder.includes('삐딱하게') || originalTitle.includes('삐딱하게')) {
      addPair('Crooked', 'G-DRAGON', 'gdragon_crooked');
    }
  }

  if (upperTitle.includes('2NE1') && upperTitle.includes('LOLLIPOP')) {
    ['BIGBANG', '2NE1', 'BIGBANG 2NE1', 'BIGBANG & 2NE1'].forEach(a => {
      addPair('LOLLIPOP', a, '2ne1_lollipop');
      addPair('Lollipop', a, '2ne1_lollipop');
    });
  }
  
  if (originalTitle.includes('HA:TFELT') || originalArtist.includes('HA:TFELT')) {
    const t = quoteMatch ? quoteMatch[1] : originalTitle;
    addPair(t, 'HA:TFELT', 'hatfelt_artist');
    addPair(t, 'Wonder Girls', 'hatfelt_wonder_girls');
    if (t.includes("'")) {
       addPair(t.replace(/'/g, ''), 'HA:TFELT', 'hatfelt_artist_no_apostrophe');
       addPair(t.replace(/'/g, ''), 'Wonder Girls', 'hatfelt_wonder_girls_no_apostrophe');
    }
  }

  addPair(originalTitle, originalArtist, 'original');

  const unique = [];
  const seen = new Set();
  for (const p of pairs) {
    if (!p.title || !p.artist) continue;
    const key = `${p.title.toLowerCase()}|${p.artist.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  
  return unique;
}

async function getEnrichedData(songIds) {
  if (songIds.length === 0) return {};
  const [rows] = await pool.query(`
    SELECT s.id, s.title, s.duration_sec, s.market,
           a.name as artist_name, al.title as album_name,
           sl.plain_lyrics
    FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    LEFT JOIN song_lyrics sl ON s.id = sl.song_id
    WHERE s.id IN (?)
  `, [songIds]);
  
  const map = {};
  for (const row of rows) {
    map[row.id] = row;
  }
  return map;
}

async function fetchWithRetry(url, params, timeout) {
  let attempt = 0;
  while (attempt < 2) {
    try {
      const { data } = await axios.get(url, { params, timeout });
      return data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return url === LRCLIB_GET ? null : [];
      }
      attempt++;
      if (attempt >= 2) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          const err = new Error('timeout');
          err.isTimeout = true;
          throw err;
        }
        throw error;
      }
      await sleep(1000);
    }
  }
}

function scoreResult(res, targetTitle, targetArtist, targetDuration, targetAlbum) {
  let score = 0;
  const resTitle = normalizeTitleStr(res.trackName);
  const targetT = normalizeTitleStr(targetTitle);
  
  if (resTitle === targetT) score += 5;
  else if (resTitle.includes(targetT) || targetT.includes(resTitle)) score += 3;
  
  if (checkArtistMatch(res.artistName, targetArtist)) {
    score += 5;
  }
  
  if (targetDuration && res.duration) {
    const diff = Math.abs(targetDuration - res.duration);
    if (diff <= 2) score += 5;
    else if (diff <= 5) score += 3;
    else if (diff > 15) score -= 2;
  }
  
  if (res.syncedLyrics) score += 2;
  if (res.plainLyrics) score += 1;
  
  if (targetAlbum && res.albumName) {
    const resAl = normalizeTitleStr(res.albumName);
    const tarAl = normalizeTitleStr(targetAlbum);
    if (resAl === tarAl || resAl.includes(tarAl) || tarAl.includes(resAl)) {
      score += 2;
    }
  }
  
  return score;
}

async function main() {
  const options = parseArgs();
  console.log('Options:', options);

  let songLyricsColumns = new Set();
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM song_lyrics');
    cols.forEach(c => songLyricsColumns.add(c.Field));
    console.log(`song_lyrics columns: ${Array.from(songLyricsColumns).join(', ')}`);
  } catch (err) {
    console.error('Failed to query song_lyrics schema:', err);
    process.exit(1);
  }

  function hasColumn(name) {
    return songLyricsColumns.has(name);
  }

  const plainCol = ['plain_lyrics', 'lyrics', 'lyrics_text'].find(hasColumn);
  const syncedCol = ['synced_lyrics', 'lrc_lyrics'].find(hasColumn);

  if (!plainCol && !syncedCol) {
    console.error('Cannot update lyrics: song_lyrics table does not contain supported lyrics columns.');
    process.exit(1);
  }

  const backlog = await readCSV(BACKLOG_CSV_PATH);
  console.log(`Loaded ${backlog.length} items from backlog`);

  let filtered = backlog;
  if (options.onlyUnmatched) {
    filtered = filtered.filter(row => row.source_failed_file === 'none');
  }
  if (options.onlyFailed || options.retryFailed) {
    filtered = filtered.filter(row => row.source_failed_file !== 'none');
  }
  if (options.market) {
    filtered = filtered.filter(row => row.market === options.market);
  }

  filtered = filtered.slice(0, options.limit);
  console.log(`Targeting ${filtered.length} songs after filtering and limit`);

  const songIds = filtered.map(r => r.song_id).filter(id => id);
  const enrichedData = await getEnrichedData(songIds);

  const results = [];
  const failedResults = [];
  let updatedCount = 0;
  
  for (const row of filtered) {
    const songId = row.song_id;
    const dbData = enrichedData[songId];
    
    if (!dbData) {
      console.log(`[SKIP] Song ID ${songId} not found in DB`);
      continue;
    }
    
    if (dbData.plain_lyrics && dbData.plain_lyrics.trim() !== '') {
      console.log(`[SKIP] Song ID ${songId} already has lyrics in DB`);
      results.push({ song_id: songId, status: 'skipped', reason: 'already_has_lyrics_in_db' });
      continue;
    }

    const title = dbData.title || row.title;
    const artist = dbData.artist_name || row.artist_name;
    const duration = dbData.duration_sec || null;
    const album = dbData.album_name || null;
    
    let bestMatch = null;
    let bestScore = -1;
    let strategyUsed = 'none';
    let status = 'not_found';
    let reason = '';
    const triedQueries = [];
    
    const candidates = buildTitleArtistCandidates(title, artist);
    
    console.log(`\nProcessing: [${songId}] ${title} - ${artist}`);
    if (options.dryRun) {
      const titleCands = Array.from(new Set(candidates.map(c => c.title)));
      const artistCands = Array.from(new Set(candidates.map(c => c.artist)));
      console.log(`Title candidates: ${titleCands.join(' | ')}`);
      console.log(`Artist candidates: ${artistCands.join(' | ')}`);
      console.log(`Query attempts:`);
    }
    
    try {
      for (const cand of candidates) {
        if (bestScore >= 10) break;

        const cTitle = cand.title;
        const cArtist = cand.artist;
        const cleanCTitle = normalizeTitleStr(cTitle) || cTitle;
        const cleanCArtist = normalizeArtistStr(cArtist) || cArtist;

        const querySequence = [
          { name: 'q_search_raw', url: LRCLIB_SEARCH, params: { q: `${cTitle} ${cArtist}` } },
          { name: 'q_search_clean', url: LRCLIB_SEARCH, params: { q: `${cleanCTitle} ${cleanCArtist}` } },
          { name: 'track_artist_search', url: LRCLIB_SEARCH, params: { track_name: cTitle, artist_name: cArtist } }
        ];
        if (duration) {
          querySequence.push({ name: 'get', url: LRCLIB_GET, params: { track_name: cTitle, artist_name: cArtist, duration, album_name: album || '' } });
        }

        for (const q of querySequence) {
          triedQueries.push(q.name);
          
          if (options.dryRun) {
            const queryStr = q.params.q || `track=${q.params.track_name} artist=${q.params.artist_name}`;
            console.log(`- search ${q.name}: ${queryStr}`);
          }

          let apiData = null;
          if (q.url === LRCLIB_SEARCH) {
            apiData = await fetchWithRetry(q.url, q.params, options.timeout);
            if (apiData && apiData.length > 0) {
              const scored = apiData.map(item => ({
                item,
                score: scoreResult(item, cTitle, cArtist, duration, album)
              })).sort((a, b) => b.score - a.score);
              
              if (scored[0].score > bestScore) {
                bestScore = scored[0].score;
                bestMatch = scored[0].item;
                strategyUsed = q.name;
              }
            }
          } else {
            apiData = await fetchWithRetry(q.url, q.params, options.timeout);
            if (apiData && (apiData.plainLyrics || apiData.syncedLyrics)) {
              const sc = scoreResult(apiData, cTitle, cArtist, duration, album);
              if (sc > bestScore) {
                bestScore = sc;
                bestMatch = apiData;
                strategyUsed = q.name;
              }
            }
          }
          
          if (bestScore >= 10) {
            break;
          }
        }
      }
      
      if (bestMatch && (bestMatch.plainLyrics || bestMatch.syncedLyrics)) {
        if (title.toUpperCase().includes('2NE1') && title.toUpperCase().includes('LOLLIPOP')) {
           const trackNameLower = bestMatch.trackName.toLowerCase();
           if (trackNameLower.includes('pt. 2') || trackNameLower.includes('pt 2')) {
             bestScore = 5;
             reason = 'possible_wrong_lollipop_version';
           } else if (!bestMatch.artistName.toUpperCase().includes('2NE1') && bestMatch.trackName.toUpperCase() !== 'LOLLIPOP') {
             bestScore = 5;
             reason = 'missing_2ne1_in_lollipop_result';
           }
        }
        
        if (bestScore >= 7) {
          status = 'found';
          
          if (!bestMatch.syncedLyrics && bestMatch.plainLyrics) {
            const qualityInfo = checkLyricsQuality(bestMatch.plainLyrics, title, artist);
            if (qualityInfo.isLowQuality) {
              reason = qualityInfo.reason;
            } else if (qualityInfo.needsReview) {
              reason = qualityInfo.warnings.join(',');
            }
          }
          
          if (options.dryRun) {
            console.log(`Top result:
- id: ${bestMatch.id}
- trackName: ${bestMatch.trackName}
- artistName: ${bestMatch.artistName}
- albumName: ${bestMatch.albumName}
- duration: ${bestMatch.duration}
- hasPlainLyrics: ${!!bestMatch.plainLyrics}
- hasSyncedLyrics: ${!!bestMatch.syncedLyrics}
- score: ${bestScore}
Final status: ${status}`);
          }
          
          if (status === 'found' && options.updateDb) {
            const fields = ['song_id'];
            const values = [songId];
            const updates = [];
            
            if (plainCol) {
              fields.push(plainCol);
              values.push(bestMatch.plainLyrics || '');
              updates.push(`${plainCol} = VALUES(${plainCol})`);
            }
            if (syncedCol) {
              fields.push(syncedCol);
              values.push(bestMatch.syncedLyrics || '');
              updates.push(`${syncedCol} = VALUES(${syncedCol})`);
            }
            
            if (hasColumn('created_at')) {
              fields.push('created_at');
              values.push(new Date()); 
            }
            if (hasColumn('updated_at')) {
              fields.push('updated_at');
              values.push(new Date());
              updates.push(`updated_at = VALUES(updated_at)`);
            }
            
            if (hasColumn('provider')) {
              fields.push('provider');
              values.push('lrclib');
              updates.push(`provider = VALUES(provider)`);
            }
            
            if (hasColumn('lrclib_id') && bestMatch.id) {
              fields.push('lrclib_id');
              values.push(bestMatch.id);
              updates.push(`lrclib_id = VALUES(lrclib_id)`);
            }
            
            const placeholders = fields.map(() => '?').join(', ');
            const updateClause = updates.length > 0 ? `ON DUPLICATE KEY UPDATE ${updates.join(', ')}` : '';
            
            const query = `
              INSERT INTO song_lyrics (${fields.join(', ')})
              VALUES (${placeholders})
              ${updateClause}
            `;
            
            await pool.query(query, values);
            if (!options.dryRun) console.log(`  -> DB Updated (Score: ${bestScore}, Strategy: ${strategyUsed})`);
            updatedCount++;
          }
        } else {
          status = 'ambiguous';
          reason = `Score ${bestScore} too low`;
          if (options.dryRun) {
            console.log(`Top result (rejected): id: ${bestMatch.id}, score: ${bestScore}`);
            console.log(`Final status: ambiguous`);
          } else {
            console.log(`  -> Ambiguous (Score: ${bestScore})`);
          }
        }
      } else {
        if (options.dryRun) {
          console.log(`Top result: none\nFinal status: not_found`);
        } else {
          console.log(`  -> Not Found`);
        }
      }
      
      const durationDiff = bestMatch && duration && bestMatch.duration ? Math.abs(duration - bestMatch.duration) : '';
      
      const resultObj = {
        song_id: songId,
        title,
        artist_name: artist,
        market: dbData.market || row.market,
        status,
        query_strategy: strategyUsed,
        tried_queries: triedQueries.join('|'),
        best_score: bestScore,
        best_lrclib_id: bestMatch?.id || '',
        best_track_name: bestMatch?.trackName || '',
        best_artist_name: bestMatch?.artistName || '',
        best_duration: bestMatch?.duration || '',
        duration_diff: durationDiff,
        has_plain_lyrics: bestMatch ? !!bestMatch.plainLyrics : false,
        has_synced_lyrics: bestMatch ? !!bestMatch.syncedLyrics : false,
        reason,
        plain_lyrics: bestMatch?.plainLyrics || '',
        synced_lyrics: bestMatch?.syncedLyrics || ''
      };
      
      if (status === 'found') {
        results.push(resultObj);
      } else {
        failedResults.push(resultObj);
        results.push(resultObj);
      }
      
    } catch (e) {
      if (e.isTimeout) {
        console.log(`  -> Timeout occurred`);
        status = 'error';
        reason = 'timeout';
      } else {
        console.log(`  -> SQL/Process Error: ${e.message}`);
        status = 'error';
        reason = `error: ${e.message}`;
      }
      const errObj = { 
        song_id: songId, title, artist_name: artist, market: dbData.market || row.market, 
        status, reason, query_strategy: 'none', tried_queries: triedQueries.join('|') 
      };
      results.push(errObj);
      failedResults.push(errObj);
    }
    
    await sleep(options.delay);
  }

  const csvHeaders = [
    'song_id', 'title', 'artist_name', 'market', 'status', 'query_strategy', 'tried_queries',
    'best_score', 'best_lrclib_id', 'best_track_name', 'best_artist_name', 'best_duration', 
    'duration_diff', 'has_plain_lyrics', 'has_synced_lyrics', 'reason'
  ];
  
  const resultCsvLines = [csvHeaders.join(',')];
  for (const r of results) {
    resultCsvLines.push(csvHeaders.map(h => escapeCSV(r[h])).join(','));
  }
  fs.writeFileSync(RESULT_CSV_PATH, '\uFEFF' + resultCsvLines.join('\n'), 'utf8');
  
  const failedCsvLines = [csvHeaders.join(',')];
  for (const r of failedResults) {
    failedCsvLines.push(csvHeaders.map(h => escapeCSV(r[h])).join(','));
  }
  fs.writeFileSync(FAILED_CSV_PATH, '\uFEFF' + failedCsvLines.join('\n'), 'utf8');
  
  fs.writeFileSync(RESULT_JSON_PATH, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\nFinished processing ${filtered.length} items.`);
  console.log(`Found: ${results.filter(r => r.status === 'found').length}`);
  console.log(`Not Found: ${results.filter(r => r.status === 'not_found').length}`);
  console.log(`Ambiguous: ${results.filter(r => r.status === 'ambiguous').length}`);
  console.log(`Skipped: ${results.filter(r => r.status === 'skipped').length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
  
  if (options.dryRun) {
    console.log(`\n[DRY RUN] No database changes were made.`);
  } else if (!options.updateDb) {
    console.log(`\n[INFO] Run with --update-db to save found lyrics to the database.`);
  } else {
    console.log(`\n[INFO] DB Update finished. Total updated/inserted: ${updatedCount}`);
  }
  
  await pool.end();
}

main();
