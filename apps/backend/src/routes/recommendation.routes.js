const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendation.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/home', authenticate, recommendationController.getHomeRecommendations);
router.get('/home-songs', authenticate, recommendationController.getHomeSongRecommendations);
router.get('/contextual-mood', authenticate, recommendationController.getContextualMoodRecommendations);
router.post('/retrain', (_req, res) => {
  res.status(200).json({
    success: false,
    mode: 'offline_training',
    code: 'OFFLINE_TRAINING_ONLY',
    message: 'Retrain tự động qua API chưa được bật. Hệ thống hiện sử dụng offline cronjob/script để huấn luyện mô hình.',
    // TODO: Có thể bổ sung background job retraining trong phase sau.
  });
});

module.exports = router;
