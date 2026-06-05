const crypto = require('crypto');
const { pool } = require('../config/database');
const { notifyUser } = require('../services/socket.service');

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

    const bankBin = process.env.SEPAY_BANK_BIN;
    const bankAccount = process.env.SEPAY_BANK_ACCOUNT;
    const accountName = process.env.SEPAY_ACCOUNT_NAME || '';

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

exports.handleSepayWebhook = async (req, res) => {
  let conn;
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

    const transferAmount = Number.parseFloat(payload.transferAmount || payload.amount || 0);
    const content = String(payload.content || payload.description || '').toUpperCase();
    const referenceCode = payload.referenceCode || payload.id || payload.transactionId || null;
    const match = content.match(/MF[A-Z0-9]+/);

    if (!match) {
      return res.json({ success: true, message: 'No valid payment code found in content' });
    }

    const paymentCode = match[0];
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [txs] = await conn.query(
      `SELECT *
       FROM payment_transactions
       WHERE payment_code = ?
       FOR UPDATE`,
      [paymentCode]
    );

    if (!txs.length) {
      await conn.rollback();
      return res.json({ success: true, message: 'Transaction not found' });
    }

    const tx = txs[0];

    if (tx.status === 'paid') {
      await conn.rollback();
      return res.json({ success: true, message: 'Transaction already paid' });
    }

    if (tx.status !== 'pending') {
      await conn.rollback();
      return res.json({ success: true, message: 'Transaction not pending' });
    }

    if (tx.expires_at && new Date() > new Date(tx.expires_at)) {
      await conn.query(
        `UPDATE payment_transactions
         SET status = 'expired', raw_payload = ?
         WHERE id = ?`,
        [JSON.stringify(payload), tx.id]
      );
      if (tx.subscription_id) {
        await conn.query(
          "UPDATE user_subscriptions SET status = 'expired' WHERE id = ?",
          [tx.subscription_id]
        );
      }
      await conn.commit();
      return res.json({ success: true, message: 'Transaction expired' });
    }

    if (transferAmount < Number(tx.amount)) {
      await conn.query(
        'UPDATE payment_transactions SET raw_payload = ? WHERE id = ?',
        [JSON.stringify(payload), tx.id]
      );
      await conn.commit();
      return res.json({ success: true, message: 'Amount mismatch' });
    }

    const [plans] = await conn.query(
      'SELECT duration_days FROM premium_plans WHERE id = ?',
      [tx.plan_id]
    );
    if (!plans.length) {
      throw new Error(`Premium plan not found for transaction ${tx.id}`);
    }

    const [[user]] = await conn.query(
      'SELECT premium_expires_at FROM users WHERE id = ? FOR UPDATE',
      [tx.user_id]
    );

    const baseDate =
      user?.premium_expires_at && new Date(user.premium_expires_at) > new Date()
        ? new Date(user.premium_expires_at)
        : new Date();
    const premiumExpiresAt = addDays(baseDate, Number(plans[0].duration_days));

    await conn.query(
      `UPDATE payment_transactions
       SET status = 'paid',
           paid_at = NOW(),
           gateway_transaction_id = ?,
           raw_payload = ?
       WHERE id = ?`,
      [referenceCode, JSON.stringify(payload), tx.id]
    );

    await conn.query(
      'UPDATE users SET premium_plan_id = ?, premium_expires_at = ? WHERE id = ?',
      [tx.plan_id, premiumExpiresAt, tx.user_id]
    );

    if (tx.subscription_id) {
      await conn.query(
        `UPDATE user_subscriptions
         SET status = 'active', start_date = COALESCE(start_date, NOW()), end_date = ?
         WHERE id = ?`,
        [premiumExpiresAt, tx.subscription_id]
      );
    } else {
      await conn.query(
        `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
         VALUES (?, ?, 'active', NOW(), ?)`,
        [tx.user_id, tx.plan_id, premiumExpiresAt]
      );
    }

    await conn.commit();

    notifyUser(req.app.get('io'), tx.user_id, 'payment:success', {
      order_code: paymentCode,
      payment_code: paymentCode,
      plan_id: tx.plan_id,
      expired_at: premiumExpiresAt,
      premium_expires_at: premiumExpiresAt,
      premium_expired_at: premiumExpiresAt,
      message: 'Thanh toan thanh cong. Tai khoan da duoc nang cap Premium.',
    });

    res.json({ success: true, message: 'Payment processed successfully' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error('[SEPAY_WEBHOOK_ERROR]', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getTransactionStatus = async (req, res, next) => {
  try {
    const { orderCode } = req.params;
    const userId = req.user.id;

    const [txs] = await pool.query(
      `SELECT
         pt.payment_code,
         pt.status,
         pt.paid_at,
         pt.expires_at,
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

    const tx = txs[0];
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
         pt.payment_code AS order_code,
         pt.payment_code,
         pt.amount,
         pt.currency,
         pt.provider,
         UPPER(pt.status) AS status,
         pt.created_at,
         pt.paid_at,
         pt.expires_at,
         p.name AS plan_name
       FROM payment_transactions pt
       JOIN premium_plans p ON pt.plan_id = p.id
       WHERE pt.user_id = ?
       ORDER BY pt.created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: txs });
  } catch (error) {
    next(error);
  }
};
