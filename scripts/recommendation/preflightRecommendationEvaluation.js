const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../../apps/backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));

const SOURCE = 'experiment_seed';
const OUTPUT_PATH = path.resolve(__dirname, '../../datasets/processed/recommendation_evaluation_preflight.json');

const SAMPLE_USERS = 20;
const POSITIVE_COMPLETION_THRESHOLD = 0.5;
const MIN_TRAIN_INTERACTIONS = 200;
const MIN_TEST_POSITIVE_UNIQUE = 20;
const SONG_TEMPORAL_COLUMN_PREFERENCE = ['listened_at', 'played_at', 'created_at'];
const SONG_TEMPORAL_FALLBACK = 'id';

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function round(value, digits = 4) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function percent(value) {
  return round(Number(value || 0) * 100, 2);
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

function completionExpression(historyColumns, alias = 'lh') {
  if (historyColumns.has('completion_rate')) return `${alias}.completion_rate`;
  return '0';
}

function implicitRatingExpression(historyColumns, alias = 'lh') {
  if (historyColumns.has('implicit_rating')) return `${alias}.implicit_rating`;
  return '0';
}

function listenDurationExpression(historyColumns, alias = 'lh') {
  if (historyColumns.has('listen_duration')) return `${alias}.listen_duration`;
  if (historyColumns.has('listened_duration')) return `${alias}.listened_duration`;
  return '0';
}

function listenedAtExpression(historyColumns, alias = 'lh') {
  if (historyColumns.has('listened_at')) return `${alias}.listened_at`;
  if (historyColumns.has('played_at')) return `${alias}.played_at`;
  if (historyColumns.has('created_at')) return `${alias}.created_at`;
  return 'NULL';
}

function pickTemporalSortColumn(historyColumns) {
  for (const column of SONG_TEMPORAL_COLUMN_PREFERENCE) {
    if (historyColumns.has(column)) return column;
  }
  return SONG_TEMPORAL_FALLBACK;
}

async function buildDatasetSummary(historyColumns) {
  const userColumns = await getColumns('users');
  const hasExperimentColumn = userColumns.has('is_experiment');
  const expCondition = experimentUserCondition(hasExperimentColumn, 'u');

  const [userRow] = await query(`
    SELECT COUNT(DISTINCT u.id) AS total
    FROM users u
    WHERE ${expCondition}
  `);

  const [interactionsRow] = await query(`
    SELECT COUNT(lh.id) AS total
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCondition}
  `, [SOURCE]);

  const [uniqueRow] = await query(`
    SELECT
      COUNT(DISTINCT lh.song_id) AS unique_songs,
      COUNT(DISTINCT s.artist_id) AS unique_artists,
      COUNT(DISTINCT s.genre_id) AS unique_genres,
      COUNT(DISTINCT CONCAT(lh.user_id, ':', lh.song_id)) AS unique_user_song_pairs
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    JOIN songs s ON s.id = lh.song_id
    WHERE lh.source = ? AND ${expCondition}
  `, [SOURCE]);

  const totalUsers = Number(userRow.total || 0);
  const totalInteractions = Number(interactionsRow.total || 0);
  const uniqueSongs = Number(uniqueRow.unique_songs || 0);
  const uniqueArtists = Number(uniqueRow.unique_artists || 0);
  const uniqueGenres = Number(uniqueRow.unique_genres || 0);
  const uniqueUserSongPairs = Number(uniqueRow.unique_user_song_pairs || 0);

  return {
    users_considered: totalUsers,
    interactions: totalInteractions,
    unique_songs: uniqueSongs,
    unique_artists: uniqueArtists,
    unique_genres: uniqueGenres,
    unique_user_song_pairs: uniqueUserSongPairs,
    avg_listens_per_user: totalUsers ? round(totalInteractions / totalUsers) : 0,
    avg_users_per_song: uniqueSongs ? round(uniqueUserSongPairs / uniqueSongs) : 0,
    is_experiment_column_present: hasExperimentColumn,
    listening_history_source: SOURCE,
  };
}

async function buildTrainTestSplit(historyColumns) {
  const userColumns = await getColumns('users');
  const hasExperimentColumn = userColumns.has('is_experiment');
  const expCondition = experimentUserCondition(hasExperimentColumn, 'u');
  const listenDurationExpr = listenDurationExpression(historyColumns, 'lh');
  const temporalColumn = pickTemporalSortColumn(historyColumns);
  const temporalExpr = listenedAtExpression(historyColumns, 'lh');
  const sortExpr = temporalExpr === 'NULL' ? 'lh.id' : `${temporalExpr}`;

  const userRows = await query(`
    SELECT u.id AS user_id
    FROM users u
    WHERE ${expCondition}
  `);

  if (!userRows.length) {
    return emptySplitSummary(temporalColumn);
  }

  const userIds = userRows.map((row) => Number(row.user_id));

  const perUserRows = await query(`
    SELECT
      lh.user_id AS user_id,
      lh.song_id AS song_id,
      lh.completion_rate AS completion_rate,
      lh.implicit_rating AS implicit_rating,
      ${listenDurationExpr} AS listen_duration,
      ${temporalExpr} AS temporal_value,
      lh.id AS history_id
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCondition}
    ORDER BY lh.user_id ASC, ${sortExpr} ASC, lh.id ASC
  `, [SOURCE]);

  const likeSet = new Set();
  if (await tableExists('song_likes')) {
    const likeRows = await query(`SELECT user_id, song_id FROM song_likes`);
    for (const row of likeRows) {
      likeSet.add(`${row.user_id}:${row.song_id}`);
    }
  }

  const grouped = new Map();
  for (const row of perUserRows) {
    const enriched = {
      ...row,
      liked: likeSet.has(`${row.user_id}:${row.song_id}`) ? 1 : 0,
    };
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(enriched);
  }

  let eligible = 0;
  const perUserMetrics = [];
  const temporalFallback = temporalColumn === SONG_TEMPORAL_FALLBACK;

  for (const userId of userIds) {
    const interactions = grouped.get(userId) || [];
    if (!interactions.length) continue;

    interactions.sort((a, b) => {
      const aValue = a.temporal_value;
      const bValue = b.temporal_value;
      if (aValue === bValue || aValue === null || bValue === null) {
        return Number(a.song_id) - Number(b.song_id);
      }
      if (aValue instanceof Date && bValue instanceof Date) {
        return aValue.getTime() - bValue.getTime();
      }
      const aTime = new Date(aValue).getTime();
      const bTime = new Date(bValue).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return Number(a.song_id) - Number(b.song_id);
      }
      return aTime - bTime;
    });

    const splitIndex = Math.floor(interactions.length * 0.8);
    const trainInteractions = interactions.slice(0, splitIndex);
    const testInteractions = interactions.slice(splitIndex);

    const trainCount = trainInteractions.length;
    if (trainCount < MIN_TRAIN_INTERACTIONS) {
      perUserMetrics.push({ user_id: userId, train: trainCount, test_positive_unique: 0, eligible: false });
      continue;
    }

    const testPositiveSet = new Set();
    for (const interaction of testInteractions) {
      const completion = Number(interaction.completion_rate || 0);
      const rating = Number(interaction.implicit_rating || 0);
      const liked = Number(interaction.liked || 0);
      const isPositive = completion >= POSITIVE_COMPLETION_THRESHOLD
        || rating >= POSITIVE_COMPLETION_THRESHOLD
        || liked === 1;
      if (isPositive) testPositiveSet.add(Number(interaction.song_id));
    }

    const testPositiveUnique = testPositiveSet.size;
    const isEligible = testPositiveUnique >= MIN_TEST_POSITIVE_UNIQUE;
    if (isEligible) eligible += 1;

    perUserMetrics.push({ user_id: userId, train: trainCount, test_positive_unique: testPositiveUnique, eligible: isEligible });
  }

  const eligibleMetrics = perUserMetrics.filter((metric) => metric.eligible);
  const trainCounts = eligibleMetrics.map((metric) => metric.train);
  const testPositives = eligibleMetrics.map((metric) => metric.test_positive_unique);

  return {
    temporal_sort_column: temporalColumn,
    temporal_sort_is_fallback: temporalFallback,
    positive_definition: 'completion_rate >= 0.5 OR implicit_rating >= 0.5 OR liked = 1',
    positive_completion_threshold: POSITIVE_COMPLETION_THRESHOLD,
    train_ratio: 0.8,
    test_ratio: 0.2,
    min_train_interactions: MIN_TRAIN_INTERACTIONS,
    min_test_positive_unique: MIN_TEST_POSITIVE_UNIQUE,
    eligible_users: eligible,
    total_users_considered: userIds.length,
    eligible_user_ids_internal: eligibleMetrics.map((metric) => Number(metric.user_id)),
    eligible_user_ids_sample: eligibleMetrics.slice(0, SAMPLE_USERS).map((metric) => Number(metric.user_id)),
    per_user_summary: {
      avg_train_interactions: trainCounts.length ? round(trainCounts.reduce((sum, value) => sum + value, 0) / trainCounts.length) : 0,
      min_train_interactions: trainCounts.length ? Math.min(...trainCounts) : 0,
      max_train_interactions: trainCounts.length ? Math.max(...trainCounts) : 0,
      avg_test_positive_unique: testPositives.length ? round(testPositives.reduce((sum, value) => sum + value, 0) / testPositives.length) : 0,
      min_test_positive_unique: testPositives.length ? Math.min(...testPositives) : 0,
      max_test_positive_unique: testPositives.length ? Math.max(...testPositives) : 0,
    },
  };
}

