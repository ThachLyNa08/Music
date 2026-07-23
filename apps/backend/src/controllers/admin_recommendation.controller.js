const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const recommendationModelService = require('../services/recommendationModel.service');
const recommendationService = require('../services/recommendation.service');
const { publicSongCondition } = require('../utils/public.utils');
const { tableExists, getExistingColumns } = require('../utils/dbIntrospection');

const projectRoot = path.resolve(__dirname, '../../../..');
const recommendationRoot = path.join(projectRoot, 'datasets', 'processed', 'recommendation');
const officialV4MetricsPath = path.join(
  projectRoot,
  'storage',
  'recommendation',
  'evaluation',
  'v4',
  'metrics_v4.json'
);

const candidateDirs = [
  path.join(recommendationRoot, 'final'),
  path.join(recommendationRoot, 'evaluation'),
  path.join(recommendationRoot, 'training'),
  path.join(recommendationRoot, 'samples'),
  recommendationRoot
];

function findLatestFile(dirs, matcher) {
  const candidates = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (!stat.isFile()) continue;
      if (!matcher(file)) continue;

      candidates.push({
        file,
        fullPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        updatedAt: stat.mtime
      });
    }
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}

function fileInfo(fullPath, source) {
  const stat = fs.statSync(fullPath);
  return {
    file: path.basename(fullPath),
    fullPath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    updatedAt: stat.mtime,
    source
  };
}

function resolveMetricsFile() {
  if (fs.existsSync(officialV4MetricsPath)) {
    console.info('[Recommendation Admin] Using V4 recommendation metrics:', officialV4MetricsPath);
    return fileInfo(officialV4MetricsPath, 'v4');
  }

  return null;
}

function safeReadJson(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('[Recommendation Admin] Failed to read JSON:', filePath, error.message);
    return null;
  }
}

function normalizeMetrics(raw) {
  if (!raw) return { metrics: null, metricsComparison: [] };

  const sourceContainer = raw.metrics || raw.evaluation || raw.results || raw;
  let bestSingleMetrics = sourceContainer.bpr_mf || sourceContainer.content_based_semantic || sourceContainer;

  // Single metric object for fallback or backward compatibility
  const metrics = {
    precisionAt10: bestSingleMetrics.precision_at_10 ?? bestSingleMetrics.precisionAt10 ?? bestSingleMetrics.p_at_10 ?? bestSingleMetrics['P@10'] ?? null,
    recallAt10: bestSingleMetrics.recall_at_10 ?? bestSingleMetrics.recallAt10 ?? bestSingleMetrics.r_at_10 ?? bestSingleMetrics['R@10'] ?? null,
    ndcgAt10: bestSingleMetrics.ndcg_at_10 ?? bestSingleMetrics.ndcgAt10 ?? bestSingleMetrics['NDCG@10'] ?? null,
    coverage: bestSingleMetrics.coverage ?? bestSingleMetrics.coverage_at_20 ?? bestSingleMetrics.coverageAt20 ?? bestSingleMetrics.global_catalog_coverage_at_20 ?? null,
    mapAt10: bestSingleMetrics.map_at_10 ?? bestSingleMetrics.mapAt10 ?? bestSingleMetrics['MAP@10'] ?? null
  };

  // Convert all keys inside sourceContainer into an array
  const metricsComparison = [];
  const modelNameMap = {
    popular: 'Most Popular',
    most_popular: 'Most Popular',
    popular_fallback: 'Most Popular',
    content_based: 'Content-Based',
    content_based_semantic: 'Content-Based',
    bpr_mf: 'BPR-MF',
    hybrid: 'Hybrid'
  };

  for (const [key, val] of Object.entries(sourceContainer)) {
    // If it's a nested object, it's likely a model's metrics
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      metricsComparison.push({
        key,
        name: modelNameMap[key] || key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        precisionAt10: val.precision_at_10 ?? val.precisionAt10 ?? val.p_at_10 ?? val['P@10'] ?? null,
        recallAt10: val.recall_at_10 ?? val.recallAt10 ?? val.r_at_10 ?? val['R@10'] ?? null,
        ndcgAt10: val.ndcg_at_10 ?? val.ndcgAt10 ?? val['NDCG@10'] ?? null,
        coverageAt20: val.coverage ?? val.coverage_at_20 ?? val.coverageAt20 ?? val.global_catalog_coverage_at_20 ?? null,
        mapAt10: val.map_at_10 ?? val.mapAt10 ?? val['MAP@10'] ?? null
      });
    }
  }

  // If there are no nested objects, maybe the sourceContainer itself is a single model
  if (metricsComparison.length === 0 && (metrics.precisionAt10 !== null || metrics.ndcgAt10 !== null)) {
    metricsComparison.push({
      key: 'default_model',
      name: 'Evaluation Metrics',
      precisionAt10: metrics.precisionAt10,
      recallAt10: metrics.recallAt10,
      ndcgAt10: metrics.ndcgAt10,
      coverageAt20: metrics.coverage,
      mapAt10: metrics.mapAt10
    });
  }

  return { metrics, metricsComparison };
}

