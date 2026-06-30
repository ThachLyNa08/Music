// apps/backend/src/controllers/admin_payments.controller.js
const { pool } = require('../config/database');

exports.getPaymentSummary = async (req, res, next) => {
  try {
    const { q, status, gateway, plan, userId, dateFrom, dateTo } = req.query;

    let conditions = ['1 = 1'];
    let params = [];

    if (q) {
      conditions.push('(t.payment_code LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)');
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (status) {
      conditions.push('t.status = ?');
      params.push(status.toLowerCase());
    }
    
    if (gateway) {
      conditions.push('t.provider = ?');
      params.push(gateway);
    }
    
    if (plan) {
      conditions.push('p.name = ?');
      params.push(plan);
    }
    
    if (userId) {
      conditions.push('t.user_id = ?');
      params.push(userId);
    }
    
    if (dateFrom) {
      conditions.push('t.created_at >= ?');
      params.push(dateFrom + ' 00:00:00');
    }
    
    if (dateTo) {
      conditions.push('t.created_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    const whereClause = conditions.join(' AND ');

    // Aggregate summary
    const summaryQuery = `
      SELECT 
        COUNT(t.id) as totalTransactions,
        SUM(CASE WHEN t.status IN ('paid', 'success', 'completed') THEN 1 ELSE 0 END) as paidTransactions,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pendingTransactions,
        SUM(CASE WHEN t.status = 'expired' THEN 1 ELSE 0 END) as expiredTransactions,
        SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END) as cancelledTransactions,
        SUM(CASE WHEN t.status IN ('paid', 'success', 'completed') THEN t.amount ELSE 0 END) as totalRevenue
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      JOIN premium_plans p ON t.plan_id = p.id
      WHERE ${whereClause}
    `;

    const [rows] = await pool.query(summaryQuery, params);
    const row = rows[0] || {};
    
    const totalTransactions = Number(row.totalTransactions) || 0;
    const paidTransactions = Number(row.paidTransactions) || 0;
    const pendingTransactions = Number(row.pendingTransactions) || 0;
    const expiredTransactions = Number(row.expiredTransactions) || 0;
    const cancelledTransactions = Number(row.cancelledTransactions) || 0;
    const totalRevenue = Number(row.totalRevenue) || 0;
    const successRate = totalTransactions > 0 ? ((paidTransactions / totalTransactions) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalTransactions,
        paidTransactions,
        pendingTransactions,
        expiredTransactions,
        cancelledTransactions,
        totalRevenue,
        successRate: parseFloat(successRate)
      }
    });
  } catch (error) {
    console.error('getPaymentSummary Error:', error);
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { q, status, gateway, plan, userId, dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let conditions = ['1 = 1'];
    let params = [];

    if (q) {
      conditions.push('(t.payment_code LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)');
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (status) {
      conditions.push('t.status = ?');
      params.push(status.toLowerCase());
    }
    
    if (gateway) {
      conditions.push('t.provider = ?');
      params.push(gateway);
    }
    
    if (plan) {
      conditions.push('p.name = ?');
      params.push(plan);
    }
    
    if (userId) {
      conditions.push('t.user_id = ?');
      params.push(userId);
    }
    
    if (dateFrom) {
      conditions.push('t.created_at >= ?');
      params.push(dateFrom + ' 00:00:00');
    }
    
    if (dateTo) {
      conditions.push('t.created_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    const whereClause = conditions.join(' AND ');

    // 1. Get count
    const countQuery = `
      SELECT COUNT(t.id) as total
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      JOIN premium_plans p ON t.plan_id = p.id
      WHERE ${whereClause}
    `;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    // 2. Get rows
    const listQuery = `
      SELECT 
        t.id, 
        t.payment_code AS order_code, 
        t.payment_code, 
        t.amount, 
        t.provider,
        LOWER(t.status) AS status, 
        t.paid_at, 
        t.created_at,
        u.id as user_id,
        u.display_name as user_name, 
        u.email as user_email,
        p.name as plan_name
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      JOIN premium_plans p ON t.plan_id = p.id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const listParams = [...params, limit, offset];
    const [rows] = await pool.query(listQuery, listParams);

    res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('getPayments Error:', error);
    next(error);
  }
};

exports.getPaymentDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        t.id, 
        t.payment_code, 
        t.amount, 
        t.provider,
        LOWER(t.status) as status, 
        t.created_at, 
        t.paid_at, 
        t.expires_at, 
        t.cancelled_at,
        t.qr_content,
        u.id as user_id,
        u.display_name as user_name, 
        u.email as user_email,
        u.avatar_url,
        p.name as plan_name,
        p.duration_days
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      JOIN premium_plans p ON t.plan_id = p.id
      WHERE t.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại' });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('getPaymentDetail Error:', error);
    next(error);
  }
};

exports.cancelPayment = async (req, res, next) => {
  let conn;
  try {
    const { id } = req.params;
    
    conn = await pool.getConnection();
    await conn.beginTransaction();
    
    const [txs] = await conn.query(
      `SELECT id, status FROM payment_transactions WHERE id = ? FOR UPDATE`,
      [id]
    );
    
    if (!txs.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại' });
    }
    
    const tx = txs[0];
    
    if (tx.status === 'paid' || tx.status === 'success' || tx.status === 'completed') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Không thể hủy giao dịch đã thanh toán' });
    }
    
    if (tx.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Giao dịch này không ở trạng thái chờ' });
    }
    
    await conn.query(
      `UPDATE payment_transactions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?`,
      [tx.id]
    );
    
    await conn.commit();
    res.json({ success: true, message: 'Đã hủy giao dịch thành công' });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    console.error('cancelPayment Error:', err);
    next(err);
  } finally {
    if (conn) conn.release();
  }
};
