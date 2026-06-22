const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../../apps/backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));

const OUTPUT_PATH = path.resolve(__dirname, '../../datasets/processed/musicflow_users_export.csv');

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function getColumns(tableName) {
  if (!(await tableExists(tableName))) return new Set();
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

function deriveExperimentGroup(email) {
  if (!email || !email.endsWith('@musicflow.test')) return '';
  if (/^exp_vpop_kpop_\d+@musicflow\.test$/.test(email)) return 'VPOP + KPOP';
  if (/^exp_vpop_usuk_\d+@musicflow\.test$/.test(email)) return 'VPOP + USUK';
  if (/^exp_kpop_usuk_\d+@musicflow\.test$/.test(email)) return 'KPOP + USUK';
  if (/^exp_vpop_\d+@musicflow\.test$/.test(email)) return 'VPOP main';
  if (/^exp_kpop_\d+@musicflow\.test$/.test(email)) return 'KPOP main';
  if (/^exp_usuk_\d+@musicflow\.test$/.test(email)) return 'USUK main';
  if (/^exp_all_\d+@musicflow\.test$/.test(email)) return 'VPOP + KPOP + USUK';
  if (/^exp_explorer_\d+@musicflow\.test$/.test(email)) return 'Explorer / Trending';
  return '';
}

function setTop(map, userId, value, count) {
  if (!userId || !value) return;
  const current = map.get(userId);
  if (!current || Number(count) > current.count) {
    map.set(userId, { value, count: Number(count) || 0 });
  }
}

async function exportUsersCsv() {
  const userColumns = await getColumns('users');
  const listeningColumns = await getColumns('listening_history');

  const nameColumn = ['username', 'display_name', 'name'].find((column) => userColumns.has(column));
  const select = [
    'id AS user_id',
    nameColumn ? `${quoteId(nameColumn)} AS username` : 'NULL AS username',
    userColumns.has('email') ? 'email' : 'NULL AS email',
    userColumns.has('role') ? 'role' : 'NULL AS role',
    userColumns.has('is_experiment')
      ? 'COALESCE(is_experiment, 0) AS is_experiment'
      : `CASE WHEN email LIKE 'exp\\_%@musicflow.test' ESCAPE '\\\\' THEN 1 ELSE 0 END AS is_experiment`,
    userColumns.has('created_at') ? 'created_at' : 'NULL AS created_at',
  ];

  const [users] = await pool.query(`
    SELECT ${select.join(', ')}
    FROM users
    ORDER BY user_id
  `);

  const listenStats = new Map();
  const topMarkets = new Map();
  const topGenres = new Map();

  if (await tableExists('listening_history')) {
    const listenedAtColumn = listeningColumns.has('listened_at')
      ? 'listened_at'
      : (listeningColumns.has('played_at') ? 'played_at' : null);
    const [rows] = await pool.query(`
      SELECT user_id, COUNT(*) AS total_listens, ${listenedAtColumn ? `MAX(${quoteId(listenedAtColumn)})` : 'NULL'} AS last_listened_at
      FROM listening_history
      GROUP BY user_id
    `);
    for (const row of rows) {
      listenStats.set(row.user_id, {
        total_listens: Number(row.total_listens || 0),
        last_listened_at: row.last_listened_at || '',
      });
    }

    if ((await tableExists('songs'))) {
      const songColumns = await getColumns('songs');
      const marketExpr = songColumns.has('market') ? "COALESCE(s.market, 'OTHER')" : "'UNKNOWN'";
      const [marketRows] = await pool.query(`
        SELECT lh.user_id, ${marketExpr} AS market, COUNT(*) AS total
        FROM listening_history lh
        JOIN songs s ON s.id = lh.song_id
        GROUP BY lh.user_id, ${marketExpr}
      `);
      for (const row of marketRows) setTop(topMarkets, row.user_id, row.market, row.total);

      if (await tableExists('genres')) {
        const [genreRows] = await pool.query(`
          SELECT lh.user_id, COALESCE(g.name, '') AS genre_name, COUNT(*) AS total
          FROM listening_history lh
          JOIN songs s ON s.id = lh.song_id
          LEFT JOIN genres g ON g.id = s.genre_id
          GROUP BY lh.user_id, COALESCE(g.name, '')
        `);
        for (const row of genreRows) setTop(topGenres, row.user_id, row.genre_name, row.total);
      }
    }
  }

  const likeStats = new Map();
  if (await tableExists('song_likes')) {
    const [rows] = await pool.query('SELECT user_id, COUNT(*) AS total_liked_songs FROM song_likes GROUP BY user_id');
    for (const row of rows) likeStats.set(row.user_id, Number(row.total_liked_songs || 0));
  }

  const followStats = new Map();
  if (await tableExists('artist_follows')) {
    const [rows] = await pool.query('SELECT user_id, COUNT(DISTINCT artist_id) AS total_followed_artists FROM artist_follows GROUP BY user_id');
    for (const row of rows) followStats.set(row.user_id, Number(row.total_followed_artists || 0));
  }

  const headers = [
    'user_id',
    'username',
    'email',
    'role',
    'is_experiment',
    'created_at',
    'total_listens',
    'total_liked_songs',
    'total_followed_artists',
    'top_market',
    'top_genre',
    'last_listened_at',
    'user_group',
  ];

  const rows = users.map((user) => {
    const stats = listenStats.get(user.user_id) || {};
    return {
      user_id: user.user_id,
      username: user.username || '',
      email: user.email || '',
      role: user.role || '',
      is_experiment: Number(user.is_experiment || 0),
      created_at: user.created_at || '',
      total_listens: stats.total_listens || 0,
      total_liked_songs: likeStats.get(user.user_id) || 0,
      total_followed_artists: followStats.get(user.user_id) || 0,
      top_market: topMarkets.get(user.user_id)?.value || '',
      top_genre: topGenres.get(user.user_id)?.value || '',
      last_listened_at: stats.last_listened_at || '',
      user_group: deriveExperimentGroup(user.email),
    };
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\n');

  fs.writeFileSync(OUTPUT_PATH, `\uFEFF${csv}`, 'utf8');
  console.log(`Exported ${rows.length} users to ${OUTPUT_PATH}`);
  return OUTPUT_PATH;
}

if (require.main === module) {
  exportUsersCsv()
    .catch((error) => {
      console.error('Export users CSV failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

module.exports = { exportUsersCsv, OUTPUT_PATH };
