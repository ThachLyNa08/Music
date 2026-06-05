const { pool } = require('../config/database');
const { getIo } = require('./socket.service');

// type: 'new_song', 'system', 'playlist', 'premium'
exports.createNotification = async ({ userId, title, message, type = 'system', link = null }) => {
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, link]
    );

    const notificationId = result.insertId;

    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    const newNotification = rows[0];

    const io = getIo();
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', newNotification);
    }

    return newNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

exports.createGlobalNotification = async ({ title, message, type = 'system', link = null }) => {
  try {
    const [users] = await pool.query('SELECT id FROM users WHERE status = "active"');
    
    if (users.length === 0) return;

    const values = users.map(u => [u.id, title, message, type, link]);

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES ?`,
      [values]
    );

    const io = getIo();
    if (io) {
      io.emit('new_notification', { title, message, type, link, is_read: 0, created_at: new Date() });
    }
    
  } catch (error) {
    console.error('Error creating global notification:', error);
    throw error;
  }
};
