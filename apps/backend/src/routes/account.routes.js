const express = require('express');
const accountAppealController = require('../controllers/accountAppeal.controller');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

router.post('/appeals/lock', upload.single('evidence'), accountAppealController.submitLockAppeal);

module.exports = router;
