const express = require('express');
const router = express.Router();
const chartController = require('../controllers/chart.controller');
const { optionalAuthenticate } = require('../middleware/auth.middleware');

router.get('/weekly', optionalAuthenticate, chartController.getWeeklyCharts);
router.get('/global', optionalAuthenticate, chartController.getGlobalCharts);

module.exports = router;
