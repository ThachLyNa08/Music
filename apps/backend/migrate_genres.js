require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '261999',
    database: process.env.DB_NAME || 'musicflow',
  });

  try {
    console.log('Running migrations...');
    
    const queries = [
      "ALTER TABLE genres ADD COLUMN market VARCHAR(50) NULL AFTER slug",
      "ALTER TABLE genres ADD COLUMN parent_id INT UNSIGNED NULL AFTER market",
      "ALTER TABLE genres ADD COLUMN use_in_recommendation BOOLEAN NOT NULL DEFAULT TRUE",
      "ALTER TABLE genres ADD COLUMN use_in_cold_start BOOLEAN NOT NULL DEFAULT TRUE",
      "ALTER TABLE genres ADD COLUMN use_in_ai_playlist BOOLEAN NOT NULL DEFAULT TRUE",
      "ALTER TABLE genres ADD CONSTRAINT fk_genres_parent FOREIGN KEY (parent_id) REFERENCES genres(id) ON DELETE SET NULL",
      "CREATE INDEX idx_genres_market ON genres (market)",
      "CREATE INDEX idx_genres_parent ON genres (parent_id)",
      "CREATE INDEX idx_genres_taxonomy_flags ON genres (use_in_recommendation, use_in_cold_start, use_in_ai_playlist)"
    ];

    for (const sql of queries) {
      try {
        await pool.query(sql);
        console.log('Success:', sql.substring(0, 50) + '...');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_CANT_CREATE_TABLE') {
          console.log('Already exists or skipped:', sql.substring(0, 30) + '...');
        } else {
          console.error('Error on query:', sql, err.message);
        }
      }
    }
    
    console.log('Migration done!');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
