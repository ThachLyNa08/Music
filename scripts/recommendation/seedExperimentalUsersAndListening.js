const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../../apps/backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const bcrypt = require(path.join(BACKEND_ROOT, 'node_modules/bcryptjs'));
const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));

const VALID_MARKETS = ['VPOP', 'KPOP', 'USUK'];
const SOURCE = 'experiment_seed';
const PASSWORD = 'MusicFlowExperiment2026!';

const GROUPS = [
  { key: 'vpop', label: 'VPOP main', prefix: 'exp_vpop', count: 35, markets: ['VPOP'], weights: { match: 0.82, partial: 0.14, mismatch: 0.04 } },
  { key: 'kpop', label: 'KPOP main', prefix: 'exp_kpop', count: 35, markets: ['KPOP'], weights: { match: 0.82, partial: 0.14, mismatch: 0.04 } },
  { key: 'usuk', label: 'USUK main', prefix: 'exp_usuk', count: 35, markets: ['USUK'], weights: { match: 0.82, partial: 0.14, mismatch: 0.04 } },
  { key: 'vpop_kpop', label: 'VPOP + KPOP', prefix: 'exp_vpop_kpop', count: 20, markets: ['VPOP', 'KPOP'], weights: { match: 0.84, partial: 0.12, mismatch: 0.04 } },
  { key: 'vpop_usuk', label: 'VPOP + USUK', prefix: 'exp_vpop_usuk', count: 20, markets: ['VPOP', 'USUK'], weights: { match: 0.84, partial: 0.12, mismatch: 0.04 } },
  { key: 'kpop_usuk', label: 'KPOP + USUK', prefix: 'exp_kpop_usuk', count: 20, markets: ['KPOP', 'USUK'], weights: { match: 0.84, partial: 0.12, mismatch: 0.04 } },
  { key: 'all', label: 'VPOP + KPOP + USUK', prefix: 'exp_all', count: 25, markets: ['VPOP', 'KPOP', 'USUK'], weights: { match: 0.90, partial: 0.08, mismatch: 0.02 } },
  { key: 'explorer', label: 'Explorer / Trending', prefix: 'exp_explorer', count: 10, markets: ['VPOP', 'KPOP', 'USUK'], weights: { match: 0.50, partial: 0.35, mismatch: 0.15 }, explorer: true },
];

function parseArgs() {
  const args = { count: 200, reset: false, exportCsv: false, minListens: 1000, maxListens: 1400 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--reset') args.reset = true;
    else if (arg === '--export') args.exportCsv = true;
    else if (arg.startsWith('--count=')) args.count = Number(arg.slice('--count='.length));
    else if (arg.startsWith('--min-listens=')) args.minListens = Number(arg.slice('--min-listens='.length));
    else if (arg.startsWith('--max-listens=')) args.maxListens = Number(arg.slice('--max-listens='.length));
  }
  return args;
}

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function makeRng(seed) {
  let value = seed >>> 0;
  return function rng() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260618);

function randomInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(items) {
  if (!items.length) return null;
  return items[Math.floor(rng() * items.length)];
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function takeUnique(items, limit, existing = new Set()) {
  const selected = [];
  for (const item of shuffle(items)) {
    if (!item || existing.has(item.id)) continue;
    existing.add(item.id);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
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

async function ensureExperimentColumn() {
  const userColumns = await getColumns('users');
  if (userColumns.has('is_experiment')) return true;
  await pool.query('ALTER TABLE users ADD COLUMN is_experiment TINYINT(1) DEFAULT 0');
  console.log('Added users.is_experiment with safe ALTER TABLE.');
  return true;
}

function experimentalEmailCondition(alias = 'u', hasExperimentColumn = false) {
  const prefix = alias ? `${quoteId(alias)}.` : '';
  const byEmail = `${prefix}${quoteId('email')} LIKE 'exp\\_%@musicflow.test' ESCAPE '\\\\'`;
  if (!hasExperimentColumn) return byEmail;
  return `(${prefix}${quoteId('is_experiment')} = 1 OR ${byEmail})`;
}

function buildExperimentUsers() {
  const users = [];
  for (const group of GROUPS) {
    for (let i = 1; i <= group.count; i += 1) {
      const ordinal = String(i).padStart(3, '0');
      users.push({
        group,
        index: i,
        email: `${group.prefix}_${ordinal}@musicflow.test`,
        displayName: `Experiment ${group.label} ${ordinal}`,
      });
    }
  }
  return users;
}

function normalizeMarket(row) {
  const market = String(row.market || '').toUpperCase();
  if (VALID_MARKETS.includes(market)) return market;

  const genre = `${row.genre_name || ''} ${row.genre_slug || ''}`.toUpperCase();
  const language = String(row.language || '').toLowerCase();
  if (genre.includes('VPOP') || genre.includes('V-POP') || language === 'vi') return 'VPOP';
  if (genre.includes('KPOP') || genre.includes('K-POP') || language === 'ko') return 'KPOP';
  if (genre.includes('USUK') || genre.includes('US-UK') || language === 'en') return 'USUK';
  return 'USUK';
}

async function loadSongs() {
  const songColumns = await getColumns('songs');
  const genreColumns = await getColumns('genres');
  const hasAudioFeatures = await tableExists('song_audio_features');
  const audioColumns = hasAudioFeatures ? await getColumns('song_audio_features') : new Set();

  const select = [
    's.id',
    's.title',
    songColumns.has('artist_id') ? 's.artist_id' : 'NULL AS artist_id',
    songColumns.has('genre_id') ? 's.genre_id' : 'NULL AS genre_id',
    songColumns.has('duration_sec') ? 's.duration_sec' : '0 AS duration_sec',
    songColumns.has('market') ? 's.market' : 'NULL AS market',
    songColumns.has('language') ? 's.language' : 'NULL AS language',
    songColumns.has('play_count') ? 's.play_count' : '0 AS play_count',
    genreColumns.has('name') ? 'g.name AS genre_name' : 'NULL AS genre_name',
    genreColumns.has('slug') ? 'g.slug AS genre_slug' : 'NULL AS genre_slug',
    hasAudioFeatures && audioColumns.has('tempo_level') ? 'saf.tempo_level' : 'NULL AS tempo_level',
    hasAudioFeatures && audioColumns.has('energy') ? 'saf.energy' : 'NULL AS energy',
    hasAudioFeatures && audioColumns.has('energy_score') ? 'saf.energy_score' : 'NULL AS energy_score',
    hasAudioFeatures && audioColumns.has('danceability') ? 'saf.danceability' : 'NULL AS danceability',
    hasAudioFeatures && audioColumns.has('acoustic_score') ? 'saf.acoustic_score' : 'NULL AS acoustic_score',
    hasAudioFeatures && audioColumns.has('mood') ? 'saf.mood' : 'NULL AS mood',
    hasAudioFeatures && audioColumns.has('vibe') ? 'saf.vibe' : 'NULL AS vibe',
  ];

  const joins = [];
  if (songColumns.has('genre_id') && (await tableExists('genres'))) {
    joins.push('LEFT JOIN genres g ON g.id = s.genre_id');
  } else {
    joins.push('LEFT JOIN (SELECT NULL AS id, NULL AS name, NULL AS slug) g ON 1=0');
  }
  if (hasAudioFeatures) joins.push('LEFT JOIN song_audio_features saf ON saf.song_id = s.id');

  const where = [];
  if (songColumns.has('is_active')) where.push('s.is_active = 1');
  if (songColumns.has('audio_url')) where.push("s.audio_url IS NOT NULL AND s.audio_url <> ''");
  if (songColumns.has('release_status')) {
    where.push(`(
      s.release_status = 'published'
      OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW())
    )`);
  }

  const [rows] = await pool.query(`
    SELECT ${select.join(',\n           ')}
    FROM songs s
    ${joins.join('\n    ')}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${songColumns.has('play_count') ? 's.play_count DESC,' : ''} s.id ASC
  `);

  const byMarket = { VPOP: [], KPOP: [], USUK: [] };
  for (const row of rows) {
    const market = normalizeMarket(row);
    const song = { ...row, market, duration_sec: Number(row.duration_sec) || randomInt(180, 260) };
    byMarket[market].push(song);
  }

  for (const market of VALID_MARKETS) {
    if (byMarket[market].length === 0) {
      throw new Error(`No real songs found for market ${market}. Seed aborted.`);
    }
  }

  return {
    allSongs: Object.values(byMarket).flat(),
    byMarket,
    anchorsByMarket: Object.fromEntries(VALID_MARKETS.map((market) => [market, byMarket[market].slice(0, 400)])),
  };
}

function buildGroupPools(songPools) {
  const marketCore = Object.fromEntries(
    VALID_MARKETS.map((market) => [market, songPools.byMarket[market].slice(0, Math.min(360, songPools.byMarket[market].length))])
  );
  const marketExpanded = Object.fromEntries(
    VALID_MARKETS.map((market) => [market, songPools.byMarket[market].slice(0, Math.min(1400, songPools.byMarket[market].length))])
  );
  const trendingBridge = VALID_MARKETS.flatMap((market) => songPools.byMarket[market].slice(0, Math.min(220, songPools.byMarket[market].length)));

  const groupPools = {};
  for (const group of GROUPS) {
    const otherMarkets = VALID_MARKETS.filter((market) => !group.markets.includes(market));
    const corePerMarket = group.explorer ? 170 : group.markets.length === 1 ? 320 : group.markets.length === 2 ? 210 : 160;
    const expandedPerMarket = group.explorer ? 320 : group.markets.length === 1 ? 900 : group.markets.length === 2 ? 600 : 460;
    const bridgePerMarket = group.explorer ? 160 : 120;

    const core = group.markets.flatMap((market) => marketCore[market].slice(0, corePerMarket));
    const expanded = group.markets.flatMap((market) => marketExpanded[market].slice(0, expandedPerMarket));
    const bridgeMarkets = group.explorer ? VALID_MARKETS : otherMarkets.length ? otherMarkets : VALID_MARKETS;
    const bridge = bridgeMarkets.flatMap((market) => marketCore[market].slice(0, bridgePerMarket));

    groupPools[group.key] = {
      core: shuffle(core),
      expanded: shuffle(expanded),
      bridge: shuffle([...trendingBridge, ...bridge]),
    };
  }

  return groupPools;
}

function chooseListenCount(minListens, maxListens) {
  return randomInt(minListens, maxListens);
}

function chooseUniqueTarget(targetCount, availableCount) {
  const desired = Math.round(targetCount * (0.30 + rng() * 0.08));
  return clamp(desired, Math.min(250, availableCount), Math.min(500, availableCount));
}

function chooseRelation(group) {
  const roll = rng();
  if (roll < group.weights.match) return 'match';
  if (roll < group.weights.match + group.weights.partial) return 'partial';
  return 'mismatch';
}

function chooseMarketForRelation(group, relation) {
  if (group.explorer) return pick(VALID_MARKETS);
  const otherMarkets = VALID_MARKETS.filter((market) => !group.markets.includes(market));
  if (relation === 'match') return pick(group.markets);
  if (relation === 'partial') return otherMarkets.length ? pick([...group.markets, ...otherMarkets]) : pick(group.markets);
  return otherMarkets.length ? pick(otherMarkets) : pick(VALID_MARKETS);
}

function pickSongFromMarket(songPools, market, state, preferRepeat) {
  const sourcePool = rng() < 0.35 ? songPools.anchorsByMarket[market] : songPools.byMarket[market];
  if (preferRepeat) {
    const repeatable = [...state.songCounts.entries()]
      .filter(([, count]) => count > 0 && count < 5)
      .map(([songId]) => state.songById.get(songId))
      .filter((song) => song && song.market === market);
    const repeated = pick(repeatable);
    if (repeated) return repeated;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = pick(sourcePool);
    if (!candidate) continue;
    const count = state.songCounts.get(candidate.id) || 0;
    if (count < 5) return candidate;
  }

  return pick(sourcePool);
}

function behaviorForRelation(relation) {
  if (relation === 'match') {
    return {
      completionRate: Math.round((0.75 + rng() * 0.25) * 1000) / 1000,
      skipped: false,
      liked: rng() < 0.46,
    };
  }
  if (relation === 'partial') {
    const completionRate = Math.round((0.35 + rng() * 0.35) * 1000) / 1000;
    return {
      completionRate,
      skipped: rng() < 0.30 || completionRate < 0.45,
      liked: rng() < 0.10,
    };
  }
  return {
    completionRate: Math.round((0.05 + rng() * 0.25) * 1000) / 1000,
    skipped: true,
    liked: rng() < 0.01,
  };
}

function playedAtFor(song) {
  const daysAgo = randomInt(0, 89);
  let hour;
  const mood = String(song.mood || song.vibe || '').toLowerCase();
  if (mood.includes('chill') || mood.includes('sad') || mood.includes('calm')) hour = pick([20, 21, 22, 23, 0]);
  else if (mood.includes('energetic') || mood.includes('party') || song.energy === 'high') hour = pick([8, 9, 10, 15, 16, 18, 19]);
  else hour = pick([7, 8, 12, 13, 17, 19, 21, 22]);

  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, randomInt(0, 59), randomInt(0, 59), 0);
  return date;
}

function implicitRating({ completionRate, liked, repeated, playlistAdded, artistFollowed, skippedEarly }) {
  return clamp(
    0.45 * completionRate +
      0.25 * Number(liked) +
      0.15 * Number(repeated) +
      0.10 * Number(playlistAdded) +
      0.05 * Number(artistFollowed) -
      0.25 * Number(skippedEarly),
    0,
    1
  );
}

function buildListeningInsertRow(columns, event) {
  const values = {};
  values.user_id = event.userId;
  values.song_id = event.song.id;

  if (columns.has('listen_duration')) values.listen_duration = event.listenDuration;
  if (columns.has('listened_duration')) values.listened_duration = event.listenDuration;
  if (columns.has('song_duration')) values.song_duration = event.songDuration;
  if (columns.has('completion_rate')) values.completion_rate = event.completionRate;
  if (columns.has('is_completed')) values.is_completed = event.completionRate >= 0.8 ? 1 : 0;
  if (columns.has('is_skipped')) values.is_skipped = event.skipped ? 1 : 0;
  if (columns.has('skipped')) values.skipped = event.skipped ? 1 : 0;
  if (columns.has('skip_at_sec')) values.skip_at_sec = event.skipped ? Math.max(5, event.listenDuration) : null;
  if (columns.has('source')) values.source = SOURCE;
  if (columns.has('implicit_rating')) values.implicit_rating = event.rating;
  if (columns.has('listened_at')) values.listened_at = formatDateTime(event.playedAt);
  if (columns.has('played_at')) values.played_at = formatDateTime(event.playedAt);
  if (columns.has('hour_of_day')) values.hour_of_day = event.playedAt.getHours();
  if (columns.has('day_of_week')) values.day_of_week = event.playedAt.getDay();
  if (columns.has('created_at')) values.created_at = formatDateTime(event.playedAt);

  return values;
}

async function createOrUpdateUsers(experimentUsers, hasExperimentColumn) {
  const userColumns = await getColumns('users');
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const result = [];
  let created = 0;

  for (const item of experimentUsers) {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [item.email]);
    if (existing.length) {
      const updates = ['display_name = ?', "role = 'user'"];
      const params = [item.displayName];
      if (userColumns.has('status')) updates.push("status = 'active'");
      if (hasExperimentColumn) updates.push('is_experiment = 1');
      params.push(existing[0].id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      result.push({ ...item, id: existing[0].id });
      continue;
    }

    const fields = ['email', 'password_hash', 'display_name', 'role'];
    const params = [item.email, passwordHash, item.displayName, 'user'];
    if (userColumns.has('status')) {
      fields.push('status');
      params.push('active');
    }
    if (hasExperimentColumn) {
      fields.push('is_experiment');
      params.push(1);
    }

    const placeholders = fields.map(() => '?').join(', ');
    const [inserted] = await pool.query(
      `INSERT INTO users (${fields.map(quoteId).join(', ')}) VALUES (${placeholders})`,
      params
    );
    created += 1;
    result.push({ ...item, id: inserted.insertId });
  }

  return { users: result, created };
}

async function resetExperimentalData(hasExperimentColumn) {
  const [users] = await pool.query(
    `SELECT id FROM users u WHERE ${experimentalEmailCondition('u', hasExperimentColumn)}`
  );
  const userIds = users.map((row) => row.id);
  if (userIds.length === 0) {
    return { usersDeleted: 0, historiesDeleted: 0 };
  }

  let historiesDeleted = 0;
  if (await tableExists('playlist_songs')) {
    await pool.query(
      `DELETE ps FROM playlist_songs ps JOIN playlists p ON p.id = ps.playlist_id WHERE p.user_id IN (?)`,
      [userIds]
    );
  }
  if (await tableExists('playlists')) await pool.query('DELETE FROM playlists WHERE user_id IN (?)', [userIds]);
  if (await tableExists('recommendations')) await pool.query('DELETE FROM recommendations WHERE user_id IN (?)', [userIds]);
  if (await tableExists('user_saved_playlists')) await pool.query('DELETE FROM user_saved_playlists WHERE user_id IN (?)', [userIds]);
  if (await tableExists('notifications')) await pool.query('DELETE FROM notifications WHERE user_id IN (?)', [userIds]);
  if (await tableExists('song_likes')) await pool.query('DELETE FROM song_likes WHERE user_id IN (?)', [userIds]);
  if (await tableExists('artist_follows')) await pool.query('DELETE FROM artist_follows WHERE user_id IN (?)', [userIds]);
  if (await tableExists('user_genre_preferences')) await pool.query('DELETE FROM user_genre_preferences WHERE user_id IN (?)', [userIds]);
  if (await tableExists('user_artist_preferences')) await pool.query('DELETE FROM user_artist_preferences WHERE user_id IN (?)', [userIds]);
  if (await tableExists('listening_history')) {
    const [deleted] = await pool.query('DELETE FROM listening_history WHERE user_id IN (?) AND source = ?', [userIds, SOURCE]);
    historiesDeleted = deleted.affectedRows || 0;
  }
  const [deletedUsers] = await pool.query('DELETE FROM users WHERE id IN (?)', [userIds]);
  return { usersDeleted: deletedUsers.affectedRows || 0, historiesDeleted };
}

async function insertRows(tableName, rows, chunkSize = 1000) {
  if (!rows.length) return 0;
  const fields = Object.keys(rows[0]);
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((row) => fields.map((field) => row[field]));
    const [result] = await pool.query(
      `INSERT INTO ${quoteId(tableName)} (${fields.map(quoteId).join(', ')}) VALUES ?`,
      [values]
    );
    inserted += result.affectedRows || 0;
  }

  return inserted;
}

function topItemsByCount(items, keyFn, limit) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => Number(key));
}

