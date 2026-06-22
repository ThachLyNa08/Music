const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { resolvePlaylistCoverUrl } = require('../../src/utils/playlistCover');
const {
  PERSONALIZED_SYSTEM_PLAYLISTS,
  GLOBAL_SYSTEM_PLAYLISTS
} = require('../../src/services/systemPlaylist.service');

async function seed() {
  console.log('Connecting to database...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'musicflow',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    const [users] = await pool.query('SELECT id, role FROM users');
    console.log(`Found ${users.length} users in the system.`);

    const admin = users.find(u => u.role === 'admin') || users[0];
    if (!admin) {
        console.error('No users found in the system. Please create a user first.');
        process.exit(1);
    }

    // Seed personalized playlists
    let countPersonal = 0;
    for (const user of users) {
        for (const pl of PERSONALIZED_SYSTEM_PLAYLISTS) {
            const coverUrl = resolvePlaylistCoverUrl(pl.system_key) || null;
            console.log('[ENSURE PLAYLIST]', {
                userId: user.id,
                name: pl.name,
                system_key: pl.system_key,
                type: 'system',
                cover_url: coverUrl
            });
            await pool.query(`
                INSERT INTO playlists (user_id, name, description, cover_url, is_system, type, system_key)
                VALUES (?, ?, ?, ?, 1, 'system', ?)
                ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    description = VALUES(description),
                    cover_url = VALUES(cover_url),
                    is_system = 1,
                    type = 'system',
                    updated_at = NOW()
            `, [user.id, pl.name, pl.description, coverUrl, pl.system_key]);
            countPersonal++;
        }
    }
    console.log(`Seeded ${countPersonal} personalized system playlists.`);

    // Seed global playlists
    let countGlobal = 0;
    for (const pl of GLOBAL_SYSTEM_PLAYLISTS) {
        const coverUrl = resolvePlaylistCoverUrl(pl.system_key) || null;
        console.log('[ENSURE PLAYLIST]', {
            userId: admin.id,
            name: pl.name,
            system_key: pl.system_key,
            type: 'system',
            cover_url: coverUrl
        });
        await pool.query(`
            INSERT INTO playlists (user_id, name, description, cover_url, is_system, type, system_key)
            VALUES (?, ?, ?, ?, 1, 'system', ?)
            ON DUPLICATE KEY UPDATE 
                name = VALUES(name),
                description = VALUES(description),
                cover_url = VALUES(cover_url),
                is_system = 1,
                type = 'system',
                updated_at = NOW()
        `, [admin.id, pl.name, pl.description, coverUrl, pl.system_key]);
        countGlobal++;
    }
    console.log(`Seeded ${countGlobal} global system playlists.`);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
    console.log('Done.');
    process.exit(0);
  }
}

seed();
