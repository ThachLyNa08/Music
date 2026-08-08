require('dotenv').config();

const { pool } = require('../../src/config/database');
const stemService = require('../../src/services/stem.service');

const INTERRUPTED_MESSAGE = 'Stem processing interrupted because AI service stopped before output files were generated.';

function parseArgs(argv) {
  const args = {
    dryRun: argv.includes('--dry-run'),
    markStale: argv.includes('--mark-stale'),
    retry: argv.includes('--retry'),
    songId: null,
  };
  const songArg = argv.find((arg) => arg.startsWith('--song-id='));
  if (songArg) args.songId = Number(songArg.split('=')[1]);
  return args;
}

function recommendedAction(row, vocalsExists, instrumentalExists) {
  if (row.status === 'completed' && vocalsExists && instrumentalExists) return 'none';
  if (row.status === 'completed') return 'mark-failed';
  if (row.status === 'processing' && vocalsExists && instrumentalExists) return 'mark-completed';
  if (row.status === 'processing') return 'mark-stale';
  if (['failed', 'stale'].includes(row.status)) return 'retry';
  return 'inspect';
}

async function loadRows(songId = null) {
  const params = [];
  let where = '';
  if (songId) {
    where = 'WHERE ss.song_id = ? OR ss.id = ?';
    params.push(songId, songId);
  }
  const [rows] = await pool.query(
    `SELECT ss.*, s.title, a.name AS artist_name
     FROM song_stems ss
     LEFT JOIN songs s ON s.id = ss.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     ${where}
     ORDER BY ss.updated_at DESC
     LIMIT 200`,
    params
  );
  return rows;
}

async function resolveSongId(inputId) {
  const [rows] = await pool.query(
    'SELECT song_id FROM song_stems WHERE song_id = ? OR id = ? ORDER BY song_id = ? DESC LIMIT 1',
    [inputId, inputId, inputId]
  );
  return Number(rows[0]?.song_id || inputId);
}

async function printDryRun(rows) {
  for (const row of rows) {
    const vocalsExists = stemService.publicStemUrlExists(row.vocals_url) || stemService.fileExistsAndNonEmpty(stemService.stemOutputPaths(row.song_id).vocalsPath);
    const instrumentalExists = stemService.publicStemUrlExists(row.instrumental_url) || stemService.fileExistsAndNonEmpty(stemService.stemOutputPaths(row.song_id).instrumentalPath);
    console.log(JSON.stringify({
      stem_id: row.id,
      song_id: row.song_id,
      title: row.title,
      artist_name: row.artist_name,
      status: row.status,
      updated_at: row.updated_at,
      heartbeat_at: row.heartbeat_at,
      vocals_path_exists: vocalsExists,
      instrumental_path_exists: instrumentalExists,
      recommended_action: recommendedAction(row, vocalsExists, instrumentalExists),
      error_message: row.error_message || null,
    }, null, 2));
  }
}

async function markSongStale(songId) {
  songId = await resolveSongId(songId);
  const [rows] = await pool.query('SELECT * FROM song_stems WHERE song_id = ? LIMIT 1', [songId]);
  const stem = rows[0];
  if (!stem) throw new Error(`No song_stems row found for song_id=${songId}`);
  if (stemService.hasStemOutputFiles(songId)) {
    const { vocalsUrl, instrumentalUrl } = stemService.stemPublicUrls(songId);
    await pool.query(
      `UPDATE song_stems
       SET status = 'completed', vocals_url = ?, instrumental_url = ?, error_message = NULL,
           completed_at = NOW(), processed_at = NOW(), updated_at = NOW()
       WHERE song_id = ?`,
      [vocalsUrl, instrumentalUrl, songId]
    );
    console.log(`song_id=${songId} has complete output files; marked completed.`);
    return;
  }
  await pool.query(
    `UPDATE song_stems
     SET status = 'stale',
         vocals_url = NULL,
         instrumental_url = NULL,
         error_message = ?,
         failed_at = NOW(),
         updated_at = NOW()
     WHERE song_id = ?`,
    [INTERRUPTED_MESSAGE, songId]
  );
  await pool.query(
    `UPDATE stem_separation_jobs
     SET status = 'stale', progress = 0, error_message = ?, failed_at = NOW(), updated_at = NOW()
     WHERE song_id = ? AND status IN ('pending','processing')`,
    [INTERRUPTED_MESSAGE, songId]
  );
  console.log(`song_id=${songId} marked stale.`);
}

async function findRetryUser(songId) {
  const [jobRows] = await pool.query(
    `SELECT user_id FROM stem_separation_jobs
     WHERE song_id = ?
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [songId]
  );
  if (jobRows[0]?.user_id) return { id: jobRows[0].user_id, role: 'admin' };

  const [adminRows] = await pool.query(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
  );
  if (adminRows[0]?.id) return { id: adminRows[0].id, role: 'admin' };

  throw new Error('Cannot find a user/admin account to own the retry stem job.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await stemService.ensureStemSchema();

  if (!args.songId && (args.markStale || args.retry)) {
    throw new Error('--song-id is required for --mark-stale or --retry');
  }

  if (args.markStale) {
    await markSongStale(args.songId);
    return;
  }

  if (args.retry) {
    await markSongStale(args.songId);
    stemService.cleanupPartialStemFiles(args.songId);
    const user = await findRetryUser(args.songId);
    const job = await stemService.requestSeparation(user, args.songId);
    console.log(`song_id=${args.songId} retry requested. job_id=${job?.id || job?.stem_id || 'unknown'} status=${job?.status || 'unknown'}`);
    return;
  }

  const rows = await loadRows(args.songId);
  if (args.dryRun || !args.markStale) {
    await printDryRun(rows);
  }
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
