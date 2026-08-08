const { pool } = require('../config/database');
const { notifyUser } = require('./socket.service');
const { hasSystemEmailLog, sendSystemEmail } = require('./email.service');
const { premiumSuccessEmail } = require('./systemEmailTemplates.service');
const axios = require('axios');

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function normalizePaymentText(value) {
  return String(value || '').toUpperCase().trim().replace(/\s+/g, '');
}

function extractPaymentCode(content) {
  const norm = normalizePaymentText(content);
  const match = norm.match(/MF[A-Z0-9]+/);
  return match ? match[0] : null;
}

let cooldownUntil = 0;

async function fetchSepayTransactions(minDateStr = null) {
  const isDev = process.env.NODE_ENV !== 'production';
  const sepayToken = process.env.SEPAY_API_TOKEN;
  if (!sepayToken) {
    if (isDev) console.warn('[SepayService] Missing SEPAY_API_TOKEN. Cannot fetch transactions.');
    return { transactions: [], skipped: false };
  }

  if (Date.now() < cooldownUntil) {
    if (isDev) console.warn('[SepayService] Rate-limit cooldown active. Skipping API call.');
    return { transactions: [], skipped: true, reason: 'cooldown', cooldownUntil };
  }

  const apiVersion = process.env.SEPAY_API_VERSION === 'v2' ? 'v2' : 'v1';
  const endpoint = apiVersion === 'v2' 
    ? 'https://userapi.sepay.vn/v2/transactions' 
    : 'https://my.sepay.vn/userapi/transactions/list';

  const params = { limit: 100 };
  if (minDateStr) {
    params.transaction_date_min = minDateStr;
  }
  if (process.env.SEPAY_ACCOUNT_NUMBER) {
    params.account_number = process.env.SEPAY_ACCOUNT_NUMBER;
  }

  if (isDev) {
    console.log(`[SEPAY_DEBUG] Calling ${endpoint} with params:`, params);
  }

  try {
    const response = await axios.get(endpoint, {
      headers: { 'Authorization': `Bearer ${sepayToken}` },
      params,
      timeout: 10000
    });

    if (isDev) {
      console.log(`[SEPAY_DEBUG] API HTTP Status: ${response.status}`);
      console.log(`[SEPAY_DEBUG] API Response Keys:`, Object.keys(response.data));
    }

    const txs = response.data?.transactions || response.data?.data || response.data?.items || response.data || [];
    if (!Array.isArray(txs)) {
      console.warn('[SepayService] Unknown response format from Sepay API.');
      return { transactions: [], skipped: false };
    }

    if (isDev) {
      console.log(`[SEPAY_DEBUG] Returned ${txs.length} transactions.`);
    }

    return { transactions: txs, skipped: false };
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfterStr = error.response.headers['x-sepay-userapi-retry-after'];
      const retryAfter = retryAfterStr ? parseInt(retryAfterStr, 10) : 60;
      cooldownUntil = Date.now() + retryAfter * 1000;
      console.warn(`[SepayService] 429 Rate Limit. Cooldown until ${new Date(cooldownUntil).toISOString()}`);
      return { transactions: [], skipped: true, reason: 'rate_limited', cooldownUntil };
    }
    console.error(`[SepayService] API Error: ${error.message}`);
    return { transactions: [], skipped: false, reason: 'api_error' };
  }
}

async function fetchSepayTransactionsWithFallback(minDateStr) {
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Lần 1: Có date filter
  let result = await fetchSepayTransactions(minDateStr);
  
  if (result.transactions.length === 0 && !result.skipped) {
    if (isDev) console.log(`[SEPAY_DEBUG] Date filter returned 0 txs. Trying 2nd fetch without date filter...`);
    // Lần 2: Bỏ date filter, giới hạn nhỏ lại
    result = await fetchSepayTransactions(null);
  }
  return result;
}

