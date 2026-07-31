const { pool } = require('../config/database');
const { getIo } = require('./socket.service');

async function insertNotification({ userId, title, message, type, link, data, priority = 'normal' }) {
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link, data, priority) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, message, type, link, data ? JSON.stringify(data) : null, priority]
    );
    return result.insertId;
  } catch (err) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    // Fallback if migration not run yet
    try {
      const [result] = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link, data) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, title, message, type, link, data ? JSON.stringify(data) : null]
      );
      return result.insertId;
    } catch (err2) {
      if (err2?.code !== 'ER_BAD_FIELD_ERROR') throw err2;
      const [result] = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`,
        [userId, title, message, type, link]
      );
      return result.insertId;
    }
  }
}

// type: 'new_song', 'system', 'playlist', 'premium', 'karaoke_ready', 'karaoke_failed'
exports.createNotification = async ({ userId, title, message, type = 'system', link = null, data = null, priority = 'normal' }) => {
  try {
    const notificationId = await insertNotification({ userId, title, message, type, link, data, priority });

    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    const newNotification = rows[0];

    const io = getIo();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', newNotification);
    }

    return newNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

exports.createGlobalNotification = async ({ title, message, type = 'system', link = null, data = null, priority = 'normal' }) => {
  try {
    const [users] = await pool.query('SELECT id FROM users WHERE status = "active"');

    if (users.length === 0) return;

    const values = users.map(user => [
      user.id,
      title,
      message,
      type,
      link,
      data ? JSON.stringify(data) : null,
      priority
    ]);

    try {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link, data, priority) VALUES ?`,
        [values]
      );
    } catch (err) {
      if (err?.code === 'ER_BAD_FIELD_ERROR') {
        const fallbackValues = users.map(user => [
          user.id,
          title,
          message,
          type,
          link,
          data ? JSON.stringify(data) : null
        ]);
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, link, data) VALUES ?`,
          [fallbackValues]
        );
      } else {
        throw err;
      }
    }

    const io = getIo();
    if (io) {
      const payload = { title, message, type, link, data, priority, is_read: 0, created_at: new Date() };
      io.emit('notification:new', payload);
    }

  } catch (error) {
    console.error('Error creating global notification:', error);
    throw error;
  }
};

exports.createAdminNotification = async ({ title, message, type = 'system', link = null, data = null, priority = 'normal' }) => {
  try {
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin" AND status = "active"');
    if (admins.length === 0) return;

    for (const admin of admins) {
      await insertNotification({ userId: admin.id, title, message, type, link, data, priority });
    }

    const io = getIo();
    if (io) {
      const payload = { title, message, type, link, data, priority, is_read: 0, created_at: new Date() };
      for (const admin of admins) {
        io.to(`user:${admin.id}`).emit('notification:new', payload);
      }
      io.emit('admin:review_updated'); // Trigger data reload in AdminUI
    }
  } catch (error) {
    console.error('Error creating admin notification:', error);
    throw error;
  }
};

exports.notifyAdminsNewArtistSubmission = async ({ contentType, contentId, title, artistId, artistName }) => {
  try {
    const targetUrl = contentType === 'song' ? '/admin/artist-reviews/songs' : '/admin/artist-reviews/albums';
    await exports.createAdminNotification({
      title: 'Có nội dung mới chờ duyệt',
      message: `${artistName} vừa gửi ${contentType === 'song' ? 'bài hát' : 'album'} "${title}" để kiểm duyệt.`,
      type: 'artist_submission_pending',
      link: targetUrl,
      priority: 'high',
      data: { contentType, contentId, artistId }
    });
  } catch (error) {
    console.error('Error notifyAdminsNewArtistSubmission:', error);
  }
};

exports.notifyArtistSubmissionReceived = async ({ userId, contentType, contentId, title }) => {
  try {
    if (!userId) return;
    await exports.createNotification({
      userId,
      title: 'Đã gửi nội dung để duyệt',
      message: `${contentType === 'song' ? 'Bài hát' : 'Album'} "${title}" đã được gửi cho Admin kiểm duyệt.`,
      type: 'artist_submission_received',
      priority: 'normal',
      data: { contentType, contentId }
    });
  } catch (error) {
    console.error('Error notifyArtistSubmissionReceived:', error);
  }
};

exports.notifyArtistContentApproved = async ({ userId, contentType, contentId, title }) => {
  try {
    if (!userId) return;
    await exports.createNotification({
      userId,
      title: 'Nội dung đã được duyệt',
      message: `${contentType === 'song' ? 'Bài hát' : 'Album'} "${title}" đã được duyệt và phát hành trên hệ thống.`,
      type: 'artist_content_approved',
      priority: 'high',
      data: { contentType, contentId }
    });
  } catch (error) {
    console.error('Error notifyArtistContentApproved:', error);
  }
};

exports.notifyArtistContentRejected = async ({ userId, contentType, contentId, title, reason }) => {
  try {
    if (!userId) return;
    await exports.createNotification({
      userId,
      title: 'Nội dung bị từ chối',
      message: `${contentType === 'song' ? 'Bài hát' : 'Album'} "${title}" bị từ chối. Lý do: ${reason}`,
      type: 'artist_content_rejected',
      priority: 'high',
      data: { contentType, contentId, reason }
    });
  } catch (error) {
    console.error('Error notifyArtistContentRejected:', error);
  }
};

exports.notifyInterestedUsersContentApproved = async ({ contentType, contentId, title, artistId, artistName, coverUrl }) => {
  try {
    // 1. Check if we already notified for this content to prevent duplicates
    const [existingNotis] = await pool.query(
      `SELECT id FROM notifications 
       WHERE type = 'artist_new_release' 
       AND JSON_EXTRACT(data, '$.contentType') = ? 
       AND JSON_EXTRACT(data, '$.contentId') = ? LIMIT 1`,
      [contentType, contentId]
    );
    if (existingNotis.length > 0) {
      console.log(`Notification for ${contentType} ${contentId} already sent. Skipping.`);
      return;
    }

    // 2. Build list of interested users
    const userScores = new Map();

    // 2.1 Follower: +100
    try {
      const [followers] = await pool.query('SELECT user_id FROM artist_follows WHERE artist_id = ?', [artistId]);
      for (const row of followers) {
        userScores.set(row.user_id, (userScores.get(row.user_id) || 0) + 100);
      }
    } catch (e) {
      // artist_follows table might not exist in some states
    }

    // 2.2 Listeners: >= 3 = +80, 1-2 = +40
    const [listeners] = await pool.query(`
      SELECT lh.user_id, COUNT(*) AS listen_count
      FROM listening_history lh
      JOIN songs s ON s.id = lh.song_id
      WHERE s.artist_id = ?
        AND lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY lh.user_id
    `, [artistId]);
    for (const row of listeners) {
      let scoreToAdd = row.listen_count >= 3 ? 80 : 40;
      userScores.set(row.user_id, (userScores.get(row.user_id) || 0) + scoreToAdd);
    }

    // 2.3 Liked songs: +30
    const [likers] = await pool.query(`
      SELECT sl.user_id
      FROM song_likes sl
      JOIN songs s ON s.id = sl.song_id
      WHERE s.artist_id = ?
      GROUP BY sl.user_id
    `, [artistId]);
    for (const row of likers) {
      userScores.set(row.user_id, (userScores.get(row.user_id) || 0) + 30);
    }

    // 2.4 User Artist Preferences: +50
    try {
      const [prefs] = await pool.query('SELECT user_id FROM user_artist_preferences WHERE artist_id = ?', [artistId]);
      for (const row of prefs) {
        userScores.set(row.user_id, (userScores.get(row.user_id) || 0) + 50);
      }
    } catch (e) {}

    // Get active users excluding admins and artist account
    const [activeUsers] = await pool.query(
      'SELECT id, role FROM users WHERE status = "active" AND id IN (?)',
      [Array.from(userScores.keys()).length ? Array.from(userScores.keys()) : [0]]
    );

    const activeUserMap = new Map();
    activeUsers.forEach(u => activeUserMap.set(u.id, u));
    
    // Find artist user id if exists
    let artistUserId = null;
    try {
      const [artistRows] = await pool.query('SELECT user_id FROM artist_accounts WHERE artist_id = ?', [artistId]);
      if (artistRows.length > 0) artistUserId = artistRows[0].user_id;
    } catch (e) {}

    const eligibleUsers = [];
    for (const [userId, score] of userScores.entries()) {
      const user = activeUserMap.get(userId);
      // Lower threshold to 20 so that likes (+30) or prefs (+50) also qualify
      if (user && user.role !== 'admin' && userId !== artistUserId && score >= 20) {
        eligibleUsers.push({ userId, score });
      }
    }

    // Sort by score DESC, limit 500
    eligibleUsers.sort((a, b) => b.score - a.score);
    const topUsers = eligibleUsers.slice(0, 500);

    if (topUsers.length === 0) return;

    const targetUrl = contentType === 'song' ? `/song/${contentId}` : `/album/${contentId}`;
    const msg = contentType === 'song' 
      ? `${artistName} vừa phát hành bài hát mới: "${title}".`
      : `${artistName} vừa phát hành album mới: "${title}".`;
    
    // Use the old 'new_song' type to ensure frontend shows the special icon
    const notiType = contentType === 'song' ? 'new_song' : 'new_album';

    const io = getIo();
    const createdDate = new Date();

    for (const { userId, score } of topUsers) {
      const priority = score >= 50 ? 'high' : 'normal';
      
      const notificationId = await insertNotification({
        userId,
        title: 'Nội dung mới',
        message: msg,
        type: notiType,
        link: targetUrl,
        priority,
        data: { contentType, contentId, artistId, coverUrl }
      });

      if (io) {
        const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
        if (rows[0]) {
          io.to(`user:${userId}`).emit('notification:new', rows[0]);
        }
      }
    }

  } catch (error) {
    console.error('Error notifyInterestedUsersContentApproved:', error);
  }
};
