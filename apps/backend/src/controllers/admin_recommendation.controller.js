const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const recommendationModelService = require('../services/recommendationModel.service');
const recommendationService = require('../services/recommendation.service');
const { publicSongCondition } = require('../utils/public.utils');

const projectRoot = path.resolve(__dirname, '../../../..');
const recommendationRoot = path.join(projectRoot, 'datasets', 'processed', 'recommendation');

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
  console.log('[Recommendation Admin] recommendationRoot:', recommendationRoot);
  console.log('[Recommendation Admin] candidateDirs:', candidateDirs);

  const modelFile = findLatestFile(candidateDirs, (file) => {
    const lower = file.toLowerCase();
    return lower.endsWith('.json') && (lower.includes('bpr_model') || lower.includes('model_final') || lower.includes('bpr_mf'));
  });

  const metricsFile = findLatestFile(candidateDirs, (file) => {
    const lower = file.toLowerCase();
    return lower.endsWith('.json') && (lower.includes('metrics') || lower.includes('evaluation') || lower.includes('eval'));
  });

  const trainingFile = findLatestFile(candidateDirs, (file) => {
    const lower = file.toLowerCase();
    return lower.endsWith('.json') && (lower.includes('training_history') || lower.includes('train'));
  });

  const runFile = findLatestFile(candidateDirs, (file) => {
    const lower = file.toLowerCase();
    return lower.endsWith('.json') && lower.includes('run_');
  });

  const sampleFile = findLatestFile(candidateDirs, (file) => {
    const lower = file.toLowerCase();
    return lower.endsWith('.json') && lower.includes('sample_outputs');
  });

  console.log('[Recommendation Admin] modelFile:', modelFile?.fullPath);
  console.log('[Recommendation Admin] metricsFile:', metricsFile?.fullPath);
  console.log('[Recommendation Admin] trainingFile:', trainingFile?.fullPath);

  const parsedMetricsData = safeReadJson(metricsFile?.fullPath);
  const normalizedMetrics = normalizeMetrics(parsedMetricsData);

  const parsedModel = safeReadJson(modelFile?.fullPath);
  
  let parsedTraining = null;
  if (parsedModel) {
    parsedTraining = {
      epochs: parsedModel.hyperparameters?.epochs || null,
      factors: parsedModel.factors || null,
      trainedUsers: parsedModel.trained_users || parsedModel.users || null,
      trainedItems: parsedModel.trained_items || parsedModel.items || null,
      interactions: parsedModel.positive_pairs || parsedModel.interactions || null
    };
  }

  return {
    hasArtifact: Boolean(modelFile),
    hasMetrics: Boolean(metricsFile),
    strategy: modelFile ? 'bpr_mf_rerank' : 'content_based_fallback',
    
    artifactPath: modelFile ? path.relative(projectRoot, modelFile.fullPath).replace(/\\/g, '/') : null,
    metricsPath: metricsFile ? path.relative(projectRoot, metricsFile.fullPath).replace(/\\/g, '/') : null,
    trainingPath: trainingFile ? path.relative(projectRoot, trainingFile.fullPath).replace(/\\/g, '/') : null,
    
    updatedAt: modelFile?.updatedAt || metricsFile?.updatedAt || null,
    
    files: {
      model: modelFile?.file || null,
      metrics: metricsFile?.file || null,
      training: trainingFile?.file || null,
      runInfo: runFile?.file || null,
      sampleOutputs: sampleFile?.file || null
    },
    metrics: normalizedMetrics.metrics,
    metricsComparison: normalizedMetrics.metricsComparison,
    training: parsedTraining
  };
};

exports.getSummary = async (req, res) => {
  try {
    const data = exports.getSummaryData();
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
    const metricsFile = findLatestFile(candidateDirs, (file) => {
      const lower = file.toLowerCase();
      return lower.endsWith('.json') && (lower.includes('metrics') || lower.includes('evaluation') || lower.includes('eval'));
    });

    let targetPath = metricsFile ? metricsFile.fullPath : null;
    // Also check METRICS_FILE_PATH_OLD as fallback just in case
    const METRICS_FILE_PATH_OLD = path.join(projectRoot, 'datasets', 'processed', 'recommendation_evaluation_results.json');
    if (!targetPath && fs.existsSync(METRICS_FILE_PATH_OLD)) {
      targetPath = METRICS_FILE_PATH_OLD;
    }

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
    const metricsFile = findLatestFile(candidateDirs, (file) => {
      const lower = file.toLowerCase();
      return lower.endsWith('.json') && (lower.includes('metrics') || lower.includes('evaluation') || lower.includes('eval'));
    });

    let targetPath = metricsFile ? metricsFile.fullPath : null;
    const METRICS_FILE_PATH_OLD = path.join(projectRoot, 'datasets', 'processed', 'recommendation_evaluation_results.json');
    if (!targetPath && fs.existsSync(METRICS_FILE_PATH_OLD)) {
      targetPath = METRICS_FILE_PATH_OLD;
    }

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
