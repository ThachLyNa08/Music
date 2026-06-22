require('dotenv').config();
const { pool } = require('../../src/config/database');

async function columnExists(columnName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'notifications'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );
  return rows.length > 0;
}

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('new_song', 'system', 'playlist', 'premium', 'karaoke_ready', 'karaoke_failed') NOT NULL DEFAULT 'system',
        link VARCHAR(500) NULL,
        data JSON NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_noti_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        INDEX idx_noti_user (user_id),
        INDEX idx_noti_read (is_read)
      ) COMMENT='User notifications'
    `);

    await pool.query(`
      ALTER TABLE notifications
      MODIFY COLUMN type ENUM('new_song', 'system', 'playlist', 'premium', 'karaoke_ready', 'karaoke_failed')
      NOT NULL DEFAULT 'system'
    `);

    if (!(await columnExists('data'))) {
      await pool.query('ALTER TABLE notifications ADD COLUMN data JSON NULL AFTER link');
    }

    if (!(await columnExists('updated_at'))) {
      await pool.query(
        'ALTER TABLE notifications ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
      );
    }

    console.log('Notifications migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
