const express = require('express');
const lyricsController = require('../controllers/lyrics.controller');

const router = express.Router();

router.get('/song/:songId', lyricsController.getSongLyrics);

module.exports = router;