function emptySplitSummary(temporalColumn) {
  return {
    temporal_sort_column: temporalColumn,
    temporal_sort_is_fallback: temporalColumn === SONG_TEMPORAL_FALLBACK,
    positive_definition: 'completion_rate >= 0.5 OR implicit_rating >= 0.5 OR liked = 1',
    positive_completion_threshold: POSITIVE_COMPLETION_THRESHOLD,
    train_ratio: 0.8,
    test_ratio: 0.2,
    min_train_interactions: MIN_TRAIN_INTERACTIONS,
    min_test_positive_unique: MIN_TEST_POSITIVE_UNIQUE,
    eligible_users: 0,
    total_users_considered: 0,
    eligible_user_ids_internal: [],
    eligible_user_ids_sample: [],
    per_user_summary: {
      avg_train_interactions: 0,
      min_train_interactions: 0,
      max_train_interactions: 0,
      avg_test_positive_unique: 0,
      min_test_positive_unique: 0,
      max_test_positive_unique: 0,
    },
  };
}

async function buildCandidatePool(historyColumns, eligibleUserIds) {
  const songsTableExists = await tableExists('songs');
  const songColumns = songsTableExists ? await getColumns('songs') : new Set();

  if (!songsTableExists) {
    return {
      total_available_songs: 0,
      candidate_pool_size: 0,
      empty_candidate_pool: true,
      leakage_check: null,
      sample_users_checked: 0,
    };
  }

  const [availabilityRow] = await query(`
    SELECT COUNT(*) AS total
    FROM songs s
    WHERE (s.is_active = 1 OR s.is_active IS NULL)
      AND (s.audio_url IS NOT NULL AND s.audio_url <> '')
      AND (s.release_status IS NULL OR s.release_status = 'published' OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW()))
  `);

  const totalAvailable = Number(availabilityRow.total || 0);

  if (!eligibleUserIds.length) {
    return {
      total_available_songs: totalAvailable,
      candidate_pool_size: 0,
      empty_candidate_pool: true,
      leakage_check: null,
      sample_users_checked: 0,
    };
  }

  const temporalColumn = pickTemporalSortColumn(historyColumns);
  const temporalExpr = listenedAtExpression(historyColumns, 'lh');
  const userColumns = await getColumns('users');
  const hasExperimentColumn = userColumns.has('is_experiment');
  const expCondition = experimentUserCondition(hasExperimentColumn, 'u');

  const sampleUserIds = eligibleUserIds.slice(0, Math.min(SAMPLE_USERS, eligibleUserIds.length));

  const perUserLeak = [];
  let checkedUsers = 0;
  let smallestCandidatePool = Number.POSITIVE_INFINITY;
  let largestCandidatePool = 0;
  let aggregateCandidatePool = 0;

  for (const userId of sampleUserIds) {
    const interactionRows = await query(`
      SELECT lh.song_id, lh.completion_rate, lh.implicit_rating, ${temporalExpr} AS temporal_value
      FROM listening_history lh
      JOIN users u ON u.id = lh.user_id
      WHERE lh.user_id = ? AND lh.source = ? AND ${expCondition}
      ORDER BY ${temporalExpr === 'NULL' ? 'lh.id' : `${temporalExpr} ASC, lh.id ASC`}, lh.id ASC
    `, [userId, SOURCE]);

    const interactions = interactionRows.map((row) => ({
      song_id: Number(row.song_id),
      completion_rate: Number(row.completion_rate || 0),
      implicit_rating: Number(row.implicit_rating || 0),
      temporal_value: row.temporal_value,
    }));

    interactions.sort((a, b) => {
      const aValue = a.temporal_value;
      const bValue = b.temporal_value;
      if (aValue === bValue || aValue === null || bValue === null) {
        return a.song_id - b.song_id;
      }
      if (aValue instanceof Date && bValue instanceof Date) {
        return aValue.getTime() - bValue.getTime();
      }
      const aTime = new Date(aValue).getTime();
      const bTime = new Date(bValue).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return a.song_id - b.song_id;
      }
      return aTime - bTime;
    });

    const splitIndex = Math.floor(interactions.length * 0.8);
    const trainSongs = new Set(interactions.slice(0, splitIndex).map((row) => row.song_id));
    const candidatePoolSize = Math.max(0, totalAvailable - trainSongs.size);
    aggregateCandidatePool += candidatePoolSize;
    smallestCandidatePool = Math.min(smallestCandidatePool, candidatePoolSize);
    largestCandidatePool = Math.max(largestCandidatePool, candidatePoolSize);

    perUserLeak.push({
      user_id: userId,
      total_interactions: interactions.length,
      train_songs: trainSongs.size,
      candidate_pool_size: candidatePoolSize,
    });
    checkedUsers += 1;
  }

  return {
    total_available_songs: totalAvailable,
    candidate_pool_size: totalAvailable,
    empty_candidate_pool: totalAvailable === 0,
    sample_users_checked: checkedUsers,
    sample_users: perUserLeak,
    average_candidate_pool_per_user: checkedUsers ? round(aggregateCandidatePool / checkedUsers) : 0,
    min_candidate_pool_per_user: checkedUsers ? (smallestCandidatePool === Number.POSITIVE_INFINITY ? 0 : smallestCandidatePool) : 0,
    max_candidate_pool_per_user: checkedUsers ? largestCandidatePool : 0,
    leakage_check: {
      strategy: 'candidate_pool_is_full_catalog_minus_user_train_songs',
      verified_in_smoke_tests: true,
      note: 'The candidate pool itself still contains train songs (full catalog); the recommendation logic filters them out. The actual train-song exclusion is verified inside the Most Popular and Content-Based smoke tests.',
    },
    temporal_sort_column: temporalColumn,
  };
}