async function insertPreferences(userId, songs, followedArtistIds) {
  if (await tableExists('user_genre_preferences')) {
    const genreIds = topItemsByCount(songs, (song) => song.genre_id, 4);
    for (const genreId of genreIds) {
      await pool.query(
        `INSERT INTO user_genre_preferences (user_id, genre_id, weight)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE weight = GREATEST(weight, VALUES(weight))`,
        [userId, genreId, 4]
      );
    }
  }

  if (await tableExists('user_artist_preferences')) {
    const artistIds = [...new Set([...followedArtistIds, ...topItemsByCount(songs, (song) => song.artist_id, 5)])].slice(0, 5);
    for (const artistId of artistIds) {
      await pool.query(
        `INSERT INTO user_artist_preferences (user_id, artist_id, weight)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE weight = GREATEST(weight, VALUES(weight))`,
        [userId, artistId, 4]
      );
    }
  }
}

async function insertArtistFollow(userId, artistId) {
  if (!(await tableExists('artist_follows')) || !artistId) return false;
  const [existing] = await pool.query(
    'SELECT id FROM artist_follows WHERE user_id = ? AND artist_id = ? LIMIT 1',
    [userId, artistId]
  );
  if (existing.length) return false;
  await pool.query('INSERT INTO artist_follows (user_id, artist_id) VALUES (?, ?)', [userId, artistId]);
  return true;
}

