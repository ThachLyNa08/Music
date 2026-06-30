const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const backendRequire = createRequire(
  path.resolve(__dirname, '../../apps/backend/package.json')
);

backendRequire('dotenv').config({
  path: path.resolve(__dirname, '../../apps/backend/.env')
});
const mysql = backendRequire('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'musicflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function hasValidSyncedLyrics(text) {
  if (!text || !text.trim()) return false;
  return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*\S/.test(text);
}

function generateReport(records, reportName) {
  if (records.length === 0) return;
  const reportDir = path.resolve(__dirname, '../../datasets/processed/lyrics');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const filePath = path.join(reportDir, reportName);
  const header = 'song_id,title,artist_name,current_sync_type,has_plain_lyrics,has_synced_lyrics,suggested_sync_type,reason\n';
  const csvData = records.map(r => {
    return `"${r.song_id}","${(r.title || '').replace(/"/g, '""')}","${(r.artist_name || '').replace(/"/g, '""')}","${r.current_sync_type}","${r.has_plain}","${r.has_synced}","${r.suggested}","${r.reason}"`;
  }).join('\n');
  fs.writeFileSync(filePath, header + csvData);
  console.log(`Saved report to ${filePath}`);
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = process.argv.includes('--dry-run');
  const includeInstrumental = process.argv.includes('--include-instrumental');

  if (!isApply && !isDryRun) {
    console.log('Usage: node fixLyricsSyncType.js [--dry-run] [--apply] [--include-instrumental]');
    process.exit(1);
  }

  console.log(`Starting fixLyricsSyncType script in ${isApply ? 'APPLY' : 'DRY-RUN'} mode...`);
  if (includeInstrumental) {
    console.log('\n======================================================');
    console.log('WARNING: You are about to update INSTRUMENTAL sync_type records.');
    console.log('======================================================\n');
  }

  try {
    const [rows] = await pool.query(`
      SELECT sl.song_id, sl.sync_type, sl.plain_lyrics, sl.synced_lyrics, s.title, a.name as artist_name 
      FROM song_lyrics sl
      JOIN songs s ON sl.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
    `);
    console.log(`\nTotal records scanned: ${rows.length}`);

    const distinctSyncTypes = new Set(rows.map(r => r.sync_type || 'NULL/EMPTY'));
    console.log(`Distinct sync_type values: ${Array.from(distinctSyncTypes).join(', ')}`);

    let stats = {
      noneToSynced: 0,
      plainToSynced: 0,
      syncedToPlain: 0,
      syncedToNone: 0,
      emptyToTarget: 0,
      instrumentalSkipped: 0,
      suspiciousInstrumentalWithLyrics: 0,
      suspiciousInstrumentalWithoutLyrics: 0
    };

    let samples = {
      noneToSynced: [],
      plainToSynced: [],
      syncedToPlain: [],
      emptyToTarget: [],
      instrumentalSkipped: []
    };

    let suspiciousInstrumentals = [];
    let toUpdate = [];

    for (const row of rows) {
      let expectedSyncType = row.sync_type || 'NONE';
      const isSyncedValid = hasValidSyncedLyrics(row.synced_lyrics);
      const hasPlain = row.plain_lyrics && row.plain_lyrics.trim() !== '';

      if (isSyncedValid) {
        expectedSyncType = 'LINE_SYNCED';
      } else if (hasPlain) {
        expectedSyncType = 'PLAIN_TEXT';
      } else {
        expectedSyncType = 'NONE';
      }

      const current = row.sync_type;

      if (current === 'INSTRUMENTAL' && !includeInstrumental) {
        stats.instrumentalSkipped++;
        if (samples.instrumentalSkipped.length < 5) {
          samples.instrumentalSkipped.push({ song_id: row.song_id, old: current, new: expectedSyncType });
        }
        if (isSyncedValid || hasPlain) {
          stats.suspiciousInstrumentalWithLyrics++;
          suspiciousInstrumentals.push({
            song_id: row.song_id,
            title: row.title,
            artist_name: row.artist_name,
            current_sync_type: current,
            has_plain: hasPlain,
            has_synced: isSyncedValid,
            suggested: expectedSyncType,
            reason: 'Has lyrics but marked as INSTRUMENTAL'
          });
        } else {
          stats.suspiciousInstrumentalWithoutLyrics++;
        }
        continue;
      }

      if (expectedSyncType !== current) {
        let isSafeToUpdate = true;
        
        if (!current || current === 'NONE') {
          if (expectedSyncType === 'LINE_SYNCED') {
            stats.noneToSynced++;
            if (samples.noneToSynced.length < 5) samples.noneToSynced.push({ song_id: row.song_id, old: current, new: expectedSyncType });
          } else {
            stats.emptyToTarget++;
            if (samples.emptyToTarget.length < 5) samples.emptyToTarget.push({ song_id: row.song_id, old: current, new: expectedSyncType });
          }
        } else if (current === 'PLAIN_TEXT' && expectedSyncType === 'LINE_SYNCED') {
          stats.plainToSynced++;
          if (samples.plainToSynced.length < 5) samples.plainToSynced.push({ song_id: row.song_id, old: current, new: expectedSyncType });
        } else if (current === 'LINE_SYNCED' && expectedSyncType === 'PLAIN_TEXT') {
          stats.syncedToPlain++;
          if (samples.syncedToPlain.length < 5) samples.syncedToPlain.push({ song_id: row.song_id, old: current, new: expectedSyncType });
        } else if (current === 'LINE_SYNCED' && expectedSyncType === 'NONE') {
          stats.syncedToNone++;
          isSafeToUpdate = false; // Never automatically delete synced state if plain is also gone, just in case
        } else if (current === 'INSTRUMENTAL' && includeInstrumental) {
          // If we are here, includeInstrumental is true
          stats.emptyToTarget++;
        } else {
          stats.emptyToTarget++;
        }

        if (isSafeToUpdate) {
          toUpdate.push({
            song_id: row.song_id,
            expected: expectedSyncType
          });
        }
      }
    }

    console.log('\n--- Result ---');
    console.log(`Need fix NONE -> LINE_SYNCED: ${stats.noneToSynced}`);
    console.log(`Need fix PLAIN_TEXT -> LINE_SYNCED: ${stats.plainToSynced}`);
    console.log(`Need fix LINE_SYNCED -> PLAIN_TEXT: ${stats.syncedToPlain}`);
    console.log(`Need fix empty/null -> target: ${stats.emptyToTarget}`);
    console.log(`Instrumental skipped: ${stats.instrumentalSkipped}`);
    console.log(`Suspicious instrumental with lyrics: ${stats.suspiciousInstrumentalWithLyrics}`);
    console.log(`Suspicious instrumental without lyrics: ${stats.suspiciousInstrumentalWithoutLyrics}`);

    console.log('\n--- Samples ---');
    if (samples.noneToSynced.length) {
      console.log('\nSample NONE -> LINE_SYNCED:');
      samples.noneToSynced.forEach(s => console.log(`  Song ID: ${s.song_id} | ${s.old} -> ${s.new}`));
    }
    if (samples.plainToSynced.length) {
      console.log('\nSample PLAIN_TEXT -> LINE_SYNCED:');
      samples.plainToSynced.forEach(s => console.log(`  Song ID: ${s.song_id} | ${s.old} -> ${s.new}`));
    }
    if (samples.syncedToPlain.length) {
      console.log('\nSample LINE_SYNCED -> PLAIN_TEXT:');
      samples.syncedToPlain.forEach(s => console.log(`  Song ID: ${s.song_id} | ${s.old} -> ${s.new}`));
    }
    if (samples.instrumentalSkipped.length) {
      console.log('\nSample INSTRUMENTAL skipped:');
      samples.instrumentalSkipped.forEach(s => console.log(`  Song ID: ${s.song_id} | ${s.old} -> ${s.new}`));
    }

    if (suspiciousInstrumentals.length > 0) {
      console.log('');
      generateReport(suspiciousInstrumentals, 'suspicious-instrumental-sync-type-report.csv');
    }

    if (isApply) {
      let updatedCount = 0;
      for (const item of toUpdate) {
        await pool.query('UPDATE song_lyrics SET sync_type = ? WHERE song_id = ?', [item.expected, item.song_id]);
        updatedCount++;
      }
      console.log(`\nUpdate completed successfully! Updated ${updatedCount} records.`);
    } else {
      console.log(`\nDry run completed. Found ${toUpdate.length} records that would be updated. Run with --apply to perform updates.`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