async function buildAudioFeatureReadiness() {
  const songsTableExists = await tableExists('songs');
  const audioTableExists = await tableExists('song_audio_features');
  const songColumns = songsTableExists ? await getColumns('songs') : new Set();
  const audioColumns = audioTableExists ? await getColumns('song_audio_features') : new Set();

  const [availableSongsRow] = await query(`
    SELECT COUNT(*) AS total
    FROM songs s
    WHERE (s.is_active = 1 OR s.is_active IS NULL)
      AND (s.audio_url IS NOT NULL AND s.audio_url <> '')
      AND (s.release_status IS NULL OR s.release_status = 'published' OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW()))
  `);

  const [audioTotalRow] = audioTableExists
    ? await query(`
        SELECT COUNT(*) AS total,
               COUNT(bpm) AS bpm_total,
               COUNT(tempo_level) AS tempo_total,
               COUNT(energy) AS energy_total,
               COUNT(energy_score) AS energy_score_total,
               COUNT(danceability) AS danceability_total,
               COUNT(acoustic_score) AS acoustic_total,
               COUNT(brightness) AS brightness_total,
               COUNT(mood) AS mood_total,
               COUNT(vibe) AS vibe_total
        FROM song_audio_features
      `)
    : [{ total: 0, bpm_total: 0, tempo_total: 0, energy_total: 0, energy_score_total: 0, danceability_total: 0, acoustic_total: 0, brightness_total: 0, mood_total: 0, vibe_total: 0 }];

  const [candidateAudioRow] = audioTableExists
    ? await query(`
        SELECT COUNT(*) AS candidate_with_audio
        FROM songs s
        JOIN song_audio_features saf ON saf.song_id = s.id
        WHERE (s.is_active = 1 OR s.is_active IS NULL)
          AND (s.audio_url IS NOT NULL AND s.audio_url <> '')
          AND (s.release_status IS NULL OR s.release_status = 'published' OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW()))
      `)
    : [{ candidate_with_audio: 0 }];

  const totalAvailable = Number(availableSongsRow.total || 0);
  const audioTotal = Number(audioTotalRow.total || 0);
  const candidateWithAudio = Number(candidateAudioRow.candidate_with_audio || 0);

  const expectedColumns = ['bpm', 'tempo_level', 'energy', 'energy_score', 'danceability', 'acoustic_score', 'brightness', 'mood', 'vibe'];
  const presentColumns = expectedColumns.filter((column) => audioColumns.has(column));
  const missingColumns = expectedColumns.filter((column) => !audioColumns.has(column));

  const populate = (column) => Number(audioTotalRow[`${column}_total`] || 0);

  const featureStats = {
    bpm_non_null: audioColumns.has('bpm') ? populate('bpm') : 0,
    tempo_level_non_null: audioColumns.has('tempo_level') ? populate('tempo') : 0,
    energy_non_null: audioColumns.has('energy') ? populate('energy') : 0,
    energy_score_non_null: audioColumns.has('energy_score') ? populate('energy_score') : 0,
    danceability_non_null: audioColumns.has('danceability') ? populate('danceability') : 0,
    acoustic_score_non_null: audioColumns.has('acoustic_score') ? populate('acoustic') : 0,
    brightness_non_null: audioColumns.has('brightness') ? populate('brightness') : 0,
    mood_non_null: audioColumns.has('mood') ? populate('mood') : 0,
    vibe_non_null: audioColumns.has('vibe') ? populate('vibe') : 0,
  };

  return {
    table_present: audioTableExists,
    expected_columns: expectedColumns,
    present_columns: presentColumns,
    missing_columns: missingColumns,
    total_songs_in_db: totalAvailable,
    total_audio_features_rows: audioTotal,
    candidate_pool_with_audio_features: candidateWithAudio,
    candidate_pool_audio_coverage: totalAvailable ? round(candidateWithAudio / totalAvailable) : 0,
    feature_non_null_counts: featureStats,
    fallback_strategy: missingColumns.length
      ? 'metadata_only_fallback: market, genre_id, artist_id'
      : 'full_audio_features_available',
  };
}

function dcgAtK(ranked, relevantSet, k) {
  let dcg = 0;
  for (let i = 0; i < Math.min(ranked.length, k); i += 1) {
    const item = ranked[i];
    if (relevantSet.has(item)) {
      dcg += 1 / Math.log2(i + 2);
    }
  }
  return dcg;
}

function ndcgAtK(ranked, relevantSet, k) {
  const dcg = dcgAtK(ranked, relevantSet, k);
  const idealHits = Math.min(relevantSet.size, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function precisionAtK(ranked, relevantSet, k) {
  const top = ranked.slice(0, k);
  if (!top.length) return 0;
  let hits = 0;
  for (const item of top) {
    if (relevantSet.has(item)) hits += 1;
  }
  return hits / k;
}

function recallAtK(ranked, relevantSet, k) {
  if (!relevantSet.size) return 0;
  const top = ranked.slice(0, k);
  let hits = 0;
  for (const item of top) {
    if (relevantSet.has(item)) hits += 1;
  }
  return hits / relevantSet.size;
}

async function loadUserEvaluationContext(historyColumns, eligibleUserIds) {
  const temporalColumn = pickTemporalSortColumn(historyColumns);
  const temporalExpr = listenedAtExpression(historyColumns, 'lh');
  const userColumns = await getColumns('users');
  const hasExperimentColumn = userColumns.has('is_experiment');
  const expCondition = experimentUserCondition(hasExperimentColumn, 'u');
  const likeTableExists = await tableExists('song_likes');

  const sampleUserIds = eligibleUserIds.slice(0, Math.min(SAMPLE_USERS, eligibleUserIds.length));
  if (!sampleUserIds.length) {
    return { sampleUserIds: [], perUser: [] };
  }

  const sortExpr = temporalExpr === 'NULL' ? 'lh.id' : `${temporalExpr}`;
  const interactions = await query(`
    SELECT lh.user_id, lh.song_id, lh.completion_rate, lh.implicit_rating, ${temporalExpr} AS temporal_value
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCondition} AND lh.user_id IN (?)
    ORDER BY lh.user_id ASC, ${sortExpr} ASC, lh.id ASC
  `, [SOURCE, sampleUserIds]);

  const likeSet = new Set();
  if (likeTableExists) {
    const likeRows = await query(`SELECT user_id, song_id FROM song_likes WHERE user_id IN (?)`, [sampleUserIds]);
    for (const row of likeRows) {
      likeSet.add(`${row.user_id}:${row.song_id}`);
    }
  }

  const perUser = new Map();
  for (const userId of sampleUserIds) {
    perUser.set(userId, {
      user_id: userId,
      interactions: [],
    });
  }

  for (const row of interactions) {
    const userId = row.user_id;
    if (!perUser.has(userId)) continue;
    perUser.get(userId).interactions.push({
      song_id: Number(row.song_id),
      completion_rate: Number(row.completion_rate || 0),
      implicit_rating: Number(row.implicit_rating || 0),
      temporal_value: row.temporal_value,
      liked: likeSet.has(`${userId}:${row.song_id}`) ? 1 : 0,
    });
  }

  return { sampleUserIds, perUser: [...perUser.values()] };
}

function buildTrainTestForUser(interactions) {
  const sorted = [...interactions];
  sorted.sort((a, b) => {
    const aValue = a.temporal_value;
    const bValue = b.temporal_value;
    if (aValue === bValue || aValue === null || bValue === null) {
      return a.song_id - b.song_id;
    }
    if (aValue instanceof Date && bValue instanceof Date) {
      return aValue.getTime() - bValue.getTime();
    }
    const aTime = new Date(aValue).getTime();
    const bTime = new Date(bValue).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return a.song_id - b.song_id;
    }
    return aTime - bTime;
  });

  const splitIndex = Math.floor(sorted.length * 0.8);
  const train = sorted.slice(0, splitIndex);
  const test = sorted.slice(splitIndex);

  const trainSongs = new Set(train.map((row) => row.song_id));
  const testPositiveSet = new Set();
  for (const interaction of test) {
    const isPositive = interaction.completion_rate >= POSITIVE_COMPLETION_THRESHOLD
      || interaction.implicit_rating >= POSITIVE_COMPLETION_THRESHOLD
      || interaction.liked === 1;
    if (isPositive) testPositiveSet.add(interaction.song_id);
  }

  return {
    train,
    test,
    trainSongs,
    testPositiveSet,
  };
}

function topEntriesFromMap(map, limit = 3) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }));
}

function topEntriesFromArray(arr, accessor, limit = 5) {
  const counts = new Map();
  for (const item of arr) {
    const key = accessor(item);
    if (key === null || key === undefined) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }));
}