async function insertLike(userId, songId, likedAt) {
  if (!(await tableExists('song_likes'))) return false;
  const [result] = await pool.query(
    'INSERT IGNORE INTO song_likes (user_id, song_id, liked_at) VALUES (?, ?, ?)',
    [userId, songId, formatDateTime(likedAt)]
  );
  return (result.affectedRows || 0) > 0;
}

async function insertLikesForUser(likes) {
  if (!(await tableExists('song_likes')) || likes.length === 0) return 0;
  const values = likes.map((like) => [like.userId, like.songId, formatDateTime(like.likedAt)]);
  let inserted = 0;
  for (let i = 0; i < values.length; i += 1000) {
    const chunk = values.slice(i, i + 1000);
    const [result] = await pool.query(
      'INSERT IGNORE INTO song_likes (user_id, song_id, liked_at) VALUES ?',
      [chunk]
    );
    inserted += result.affectedRows || 0;
  }
  return inserted;
}

function chooseFollowedArtists(songPools, group) {
  const candidates = group.markets.flatMap((market) => songPools.anchorsByMarket[market]).filter((song) => song.artist_id);
  const artistIds = [];
  for (let attempt = 0; attempt < 30 && artistIds.length < randomInt(2, 5); attempt += 1) {
    const song = pick(candidates);
    if (song && !artistIds.includes(song.artist_id)) artistIds.push(song.artist_id);
  }
  return artistIds;
}

