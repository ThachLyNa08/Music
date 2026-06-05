const express = require('express');
const router = express.Router();
router.get('/', (req, res) => res.json({ message: 'payment routes' }));
module.exports = router;