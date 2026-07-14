const { pool } = require('../config/database');
const notificationService = require('./notification.service');

const sendPremiumReminder = async ({ userId, subscriptionEndDate, daysLeft, reminderType, adminId = null }) => {
  // Check if reminder already sent for this subscription end date
  const [existingLogs] = await pool.query(
    'SELECT id FROM premium_reminder_logs WHERE user_id = ? AND subscription_end_date = ? AND reminder_type = ?',
    [userId, subscriptionEndDate, reminderType]
  );

  if (existingLogs.length > 0) {
    return false; // Already sent
  }

  // Create notification
  const title = 'Premium sắp hết hạn';
  const formattedDate = new Date(subscriptionEndDate).toLocaleDateString('vi-VN');
  const message = `Gói Premium của bạn sẽ hết hạn vào ${formattedDate}. Hãy gia hạn để tiếp tục sử dụng đầy đủ quyền lợi.`;

  const notification = await notificationService.createNotification({
    userId,
    title,
    message,
    type: 'premium',
    link: '/premium',
    data: {
      source: reminderType,
      expiresAt: subscriptionEndDate,
      daysLeft
    }
  });

  // Log reminder
  await pool.query(
    `INSERT INTO premium_reminder_logs 
    (user_id, subscription_end_date, reminder_type, notification_id, sent_by_admin_id, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, subscriptionEndDate, reminderType, notification.id, adminId]
  );

  return true;
};

const runAutoReminderJob = async () => {
  try {
    console.log('[PremiumReminderScheduler] Starting auto 7-day reminder scan...');
    // Find users with premium_expires_at between 0 and 7 days
    const [expiringUsers] = await pool.query(`
      SELECT id, premium_expires_at 
      FROM users 
      WHERE premium_expires_at > NOW() 
      AND premium_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
    `);

    let sentCount = 0;
    for (const user of expiringUsers) {
      // Calculate days left
      const msLeft = new Date(user.premium_expires_at) - new Date();
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

      const sent = await sendPremiumReminder({
        userId: user.id,
        subscriptionEndDate: user.premium_expires_at,
        daysLeft,
        reminderType: 'auto_7d'
      });

      if (sent) {
        sentCount++;
        console.log(`[PremiumReminderScheduler] sent auto reminder userId=${user.id}`);
      }
    }
    console.log(`[PremiumReminderScheduler] Completed. Sent ${sentCount} reminders.`);
  } catch (error) {
    console.error('[PremiumReminderScheduler] Error running auto reminder job:', error);
  }
};

module.exports = {
  sendPremiumReminder,
  runAutoReminderJob
};