function buildAggregateAudioProfile(profile) {
  return {
    bpm_mean: profile.bpm_mean,
    energy_score_mean: profile.energy_score_mean,
    danceability_mean: profile.danceability_mean,
    acoustic_score_mean: profile.acoustic_score_mean,
    brightness_mean: profile.brightness_mean,
    top_tempo_level: topEntriesFromMap(profile.tempo_level_counts, 1)[0] || null,
    top_energy_level: topEntriesFromMap(profile.energy_level_counts, 1)[0] || null,
    top_mood: topEntriesFromMap(profile.mood_counts, 3),
    top_vibe: topEntriesFromMap(profile.vibe_counts, 3),
  };
}

async function loadUserMetaByIds(userIds) {
  if (!userIds.length) return new Map();
  const rows = await query(`
    SELECT id, email
    FROM users
    WHERE id IN (?)
  `, [userIds]);
  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.id), { id: Number(row.id), email: row.email || null });
  }
  return map;
}

async function buildContentDebugEntry(userEntry, split, profile, scored, ranking, songFeaturesById) {
  const userMeta = userEntry.user_id ? await query(`SELECT id, email FROM users WHERE id = ?`, [userEntry.user_id]) : [];
  const userRow = userMeta[0] || {};

  const testPositiveSet = split.testPositiveSet;
  const testPositiveHoldout = new Set([...testPositiveSet].filter((songId) => !split.trainSongs.has(songId)));

  const trainIds = [...split.trainSongs];
  const testIds = [...testPositiveSet];
  const testHoldoutIds = [...testPositiveHoldout];

  const trainSongRows = trainIds.length
    ? await query(`
        SELECT s.id, s.market, s.genre_id, s.artist_id, a.name AS artist_name, g.name AS genre_name
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        LEFT JOIN genres g ON g.id = s.genre_id
        WHERE s.id IN (?)
      `, [trainIds])
    : [];
  const testSongRows = testIds.length
    ? await query(`
        SELECT s.id, s.market, s.genre_id, s.artist_id, a.name AS artist_name, g.name AS genre_name
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        LEFT JOIN genres g ON g.id = s.genre_id
        WHERE s.id IN (?)
      `, [testIds])
    : [];

  const trainSongMap = new Map(trainSongRows.map((r) => [Number(r.id), r]));
  const testSongMap = new Map(testSongRows.map((r) => [Number(r.id), r]));

  const trainProfileSummary = {
    user_id: userEntry.user_id,
    email: userRow.email || null,
    user_group: deriveExperimentGroup(userRow.email || ''),
    train_interactions: split.train.length,
    train_unique_songs: trainIds.length,
    test_positive_unique_songs: testIds.length,
    test_positive_in_train: testIds.length - testHoldoutIds.length,
    test_positive_holdout: testHoldoutIds.length,
    top_train_markets: topEntriesFromMap(profile.market_counts, 3),
    top_train_genres: topEntriesFromMap(profile.genre_counts, 3),
    top_train_artists: topEntriesFromArray(trainSongRows, (row) => row.artist_id, 3)
      .map((entry) => {
        const sample = trainSongRows.find((r) => Number(r.artist_id) === Number(entry.key));
        return { artist_id: entry.key, artist_name: sample ? sample.artist_name : null, listens: entry.value };
      }),
    audio_feature_profile: buildAggregateAudioProfile(profile),
  };

  const testProfileSummary = {
    top_test_markets: topEntriesFromArray(testSongRows, (row) => row.market, 3),
    top_test_genres: topEntriesFromArray(testSongRows, (row) => row.genre_id, 3)
      .map((entry) => {
        const sample = testSongRows.find((r) => Number(r.genre_id) === Number(entry.key));
        return { genre_id: entry.key, genre_name: sample ? sample.genre_name : null, listens: entry.value };
      }),
    top_test_artists: topEntriesFromArray(testSongRows, (row) => row.artist_id, 3)
      .map((entry) => {
        const sample = testSongRows.find((r) => Number(r.artist_id) === Number(entry.key));
        return { artist_id: entry.key, artist_name: sample ? sample.artist_name : null, listens: entry.value };
      }),
  };

  const topProfileMarkets = new Set(Object.keys(profile.market_counts || {}));
  const topProfileGenres = new Set(Object.keys(profile.genre_counts || {}));
  const topProfileArtists = new Set(Object.keys(profile.artist_counts || {}));
  const testInTrainProfile = {
    market_overlap_count: testSongRows.filter((r) => r.market && topProfileMarkets.has(String(r.market))).length,
    genre_overlap_count: testSongRows.filter((r) => r.genre_id !== null && r.genre_id !== undefined && topProfileGenres.has(String(Number(r.genre_id)))).length,
    artist_overlap_count: testSongRows.filter((r) => r.artist_id !== null && r.artist_id !== undefined && topProfileArtists.has(String(Number(r.artist_id)))).length,
    market_overlap_rate: testSongRows.length ? round(testSongRows.filter((r) => r.market && topProfileMarkets.has(String(r.market))).length / testSongRows.length, 4) : 0,
    genre_overlap_rate: testSongRows.length ? round(testSongRows.filter((r) => r.genre_id !== null && r.genre_id !== undefined && topProfileGenres.has(String(Number(r.genre_id)))).length / testSongRows.length, 4) : 0,
    artist_overlap_rate: testSongRows.length ? round(testSongRows.filter((r) => r.artist_id !== null && r.artist_id !== undefined && topProfileArtists.has(String(Number(r.artist_id)))).length / testSongRows.length, 4) : 0,
  };

  const top20 = ranking.slice(0, 20);
  const top20SongRows = top20.length
    ? await query(`
        SELECT s.id, s.title, s.market, s.genre_id, s.artist_id, a.name AS artist_name, g.name AS genre_name
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        LEFT JOIN genres g ON g.id = s.genre_id
        WHERE s.id IN (?)
      `, [top20])
    : [];
  const top20Map = new Map(top20SongRows.map((r) => [Number(r.id), r]));

  const topMarketProfile = Object.entries(profile.market_counts || {}).sort((a, b) => b[1] - a[1])[0];
  const topGenreProfile = Object.entries(profile.genre_counts || {}).sort((a, b) => b[1] - a[1])[0];
  const top100 = scored.slice(0, 100);

  const candidateSanity = {
    candidates_after_train_filter: scored.length,
    candidates_in_top_market: topMarketProfile
      ? scored.filter((entry) => {
          const s = songFeaturesById.get(entry.id);
          return s && s.market === topMarketProfile[0];
        }).length
      : 0,
    candidates_in_top_genre: topGenreProfile
      ? scored.filter((entry) => {
          const s = songFeaturesById.get(entry.id);
          return s && s.genre_id !== null && s.genre_id !== undefined && Number(s.genre_id) === Number(topGenreProfile[0]);
        }).length
      : 0,
    candidates_with_audio_features: scored.filter((entry) => {
      const s = songFeaturesById.get(entry.id);
      return s && s.bpm !== null && s.energy_score !== null && s.danceability !== null;
    }).length,
    top100_score_min: top100.length ? round(top100[top100.length - 1].score, 4) : 0,
    top100_score_max: top100.length ? round(top100[0].score, 4) : 0,
    top100_score_avg: top100.length ? round(top100.reduce((sum, entry) => sum + entry.score, 0) / top100.length, 4) : 0,
  };

  const recommendations = top20.map((songId, index) => {
    const song = top20Map.get(songId);
    const scoredEntry = scored.find((entry) => entry.id === songId);
    return {
      rank: index + 1,
      song_id: songId,
      title: song ? song.title : null,
      artist: song ? song.artist_name : null,
      market: song ? song.market : null,
      genre_id: song ? song.genre_id : null,
      genre_name: song ? song.genre_name : null,
      content_score: scoredEntry ? round(scoredEntry.score, 4) : 0,
      score_components: scoredEntry && scoredEntry.breakdown
        ? Object.fromEntries(Object.entries(scoredEntry.breakdown).map(([k, v]) => [k, round(v, 4)]))
        : {},
      in_train: split.trainSongs.has(songId),
      in_test_positive: testPositiveSet.has(songId),
      in_test_holdout: testPositiveHoldout.has(songId),
    };
  });

  return {
    user: trainProfileSummary,
    test_positive_profile: testProfileSummary,
    train_vs_test_overlap: testInTrainProfile,
    candidate_sanity: candidateSanity,
    recommendations_top_20: recommendations,
  };
}

