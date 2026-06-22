require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'musicflow';

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function indexExists(conn, tableName, indexName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, tableName, columnName, definition) {
  if (await columnExists(conn, tableName, columnName)) return;
  await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`Added ${tableName}.${columnName}`);
}

async function addIndexIfMissing(conn, tableName, indexName, definition) {
  if (await indexExists(conn, tableName, indexName)) return;
  await conn.query(`ALTER TABLE ${tableName} ADD ${definition}`);
  console.log(`Added index ${tableName}.${indexName}`);
}

async function normalizePremiumPayment(conn) {
  console.log('001_premium_payment_schema');

  await addColumnIfMissing(conn, 'users', 'premium_expires_at', 'DATETIME NULL');

  if (await columnExists(conn, 'users', 'premium_expired_at')) {
    await conn.query(`
      UPDATE users
      SET premium_expires_at = COALESCE(premium_expires_at, premium_expired_at)
      WHERE premium_expired_at IS NOT NULL
    `);
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS premium_plans (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      price DECIMAL(12,0) NOT NULL,
      duration_days INT UNSIGNED NOT NULL,
      features JSON NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(conn, 'premium_plans', 'description', 'TEXT NULL');
  await addColumnIfMissing(conn, 'premium_plans', 'features', 'JSON NULL');
  await addColumnIfMissing(conn, 'premium_plans', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing(conn, 'premium_plans', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing(conn, 'premium_plans', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await conn.query('ALTER TABLE premium_plans MODIFY COLUMN name VARCHAR(255) NOT NULL');
  await conn.query('ALTER TABLE premium_plans MODIFY COLUMN price DECIMAL(12,0) NOT NULL');
  await conn.query('ALTER TABLE premium_plans MODIFY COLUMN duration_days INT UNSIGNED NOT NULL');

  await conn.query(`
    INSERT INTO premium_plans (name, duration_days, price, description, features, is_active)
    SELECT 'Premium 1 month', 30, 59000, 'Premium access for 30 days',
           JSON_ARRAY('Karaoke beat download', 'No ads', 'Priority AI features'), 1
    WHERE NOT EXISTS (SELECT 1 FROM premium_plans WHERE duration_days = 30)
  `);
  await conn.query(`
    INSERT INTO premium_plans (name, duration_days, price, description, features, is_active)
    SELECT 'Premium 3 months', 90, 149000, 'Premium access for 90 days',
           JSON_ARRAY('Karaoke beat download', 'No ads', 'Priority AI features'), 1
    WHERE NOT EXISTS (SELECT 1 FROM premium_plans WHERE duration_days = 90)
  `);
  await conn.query(`
    INSERT INTO premium_plans (name, duration_days, price, description, features, is_active)
    SELECT 'Premium 1 year', 365, 499000, 'Premium access for 365 days',
           JSON_ARRAY('Karaoke beat download', 'No ads', 'Priority AI features'), 1
    WHERE NOT EXISTS (SELECT 1 FROM premium_plans WHERE duration_days = 365)
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      plan_id INT UNSIGNED NOT NULL,
      status ENUM('active','expired','cancelled','pending') NOT NULL DEFAULT 'pending',
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_user_subscriptions_user_id (user_id),
      INDEX idx_user_subscriptions_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(conn, 'user_subscriptions', 'start_date', 'DATETIME NULL');
  await addColumnIfMissing(conn, 'user_subscriptions', 'end_date', 'DATETIME NULL');
  if (await columnExists(conn, 'user_subscriptions', 'started_at')) {
    await conn.query('UPDATE user_subscriptions SET start_date = COALESCE(start_date, started_at)');
    await conn.query('ALTER TABLE user_subscriptions MODIFY COLUMN started_at DATETIME NULL');
  }
  if (await columnExists(conn, 'user_subscriptions', 'expired_at')) {
    await conn.query('UPDATE user_subscriptions SET end_date = COALESCE(end_date, expired_at)');
    await conn.query('ALTER TABLE user_subscriptions MODIFY COLUMN expired_at DATETIME NULL');
  }
  await conn.query("ALTER TABLE user_subscriptions MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await conn.query("UPDATE user_subscriptions SET status = LOWER(status)");
  await conn.query("UPDATE user_subscriptions SET status = 'pending' WHERE status NOT IN ('active','expired','cancelled','pending')");
  await conn.query("ALTER TABLE user_subscriptions MODIFY COLUMN status ENUM('active','expired','cancelled','pending') NOT NULL DEFAULT 'pending'");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      plan_id INT UNSIGNED NOT NULL,
      subscription_id INT UNSIGNED NULL,
      amount DECIMAL(12,0) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'VND',
      provider ENUM('sepay','vnpay','momo','manual') NOT NULL DEFAULT 'sepay',
      payment_code VARCHAR(64) NOT NULL,
      qr_content VARCHAR(255) NULL,
      qr_code_url TEXT NULL,
      status ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
      paid_at DATETIME NULL,
      expires_at DATETIME NULL,
      raw_payload JSON NULL,
      gateway_transaction_id VARCHAR(100) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_payment_code (payment_code),
      INDEX idx_payment_transactions_user_id (user_id),
      INDEX idx_payment_transactions_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(conn, 'payment_transactions', 'subscription_id', 'INT UNSIGNED NULL');
  await addColumnIfMissing(conn, 'payment_transactions', 'currency', "VARCHAR(10) NOT NULL DEFAULT 'VND'");
  await addColumnIfMissing(conn, 'payment_transactions', 'provider', "VARCHAR(20) NOT NULL DEFAULT 'sepay'");
  await addColumnIfMissing(conn, 'payment_transactions', 'payment_code', 'VARCHAR(64) NULL');
  await addColumnIfMissing(conn, 'payment_transactions', 'qr_content', 'VARCHAR(255) NULL');
  await addColumnIfMissing(conn, 'payment_transactions', 'qr_code_url', 'TEXT NULL');
  await addColumnIfMissing(conn, 'payment_transactions', 'expires_at', 'DATETIME NULL');
  await addColumnIfMissing(conn, 'payment_transactions', 'raw_payload', 'JSON NULL');
  await addColumnIfMissing(conn, 'payment_transactions', 'gateway_transaction_id', 'VARCHAR(100) NULL');

  if (await columnExists(conn, 'payment_transactions', 'order_code')) {
    await conn.query('UPDATE payment_transactions SET payment_code = COALESCE(payment_code, order_code)');
    await conn.query('ALTER TABLE payment_transactions MODIFY COLUMN order_code VARCHAR(64) NULL');
  }
  if (await columnExists(conn, 'payment_transactions', 'transfer_content')) {
    await conn.query('UPDATE payment_transactions SET qr_content = COALESCE(qr_content, transfer_content)');
  }
  if (await columnExists(conn, 'payment_transactions', 'expired_at')) {
    await conn.query('UPDATE payment_transactions SET expires_at = COALESCE(expires_at, expired_at)');
    await conn.query('ALTER TABLE payment_transactions MODIFY COLUMN expired_at DATETIME NULL');
  }
  if (await columnExists(conn, 'payment_transactions', 'raw_callback')) {
    await conn.query('UPDATE payment_transactions SET raw_payload = COALESCE(raw_payload, raw_callback)');
  }
  if (await columnExists(conn, 'payment_transactions', 'payment_method')) {
    await conn.query("UPDATE payment_transactions SET provider = LOWER(payment_method) WHERE provider IS NULL OR provider = ''");
  }

  await conn.query("UPDATE payment_transactions SET payment_code = CONCAT('LEGACY', id) WHERE payment_code IS NULL OR payment_code = ''");
  await conn.query("ALTER TABLE payment_transactions MODIFY COLUMN payment_code VARCHAR(64) NOT NULL");
  await addIndexIfMissing(conn, 'payment_transactions', 'unique_payment_code', 'UNIQUE KEY unique_payment_code (payment_code)');

  await conn.query("ALTER TABLE payment_transactions MODIFY COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'sepay'");
  await conn.query("UPDATE payment_transactions SET provider = LOWER(provider)");
  await conn.query("UPDATE payment_transactions SET provider = 'manual' WHERE provider NOT IN ('sepay','vnpay','momo','manual')");
  await conn.query("ALTER TABLE payment_transactions MODIFY COLUMN provider ENUM('sepay','vnpay','momo','manual') NOT NULL DEFAULT 'sepay'");

  await conn.query("ALTER TABLE payment_transactions MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await conn.query("UPDATE payment_transactions SET status = LOWER(status)");
  await conn.query("UPDATE payment_transactions SET status = 'pending' WHERE status NOT IN ('pending','paid','failed','expired','cancelled')");
  await conn.query("ALTER TABLE payment_transactions MODIFY COLUMN status ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending'");

  if (await tableExists(conn, 'transactions')) {
    await conn.query(`
      INSERT IGNORE INTO payment_transactions (
        user_id, plan_id, amount, currency, provider, payment_code, qr_content, status,
        paid_at, expires_at, raw_payload, gateway_transaction_id, created_at, updated_at
      )
      SELECT
        user_id,
        plan_id,
        amount,
        'VND',
        CASE
          WHEN provider IN ('vnpay','momo','sepay','manual') THEN provider
          ELSE 'manual'
        END,
        order_code,
        order_code,
        CASE
          WHEN status = 'success' THEN 'paid'
          WHEN status IN ('pending','failed','expired','cancelled') THEN status
          ELSE 'pending'
        END,
        paid_at,
        qr_expires_at,
        webhook_payload,
        provider_txn_id,
        created_at,
        created_at
      FROM transactions
      WHERE order_code IS NOT NULL
    `);
  }
}

async function normalizeSystemPlaylistSchema(conn) {
  console.log('002_system_playlist_schema');

  await addColumnIfMissing(conn, 'artists', 'region', "VARCHAR(50) DEFAULT 'Khac'");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS artist_follows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      artist_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_artist_follow (user_id, artist_id),
      INDEX idx_artist_follows_user_id (user_id),
      INDEX idx_artist_follows_artist_id (artist_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(conn, 'playlists', 'is_system', 'BOOLEAN DEFAULT FALSE');
  await addColumnIfMissing(conn, 'playlists', 'system_key', 'VARCHAR(100) NULL');
  await addIndexIfMissing(conn, 'playlists', 'unique_user_system_key', 'UNIQUE KEY unique_user_system_key (user_id, system_key)');

  if (await tableExists(conn, 'playlist_songs')) {
    await addColumnIfMissing(conn, 'playlist_songs', 'position', 'INT NOT NULL DEFAULT 0');
    await addIndexIfMissing(conn, 'playlist_songs', 'idx_ps_position', 'INDEX idx_ps_position (playlist_id, position)');
  }

  await conn.query(`
    ALTER TABLE playlists
    MODIFY COLUMN type ENUM(
      'manual','ai','system','weekly_mix','mood_morning',
      'mood_evening','genre_deep','ai_generated'
    ) NOT NULL DEFAULT 'manual'
  `);
  await conn.query(`
    UPDATE playlists
    SET type = 'system', is_system = 1
    WHERE is_system = 1
       OR system_key IS NOT NULL
       OR name LIKE 'Daily Mix%'
       OR name IN ('Weekly Mix', 'Morning Mix', 'Evening Mix', 'Morning Vibes', 'Night Vibes', 'Mood Mix', 'Favorite Songs', 'Recently Played', 'Trending Now')
  `);
  await conn.query(`
    UPDATE playlists
    SET type = 'ai'
    WHERE type = 'ai_generated'
      AND (is_system = 0 OR is_system IS NULL)
      AND system_key IS NULL
  `);
  await conn.query(`
    UPDATE playlists
    SET type = 'manual'
    WHERE type IN ('weekly_mix', 'mood_morning', 'mood_evening', 'genre_deep', 'ai_generated')
  `);
  await conn.query("ALTER TABLE playlists MODIFY COLUMN type ENUM('manual','ai','system') NOT NULL DEFAULT 'manual'");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_saved_playlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      playlist_id INT UNSIGNED NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_playlist (user_id, playlist_id),
      INDEX idx_user_saved_playlists_user_id (user_id),
      INDEX idx_user_saved_playlists_playlist_id (playlist_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_saved_albums (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      album_id INT UNSIGNED NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_album (user_id, album_id),
      INDEX idx_user_saved_albums_user_id (user_id),
      INDEX idx_user_saved_albums_album_id (album_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function normalizeArtistMetadataSchema(conn) {
  console.log('003_artist_metadata_schema');

  await addColumnIfMissing(conn, 'artists', 'short_bio', 'TEXT NULL');
  await addColumnIfMissing(conn, 'artists', 'genres_json', 'JSON NULL');
  await addColumnIfMissing(conn, 'artists', 'country', 'VARCHAR(100) NULL');
  await addColumnIfMissing(conn, 'artists', 'popularity', 'INT NULL');
  await addColumnIfMissing(conn, 'artists', 'followers', 'INT NULL');
  await addColumnIfMissing(conn, 'artists', 'spotify_artist_id', 'VARCHAR(100) NULL');
  await addColumnIfMissing(conn, 'artists', 'external_url', 'VARCHAR(500) NULL');
  await addColumnIfMissing(conn, 'artists', 'avatar_source', 'VARCHAR(50) NULL');
  await addColumnIfMissing(conn, 'artists', 'metadata_source', 'VARCHAR(50) NULL');
  await addColumnIfMissing(conn, 'artists', 'metadata_source_url', 'VARCHAR(500) NULL');
  await addColumnIfMissing(conn, 'artists', 'metadata_fetched_at', 'DATETIME NULL');

  await addIndexIfMissing(conn, 'artists', 'idx_artists_spotify_artist_id', 'INDEX idx_artists_spotify_artist_id (spotify_artist_id)');
  await addIndexIfMissing(conn, 'artists', 'idx_artists_metadata_fetched_at', 'INDEX idx_artists_metadata_fetched_at (metadata_fetched_at)');
}

async function normalizeArtistBioFallbackSchema(conn) {
  console.log('004_artist_bio_fallback_schema');

  // Thêm các cột cho Wikipedia/Last.fm fallback
  await addColumnIfMissing(conn, 'artists', 'bio', 'TEXT NULL'); // (phòng trường hợp schema gốc chưa có)
  await addColumnIfMissing(conn, 'artists', 'bio_source', 'VARCHAR(50) NULL');
  await addColumnIfMissing(conn, 'artists', 'bio_source_url', 'VARCHAR(500) NULL');
  await addColumnIfMissing(conn, 'artists', 'bio_fetched_at', 'DATETIME NULL');
  await addColumnIfMissing(conn, 'artists', 'lastfm_url', 'VARCHAR(500) NULL');
  await addColumnIfMissing(conn, 'artists', 'wikidata_id', 'VARCHAR(100) NULL');
}

async function normalizeAlbumAdminSchema(conn) {
  console.log('005_album_admin_schema');

  if (await tableExists(conn, 'songs')) {
    await addColumnIfMissing(conn, 'songs', 'track_number', 'INT NULL');
    await addIndexIfMissing(conn, 'songs', 'idx_songs_album_track_number', 'INDEX idx_songs_album_track_number (album_id, track_number)');
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: DB_NAME,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
  });

  try {
    console.log(`Running migrations on database ${DB_NAME}`);
    await normalizePremiumPayment(conn);
    await normalizeSystemPlaylistSchema(conn);
    await normalizeArtistMetadataSchema(conn);
    await normalizeArtistBioFallbackSchema(conn);
    await normalizeAlbumAdminSchema(conn);
    console.log('Migrations completed');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
