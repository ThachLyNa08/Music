const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.resolve(__dirname, '../../apps/backend/package.json'));
backendRequire('dotenv').config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const { pool } = backendRequire('./src/config/database');

const SYSTEM_KEYS = [
  'dailymix_01', 'dailymix_02', 'dailymix_03', 'dailymix_04', 'dailymix_05', 'dailymix_06',
  'weekly_mix', 'moodmix', 'morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes', 'trending_now'
];

const SYSTEM_KEY_ALIASES = {
  'weeklymix': 'weekly_mix',
  'weekly_mix': 'weekly_mix',
  'mood_mix': 'moodmix',
  'daily_mix_1': 'dailymix_01',
  'daily_mix_01': 'dailymix_01'
};

function normalizeSystemKey(key) {
  return SYSTEM_KEY_ALIASES[key] || key;
}

const SYSTEM_KEY_RUN_ALIASES = {
  weekly_mix: ['weekly_mix', 'weeklymix'],
  weeklymix: ['weekly_mix', 'weeklymix'],
  moodmix: ['moodmix', 'mood_mix'],
  mood_mix: ['moodmix', 'mood_mix']
};

const MULTI_INSTANCE_KEYS = [
  'dailymix_01', 'dailymix_02', 'dailymix_03', 'dailymix_04', 'dailymix_05', 'dailymix_06',
  'weekly_mix', 'moodmix', 'morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes'
];

const SYSTEM_PLAYLIST_TARGET_SIZES = {
  dailymix_01: 25, dailymix_02: 25, dailymix_03: 25,
  dailymix_04: 25, dailymix_05: 25, dailymix_06: 25,
  weekly_mix: 35, moodmix: 30,
  morning_vibes: 25, afternoon_vibes: 25, evening_vibes: 25, night_vibes: 25,
  trending_now: 50, genre_deep_dive: 30
};

const DAILY_MIX_SOURCE_LABELS = {
  dailymix_01: 'Thứ Hai',
  dailymix_02: 'Thứ Ba',
  dailymix_03: 'Thứ Tư',
  dailymix_04: 'Thứ Năm',
  dailymix_05: 'Thứ Sáu',
  dailymix_06: 'Thứ Bảy + Chủ Nhật'
};

const DIVERSITY_THRESHOLDS = {
  daily_mix: { artist: 0.30, genre: 0.75, overlapWarning: 0.70, overlapBad: 0.90 },
  weekly_mix: { artist: 0.30, genre: 0.65 },
  moodmix: { artist: 0.30, genre: 0.65 },
  vibes: { artist: 0.30, genre: 0.65 },
  trending_now: { artist: 0.35, genre: 0.85 }
};

function getDiversityThreshold(key) {
  if (key.startsWith('dailymix')) return DIVERSITY_THRESHOLDS.daily_mix;
  if (key === 'weekly_mix') return DIVERSITY_THRESHOLDS.weekly_mix;
  if (key === 'moodmix') return DIVERSITY_THRESHOLDS.moodmix;
  if (key.includes('vibes')) return DIVERSITY_THRESHOLDS.vibes;
  if (key === 'trending_now') return DIVERSITY_THRESHOLDS.trending_now;
  return { artist: 0.3, genre: 0.6 }; // default
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return rows[0].count > 0;
}

async function getAudioFeatureColumns() {
  const hasAudioFeatures = await tableExists('song_audio_features');
  if (!hasAudioFeatures) return null;

  const [cols] = await pool.query(`SHOW COLUMNS FROM song_audio_features`);
  const colNames = cols.map(c => c.Field);
  
  return {
    acoustic: colNames.includes('acoustic_score') ? 'acoustic_score' : null,
    energy: colNames.includes('energy_score') ? 'energy_score' : null,
    danceability: colNames.includes('danceability') ? 'danceability' : null,
    brightness: colNames.includes('brightness') ? 'brightness' : null,
    mood: colNames.includes('mood') ? 'mood' : null,
    vibe: colNames.includes('vibe') ? 'vibe' : null,
  };
}

