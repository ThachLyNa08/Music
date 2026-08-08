const { pool } = require('../config/database');
const { jsonToCsv, createCsvFilename, sendCsv } = require('../utils/csv.util');

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

    const [[{ lastMonthPremiumRevenue }]] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as lastMonthPremiumRevenue
      FROM payment_transactions
      WHERE status = 'paid'
      AND MONTH(paid_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
      AND YEAR(paid_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);

    const [[{ usersAddedThisMonth }]] = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as usersAddedThisMonth
      FROM payment_transactions
      WHERE status = 'paid'
      AND MONTH(paid_at) = MONTH(CURDATE()) AND YEAR(paid_at) = YEAR(CURDATE())
    `);

    const [[{ usersAddedLastMonth }]] = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as usersAddedLastMonth
      FROM payment_transactions
      WHERE status = 'paid'
      AND MONTH(paid_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
      AND YEAR(paid_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);

    const [[{ pendingPremiumTransactions }]] = await pool.query(`
      SELECT COUNT(*) as pendingPremiumTransactions
      FROM payment_transactions
      WHERE status = 'pending'
    `);

    const [planDistribution] = await pool.query(`
      SELECT
        p.id, p.name, p.price, p.duration_days,
        COUNT(u.id) as user_count
      FROM premium_plans p
      LEFT JOIN users u ON u.premium_plan_id = p.id AND u.premium_expires_at > NOW()
      GROUP BY p.id, p.name, p.price, p.duration_days
      ORDER BY p.duration_days ASC
    `);

    const [expiringTimeline] = await pool.query(`
      SELECT
        u.id, u.display_name, u.email, u.avatar_url,
        u.premium_expires_at, p.name as plan_name,
        EXISTS(SELECT 1 FROM premium_reminder_logs prl WHERE prl.user_id = u.id AND prl.subscription_end_date = u.premium_expires_at AND prl.reminder_type = 'auto_7d') as autoReminderSent,
        EXISTS(SELECT 1 FROM premium_reminder_logs prl WHERE prl.user_id = u.id AND prl.subscription_end_date = u.premium_expires_at AND prl.reminder_type = 'manual_admin') as manualReminderSent
      FROM users u
      LEFT JOIN premium_plans p ON u.premium_plan_id = p.id
      WHERE u.premium_expires_at > NOW() AND u.premium_expires_at <= DATE_ADD(NOW(), INTERVAL 90 DAY)
      ORDER BY u.premium_expires_at ASC
      LIMIT 15
    `);

    res.json({
      success: true,
      data: {
        totalPremiumUsers: Number(totalPremiumUsers || 0),
        activePremiumUsers: Number(activePremiumUsers || 0),
        expiringSoonUsers: Number(expiringSoonUsers || 0),
        expiredPremiumUsers: Number(expiredPremiumUsers || 0),
        monthlyPremiumRevenue: Number(monthlyPremiumRevenue || 0),
        lastMonthPremiumRevenue: Number(lastMonthPremiumRevenue || 0),
        usersAddedThisMonth: Number(usersAddedThisMonth || 0),
        usersAddedLastMonth: Number(usersAddedLastMonth || 0),
        pendingPremiumTransactions: Number(pendingPremiumTransactions || 0),
        planDistribution,
        expiringTimeline
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

    let whereClause = "u.role != 'artist'";
    const params = [];

    if (q) {
      whereClause += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.id = ?)';
      params.push(`%${q}%`, `%${q}%`, q);
    }

    if (plan && plan !== 'Táº¥t cáº£') {
      whereClause += ' AND p.name = ?';
      params.push(plan);
    }

    const statusVal = status || 'Táº¥t cáº£ Premium';
    if (statusVal === 'Táº¥t cáº£ Premium') {
      whereClause += " AND (u.premium_expires_at IS NOT NULL OR EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid'))";
    } else if (statusVal === 'Äang hoáº¡t Ä‘á»™ng') {
      whereClause += ' AND u.premium_expires_at > NOW()';
    } else if (statusVal === 'Sáº¯p háº¿t háº¡n') {
      whereClause += ' AND u.premium_expires_at > NOW() AND u.premium_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)';
    } else if (statusVal === 'ÄĂ£ háº¿t háº¡n') {
      whereClause += ' AND (u.premium_expires_at IS NOT NULL AND u.premium_expires_at <= NOW())';
    } else if (statusVal === 'ChÆ°a Premium') {
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
    if (sort === 'Háº¿t háº¡n gáº§n nháº¥t') {
      orderClause = 'ORDER BY CASE WHEN u.premium_expires_at > NOW() THEN 0 ELSE 1 END, u.premium_expires_at ASC, u.id DESC';
    } else if (sort === 'Má»›i nĂ¢ng cáº¥p gáº§n Ä‘Ă¢y') {
      orderClause = 'ORDER BY (SELECT MAX(paid_at) FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = "paid") DESC, u.id DESC';
    } else if (sort === 'Chi tiĂªu cao nháº¥t') {
      orderClause = 'ORDER BY (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = "paid") DESC, u.id DESC';
    } else if (sort === 'TĂªn A-Z') {
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
        plan_name: r.plan_name || 'â€”',
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
      return res.status(400).json({ success: false, message: 'Thiáº¿u planId' });
    }
    if (!expiresAt) {
      return res.status(400).json({ success: false, message: 'Thiáº¿u expiresAt' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT id, premium_plan_id, premium_expires_at FROM users WHERE id = ?', [userId]);
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'NgÆ°á»i dĂ¹ng khĂ´ng tá»“n táº¡i' });
    }

    const [[plan]] = await conn.query('SELECT id, name FROM premium_plans WHERE id = ?', [planId]);
    if (!plan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'GĂ³i Premium khĂ´ng tá»“n táº¡i' });
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
    res.json({ success: true, message: 'Cáº­p nháº­t Premium thĂ nh cĂ´ng' });
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
      return res.status(404).json({ success: false, message: 'NgÆ°á»i dĂ¹ng khĂ´ng tá»“n táº¡i' });
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

    try {
      const notificationService = require('../services/notification.service');
      await notificationService.createNotification({
        userId: userId,
        title: 'Premium Ä‘Ă£ bá»‹ há»§y',
        message: note ? `GĂ³i Premium cá»§a báº¡n Ä‘Ă£ bá»‹ há»§y vá»›i lĂ½ do: ${note}` : 'GĂ³i Premium cá»§a báº¡n Ä‘Ă£ bá»‹ há»§y bá»Ÿi Quáº£n trá»‹ viĂªn.',
        type: 'system',
        link: '/profile'
      });
    } catch (notiErr) {
      console.error('Error sending cancel premium notification:', notiErr);
    }

    res.json({ success: true, message: 'Há»§y Premium thĂ nh cĂ´ng' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('cancelPremium Error:', error);
    next(error);
  } finally {
    if (conn) conn.release();
  }
};

exports.exportPremium = async (req, res, next) => {
  try {
    const { q = '', status = '', plan = '', expiresFrom = '', expiresTo = '' } = req.query;

    let whereClause = "u.role != 'artist'";
    const params = [];

    if (q) {
      whereClause += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.id = ?)';
      params.push(`%${q}%`, `%${q}%`, q);
    }

    if (plan && plan !== 'Táº¥t cáº£') {
      whereClause += ' AND p.name = ?';
      params.push(plan);
    }

    const statusVal = status || 'Táº¥t cáº£ Premium';
    if (statusVal === 'Táº¥t cáº£ Premium') {
      whereClause += " AND (u.premium_expires_at IS NOT NULL OR EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid'))";
    } else if (statusVal === 'Äang hoáº¡t Ä‘á»™ng') {
      whereClause += ' AND u.premium_expires_at > NOW()';
    } else if (statusVal === 'Sáº¯p háº¿t háº¡n') {
      whereClause += ' AND u.premium_expires_at > NOW() AND u.premium_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)';
    } else if (statusVal === 'ÄĂ£ háº¿t háº¡n') {
      whereClause += ' AND (u.premium_expires_at IS NOT NULL AND u.premium_expires_at <= NOW())';
    } else if (statusVal === 'ChÆ°a Premium') {
      whereClause += " AND u.premium_expires_at IS NULL AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.user_id = u.id AND pt.status = 'paid')";
    }

    if (expiresFrom) {
      whereClause += ' AND u.premium_expires_at >= ?';
      params.push(expiresFrom + ' 00:00:00');
    }

    if (expiresTo) {
      whereClause += ' AND u.premium_expires_at <= ?';
      params.push(expiresTo + ' 23:59:59');
    }

    const queryStr = `
      SELECT
        u.id as user_id,
        u.display_name as name,
        u.email,
        u.premium_expires_at,
        p.name as plan_name,
        MAX(pt.created_at) as last_transaction_date
      FROM users u
      LEFT JOIN payment_transactions pt ON pt.user_id = u.id AND pt.status = 'paid'
      LEFT JOIN premium_plans p ON u.premium_plan_id = p.id
      WHERE ${whereClause}
      GROUP BY u.id
      ORDER BY u.premium_expires_at DESC
      LIMIT 10000
    `;

    const [rows] = await pool.query(queryStr, params);

    const formattedRows = rows.map(row => {
      const pStatus = getPremiumStatus(row.premium_expires_at);
      let statusStr = 'KhĂ´ng cĂ³';
      if (pStatus === 'active') statusStr = 'Äang hoáº¡t Ä‘á»™ng';
      else if (pStatus === 'expiring_soon') statusStr = 'Sáº¯p háº¿t háº¡n';
      else if (pStatus === 'expired') statusStr = 'ÄĂ£ háº¿t háº¡n';

      const now = new Date();
      const expiry = row.premium_expires_at ? new Date(row.premium_expires_at) : null;
      let daysRemaining = 0;
      if (expiry && expiry > now) {
        daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      }

      return {
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        plan_name: row.plan_name || 'KhĂ´ng xĂ¡c Ä‘á»‹nh',
        status: statusStr,
        start_date: row.last_transaction_date,
        end_date: row.premium_expires_at,
        days_remaining: daysRemaining
      };
    });

    const columns = [
      { header: 'User ID', key: 'user_id' },
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Plan Name', key: 'plan_name' },
      { header: 'Status', key: 'status' },
      { header: 'Start Date', key: 'start_date' },
      { header: 'End Date', key: 'end_date' },
      { header: 'Days Remaining', key: 'days_remaining' }
    ];

    const csvContent = jsonToCsv(formattedRows, columns);
    const filename = createCsvFilename('premium');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('exportPremium Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.remindExpiring = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id; // Assuming requireAdmin middleware puts user in req.user

    // Check if user has active premium and is within 7 days of expiry
    const [users] = await pool.query(
      'SELECT id, premium_expires_at FROM users WHERE id = ? AND premium_expires_at > NOW() AND premium_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)',
      [userId]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Người dùng không trong diện sắp hết hạn Premium (hoặc không tồn tại, đã hết hạn, hoặc còn trễ hạn > 7 ngày).'
      });
    }

    const user = users[0];
    const msLeft = new Date(user.premium_expires_at) - new Date();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    // Send manual reminder
    const premiumReminderService = require('../services/premiumReminder.service');
    const sent = await premiumReminderService.sendPremiumReminder({
      userId: user.id,
      subscriptionEndDate: user.premium_expires_at,
      daysLeft,
      reminderType: 'manual_admin',
      adminId
    });

    if (!sent) {
      return res.status(400).json({
        success: false,
        code: 'MANUAL_REMINDER_ALREADY_SENT',
        message: 'Admin Ä‘Ă£ gá»­i nháº¯c nhá»Ÿ thá»§ cĂ´ng cho ká»³ Premium nĂ y.'
      });
    }

    res.json({
      success: true,
      message: 'ÄĂ£ gá»­i nháº¯c nhá»Ÿ gia háº¡n Premium.'
    });
  } catch (error) {
    console.error('remindExpiring Error:', error);
    next(error);
  }
};

