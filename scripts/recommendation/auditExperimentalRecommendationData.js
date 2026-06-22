const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../../apps/backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));

const SOURCE = 'experiment_seed';
const OUTPUT_JSON = path.resolve(__dirname, '../../datasets/processed/recommendation_experiment_audit.json');
const OUTPUT_CSV = path.resolve(__dirname, '../../datasets/processed/recommendation_experiment_audit.csv');

const GROUPS = [
  { key: 'vpop', label: 'VPOP main', requiredMarkets: ['VPOP'], pattern: 'exp_vpop_' },
  { key: 'kpop', label: 'KPOP main', requiredMarkets: ['KPOP'], pattern: 'exp_kpop_' },
  { key: 'usuk', label: 'USUK main', requiredMarkets: ['USUK'], pattern: 'exp_usuk_' },
  { key: 'vpop_kpop', label: 'VPOP + KPOP', requiredMarkets: ['VPOP', 'KPOP'], pattern: 'exp_vpop_kpop_' },
  { key: 'vpop_usuk', label: 'VPOP + USUK', requiredMarkets: ['VPOP', 'USUK'], pattern: 'exp_vpop_usuk_' },
  { key: 'kpop_usuk', label: 'KPOP + USUK', requiredMarkets: ['KPOP', 'USUK'], pattern: 'exp_kpop_usuk_' },
  { key: 'all', label: 'VPOP + KPOP + USUK', requiredMarkets: ['VPOP', 'KPOP', 'USUK'], pattern: 'exp_all_' },
  { key: 'explorer', label: 'Explorer / Trending', requiredMarkets: ['VPOP', 'KPOP', 'USUK'], pattern: 'exp_explorer_' },
];

const GROUP_CASE_SQL = `
  CASE
    WHEN u.email LIKE 'exp_vpop_kpop_%@musicflow.test' THEN 'VPOP + KPOP'
    WHEN u.email LIKE 'exp_vpop_usuk_%@musicflow.test' THEN 'VPOP + USUK'
    WHEN u.email LIKE 'exp_kpop_usuk_%@musicflow.test' THEN 'KPOP + USUK'
    WHEN u.email LIKE 'exp_vpop_%@musicflow.test' THEN 'VPOP main'
    WHEN u.email LIKE 'exp_kpop_%@musicflow.test' THEN 'KPOP main'
    WHEN u.email LIKE 'exp_usuk_%@musicflow.test' THEN 'USUK main'
    WHEN u.email LIKE 'exp_all_%@musicflow.test' THEN 'VPOP + KPOP + USUK'
    WHEN u.email LIKE 'exp_explorer_%@musicflow.test' THEN 'Explorer / Trending'
    ELSE 'unknown'
  END
`;

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function round(value, digits = 4) {
  const number = Number(value || 0);
  return Number(number.toFixed(digits));
}