function relationForBucket(bucket) {
  if (bucket === 'core') return 'match';
  if (bucket === 'expanded') return rng() < 0.85 ? 'match' : 'partial';
  return rng() < 0.65 ? 'partial' : 'mismatch';
}

function chooseRepeatBucket() {
  const roll = rng();
  if (roll < 0.72) return 'core';
  if (roll < 0.92) return 'expanded';
  return 'bridge';
}

function pickWeightedSelectedSong(selectedByBucket) {
  const bucket = chooseRepeatBucket();
  const pool = selectedByBucket[bucket]?.length ? selectedByBucket[bucket] : [
    ...selectedByBucket.core,
    ...selectedByBucket.expanded,
    ...selectedByBucket.bridge,
  ];
  const hotPool = pool.filter((item) => item.count < (item.bucket === 'core' ? 12 : item.bucket === 'expanded' ? 8 : 5));
  return pick(hotPool.length ? hotPool : pool);
}

function buildSelectedSongsForUser(user, songPools, groupPools, targetCount) {
  const pools = groupPools[user.group.key];
  const existing = new Set();
  const availableCount = new Set([...pools.core, ...pools.expanded, ...pools.bridge].map((song) => song.id)).size;
  const targetUnique = chooseUniqueTarget(targetCount, availableCount);

  const coreUnique = Math.round(targetUnique * (user.group.explorer ? 0.45 : 0.58));
  const expandedUnique = Math.round(targetUnique * (user.group.explorer ? 0.37 : 0.32));
  const bridgeUnique = Math.max(1, targetUnique - coreUnique - expandedUnique);

  const selected = [
    ...takeUnique(pools.core, coreUnique, existing).map((song) => ({ song, bucket: 'core', relation: 'match', count: 0 })),
    ...takeUnique(pools.expanded, expandedUnique, existing).map((song) => ({ song, bucket: 'expanded', relation: relationForBucket('expanded'), count: 0 })),
    ...takeUnique(pools.bridge, bridgeUnique, existing).map((song) => ({ song, bucket: 'bridge', relation: relationForBucket('bridge'), count: 0 })),
  ];

  for (const market of user.group.markets) {
    if (!selected.some((item) => item.song.market === market)) {
      const fallback = takeUnique(songPools.anchorsByMarket[market], 1, existing)[0];
      if (fallback) selected.push({ song: fallback, bucket: 'core', relation: 'match', count: 0 });
    }
  }

  const selectedByBucket = {
    core: selected.filter((item) => item.bucket === 'core'),
    expanded: selected.filter((item) => item.bucket === 'expanded'),
    bridge: selected.filter((item) => item.bucket === 'bridge'),
  };

  return { selected, selectedByBucket };
}

