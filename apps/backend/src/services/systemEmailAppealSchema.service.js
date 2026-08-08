const { pool } = require('../config/database');
const { columnExists, clearIntrospectionCache } = require('../utils/dbIntrospection');

let ensurePromise = null;

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  clearIntrospectionCache();
}

async function createEmailLogsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        email_type VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status ENUM('sent','failed','skipped') DEFAULT 'sent',
        error_message TEXT NULL,
        metadata_json JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_logs_user_created (user_id, created_at),
        INDEX idx_email_logs_type_created (email_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (!/json/i.test(error.message || '')) throw error;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        email_type VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status ENUM('sent','failed','skipped') DEFAULT 'sent',
        error_message TEXT NULL,
        metadata_json LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_logs_user_created (user_id, created_at),
        INDEX idx_email_logs_type_created (email_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}

async function ensureSystemEmailAppealSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await addColumnIfMissing('users', 'locked_at', 'DATETIME NULL');
      await addColumnIfMissing('users', 'locked_reason', 'TEXT NULL');
      await addColumnIfMissing('users', 'locked_by', 'BIGINT NULL');
      await addColumnIfMissing('users', 'lock_appeal_allowed', 'TINYINT(1) DEFAULT 1');
      await addColumnIfMissing('users', 'lock_appeal_token', 'VARCHAR(128) NULL');
      await addColumnIfMissing('users', 'lock_appeal_token_hash', 'CHAR(64) NULL');
      await addColumnIfMissing('users', 'lock_appeal_token_expires_at', 'DATETIME NULL');

      await createEmailLogsTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS account_lock_appeals (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT NOT NULL,
          email VARCHAR(255) NOT NULL,
          reason TEXT NOT NULL,
          evidence_image_url VARCHAR(500) NULL,
          status ENUM('pending','reviewing','accepted','rejected') DEFAULT 'pending',
          admin_note TEXT NULL,
          resolved_by BIGINT NULL,
          resolved_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_lock_appeals_user_created (user_id, created_at),
          INDEX idx_lock_appeals_status_created (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await addColumnIfMissing('account_lock_appeals', 'evidence_image_url', 'VARCHAR(500) NULL');
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

module.exports = {
  ensureSystemEmailAppealSchema,
};