function percent(value) {
  return round(Number(value || 0) * 100, 2);
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
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

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

function experimentUserCondition(hasExperimentColumn, alias = 'u') {
  const prefix = alias ? `${quoteId(alias)}.` : '';
  const email = `${prefix}${quoteId('email')} LIKE 'exp\\_%@musicflow.test' ESCAPE '\\\\'`;
  return hasExperimentColumn ? `(${prefix}${quoteId('is_experiment')} = 1 OR ${email})` : email;
}

function listenDurationExpression(columns, alias = 'lh') {
  if (columns.has('listen_duration')) return `${alias}.listen_duration`;
  if (columns.has('listened_duration')) return `${alias}.listened_duration`;
  return '0';
}

function skippedExpression(columns, alias = 'lh') {
  if (columns.has('is_skipped')) return `${alias}.is_skipped`;
  if (columns.has('skipped')) return `${alias}.skipped`;
  if (columns.has('skip_at_sec')) return `IF(${alias}.skip_at_sec IS NULL, 0, 1)`;
  return '0';
}

function listenedAtExpression(columns, alias = 'lh') {
  if (columns.has('listened_at')) return `${alias}.listened_at`;
  if (columns.has('played_at')) return `${alias}.played_at`;
  if (columns.has('created_at')) return `${alias}.created_at`;
  return 'NULL';
}

async function getTopArtistsByGroup(expCondition) {
  const rows = await query(`
    SELECT user_group, artist_name, total
    FROM (
      SELECT
        ${GROUP_CASE_SQL} AS user_group,
        a.name AS artist_name,
        COUNT(*) AS total,
        ROW_NUMBER() OVER (PARTITION BY ${GROUP_CASE_SQL} ORDER BY COUNT(*) DESC, a.name ASC) AS rn
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      JOIN songs s ON s.id = lh.song_id
      JOIN artists a ON a.id = s.artist_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY user_group, a.id, a.name
    ) ranked
    WHERE rn <= 5
    ORDER BY user_group, rn
  `, [SOURCE]);

  const byGroup = {};
  for (const row of rows) {
    if (!byGroup[row.user_group]) byGroup[row.user_group] = [];
    byGroup[row.user_group].push({ artist: row.artist_name, listens: Number(row.total || 0) });
  }
  return byGroup;
}

async function getTopValueByGroup(expCondition, valueSql, valueAlias) {
  const rows = await query(`
    SELECT user_group, ${valueAlias}, total
    FROM (
      SELECT
        ${GROUP_CASE_SQL} AS user_group,
        ${valueSql} AS ${valueAlias},
        COUNT(*) AS total,
        ROW_NUMBER() OVER (PARTITION BY ${GROUP_CASE_SQL} ORDER BY COUNT(*) DESC, ${valueSql} ASC) AS rn
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      JOIN songs s ON s.id = lh.song_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY user_group, ${valueAlias}
    ) ranked
    WHERE rn = 1
  `, [SOURCE]);
  return Object.fromEntries(rows.map((row) => [row.user_group, { value: row[valueAlias], listens: Number(row.total || 0) }]));
}

function normalizeMarketRows(rows) {
  const output = {};
  for (const row of rows) {
    const group = row.user_group || 'ALL';
    if (!output[group]) output[group] = { VPOP: 0, KPOP: 0, USUK: 0, OTHER: 0, total: 0 };
    const market = row.market || 'OTHER';
    output[group][market] = Number(row.total || 0);
    output[group].total += Number(row.total || 0);
  }
  for (const group of Object.keys(output)) {
    for (const market of ['VPOP', 'KPOP', 'USUK', 'OTHER']) {
      output[group][`${market.toLowerCase()}_rate`] = output[group].total
        ? round(output[group][market] / output[group].total, 4)
        : 0;
    }
  }
  return output;
}

function evaluateMarketQuality(groupMarketDistribution) {
  const checks = [];
  for (const group of GROUPS) {
    const dist = groupMarketDistribution[group.label] || {};
    const missing = group.requiredMarkets.filter((market) => !dist[market]);
    const requiredTotal = group.requiredMarkets.reduce((sum, market) => sum + Number(dist[market] || 0), 0);
    const requiredRate = dist.total ? requiredTotal / dist.total : 0;
    let ok = missing.length === 0;
    let note = 'required markets present';

    if (group.requiredMarkets.length === 2) {
      ok = ok && requiredRate >= 0.75;
      note = `two target markets rate ${percent(requiredRate)}%`;
    } else if (group.key === 'all') {
      ok = ok && group.requiredMarkets.every((market) => Number(dist[market] || 0) / (dist.total || 1) >= 0.20);
      note = 'all three markets present with meaningful share';
    } else if (group.key === 'explorer') {
      ok = ok && group.requiredMarkets.every((market) => Number(dist[market] || 0) / (dist.total || 1) >= 0.20);
      note = 'explorer has broad multi-market spread';
    } else {
      const mainMarket = group.requiredMarkets[0];
      ok = ok && Number(dist[mainMarket] || 0) / (dist.total || 1) >= 0.70;
      note = `${mainMarket} main-market rate ${percent(Number(dist[mainMarket] || 0) / (dist.total || 1))}%`;
    }

    checks.push({
      group: group.label,
      required_markets: group.requiredMarkets,
      missing_markets: missing,
      required_market_rate: round(requiredRate, 4),
      ok,
      note,
    });
  }
  return checks;
}

function computeOverlap(groupSongRows) {
  const groupSongs = new Map();
  for (const row of groupSongRows) {
    if (!groupSongs.has(row.user_group)) groupSongs.set(row.user_group, new Set());
    groupSongs.get(row.user_group).add(Number(row.song_id));
  }

  const pairs = [];
  const groups = [...groupSongs.keys()].sort();
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const a = groupSongs.get(groups[i]);
      const b = groupSongs.get(groups[j]);
      let intersection = 0;
      for (const songId of a) {
        if (b.has(songId)) intersection += 1;
      }
      const union = a.size + b.size - intersection;
      pairs.push({
        group_a: groups[i],
        group_b: groups[j],
        shared_songs: intersection,
        union_songs: union,
        jaccard: union ? round(intersection / union, 4) : 0,
      });
    }
  }

  const avgJaccard = pairs.length
    ? round(pairs.reduce((sum, item) => sum + item.jaccard, 0) / pairs.length, 4)
    : 0;

  return {
    average_jaccard: avgJaccard,
    pair_count: pairs.length,
    top_pairs: pairs.sort((a, b) => b.jaccard - a.jaccard).slice(0, 10),
    bottom_pairs: [...pairs].sort((a, b) => a.jaccard - b.jaccard).slice(0, 10),
  };
}

