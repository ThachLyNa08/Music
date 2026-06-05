const express = require('express');
const router = express.Router();
const genreController = require('../controllers/genre.controller');

router.get('/', genreController.getAllGenres);

module.exports = router;
