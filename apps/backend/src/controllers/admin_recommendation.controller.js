const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const recommendationModelService = require('../services/recommendationModel.service');
const recommendationService = require('../services/recommendation.service');
const { publicSongCondition } = require('../utils/public.utils');

const RUN_METADATA_PATH = path.resolve(__dirname, '../../../../datasets/processed/recommendation/final/recommendation_final_semantic_v2_run_metadata.json');
const METRICS_FILE_PATH_NEW = path.resolve(__dirname, '../../../../datasets/processed/recommendation/final/recommendation_final_semantic_v2_metrics.json');
const METRICS_FILE_PATH_OLD = path.resolve(__dirname, '../../../../datasets/processed/recommendation_evaluation_results.json');

exports.getSummary = async (req, res) => {
  try {
    const [[{ usersWithHistory }]] = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as usersWithHistory 
      FROM listening_history
    `);

    // Consider eligible users as those with at least 5 listened songs
    const [[{ eligibleUsers }]] = await pool.query(`
      SELECT COUNT(*) as eligibleUsers FROM (
        SELECT user_id FROM listening_history
        GROUP BY user_id
        HAVING COUNT(DISTINCT song_id) >= 5
      ) t
    `);

    const [[{ catalogSongs }]] = await pool.query(`
      SELECT COUNT(*) as catalogSongs 
      FROM songs 
      WHERE ${publicSongCondition('songs')} 
        AND audio_url IS NOT NULL 
        AND audio_url != ''
    `);

    const loadStatus = recommendationModelService.getLoadStatus();
    let metadata = recommendationModelService.getModelMetadata();

    let runMetadata = null;
    if (fs.existsSync(RUN_METADATA_PATH)) {
      try {
        runMetadata = JSON.parse(fs.readFileSync(RUN_METADATA_PATH, 'utf8'));
      } catch (err) {
        console.error('Failed to parse run metadata:', err);
      }
    }

    res.json({
      success: true,
      data: {
        usersWithHistory: Number(usersWithHistory),
        eligibleUsers: Number(eligibleUsers),
        catalogSongs: Number(catalogSongs),
        currentStrategy: loadStatus.ok ? 'bpr_mf_rerank' : 'content_based_fallback',
        modelLoaded: loadStatus.ok,
        modelArtifact: loadStatus.path,
        modelUpdatedAt: loadStatus.loadedAt,
        trainedUsers: metadata ? metadata.trained_users : 0,
        trainedItems: metadata ? metadata.trained_items : 0,
        factors: metadata ? metadata.factors : 0,
        epochs: metadata?.hyperparameters ? metadata.hyperparameters.epochs : 0,
        metadata,
        runMetadata
      }
    });
  } catch (error) {
    console.error('Error fetching admin recommendation summary:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getMetrics = async (req, res) => {
  try {
    let targetPath = null;
    if (fs.existsSync(METRICS_FILE_PATH_NEW)) {
      targetPath = METRICS_FILE_PATH_NEW;
    } else if (fs.existsSync(METRICS_FILE_PATH_OLD)) {
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