function buildCsvRows(audit) {
  const rows = [];

  rows.push({ section: 'overview', name: 'experimental_users', value: audit.overview.experimental_users });
  rows.push({ section: 'overview', name: 'interactions', value: audit.overview.experiment_listening_history });
  rows.push({ section: 'overview', name: 'unique_songs', value: audit.overview.unique_songs_heard });
  rows.push({ section: 'overview', name: 'unique_artists', value: audit.overview.unique_artists_heard });
  rows.push({ section: 'overview', name: 'unique_genres', value: audit.overview.unique_genres_heard });
  rows.push({ section: 'overview', name: 'readiness', value: audit.dataset_readiness.status, note: audit.dataset_readiness.reasons.join(' | ') });
  rows.push({ section: 'cf', name: 'unique_user_song_pairs', value: audit.collaborative_filtering_readiness.user_song_pairs });
  rows.push({ section: 'cf', name: 'avg_unique_songs_per_user', value: audit.collaborative_filtering_readiness.avg_unique_songs_per_user });
  rows.push({ section: 'cf', name: 'repeated_listen_ratio', value: audit.collaborative_filtering_readiness.repeated_listen_ratio });
  rows.push({ section: 'cf', name: 'songs_with_at_least_2_users', value: audit.collaborative_filtering_readiness.songs_with_at_least_2_users });
  rows.push({ section: 'cf', name: 'songs_with_at_least_5_users', value: audit.collaborative_filtering_readiness.songs_with_at_least_5_users });
  rows.push({ section: 'cf', name: 'songs_with_at_least_10_users', value: audit.collaborative_filtering_readiness.songs_with_at_least_10_users });

  for (const group of audit.group_distribution) {
    rows.push({
      section: 'group',
      name: group.user_group,
      users: group.users,
      listens: group.listens,
      avg_listens_per_user: group.avg_listens_per_user,
      top_market: group.top_market?.value || '',
      top_genre: group.top_genre?.value || '',
      avg_completion_rate: group.avg_completion_rate,
      skip_rate: group.skip_rate,
      like_rate: group.like_rate,
      top_artists: group.top_artists.map((artist) => `${artist.artist}:${artist.listens}`).join('|'),
    });
  }

  for (const [group, dist] of Object.entries(audit.market_distribution.by_group)) {
    rows.push({
      section: 'market_by_group',
      name: group,
      VPOP: dist.VPOP,
      KPOP: dist.KPOP,
      USUK: dist.USUK,
      OTHER: dist.OTHER,
      total: dist.total,
    });
  }

  for (const bucket of audit.behavior_realism.completion_buckets) {
    rows.push({
      section: 'completion_bucket',
      name: bucket.bucket,
      value: bucket.total,
      rate: bucket.rate,
    });
  }

  for (const check of audit.market_distribution.quality_checks) {
    rows.push({
      section: 'market_quality',
      name: check.group,
      ok: check.ok,
      required_markets: check.required_markets.join('|'),
      missing_markets: check.missing_markets.join('|'),
      required_market_rate: check.required_market_rate,
      note: check.note,
    });
  }

  return rows;
}

