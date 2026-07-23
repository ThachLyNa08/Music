const { pool } = require('../config/database');
const { tableExists, getExistingColumns } = require('../utils/dbIntrospection');
const { getTempoBucket } = require('../utils/tempoFeature.util');

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function weightedAverage(rows, valueKey, weightKey) {
  let sum = 0;
  let weightSum = 0;
  for (const row of rows) {
    const value = Number(row[valueKey]);
    const weight = Number(row[weightKey]);
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
    sum += value * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? sum / weightSum : null;
}

function emptyProfile() {
  return {
    preferredTempoBucket: null,
    tempoDistribution: { slow: 0, medium: 0, fast: 0 },
    avgBpm: null,
    avgEnergy: null,
    avgDanceability: null,
    confidence: 0,
  };
}

async function buildUserTempoProfile(userId, options = {}) {
  if (!userId || !(await tableExists('song_audio_features'))) return emptyProfile();

  const columns = await getExistingColumns('song_audio_features', [
    'normalized_bpm',
    'raw_bpm',
    'tempo_bucket',
    'tempo_level',
    'bpm',
    'energy_score',
    'danceability_score',
    'danceability',
    'status',
  ]);
  const historyColumns = await getExistingColumns('listening_history', [
    'listen_duration',
    'completion_rate',
    'is_skipped',
    'skipped',
    'skip_at_sec',
    'listened_at',
    'created_at',
  ]);

  const bpmExpr = columns.normalized_bpm
    ? 'saf.normalized_bpm'
    : (columns.bpm ? 'saf.bpm' : (columns.raw_bpm ? 'saf.raw_bpm' : 'NULL'));
  const bucketExpr = columns.tempo_bucket
    ? 'saf.tempo_bucket'
    : (columns.tempo_level ? 'saf.tempo_level' : 'NULL');
  const danceExpr = columns.danceability_score
    ? 'saf.danceability_score'
    : (columns.danceability ? 'saf.danceability' : 'NULL');
  const statusCond = columns.status ? "AND COALESCE(saf.status, 'completed') = 'completed'" : '';
  const listenDurationExpr = historyColumns.listen_duration ? 'lh.listen_duration' : 'NULL';
  const skippedExpr = historyColumns.is_skipped
    ? 'COALESCE(lh.is_skipped, 0)'
    : (historyColumns.skipped ? 'COALESCE(lh.skipped, 0)' : (historyColumns.skip_at_sec ? 'CASE WHEN lh.skip_at_sec IS NULL THEN 0 ELSE 1 END' : '0'));
  const orderCol = historyColumns.listened_at ? 'lh.listened_at' : (historyColumns.created_at ? 'lh.created_at' : 'lh.id');
  const limit = Math.max(20, Math.min(Number(options.limit) || 100, 300));

  const [rows] = await pool.query(`
    SELECT
      lh.song_id,
      COALESCE(lh.completion_rate, 0.5) AS completion_rate,
      ${listenDurationExpr} AS listen_duration,
      ${skippedExpr} AS is_skipped,
      ${bpmExpr} AS normalized_bpm,
      ${bucketExpr} AS tempo_bucket,
      saf.energy_score,
      ${danceExpr} AS danceability_score
    FROM listening_history lh
    JOIN song_audio_features saf ON saf.song_id = lh.song_id
    JOIN songs s ON s.id = lh.song_id
    WHERE lh.user_id = ?
      ${statusCond}
      AND (${bpmExpr} IS NOT NULL OR ${bucketExpr} IS NOT NULL)
    ORDER BY ${orderCol} DESC
    LIMIT ?
  `, [userId, limit]);

  if (!rows.length) return emptyProfile();

  const weightedRows = rows.map((row, index) => {
    const completion = Number.isFinite(Number(row.completion_rate)) ? clamp01(row.completion_rate) : 0.5;
    const listenDuration = Number(row.listen_duration);
    const durationBoost = Number.isFinite(listenDuration) && listenDuration >= 60 ? 0.1 : 0;
    const skipPenalty = Number(row.is_skipped) ? -0.3 : 0.2;
    const recency = 1 - Math.min(index / Math.max(rows.length, 1), 1) * 0.25;
    const weight = Math.max(0.1, completion + durationBoost + skipPenalty) * recency;
    const bpm = Number(row.normalized_bpm);
    const bucket = row.tempo_bucket && row.tempo_bucket !== 'unknown'
      ? row.tempo_bucket
      : getTempoBucket(bpm);
    return { ...row, weight, normalized_bpm: bpm, tempo_bucket: bucket };
  });

  const distribution = { slow: 0, medium: 0, fast: 0 };
  let totalWeight = 0;
  for (const row of weightedRows) {
    if (distribution[row.tempo_bucket] === undefined) continue;
    distribution[row.tempo_bucket] += row.weight;
    totalWeight += row.weight;
  }

  if (totalWeight <= 0) return emptyProfile();
  for (const key of Object.keys(distribution)) {
    distribution[key] = Number((distribution[key] / totalWeight).toFixed(4));
  }

  const preferredTempoBucket = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const confidence = Math.min(1, (weightedRows.length / 20) * Math.max(...Object.values(distribution)));

  return {
    preferredTempoBucket,
    tempoDistribution: distribution,
    avgBpm: weightedAverage(weightedRows, 'normalized_bpm', 'weight'),
    avgEnergy: weightedAverage(weightedRows, 'energy_score', 'weight'),
    avgDanceability: weightedAverage(weightedRows, 'danceability_score', 'weight'),
    confidence: Number(confidence.toFixed(4)),
  };
}

module.exports = {
  buildUserTempoProfile,
};