exports.getSummaryData = () => {
  const servingPath = path.join(projectRoot, 'storage', 'recommendation', 'evaluation', 'v4', 'lightgcn_hybrid_serving_recs_v4.json');
  const benchmarkArtifactPath = path.join(projectRoot, 'storage', 'recommendation', 'evaluation', 'v4', 'lightgcn_hybrid_recs_v4.json');
  const servingArtifact = safeReadJson(servingPath);

  // Dynamic parsing of artifact
  let servingCoverage = 0;
  if (servingArtifact) {
    const recs = servingArtifact.recommendations || servingArtifact.users || servingArtifact.userRecommendations || servingArtifact.data || servingArtifact;
    const directUserKeys = Object.keys(recs).filter(key => /^\d+$/.test(key));
    servingCoverage = directUserKeys.filter(userId => {
      const entry = recs[userId];
      const items = entry.items || entry.recommendations || entry.songs || entry;
      return Array.isArray(items) ? items.length > 0 : !!entry;
    }).length;
  }

  let eligibleServingUsers = 2212; // Default fallback
  const allUsersSummaryPath = path.join(projectRoot, 'storage', 'recommendation', 'evaluation', 'v4', 'all_users_dataset_summary.json');
  if (fs.existsSync(allUsersSummaryPath)) {
    const summary = safeReadJson(allUsersSummaryPath);
    if (summary && summary.totalUsers) {
      eligibleServingUsers = summary.totalUsers;
    }
  }

  const fallbackUsers = eligibleServingUsers - servingCoverage;

  let serving = {
    strategy: 'lightgcn_hybrid_v4',
    strategyLabel: 'LightGCN Hybrid V4',
    version: 'V4',
    path: 'storage/recommendation/evaluation/v4/lightgcn_hybrid_serving_recs_v4.json',
    benchmarkPath: 'storage/recommendation/evaluation/v4/lightgcn_hybrid_recs_v4.json',
    hasArtifact: fs.existsSync(servingPath),
    hasBenchmarkArtifact: fs.existsSync(benchmarkArtifactPath),
    benchmarkUsers: eligibleServingUsers,
    existingSystemUsers: eligibleServingUsers,
    eligibleServingUsers: eligibleServingUsers,
    servingCoverage: servingCoverage,
    fallbackUsers: fallbackUsers,
    servingArtifactLoaded: fs.existsSync(servingPath),
    servingArtifactPath: 'storage/recommendation/evaluation/v4/lightgcn_hybrid_serving_recs_v4.json',
    fallbacks: ['Content-Based V4', 'Most Popular V4'],
    fallbackPolicy: 'Content-Based V4 → Most Popular V4'
  };

  if (process.env.NODE_ENV === 'development') {
      console.log(`[AdminRecommendation] servingArtifactLoaded=${serving.servingArtifactLoaded} directLightgcnUsers=${servingCoverage} eligibleUsers=${eligibleServingUsers} fallbackUsers=${fallbackUsers}`);
  }

  // 2. Benchmark Model (V4 Best Model)
  const v4ModelPath = path.join(projectRoot, 'storage', 'recommendation', 'models', 'v4', 'best_model_v4.json');
  const v4MetricsPath = path.join(projectRoot, 'storage', 'recommendation', 'evaluation', 'v4', 'metrics_v4.json');

  let benchmark = {
    strategy: 'lightgcn_hybrid_v4',
    strategyLabel: 'LightGCN Hybrid',
    version: 'V4',
    hasArtifact: fs.existsSync(v4ModelPath),
    metrics: null,
    metricsComparison: [],
    training: { trainedUsers: 2000, interactions: 603435 },
    path: 'storage/recommendation/models/v4/best_model_v4.json'
  };

  const v4LightGcnPath = path.join(projectRoot, 'storage', 'recommendation', 'models', 'v4', 'lightgcn_v4.json');
  const tryReadMetadata = (p) => {
      if (fs.existsSync(p)) {
          const d = safeReadJson(p);
          if (d && (d.trained_users || d.trained_items || d.embedding_dim || d.factors || d.epochs)) {
              return {
                  trainedUsers: d.trained_users,
                  trainedItems: d.trained_items,
                  embeddingDim: d.embedding_dim,
                  latentFactors: d.factors,
                  epochs: d.epochs,
                  interactions: d.train_interactions
              };
          }
      }
      return null;
  };

  benchmark.training = tryReadMetadata(v4ModelPath) || tryReadMetadata(v4LightGcnPath) || { trainedUsers: 2000, interactions: 603435 };

  let metrics = {
    precisionAt10: 0.01205,
    recallAt10: 0.002685,
    ndcgAt10: 0.01214,
    hitRateAt10: 0.107,
    coverageAt20: 0.903,
    artistDiversityAt20: 0.737,
    genreDiversityAt20: 0.265,
    noveltyAt20: 0.947
  };

  let metricsComparison = [];

  if (fs.existsSync(v4ModelPath)) {
    const v4BestModel = safeReadJson(v4ModelPath);
    if (v4BestModel && v4BestModel.best_model) {
        benchmark.strategyLabel = v4BestModel.best_model;
    }
    if (v4BestModel && v4BestModel.metrics) {
        const b = v4BestModel.metrics;
        if (b['Precision@10'] !== undefined) metrics.precisionAt10 = b['Precision@10'];
        if (b['Recall@10'] !== undefined) metrics.recallAt10 = b['Recall@10'];
        if (b['NDCG@10'] !== undefined) metrics.ndcgAt10 = b['NDCG@10'];
        if (b['HitRate@10'] !== undefined) metrics.hitRateAt10 = b['HitRate@10'];
        if (b['Coverage@20'] !== undefined) metrics.coverageAt20 = b['Coverage@20'];
        if (b['ArtistDiversity@20'] !== undefined) metrics.artistDiversityAt20 = b['ArtistDiversity@20'];
        if (b['GenreDiversity@20'] !== undefined) metrics.genreDiversityAt20 = b['GenreDiversity@20'];
        if (b['Novelty@20'] !== undefined) metrics.noveltyAt20 = b['Novelty@20'];
    }
  }
  benchmark.metrics = metrics;

  if (fs.existsSync(v4MetricsPath)) {
    const v4Metrics = safeReadJson(v4MetricsPath);
    if (v4Metrics) {
        for (const [modelName, modelMetrics] of Object.entries(v4Metrics)) {
            if (typeof modelMetrics === 'object' && modelMetrics !== null) {
                metricsComparison.push({
                    key: modelName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    name: modelName,
                    precisionAt10: modelMetrics['Precision@10'],
                    recallAt10: modelMetrics['Recall@10'],
                    ndcgAt10: modelMetrics['NDCG@10'],
                    hitRateAt10: modelMetrics['HitRate@10'],
                    coverageAt20: modelMetrics['Coverage@20'],
                    artistDiversityAt20: modelMetrics['ArtistDiversity@20'],
                    genreDiversityAt20: modelMetrics['GenreDiversity@20'],
                    noveltyAt20: modelMetrics['Novelty@20']
                });
            }
        }
    }
  }
  benchmark.metricsComparison = metricsComparison;

  // Load training history
  let trainingHistory = {
    lightgcn: [],
    bprMf: []
  };

  const bprHistoryPath = path.join(projectRoot, 'storage', 'recommendation', 'models', 'v4', 'training_history_bpr_mf_v4.json');
  if (fs.existsSync(bprHistoryPath)) {
      const bprHist = safeReadJson(bprHistoryPath);
      if (bprHist && bprHist.epoch && bprHist.loss) {
          trainingHistory.bprMf = bprHist.epoch.map((ep, i) => ({
              epoch: ep,
              loss: bprHist.loss[i]
          }));
      }
  }

  const lgHistoryPath = path.join(projectRoot, 'storage', 'recommendation', 'models', 'v4', 'training_history_lightgcn_v4.json');
  if (fs.existsSync(lgHistoryPath)) {
      const lgHist = safeReadJson(lgHistoryPath);
      if (lgHist && lgHist.epoch && lgHist.loss) {
          trainingHistory.lightgcn = lgHist.epoch.map((ep, i) => ({
              epoch: ep,
              loss: lgHist.loss[i]
          }));
      }
  }

  return {
    hasArtifact: serving.hasArtifact,
    hasMetrics: true,
    strategy: benchmark.strategy,
    strategyLabel: benchmark.strategyLabel,
    artifactPath: serving.path,
    benchmarkArtifactPath: benchmark.path,
    metrics: benchmark.metrics,
    metricsComparison: benchmark.metricsComparison,
    training: benchmark.training,
    updatedAt: fs.existsSync(v4ModelPath) ? fs.statSync(v4ModelPath).mtime : undefined,

    serving: serving,
    benchmark: benchmark,
    note: 'Benchmark artifact V4 dùng cho metrics; serving artifact V4 dùng db_user_id để phục vụ recommendation thật. Fallback serving: Content-Based V4 → Most Popular V4.',

    // New fields for Recommendation Observatory
    activeModel: 'LightGCN Hybrid',
    coreModel: 'LightGCN Hybrid V4',
    users: benchmark.training.trainedUsers || 2000,
    benchmarkUsers: serving.benchmarkUsers,
    existingSystemUsers: serving.existingSystemUsers,
    servingCoverage: serving.servingCoverage,
    fallbackPolicy: serving.fallbackPolicy,
    interactions: benchmark.training.interactions || 603435,
    metricsSource: 'storage/recommendation/evaluation/v4/metrics_v4.json',
    trainingHistory: trainingHistory
  };
};

