const express = require('express');
const router = express.Router();
const chartController = require('../controllers/chart.controller');
const { optionalAuthenticate } = require('../middleware/auth.middleware');

router.get('/weekly', optionalAuthenticate, chartController.getWeeklyCharts);

module.exports = router;