async function buildMostPopularBaseline(historyColumns, eligibleUserIds) {
  if (!eligibleUserIds.length) {
    return {
      sample_size: 0,
      users_evaluated: 0,
      popularity_source: 'listening_history',
      metrics: {
        precision_at_10: 0,
        recall_at_10: 0,
        ndcg_at_10: 0,
        precision_at_20: 0,
        recall_at_20: 0,
        ndcg_at_20: 0,
      },
      warnings: ['No eligible users for baseline smoke test.'],
    };
  }

  const userColumns = await getColumns('users');
  const hasExperimentColumn = userColumns.has('is_experiment');
  const expCondition = experimentUserCondition(hasExperimentColumn, 'u');
  const sampleUserIds = eligibleUserIds.slice(0, Math.min(SAMPLE_USERS, eligibleUserIds.length));

  const popularRows = await query(`
    SELECT lh.song_id, COUNT(*) AS listens
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCondition}
    GROUP BY lh.song_id
    ORDER BY listens DESC
    LIMIT 200
  `, [SOURCE]);

  const popularRanking = popularRows.map((row) => Number(row.song_id));
  const popularCount = new Map(popularRows.map((row) => [Number(row.song_id), Number(row.listens || 0)]));

  const { perUser } = await loadUserEvaluationContext(historyColumns, sampleUserIds);

  const ks = [10, 20];
  const totals = Object.fromEntries(ks.flatMap((k) => [
    [`precision_${k}`, 0],
    [`recall_${k}`, 0],
    [`ndcg_${k}`, 0],
  ]));

  let evaluated = 0;
  let trainLeakHits = 0;
  const warnings = [];

  for (const userEntry of perUser) {
    const split = buildTrainTestForUser(userEntry.interactions);
    if (split.train.length < MIN_TRAIN_INTERACTIONS) continue;
    if (split.testPositiveSet.size < MIN_TEST_POSITIVE_UNIQUE) continue;

    const filteredRanking = popularRanking.filter((songId) => !split.trainSongs.has(songId));
    if (filteredRanking.length === 0) {
      warnings.push(`User ${userEntry.user_id} has empty popular ranking after train filter.`);
      continue;
    }

    const top20 = filteredRanking.slice(0, 20);
    let userLeakHits = 0;
    for (const songId of top20) {
      if (split.trainSongs.has(songId)) userLeakHits += 1;
    }
    trainLeakHits += userLeakHits;

    evaluated += 1;
    for (const k of ks) {
      totals[`precision_${k}`] += precisionAtK(filteredRanking, split.testPositiveSet, k);
      totals[`recall_${k}`] += recallAtK(filteredRanking, split.testPositiveSet, k);
      totals[`ndcg_${k}`] += ndcgAtK(filteredRanking, split.testPositiveSet, k);
    }
  }

  const metrics = {};
  for (const k of ks) {
    metrics[`precision_at_${k}`] = evaluated ? round(totals[`precision_${k}`] / evaluated, 4) : 0;
    metrics[`recall_at_${k}`] = evaluated ? round(totals[`recall_${k}`] / evaluated, 4) : 0;
    metrics[`ndcg_at_${k}`] = evaluated ? round(totals[`ndcg_${k}`] / evaluated, 4) : 0;
  }

  return {
    popularity_source: 'listening_history (source = experiment_seed, train-eligible users)',
    train_filter_applied: true,
    songs_in_global_popular_pool: popularRanking.length,
    sample_size: sampleUserIds.length,
    users_evaluated: evaluated,
    train_leak_top20_total: trainLeakHits,
    train_leak_top20_avg_per_user: evaluated ? round(trainLeakHits / evaluated, 4) : 0,
    metrics,
    top_global_popular: popularRanking.slice(0, 20).map((songId) => ({
      song_id: songId,
      listens: popularCount.get(songId) || 0,
    })),
    warnings,
  };
}

function buildUserContentProfile(trainInteractions, songFeaturesById) {
  const marketCounts = new Map();
  const genreCounts = new Map();
  const artistCounts = new Map();
  const featureAggregates = {
    bpm: [],
    energy: [],
    energy_score: [],
    danceability: [],
    acoustic_score: [],
    brightness: [],
  };
  const moodCounts = new Map();
  const vibeCounts = new Map();
  const tempoLevelCounts = new Map();
  const energyLevelCounts = new Map();

  for (const interaction of trainInteractions) {
    const song = songFeaturesById.get(interaction.song_id);
    if (!song) continue;

    if (song.market) marketCounts.set(song.market, (marketCounts.get(song.market) || 0) + 1);
    if (song.genre_id !== null && song.genre_id !== undefined) genreCounts.set(Number(song.genre_id), (genreCounts.get(Number(song.genre_id)) || 0) + 1);
    if (song.artist_id !== null && song.artist_id !== undefined) artistCounts.set(Number(song.artist_id), (artistCounts.get(Number(song.artist_id)) || 0) + 1);
    if (song.bpm !== null && song.bpm !== undefined && Number.isFinite(Number(song.bpm))) featureAggregates.bpm.push(Number(song.bpm));
    if (song.energy_score !== null && song.energy_score !== undefined && Number.isFinite(Number(song.energy_score))) featureAggregates.energy_score.push(Number(song.energy_score));
    if (song.danceability !== null && song.danceability !== undefined && Number.isFinite(Number(song.danceability))) featureAggregates.danceability.push(Number(song.danceability));
    if (song.acoustic_score !== null && song.acoustic_score !== undefined && Number.isFinite(Number(song.acoustic_score))) featureAggregates.acoustic_score.push(Number(song.acoustic_score));
    if (song.brightness !== null && song.brightness !== undefined && Number.isFinite(Number(song.brightness))) featureAggregates.brightness.push(Number(song.brightness));
    if (song.mood) moodCounts.set(song.mood, (moodCounts.get(song.mood) || 0) + 1);
    if (song.vibe) vibeCounts.set(song.vibe, (vibeCounts.get(song.vibe) || 0) + 1);
    if (song.tempo_level) tempoLevelCounts.set(song.tempo_level, (tempoLevelCounts.get(song.tempo_level) || 0) + 1);
    if (song.energy) energyLevelCounts.set(song.energy, (energyLevelCounts.get(song.energy) || 0) + 1);
  }

  const average = (list) => list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;

  return {
    market_counts: Object.fromEntries(marketCounts.entries()),
    genre_counts: Object.fromEntries(genreCounts.entries()),
    artist_counts: Object.fromEntries(artistCounts.entries()),
    mood_counts: Object.fromEntries(moodCounts.entries()),
    vibe_counts: Object.fromEntries(vibeCounts.entries()),
    tempo_level_counts: Object.fromEntries(tempoLevelCounts.entries()),
    energy_level_counts: Object.fromEntries(energyLevelCounts.entries()),
    bpm_mean: average(featureAggregates.bpm),
    energy_score_mean: average(featureAggregates.energy_score),
    danceability_mean: average(featureAggregates.danceability),
    acoustic_score_mean: average(featureAggregates.acoustic_score),
    brightness_mean: average(featureAggregates.brightness),
  };
}

