const { pool } = require('../config/database');

// Helper to determine if user is currently premium
const getPremiumStatus = (expiresAt) => {
  if (!expiresAt) return 'none';
  const now = new Date();
  const expiry = new Date(expiresAt);
  if (expiry <= now) return 'expired';
  
  // Expiring soon: within 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  if (expiry <= sevenDaysFromNow) return 'expiring_soon';
  
  return 'active';
};

exports.getPremiumSummary = async (req, res, next) => {
  try {
    const [[{ totalPremiumUsers }]] = await pool.query(`
      SELECT COUNT(*) as totalPremiumUsers FROM users WHERE premium_expires_at IS NOT NULL
    `);
    
    const [[{ activePremiumUsers }]] = await pool.query(`
      SELECT COUNT(*) as activePremiumUsers FROM users WHERE premium_expires_at > NOW()
    `);
    
    const [[{ expiringSoonUsers }]] = await pool.query(`
      SELECT COUNT(*) as expiringSoonUsers FROM users 
      WHERE premium_expires_at > NOW() AND premium_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
    `);
    
    const [[{ expiredPremiumUsers }]] = await pool.query(`
      SELECT COUNT(*) as expiredPremiumUsers FROM users 
      WHERE premium_expires_at IS NOT NULL AND premium_expires_at <= NOW()
    `);
    
    const [[{ monthlyPremiumRevenue }]] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as monthlyPremiumRevenue 
      FROM payment_transactions 
      WHERE status = 'paid' AND MONTH(paid_at) = MONTH(CURDATE()) AND YEAR(paid_at) = YEAR(CURDATE())
    `);
    
    const [[{ pendingPremiumTransactions }]] = await pool.query(`
      SELECT COUNT(*) as pendingPremiumTransactions 
      FROM payment_transactions 
      WHERE status = 'pending'
    `);

    res.json({
      success: true,
      data: {
        totalPremiumUsers: Number(totalPremiumUsers || 0),
        activePremiumUsers: Number(activePremiumUsers || 0),
        expiringSoonUsers: Number(expiringSoonUsers || 0),
        expiredPremiumUsers: Number(expiredPremiumUsers || 0),
        monthlyPremiumRevenue: Number(monthlyPremiumRevenue || 0),
        pendingPremiumTransactions: Number(pendingPremiumTransactions || 0)
      }
    });
  } catch (error) {
    console.error('getPremiumSummary Error:', error);
    next(error);
  }
};

exports.getPremiumUsers = async (req, res, next) => {
  try {
    const { q = '', status = '', plan = '', expiresFrom = '', expiresTo = '', sort = '' } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    const params = [];
    
    if (q) {
      whereClause += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.id = ?)';
      params.push(`%${q}%`, `%${q}%`, q);
    }
    
    if (plan && plan !== 'Tất cả') {
      whereClause += ' AND p.name = ?';
      params.push(plan);
    }
    
    const statusVal = status || 'Tất cả Premium';
    if (statusVal === 'Tất cả Premium') {
      whereClause += " AND (u.premium_expires_at IS NOT NULL OR EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid'))";
    } else if (statusVal === 'Đang hoạt động') {
      whereClause += ' AND u.premium_expires_at > NOW()';
    } else if (statusVal === 'Sắp hết hạn') {
      whereClause += ' AND u.premium_expires_at > NOW() AND u.premium_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)';
    } else if (statusVal === 'Đã hết hạn') {
      whereClause += ' AND (u.premium_expires_at IS NOT NULL AND u.premium_expires_at <= NOW())';
    } else if (statusVal === 'Chưa Premium') {
      whereClause += " AND u.premium_expires_at IS NULL AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid')";
    }
    
    if (expiresFrom) {
      whereClause += ' AND u.premium_expires_at >= ?';
      params.push(expiresFrom);
    }
    
    if (expiresTo) {
      whereClause += ' AND DATE(u.premium_expires_at) <= ?';
      params.push(expiresTo);
    }
    
    let orderClause = 'ORDER BY u.created_at DESC';
    if (sort === 'Hết hạn gần nhất') {
      orderClause = 'ORDER BY CASE WHEN u.premium_expires_at > NOW() THEN 0 ELSE 1 END, u.premium_expires_at ASC, u.id DESC';
    } else if (sort === 'Mới nâng cấp gần đây') {
      orderClause = 'ORDER BY (SELECT MAX(paid_at) FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = "paid") DESC, u.id DESC';
    } else if (sort === 'Chi tiêu cao nhất') {
      orderClause = 'ORDER BY (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = "paid") DESC, u.id DESC';
    } else if (sort === 'Tên A-Z') {
      orderClause = 'ORDER BY u.display_name ASC, u.id DESC';
    }

    const countQuery = `
      SELECT COUNT(u.id) as total
      FROM users u
      LEFT JOIN premium_plans p ON u.premium_plan_id = p.id
      WHERE ${whereClause}
    `;
    const [[{ total }]] = await pool.query(countQuery, params);
    
    const listQuery = `
      SELECT 
        u.id as user_id, 
        u.display_name as name, 
        u.email, 
        u.avatar_url, 
        u.premium_plan_id as plan_id, 
        p.name as plan_name, 
        u.premium_expires_at,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid') as total_spent,
        (SELECT payment_code FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid' ORDER BY paid_at DESC LIMIT 1) as last_transaction_code,
        (SELECT paid_at FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid' ORDER BY paid_at DESC LIMIT 1) as last_paid_at,
        (SELECT start_date FROM user_subscriptions us WHERE us.user_id = u.id ORDER BY start_date DESC LIMIT 1) as premium_started_at
      FROM users u
      LEFT JOIN premium_plans p ON u.premium_plan_id = p.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;
    
    const listParams = [...params, limit, offset];
    const [rows] = await pool.query(listQuery, listParams);
    
    const items = rows.map(r => {
      let daysRemaining = null;
      if (r.premium_expires_at) {
        const diffTime = new Date(r.premium_expires_at) - new Date();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      return {
        user_id: r.user_id,
        name: r.name,
        email: r.email,
        avatar_url: r.avatar_url,
        plan_id: r.plan_id,
        plan_name: r.plan_name || '—',
        premium_status: getPremiumStatus(r.premium_expires_at),
        premium_started_at: r.premium_started_at,
        premium_expires_at: r.premium_expires_at,
        days_remaining: daysRemaining,
        total_spent: r.total_spent || 0,
        last_transaction_code: r.last_transaction_code,
        last_paid_at: r.last_paid_at
      };
    });

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('getPremiumUsers Error:', error);
    next(error);
  }
};

exports.getPremiumPlans = async (req, res, next) => {
  try {
    const [plans] = await pool.query(`
      SELECT id, name, description, price, duration_days as duration_months, features 
      FROM premium_plans 
      WHERE is_active = 1
      ORDER BY price ASC
    `);
    
    // Convert duration_days to duration_months for backward compatibility if needed
    const mapped = plans.map(p => ({
      ...p,
      duration_months: Math.max(1, Math.round(p.duration_months / 30))
    }));

    res.json({
      success: true,
      data: mapped
    });
  } catch (error) {
    console.error('getPremiumPlans Error:', error);
    next(error);
  }
};

exports.updatePremium = async (req, res, next) => {
  let conn;
  try {
    const userId = req.params.id;
    const { planId, expiresAt, note } = req.body;
    
    if (!planId) {
      return res.status(400).json({ success: false, message: 'Thiếu planId' });
    }
    if (!expiresAt) {
      return res.status(400).json({ success: false, message: 'Thiếu expiresAt' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT id, premium_plan_id, premium_expires_at FROM users WHERE id = ?', [userId]);
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    const [[plan]] = await conn.query('SELECT id, name FROM premium_plans WHERE id = ?', [planId]);
    if (!plan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Gói Premium không tồn tại' });
    }

    // Optional: Log admin action (if audit log table existed, we would insert it here. But there is no audit log table in musicflow_schema.sql. If it exists somewhere else, we could log it. I will skip inserting to audit log if table doesn't exist, but we can log to console).
    console.log(`[ADMIN AUDIT] User ID: ${req.user?.id || 'admin'} updated premium for User ID: ${userId}. Old plan: ${user.premium_plan_id}, New plan: ${planId}, Note: ${note}`);

    // Update users table
    await conn.query(`
      UPDATE users 
      SET premium_plan_id = ?, premium_expires_at = ?
      WHERE id = ?
    `, [planId, expiresAt, userId]);

    // Upsert subscription (if any active, close it and open a new one, or just extend)
    const [[activeSub]] = await conn.query(`
      SELECT id FROM user_subscriptions 
      WHERE user_id = ? AND status = 'active'
      ORDER BY start_date DESC LIMIT 1
    `, [userId]);

    if (activeSub) {
      await conn.query(`
        UPDATE user_subscriptions 
        SET end_date = ?, plan_id = ?
        WHERE id = ?
      `, [expiresAt, planId, activeSub.id]);
    } else {
      await conn.query(`
        INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date) 
        VALUES (?, ?, 'active', NOW(), ?)
      `, [userId, planId, expiresAt]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Cập nhật Premium thành công' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('updatePremium Error:', error);
    next(error);
  } finally {
    if (conn) conn.release();
  }
};

exports.cancelPremium = async (req, res, next) => {
  let conn;
  try {
    const userId = req.params.id;
    const { note } = req.body;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT id, premium_expires_at FROM users WHERE id = ?', [userId]);
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    console.log(`[ADMIN AUDIT] User ID: ${req.user?.id || 'admin'} cancelled premium for User ID: ${userId}. Note: ${note}`);

    // Set expiration to NOW() to effectively cancel it without deleting history
    await conn.query(`
      UPDATE users 
      SET premium_expires_at = NOW()
      WHERE id = ?
    `, [userId]);

    // Update active subscriptions to expired
    await conn.query(`
      UPDATE user_subscriptions 
      SET status = 'expired', end_date = NOW()
      WHERE user_id = ? AND status = 'active'
    `, [userId]);

    await conn.commit();
    res.json({ success: true, message: 'Hủy Premium thành công' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('cancelPremium Error:', error);
    next(error);
  } finally {
    if (conn) conn.release();
  }
};