async function confirmPayment(txId, gatewayData, io, options = { allowRecoverClosed: false, recoverReason: null }) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [txs] = await conn.query(
      `SELECT * FROM payment_transactions WHERE id = ? FOR UPDATE`,
      [txId]
    );

    if (!txs.length) {
      await conn.rollback();
      return { success: false, reason: 'NotFound' };
    }

    const tx = txs[0];

    // Kiểm tra status
    const allowedStatuses = options.allowRecoverClosed ? ['pending', 'cancelled', 'expired'] : ['pending'];
    if (!allowedStatuses.includes(tx.status)) {
      await conn.rollback();
      return { success: false, reason: 'InvalidStatus', tx };
    }

    // Kiểm tra gateway_transaction_id duplicate nếu options.allowRecoverClosed
    const gatewayTxId = gatewayData.reference_number || gatewayData.referenceCode || gatewayData.id || gatewayData.transactionId || null;
    if (gatewayTxId) {
      const [dup] = await conn.query(
        `SELECT id FROM payment_transactions WHERE gateway_transaction_id = ? AND id != ? AND status = 'paid' LIMIT 1`,
        [gatewayTxId, tx.id]
      );
      if (dup.length) {
        await conn.rollback();
        return { success: false, reason: 'GatewayTxIdAlreadyUsed', tx };
      }
    }

    const amountIn = Number.parseFloat(gatewayData.amount_in || gatewayData.transferAmount || gatewayData.amount || 0);
    const txAmount = Number.parseFloat(tx.amount);

    if (amountIn < txAmount) {
      await conn.rollback();
      return { success: false, reason: 'AmountMismatch', tx };
    }
    
    if (amountIn > txAmount) {
      if (process.env.SEPAY_ALLOW_OVERPAY === 'true') {
        console.warn(`[PAYMENT] Overpaid transaction ${tx.payment_code}. Expected ${txAmount}, got ${amountIn}`);
      } else {
        await conn.rollback();
        return { success: false, reason: 'AmountMismatch', tx };
      }
    }

    // Prepare update status string
    let queryConditions = `status = 'pending'`;
    if (options.allowRecoverClosed) {
      queryConditions = `status IN ('pending', 'cancelled', 'expired')`;
    }

    const [updateResult] = await conn.query(
      `UPDATE payment_transactions
       SET status = 'paid',
           paid_at = NOW(),
           gateway_transaction_id = ?,
           raw_payload = ?
       WHERE id = ? AND ${queryConditions}`,
      [gatewayTxId, JSON.stringify(gatewayData), txId]
    );

    if (updateResult.affectedRows === 1) {
      let isRecovered = false;
      if (options.allowRecoverClosed && tx.status !== 'pending') {
        isRecovered = true;
        console.log(`[PAYMENT_RECOVER] Recovered paid gateway transaction from local ${tx.status} status for paymentCode=${tx.payment_code}. Reason: ${options.recoverReason}`);
      }

      const [plans] = await conn.query('SELECT name, duration_days FROM premium_plans WHERE id = ?', [tx.plan_id]);
      const durationDays = plans.length ? Number(plans[0].duration_days) : 0;
      const planName = plans[0]?.name || 'Premium';

      const [[user]] = await conn.query('SELECT email, display_name, premium_expires_at FROM users WHERE id = ? FOR UPDATE', [tx.user_id]);

      const baseDate = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date()
          ? new Date(user.premium_expires_at)
          : new Date();
      const premiumExpiresAt = addDays(baseDate, durationDays);

      await conn.query('UPDATE users SET premium_plan_id = ?, premium_expires_at = ? WHERE id = ?', [tx.plan_id, premiumExpiresAt, tx.user_id]);

      if (tx.subscription_id) {
        await conn.query(
          `UPDATE user_subscriptions SET status = 'active', start_date = COALESCE(start_date, NOW()), end_date = ? WHERE id = ?`,
          [premiumExpiresAt, tx.subscription_id]
        );
      } else {
        await conn.query(
          `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date) VALUES (?, ?, 'active', NOW(), ?)`,
          [tx.user_id, tx.plan_id, premiumExpiresAt]
        );
      }

      tx.status = 'paid';
      tx.paid_at = new Date();
      tx.gateway_transaction_id = gatewayTxId;
      tx.premium_expires_at = premiumExpiresAt;

      if (io) {
        notifyUser(io, tx.user_id, 'payment:success', {
          order_code: tx.payment_code,
          payment_code: tx.payment_code,
          plan_id: tx.plan_id,
          expired_at: premiumExpiresAt,
          premium_expires_at: premiumExpiresAt,
          premium_expired_at: premiumExpiresAt,
          message: isRecovered ? 'Hệ thống đã xác nhận thanh toán bị trễ của bạn. Cảm ơn bạn!' : 'Thanh toán thành công! Tài khoản đã được nâng cấp Premium.',
        });
      }
      
      await conn.commit();

      const alreadyEmailed =
        await hasSystemEmailLog({ type: 'premium_success', metadataKey: 'payment_id', metadataValue: tx.id, status: 'sent' }) ||
        await hasSystemEmailLog({ type: 'premium_success', metadataKey: 'payment_id', metadataValue: tx.id, status: 'skipped' });

      if (!alreadyEmailed && user?.email) {
        const email = premiumSuccessEmail({
          name: user.display_name || user.email,
          planName,
          amount: `${Number(tx.amount).toLocaleString('vi-VN')} VND`,
          orderCode: tx.payment_code,
          premiumExpiresAt,
        });
        await sendSystemEmail({
          to: user.email,
          subject: email.subject,
          type: 'premium_success',
          userId: tx.user_id,
          metadata: {
            payment_id: tx.id,
            order_code: tx.payment_code,
            plan_id: tx.plan_id,
            amount: tx.amount,
            premium_expires_at: premiumExpiresAt,
          },
          text: email.text,
          html: email.html,
        });
      }

      return { success: true, tx, action: isRecovered ? 'recovered' : 'paid' };
    } else {
      await conn.rollback();
      return { success: false, reason: 'ConcurrentUpdate', tx };
    }
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    console.error('[CONFIRM_PAYMENT_ERROR]', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

async function reconcilePendingSepayPayments({ userId = null, hours = 24, includeClosed = false, io = null }) {
  if (!process.env.SEPAY_API_TOKEN) {
    return { error: 'SEPAY_API_TOKEN not configured.' };
  }

  let query = `SELECT id, payment_code, amount, status, created_at, user_id FROM payment_transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`;
  const params = [hours];

  if (includeClosed) {
    query += ` AND status IN ('pending', 'cancelled', 'expired')`;
  } else {
    query += ` AND status = 'pending'`;
  }

  if (userId) {
    query += ` AND user_id = ?`;
    params.push(userId);
  }

  const [localTxs] = await pool.query(query, params);

  if (!localTxs.length) {
    return { processed: 0, results: [] };
  }

  const minTime = Math.min(...localTxs.map(t => new Date(t.created_at || Date.now()).getTime()));
  const minDateStr = new Date(minTime - 30 * 60000).toISOString().replace('T', ' ').slice(0, 19);

  const fetchResult = await fetchSepayTransactionsWithFallback(minDateStr);
  if (fetchResult.skipped) {
    console.log(`[SEPAY_POLLER] Skipping reconcile due to API cooldown/rate limit.`);
    return { processed: 0, results: [], reason: fetchResult.reason };
  }
  const remoteTxs = fetchResult.transactions;
  const reports = [];

  for (const tx of localTxs) {
    const txPaymentCode = normalizePaymentText(tx.payment_code);
    const txAmount = Number.parseFloat(tx.amount);
    let matched = false;

    for (const remote of remoteTxs) {
      const content = normalizePaymentText(remote.transaction_content || remote.description);
      const amountIn = Number.parseFloat(remote.amount_in || remote.transferAmount || remote.amount || 0);

      if (content.includes(txPaymentCode)) {
        if (amountIn === txAmount || (amountIn > txAmount && process.env.SEPAY_ALLOW_OVERPAY === 'true')) {
          matched = true;
          const gatewayTxId = remote.reference_number || remote.referenceCode || remote.id || remote.transactionId;
          const confirmResult = await confirmPayment(tx.id, remote, io, {
            allowRecoverClosed: includeClosed,
            recoverReason: 'Admin/Poller Reconcile matched gateway tx'
          });

          if (confirmResult.success) {
            reports.push({
              paymentCode: tx.payment_code,
              oldStatus: tx.status,
              matchedGatewayTransactionId: gatewayTxId,
              result: confirmResult.action,
              reason: 'Match exact'
            });
          } else {
            reports.push({
              paymentCode: tx.payment_code,
              oldStatus: tx.status,
              matchedGatewayTransactionId: gatewayTxId,
              result: 'skipped',
              reason: confirmResult.reason
            });
          }
          break;
        }
      }
    }

    if (!matched) {
      reports.push({
        paymentCode: tx.payment_code,
        oldStatus: tx.status,
        matchedGatewayTransactionId: null,
        result: 'mismatch',
        reason: 'No remote gateway tx matched.'
      });
    }
  }

  return { processed: localTxs.length, results: reports };
}

module.exports = {
  normalizePaymentText,
  extractPaymentCode,
  confirmPayment,
  fetchSepayTransactionsWithFallback,
  reconcilePendingSepayPayments
};