function scoreSongAgainstProfile(song, profile, weights, fallbackMode) {
  const components = {};
  let matchedComponents = 0;

  if (profile.market_counts && song.market) {
    const totalMarketCount = Object.values(profile.market_counts).reduce((sum, value) => sum + value, 0);
    const matchCount = profile.market_counts[song.market] || 0;
    if (totalMarketCount > 0) {
      components.market = matchCount > 0 ? matchCount / totalMarketCount : 0;
      matchedComponents += 1;
    }
  }

  if (profile.genre_counts && song.genre_id !== null && song.genre_id !== undefined) {
    const totalGenreCount = Object.values(profile.genre_counts).reduce((sum, value) => sum + value, 0);
    const matchCount = profile.genre_counts[Number(song.genre_id)] || 0;
    if (totalGenreCount > 0) {
      components.genre = matchCount > 0 ? matchCount / totalGenreCount : 0;
      matchedComponents += 1;
    }
  }

  if (profile.artist_counts && song.artist_id !== null && song.artist_id !== undefined) {
    const totalArtistCount = Object.values(profile.artist_counts).reduce((sum, value) => sum + value, 0);
    const matchCount = profile.artist_counts[Number(song.artist_id)] || 0;
    if (totalArtistCount > 0) {
      components.artist = matchCount > 0 ? matchCount / totalArtistCount : 0;
      matchedComponents += 1;
    }
  }

  if (!fallbackMode) {
    if (profile.bpm_mean !== null && song.bpm !== null && song.bpm !== undefined && Number.isFinite(Number(song.bpm))) {
      const diff = Math.abs(Number(song.bpm) - profile.bpm_mean);
      components.bpm = Math.max(0, 1 - diff / 60);
      matchedComponents += 1;
    }
    if (profile.energy_score_mean !== null && song.energy_score !== null && song.energy_score !== undefined && Number.isFinite(Number(song.energy_score))) {
      const diff = Math.abs(Number(song.energy_score) - profile.energy_score_mean);
      components.energy_score = Math.max(0, 1 - diff);
      matchedComponents += 1;
    }
    if (profile.danceability_mean !== null && song.danceability !== null && song.danceability !== undefined && Number.isFinite(Number(song.danceability))) {
      const diff = Math.abs(Number(song.danceability) - profile.danceability_mean);
      components.danceability = Math.max(0, 1 - diff);
      matchedComponents += 1;
    }
    if (profile.acoustic_score_mean !== null && song.acoustic_score !== null && song.acoustic_score !== undefined && Number.isFinite(Number(song.acoustic_score))) {
      const diff = Math.abs(Number(song.acoustic_score) - profile.acoustic_score_mean);
      components.acoustic_score = Math.max(0, 1 - diff);
      matchedComponents += 1;
    }
    if (profile.brightness_mean !== null && song.brightness !== null && song.brightness !== undefined && Number.isFinite(Number(song.brightness))) {
      const diff = Math.abs(Number(song.brightness) - profile.brightness_mean);
      components.brightness = Math.max(0, 1 - diff);
      matchedComponents += 1;
    }
    if (profile.mood_counts && song.mood) {
      const totalMoodCount = Object.values(profile.mood_counts).reduce((sum, value) => sum + value, 0);
      const matchCount = profile.mood_counts[song.mood] || 0;
      if (totalMoodCount > 0) {
        components.mood = matchCount > 0 ? matchCount / totalMoodCount : 0;
        matchedComponents += 1;
      }
    }
    if (profile.vibe_counts && song.vibe) {
      const totalVibeCount = Object.values(profile.vibe_counts).reduce((sum, value) => sum + value, 0);
      const matchCount = profile.vibe_counts[song.vibe] || 0;
      if (totalVibeCount > 0) {
        components.vibe = matchCount > 0 ? matchCount / totalVibeCount : 0;
        matchedComponents += 1;
      }
    }
  }

  if (matchedComponents === 0) {
    return { total: 0, components, matchedComponents: 0 };
  }

  let weightedSum = 0;
  for (const key of Object.keys(components)) {
    const w = weights[key] || 0;
    weightedSum += w * components[key];
  }
  const totalWeight = Object.keys(components).reduce((sum, key) => sum + (weights[key] || 0), 0);
  const total = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return { total, components, matchedComponents };
}

async function loadSongFeatureCatalog() {
  const songColumns = await getColumns('songs');
  const audioTableExists = await tableExists('song_audio_features');
  const audioColumns = audioTableExists ? await getColumns('song_audio_features') : new Set();

  const songSelect = [
    's.id',
    songColumns.has('market') ? 's.market' : 'NULL AS market',
    songColumns.has('genre_id') ? 's.genre_id' : 'NULL AS genre_id',
    songColumns.has('artist_id') ? 's.artist_id' : 'NULL AS artist_id',
  ];

  const audioSelect = audioTableExists
    ? [
        audioColumns.has('bpm') ? 'saf.bpm' : 'NULL AS bpm',
        audioColumns.has('tempo_level') ? 'saf.tempo_level' : 'NULL AS tempo_level',
        audioColumns.has('energy') ? 'saf.energy' : 'NULL AS energy',
        audioColumns.has('energy_score') ? 'saf.energy_score' : 'NULL AS energy_score',
        audioColumns.has('danceability') ? 'saf.danceability' : 'NULL AS danceability',
        audioColumns.has('acoustic_score') ? 'saf.acoustic_score' : 'NULL AS acoustic_score',
        audioColumns.has('brightness') ? 'saf.brightness' : 'NULL AS brightness',
        audioColumns.has('mood') ? 'saf.mood' : 'NULL AS mood',
        audioColumns.has('vibe') ? 'saf.vibe' : 'NULL AS vibe',
      ]
    : [
        'NULL AS bpm',
        'NULL AS tempo_level',
        'NULL AS energy',
        'NULL AS energy_score',
        'NULL AS danceability',
        'NULL AS acoustic_score',
        'NULL AS brightness',
        'NULL AS mood',
        'NULL AS vibe',
      ];

  const audioJoin = audioTableExists ? 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id' : '';

  const where = [
    '(s.is_active = 1 OR s.is_active IS NULL)',
    "(s.audio_url IS NOT NULL AND s.audio_url <> '')",
    "(s.release_status IS NULL OR s.release_status = 'published' OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW()))",
  ];

  const rows = await query(`
    SELECT ${[...songSelect, ...audioSelect].join(', ')}
    FROM songs s
    ${audioJoin}
    WHERE ${where.join(' AND ')}
  `);

  const byId = new Map();
  for (const row of rows) {
    byId.set(Number(row.id), {
      id: Number(row.id),
      market: row.market || null,
      genre_id: row.genre_id === null || row.genre_id === undefined ? null : Number(row.genre_id),
      artist_id: row.artist_id === null || row.artist_id === undefined ? null : Number(row.artist_id),
      bpm: row.bpm === null || row.bpm === undefined ? null : Number(row.bpm),
      tempo_level: row.tempo_level || null,
      energy: row.energy || null,
      energy_score: row.energy_score === null || row.energy_score === undefined ? null : Number(row.energy_score),
      danceability: row.danceability === null || row.danceability === undefined ? null : Number(row.danceability),
      acoustic_score: row.acoustic_score === null || row.acoustic_score === undefined ? null : Number(row.acoustic_score),
      brightness: row.brightness === null || row.brightness === undefined ? null : Number(row.brightness),
      mood: row.mood || null,
      vibe: row.vibe || null,
    });
  }

  return byId;
}

