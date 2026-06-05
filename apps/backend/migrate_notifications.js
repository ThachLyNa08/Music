require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
          id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
          user_id         INT UNSIGNED    NOT NULL,
          title           VARCHAR(255)    NOT NULL,
          message         TEXT            NOT NULL,
          type            ENUM('new_song', 'system', 'playlist', 'premium') NOT NULL DEFAULT 'system',
          link            VARCHAR(500)    NULL,
          is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
          created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          CONSTRAINT fk_noti_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          INDEX idx_noti_user (user_id),
          INDEX idx_noti_read (is_read)
      ) COMMENT='Thông báo hệ thống cho người dùng';
    `;
    await pool.query(query);
    console.log('Notifications table created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
