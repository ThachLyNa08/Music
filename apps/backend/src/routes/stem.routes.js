const express = require('express');
const router = express.Router();

function featureNotReady(_req, res) {
  res.status(501).json({
    success: false,
    code: 'FEATURE_NOT_READY',
    message: 'Tinh nang tach beat/karaoke AI hien dang duoc phat trien.',
  });
}

router.all('/', featureNotReady);
router.all('*', featureNotReady);

module.exports = router;
