const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../..');
require(path.join(projectRoot, 'apps/backend/node_modules/dotenv')).config({
  path: path.join(projectRoot, 'apps/backend/.env'),
});

const { pool } = require('../../../apps/backend/src/config/database');
const recommendationService = require('../../../apps/backend/src/services/recommendation.service');

const EVAL_DIR = path.join(projectRoot, 'storage/recommendation/evaluation/v4');
const BENCHMARK_LIGHTGCN_PATH = path.join(EVAL_DIR, 'lightgcn_hybrid_recs_v4.json');
const OUTPUT_PATH = path.join(EVAL_DIR, 'lightgcn_hybrid_serving_recs_v4.json');
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 20);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getCsvUserId(email) {
  const match = String(email || '').match(/^exp_v4_(\d+)@musicflow\.test$/);
  return match ? match[1] : null;
}

function normalizeStrategy(strategy) {
  if (strategy === 'content_based_v4_runtime' || strategy === 'content_based_fallback') return 'content_based_v4';
  if (strategy === 'popular_fallback') return 'most_popular_v4';
  if (strategy === 'cold_start_preferences') return 'cold_start_v4';
  return strategy || 'most_popular_v4';
}

function labelForStrategy(strategy) {
  const labels = {
    lightgcn_hybrid_v4: 'LightGCN Hybrid V4',
    content_based_v4: 'Content-Based V4',
    most_popular_v4: 'Most Popular V4',
    cold_start_v4: 'Cold-start V4',
  };
  return labels[strategy] || 'LightGCN Hybrid V4';
}

function compactItems(items) {
  return (items || []).map((song) => ({
    song_id: Number(song.id || song.song_id),
    score: Number(Number(song.finalScore ?? song.recommendation_score ?? song.bprScore ?? song.score ?? 0).toFixed(6)),
  })).filter((item) => Number.isFinite(item.song_id));
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function main() {
  fs.mkdirSync(EVAL_DIR, { recursive: true });

  const benchmarkArtifact = readJson(BENCHMARK_LIGHTGCN_PATH) || {};
  const benchmarkUsers = Object.keys(benchmarkArtifact).length;

  const [users] = await pool.query(
    `SELECT id, email, role, status
     FROM users
     WHERE role = 'user' AND status = 'active'
     ORDER BY id`
  );

  const [existingRows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM users
     WHERE role = 'user'
       AND status = 'active'
       AND email NOT LIKE 'exp_v4_%@musicflow.test'`
  );

  const hasArtistPreferences = await tableExists('user_artist_preferences');
  const hasGenrePreferences = await tableExists('user_genre_preferences');

  const recommendations = {};
  const skipped = [];
  let directLightgcnUsers = 0;
  let fallbackUsers = 0;

  for (const user of users) {
    try {
      const result = await recommendationService.getRecommendationsForUserRaw(user.id, LIMIT, {
        bypassServingArtifact: true,
      });
      const strategy = normalizeStrategy(result.strategy);
      const fallbackUsed = strategy !== 'lightgcn_hybrid_v4';
      const csvUserId = getCsvUserId(user.email);

      if (fallbackUsed) fallbackUsers += 1;
      else directLightgcnUsers += 1;

      recommendations[String(user.id)] = {
        user_id: Number(user.id),
        csv_user_id: csvUserId,
        userIdSpace: 'db_user_id',
        benchmarkUserIdSpace: csvUserId ? 'csv_user_id' : null,
        strategy,
        strategyLabel: labelForStrategy(strategy),
        servingVersion: 'v4',
        coreModel: 'LightGCN Hybrid V4',
        fallbackUsed,
        fallbackReason: fallbackUsed
          ? result.fallbackReason || result.reason || 'user_not_in_lightgcn_model'
          : null,
        fallbackChain: fallbackUsed ? (result.fallbackChain || ['content_based_v4', 'most_popular_v4']) : [],
        legacyV3Used: false,
        items: compactItems(result.items).slice(0, LIMIT),
      };
    } catch (error) {
      skipped.push({ user_id: Number(user.id), error: error.message });
    }
  }

  const artifact = {
    metadata: {
      artifactType: 'serving',
      version: 'v4',
      generatedAt: new Date().toISOString(),
      userIdSpace: 'db_user_id',
      benchmarkArtifactUserIdSpace: 'csv_user_id',
      benchmarkArtifactPath: 'storage/recommendation/evaluation/v4/lightgcn_hybrid_recs_v4.json',
      benchmarkUsers,
      existingSystemUsers: Number(existingRows[0]?.count || 0),
      eligibleServingUsers: users.length,
      servingCoverage: directLightgcnUsers,
      directLightgcnUsers,
      fallbackUsers,
      skippedUsers: skipped.length,
      coreModel: 'LightGCN Hybrid V4',
      fallbackPolicy: ['Content-Based V4', 'Most Popular V4', 'Cold-start'],
      dataSources: {
        users: 'users',
        listeningHistory: 'listening_history',
        likedSongs: 'not_available_in_current_schema',
        selectedGenres: hasGenrePreferences ? 'user_genre_preferences' : 'not_available',
        selectedArtists: hasArtistPreferences ? 'user_artist_preferences' : 'not_available',
      },
      legacyV3Used: false,
    },
    recommendations,
    skipped,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(artifact, null, 2));
  console.log(`Serving artifact written: ${OUTPUT_PATH}`);
  console.log(JSON.stringify(artifact.metadata, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
