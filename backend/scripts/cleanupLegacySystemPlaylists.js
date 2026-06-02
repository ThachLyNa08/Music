const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { resolvePlaylistCoverUrl } = require('../src/utils/playlistCover');
const {
  VALID_SYSTEM_KEYS,
  SYSTEM_PLAYLIST_BY_KEY
} = require('../src/services/systemPlaylist.service');

const LEGACY_TYPE_TO_KEY = {
  weekly_mix: 'weeklymix',
  mood_morning: 'morning_vibes',
  mood_evening: 'night_vibes',
  genre_deep: 'genre_deep_dive'
};

const LEGACY_NAME_TO_KEY = {
  'Daily Mix 1': 'dailymix_01',
  'Daily Mix 2': 'dailymix_02',
  'Morning Mix': 'morning_vibes',
  'Evening Mix': 'night_vibes',
  'Weekly Mix': 'weeklymix'
};

function resolveStandardKey(playlist) {
  if (playlist.system_key && VALID_SYSTEM_KEYS.includes(playlist.system_key)) {
    return playlist.system_key;
  }

  if (playlist.name && LEGACY_NAME_TO_KEY[playlist.name]) {
    return LEGACY_NAME_TO_KEY[playlist.name];
  }

  if (playlist.type && LEGACY_TYPE_TO_KEY[playlist.type]) {
    return LEGACY_TYPE_TO_KEY[playlist.type];
  }

  return null;
}

async function mergeSongs(conn, fromPlaylistId, toPlaylistId) {
  await conn.query(
    `INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at)
     SELECT ?, song_id, position, added_at
     FROM playlist_songs
     WHERE playlist_id = ?`,
    [toPlaylistId, fromPlaylistId]
  );
}

async function cleanup() {
  console.log('Connecting to database...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'musicflow',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [legacyPlaylists] = await conn.query(
      `SELECT id, user_id, name, type, is_system, system_key, cover_url, created_at
       FROM playlists
       WHERE name IN ('Daily Mix 1', 'Daily Mix 2', 'Morning Mix', 'Evening Mix')
          OR type IN ('weekly_mix', 'mood_morning', 'mood_evening', 'genre_deep')
          OR (is_system = 1 AND system_key IS NULL)
          OR (system_key IS NOT NULL AND system_key NOT IN (?))
       ORDER BY user_id, created_at`,
      [VALID_SYSTEM_KEYS]
    );

    let updated = 0;
    let merged = 0;
    let deleted = 0;

    for (const playlist of legacyPlaylists) {
      const standardKey = resolveStandardKey(playlist);
      const standardConfig = standardKey ? SYSTEM_PLAYLIST_BY_KEY[standardKey] : null;

      if (standardKey && standardConfig) {
        const [standardRows] = await conn.query(
          `SELECT id
           FROM playlists
           WHERE user_id = ?
             AND system_key = ?
             AND id <> ?
           ORDER BY (type = 'system') DESC, updated_at DESC, id DESC
           LIMIT 1`,
          [playlist.user_id, standardKey, playlist.id]
        );

        if (standardRows.length > 0) {
          const standardPlaylistId = standardRows[0].id;
          await mergeSongs(conn, playlist.id, standardPlaylistId);
          await conn.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlist.id]);
          await conn.query('DELETE FROM user_saved_playlists WHERE playlist_id = ?', [playlist.id]);
          await conn.query('DELETE FROM playlists WHERE id = ?', [playlist.id]);
          merged++;
          console.log('[CLEANUP MERGED]', {
            legacyId: playlist.id,
            standardPlaylistId,
            userId: playlist.user_id,
            system_key: standardKey
          });
          continue;
        }

        await conn.query(
          `UPDATE playlists
           SET name = ?,
               description = ?,
               cover_url = ?,
               type = 'system',
               is_system = 1,
               system_key = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            standardConfig.name,
            standardConfig.description,
            resolvePlaylistCoverUrl(standardKey),
            standardKey,
            playlist.id
          ]
        );
        updated++;
        console.log('[CLEANUP UPDATED]', {
          id: playlist.id,
          userId: playlist.user_id,
          system_key: standardKey
        });
        continue;
      }

      const shouldDelete =
        playlist.is_system === 1 ||
        playlist.is_system === true ||
        !!playlist.system_key ||
        Object.prototype.hasOwnProperty.call(LEGACY_TYPE_TO_KEY, playlist.type);

      if (shouldDelete) {
        await conn.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlist.id]);
        await conn.query('DELETE FROM user_saved_playlists WHERE playlist_id = ?', [playlist.id]);
        await conn.query('DELETE FROM playlists WHERE id = ?', [playlist.id]);
        deleted++;
        console.log('[CLEANUP DELETED]', {
          id: playlist.id,
          userId: playlist.user_id,
          name: playlist.name,
          type: playlist.type,
          system_key: playlist.system_key
        });
      }
    }

    for (const systemKey of VALID_SYSTEM_KEYS) {
      const config = SYSTEM_PLAYLIST_BY_KEY[systemKey];
      await conn.query(
        `UPDATE playlists
         SET name = ?,
             description = COALESCE(NULLIF(description, ''), ?),
             cover_url = ?,
             type = 'system',
             is_system = 1,
             updated_at = NOW()
         WHERE system_key = ?`,
        [
          config.name,
          config.description,
          resolvePlaylistCoverUrl(systemKey),
          systemKey
        ]
      );
    }

    const [duplicates] = await conn.query(
      `SELECT user_id, system_key, COUNT(*) AS total
       FROM playlists
       WHERE system_key IS NOT NULL
       GROUP BY user_id, system_key
       HAVING COUNT(*) > 1`
    );

    if (duplicates.length > 0) {
      throw new Error(`Duplicate system playlists remain: ${JSON.stringify(duplicates)}`);
    }

    await conn.commit();
    console.log('Cleanup complete.', { updated, merged, deleted });
  } catch (error) {
    await conn.rollback();
    console.error('Cleanup failed:', error);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

cleanup();