function writeCsv(rows, outputPath) {
  const headers = [...rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set())];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\n');
  fs.writeFileSync(outputPath, `\uFEFF${csv}`, 'utf8');
}

function decideReadiness({ overview, marketChecks, behavior, cf, duplicates }) {
  const warnings = [];
  const reasons = [];

  if (overview.experimental_users !== 200) warnings.push(`Expected 200 experimental users, found ${overview.experimental_users}.`);
  if (overview.experiment_listening_history < 200000) warnings.push('Interactions are below the expected 200,000 lower bound.');
  if (overview.experiment_listening_history > 260000) warnings.push('Interactions are above the expected 260,000 upper bound.');
  if (overview.min_listens_per_user < 1000) warnings.push('At least one user has fewer than 1,000 listens.');
  if (overview.avg_listens_per_user < 1000) warnings.push('Average listens/user is below 1,000.');
  if (cf.avg_unique_songs_per_user < 250) warnings.push('Average unique songs/user is below 250.');
  if (cf.users_with_at_least_50_interactions < 150) warnings.push('Too few users have at least 50 interactions for stable CF training.');
  if (cf.songs_with_at_least_2_users < 2500) warnings.push('Song overlap is low; BPR-MF may learn sparse item relations.');
  if (cf.songs_with_at_least_5_users < 1000) warnings.push('Too few songs have at least 5 users.');
  if (cf.songs_with_at_least_10_users < 300) warnings.push('Too few songs have at least 10 users.');
  if (cf.matrix_density <= 0) warnings.push('Interaction matrix density is zero.');
  if (marketChecks.some((check) => !check.ok)) warnings.push('One or more user groups failed market-distribution checks.');
  if (behavior.liked_with_high_completion_rate < 0.9) warnings.push('Less than 90% of liked user-song pairs have high completion.');
  if (behavior.skipped_liked_pair_rate > 0.05) warnings.push('More than 5% of liked user-song pairs also have skipped listens.');
  if (duplicates.duplicate_user_emails > 0) warnings.push('Duplicate experimental emails found.');
  if (duplicates.duplicate_likes > 0) warnings.push('Duplicate likes found.');
  if (duplicates.duplicate_artist_follows > 0) warnings.push('Duplicate artist follows found.');
  if (duplicates.real_users_with_experiment_seed_history > 0) warnings.push('Non-experimental users have experiment_seed listening rows.');

  if (warnings.length === 0) {
    reasons.push('Core counts, group distribution, behavior signals, duplicates, and CF readiness checks passed.');
  } else {
    reasons.push(...warnings);
  }

  return {
    status: warnings.length === 0 ? 'READY' : 'NEEDS_REVIEW',
    reasons,
    warnings,
    can_train_bpr_mf_next: warnings.length === 0,
  };
}