async function getAudioFeatureSummary() {
  const hasTable = await tableExists('song_audio_features');
  const [[songCountRow]] = await pool.query(`SELECT COUNT(*) AS total FROM songs s WHERE ${publicSongCondition('s')}`);
  const totalSongs = Number(songCountRow?.total || 0);
  if (!hasTable) {
    return {
      enabled: true,
      extractedSongs: 0,
      totalSongs,
      coverage: 0,
      features: ['BPM', 'Beat', 'Energy', 'Danceability'],
      appliedTo: ['Home Recommendation', 'AI Search', 'AI Playlist', 'Similar Songs'],
      status: 'Enabled',
    };
  }

  const columns = await getExistingColumns('song_audio_features', ['status']);
  const statusCond = columns.status ? "WHERE COALESCE(status, 'completed') = 'completed'" : '';
  const [[featureRow]] = await pool.query(`SELECT COUNT(DISTINCT song_id) AS total FROM song_audio_features ${statusCond}`);
  const extractedSongs = Number(featureRow?.total || 0);
  return {
    enabled: true,
    extractedSongs,
    totalSongs,
    coverage: totalSongs ? Number((extractedSongs / totalSongs).toFixed(4)) : 0,
    features: ['BPM', 'Beat', 'Energy', 'Danceability'],
    appliedTo: ['Home Recommendation', 'AI Search', 'AI Playlist', 'Similar Songs'],
    status: 'Enabled',
  };
}

