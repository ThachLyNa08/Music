const { pool } = require('../config/database');

const FREE_DAILY_LIMIT = Number(process.env.AI_PLAYLIST_FREE_DAILY_LIMIT || 3);
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function getTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

async function isPremiumUser(userId, connection = pool) {
  const [rows] = await connection.query(
    `
    SELECT id
    FROM user_subscriptions
    WHERE user_id = ?
      AND status = 'active'
      AND (end_date IS NULL OR end_date >= NOW())
    LIMIT 1
    `,
    [userId]
  );

  return rows.length > 0;
}

async function getQuotaStatus(userId) {
  const premium = await isPremiumUser(userId);

  if (premium) {
    return {
      isPremium: true,
      unlimited: true,
      limit: null,
      used: 0,
      remaining: null,
      resetDate: getTodayKey()
    };
  }

  const today = getTodayKey();

  const [rows] = await pool.query(
    `
    SELECT used_count
    FROM ai_playlist_daily_usage
    WHERE user_id = ? AND usage_date = ?
    LIMIT 1
    `,
    [userId, today]
  );

  const used = rows[0]?.used_count || 0;

  return {
    isPremium: false,
    unlimited: false,
    limit: FREE_DAILY_LIMIT,
    used,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    resetDate: today
  };
}

async function consumeQuota(userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const premium = await isPremiumUser(userId, connection);

    if (premium) {
      await connection.commit();
      return {
        isPremium: true,
        unlimited: true,
        limit: null,
        used: 0,
        remaining: null,
        resetDate: getTodayKey()
      };
    }

    const today = getTodayKey();

    await connection.query(
      `
      INSERT INTO ai_playlist_daily_usage (user_id, usage_date, used_count)
      VALUES (?, ?, 0)
      ON DUPLICATE KEY UPDATE updated_at = updated_at
      `,
      [userId, today]
    );

    const [rows] = await connection.query(
      `
      SELECT used_count
      FROM ai_playlist_daily_usage
      WHERE user_id = ? AND usage_date = ?
      FOR UPDATE
      `,
      [userId, today]
    );

    const currentUsed = rows[0]?.used_count || 0;

    if (currentUsed >= FREE_DAILY_LIMIT) {
      await connection.rollback();

      const error = new Error('Bạn đã dùng hết 3 lượt tạo AI Playlist miễn phí hôm nay. Nâng cấp Premium để tạo không giới hạn hoặc quay lại vào ngày mai.');
      error.status = 429;
      error.code = 'AI_PLAYLIST_DAILY_LIMIT_REACHED';
      error.quota = {
        isPremium: false,
        unlimited: false,
        limit: FREE_DAILY_LIMIT,
        used: currentUsed,
        remaining: 0,
        resetDate: today
      };
      throw error;
    }

    const nextUsed = currentUsed + 1;

    await connection.query(
      `
      UPDATE ai_playlist_daily_usage
      SET used_count = ?, updated_at = NOW()
      WHERE user_id = ? AND usage_date = ?
      `,
      [nextUsed, userId, today]
    );

    await connection.commit();

    return {
      isPremium: false,
      unlimited: false,
      limit: FREE_DAILY_LIMIT,
      used: nextUsed,
      remaining: Math.max(0, FREE_DAILY_LIMIT - nextUsed),
      resetDate: today
    };
  } catch (error) {
    try {
      if (connection && typeof connection.rollback === 'function') {
        await connection.rollback();
      }
    } catch (_) {}
    throw error;
  } finally {
    if (connection && typeof connection.release === 'function') {
      connection.release();
    }
  }
}

module.exports = {
  getQuotaStatus,
  consumeQuota
};