function getLocalDayFromDateString(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' });
  const parts = formatter.formatToParts(d);
  const weekday = parts.find(p => p.type === 'weekday').value;
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

async function getCrossOverlapWithOtherDailyMixes(key) {
  const [others] = await pool.query(
    `SELECT ps.song_id 
     FROM playlist_songs ps 
     JOIN playlists p ON p.id = ps.playlist_id 
     WHERE p.is_system = 1 AND p.system_key LIKE 'dailymix_%' AND p.system_key != ?`,
    [key]
  );
  const [mine] = await pool.query(
    `SELECT ps.song_id 
     FROM playlist_songs ps 
     JOIN playlists p ON p.id = ps.playlist_id 
     WHERE p.is_system = 1 AND p.system_key = ?`,
    [key]
  );
  
  if (mine.length === 0 || others.length === 0) return 0;

  const mineSet = new Set(mine.map(r => r.song_id));
  const otherSet = new Set(others.map(r => r.song_id));
  let overlapCount = 0;
  for (const songId of mineSet) {
    if (otherSet.has(songId)) overlapCount++;
  }
  return overlapCount / mineSet.size;
}

async function evaluateKey(originalKey) {
  const key = SYSTEM_KEY_ALIASES[originalKey] || originalKey;
  
  const report = {
    system_key: key,
    status: 'GOOD',
    actualSongs: 0,
    targetSize: SYSTEM_PLAYLIST_TARGET_SIZES[key] || 25,
    candidateCount: 'N/A',
    overlapRatio: 'N/A',
    addedSongs: 'N/A',
    removedSongs: 'N/A',
    artistCount: 0,
    genreCount: 0,
    maxSameArtistRatio: 0,
    maxSameGenreRatio: 0,
    missingGenreMetadataRatio: 0,
    audioFeatureCoverage: 0,
    sourceStart: 'N/A',
    strategy: 'N/A',
    crossPlaylistOverlapRatio: 0,
    warnings: [],
    criticalWarnings: [],
    suggestions: []
  };

  try {
    // 1. Get latest log from system_playlist_runs
    const keysToSearch = SYSTEM_KEY_RUN_ALIASES[key] || [key];
    const placeholders = keysToSearch.map(() => '?').join(',');
    const [logs] = await pool.query(
      `SELECT * FROM system_playlist_runs WHERE system_key IN (${placeholders}) ORDER BY created_at DESC, started_at DESC LIMIT 1`,
      keysToSearch
    );

    if (logs.length > 0) {
      const log = logs[0];
      report.overlapRatio = log.overlap_ratio !== null ? parseFloat(log.overlap_ratio) : 'N/A';
      
      try {
        const msg = JSON.parse(log.message || '{}');
        if (msg.candidateCount !== undefined) report.candidateCount = msg.candidateCount;
        if (msg.avgAddedSongs !== undefined) report.addedSongs = msg.avgAddedSongs;
        else if (msg.addedSongs !== undefined) report.addedSongs = msg.addedSongs;
        
        if (msg.avgRemovedSongs !== undefined) report.removedSongs = msg.avgRemovedSongs;
        else if (msg.removedSongs !== undefined) report.removedSongs = msg.removedSongs;
        if (msg.strategy !== undefined) report.strategy = msg.strategy;
        
        if (msg.overlapRatio !== undefined && report.overlapRatio === 'N/A') report.overlapRatio = msg.overlapRatio;
        
        if (msg.fallbackUsed) {
          report.warnings.push(`fallbackUsed: true (${msg.fallbackReason})`);
        } else if (msg.message && msg.message.includes('fallback')) {
          report.warnings.push(`fallback warning: ${msg.message}`);
        }
      } catch (e) {
        // parse plain text
        const candMatch = (log.message || '').match(/candidateCount["']?\s*[:=]\s*(\d+)/i);
        if (candMatch) report.candidateCount = parseInt(candMatch[1], 10);
      }
      
      // Source Window check via source_start_date just for weeklymix
      if (key === 'weekly_mix') {
        const startDay = getLocalDayFromDateString(log.source_start_date);
        if (startDay !== null && startDay !== 1) {
          report.criticalWarnings.push('sourceWindowCorrect FALSE (Expected Monday start)');
        }
      }
    }
    
    if (key.startsWith('dailymix')) {
      report.sourceStart = DAILY_MIX_SOURCE_LABELS[key] || 'N/A';
    }

    if (report.candidateCount === 'N/A' || report.overlapRatio === 'N/A') {
      report.criticalWarnings.push('Missing regenerate quality metrics: candidateCount/overlap/added/removed unavailable');
    }

    // 2. Fetch playlists and songs
    const audioCols = await getAudioFeatureColumns();
    const hasAudioFeatures = audioCols !== null;
    
    let audioSelects = '';
    if (hasAudioFeatures) {
      const selects = [];
      if (audioCols.energy) selects.push(`saf.${audioCols.energy} AS energy`);
      if (audioCols.danceability) selects.push(`saf.${audioCols.danceability} AS danceability`);
      if (audioCols.acoustic) selects.push(`saf.${audioCols.acoustic} AS acousticness`);
      if (audioCols.mood) selects.push(`saf.${audioCols.mood} AS mood`);
      if (audioCols.vibe) selects.push(`saf.${audioCols.vibe} AS vibe`);
      
      if (selects.length > 0) {
        audioSelects = selects.join(', ') + ',';
      } else {
        report.warnings.push('audio features unavailable: missing columns');
      }
    } else {
      report.warnings.push('audio features unavailable: missing table');
    }

    let sql = `
      SELECT 
        p.id AS playlist_id,
        p.user_id,
        ps.song_id,
        s.artist_id,
        s.genre_id,
        ${audioSelects}
        p.updated_at
      FROM playlists p
      JOIN (
        SELECT user_id, MAX(updated_at) AS latest_updated
        FROM playlists
        WHERE system_key = ? AND is_system = 1
        GROUP BY user_id
      ) latest ON latest.user_id = p.user_id AND latest.latest_updated = p.updated_at
      JOIN playlist_songs ps ON ps.playlist_id = p.id
      JOIN songs s ON s.id = ps.song_id
      ${hasAudioFeatures ? 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id' : ''}
      WHERE p.system_key = ? AND p.is_system = 1
    `;
    const [rows] = await pool.query(sql, [key, key]);

    const [counts] = await pool.query("SELECT COUNT(*) AS total_playlists, COUNT(DISTINCT user_id) AS total_users, MIN(updated_at) AS oldest_updated, MAX(updated_at) AS newest_updated FROM playlists WHERE system_key = ? AND is_system = 1", [key]);
    if (process.argv.includes('--debug')) {
      console.log(`[Evaluation Debug] DB Counts for ${key}:`, counts[0]);
    }

    if (rows.length === 0) {
      report.criticalWarnings.push('No playlists or songs found for this key.');
    } else {
      const playlists = {};
      const debugPlaylists = [];
      for (const row of rows) {
        if (!playlists[row.playlist_id]) {
          playlists[row.playlist_id] = { user_id: row.user_id, songs: new Map() };
          debugPlaylists.push({
            id: row.playlist_id,
            user_id: row.user_id,
            updated_at: row.updated_at
          });
        }
        const pl = playlists[row.playlist_id];
        
        // Deduplicate by song_id to avoid multiplying artist counts if other JOINs produce duplicates
        if (!pl.songs.has(row.song_id)) {
           pl.songs.set(row.song_id, {
             artist_id: row.artist_id,
             genre_id: row.genre_id,
             hasAudio: hasAudioFeatures && row.energy !== null && row.energy !== undefined
           });
        }
      }

      let totalSongs = 0;
      let totalArtistsCount = 0;
      let totalGenresCount = 0;
      let totalMaxArtistRatio = 0;
      let totalMaxGenreRatio = 0;
      let totalAudioCovRatio = 0;
      let totalMissingGenreRatio = 0;
      let worstMaxArtistRatio = 0;
      let worstMaxGenreRatio = 0;
      let failedDiversityPlaylists = 0;
      let failedSamples = [];
      const plIds = Object.keys(playlists);
      const numPlaylists = plIds.length;
      
      if (process.argv.includes('--debug')) {
        console.log(`[Evaluation Debug] playlist instances:`, debugPlaylists.map(p => ({
          id: p.id,
          user_id: p.user_id,
          updated_at: p.updated_at,
          song_count: playlists[p.id].songs.size
        })));
      }
      
      if (process.argv.includes('--debug')) {
        console.log(`\n[Info] Evaluating ${numPlaylists} playlist(s) for system_key: ${key}`);
      }

      for (const pid of plIds) {
        const pl = playlists[pid];
        const uniqueSongs = Array.from(pl.songs.values());
        const numSongs = uniqueSongs.length;
        
        const artistCounts = {};
        const genreCounts = {};
        let audioCov = 0;
        let missingGenreCount = 0;
        
        for (const song of uniqueSongs) {
           if (song.artist_id) artistCounts[song.artist_id] = (artistCounts[song.artist_id] || 0) + 1;
           if (song.genre_id) {
             genreCounts[song.genre_id] = (genreCounts[song.genre_id] || 0) + 1;
           } else {
             missingGenreCount++;
           }
           if (song.hasAudio) audioCov++;
        }
        
        const maxA = Object.keys(artistCounts).length > 0 ? Math.max(...Object.values(artistCounts)) : 0;
        const maxG = Object.keys(genreCounts).length > 0 ? Math.max(...Object.values(genreCounts)) : 0;
        
        const maxArtistRatio = numSongs > 0 ? maxA / numSongs : 0;
        const maxGenreRatio = numSongs > 0 ? maxG / numSongs : 0;
        const missingGenreRatio = numSongs > 0 ? missingGenreCount / numSongs : 0;
        
        totalSongs += numSongs;
        totalArtistsCount += Object.keys(artistCounts).length;
        totalGenresCount += Object.keys(genreCounts).length;
        totalAudioCovRatio += numSongs > 0 ? audioCov / numSongs : 0;
        totalMissingGenreRatio += missingGenreRatio;
        
        totalMaxArtistRatio += maxArtistRatio;
        totalMaxGenreRatio += maxGenreRatio;
        
        if (maxArtistRatio > worstMaxArtistRatio) worstMaxArtistRatio = maxArtistRatio;
        if (maxGenreRatio > worstMaxGenreRatio) worstMaxGenreRatio = maxGenreRatio;
        
        const thresholds = getDiversityThreshold(key);
        if (MULTI_INSTANCE_KEYS.includes(key) && (maxArtistRatio > thresholds.artist || maxGenreRatio > thresholds.genre)) {
           failedDiversityPlaylists++;
           failedSamples.push({
             playlistId: pid,
             userId: pl.user_id || 'unknown',
             songCount: numSongs,
             topArtistRatio: maxArtistRatio.toFixed(2),
             topGenreRatio: maxGenreRatio.toFixed(2)
           });
        }
      }
      
      if (failedSamples.length > 0 && process.argv.includes('--debug')) {
        console.log('[Evaluation Debug] failed diversity samples (top 10):', failedSamples.slice(0, 10));
      }

      report.numPlaylistsEvaluated = numPlaylists;
      report.actualSongs = Math.round(totalSongs / numPlaylists);
      report.artistCount = Math.round(totalArtistsCount / numPlaylists);
      report.genreCount = Math.round(totalGenresCount / numPlaylists);
      report.avgMaxSameArtistRatio = totalMaxArtistRatio / numPlaylists;
      report.avgMaxSameGenreRatio = totalMaxGenreRatio / numPlaylists;
      report.worstMaxSameArtistRatio = worstMaxArtistRatio;
      report.worstMaxSameGenreRatio = worstMaxGenreRatio;
      report.missingGenreMetadataRatio = totalMissingGenreRatio / numPlaylists;
      report.failedDiversityPlaylists = failedDiversityPlaylists;
      
      report.maxSameArtistRatio = worstMaxArtistRatio; // For threshold checking below
      report.maxSameGenreRatio = worstMaxGenreRatio; // For threshold checking below
      report.audioFeatureCoverage = totalAudioCovRatio / numPlaylists;
    }

    if (key.startsWith('dailymix')) {
      report.crossPlaylistOverlapRatio = await getCrossOverlapWithOtherDailyMixes(key);
      const limits = getDiversityThreshold(key);
      if (report.crossPlaylistOverlapRatio >= limits.overlapBad) {
        report.criticalWarnings.push(`crossPlaylistOverlapRatio >= ${limits.overlapBad * 100}% (${Math.round(report.crossPlaylistOverlapRatio*100)}%)`);
      } else if (report.crossPlaylistOverlapRatio > limits.overlapWarning) {
        report.warnings.push(`crossPlaylistOverlapRatio > ${limits.overlapWarning * 100}% (${Math.round(report.crossPlaylistOverlapRatio*100)}%)`);
      }
    }

    // Apply rules
    if (report.actualSongs < report.targetSize && report.actualSongs > 0) {
      report.warnings.push(`actualSongs < targetSize (${report.actualSongs}/${report.targetSize})`);
    }

    if (report.overlapRatio !== 'N/A') {
      const ratio = parseFloat(report.overlapRatio);
      if (ratio >= 0.9) {
        report.criticalWarnings.push(`overlap >= 90%, playlist too similar (${Math.round(ratio*100)}%)`);
      } else if (ratio >= 0.7) {
        report.warnings.push(`overlap >= 70% (${Math.round(ratio*100)}%)`);
      }
    }

    if (report.candidateCount !== 'N/A' && report.candidateCount <= report.targetSize) {
      report.criticalWarnings.push(`candidateCount lower than recommended targetSize * 2 (${report.candidateCount} <= ${report.targetSize * 2})`);
    }

    const thresholds = getDiversityThreshold(key);

    if (report.maxSameArtistRatio > thresholds.artist) {
      report.warnings.push(`maxSameArtistRatio > ${Math.round(thresholds.artist*100)}% (${Math.round(report.maxSameArtistRatio*100)}%)`);
      report.suggestions.push('tăng diversity penalty cho artist');
      report.suggestions.push('giảm weight bài của cùng một artist');
    }

    if (report.maxSameGenreRatio > thresholds.genre) {
      report.warnings.push(`maxSameGenreRatio > ${Math.round(thresholds.genre*100)}% (${Math.round(report.maxSameGenreRatio*100)}%)`);
      report.suggestions.push('tăng diversity penalty cho genre');
    }
    
    if (key.startsWith('dailymix') && report.maxSameGenreRatio >= thresholds.overlapBad) {
      report.criticalWarnings.push(`maxSameGenreRatio >= ${thresholds.overlapBad * 100}% (${Math.round(report.maxSameGenreRatio*100)}%)`);
    }

    if (report.missingGenreMetadataRatio > 0.1) {
      report.warnings.push(`missing genre metadata: ${Math.round(report.missingGenreMetadataRatio * 100)}% of songs have no genre`);
    }

    if (key.includes('vibes') || key === 'moodmix') {
      if (hasAudioFeatures && report.audioFeatureCoverage < 0.7) {
        report.warnings.push(`audioFeatureCoverage < 70% for Mood/Vibes (${Math.round(report.audioFeatureCoverage*100)}%)`);
      }
    }

    if (report.criticalWarnings.length > 0) {
      report.status = report.actualSongs === 0 ? 'ERROR' : 'WARNING';
      // if overlap >= 0.9, bad
      if (report.criticalWarnings.some(w => w.includes('overlap >= 90%') || w.includes('crossPlaylistOverlapRatio >= 90%') || w.includes('maxSameGenreRatio >='))) {
        report.status = 'BAD';
      }
    } else if (report.warnings.length > 0) {
      report.status = 'WARNING';
    }

  } catch (err) {
    report.status = 'ERROR';
    report.criticalWarnings.push(err.message);
  }

  return report;
}

function printReport(report) {
  console.log(`\n=== SYSTEM PLAYLIST EVALUATION ===\n`);
  console.log(`Playlist: ${report.system_key}`);
  console.log(`Instances evaluated: ${report.numPlaylistsEvaluated || 0}`);
  console.log(`Songs per playlist: ${report.actualSongs}/${report.targetSize}`);
  console.log(`Candidate count: ${report.candidateCount}`);
  
  const overlapStr = report.overlapRatio === 'N/A' ? 'N/A' : `${Math.round(report.overlapRatio * 100)}%`;
  console.log(`Overlap: ${overlapStr}`);
  console.log(`Added/Removed: ${report.addedSongs}/${report.removedSongs}\n`);
  
  if (MULTI_INSTANCE_KEYS.includes(report.system_key)) {
    console.log(`Avg max same artist: ${Math.round(report.avgMaxSameArtistRatio * 100)}%`);
    console.log(`Worst max same artist: ${Math.round(report.worstMaxSameArtistRatio * 100)}%`);
    console.log(`Avg max same genre: ${Math.round(report.avgMaxSameGenreRatio * 100)}%`);
    console.log(`Worst max same genre: ${Math.round(report.worstMaxSameGenreRatio * 100)}%`);
    console.log(`Failed diversity playlists: ${report.failedDiversityPlaylists}\n`);
  } else {
    console.log(`Artists: ${report.artistCount}`);
    console.log(`Genres: ${report.genreCount}`);
    console.log(`Max same artist: ${Math.round(report.worstMaxSameArtistRatio * 100)}%`);
    console.log(`Max same genre: ${Math.round(report.worstMaxSameGenreRatio * 100)}%`);
  }
  
  const audioCovStr = report.warnings.some(w => w.includes('audio features unavailable'))
    ? 'N/A'
    : `${Math.round(report.audioFeatureCoverage * 100)}%`;
  console.log(`Audio feature coverage: ${audioCovStr}`);
  
  if (report.system_key.startsWith('dailymix') && report.sourceStart !== 'N/A') {
    console.log(`Source: ${report.sourceStart}`);
    if (report.crossPlaylistOverlapRatio > 0) {
      console.log(`Cross overlap with other Daily Mixes: ${Math.round(report.crossPlaylistOverlapRatio * 100)}%`);
    }
  }

  if (report.system_key === 'trending_now' && report.strategy !== 'N/A') {
    console.log(`Strategy: ${report.strategy}`);
  }
  
  console.log(`Status: ${report.status}`);
  
  const allWarns = [...report.criticalWarnings, ...report.warnings];
  if (allWarns.length > 0) {
    console.log(`Warnings:`);
    allWarns.forEach(w => console.log(`- ${w}`));
  } else {
    console.log(`Warnings:\n- none`);
  }

  if (report.suggestions.length > 0) {
    console.log(`Suggested action:`);
    // dedup suggestions
    [...new Set(report.suggestions)].forEach(s => console.log(`- ${s}`));
  }
}

async function exportCSV(reports) {
  const csvPath = path.resolve(__dirname, '../../datasets/processed/system_playlist_evaluation_report.csv');
  const dir = path.dirname(csvPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const headers = [
    'system_key', 'status', 'actual_songs', 'target_size', 'candidate_count', 
    'overlap_ratio', 'added_songs', 'removed_songs', 'artist_count', 'genre_count', 
    'max_same_artist_ratio', 'max_same_genre_ratio',
    'failed_diversity_playlists',
    'avg_max_same_artist_ratio', 'worst_max_same_artist_ratio',
    'avg_max_same_genre_ratio', 'worst_max_same_genre_ratio',
    'audio_feature_coverage', 'warnings'
  ];

  const lines = [headers.join(',')];
  for (const r of reports) {
    const allWarns = [...r.criticalWarnings, ...r.warnings];
    const vals = [
      r.system_key,
      r.status,
      r.actualSongs,
      r.targetSize,
      r.candidateCount,
      r.overlapRatio,
      r.addedSongs,
      r.removedSongs,
      r.artistCount,
      r.genreCount,
      r.maxSameArtistRatio.toFixed(2),
      r.maxSameGenreRatio.toFixed(2),
      r.failedDiversityPlaylists || 0,
      (r.avgMaxSameArtistRatio || 0).toFixed(2),
      (r.worstMaxSameArtistRatio || 0).toFixed(2),
      (r.avgMaxSameGenreRatio || 0).toFixed(2),
      (r.worstMaxSameGenreRatio || 0).toFixed(2),
      r.warnings.some(w => w.includes('audio features unavailable')) ? 'N/A' : r.audioFeatureCoverage.toFixed(2),
      `"${allWarns.join('; ')}"`
    ];
    lines.push(vals.join(','));
  }

  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  console.log(`\nExported report to: ${csvPath}`);
}

async function run() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const doExport = args.includes('--export');
  
  let targetKeys = [];
  const keyArg = args.find(a => a.startsWith('--key='));
  
  if (isAll) {
    targetKeys = SYSTEM_KEYS;
  } else if (keyArg) {
    let rawKey = keyArg.split('=')[1];
    targetKeys = [normalizeSystemKey(rawKey)];
  } else {
    console.error('Please specify --all or --key=<system_key>');
    process.exit(1);
  }

  const reports = [];
  for (const key of targetKeys) {
    const report = await evaluateKey(key);
    reports.push(report);
    printReport(report);
  }

  if (doExport) {
    await exportCSV(reports);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
