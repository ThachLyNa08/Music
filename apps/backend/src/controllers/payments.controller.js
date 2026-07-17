const crypto = require('crypto');
const { pool } = require('../config/database');
const { notifyUser } = require('../services/socket.service');
const { extractPaymentCode, confirmPayment, reconcilePendingSepayPayments } = require('../services/payment.service');

const lastFallbackCheck = new Map();
const activePaymentCodes = new Map();

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toApiStatus(status) {
  return String(status || '').toUpperCase();
}

function getWebhookToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.headers['x-api-key'] || req.headers['x-sepay-api-key'] || authHeader;
}

function normalizeProvider(value) {
  const provider = String(value || 'sepay').toLowerCase();
  return ['sepay', 'vnpay', 'momo', 'manual'].includes(provider) ? provider : 'manual';
}

exports.getPlans = async (_req, res) => {
  try {
    const [plans] = await pool.query(
      `SELECT id, name, description, price, duration_days, features, is_active
       FROM premium_plans
       WHERE is_active = 1
       ORDER BY price ASC`
    );
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('[PAYMENT_GET_PLANS_ERROR]', error);
    res.status(500).json({
      success: false,
      message: 'Khong the tai danh sach goi Premium',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.fixPrices = async (req, res) => {
  try {
    await pool.query("UPDATE premium_plans SET price = 2000 WHERE duration_days = 30");
    await pool.query("UPDATE premium_plans SET price = 5000 WHERE duration_days = 90");
    await pool.query("UPDATE premium_plans SET price = 9000 WHERE duration_days = 365");
    const [plans] = await pool.query("SELECT id, name, duration_days, price FROM premium_plans");
    res.json({ success: true, message: "Prices fixed", data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.simulatePayment = async (req, res, next) => {
  req.body = {
    transferAmount: 99999999, // bypass amount mismatch
    content: req.params.paymentCode,
    referenceCode: 'SIMULATE_' + Date.now()
  };
  req.headers.authorization = 'Bearer ' + process.env.SEPAY_WEBHOOK_SECRET;
  return exports.handleSepayWebhook(req, res);
};

exports.createTransaction = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({ success: false, message: 'plan_id is required' });
    }

    const [plans] = await conn.query(
      'SELECT id, name, duration_days, price FROM premium_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );
    if (!plans.length) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }
    const plan = plans[0];

    const bankBin = (process.env.SEPAY_BANK_BIN || '').trim();
    const bankAccount = (process.env.SEPAY_BANK_ACCOUNT || '').trim();
    const accountName = (process.env.SEPAY_ACCOUNT_NAME || '').trim();

    if (!bankBin || !bankAccount) {
      return res.status(500).json({
        success: false,
        code: 'PAYMENT_CONFIG_MISSING',
        message: 'Server configuration error: missing bank details',
      });
    }

    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    const paymentCode = `MF${userId}${timestamp}${randomStr}`.slice(0, 32);
    const amount = Number(plan.price);
    const qrContent = paymentCode;
    const qrCodeUrl =
      `https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.png` +
      `?amount=${amount}&addInfo=${encodeURIComponent(qrContent)}` +
      `&accountName=${encodeURIComponent(accountName)}`;

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await conn.beginTransaction();

    const [subscriptionResult] = await conn.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
       VALUES (?, ?, 'pending', NULL, NULL)`,
      [userId, plan.id]
    );

    await conn.query(
      `INSERT INTO payment_transactions (
         user_id, plan_id, subscription_id, amount, currency, provider,
         payment_code, qr_content, qr_code_url, status, expires_at
       )
       VALUES (?, ?, ?, ?, 'VND', 'sepay', ?, ?, ?, 'pending', ?)`,
      [userId, plan.id, subscriptionResult.insertId, amount, paymentCode, qrContent, qrCodeUrl, expiresAt]
    );

    await conn.commit();
    
    // Mark as active for fast scanning
    activePaymentCodes.set(paymentCode, Date.now());

    res.json({
      success: true,
      data: {
        order_code: paymentCode,
        payment_code: paymentCode,
        amount,
        transfer_content: qrContent,
        qr_content: qrContent,
        qr_code_url: qrCodeUrl,
        expired_at: expiresAt,
        expires_at: expiresAt,
      },
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    next(error);
  } finally {
    conn.release();
  }
};

exports.cancelTransaction = async (req, res, next) => {
  let conn;
  try {
    const { paymentCode } = req.params;
    const userId = req.user.id;
    
    conn = await pool.getConnection();
    await conn.beginTransaction();
    
    const [txs] = await conn.query(
      `SELECT id, status FROM payment_transactions WHERE payment_code = ? AND user_id = ? FOR UPDATE`,
      [paymentCode, userId]
    );
    
    if (!txs.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    
    const tx = txs[0];
    if (tx.status === 'paid' || tx.status === 'success' || tx.status === 'completed') {
      await conn.rollback();
      return res.json({ success: false, message: 'Cannot cancel a paid transaction' });
    }
    
    if (tx.status !== 'pending') {
      await conn.rollback();
      return res.json({ success: true, message: 'Transaction is already ' + tx.status });
    }
    
    await conn.query(
      `UPDATE payment_transactions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?`,
      [tx.id]
    );
    
    await conn.commit();
    res.json({ success: true, message: 'Transaction cancelled successfully' });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

exports.handleSepayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
    const receivedToken = getWebhookToken(req);

    if (webhookSecret && receivedToken !== webhookSecret) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }

    const payload = req.body || {};

    if (payload.transferType === 'out' || payload.gateway === 'sepay_out') {
      return res.json({ success: true, message: 'Ignored outgoing transaction' });
    }

    const paymentCode = extractPaymentCode(payload.content || payload.description);

    if (!paymentCode) {
      return res.json({ success: true, message: 'No valid payment code found in content' });
    }

    const [txs] = await pool.query(
      `SELECT id FROM payment_transactions WHERE payment_code = ?`,
      [paymentCode]
    );

    if (!txs.length) {
      return res.json({ success: true, message: 'Transaction not found' });
    }

    const txId = txs[0].id;
    const io = req.app.get('io');
    const result = await confirmPayment(txId, payload, io, { allowRecoverClosed: false });
    
    if (!result.success) {
       return res.json({ success: true, message: 'Amount mismatch or not processed: ' + result.reason });
    }

    res.json({ success: true, message: 'Payment processed successfully' });
  } catch (error) {
    console.error('[SEPAY_WEBHOOK_ERROR]', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getTransactionStatus = async (req, res, next) => {
  try {
    const { orderCode } = req.params;
    const userId = req.user.id;

    const [txs] = await pool.query(
      `SELECT
         pt.id,
         pt.payment_code,
         pt.amount,
         pt.status,
         pt.paid_at,
         pt.expires_at,
         pt.created_at,
         u.premium_expires_at
       FROM payment_transactions pt
       JOIN users u ON u.id = pt.user_id
       WHERE pt.payment_code = ? AND pt.user_id = ?
       LIMIT 1`,
      [orderCode, userId]
    );

    if (!txs.length) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    let tx = txs[0];
    
    // Check fallback if pending
    if (tx.status === 'pending') {
      const now = Date.now();
      
      const activeTime = activePaymentCodes.get(orderCode);
      const activeWindowMs = parseInt(process.env.SEPAY_ACTIVE_CHECK_WINDOW_MS || '120000', 10);
      const isActive = activeTime && (now - activeTime < activeWindowMs);
      
      const checkIntervalMs = isActive 
        ? parseInt(process.env.SEPAY_ACTIVE_CHECK_INTERVAL_MS || '5000', 10) 
        : 10000;
        
      if (!isActive && activeTime) {
        activePaymentCodes.delete(orderCode); // cleanup
      }

      const lastCheck = lastFallbackCheck.get(orderCode) || 0;
      if (now - lastCheck >= checkIntervalMs) {
        lastFallbackCheck.set(orderCode, now);
        const io = req.app.get('io');
        // Only reconcile for the current user to be fast and safe
        await reconcilePendingSepayPayments({ userId, hours: 24, includeClosed: false, io });
        
        const [updatedTxs] = await pool.query(`SELECT status, paid_at, expires_at FROM payment_transactions WHERE id = ?`, [tx.id]);
        if (updatedTxs.length) {
           tx.status = updatedTxs[0].status;
           tx.paid_at = updatedTxs[0].paid_at;
           tx.expires_at = updatedTxs[0].expires_at;
           
           if (tx.status !== 'pending') {
             activePaymentCodes.delete(orderCode);
           }
        }
      }
    }

    // Compute expired
    if (tx.status === 'pending' && tx.expires_at && new Date() > new Date(tx.expires_at)) {
      tx.status = 'expired';
      // Update asynchronously without awaiting
      pool.query(`UPDATE payment_transactions SET status = 'expired' WHERE id = ?`, [tx.id]).catch(console.error);
    }

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    res.json({
      success: true,
      data: {
        order_code: tx.payment_code,
        payment_code: tx.payment_code,
        status: toApiStatus(tx.status),
        paid_at: tx.paid_at,
        expired_at: tx.expires_at,
        expires_at: tx.expires_at,
        premium_expires_at: tx.premium_expires_at,
        premium_expired_at: tx.premium_expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [txs] = await pool.query(
      `SELECT
         pt.id,
         pt.payment_code AS order_code,
         pt.payment_code,
         pt.amount,
         pt.currency,
         pt.provider,
         UPPER(pt.status) AS status,
         pt.created_at,
         pt.paid_at,
         pt.expires_at,
         pt.cancelled_at,
         p.name AS plan_name
       FROM payment_transactions pt
       LEFT JOIN premium_plans p ON pt.plan_id = p.id
       WHERE pt.user_id = ?
       ORDER BY pt.created_at DESC`,
      [userId]
    );

    const now = new Date();
    txs.forEach(tx => {
      if (tx.status === 'PENDING' && tx.expires_at && new Date(tx.expires_at) < now) {
        tx.status = 'EXPIRED';
        pool.query(`UPDATE payment_transactions SET status = 'expired' WHERE id = ?`, [tx.id]).catch(console.error);
      }
    });

    res.json({ success: true, data: txs });
  } catch (error) {
    next(error);
  }
};

exports.getMyPremium = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [[user]] = await pool.query(
      `SELECT premium_plan_id, premium_expires_at FROM users WHERE id = ?`,
      [userId]
    );

    const isPremium = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();

    if (!isPremium) {
      return res.json({ success: true, data: { isPremium: false } });
    }

    let plan = null;
    if (user.premium_plan_id) {
      const [[foundPlan]] = await pool.query(
        `SELECT id, name, duration_days, price FROM premium_plans WHERE id = ?`,
        [user.premium_plan_id]
      );
      plan = foundPlan || null;
    }

    const [txs] = await pool.query(
      `SELECT payment_code AS transactionCode, amount, provider, paid_at AS paidAt, status 
       FROM payment_transactions 
       WHERE user_id = ? AND status IN ('paid', 'success', 'completed')
       ORDER BY paid_at DESC LIMIT 1`,
       [userId]
    );

    const [[sub]] = await pool.query(
      `SELECT start_date FROM user_subscriptions WHERE user_id = ? AND status = 'active' ORDER BY start_date DESC LIMIT 1`,
      [userId]
    );

    const startedAt = sub ? sub.start_date : null;
    const expiresAt = user.premium_expires_at;
    const daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
    const source = txs.length > 0 ? 'payment' : 'admin';

    res.json({
      success: true,
      data: {
        isPremium: true,
        status: 'active',
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          durationDays: plan.duration_days,
          price: plan.price
        } : null,
        startedAt,
        expiresAt,
        daysRemaining,
        lastPayment: txs[0] || null,
        source,
        benefits: [
          "Nghe nhạc chất lượng cao",
          "Tạo AI Playlist không giới hạn mỗi ngày",
          "Tải instrumental sau khi tách giọng",
          "Ưu tiên xử lý Stem Separation/Karaoke AI",
          "Không giới hạn số playlist cá nhân",
          "Trải nghiệm không quảng cáo",
          "Huy hiệu Premium trên hồ sơ"
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.adminReconcilePending = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const { userId, hours = 24, includeClosed = false } = req.body;
    
    if (includeClosed) {
      console.log(`[AUDIT_LOG] Admin ${req.user.id} (${req.user.email}) requested reconcile with includeClosed=true. This can recover expired/cancelled transactions to paid.`);
    }
    const io = req.app.get('io');
    
    const result = await reconcilePendingSepayPayments({
      userId,
      hours: Number(hours),
      includeClosed: Boolean(includeClosed),
      io
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