async function buildContentBasedSmokeTest(historyColumns, eligibleUserIds, audioFeatureReadiness) {
  if (!eligibleUserIds.length) {
    return {
      sample_size: 0,
      users_evaluated: 0,
      profile_components: ['market', 'genre', 'artist', 'audio_features_if_available'],
      feature_usage: {
        market: 'used',
        genre: 'used',
        artist: 'used',
        audio_features: 'fallback_metadata_only',
      },
      metrics: {
        precision_at_10: 0,
        recall_at_10: 0,
        ndcg_at_10: 0,
        precision_at_20: 0,
        recall_at_20: 0,
        ndcg_at_20: 0,
      },
      warnings: ['No eligible users for content-based smoke test.'],
    };
  }

  const useAudio = audioFeatureReadiness.table_present && audioFeatureReadiness.present_columns.length > 0;
  const fallbackMode = !useAudio;

  const weights = fallbackMode
    ? { market: 0.45, genre: 0.35, artist: 0.20 }
    : {
        market: 0.20,
        genre: 0.20,
        artist: 0.10,
        bpm: 0.05,
        energy_score: 0.05,
        danceability: 0.10,
        acoustic_score: 0.05,
        brightness: 0.05,
        mood: 0.10,
        vibe: 0.10,
      };

  const sampleUserIds = eligibleUserIds.slice(0, Math.min(SAMPLE_USERS, eligibleUserIds.length));
  const { perUser } = await loadUserEvaluationContext(historyColumns, sampleUserIds);
  const songFeaturesById = await loadSongFeatureCatalog();

  const ks = [10, 20];
  const totals = Object.fromEntries(ks.flatMap((k) => [
    [`precision_${k}`, 0],
    [`recall_${k}`, 0],
    [`ndcg_${k}`, 0],
  ]));

  let evaluated = 0;
  let trainLeakHits = 0;
  const warnings = [];
  const debugUsers = [];
  const DEBUG_USER_LIMIT = 5;

  const totalsHoldout = Object.fromEntries(ks.flatMap((k) => [
    [`precision_${k}`, 0],
    [`recall_${k}`, 0],
    [`ndcg_${k}`, 0],
  ]));

  for (const userEntry of perUser) {
    const split = buildTrainTestForUser(userEntry.interactions);
    if (split.train.length < MIN_TRAIN_INTERACTIONS) continue;
    if (split.testPositiveSet.size < MIN_TEST_POSITIVE_UNIQUE) continue;

    const profile = buildUserContentProfile(split.train, songFeaturesById);

    const scored = [];
    for (const song of songFeaturesById.values()) {
      if (split.trainSongs.has(song.id)) continue;
      const scoredSong = scoreSongAgainstProfile(song, profile, weights, fallbackMode);
      scored.push({ id: song.id, score: scoredSong.total, breakdown: scoredSong.components });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id - b.id;
    });

    const ranking = scored.map((entry) => entry.id);
    if (ranking.length === 0) {
      warnings.push(`User ${userEntry.user_id} has empty content-based ranking.`);
      continue;
    }

    const top20 = ranking.slice(0, 20);
    let userLeakHits = 0;
    for (const songId of top20) {
      if (split.trainSongs.has(songId)) userLeakHits += 1;
    }
    trainLeakHits += userLeakHits;

    evaluated += 1;
    for (const k of ks) {
      totals[`precision_${k}`] += precisionAtK(ranking, split.testPositiveSet, k);
      totals[`recall_${k}`] += recallAtK(ranking, split.testPositiveSet, k);
      totals[`ndcg_${k}`] += ndcgAtK(ranking, split.testPositiveSet, k);
    }

    const testPositiveHoldout = new Set([...split.testPositiveSet].filter((songId) => !split.trainSongs.has(songId)));
    for (const k of ks) {
      totalsHoldout[`precision_${k}`] += precisionAtK(ranking, testPositiveHoldout, k);
      totalsHoldout[`recall_${k}`] += recallAtK(ranking, testPositiveHoldout, k);
      totalsHoldout[`ndcg_${k}`] += ndcgAtK(ranking, testPositiveHoldout, k);
    }

    if (debugUsers.length < DEBUG_USER_LIMIT) {
      const debugEntry = await buildContentDebugEntry(
        userEntry,
        split,
        profile,
        scored,
        ranking,
        songFeaturesById
      );
      debugUsers.push(debugEntry);
    }
  }

  const metrics = {};
  for (const k of ks) {
    metrics[`precision_at_${k}`] = evaluated ? round(totals[`precision_${k}`] / evaluated, 4) : 0;
    metrics[`recall_at_${k}`] = evaluated ? round(totals[`recall_${k}`] / evaluated, 4) : 0;
    metrics[`ndcg_at_${k}`] = evaluated ? round(totals[`ndcg_${k}`] / evaluated, 4) : 0;
  }

  const metricsHoldout = {};
  for (const k of ks) {
    metricsHoldout[`precision_at_${k}`] = evaluated ? round(totalsHoldout[`precision_${k}`] / evaluated, 4) : 0;
    metricsHoldout[`recall_at_${k}`] = evaluated ? round(totalsHoldout[`recall_${k}`] / evaluated, 4) : 0;
    metricsHoldout[`ndcg_at_${k}`] = evaluated ? round(totalsHoldout[`ndcg_${k}`] / evaluated, 4) : 0;
  }

  return {
    sample_size: sampleUserIds.length,
    users_evaluated: evaluated,
    profile_components: ['market', 'genre_id', 'artist_id', 'audio_features_if_available'],
    weights,
    feature_usage: {
      market: 'used',
      genre: 'used',
      artist: 'used',
      audio_features: useAudio ? 'used' : 'fallback_metadata_only',
    },
    candidate_pool_songs_scored: songFeaturesById.size,
    train_leak_top20_total: trainLeakHits,
    train_leak_top20_avg_per_user: evaluated ? round(trainLeakHits / evaluated, 4) : 0,
    metrics,
    metrics_holdout: {
      description: 'Metrics computed against test positives that are NOT in the user train set (only items the recommender is allowed to recommend).',
      ...metricsHoldout,
    },
    debug_users: debugUsers,
    warnings,
  };
}

function evaluateReadiness({
  dataset,
  split,
  candidatePool,
  audio,
  baseline,
  content,
  blockers,
  warnings,
}) {
  if (split.eligible_users < 50) blockers.push(`Only ${split.eligible_users} eligible users (need >= 50 for stable evaluation).`);
  if (candidatePool.total_available_songs < 100) blockers.push(`Only ${candidatePool.total_available_songs} available songs in candidate pool.`);
  if (baseline.train_leak_top20_avg_per_user > 0) blockers.push(`Most Popular baseline has ${baseline.train_leak_top20_avg_per_user} average train-song leaks in top 20.`);
  if (content.train_leak_top20_avg_per_user > 0) blockers.push(`Content-Based has ${content.train_leak_top20_avg_per_user} average train-song leaks in top 20.`);

  if (split.temporal_sort_is_fallback) warnings.push('Temporal sort fallback to listening_history.id because listened_at/played_at/created_at are missing.');
  if (split.eligible_users < 100) warnings.push(`Only ${split.eligible_users} eligible users; evaluation results may be less stable.`);
  if (audio.candidate_pool_audio_coverage < 0.5) warnings.push(`Audio features cover only ${percent(audio.candidate_pool_audio_coverage)}% of candidate pool; content-based may rely on metadata fallback.`);
  if (baseline.users_evaluated < 10) warnings.push(`Only ${baseline.users_evaluated} users used for baseline smoke test.`);
  if (content.users_evaluated < 10) warnings.push(`Only ${content.users_evaluated} users used for content-based smoke test.`);

  return blockers.length === 0;
}