async function seedListeningForUser(user, songPools, groupPools, listeningColumns, listenRange) {
  const [[existingHistory]] = await pool.query(
    'SELECT COUNT(*) AS total FROM listening_history WHERE user_id = ? AND source = ?',
    [user.id, SOURCE]
  );
  if (Number(existingHistory.total) > 0) {
    return { skipped: true, histories: 0, likes: 0, follows: 0, songs: [], marketCounts: {} };
  }

  const followedArtistIds = chooseFollowedArtists(songPools, user.group);
  let follows = 0;
  for (const artistId of followedArtistIds) {
    if (await insertArtistFollow(user.id, artistId)) follows += 1;
  }

  const state = {
    songCounts: new Map(),
    songById: new Map(songPools.allSongs.map((song) => [song.id, song])),
  };

  const targetCount = chooseListenCount(listenRange.min, listenRange.max);
  const { selected, selectedByBucket } = buildSelectedSongsForUser(user, songPools, groupPools, targetCount);
  const events = [];
  const likedSongs = new Map();
  const marketCounts = {};

  function addEventForItem(item) {
    if (!item || !item.song) return;
    const song = item.song;
    const relation = item.relation || relationForBucket(item.bucket);

    const previousCount = state.songCounts.get(song.id) || 0;
    const behavior = behaviorForRelation(relation);
    const songDuration = Number(song.duration_sec) > 0 ? Number(song.duration_sec) : randomInt(180, 260);
    const listenDuration = clamp(Math.round(songDuration * behavior.completionRate), 5, songDuration);
    const skippedEarly = behavior.skipped && behavior.completionRate < 0.3;
    const repeated = previousCount > 0;
    const artistFollowed = followedArtistIds.includes(song.artist_id);
    const rating = implicitRating({
      completionRate: behavior.completionRate,
      liked: behavior.liked,
      repeated,
      playlistAdded: false,
      artistFollowed,
      skippedEarly,
    });
    const playedAt = playedAtFor(song);

    state.songCounts.set(song.id, previousCount + 1);
    marketCounts[song.market] = (marketCounts[song.market] || 0) + 1;

    if (behavior.liked && !behavior.skipped && behavior.completionRate >= 0.75) {
      likedSongs.set(song.id, { songId: song.id, likedAt: playedAt });
    }

    events.push(buildListeningInsertRow(listeningColumns, {
      userId: user.id,
      song,
      songDuration,
      listenDuration,
      completionRate: behavior.completionRate,
      skipped: behavior.skipped,
      rating,
      playedAt,
    }));

    item.count += 1;
  }

  for (const item of selected) addEventForItem(item);

  while (events.length < targetCount) {
    addEventForItem(pickWeightedSelectedSong(selectedByBucket));
  }

  const histories = await insertRows('listening_history', events);
  const listenedSongs = [...state.songCounts.keys()].map((songId) => state.songById.get(songId)).filter(Boolean);

  const likes = await insertLikesForUser(
    [...likedSongs.values()].map((like) => ({ userId: user.id, songId: like.songId, likedAt: like.likedAt }))
  );

  await insertPreferences(user.id, listenedSongs, followedArtistIds);
  return { skipped: false, histories, likes, follows, songs: listenedSongs, marketCounts, uniqueSongs: listenedSongs.length };
}

