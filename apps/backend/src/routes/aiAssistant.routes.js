const express = require('express');
const router = express.Router();
const aiAssistantController = require('../controllers/aiAssistant.controller');
const { optionalAuthenticate } = require('../middleware/auth.middleware');

router.post('/music', optionalAuthenticate, aiAssistantController.musicAssistant);

module.exports = router;