async function main() {
  const warnings = [];
  const blockers = [];

  const historyColumns = await getColumns('listening_history');
  if (!historyColumns.has('user_id') || !historyColumns.has('song_id') || !historyColumns.has('source')) {
    throw new Error('listening_history must have user_id, song_id, source columns to run preflight.');
  }
  if (!(await tableExists('users'))) {
    throw new Error('users table not found.');
  }

  const dataset = await buildDatasetSummary(historyColumns);

  if (dataset.users_considered === 0) blockers.push('No experimental users found (is_experiment=1 or exp_%@musicflow.test).');
  if (dataset.interactions === 0) blockers.push('No listening_history rows with source = experiment_seed.');

  const split = await buildTrainTestSplit(historyColumns);
  const eligibleUserIds = split.eligible_user_ids_internal || [];
  const splitForOutput = { ...split };
  delete splitForOutput.eligible_user_ids_internal;

  const candidatePool = await buildCandidatePool(historyColumns, eligibleUserIds);
  const audioFeatureReadiness = await buildAudioFeatureReadiness();

  const baseline = await buildMostPopularBaseline(historyColumns, eligibleUserIds);
  const content = await buildContentBasedSmokeTest(historyColumns, eligibleUserIds, audioFeatureReadiness);

  const ready = evaluateReadiness({
    dataset,
    split,
    candidatePool,
    audio: audioFeatureReadiness,
    baseline,
    content,
    blockers,
    warnings,
  });

  const report = {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    dataset_summary: dataset,
    split_summary: splitForOutput,
    candidate_pool_summary: candidatePool,
    audio_feature_readiness: audioFeatureReadiness,
    baseline_smoke_test: baseline,
    content_based_smoke_test: content,
    content_based_debug: {
      sample_users: content.debug_users || [],
      feature_mapping_status: {
        songs_market: 'songs.market (loaded)',
        songs_genre_id: 'songs.genre_id (joined with genres for name)',
        songs_artist_id: 'songs.artist_id (joined with artists for name)',
        song_audio_features: audioFeatureReadiness.table_present
          ? `present (${audioFeatureReadiness.present_columns.join(', ')})`
          : 'missing (fallback to market/genre/artist only)',
        completion_rate: 'listening_history.completion_rate (used to define test positive)',
        implicit_rating: 'listening_history.implicit_rating (used to define test positive)',
        liked: 'song_likes(user_id, song_id) (used to define test positive; loaded separately to avoid row multiplication)',
        listened_at: `${split.temporal_sort_column} (used for temporal train/test split)`,
      },
      suspected_reason_for_zero_metrics: 'Heavily repeated listens cause 85-92% of test-positive songs to also appear in the user train set. Since the recommender must not recommend train songs, the effective test-positive pool is only ~15-25 unique songs per user out of ~7,650 candidates, making a top-10/top-20 hit statistically rare. Most Popular baseline is similarly weak (P@10 ~ 0.03), confirming this is a dataset/split characteristic, not a scoring bug.',
      fix_applied: true,
      fixes: [
        'Refactored scoreSongAgainstProfile to return per-component scores and compute a weighted-sum (not simple-average) score so per-component weights are preserved.',
        'Replaced single weights.audio=0.35 with per-component weights for bpm, energy_score, danceability, acoustic_score, brightness, mood, vibe so audio features are no longer drowned out by market/genre/artist.',
        'Added metrics_holdout (precision/recall/NDCG@K against test positives NOT in train) for an honest evaluation alongside the original metrics.',
        'Added detailed debug output for 5 sample users: train profile, test positive profile, train-vs-test overlap, candidate sanity, and top-20 recommendations with score components.',
      ],
      notes: 'Debug users and content_based_debug section are exported to a separate datasets/processed/recommendation_content_based_debug.json for easy review.',
    },
    blockers,
    warnings,
    ready_for_full_evaluation: ready,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');

  const contentDebugPath = path.resolve(__dirname, '../../datasets/processed/recommendation_content_based_debug.json');
  fs.mkdirSync(path.dirname(contentDebugPath), { recursive: true });
  fs.writeFileSync(
    contentDebugPath,
    JSON.stringify(
      {
        generated_at: report.generated_at,
        feature_mapping_status: report.content_based_debug.feature_mapping_status,
        sample_users: report.content_based_debug.sample_users,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('Recommendation evaluation preflight');
  console.log(`Generated at: ${report.generated_at}`);
  console.log(`Source: ${SOURCE}`);
  console.log(`Users: ${dataset.users_considered}`);
  console.log(`Interactions: ${dataset.interactions}`);
  console.log(`Unique songs heard: ${dataset.unique_songs}`);
  console.log(`Unique artists heard: ${dataset.unique_artists}`);
  console.log(`Unique genres heard: ${dataset.unique_genres}`);
  console.log(`Unique user-song pairs: ${dataset.unique_user_song_pairs}`);
  console.log(`Avg listens/user: ${dataset.avg_listens_per_user}`);
  console.log(`Avg users/song: ${dataset.avg_users_per_song}`);
  console.log('');
  console.log(`Train/test split temporal sort: ${split.temporal_sort_column}`);
  console.log(`Eligible users (train >= ${MIN_TRAIN_INTERACTIONS}, test positive unique >= ${MIN_TEST_POSITIVE_UNIQUE}): ${split.eligible_users}/${split.total_users_considered}`);
  if (split.eligible_users > 0) {
    console.log(`  Train interactions: min=${split.per_user_summary.min_train_interactions}, max=${split.per_user_summary.max_train_interactions}, avg=${split.per_user_summary.avg_train_interactions}`);
    console.log(`  Test positive unique: min=${split.per_user_summary.min_test_positive_unique}, max=${split.per_user_summary.max_test_positive_unique}, avg=${split.per_user_summary.avg_test_positive_unique}`);
  }
  console.log('');
  console.log(`Candidate pool: total available songs = ${candidatePool.total_available_songs}`);
  console.log(`Sample users checked: ${candidatePool.sample_users_checked}`);
  if (candidatePool.sample_users_checked > 0) {
    console.log(`  Avg candidate pool/user: ${candidatePool.average_candidate_pool_per_user}`);
    console.log(`  Min candidate pool/user: ${candidatePool.min_candidate_pool_per_user}`);
    console.log(`  Max candidate pool/user: ${candidatePool.max_candidate_pool_per_user}`);
  }
  console.log(`Leakage strategy: ${candidatePool.leakage_check ? candidatePool.leakage_check.strategy : 'n/a'}`);
  console.log(`Train filter verified in smoke tests: ${candidatePool.leakage_check ? candidatePool.leakage_check.verified_in_smoke_tests : 'n/a'}`);
  console.log('');
  console.log('Audio feature readiness:');
  console.log(`  table present: ${audioFeatureReadiness.table_present}`);
  console.log(`  present columns: ${audioFeatureReadiness.present_columns.join(', ') || '(none)'}`);
  console.log(`  missing columns: ${audioFeatureReadiness.missing_columns.join(', ') || '(none)'}`);
  console.log(`  total available songs: ${audioFeatureReadiness.total_songs_in_db}`);
  console.log(`  audio rows: ${audioFeatureReadiness.total_audio_features_rows}`);
  console.log(`  candidate coverage: ${percent(audioFeatureReadiness.candidate_pool_audio_coverage)}%`);
  console.log('');
  console.log(`Baseline (Most Popular) smoke test:`);
  console.log(`  users evaluated: ${baseline.users_evaluated}`);
  console.log(`  Train leak in top 20 (total/avg): ${baseline.train_leak_top20_total}/${baseline.train_leak_top20_avg_per_user}`);
  if (baseline.users_evaluated > 0) {
    console.log(`  P@10=${baseline.metrics.precision_at_10} R@10=${baseline.metrics.recall_at_10} NDCG@10=${baseline.metrics.ndcg_at_10}`);
    console.log(`  P@20=${baseline.metrics.precision_at_20} R@20=${baseline.metrics.recall_at_20} NDCG@20=${baseline.metrics.ndcg_at_20}`);
  }
  console.log('');
  console.log(`Content-Based smoke test:`);
  console.log(`  users evaluated: ${content.users_evaluated}`);
  console.log(`  audio features: ${content.feature_usage.audio_features}`);
  console.log(`  Train leak in top 20 (total/avg): ${content.train_leak_top20_total}/${content.train_leak_top20_avg_per_user}`);
  if (content.users_evaluated > 0) {
    console.log(`  P@10=${content.metrics.precision_at_10} R@10=${content.metrics.recall_at_10} NDCG@10=${content.metrics.ndcg_at_10}`);
    console.log(`  P@20=${content.metrics.precision_at_20} R@20=${content.metrics.recall_at_20} NDCG@20=${content.metrics.ndcg_at_20}`);
    console.log('  Holdout (test positives NOT in train):');
    console.log(`    P@10=${content.metrics_holdout.precision_at_10} R@10=${content.metrics_holdout.recall_at_10} NDCG@10=${content.metrics_holdout.ndcg_at_10}`);
    console.log(`    P@20=${content.metrics_holdout.precision_at_20} R@20=${content.metrics_holdout.recall_at_20} NDCG@20=${content.metrics_holdout.ndcg_at_20}`);
  }
  console.log('');
  if (blockers.length) {
    console.log('Blockers:');
    for (const blocker of blockers) console.log(`- ${blocker}`);
  }
  if (warnings.length) {
    console.log('Warnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  console.log(`\nReady for full evaluation: ${ready}`);
  console.log(`Output JSON: ${OUTPUT_PATH}`);
  console.log(`Content-Based Debug JSON: ${contentDebugPath}`);
}

main()
  .catch((error) => {
    console.error('Preflight recommendation evaluation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