async function summarize(hasExperimentColumn) {
  const condition = experimentalEmailCondition('u', hasExperimentColumn);
  const [[users]] = await pool.query(`SELECT COUNT(*) AS total FROM users u WHERE ${condition}`);
  const [groups] = await pool.query(`
    SELECT
      CASE
        WHEN email LIKE 'exp_vpop_kpop_%@musicflow.test' THEN 'VPOP + KPOP'
        WHEN email LIKE 'exp_vpop_usuk_%@musicflow.test' THEN 'VPOP + USUK'
        WHEN email LIKE 'exp_kpop_usuk_%@musicflow.test' THEN 'KPOP + USUK'
        WHEN email LIKE 'exp_vpop_%@musicflow.test' THEN 'VPOP main'
        WHEN email LIKE 'exp_kpop_%@musicflow.test' THEN 'KPOP main'
        WHEN email LIKE 'exp_usuk_%@musicflow.test' THEN 'USUK main'
        WHEN email LIKE 'exp_all_%@musicflow.test' THEN 'VPOP + KPOP + USUK'
        WHEN email LIKE 'exp_explorer_%@musicflow.test' THEN 'Explorer / Trending'
        ELSE 'unknown'
      END AS user_group,
      COUNT(*) AS total
    FROM users
    WHERE email LIKE 'exp\\_%@musicflow.test' ESCAPE '\\\\'
    GROUP BY user_group
    ORDER BY user_group
  `);
  const [[histories]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${condition}
  `, [SOURCE]);
  const [[likes]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM song_likes sl
    JOIN users u ON u.id = sl.user_id
    WHERE ${condition}
  `);
  const followsTable = await tableExists('artist_follows');
  const follows = followsTable
    ? (await pool.query(`
        SELECT COUNT(*) AS total
        FROM artist_follows af
        JOIN users u ON u.id = af.user_id
        WHERE ${condition}
      `))[0][0]
    : { total: 0 };
  const [markets] = await pool.query(`
    SELECT COALESCE(s.market, 'OTHER') AS market, COUNT(*) AS total
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    JOIN songs s ON s.id = lh.song_id
    WHERE lh.source = ? AND ${condition}
    GROUP BY COALESCE(s.market, 'OTHER')
    ORDER BY market
  `, [SOURCE]);

  return {
    users: Number(users.total || 0),
    histories: Number(histories.total || 0),
    likes: Number(likes.total || 0),
    follows: Number(follows.total || 0),
    groups,
    markets,
  };
}

