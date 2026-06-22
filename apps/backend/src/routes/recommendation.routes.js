const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendation.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/home', authenticate, recommendationController.getHomeRecommendations);
router.get('/home-songs', authenticate, recommendationController.getHomeSongRecommendations);
router.get('/contextual-mood', authenticate, recommendationController.getContextualMoodRecommendations);
router.post('/retrain', (_req, res) => {
  res.status(501).json({
    success: false,
    code: 'FEATURE_NOT_READY',
    message: 'Recommendation model retraining is not enabled in this backend instance.',
  });
});

module.exports = router;