async function buildAudit() {
  const userColumns = await getColumns('users');
  const historyColumns = await getColumns('listening_history');
  const hasExperimentColumn = userColumns.has('is_experiment');
  const expCondition = experimentUserCondition(hasExperimentColumn, 'u');
  const skippedExpr = skippedExpression(historyColumns, 'lh');
  const listenDurationExpr = listenDurationExpression(historyColumns, 'lh');
  const listenedAtExpr = listenedAtExpression(historyColumns, 'lh');

  const [overviewRow] = await query(`
    SELECT
      COUNT(DISTINCT u.id) AS experimental_users,
      COUNT(lh.id) AS experiment_listening_history,
      COUNT(DISTINCT lh.song_id) AS unique_songs_heard,
      COUNT(DISTINCT s.artist_id) AS unique_artists_heard,
      COUNT(DISTINCT s.genre_id) AS unique_genres_heard,
      AVG(lh.completion_rate) AS avg_completion_rate,
      AVG(CASE WHEN ${skippedExpr} = 1 THEN 1 ELSE 0 END) AS skip_rate
    FROM users u
    LEFT JOIN listening_history lh ON lh.user_id = u.id AND lh.source = ?
    LEFT JOIN songs s ON s.id = lh.song_id
    WHERE ${expCondition}
  `, [SOURCE]);

  const [listenRange] = await query(`
    SELECT
      MIN(total) AS min_listens_per_user,
      MAX(total) AS max_listens_per_user,
      AVG(total) AS avg_listens_per_user
    FROM (
      SELECT u.id, COUNT(lh.id) AS total
      FROM users u
      LEFT JOIN listening_history lh ON lh.user_id = u.id AND lh.source = ?
      WHERE ${expCondition}
      GROUP BY u.id
    ) per_user
  `, [SOURCE]);

  const [likeCount] = await query(`
    SELECT COUNT(*) AS total
    FROM song_likes sl
    JOIN users u ON u.id = sl.user_id
    WHERE ${expCondition}
  `);

  const followsTable = await tableExists('artist_follows');
  const [followCount] = followsTable
    ? await query(`
        SELECT COUNT(*) AS total
        FROM artist_follows af
        JOIN users u ON u.id = af.user_id
        WHERE ${expCondition}
      `)
    : [{ total: 0 }];

  const overview = {
    experimental_users: Number(overviewRow.experimental_users || 0),
    experiment_listening_history: Number(overviewRow.experiment_listening_history || 0),
    min_listens_per_user: Number(listenRange.min_listens_per_user || 0),
    max_listens_per_user: Number(listenRange.max_listens_per_user || 0),
    avg_listens_per_user: round(listenRange.avg_listens_per_user, 4),
    total_likes: Number(likeCount.total || 0),
    total_artist_follows: Number(followCount.total || 0),
    unique_songs_heard: Number(overviewRow.unique_songs_heard || 0),
    unique_artists_heard: Number(overviewRow.unique_artists_heard || 0),
    unique_genres_heard: Number(overviewRow.unique_genres_heard || 0),
    avg_completion_rate: round(overviewRow.avg_completion_rate, 4),
    skip_rate: round(overviewRow.skip_rate, 4),
  };

  const topArtistsByGroup = await getTopArtistsByGroup(expCondition);
  const topMarketByGroup = await getTopValueByGroup(expCondition, "COALESCE(s.market, 'OTHER')", 'market');
  const topGenreByGroup = await getTopValueByGroup(expCondition, "COALESCE(g.name, 'UNKNOWN')", 'genre');

  const groupRows = await query(`
    SELECT
      ${GROUP_CASE_SQL} AS user_group,
      COUNT(DISTINCT u.id) AS users,
      COUNT(lh.id) AS listens,
      COUNT(DISTINCT lh.song_id) AS unique_songs,
      AVG(lh.completion_rate) AS avg_completion_rate,
      AVG(CASE WHEN ${skippedExpr} = 1 THEN 1 ELSE 0 END) AS skip_rate,
      COUNT(DISTINCT sl.song_id) / NULLIF(COUNT(DISTINCT lh.song_id), 0) AS like_rate
    FROM users u
    LEFT JOIN listening_history lh ON lh.user_id = u.id AND lh.source = ?
    LEFT JOIN songs s ON s.id = lh.song_id
    LEFT JOIN song_likes sl ON sl.user_id = u.id AND sl.song_id = lh.song_id
    WHERE ${expCondition}
    GROUP BY user_group
    ORDER BY user_group
  `, [SOURCE]);

  const groupDistribution = groupRows.map((row) => ({
    user_group: row.user_group,
    users: Number(row.users || 0),
    listens: Number(row.listens || 0),
    unique_songs: Number(row.unique_songs || 0),
    avg_listens_per_user: row.users ? round(Number(row.listens || 0) / Number(row.users), 4) : 0,
    top_market: topMarketByGroup[row.user_group] || null,
    top_genre: topGenreByGroup[row.user_group] || null,
    top_artists: topArtistsByGroup[row.user_group] || [],
    avg_completion_rate: round(row.avg_completion_rate, 4),
    skip_rate: round(row.skip_rate, 4),
    like_rate: round(row.like_rate, 4),
  }));

  const marketRows = await query(`
    SELECT COALESCE(s.market, 'OTHER') AS market, COUNT(*) AS total
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    JOIN songs s ON s.id = lh.song_id
    WHERE lh.source = ? AND ${expCondition}
    GROUP BY COALESCE(s.market, 'OTHER')
    ORDER BY market
  `, [SOURCE]);

  const groupMarketRows = await query(`
    SELECT ${GROUP_CASE_SQL} AS user_group, COALESCE(s.market, 'OTHER') AS market, COUNT(*) AS total
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    JOIN songs s ON s.id = lh.song_id
    WHERE lh.source = ? AND ${expCondition}
    GROUP BY user_group, COALESCE(s.market, 'OTHER')
    ORDER BY user_group, market
  `, [SOURCE]);

  const marketDistribution = {
    overall: normalizeMarketRows(marketRows).ALL || { VPOP: 0, KPOP: 0, USUK: 0, OTHER: 0, total: 0 },
    by_group: normalizeMarketRows(groupMarketRows),
  };
  marketDistribution.quality_checks = evaluateMarketQuality(marketDistribution.by_group);

  const completionBuckets = await query(`
    SELECT bucket, COUNT(*) AS total
    FROM (
      SELECT
        CASE
          WHEN completion_rate < 0.25 THEN '0-0.25'
          WHEN completion_rate < 0.50 THEN '0.25-0.5'
          WHEN completion_rate < 0.75 THEN '0.5-0.75'
          ELSE '0.75-1.0'
        END AS bucket
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
    ) b
    GROUP BY bucket
    ORDER BY FIELD(bucket, '0-0.25', '0.25-0.5', '0.5-0.75', '0.75-1.0')
  `, [SOURCE]);

  const [likedQuality] = await query(`
    SELECT
      COUNT(*) AS liked_pairs,
      AVG(CASE WHEN max_completion_rate >= 0.75 THEN 1 ELSE 0 END) AS liked_with_high_completion_rate,
      AVG(CASE WHEN skipped_count > 0 THEN 1 ELSE 0 END) AS skipped_liked_pair_rate
    FROM (
      SELECT
        sl.user_id,
        sl.song_id,
        MAX(lh.completion_rate) AS max_completion_rate,
        SUM(CASE WHEN ${skippedExpr} = 1 THEN 1 ELSE 0 END) AS skipped_count
      FROM song_likes sl
      JOIN users u ON u.id = sl.user_id
      LEFT JOIN listening_history lh ON lh.user_id = sl.user_id AND lh.song_id = sl.song_id AND lh.source = ?
      WHERE ${expCondition}
      GROUP BY sl.user_id, sl.song_id
    ) liked_pairs
  `, [SOURCE]);

  const behaviorRealism = {
    avg_completion_rate: overview.avg_completion_rate,
    skip_rate: overview.skip_rate,
    completion_buckets: completionBuckets.map((row) => ({
      bucket: row.bucket,
      total: Number(row.total || 0),
      rate: overview.experiment_listening_history ? round(Number(row.total || 0) / overview.experiment_listening_history, 4) : 0,
    })),
    liked_pairs: Number(likedQuality.liked_pairs || 0),
    liked_with_high_completion_rate: round(likedQuality.liked_with_high_completion_rate, 4),
    skipped_liked_pair_rate: round(likedQuality.skipped_liked_pair_rate, 4),
  };

  const [cfRow] = await query(`
    SELECT
      COUNT(DISTINCT lh.user_id) AS users,
      COUNT(DISTINCT lh.song_id) AS unique_songs,
      COUNT(*) AS interactions,
      COUNT(DISTINCT CONCAT(lh.user_id, ':', lh.song_id)) AS user_song_pairs
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCondition}
  `, [SOURCE]);

  const [songsWithTwoUsers] = await query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT lh.song_id, COUNT(DISTINCT lh.user_id) AS users
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY lh.song_id
      HAVING users >= 2
    ) x
  `, [SOURCE]);

  const [songUserThresholds] = await query(`
    SELECT
      SUM(CASE WHEN users >= 2 THEN 1 ELSE 0 END) AS at_least_2,
      SUM(CASE WHEN users >= 5 THEN 1 ELSE 0 END) AS at_least_5,
      SUM(CASE WHEN users >= 10 THEN 1 ELSE 0 END) AS at_least_10
    FROM (
      SELECT lh.song_id, COUNT(DISTINCT lh.user_id) AS users
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY lh.song_id
    ) x
  `, [SOURCE]);

  const [usersWith50] = await query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT lh.user_id, COUNT(*) AS interactions
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY lh.user_id
      HAVING interactions >= 50
    ) x
  `, [SOURCE]);

  const [avgUsersPerSong] = await query(`
    SELECT AVG(users_per_song) AS avg_users_per_song
    FROM (
      SELECT song_id, COUNT(DISTINCT user_id) AS users_per_song
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY song_id
    ) x
  `, [SOURCE]);

  const groupSongRows = await query(`
    SELECT DISTINCT ${GROUP_CASE_SQL} AS user_group, lh.song_id
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCondition}
  `, [SOURCE]);

  const users = Number(cfRow.users || 0);
  const songs = Number(cfRow.unique_songs || 0);
  const interactions = Number(cfRow.interactions || 0);
  const collaborativeReadiness = {
    users,
    unique_songs: songs,
    interactions,
    user_song_pairs: Number(cfRow.user_song_pairs || 0),
    repeated_listens: Math.max(0, interactions - Number(cfRow.user_song_pairs || 0)),
    repeated_listen_ratio: interactions ? round((interactions - Number(cfRow.user_song_pairs || 0)) / interactions, 4) : 0,
    matrix_density: users && songs ? round(Number(cfRow.user_song_pairs || 0) / (users * songs), 6) : 0,
    avg_users_per_song: round(avgUsersPerSong.avg_users_per_song, 4),
    avg_songs_per_user: users ? round(Number(cfRow.user_song_pairs || 0) / users, 4) : 0,
    avg_unique_songs_per_user: users ? round(Number(cfRow.user_song_pairs || 0) / users, 4) : 0,
    avg_interactions_per_user: users ? round(interactions / users, 4) : 0,
    songs_with_at_least_2_users: Number(songUserThresholds.at_least_2 || songsWithTwoUsers.total || 0),
    songs_with_at_least_5_users: Number(songUserThresholds.at_least_5 || 0),
    songs_with_at_least_10_users: Number(songUserThresholds.at_least_10 || 0),
    users_with_at_least_50_interactions: Number(usersWith50.total || 0),
    overlap_score: computeOverlap(groupSongRows),
  };

  const [duplicateUsers] = await query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT email, COUNT(*) AS c
      FROM users u
      WHERE ${expCondition}
      GROUP BY email
      HAVING c > 1
    ) d
  `);

  const [duplicateLikes] = await query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT sl.user_id, sl.song_id, COUNT(*) AS c
      FROM song_likes sl
      JOIN users u ON u.id = sl.user_id
      WHERE ${expCondition}
      GROUP BY sl.user_id, sl.song_id
      HAVING c > 1
    ) d
  `);

  const [duplicateFollows] = followsTable
    ? await query(`
        SELECT COUNT(*) AS total
        FROM (
          SELECT af.user_id, af.artist_id, COUNT(*) AS c
          FROM artist_follows af
          JOIN users u ON u.id = af.user_id
          WHERE ${expCondition}
          GROUP BY af.user_id, af.artist_id
          HAVING c > 1
        ) d
      `)
    : [{ total: 0 }];

  const [duplicateListening] = await query(`
    SELECT COUNT(*) AS duplicate_groups, COALESCE(SUM(c - 1), 0) AS extra_rows
    FROM (
      SELECT lh.user_id, lh.song_id, ${listenedAtExpr} AS played_at, lh.completion_rate, COUNT(*) AS c
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY lh.user_id, lh.song_id, played_at, lh.completion_rate
      HAVING c > 1
    ) d
  `, [SOURCE]);

  const [highRepeatRows] = await query(`
    SELECT COUNT(*) AS user_song_pairs_over_5
    FROM (
      SELECT lh.user_id, lh.song_id, COUNT(*) AS c
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.source = ? AND ${expCondition}
      GROUP BY lh.user_id, lh.song_id
      HAVING c > 5
    ) d
  `, [SOURCE]);

  const [realUserExperimentHistory] = await query(`
    SELECT COUNT(DISTINCT lh.user_id) AS users, COUNT(*) AS histories
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ?
      AND NOT ${expCondition}
  `, [SOURCE]);

  const duplicates = {
    duplicate_user_emails: Number(duplicateUsers.total || 0),
    duplicate_likes: Number(duplicateLikes.total || 0),
    duplicate_artist_follows: Number(duplicateFollows.total || 0),
    duplicate_listening_exact_groups: Number(duplicateListening.duplicate_groups || 0),
    duplicate_listening_extra_rows: Number(duplicateListening.extra_rows || 0),
    user_song_pairs_over_5_listens: Number(highRepeatRows.user_song_pairs_over_5 || 0),
    real_users_with_experiment_seed_history: Number(realUserExperimentHistory.users || 0),
    real_user_experiment_seed_histories: Number(realUserExperimentHistory.histories || 0),
  };

  const datasetReadiness = decideReadiness({
    overview,
    marketChecks: marketDistribution.quality_checks,
    behavior: behaviorRealism,
    cf: collaborativeReadiness,
    duplicates,
  });

  return {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    overview,
    group_distribution: groupDistribution,
    market_distribution: marketDistribution,
    behavior_realism: behaviorRealism,
    collaborative_filtering_readiness: collaborativeReadiness,
    duplicate_and_idempotency: duplicates,
    dataset_readiness: datasetReadiness,
    notes: [
      'This audit reads experimental/simulated behavior data only; it does not train BPR-MF or compute recommendation evaluation metrics.',
      `Positive interaction duration expression used: ${listenDurationExpr}.`,
    ],
  };
}