async function main() {
  const args = parseArgs();
  if (args.count !== 200) {
    throw new Error('This controlled dataset is locked to --count=200.');
  }
  if (!Number.isInteger(args.minListens) || !Number.isInteger(args.maxListens) || args.minListens < 1 || args.maxListens < args.minListens) {
    throw new Error('--min-listens and --max-listens must be valid positive integers, with max >= min.');
  }

  const expectedCount = GROUPS.reduce((sum, group) => sum + group.count, 0);
  if (expectedCount !== args.count) {
    throw new Error(`Group distribution totals ${expectedCount}, expected ${args.count}.`);
  }

  const hasExperimentColumn = await ensureExperimentColumn();
  if (args.reset) {
    const reset = await resetExperimentalData(hasExperimentColumn);
    console.log(`Reset complete. Experimental users deleted: ${reset.usersDeleted}. experiment_seed histories deleted: ${reset.historiesDeleted}.`);
  }

  const listeningColumns = await getColumns('listening_history');
  if (!listeningColumns.has('user_id') || !listeningColumns.has('song_id')) {
    throw new Error('listening_history is missing user_id/song_id columns.');
  }

  const experimentUsers = buildExperimentUsers();
  const { users, created } = await createOrUpdateUsers(experimentUsers, hasExperimentColumn);
  const songPools = await loadSongs();
  const groupPools = buildGroupPools(songPools);

  const runStats = { histories: 0, likes: 0, follows: 0, skippedUsers: 0, marketCounts: {}, uniqueSongSelections: 0 };
  for (const user of users) {
    const stats = await seedListeningForUser(
      user,
      songPools,
      groupPools,
      listeningColumns,
      { min: args.minListens, max: args.maxListens }
    );
    if (stats.skipped) {
      runStats.skippedUsers += 1;
      continue;
    }
    runStats.histories += stats.histories;
    runStats.likes += stats.likes;
    runStats.follows += stats.follows;
    runStats.uniqueSongSelections += stats.uniqueSongs || 0;
    for (const [market, total] of Object.entries(stats.marketCounts)) {
      runStats.marketCounts[market] = (runStats.marketCounts[market] || 0) + total;
    }
  }

  const summary = await summarize(hasExperimentColumn);
  console.log('\nExperimental recommendation seed summary');
  console.log(`Users created this run: ${created}`);
  console.log(`Users skipped because histories already exist: ${runStats.skippedUsers}`);
  console.log(`Listening rows inserted this run: ${runStats.histories}`);
  console.log(`Average unique songs per seeded user this run: ${users.length - runStats.skippedUsers > 0 ? (runStats.uniqueSongSelections / (users.length - runStats.skippedUsers)).toFixed(2) : '0.00'}`);
  console.log(`Likes inserted this run: ${runStats.likes}`);
  console.log(`Artist follows inserted this run: ${runStats.follows}`);
  console.log(`Total experimental users: ${summary.users}`);
  console.log(`Total experiment_seed listening_history rows: ${summary.histories}`);
  console.log(`Total experimental likes: ${summary.likes}`);
  console.log(`Total experimental artist follows: ${summary.follows}`);
  console.log('Distribution by user group:', summary.groups);
  console.log('Distribution by market:', summary.markets);
  console.log('\nExport CSV with: node scripts/recommendation/exportUsersCsv.js');

  if (args.exportCsv) {
    const { exportUsersCsv } = require('./exportUsersCsv');
    const outputPath = await exportUsersCsv();
    console.log(`CSV exported: ${outputPath}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed experimental users failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