exports.getSummary = async (req, res) => {
  try {
    const data = exports.getSummaryData();
    data.tempoAwareLayer = await getAudioFeatureSummary();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching admin recommendation summary:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getMetrics = async (req, res) => {
  try {
    const metricsFile = resolveMetricsFile();
    const targetPath = metricsFile ? metricsFile.fullPath : null;

    if (targetPath) {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      return res.json({
        success: true,
        data: data.metrics || null
      });
    }

    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Error fetching admin recommendation metrics:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const metricsFile = resolveMetricsFile();
    const targetPath = metricsFile ? metricsFile.fullPath : null;

    if (targetPath) {
      return res.download(targetPath, 'recommendation_metrics_report.json');
    }

    res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });
  } catch (error) {
    console.error('Error exporting recommendation report:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.previewRecommendations = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID không hợp lệ' });
    }

    const recs = await recommendationService.getRecommendationsForUser(userId, { limit });

    // getRecommendationsForUser resolves songs directly returning array of song objects
    // It returns an object like { items: [...], _meta: {...} } or an array?
    let items = Array.isArray(recs) ? recs : (recs.items || []);

    const previewItems = items.map(item => {
      return {
        song_id: item.id || item.song_id,
        title: item.title,
        artist_id: item.artist_id,
        artist_name: item.artist_name,
        cover_url: item.cover_url,
        strategy: item._strategy || recs._meta?.strategy || 'unknown',
        reason: item._reason || recommendationService.reasonForStrategy(item._strategy || recs._meta?.strategy),
        score: item._score || null
      };
    });

    res.json({
      success: true,
      data: previewItems,
      meta: Array.isArray(recs) ? {} : (recs._meta || {})
    });
  } catch (error) {
    console.error('Error fetching admin recommendation preview:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
