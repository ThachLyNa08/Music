// src/routes/payments.routes.js
const express = require('express');
const router = express.Router();
const {
  getPlans,
  createTransaction,
  handleSepayWebhook,
  getTransactionStatus,
  getTransactionHistory,
  getMyPremium
} = require('../controllers/payments.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public routes
router.get('/plans', getPlans);
router.post('/sepay/webhook', handleSepayWebhook);

// Protected routes
router.use(authenticate);
router.post('/sepay/create', createTransaction);
router.post('/sepay/reconcile-pending', require('../controllers/payments.controller').adminReconcilePending);
router.patch('/:paymentCode/cancel', require('../controllers/payments.controller').cancelTransaction);
router.get('/my-premium', getMyPremium);
router.get('/:orderCode/status', getTransactionStatus);
router.get('/history', getTransactionHistory);

module.exports = router;