async function main() {
  const audit = await buildAudit();
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(audit, null, 2), 'utf8');
  writeCsv(buildCsvRows(audit), OUTPUT_CSV);

  console.log('Experimental recommendation dataset audit');
  console.log(`Users: ${audit.overview.experimental_users}`);
  console.log(`Interactions: ${audit.overview.experiment_listening_history}`);
  console.log(`Unique songs: ${audit.overview.unique_songs_heard}`);
  console.log(`Unique user-song pairs: ${audit.collaborative_filtering_readiness.user_song_pairs}`);
  console.log(`Avg unique songs/user: ${audit.collaborative_filtering_readiness.avg_unique_songs_per_user}`);
  console.log(`Repeated listen ratio: ${audit.collaborative_filtering_readiness.repeated_listen_ratio}`);
  console.log(`Avg completion: ${audit.overview.avg_completion_rate}`);
  console.log(`Skip rate: ${audit.overview.skip_rate}`);
  console.log(`Matrix density: ${audit.collaborative_filtering_readiness.matrix_density}`);
  console.log(`Songs >= 2/5/10 users: ${audit.collaborative_filtering_readiness.songs_with_at_least_2_users}/${audit.collaborative_filtering_readiness.songs_with_at_least_5_users}/${audit.collaborative_filtering_readiness.songs_with_at_least_10_users}`);
  console.log(`Avg group overlap Jaccard: ${audit.collaborative_filtering_readiness.overlap_score.average_jaccard}`);
  console.log('\nDataset readiness:', audit.dataset_readiness.status);
  for (const reason of audit.dataset_readiness.reasons) {
    console.log(`- ${reason}`);
  }
  console.log(`\nJSON: ${OUTPUT_JSON}`);
  console.log(`CSV: ${OUTPUT_CSV}`);
}

main()
  .catch((error) => {
    console.error('Audit experimental recommendation data failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
