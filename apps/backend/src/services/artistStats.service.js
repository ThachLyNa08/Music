const { pool } = require('../config/database');

const tableExistsCache = new Map();

async function tableExists(tableName) {
  if (tableExistsCache.has(tableName)) return tableExistsCache.get(tableName);

  const [rows] = await pool.query('SHOW TABLES LIKE ?', [tableName]);
  const exists = rows.length > 0;
  tableExistsCache.set(tableName, exists);
  return exists;
}

function getArtistTotalPlaysSubquery(artistAlias = 'a') {
  return `(
    SELECT COALESCE(SUM(COALESCE(s.play_count, 0)), 0)
    FROM songs s
    WHERE s.artist_id = ${artistAlias}.id
  )`;
}

async function getArtistStats(artistId) {
  const hasSongLikes = await tableExists('song_likes');
  const hasArtistFollows = await tableExists('artist_follows');

  const totalLikesSql = hasSongLikes
    ? `(
        SELECT COUNT(*)
        FROM song_likes sl
        JOIN songs s ON s.id = sl.song_id
        WHERE s.artist_id = a.id
      )`
    : '0';

  const totalFollowersSql = hasArtistFollows
    ? `(
        SELECT COUNT(*)
        FROM artist_follows af
        WHERE af.artist_id = a.id
      )`
    : '0';

  const [rows] = await pool.query(
    `SELECT
       a.id AS artist_id,
       (
         SELECT COUNT(*)
         FROM songs s
         WHERE s.artist_id = a.id
       ) AS totalSongs,
       (
         SELECT COUNT(DISTINCT s.album_id)
         FROM songs s
         WHERE s.artist_id = a.id
           AND s.album_id IS NOT NULL
       ) AS totalAlbums,
       ${getArtistTotalPlaysSubquery('a')} AS totalPlays,
       ${totalLikesSql} AS totalLikes,
       0 AS newLikesThisWeek,
       ${totalFollowersSql} AS totalFollowers,
       (
         SELECT COUNT(*)
         FROM songs s
         WHERE s.artist_id = a.id AND s.review_status = 'pending_review'
       ) AS pendingSongs,
       (
         SELECT COUNT(*)
         FROM albums al
         WHERE al.submitted_by_artist_id = a.id AND al.review_status = 'pending_review'
       ) AS pendingAlbums
     FROM artists a
     WHERE a.id = ?
     LIMIT 1`,
    [artistId]
  );

  const row = rows[0] || {};
  return {
    totalSongs: Number(row.totalSongs || 0),
    totalAlbums: Number(row.totalAlbums || 0),
    totalPlays: Number(row.totalPlays || 0),
    totalLikes: Number(row.totalLikes || 0),
    totalFollowers: Number(row.totalFollowers || 0),
    pendingSongs: Number(row.pendingSongs || 0),
    pendingAlbums: Number(row.pendingAlbums || 0)
  };
}

module.exports = {
  getArtistStats,
  getArtistTotalPlaysSubquery
};
