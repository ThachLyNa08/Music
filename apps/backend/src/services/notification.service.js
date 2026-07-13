const { pool } = require('../config/database');
const { getIo } = require('./socket.service');

async function insertNotification({ userId, title, message, type, link, data }) {
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link, data) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, message, type, link, data ? JSON.stringify(data) : null]
    );
    return result.insertId;
  } catch (err) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, link]
    );
    return result.insertId;
  }
}

// type: 'new_song', 'system', 'playlist', 'premium', 'karaoke_ready', 'karaoke_failed'
exports.createNotification = async ({ userId, title, message, type = 'system', link = null, data = null }) => {
  try {
    const notificationId = await insertNotification({ userId, title, message, type, link, data });

    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    const newNotification = rows[0];

    const io = getIo();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', newNotification);
      io.to(`user:${userId}`).emit('new_notification', newNotification);
    }

    return newNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

exports.createGlobalNotification = async ({ title, message, type = 'system', link = null, data = null }) => {
  try {
    const [users] = await pool.query('SELECT id FROM users WHERE status = "active"');

    if (users.length === 0) return;

    for (const user of users) {
      await insertNotification({ userId: user.id, title, message, type, link, data });
    }

    const io = getIo();
    if (io) {
      const payload = { title, message, type, link, data, is_read: 0, created_at: new Date() };
      io.emit('notification:new', payload);
      io.emit('new_notification', payload);
    }

  } catch (error) {
    console.error('Error creating global notification:', error);
    throw error;
  }
};

exports.createAdminNotification = async ({ title, message, type = 'system', link = null, data = null }) => {
  try {
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin" AND status = "active"');
    if (admins.length === 0) return;

    for (const admin of admins) {
      await insertNotification({ userId: admin.id, title, message, type, link, data });
    }

    const io = getIo();
    if (io) {
      const payload = { title, message, type, link, data, is_read: 0, created_at: new Date() };
      for (const admin of admins) {
        io.to(`user:${admin.id}`).emit('notification:new', payload);
        io.to(`user:${admin.id}`).emit('new_notification', payload);
      }
      io.emit('admin:review_updated'); // Trigger data reload in AdminUI
    }
  } catch (error) {
    console.error('Error creating admin notification:', error);
    throw error;
  }
};
