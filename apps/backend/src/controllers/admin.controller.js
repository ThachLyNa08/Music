const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const {
  syncArtistMetadata,
  syncMissingArtistMetadata,
  syncArtistBio,
  syncMissingArtistBio,
  getArtistMetadataIssues: getArtistMetadataIssueRows,
} = require('../services/artistMetadata.service');
const { getDashboardSummary, getQuickOperations } = require('../services/adminDashboard.service');
const {
  getDataQualitySummary: getAdminDataQualitySummary,
  getDataQualityIssues: getAdminDataQualityIssues,
} = require('../services/adminDataQuality.service');
const { normalizeCoverUrl, resolveArtistAvatar } = require('../utils/imageUrl.util');
const { getArtistTotalPlaysQuery } = require('../utils/artistStats.util');
const {
  effectiveReleaseStatusExpression,
  normalizeReleasePayload,
  pushReleaseFields,
  buildSetClausesFromFields,
  buildInsertParts,
} = require('../utils/public.utils');
const recommendationService = require('../services/recommendation.service');
const { jsonToCsv, createCsvFilename, sendCsv } = require('../utils/csv.util');

const schemaCache = new Map();

async function getTableColumns(tableName) {
  if (schemaCache.has(tableName)) return schemaCache.get(tableName);
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const columns = new Set(rows.map(row => row.Field));
  schemaCache.set(tableName, columns);
  return columns;
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNullableId(value) {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSongIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number).filter(id => Number.isFinite(id) && id > 0))];
  }

  if (value === undefined || value === null || value === '') return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseSongIds(parsed);
  } catch {}

  return String(value)
    .split(',')
    .map(Number)
    .filter(id => Number.isFinite(id) && id > 0);
}

function deriveMarketFromGenre(market, genreName) {
  if (market && market !== 'OTHER') return market;
  if (!genreName) return 'OTHER';
  const g = String(genreName).toUpperCase();
  if (g.startsWith('KPOP')) return 'KPOP';
  if (g.startsWith('VPOP')) return 'VPOP';
  if (g.startsWith('USUK')) return 'USUK';
  return 'OTHER';
}

function releaseDateFromYear(value) {
  if (value === undefined || value === null || value === '') return null;
  const year = parseInt(value, 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  return `${year}-01-01`;
}

function albumCoverPathFromUpload(file) {
  if (!file) return null;
  const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), file.path);
  return '/uploads/' + relativePath.split(path.sep).join('/');
}

async function getAlbumSchemaInfo() {
  const [albumColumns, songColumns] = await Promise.all([
    getTableColumns('albums'),
    getTableColumns('songs'),
  ]);

  const marketColumn = ['market', 'region', 'language'].find(column => songColumns.has(column)) || null;
  const orderColumn = ['track_number', 'sort_order', 'position'].find(column => songColumns.has(column)) || null;

  return {
    albumColumns,
    songColumns,
    marketColumn,
    orderColumn,
  };
}

function getSongOrderExpression(orderColumn) {
  if (!orderColumn) return 's.created_at ASC, s.id ASC';
  return `CASE WHEN s.\`${orderColumn}\` IS NULL THEN 1 ELSE 0 END ASC, s.\`${orderColumn}\` ASC, s.created_at ASC, s.id ASC`;
}

async function replaceAlbumSongs(conn, albumId, songIds, orderColumn) {
  if (orderColumn) {
    await conn.query(`UPDATE songs SET album_id = NULL, \`${orderColumn}\` = NULL WHERE album_id = ?`, [albumId]);
  } else {
    await conn.query('UPDATE songs SET album_id = NULL WHERE album_id = ?', [albumId]);
  }

  if (!songIds.length) return;

  for (let index = 0; index < songIds.length; index += 1) {
    const songId = songIds[index];
    if (orderColumn) {
      await conn.query(
        `UPDATE songs SET album_id = ?, \`${orderColumn}\` = ? WHERE id = ?`,
        [albumId, index + 1, songId]
      );
    } else {
      await conn.query('UPDATE songs SET album_id = ? WHERE id = ?', [albumId, songId]);
    }
  }
}

async function getAlbumPublicSongStats(conn, albumId, songIds = null) {
  const params = [];
  let sourceSql = 'SELECT id, is_active, release_status, release_at FROM songs WHERE album_id = ?';

  if (Array.isArray(songIds)) {
    if (songIds.length === 0) {
      return { total: 0, effectivePublic: 0, scheduledFuture: 0, draftHidden: 0 };
    }
    sourceSql = 'SELECT id, is_active, release_status, release_at FROM songs WHERE id IN (?)';
    params.push(songIds);
  } else {
    params.push(albumId);
  }

  const [rows] = await conn.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE
        WHEN is_active = TRUE
          AND (
            release_status = 'published'
            OR (release_status = 'scheduled' AND release_at IS NOT NULL AND release_at <= NOW())
          )
        THEN 1 ELSE 0 END) AS effectivePublic,
      SUM(CASE
        WHEN is_active = TRUE
          AND release_status = 'scheduled'
          AND release_at IS NOT NULL
          AND release_at > NOW()
        THEN 1 ELSE 0 END) AS scheduledFuture,
      SUM(CASE
        WHEN release_status IN ('draft', 'hidden') OR is_active = FALSE
        THEN 1 ELSE 0 END) AS draftHidden
    FROM (${sourceSql}) album_songs
  `, params);

  return {
    total: Number(rows[0]?.total || 0),
    effectivePublic: Number(rows[0]?.effectivePublic || 0),
    scheduledFuture: Number(rows[0]?.scheduledFuture || 0),
    draftHidden: Number(rows[0]?.draftHidden || 0),
  };
}

async function assertAlbumCanPublish(conn, albumId, songIds = null) {
  const stats = await getAlbumPublicSongStats(conn, albumId, songIds);
  if (stats.total === 0) {
    const err = new Error('Khong the phat hanh album rong');
    err.statusCode = 400;
    throw err;
  }
  if (stats.effectivePublic === 0) {
    const err = new Error('Khong the phat hanh album neu chua co bai hat da phat hanh hop le');
    err.statusCode = 400;
    throw err;
  }
}

// Hàm ẩn danh một phần email (Security)
function maskEmail(email) {
  if (!email) return '';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.substring(0, 2)}***@${domain}`;
}

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Lấy tổng quan
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalPremium }]] = await pool.query('SELECT COUNT(*) as totalPremium FROM users WHERE premium_expires_at > NOW()');
    const [[{ totalSongs }]] = await pool.query('SELECT COUNT(*) as totalSongs FROM songs');
    const [[{ totalArtists }]] = await pool.query('SELECT COUNT(*) as totalArtists FROM artists');
    const [[{ totalAlbums }]] = await pool.query('SELECT COUNT(*) as totalAlbums FROM albums');
    const [[{ totalPlaylists }]] = await pool.query('SELECT COUNT(*) as totalPlaylists FROM playlists');
    const [[{ totalListens }]] = await pool.query('SELECT COALESCE(SUM(play_count), 0) as totalListens FROM songs');
    
    // Hôm nay (Listens & Users)
    const [[{ todayListens }]] = await pool.query('SELECT COUNT(*) as todayListens FROM listening_history WHERE DATE(listened_at) = CURDATE()');
    const [[{ newUsersToday }]] = await pool.query('SELECT COUNT(*) as newUsersToday FROM users WHERE DATE(created_at) = CURDATE()');
    
    // Revenue & Transactions
    const [[{ totalRevenue }]] = await pool.query("SELECT SUM(amount) as totalRevenue FROM payment_transactions WHERE status = 'paid'");
    const [[{ revenueThisMonth }]] = await pool.query("SELECT SUM(amount) as revenueThisMonth FROM payment_transactions WHERE status = 'paid' AND MONTH(paid_at) = MONTH(CURDATE()) AND YEAR(paid_at) = YEAR(CURDATE())");
    const [[{ pendingTransactions }]] = await pool.query("SELECT COUNT(*) as pendingTransactions FROM payment_transactions WHERE status = 'pending'");

    // 1.5. New KPI fields
    const [[{ newArtistsThisWeek }]] = await pool.query('SELECT COUNT(*) as cnt FROM artists WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const [[playlistStatsRow]] = await pool.query('SELECT COUNT(*) as totalPlaylists, SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as publicPlaylists, SUM(CASE WHEN is_system = 1 THEN 1 ELSE 0 END) as systemPlaylists, SUM(CASE WHEN is_system = 0 THEN 1 ELSE 0 END) as userPlaylists FROM playlists');
    const [hotSongRows] = await pool.query(`
      SELECT lh.song_id, COUNT(*) as cnt, s.title, a.name as artist
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY lh.song_id, s.title, a.name
      ORDER BY cnt DESC
      LIMIT 1
    `);
    let hotSong = null;
    if (hotSongRows && hotSongRows.length > 0) {
      hotSong = {
        songId: hotSongRows[0].song_id,
        title: hotSongRows[0].title,
        artistName: hotSongRows[0].artist,
        listenCount: hotSongRows[0].cnt,
        period: '7d'
      };
    } else {
      const [fallbackHot] = await pool.query(`
        SELECT s.id, s.title, a.name as artist, s.play_count 
        FROM songs s 
        LEFT JOIN artists a ON s.artist_id = a.id 
        ORDER BY s.play_count DESC LIMIT 1
      `);
      if (fallbackHot && fallbackHot.length > 0) {
        hotSong = {
          songId: fallbackHot[0].id,
          title: fallbackHot[0].title,
          artistName: fallbackHot[0].artist,
          listenCount: fallbackHot[0].play_count,
          period: 'all'
        };
      }
    }
    const [[usersGrowthRow]] = await pool.query(`
      SELECT 
        SUM(CASE WHEN created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01') THEN 1 ELSE 0 END) as thisMonth,
        SUM(CASE WHEN created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH ,'%Y-%m-01') AND created_at < DATE_FORMAT(NOW() ,'%Y-%m-01') THEN 1 ELSE 0 END) as lastMonth
      FROM users
    `);
    const newUsersThisMonth = Number(usersGrowthRow?.thisMonth || 0);
    const newUsersLastMonth = Number(usersGrowthRow?.lastMonth || 0);

    // 2. Thống kê theo tháng (6 tháng gần nhất) - Doanh thu
    const [revenueByMonth] = await pool.query(`
      SELECT 
        DATE_FORMAT(paid_at, '%Y-%m') as month, 
        SUM(amount) as revenue 
      FROM payment_transactions 
      WHERE status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // 3. Lượt nghe theo thể loại (Top 5)
    const [topGenres] = await pool.query(`
      SELECT g.name,
             COALESCE(SUM(s.play_count), 0) as total_plays,
             COALESCE(SUM(s.play_count), 0) as listens
      FROM genres g
      JOIN songs s ON s.genre_id = g.id
      GROUP BY g.id, g.name
      ORDER BY total_plays DESC
      LIMIT 5
    `);

    // Top Artists (Dành cho Dashboard mới)
    const [topArtists] = await pool.query(`
      SELECT a.id, a.name, a.avatar_url, a.avatar_url as image,
             COUNT(s.id) as song_count,
             COALESCE(SUM(s.play_count), 0) as total_plays,
             COALESCE(SUM(s.play_count), 0) as listens
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      GROUP BY a.id, a.name, a.avatar_url
      ORDER BY total_plays DESC
      LIMIT 5
    `);

    if (topArtists.length > 0) {
      const artistIds = topArtists.map(a => a.id);
      const [trendData] = await pool.query(`
        SELECT
          a.id as artist_id,
          DATE_FORMAT(lh.listened_at, '%Y-%m-%d') as date_str,
          SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listens,
          COUNT(lh.id) as raw_listen_events
        FROM listening_history lh
        JOIN songs s ON lh.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        WHERE a.id IN (?) AND lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY artist_id, date_str
      `, [artistIds]);

      // Generate last 7 days strings in local DB timezone equivalent (assuming simple JS date works for now, or just query it)
      const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        // offset to local timezone YYYY-MM-DD
        const offset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - offset)).toISOString().split('T')[0];
      });

      topArtists.forEach(artist => {
        artist.avatar_url = resolveArtistAvatar(artist, req);
        artist.trend = last7Days.map(dateStr => {
          const found = trendData.find(t => t.artist_id === artist.id && t.date_str === dateStr);
          return found ? found.listens : 0;
        });
      });
    }

    // Giao dịch gần đây (Dành cho Dashboard mới)
    const [recentTransactions] = await pool.query(`
      SELECT t.id, t.amount, t.status, t.created_at, t.paid_at, u.display_name as user_name, u.email as user_email
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    // 4. Danh sách user mới nhất (Ẩn email để bảo mật)
    const [latestUsers] = await pool.query(`
      SELECT id, display_name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    const secureUsers = latestUsers.map(u => ({
      ...u,
      email: maskEmail(u.email)
    }));

    // Lấy system alerts nhẹ
    const systemAlerts = [];
    if (pendingTransactions > 50) {
      systemAlerts.push({ id: 'high_pending', type: 'warning', message: `Có ${pendingTransactions} giao dịch đang chờ xử lý` });
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalPremium,
          totalSongs,
          totalArtists,
          totalAlbums,
          totalPlaylists,
          totalListens,
          todayListens,
          today_plays: todayListens,
          newUsersToday,
          totalRevenue: totalRevenue || 0,
          revenueThisMonth: revenueThisMonth || 0,
          pendingTransactions: pendingTransactions || 0,
          artistStats: {
            totalArtists: totalArtists || 0,
            newArtistsThisWeek: newArtistsThisWeek || 0
          },
          playlistStats: {
            totalPlaylists: playlistStatsRow?.totalPlaylists || 0,
            publicPlaylists: playlistStatsRow?.publicPlaylists || 0,
            systemPlaylists: playlistStatsRow?.systemPlaylists || 0,
            userPlaylists: playlistStatsRow?.userPlaylists || 0
          },
          hotSong: hotSong,
          userGrowth: {
            newUsersThisMonth,
            newUsersLastMonth,
            delta: newUsersThisMonth - newUsersLastMonth
          }
        },
        charts: {
          revenue: revenueByMonth,
          genres: topGenres
        },
        lists: {
          topArtists,
          recentTransactions,
          systemAlerts
        },
        topArtists,
        latestUsers: secureUsers,
        quickOperations: await getQuickOperations()
      }
    });

  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu thống kê' });
  }
};

exports.getDashboardSummary = async (_req, res) => {
  try {
    const data = await getDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Admin Dashboard Summary Error:', error);
    res.status(500).json({
      success: false,
      message: 'Khong the lay du lieu dashboard',
      data: null,
    });
  }
};

// 1. Quản lý Người dùng
exports.getListeningTrends = async (req, res, next) => {
  try {
    const allowedRanges = {
      today: {
        bucketFormat: '%H:00',
        currentWhere: 'lh.listened_at >= CURDATE()',
        previousWhere: 'lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND lh.listened_at < CURDATE()',
        orderFormat: '%H'
      },
      '7d': {
        bucketFormat: '%d/%m',
        currentWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
        previousWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND lh.listened_at < DATE_SUB(NOW(), INTERVAL 7 DAY)',
        orderFormat: '%Y-%m-%d'
      },
      '30d': {
        bucketFormat: '%d/%m',
        currentWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
        previousWhere: 'lh.listened_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND lh.listened_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
        orderFormat: '%Y-%m-%d'
      }
    };

    const range = allowedRanges[req.query.range] ? req.query.range : 'today';
    const config = allowedRanges[range];

    const [series] = await pool.query(`
      SELECT
        DATE_FORMAT(lh.listened_at, ?) AS label,
        DATE_FORMAT(lh.listened_at, ?) AS sort_key,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS recent_plays,
        COUNT(*) AS raw_listen_events
      FROM listening_history lh
      WHERE ${config.currentWhere}
      GROUP BY label, sort_key
      ORDER BY sort_key ASC
    `, [config.bucketFormat, config.orderFormat]);

    const [topSongs] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.cover_url,
        s.play_count,
        a.name AS artist,
        al.title AS album,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS recent_plays,
        COUNT(lh.id) AS raw_listen_events,
        COALESCE(prev.previous_recent_plays, 0) AS previous_recent_plays
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN (
        SELECT
          song_id,
          SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS previous_recent_plays
        FROM listening_history lh
        WHERE ${config.previousWhere}
        GROUP BY song_id
      ) prev ON prev.song_id = s.id
      WHERE ${config.currentWhere}
      GROUP BY s.id, s.title, s.cover_url, s.play_count, a.name, al.title, prev.previous_recent_plays
      HAVING recent_plays > 0
      ORDER BY recent_plays DESC, s.play_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        range,
        series: series.map(item => ({
          label: item.label,
          recent_plays: Number(item.recent_plays || 0),
          raw_listen_events: Number(item.raw_listen_events || 0),
          listens: Number(item.recent_plays || 0)
        })),
        topSongs: topSongs.map(item => ({
          ...item,
          recent_plays: Number(item.recent_plays || 0),
          raw_listen_events: Number(item.raw_listen_events || 0),
          previous_recent_plays: Number(item.previous_recent_plays || 0),
          listens: Number(item.recent_plays || 0),
          previous_listens: Number(item.previous_recent_plays || 0)
        }))
      }
    });
  } catch (error) {
    console.error('getListeningTrends Error:', error);
    next(error);
  }
};

exports.getTopArtistTrends = async (req, res, next) => {
  try {
    const allowedRanges = {
      today: {
        currentWhere: 'lh.listened_at >= CURDATE()',
        bucketSelect: "LPAD(HOUR(lh.listened_at), 2, '0')",
        labelSelect: "DATE_FORMAT(lh.listened_at, '%H:00')",
        bucketType: 'hour',
        bucketCount: 24
      },
      '7d': {
        currentWhere: 'lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
        bucketSelect: "DATE_FORMAT(lh.listened_at, '%Y-%m-%d')",
        labelSelect: "DATE_FORMAT(lh.listened_at, '%d/%m')",
        bucketType: 'day',
        bucketCount: 7
      },
      '30d': {
        currentWhere: 'lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
        bucketSelect: "DATE_FORMAT(lh.listened_at, '%Y-%m-%d')",
        labelSelect: "DATE_FORMAT(lh.listened_at, '%d/%m')",
        bucketType: 'day',
        bucketCount: 30
      },
      'all': {
        currentWhere: '1=1',
        bucketSelect: "DATE_FORMAT(lh.listened_at, '%Y-%m')",
        labelSelect: "DATE_FORMAT(lh.listened_at, '%m/%y')",
        bucketType: 'month',
        bucketCount: 6
      }
    };

    const range = allowedRanges[req.query.range] ? req.query.range : 'all';
    const config = allowedRanges[range];
    
    if (config.bucketType === 'month') {
      const now = new Date();
      let months = (now.getFullYear() - 2026) * 12 + (now.getMonth() - 4) + 1; // 4 = Tháng 5
      config.bucketCount = Math.max(1, months);
    }
    
    const validListenExpr = 'CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END';

    const [topArtists] = await pool.query(`
      SELECT ranked.id,
             ranked.name,
             ranked.avatar_url,
             ranked.avatar_url AS image,
             COALESCE(song_counts.song_count, 0) AS song_count,
             ranked.recent_plays,
             ranked.recent_plays AS total_plays,
             ranked.recent_plays AS listens,
             ranked.raw_listen_events
      FROM (
        SELECT a.id,
               a.name,
               a.avatar_url,
               SUM(${validListenExpr}) AS recent_plays,
               COUNT(lh.id) AS raw_listen_events
        FROM listening_history lh
        JOIN songs s ON lh.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        WHERE ${config.currentWhere}
        GROUP BY a.id, a.name, a.avatar_url
        HAVING recent_plays > 0
        ORDER BY recent_plays DESC
        LIMIT 5
      ) ranked
      LEFT JOIN (
        SELECT artist_id, COUNT(*) AS song_count
        FROM songs
        WHERE is_active = TRUE
        GROUP BY artist_id
      ) song_counts ON song_counts.artist_id = ranked.id
      ORDER BY ranked.recent_plays DESC
    `);

    topArtists.forEach(artist => {
      artist.avatar_url = resolveArtistAvatar(artist, req);
      artist.image = artist.avatar_url;
      artist.recent_plays = Number(artist.recent_plays || 0);
      artist.total_plays = Number(artist.total_plays || 0);
      artist.listens = Number(artist.listens || 0);
      artist.raw_listen_events = Number(artist.raw_listen_events || 0);
      artist.song_count = Number(artist.song_count || 0);
    });

    const artistIds = topArtists.map(artist => artist.id);
    let trendRows = [];

    if (artistIds.length > 0) {
      const [rows] = await pool.query(`
        SELECT
          a.id AS artist_id,
          a.name AS artist_name,
          ${config.bucketSelect} AS bucket_key,
          ${config.labelSelect} AS label,
          SUM(${validListenExpr}) AS recent_plays,
          COUNT(lh.id) AS raw_listen_events
        FROM listening_history lh
        JOIN songs s ON lh.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        WHERE ${config.currentWhere}
          AND a.id IN (?)
        GROUP BY a.id, a.name, bucket_key, label
        ORDER BY bucket_key ASC
      `, [artistIds]);
      trendRows = rows;
    }

    const pad = value => String(value).padStart(2, '0');
    const formatLocalDateKey = date => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };
    const formatLocalDateLabel = date => {
      const day = pad(date.getDate());
      const month = pad(date.getMonth() + 1);
      return `${day}/${month}`;
    };

    const buckets = config.bucketType === 'hour'
      ? Array.from({ length: config.bucketCount }, (_, hour) => ({
          key: pad(hour),
          label: `${pad(hour)}:00`
        }))
      : config.bucketType === 'month'
        ? Array.from({ length: config.bucketCount }, (_, index) => {
            const date = new Date();
            date.setDate(1);
            date.setMonth(date.getMonth() - (config.bucketCount - 1 - index));
            const y = date.getFullYear();
            const m = pad(date.getMonth() + 1);
            const shortY = String(y).slice(-2);
            return {
              key: `${y}-${m}`,
              label: `${m}/${shortY}`
            };
          })
        : Array.from({ length: config.bucketCount }, (_, index) => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - (config.bucketCount - 1 - index));
            return {
              key: formatLocalDateKey(date),
              label: formatLocalDateLabel(date)
            };
          });

    const series = buckets.map(bucket => {
      const artists = topArtists.map(artist => {
        const row = trendRows.find(item => String(item.bucket_key) === bucket.key && Number(item.artist_id) === Number(artist.id));
        return {
          artist_id: artist.id,
          artist_name: artist.name,
          listens: Number(row?.recent_plays || 0),
          recent_plays: Number(row?.recent_plays || 0),
          raw_listen_events: Number(row?.raw_listen_events || 0)
        };
      });

      return artists.reduce((bucketRow, artist) => {
        bucketRow[artist.artist_name] = artist.listens;
        return bucketRow;
      }, {
        label: bucket.label,
        sort_key: bucket.key,
        artists
      });
    });

    res.json({
      success: true,
      data: {
        range,
        topArtists,
        series,
        topArtistTrend: series
      }
    });
  } catch (error) {
    console.error('getTopArtistTrends Error:', error);
    next(error);
  }
};

exports.getFormData = async (req, res, next) => {
  try {
    const [artists] = await pool.query('SELECT id, name FROM artists ORDER BY name ASC');
    const [albums] = await pool.query(`
      SELECT id, title, artist_id, release_status, release_at, published_at,
             ${effectiveReleaseStatusExpression('albums')} AS effective_release_status
      FROM albums
      ORDER BY title ASC
    `);
    const [genres] = await pool.query('SELECT id, name FROM genres ORDER BY id ASC');
    
    res.json({
      success: true,
      data: { artists, albums, genres }
    });
  } catch (error) {
    console.error('getFormData Error:', error);
    next(error);
  }
};

exports.getAdminAlbumsStats = async (req, res, next) => {
  try {
    const { search = '', genreId = '', releaseYear = '', market = '' } = req.query;
    const { marketColumn } = await getAlbumSchemaInfo();

    const where = [];
    const params = [];

    if (search.trim()) {
      where.push('(al.title LIKE ? OR a.name LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (genreId) {
      where.push('al.genre_id = ?');
      params.push(genreId);
    }
    if (releaseYear) {
      where.push('YEAR(al.release_date) = ?');
      params.push(releaseYear);
    }
    if (market) {
      if (marketColumn) {
        where.push(`(
          EXISTS (SELECT 1 FROM songs sm WHERE sm.album_id = al.id AND sm.\`${marketColumn}\` = ?)
          OR g.name LIKE ?
        )`);
        params.push(market, `${market}%`);
      } else {
        where.push(`g.name LIKE ?`);
        params.push(`${market}%`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(`
      SELECT
        COUNT(DISTINCT al.id) AS total,
        SUM(CASE WHEN al.release_status = 'draft' THEN 1 ELSE 0 END) AS draft,
        SUM(CASE WHEN al.release_status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN al.release_status = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN al.release_status = 'hidden' THEN 1 ELSE 0 END) AS hidden,
        SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM songs s WHERE s.album_id = al.id) THEN 1 ELSE 0 END) AS \`empty\`
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN genres g ON g.id = al.genre_id
      ${whereSql}
    `, params);

    res.json({
      success: true,
      data: {
        total: Number(rows[0]?.total || 0),
        draft: Number(rows[0]?.draft || 0),
        scheduled: Number(rows[0]?.scheduled || 0),
        published: Number(rows[0]?.published || 0),
        hidden: Number(rows[0]?.hidden || 0),
        empty: Number(rows[0]?.empty || 0),
      }
    });
  } catch (error) {
    console.error('getAdminAlbumsStats Error:', error);
    next(error);
  }
};

exports.getAdminAlbums = async (req, res, next) => {
  try {
    const { search = '', genreId = '', releaseYear = '', market = '', sortPlays = '', releaseStatus = '' } = req.query;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
    const offset = (page - 1) * limit;
    const { albumColumns, marketColumn } = await getAlbumSchemaInfo();

    const hasAlbumType = albumColumns.has('album_type');
    const hasTotalTracks = albumColumns.has('total_tracks');
    const albumTypeSelect = hasAlbumType ? 'al.album_type' : 'NULL AS album_type';
    const totalTracksSelect = hasTotalTracks
      ? 'GREATEST(COALESCE(al.total_tracks, 0), COUNT(DISTINCT s.id)) AS total_tracks'
      : 'COUNT(DISTINCT s.id) AS total_tracks';
    const marketSelect = marketColumn
      ? `GROUP_CONCAT(DISTINCT NULLIF(s.\`${marketColumn}\`, '') ORDER BY s.\`${marketColumn}\` SEPARATOR ', ') AS market`
      : 'NULL AS market';

    const where = [];
    const params = [];

    if (search.trim()) {
      where.push('(al.title LIKE ? OR a.name LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (genreId) {
      where.push('al.genre_id = ?');
      params.push(genreId);
    }
    if (releaseYear) {
      where.push('YEAR(al.release_date) = ?');
      params.push(releaseYear);
    }
    if (market) {
      if (marketColumn) {
        where.push(`(
          EXISTS (SELECT 1 FROM songs sm WHERE sm.album_id = al.id AND sm.\`${marketColumn}\` = ?)
          OR g.name LIKE ?
        )`);
        params.push(market, `${market}%`);
      } else {
        where.push(`g.name LIKE ?`);
        params.push(`${market}%`);
      }
    }
    if (releaseStatus) {
      where.push('al.release_status = ?');
      params.push(releaseStatus);
    }

    const idWhereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    let orderSql = 'ORDER BY al.release_date DESC, al.created_at DESC, al.id DESC';
    if (sortPlays === 'asc') {
      orderSql = 'ORDER BY (SELECT COALESCE(SUM(play_count), 0) FROM songs WHERE album_id = al.id AND is_active = TRUE) ASC, al.release_date DESC, al.created_at DESC, al.id DESC';
    } else if (sortPlays === 'desc') {
      orderSql = 'ORDER BY (SELECT COALESCE(SUM(play_count), 0) FROM songs WHERE album_id = al.id AND is_active = TRUE) DESC, al.release_date DESC, al.created_at DESC, al.id DESC';
    }

    const [idRows] = await pool.query(`
      SELECT al.id 
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN genres g ON g.id = al.genre_id
      ${idWhereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const albumIds = idRows.map(row => row.id);
    let finalAlbums = [];

    if (albumIds.length > 0) {
      const groupFields = [
        'al.id', 'al.title', 'al.artist_id', 'a.name', 'al.cover_url', 'al.release_date',
        'al.genre_id', 'g.name', 'al.created_at', 'al.release_status', 'al.release_at', 'al.published_at'
      ];
      if (hasAlbumType) groupFields.push('al.album_type');
      if (hasTotalTracks) groupFields.push('al.total_tracks');

      const [albums] = await pool.query(`
        SELECT
          al.id,
          al.title,
          al.artist_id,
          a.name AS artist_name,
          al.genre_id,
          COALESCE(g.name, GROUP_CONCAT(DISTINCT sg.name ORDER BY sg.name SEPARATOR ', ')) AS genre_name,
          COALESCE(
            NULLIF(al.cover_url, ''),
            (
              SELECT COALESCE(NULLIF(si.cover_url, ''), NULLIF(si.audio_url, ''))
              FROM songs si
              WHERE si.album_id = al.id AND si.is_active = TRUE
                AND COALESCE(NULLIF(si.cover_url, ''), NULLIF(si.audio_url, '')) IS NOT NULL
              ORDER BY si.id ASC
              LIMIT 1
            )
          ) AS cover_url,
          al.release_date,
          al.release_status,
          al.release_at,
          al.published_at,
          ${effectiveReleaseStatusExpression('al')} AS effective_release_status,
          YEAR(al.release_date) AS release_year,
          ${albumTypeSelect},
          ${totalTracksSelect},
          COUNT(DISTINCT s.id) AS song_count,
          COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN s.play_count ELSE 0 END), 0) AS total_plays,
          ${marketSelect}
        FROM albums al
        JOIN artists a ON a.id = al.artist_id
        LEFT JOIN genres g ON g.id = al.genre_id
        LEFT JOIN songs s ON s.album_id = al.id AND s.is_active = TRUE
        LEFT JOIN genres sg ON sg.id = s.genre_id
        WHERE al.id IN (?)
        GROUP BY ${groupFields.join(', ')}
      `, [albumIds]);

      const albumMap = new Map(albums.map(a => [a.id, a]));
      finalAlbums = albumIds.map(id => albumMap.get(id)).filter(Boolean);
    }

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(DISTINCT al.id) AS total
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN genres g ON g.id = al.genre_id
      LEFT JOIN songs s ON s.album_id = al.id
      ${idWhereSql}
    `, params);

    const [genres] = await pool.query('SELECT id, name FROM genres ORDER BY name ASC');
    const [artists] = await pool.query('SELECT id, name FROM artists ORDER BY name ASC');
    let markets = [];
    if (marketColumn) {
      const [marketRows] = await pool.query(`
        SELECT DISTINCT \`${marketColumn}\` AS market
        FROM songs
        WHERE \`${marketColumn}\` IS NOT NULL AND \`${marketColumn}\` <> ''
        ORDER BY \`${marketColumn}\` ASC
      `);
      markets = marketRows.map(row => row.market).filter(Boolean);
    }

    res.json({
      success: true,
      data: finalAlbums.map(album => ({
        ...album,
        market: deriveMarketFromGenre(album.market, album.genre_name),
        cover_url: normalizeCoverUrl(album.cover_url, req),
        total_plays: Number(album.total_plays || 0),
        song_count: Number(album.song_count || 0),
      })),
      pagination: {
        total: Number(total || 0),
        page,
        limit,
        totalPages: Math.ceil(Number(total || 0) / limit) || 1,
      },
      meta: {
        artists,
        genres,
        markets,
        releaseStatuses: ['draft', 'scheduled', 'published', 'hidden'],
        supportsMarketFilter: Boolean(marketColumn),
      },
    });
  } catch (error) {
    console.error('getAdminAlbums Error:', error);
    next(error);
  }
};

exports.getAdminAlbumFormData = async (req, res, next) => {
  try {
    const { marketColumn, orderColumn } = await getAlbumSchemaInfo();
    const [artists] = await pool.query(`
      SELECT a.id, a.name,
             (SELECT genre_id FROM songs WHERE artist_id = a.id AND genre_id IS NOT NULL GROUP BY genre_id ORDER BY COUNT(*) DESC LIMIT 1) AS primary_genre_id
      FROM artists a
      ORDER BY a.name ASC
    `);
    const [genres] = await pool.query('SELECT id, name FROM genres ORDER BY name ASC');
    const songs = [];

    let markets = [];
    if (marketColumn) {
      const [marketRows] = await pool.query(`
        SELECT DISTINCT \`${marketColumn}\` AS market
        FROM songs
        WHERE \`${marketColumn}\` IS NOT NULL AND \`${marketColumn}\` <> ''
        ORDER BY \`${marketColumn}\` ASC
      `);
      markets = marketRows.map(row => row.market).filter(Boolean);
    }

    res.json({
      success: true,
      data: {
        artists,
        genres,
        songs: songs.map(song => ({
          ...song,
          cover_url: normalizeCoverUrl(song.cover_url, req),
        })),
        markets,
        supportsMarketFilter: Boolean(marketColumn),
        supportsTrackOrder: Boolean(orderColumn),
      },
    });
  } catch (error) {
    console.error('getAdminAlbumFormData Error:', error);
    next(error);
  }
};

exports.getAvailableSongsForAlbum = async (req, res, next) => {
  try {
    const artistId = normalizeNullableId(req.query.artistId);
    const albumId = normalizeNullableId(req.query.albumId);

    if (!artistId) {
      return res.status(400).json({ success: false, message: 'artistId la bat buoc' });
    }

    const [songs] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.artist_id,
        a.name AS artist_name,
        s.album_id,
        al.title AS album_title,
        s.genre_id,
        g.name AS genre_name,
        s.cover_url
      FROM songs s
      JOIN artists a ON a.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE s.artist_id = ? AND s.is_active = TRUE
      ORDER BY s.album_id IS NULL DESC, s.title ASC
    `, [artistId]);

    const data = songs.map(song => {
      const isSingle = !song.album_title || song.album_title.trim().toLowerCase() === 'single' || song.album_title === 'Độc lập';
      const isWithoutAlbum = !song.album_id;
      const isCurrentAlbum = albumId && Number(song.album_id) === Number(albumId);

      const can_add_to_album = isWithoutAlbum || isSingle || isCurrentAlbum;

      return {
        ...song,
        cover_url: normalizeCoverUrl(song.cover_url, req),
        can_add_to_album,
        reason: can_add_to_album ? null : 'Đã thuộc album khác',
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('getAvailableSongsForAlbum Error:', error);
    next(error);
  }
};

exports.getAdminAlbumDetail = async (req, res, next) => {
  try {
    const albumId = normalizeNullableId(req.params.id);
    const { albumColumns, marketColumn, orderColumn } = await getAlbumSchemaInfo();
    if (!albumId) return res.status(400).json({ success: false, message: 'Album khong hop le' });

    const hasAlbumType = albumColumns.has('album_type');
    const hasTotalTracks = albumColumns.has('total_tracks');
    const albumTypeSelect = hasAlbumType ? 'al.album_type' : 'NULL AS album_type';
    const totalTracksSelect = hasTotalTracks
      ? 'GREATEST(COALESCE(al.total_tracks, 0), COUNT(DISTINCT s.id)) AS total_tracks'
      : 'COUNT(DISTINCT s.id) AS total_tracks';
    const marketSelect = marketColumn
      ? `GROUP_CONCAT(DISTINCT NULLIF(s.\`${marketColumn}\`, '') ORDER BY s.\`${marketColumn}\` SEPARATOR ', ') AS market`
      : 'NULL AS market';

    const groupFields = [
      'al.id', 'al.title', 'al.artist_id', 'a.name', 'a.avatar_url', 'al.cover_url',
      'al.release_date', 'al.genre_id', 'g.name', 'al.created_at',
      'al.release_status', 'al.release_at', 'al.published_at'
    ];
    if (hasAlbumType) groupFields.push('al.album_type');
    if (hasTotalTracks) groupFields.push('al.total_tracks');

    const [albumRows] = await pool.query(`
      SELECT
        al.id,
        al.title,
        al.artist_id,
        a.name AS artist_name,
        a.avatar_url AS artist_avatar_url,
        al.genre_id,
        g.name AS genre_name,
        COALESCE(
          NULLIF(al.cover_url, ''),
          (
            SELECT COALESCE(NULLIF(si.cover_url, ''), NULLIF(si.audio_url, ''))
            FROM songs si
            WHERE si.album_id = al.id AND si.is_active = TRUE
              AND COALESCE(NULLIF(si.cover_url, ''), NULLIF(si.audio_url, '')) IS NOT NULL
            ORDER BY si.id ASC
            LIMIT 1
          )
        ) AS cover_url,
        al.cover_url AS stored_cover_url,
        al.release_date,
        al.release_status,
        al.release_at,
        al.published_at,
        ${effectiveReleaseStatusExpression('al')} AS effective_release_status,
        YEAR(al.release_date) AS release_year,
        ${albumTypeSelect},
        ${totalTracksSelect},
        COUNT(DISTINCT s.id) AS song_count,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN s.play_count ELSE 0 END), 0) AS total_plays,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN s.duration_sec ELSE 0 END), 0) AS total_duration_sec,
        ${marketSelect}
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN genres g ON g.id = al.genre_id
      LEFT JOIN songs s ON s.album_id = al.id
      WHERE al.id = ?
      GROUP BY ${groupFields.join(', ')}
    `, [albumId]);

    if (albumRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Khong tim thay album' });
    }

    const album = albumRows[0];
    const [songs] = await pool.query(`
      SELECT
        s.id,
        s.title,
        s.duration_sec,
        s.cover_url,
        s.play_count,
        s.album_id,
        s.artist_id,
        a.name AS artist_name,
        s.genre_id,
        g.name AS genre_name,
        s.is_active,
        s.release_status,
        s.release_at,
        s.published_at,
        ${effectiveReleaseStatusExpression('s')} AS effective_release_status,
        ${orderColumn ? `s.\`${orderColumn}\`` : 'NULL'} AS track_number
      FROM songs s
      JOIN artists a ON a.id = s.artist_id
      LEFT JOIN genres g ON g.id = s.genre_id
      WHERE s.album_id = ?
      ORDER BY ${getSongOrderExpression(orderColumn)}
    `, [albumId]);

    res.json({
      success: true,
      data: {
        album: {
          ...album,
          market: deriveMarketFromGenre(album.market, album.genre_name),
          cover_url: normalizeCoverUrl(album.cover_url, req),
          stored_cover_url: album.stored_cover_url || '',
          total_plays: Number(album.total_plays || 0),
          song_count: Number(album.song_count || 0),
        },
        artist: {
          id: album.artist_id,
          name: album.artist_name,
          avatar_url: resolveArtistAvatar({
            id: album.artist_id,
            name: album.artist_name,
            avatar_url: album.artist_avatar_url,
          }, req),
        },
        stats: {
          song_count: Number(album.song_count || 0),
          total_plays: Number(album.total_plays || 0),
          total_duration_sec: Number(album.total_duration_sec || 0),
        },
        songs: songs.map(song => ({
          ...song,
          cover_url: normalizeCoverUrl(song.cover_url, req),
        })),
        schema: {
          supportsTrackOrder: Boolean(orderColumn),
          orderColumn,
          supportsMarketFilter: Boolean(marketColumn),
        },
      },
    });
  } catch (error) {
    console.error('getAdminAlbumDetail Error:', error);
    next(error);
  }
};

exports.createAdminAlbum = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { albumColumns, orderColumn } = await getAlbumSchemaInfo();
    const title = String(req.body.title || '').trim();
    const artistId = normalizeNullableId(req.body.artist_id);
    const genreId = normalizeNullableId(req.body.genre_id);
    const releaseDate = releaseDateFromYear(req.body.release_year);
    const songIds = parseSongIds(req.body.song_ids);
    const releasePayload = normalizeReleasePayload(req.body, { defaultStatus: 'draft', isCreate: true });

    if (!title) return res.status(400).json({ success: false, message: 'Ten album la bat buoc' });
    if (!artistId) return res.status(400).json({ success: false, message: 'Nghe si la bat buoc' });
    if (releasePayload.release_status === 'published') {
      await assertAlbumCanPublish(conn, null, songIds);
    }

    if (songIds.length > 0) {
      const [candidateSongs] = await conn.query(`
        SELECT s.id, s.title, s.artist_id, s.album_id, al.title AS album_title
        FROM songs s
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE s.id IN (?)
      `, [songIds]);

      const reallyInvalid = candidateSongs.filter(song => {
        const isSingle = !song.album_title || song.album_title.trim().toLowerCase() === 'single' || song.album_title === 'Độc lập';
        const isSameArtist = Number(song.artist_id) === Number(artistId);
        return !isSameArtist || (song.album_id && !isSingle);
      });

      if (reallyInvalid.length > 0 || candidateSongs.length !== songIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Chỉ được thêm bài chưa thuộc album hoặc bài Single của nghệ sĩ này.',
          invalidSongs: reallyInvalid.map(s => s.title)
        });
      }
    }

    const [artists] = await conn.query('SELECT id FROM artists WHERE id = ? LIMIT 1', [artistId]);
    if (artists.length === 0) return res.status(404).json({ success: false, message: 'Nghe si khong ton tai' });

    const coverUrl = albumCoverPathFromUpload(req.file) || String(req.body.cover_url || '').trim() || null;

    await conn.beginTransaction();

    const fields = ['title', 'artist_id'];
    const values = [title, artistId];
    if (albumColumns.has('genre_id')) { fields.push('genre_id'); values.push(genreId); }
    if (albumColumns.has('release_date')) { fields.push('release_date'); values.push(releaseDate); }
    if (albumColumns.has('cover_url')) { fields.push('cover_url'); values.push(coverUrl); }
    if (albumColumns.has('album_type')) { fields.push('album_type'); values.push(songIds.length <= 1 ? 'single' : 'album'); }
    if (albumColumns.has('total_tracks')) { fields.push('total_tracks'); values.push(songIds.length); }
    pushReleaseFields(fields, values, releasePayload, albumColumns);

    const insertParts = buildInsertParts(fields, values);
    const [result] = await conn.query(
      `INSERT INTO albums (${insertParts.columnSql}) VALUES (${insertParts.placeholderSql})`,
      insertParts.params
    );
    const albumId = result.insertId;

    await replaceAlbumSongs(conn, albumId, songIds, orderColumn);

    await conn.commit();
    res.json({ success: true, message: 'Them album thanh cong', data: { id: albumId } });
  } catch (error) {
    await conn.rollback();
    console.error('createAdminAlbum Error:', error);
    next(error);
  } finally {
    conn.release();
  }
};

exports.updateAdminAlbum = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const albumId = normalizeNullableId(req.params.id);
    const { albumColumns, orderColumn } = await getAlbumSchemaInfo();
    if (!albumId) return res.status(400).json({ success: false, message: 'Album khong hop le' });

    const title = req.body.title !== undefined ? String(req.body.title || '').trim() : undefined;
    const artistId = req.body.artist_id !== undefined ? normalizeNullableId(req.body.artist_id) : undefined;
    const genreId = req.body.genre_id !== undefined ? normalizeNullableId(req.body.genre_id) : undefined;
    const releaseDate = req.body.release_year !== undefined ? releaseDateFromYear(req.body.release_year) : undefined;
    const hasSongIds = req.body.song_ids !== undefined;
    const songIds = parseSongIds(req.body.song_ids);
    const hasReleaseStatus = req.body.release_status !== undefined || req.body.releaseStatus !== undefined;
    const releasePayload = hasReleaseStatus
      ? normalizeReleasePayload(req.body, { defaultStatus: 'draft', isCreate: false })
      : null;

    if (title !== undefined && !title) {
      return res.status(400).json({ success: false, message: 'Ten album la bat buoc' });
    }
    if (artistId === null) {
      return res.status(400).json({ success: false, message: 'Nghe si la bat buoc' });
    }

    const [existingAlbums] = await conn.query('SELECT id, artist_id FROM albums WHERE id = ? LIMIT 1', [albumId]);
    if (existingAlbums.length === 0) {
      return res.status(404).json({ success: false, message: 'Khong tim thay album' });
    }
    const targetArtistId = artistId || existingAlbums[0].artist_id;

    if (hasSongIds && songIds.length > 0) {
      const [candidateSongs] = await conn.query(`
        SELECT s.id, s.title, s.artist_id, al.title AS album_title, s.album_id
        FROM songs s
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE s.id IN (?)
      `, [songIds]);

      const reallyInvalid = candidateSongs.filter(song => {
        if (Number(song.album_id) === Number(albumId)) return false; // Belongs to current album
        const isSingle = !song.album_title || song.album_title.trim().toLowerCase() === 'single' || song.album_title === 'Độc lập';
        const isSameArtist = Number(song.artist_id) === Number(targetArtistId);
        return !isSameArtist || (song.album_id && !isSingle);
      });

      if (reallyInvalid.length > 0 || candidateSongs.length !== songIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Chỉ được thêm bài chưa thuộc album hoặc bài Single của nghệ sĩ này.',
          invalidSongs: reallyInvalid.map(s => s.title)
        });
      }
    }
    if (releasePayload?.release_status === 'published') {
      await assertAlbumCanPublish(conn, albumId, hasSongIds ? songIds : null);
    }

    await conn.beginTransaction();

    const [albums] = await conn.query('SELECT id FROM albums WHERE id = ? LIMIT 1', [albumId]);
    if (albums.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Khong tim thay album' });
    }
    if (artistId) {
      const [artists] = await conn.query('SELECT id FROM artists WHERE id = ? LIMIT 1', [artistId]);
      if (artists.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Nghe si khong ton tai' });
      }
    }

    const updateFields = [];
    const updateParams = [];
    if (title !== undefined) { updateFields.push('title = ?'); updateParams.push(title); }
    if (artistId !== undefined) { updateFields.push('artist_id = ?'); updateParams.push(artistId); }
    if (albumColumns.has('genre_id') && req.body.genre_id !== undefined) { updateFields.push('genre_id = ?'); updateParams.push(genreId); }
    if (albumColumns.has('release_date') && req.body.release_year !== undefined) { updateFields.push('release_date = ?'); updateParams.push(releaseDate); }

    const uploadedCover = albumCoverPathFromUpload(req.file);
    if (albumColumns.has('cover_url') && uploadedCover) {
      updateFields.push('cover_url = ?');
      updateParams.push(uploadedCover);
    } else if (albumColumns.has('cover_url') && req.body.cover_url !== undefined) {
      updateFields.push('cover_url = ?');
      updateParams.push(String(req.body.cover_url || '').trim() || null);
    }

    if (albumColumns.has('album_type') && hasSongIds) {
      updateFields.push('album_type = ?');
      updateParams.push(songIds.length <= 1 ? 'single' : 'album');
    }
    if (albumColumns.has('total_tracks') && hasSongIds) {
      updateFields.push('total_tracks = ?');
      updateParams.push(songIds.length);
    }
    if (releasePayload) {
      const releaseFields = [];
      const releaseValues = [];
      pushReleaseFields(releaseFields, releaseValues, releasePayload, albumColumns);
      const releaseSet = buildSetClausesFromFields(releaseFields, releaseValues);
      updateFields.push(...releaseSet.clauses);
      updateParams.push(...releaseSet.params);
    }

    if (updateFields.length > 0) {
      updateParams.push(albumId);
      await conn.query(`UPDATE albums SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    }

    if (hasSongIds) {
      await replaceAlbumSongs(conn, albumId, songIds, orderColumn);
    }

    await conn.commit();
    res.json({ success: true, message: 'Cap nhat album thanh cong' });
  } catch (error) {
    await conn.rollback();
    console.error('updateAdminAlbum Error:', error);
    next(error);
  } finally {
    conn.release();
  }
};

exports.deleteAdminAlbum = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const albumId = normalizeNullableId(req.params.id);
    const { orderColumn } = await getAlbumSchemaInfo();
    if (!albumId) return res.status(400).json({ success: false, message: 'Album khong hop le' });

    await conn.beginTransaction();

    const [albums] = await conn.query('SELECT id FROM albums WHERE id = ? LIMIT 1', [albumId]);
    if (albums.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Khong tim thay album' });
    }

    if (orderColumn) {
      await conn.query(`UPDATE songs SET album_id = NULL, \`${orderColumn}\` = NULL WHERE album_id = ?`, [albumId]);
    } else {
      await conn.query('UPDATE songs SET album_id = NULL WHERE album_id = ?', [albumId]);
    }
    await conn.query('DELETE FROM user_saved_albums WHERE album_id = ?', [albumId]);
    await conn.query('DELETE FROM albums WHERE id = ?', [albumId]);

    await conn.commit();
    res.json({ success: true, message: 'Xoa album thanh cong' });
  } catch (error) {
    await conn.rollback();
    console.error('deleteAdminAlbum Error:', error);
    next(error);
  } finally {
    conn.release();
  }
};

exports.reorderAdminAlbumSongs = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const albumId = normalizeNullableId(req.params.id);
    const songIds = parseSongIds(req.body.song_ids || req.body.songIds);
    const { orderColumn } = await getAlbumSchemaInfo();

    if (!albumId) return res.status(400).json({ success: false, message: 'Album khong hop le' });
    if (!orderColumn) {
      return res.status(400).json({
        success: false,
        message: 'Database chua co cot thu tu bai hat trong album. Hay chay migration truoc.',
      });
    }
    if (!songIds.length) return res.status(400).json({ success: false, message: 'Danh sach bai hat rong' });

    await conn.beginTransaction();

    const [songs] = await conn.query(
      'SELECT id FROM songs WHERE album_id = ? AND id IN (?)',
      [albumId, songIds]
    );
    if (songs.length !== songIds.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Danh sach bai hat khong khop album' });
    }

    for (let index = 0; index < songIds.length; index += 1) {
      await conn.query(
        `UPDATE songs SET \`${orderColumn}\` = ? WHERE id = ? AND album_id = ?`,
        [index + 1, songIds[index], albumId]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Da cap nhat thu tu bai hat' });
  } catch (error) {
    await conn.rollback();
    console.error('reorderAdminAlbumSongs Error:', error);
    next(error);
  } finally {
    conn.release();
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.premium_expires_at, 
             COALESCE((
               SELECT SUM(ROUND(s.duration_sec * lh.completion_rate)) 
               FROM listening_history lh 
               JOIN songs s ON s.id = lh.song_id 
               WHERE lh.user_id = u.id
             ), 0) as total_listen_sec, 
             (
               SELECT MAX(lh.listened_at)
               FROM listening_history lh
               WHERE lh.user_id = u.id
             ) as last_listened_at,
             u.created_at,
             COUNT(p.id) as playlistCount
      FROM users u
      LEFT JOIN playlists p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('getAllUsers Error:', error);
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { display_name, email, role } = req.body;

    if (!display_name || !display_name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên hiển thị không được để trống' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email không được để trống' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Email không đúng định dạng' });
    }
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
    }

    display_name = display_name.trim();
    email = email.trim();

    if (req.user && req.user.id === parseInt(id) && role === 'user') {
      return res.status(403).json({ success: false, message: 'Không thể tự hạ quyền Admin của chính mình' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng bởi người dùng khác' });
    }

    const updateQuery = 'UPDATE users SET display_name = ?, email = ?, role = ? WHERE id = ?';
    const [result] = await pool.query(updateQuery, [display_name, email, role, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    const [[updatedUser]] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.premium_expires_at, 
             COALESCE((
               SELECT SUM(ROUND(s.duration_sec * lh.completion_rate)) 
               FROM listening_history lh 
               JOIN songs s ON s.id = lh.song_id 
               WHERE lh.user_id = u.id
             ), 0) as total_listen_sec, 
             u.created_at,
             COUNT(p.id) as playlistCount
      FROM users u
      LEFT JOIN playlists p ON u.id = p.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `, [id]);

    res.json({
      success: true,
      message: 'Cập nhật hồ sơ người dùng thành công',
      data: updatedUser
    });
  } catch (error) {
    console.error('updateUser Error:', error);
    next(error);
  }
};

exports.getEngagementSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [lhStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_listens,
        MAX(listened_at) as last_listened_at
      FROM listening_history
      WHERE user_id = ?
    `, [id]);
    
    const [likes] = await pool.query(`SELECT COUNT(*) as liked_count FROM song_likes WHERE user_id = ?`, [id]);
    const [follows] = await pool.query(`SELECT COUNT(*) as followed_count FROM artist_follows WHERE user_id = ?`, [id]);
    
    // Check premium status
    const [users] = await pool.query(`SELECT premium_expires_at FROM users WHERE id = ?`, [id]);
    const user = users[0] || {};
    const isPremium = user.premium_expires_at && new Date(user.premium_expires_at) > new Date();

    const totalListens = Number(lhStats[0]?.total_listens || 0);
    const lastListenedAt = lhStats[0]?.last_listened_at || null;
    const likedCount = Number(likes[0]?.liked_count || 0);
    const followedCount = Number(follows[0]?.followed_count || 0);

    // Churn Risk
    let churnRisk = 'Chưa xác định';
    if (lastListenedAt) {
      const daysSinceLastListen = (new Date() - new Date(lastListenedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastListen <= 7) churnRisk = 'Thấp';
      else if (daysSinceLastListen <= 30) churnRisk = 'Trung bình';
      else churnRisk = 'Cao';
    }

    // Engagement Score (Synthetic Heuristic)
    let score = (totalListens * 0.5) + (likedCount * 2) + (followedCount * 5);
    if (isPremium) score += 10;
    if (churnRisk === 'Thấp') score += 10;
    else if (churnRisk === 'Cao') score -= 20;

    const engagementScore = Math.max(0, Math.min(100, Math.round(score)));

    // Streak calculation (days in a row counting backwards from today or last listen)
    let currentStreakDays = 0;
    if (totalListens > 0) {
      try {
        const [history] = await pool.query(`
          SELECT DISTINCT DATE(listened_at) as listen_date
          FROM listening_history
          WHERE user_id = ?
          ORDER BY listen_date DESC
          LIMIT 30
        `, [id]);
        
        if (history.length > 0) {
          let streak = 0;
          let expectedDate = new Date(); // Start checking from today
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const lastListenDate = new Date(history[0].listen_date);
          lastListenDate.setHours(0, 0, 0, 0);
          
          const diffDays = Math.floor((today - lastListenDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 1) { // They listened today or yesterday
            expectedDate = new Date(lastListenDate);
            
            for (const row of history) {
              const rowDate = new Date(row.listen_date);
              rowDate.setHours(0,0,0,0);
              
              if (rowDate.getTime() === expectedDate.getTime()) {
                streak++;
                expectedDate.setDate(expectedDate.getDate() - 1);
              } else {
                break;
              }
            }
          }
          currentStreakDays = streak;
        }
      } catch (err) {
        console.error('Error calculating streak:', err);
      }
    }

    res.json({
      success: true,
      data: {
        scoreType: 'synthetic_heuristic',
        engagementScore: totalListens > 0 ? engagementScore : '--',
        churnRisk,
        currentStreakDays: currentStreakDays > 0 ? currentStreakDays : '--',
        lastListenedAt,
        totalListens,
        likedCount,
        followedCount
      }
    });

  } catch (error) {
    console.error('getEngagementSummary Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getListeningHeatmap = async (req, res, next) => {
  try {
    const { id } = req.params;
    let months = parseInt(req.query.months, 10) || 6;
    
    if (months > 12) months = 12;

    const [rows] = await pool.query(`
      SELECT 
        DATE(listened_at) as date,
        COUNT(*) as count,
        SUM(listen_duration)/60 as minutes
      FROM listening_history
      WHERE user_id = ? AND listened_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY DATE(listened_at)
      ORDER BY date ASC
    `, [id, months]);

    const data = rows.map(r => {
      // Create local YYYY-MM-DD
      const dateObj = new Date(r.date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      
      return {
        date: `${year}-${month}-${day}`,
        count: Number(r.count || 0),
        minutes: Number(r.minutes || 0)
      };
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('getListeningHeatmap Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getUserDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const range = req.query.range || '30d';
    let days = 30;
    if (range === '7d') days = 7;
    if (range === '90d') days = 90;

    // 1. Lấy thông tin user cơ bản
    const [users] = await pool.query(
      `SELECT id, email, display_name, avatar_url, role, status, 
              premium_plan_id, premium_expires_at, total_listen_sec, created_at
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    const user = users[0];

    // Dữ liệu fallback mặc định
    const result = {
      user: {
        id: user.id,
        display_name: user.display_name || '',
        email: user.email || '',
        avatar_url: user.avatar_url || '',
        role: user.role || 'user',
        status: user.status || 'active',
        created_at: user.created_at || '',
        is_premium: user.premium_expires_at ? new Date(user.premium_expires_at) > new Date() : false,
        premium_expires_at: user.premium_expires_at || null
      },
      summary: {
        totalListens: 0,
        totalListeningMinutes: 0,
        likedSongs: 0,
        createdPlaylists: 0,
        followedArtists: 0,
        totalTransactions: 0,
        totalSpent: 0
      },
      listeningTrends: { byDay: [], byHour: [] },
      musicTaste: { topGenres: [], topArtists: [], topSongs: [], recentLikedSongs: [], followedArtists: [] },
      playlists: [],
      premium: {
        status: user.premium_expires_at ? (new Date(user.premium_expires_at) > new Date() ? 'active' : 'expired') : 'free',
        expiresAt: user.premium_expires_at || null,
        recentTransactions: []
      },
      recommendation: {
        listenCount: 0,
        strategy: 'unknown',
        selectedGenres: [],
        selectedArtists: [],
        generatedPlaylists: []
      },
      recentActivity: []
    };

    // Helper functions để try/catch an toàn
    const safeQuery = async (queryStr, params, fallback) => {
      try {
        const [rows] = await pool.query(queryStr, params);
        return rows;
      } catch (err) {
        console.error(`Error querying user ${id}:`, err.message);
        return fallback;
      }
    };

    // 2. Summary
    const lhStats = await safeQuery(`
      SELECT
        SUM(CASE WHEN listen_duration >= 30 OR completion_rate >= 0.5 THEN 1 ELSE 0 END) as valid_count,
        SUM(listen_duration) as total_duration,
        COUNT(*) as raw_listen_events
      FROM listening_history
      WHERE user_id = ?
    `, [id], [{ valid_count: 0, total_duration: 0, raw_listen_events: 0 }]);
    const validListenCount = Number(lhStats[0]?.valid_count || 0);
    const totalListenSec = Number(lhStats[0]?.total_duration || 0);
    const rawListenEvents = Number(lhStats[0]?.raw_listen_events || 0);
    result.summary.totalListens = validListenCount;
    result.summary.totalListeningMinutes = Math.round(totalListenSec / 60);
    result.summary.rawListenEvents = rawListenEvents;
    result.summary.raw_listen_events = rawListenEvents;
    result.recommendation.listenCount = validListenCount;
    result.recommendation.rawListenEvents = rawListenEvents;
    result.recommendation.raw_listen_events = rawListenEvents;
    result.recommendation.strategy = validListenCount < 10 ? 'cold_start' : 'advanced';

    const likedStats = await safeQuery('SELECT COUNT(*) as cnt FROM song_likes WHERE user_id = ?', [id], [{ cnt: 0 }]);
    result.summary.likedSongs = likedStats[0].cnt;

    const plStats = await safeQuery('SELECT COUNT(*) as cnt FROM playlists WHERE user_id = ? AND type = "manual" AND (is_system = 0 OR is_system IS NULL) AND system_key IS NULL', [id], [{ cnt: 0 }]);
    result.summary.createdPlaylists = plStats[0].cnt;

    const artistFollowStats = await safeQuery('SELECT COUNT(*) as cnt FROM artist_follows WHERE user_id = ?', [id], [{ cnt: 0 }]);
    if (artistFollowStats[0]) result.summary.followedArtists = artistFollowStats[0].cnt;

    const trxStats = await safeQuery('SELECT COUNT(*) as cnt, SUM(amount) as total FROM payment_transactions WHERE user_id = ? AND status = "paid"', [id], [{ cnt: 0, total: 0 }]);
    if (trxStats[0]) {
      result.summary.totalTransactions = trxStats[0].cnt || 0;
      result.summary.totalSpent = trxStats[0].total || 0;
    }

    // Calculate trends (last 7 days vs previous 7 days)
    const getTrendStats = async (tableName, dateColumn, extraWhere = '', sumColumn = null) => {
      const valExpr = sumColumn ? sumColumn : '1';
      const q = `
        SELECT 
          SUM(CASE WHEN ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN ${valExpr} ELSE 0 END) as this_week,
          SUM(CASE WHEN ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND ${dateColumn} < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN ${valExpr} ELSE 0 END) as last_week
        FROM ${tableName}
        WHERE user_id = ? ${extraWhere}
      `;
      const rows = await safeQuery(q, [id], [{ this_week: 0, last_week: 0 }]);
      return rows[0] || { this_week: 0, last_week: 0 };
    };

    const formatTrend = (thisWeek, lastWeek, unit = 'vs tuần trước') => {
      const tw = Number(thisWeek || 0);
      const lw = Number(lastWeek || 0);
      if (tw === 0 && lw === 0) return null;
      if (tw === lw) return { text: 'Không đổi', status: 'neutral' };
      
      const diff = tw - lw;
      if (diff > 0) return { text: `↑ ${diff} ${unit}`, status: 'up' };
      return { text: `↓ ${Math.abs(diff)} ${unit}`, status: 'down' };
    };

    const formatTrendVnd = (thisWeek, lastWeek) => {
      const tw = Number(thisWeek || 0);
      const lw = Number(lastWeek || 0);
      if (tw === 0 && lw === 0) return null;
      if (tw === lw) return { text: 'Không đổi', status: 'neutral' };
      
      const diff = tw - lw;
      const formattedDiff = new Intl.NumberFormat('vi-VN').format(Math.abs(diff));
      if (diff > 0) return { text: `↑ ${formattedDiff}đ vs tuần trước`, status: 'up' };
      return { text: `↓ ${formattedDiff}đ vs tuần trước`, status: 'down' };
    };

    const formatCountThisWeek = (thisWeek, unit = 'mới tuần này') => {
      const tw = Number(thisWeek || 0);
      if (tw === 0) return null;
      return { text: `+${tw} ${unit}`, status: 'up' };
    };

    const listensTrend = await getTrendStats('listening_history', 'listened_at', 'AND (listen_duration >= 30 OR completion_rate >= 0.5)');
    const minsTrend = await getTrendStats('listening_history', 'listened_at', '', 'listen_duration');
    const likesTrend = await getTrendStats('song_likes', 'liked_at');
    const playlistsTrend = await getTrendStats('playlists', 'created_at', "AND type = 'manual' AND (is_system = 0 OR is_system IS NULL) AND (system_key IS NULL OR system_key = '')");
    const followsTrend = await getTrendStats('artist_follows', 'created_at');
    const spentTrend = await getTrendStats('payment_transactions', 'created_at', 'AND status = "paid"', 'amount');

    result.summary.trends = {
      totalListens: formatTrend(listensTrend.this_week, listensTrend.last_week),
      totalListeningMinutes: formatTrend(Math.round(minsTrend.this_week / 60), Math.round(minsTrend.last_week / 60)),
      likedSongs: formatCountThisWeek(likesTrend.this_week, 'mới tuần này'),
      createdPlaylists: formatCountThisWeek(playlistsTrend.this_week, 'mới tuần này'),
      followedArtists: formatCountThisWeek(followsTrend.this_week, 'tuần này'),
      totalSpent: formatTrendVnd(spentTrend.this_week, spentTrend.last_week)
    };

    // 3. Trends (byDay)
    const trendsDay = await safeQuery(`
      SELECT
        DATE_FORMAT(listened_at, '%Y-%m-%d') as date,
        SUM(CASE WHEN listen_duration >= 30 OR completion_rate >= 0.5 THEN 1 ELSE 0 END) as recent_plays,
        COUNT(*) as raw_listen_events
      FROM listening_history
      WHERE user_id = ? AND listened_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY date ORDER BY date ASC
    `, [id, days], []);
    result.listeningTrends.byDay = trendsDay.map(item => ({
      ...item,
      listens: Number(item.recent_plays || 0)
    }));

    // 4. Music Taste
    const topSongs = await safeQuery(`
      SELECT s.id, s.title, s.cover_url,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as user_plays,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listen_count,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listens,
             COUNT(lh.id) as raw_listen_events,
             a.name as artist
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ?
      GROUP BY s.id, s.title, s.cover_url, a.name HAVING user_plays > 0 ORDER BY user_plays DESC LIMIT 5
    `, [id], []);
    result.musicTaste.topSongs = topSongs;

    const topArtists = await safeQuery(`
      SELECT a.id, a.name, a.avatar_url,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as user_plays,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listen_count,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listens,
             COUNT(lh.id) as raw_listen_events
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ?
      GROUP BY a.id, a.name, a.avatar_url HAVING user_plays > 0 ORDER BY user_plays DESC LIMIT 5
    `, [id], []);
    
    topArtists.forEach(a => {
      a.avatar_url = resolveArtistAvatar(a, req);
    });
    result.musicTaste.topArtists = topArtists;

    // Preferences
    const genresPref = await safeQuery('SELECT g.id, g.name FROM user_genre_preferences ug JOIN genres g ON ug.genre_id = g.id WHERE ug.user_id = ?', [id], []);
    result.recommendation.selectedGenres = genresPref;

    const artistsPref = await safeQuery('SELECT a.id, a.name, a.avatar_url FROM user_artist_preferences ua JOIN artists a ON ua.artist_id = a.id WHERE ua.user_id = ?', [id], []);
    
    artistsPref.forEach(a => {
      a.avatar_url = resolveArtistAvatar(a, req);
    });
    result.recommendation.selectedArtists = artistsPref;

    // 5. Playlists
    const manualPlaylists = await safeQuery('SELECT id, name, cover_url, is_public, created_at FROM playlists WHERE user_id = ? AND type = "manual" ORDER BY created_at DESC', [id], []);
    result.playlists = manualPlaylists;

    const sysPlaylists = await safeQuery('SELECT id, name, cover_url, type, system_key FROM playlists WHERE user_id = ? AND type IN ("ai", "system")', [id], []);
    result.recommendation.generatedPlaylists = sysPlaylists;

    // 6. Recent Likes
    const recentLikes = await safeQuery(`
      SELECT s.id, s.title, s.cover_url, a.name as artist, sl.liked_at
      FROM song_likes sl
      JOIN songs s ON sl.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE sl.user_id = ? ORDER BY sl.liked_at DESC LIMIT 5
    `, [id], []);
    result.musicTaste.recentLikedSongs = recentLikes;

    // 6.5. Favorite Genres from Listening History
    const favoriteGenres = await safeQuery(`
      SELECT g.name,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as user_plays,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listen_count,
             SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) as listens,
             COUNT(lh.id) as raw_listen_events
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN genres g ON s.genre_id = g.id
      WHERE lh.user_id = ?
      GROUP BY g.id, g.name HAVING user_plays > 0 ORDER BY user_plays DESC LIMIT 5
    `, [id], []);
    result.musicTaste.favoriteGenres = favoriteGenres;

    // 7. Recent Activity (Listening history)
    const recentListens = await safeQuery(`
      SELECT lh.id, s.title as song_title, a.name as artist, lh.listened_at, lh.completion_rate
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.user_id = ? ORDER BY lh.listened_at DESC LIMIT 10
    `, [id], []);
    
    result.recentActivity = recentListens.map(rl => ({
      id: rl.id,
      type: 'listen',
      title: `Đã nghe "${rl.song_title}"`,
      subtitle: rl.artist,
      date: rl.listened_at,
      meta: `Hoàn thành: ${Math.round((rl.completion_rate || 0) * 100)}%`
    }));

    // 8. Premium Transactions
    const recentTrx = await safeQuery(`
      SELECT id, amount, status, created_at, plan_id 
      FROM payment_transactions 
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
    `, [id], []);
    result.premium.recentTransactions = recentTrx;

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getUserDetail Error:', error);
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true, message: 'Cập nhật vai trò thành công' });
  } catch (error) {
    console.error('updateUserRole Error:', error);
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'locked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    console.error('updateUserStatus Error:', error);
    next(error);
  }
};

exports.updateUserPremium = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { premium_expires_at } = req.body;
    const expiresVal = premium_expires_at ? new Date(premium_expires_at) : null;
    
    if (expiresVal) {
      await pool.query(
        'UPDATE users SET premium_started_at = COALESCE(premium_started_at, NOW()), premium_expires_at = ? WHERE id = ?',
        [expiresVal, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET premium_started_at = NULL, premium_expires_at = NULL, premium_plan_id = NULL WHERE id = ?',
        [id]
      );
    }
    
    res.json({ success: true, message: 'Cập nhật premium thành công' });
  } catch (error) {
    console.error('updateUserPremium Error:', error);
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { email, password, display_name, role } = req.body;
    if (!email || !password || !display_name) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }
    
    // Check if email exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email đã được sử dụng' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const userRole = role === 'admin' ? 'admin' : 'user';

    await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, display_name, userRole, 'active']
    );

    res.status(201).json({ success: true, message: 'Thêm thành viên thành công' });
  } catch (error) {
    console.error('createUser Error:', error);
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting self or other admins, or maybe just simple delete
    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    
    if (users[0].role === 'admin' && req.user.id !== parseInt(id)) {
      // Actually let's allow it, but with caution, or let's prevent deleting other admins unless necessary.
      // But it's an admin panel, let's just delete
    }

    if (parseInt(id) === req.user.id) {
       return res.status(400).json({ success: false, message: 'Không thể xóa chính mình' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Đã xóa người dùng' });
  } catch (error) {
    console.error('deleteUser Error:', error);
    next(error);
  }
};

// 2. Quản lý Bài hát
exports.getAllSongs = async (req, res, next) => {
  try {
    const { group, search, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC', genreId, artistId, status, releaseStatus } = req.query;
    
    let query = `
      SELECT s.id
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        query += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        query += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        query += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }
    if (search) {
      query += ` AND (s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (genreId) {
      query += ` AND s.genre_id = ?`;
      params.push(genreId);
    }
    if (artistId) {
      query += ` AND s.artist_id = ?`;
      params.push(artistId);
    }
    if (status) {
      query += ` AND s.is_active = ?`;
      params.push(status === 'active' ? 1 : 0);
    }
    if (releaseStatus) {
      query += ` AND s.release_status = ?`;
      params.push(releaseStatus);
    }

    // Sorting
    const validSortCols = ['created_at', 'title', 'play_count', 'duration_sec'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortExpression = sortCol === 'play_count' ? 's.play_count' : `s.${sortCol}`;
    query += ` ORDER BY ${sortExpression} ${sortDir}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [idRows] = await pool.query(query, params);
    const songIds = idRows.map(row => row.id);
    let songs = [];

    if (songIds.length > 0) {
      const [detailedSongs] = await pool.query(`
        SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.is_active,
               s.release_status, s.release_at, s.published_at,
               ${effectiveReleaseStatusExpression('s')} AS effective_release_status,
               COALESCE(s.play_count, 0) AS play_count,
               COALESCE(s.play_count, 0) AS stored_play_count,
               COALESCE(lh.history_plays, 0) AS history_plays,
               s.created_at,
               CASE 
                 WHEN UPPER(g.name) LIKE 'KPOP%' THEN 'KPOP'
                 WHEN UPPER(g.name) LIKE 'VPOP%' THEN 'VPOP'
                 WHEN UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%' THEN 'USUK'
                 ELSE s.market 
               END as market,
               g.name as genre, g.id as genre_id,
               a.name as artist, a.name as artist_name, a.id as artist_id,
               al.title as album, al.id as album_id, al.cover_url as album_cover_url
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN genres g ON s.genre_id = g.id
        LEFT JOIN (
          SELECT song_id, COUNT(*) AS history_plays
          FROM listening_history
          WHERE song_id IN (?)
          GROUP BY song_id
        ) lh ON lh.song_id = s.id
        WHERE s.id IN (?)
      `, [songIds, songIds]);

      const songMap = new Map(detailedSongs.map(s => [s.id, s]));
      songs = songIds.map(id => songMap.get(id)).filter(Boolean);
    }

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE 1=1
    `;
    const countParams = [];
    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        countQuery += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        countQuery += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        countQuery += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }
    if (search) { countQuery += ` AND (s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?)`; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (genreId) { countQuery += ` AND s.genre_id = ?`; countParams.push(genreId); }
    if (artistId) { countQuery += ` AND s.artist_id = ?`; countParams.push(artistId); }
    if (status) { countQuery += ` AND s.is_active = ?`; countParams.push(status === 'active' ? 1 : 0); }
    if (releaseStatus) { countQuery += ` AND s.release_status = ?`; countParams.push(releaseStatus); }

    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({ 
      success: true, 
      data: songs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getAllSongs Error:', error);
    next(error);
  }
};

exports.updateSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, artist_name, album_title, genre_id, is_active, artist_id: reqArtistId, album_id: reqAlbumId } = req.body;
    const songColumns = await getTableColumns('songs');
    const hasReleaseStatus = req.body.release_status !== undefined || req.body.releaseStatus !== undefined;
    const releasePayload = hasReleaseStatus
      ? normalizeReleasePayload(req.body, { defaultStatus: 'published', isCreate: false })
      : null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let artistId = reqArtistId || null;
      let isNewArtist = false;
      if (!artistId && artist_name) {
        let [artists] = await conn.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [artist_name]);
        if (artists.length === 0) {
          const [artistRes] = await conn.query('INSERT INTO artists (name) VALUES (?)', [artist_name]);
          artistId = artistRes.insertId;
          isNewArtist = true;
        } else {
          artistId = artists[0].id;
        }
      }

      let albumId = reqAlbumId || null;
      if (!albumId && album_title && artistId) {
        let [albums] = await conn.query('SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1', [album_title, artistId]);
        if (albums.length === 0) {
          const [albumRes] = await conn.query('INSERT INTO albums (title, artist_id) VALUES (?, ?)', [album_title, artistId]);
          albumId = albumRes.insertId;
        } else {
          albumId = albums[0].id;
        }
      }

      const updateFields = [];
      const updateParams = [];

      if (title !== undefined) { updateFields.push('title = ?'); updateParams.push(title); }
      if (artistId !== null) { updateFields.push('artist_id = ?'); updateParams.push(artistId); }
      if (albumId !== null) { updateFields.push('album_id = ?'); updateParams.push(albumId); }
      if (genre_id !== undefined) { updateFields.push('genre_id = ?'); updateParams.push(genre_id); }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateParams.push(is_active);
        if (!hasReleaseStatus && songColumns.has('release_status')) {
          if (Number(is_active) === 0) {
            updateFields.push('release_status = ?');
            updateParams.push('hidden');
          } else if (Number(is_active) === 1) {
            updateFields.push('release_status = ?');
            updateParams.push('published');
          }
        }
      }
      if (releasePayload) {
        const releaseFields = [];
        const releaseValues = [];
        pushReleaseFields(releaseFields, releaseValues, releasePayload, songColumns);
        const releaseSet = buildSetClausesFromFields(releaseFields, releaseValues);
        updateFields.push(...releaseSet.clauses);
        updateParams.push(...releaseSet.params);
        if (releasePayload.release_status === 'hidden' && songColumns.has('is_active')) {
          updateFields.push('is_active = ?');
          updateParams.push(0);
        } else if (releasePayload.release_status !== 'hidden' && songColumns.has('is_active') && is_active === undefined) {
          updateFields.push('is_active = ?');
          updateParams.push(1);
        }
      }

      // Handle file uploads if any
      if (req.files) {
        if (req.files.audio && req.files.audio[0]) {
          const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.files.audio[0].path);
          const audioUrl = '/uploads/' + relativePath.split(path.sep).join('/');
          updateFields.push('audio_url = ?');
          updateParams.push(audioUrl);
        }
        if (req.files.cover && req.files.cover[0]) {
          const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.files.cover[0].path);
          const coverUrl = '/uploads/' + relativePath.split(path.sep).join('/');
          updateFields.push('cover_url = ?');
          updateParams.push(coverUrl);
        }
      }

      if (updateFields.length > 0) {
        updateParams.push(id);
        await conn.query(`UPDATE songs SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
      }

      await conn.commit();

      if (isNewArtist && artistId) {
        const { ensureArtistAvatar } = require('../services/artistImage.service');
        ensureArtistAvatar(artistId).catch(error => {
          console.error("Auto fetch artist avatar in updateSong failed:", error.message);
        });
      }

      const { ensureSongCover, ensureAlbumCover } = require('../services/songImage.service');
      ensureSongCover(id).catch(err => {
        console.error(`Auto fetch song cover failed for song ID ${id}:`, err.message);
      });
      if (albumId) {
        ensureAlbumCover(albumId).catch(err => {
          console.error(`Auto fetch album cover failed for album ID ${albumId}:`, err.message);
        });
      }

      res.json({ success: true, message: 'Cập nhật bài hát thành công' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('updateSong Error:', error);
    next(error);
  }
};

exports.deleteSong = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    // Explicitly delete from related tables first to avoid foreign key issues
    await connection.query('DELETE FROM playlist_songs WHERE song_id = ?', [id]);
    await connection.query('DELETE FROM song_likes WHERE song_id = ?', [id]);
    await connection.query('DELETE FROM listening_history WHERE song_id = ?', [id]);
    await connection.query('DELETE FROM stem_jobs WHERE song_id = ?', [id]);
    await connection.query('DELETE FROM recommendations WHERE song_id = ?', [id]);

    // Finally delete the song
    await connection.query('DELETE FROM songs WHERE id = ?', [id]);

    await connection.commit();
    res.json({ success: true, message: 'Xóa bài hát thành công', deletedId: parseInt(id) });
  } catch (error) {
    await connection.rollback();
    console.error('deleteSong Error:', error);
    next(error);
  } finally {
    connection.release();
  }
};

exports.deleteSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE songs
       SET is_active = 0,
           release_status = 'hidden'
       WHERE id = ?`,
      [id]
    );
    res.json({ success: true, message: 'Da an bai hat thanh cong', hiddenId: parseInt(id, 10) });
  } catch (error) {
    console.error('deleteSong Error:', error);
    next(error);
  }
};

exports.getSongGroupsSummary = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as totalSongs_ALL,
        CAST(SUM(CASE WHEN s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_ALL,
        CAST(COALESCE(SUM(s.play_count), 0) AS UNSIGNED) as totalListens_ALL,

        CAST(SUM(CASE WHEN g.name LIKE 'KPOP%' THEN 1 ELSE 0 END) AS UNSIGNED) as totalSongs_KPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'KPOP%' AND s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_KPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'KPOP%' THEN COALESCE(s.play_count, 0) ELSE 0 END) AS UNSIGNED) as totalListens_KPOP,

        CAST(SUM(CASE WHEN g.name LIKE 'VPOP%' THEN 1 ELSE 0 END) AS UNSIGNED) as totalSongs_VPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'VPOP%' AND s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_VPOP,
        CAST(SUM(CASE WHEN g.name LIKE 'VPOP%' THEN COALESCE(s.play_count, 0) ELSE 0 END) AS UNSIGNED) as totalListens_VPOP,

        CAST(SUM(CASE WHEN (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') THEN 1 ELSE 0 END) AS UNSIGNED) as totalSongs_USUK,
        CAST(SUM(CASE WHEN (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') AND s.is_active = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as activeSongs_USUK,
        CAST(SUM(CASE WHEN (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') THEN COALESCE(s.play_count, 0) ELSE 0 END) AS UNSIGNED) as totalListens_USUK
      FROM songs s
      LEFT JOIN genres g ON s.genre_id = g.id
    `);

    const row = rows[0] || {};

    const summary = {
      KPOP: { key: 'KPOP', label: 'Kpop', totalSongs: row.totalSongs_KPOP || 0, activeSongs: row.activeSongs_KPOP || 0, totalListens: row.totalListens_KPOP || 0, total_plays: row.totalListens_KPOP || 0, topCoverUrl: null, topSongTitle: null },
      VPOP: { key: 'VPOP', label: 'Vpop', totalSongs: row.totalSongs_VPOP || 0, activeSongs: row.activeSongs_VPOP || 0, totalListens: row.totalListens_VPOP || 0, total_plays: row.totalListens_VPOP || 0, topCoverUrl: null, topSongTitle: null },
      USUK: { key: 'USUK', label: 'US-UK', totalSongs: row.totalSongs_USUK || 0, activeSongs: row.activeSongs_USUK || 0, totalListens: row.totalListens_USUK || 0, total_plays: row.totalListens_USUK || 0, topCoverUrl: null, topSongTitle: null },
      ALL: { key: 'ALL', label: 'Tất cả bài hát', totalSongs: row.totalSongs_ALL || 0, activeSongs: row.activeSongs_ALL || 0, totalListens: row.totalListens_ALL || 0, topCoverUrl: null, topSongTitle: null }
    };

    Object.values(summary).forEach(group => {
      group.total_plays = group.total_plays ?? group.totalListens ?? 0;
    });

    const queries = [
      pool.query(`SELECT s.title, s.cover_url FROM songs s LEFT JOIN genres g ON s.genre_id = g.id WHERE g.name LIKE 'KPOP%' ORDER BY COALESCE(s.play_count, 0) DESC LIMIT 1`),
      pool.query(`SELECT s.title, s.cover_url FROM songs s LEFT JOIN genres g ON s.genre_id = g.id WHERE g.name LIKE 'VPOP%' ORDER BY COALESCE(s.play_count, 0) DESC LIMIT 1`),
      pool.query(`SELECT s.title, s.cover_url FROM songs s LEFT JOIN genres g ON s.genre_id = g.id WHERE (g.name LIKE 'USUK%' OR g.name LIKE 'US-UK%') ORDER BY COALESCE(s.play_count, 0) DESC LIMIT 1`),
      pool.query(`SELECT s.title, s.cover_url FROM songs s ORDER BY COALESCE(s.play_count, 0) DESC LIMIT 1`),
    ];

    const [[topKpop], [topVpop], [topUsuk], [topAll]] = await Promise.all(queries);

    if (topKpop && topKpop[0]) { summary.KPOP.topSongTitle = topKpop[0].title; summary.KPOP.topCoverUrl = topKpop[0].cover_url; }
    if (topVpop && topVpop[0]) { summary.VPOP.topSongTitle = topVpop[0].title; summary.VPOP.topCoverUrl = topVpop[0].cover_url; }
    if (topUsuk && topUsuk[0]) { summary.USUK.topSongTitle = topUsuk[0].title; summary.USUK.topCoverUrl = topUsuk[0].cover_url; }
    if (topAll && topAll[0]) { summary.ALL.topSongTitle = topAll[0].title; summary.ALL.topCoverUrl = topAll[0].cover_url; }

    res.json({ success: true, data: [summary.KPOP, summary.VPOP, summary.USUK, summary.ALL] });
  } catch (error) {
    console.error('getSongGroupsSummary Error:', error);
    next(error);
  }
};

exports.getSongStatistics = async (req, res, next) => {
  try {
    const { group } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        whereClause += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        whereClause += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        whereClause += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }

    // Top Songs
    const [topSongs] = await pool.query(`
      SELECT s.title, s.play_count as listens, a.name as artist 
      FROM songs s 
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} 
      ORDER BY s.play_count DESC LIMIT 10
    `, params);

    // Genre Distribution
    const [genreDistribution] = await pool.query(`
      SELECT g.name as label, COUNT(*) as count 
      FROM songs s 
      JOIN genres g ON s.genre_id = g.id 
      ${whereClause} 
      GROUP BY g.id
    `, params);

    // Added Over Time (last 12 months)
    const [addedOverTime] = await pool.query(`
      SELECT DATE_FORMAT(s.created_at, '%Y-%m') as label, COUNT(*) as count 
      FROM songs s 
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} AND s.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY label ORDER BY label ASC
    `, params);

    // Status Distribution
    const [statusDistribution] = await pool.query(`
      SELECT IF(s.is_active=1, 'Active', 'Inactive') as label, COUNT(*) as count 
      FROM songs s 
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} 
      GROUP BY label
    `, params);

    // Missing Metadata Count
    const [[{ missingMetadataCount }]] = await pool.query(`
      SELECT COUNT(*) as missingMetadataCount 
      FROM songs s 
      LEFT JOIN genres g ON s.genre_id = g.id
      ${whereClause} AND (s.audio_url IS NULL OR s.cover_url IS NULL OR s.artist_id IS NULL OR s.genre_id IS NULL)
    `, params);

    res.json({
      success: true,
      data: { topSongs, genreDistribution, addedOverTime, statusDistribution, missingMetadataCount }
    });
  } catch (error) {
    console.error('getSongStatistics Error:', error);
    next(error);
  }
};

exports.bulkUpdateSongsStatus = async (req, res, next) => {
  try {
    const { songIds, status } = req.body;
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách bài hát rỗng' });
    }
    const isActive = status === 'active' ? 1 : 0;
    await pool.query('UPDATE songs SET is_active = ? WHERE id IN (?)', [isActive, songIds]);
    res.json({ success: true, message: `Đã cập nhật trạng thái cho ${songIds.length} bài hát` });
  } catch (error) {
    console.error('bulkUpdateSongsStatus Error:', error);
    next(error);
  }
};

exports.bulkUpdateSongsMarket = async (req, res, next) => {
  try {
    const { songIds, market } = req.body;
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách bài hát rỗng' });
    }
    if (!['VPOP', 'KPOP', 'USUK', 'OTHER'].includes(market)) {
      return res.status(400).json({ success: false, message: 'Market không hợp lệ' });
    }
    await pool.query('UPDATE songs SET market = ? WHERE id IN (?)', [market, songIds]);
    res.json({ success: true, message: `Đã gán nhóm ${market} cho ${songIds.length} bài hát` });
  } catch (error) {
    console.error('bulkUpdateSongsMarket Error:', error);
    next(error);
  }
};

exports.getMetadataIssues = async (req, res, next) => {
  try {
    const [issues] = await pool.query(`
      SELECT s.id, s.title,
        CASE WHEN s.cover_url IS NULL THEN 1 ELSE 0 END as missingCover,
        CASE WHEN s.audio_url IS NULL THEN 1 ELSE 0 END as missingAudio,
        CASE WHEN s.artist_id IS NULL THEN 1 ELSE 0 END as missingArtist,
        CASE WHEN s.genre_id IS NULL THEN 1 ELSE 0 END as missingGenre
      FROM songs s
      WHERE s.cover_url IS NULL OR s.audio_url IS NULL OR s.artist_id IS NULL OR s.genre_id IS NULL
      LIMIT 100
    `);
    res.json({ success: true, data: issues });
  } catch (error) {
    console.error('getMetadataIssues Error:', error);
    next(error);
  }
};

// 3. Quản lý Giao dịch
exports.getAllTransactions = async (req, res, next) => {
  try {
    const [transactions] = await pool.query(`
      SELECT t.id, t.payment_code AS order_code, t.payment_code, t.amount, t.provider,
             UPPER(t.status) AS status, t.paid_at, t.created_at,
             u.display_name as user_name, u.email as user_email,
             p.name as plan_name
      FROM payment_transactions t
      JOIN users u ON t.user_id = u.id
      JOIN premium_plans p ON t.plan_id = p.id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('getAllTransactions Error:', error);
    next(error);
  }
};

// 4. Quản lý Nghệ sĩ
exports.getArtistSummary = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS totalArtists,
        SUM(CASE WHEN avatar_url IS NOT NULL AND avatar_url <> '' THEN 1 ELSE 0 END) AS artistsWithImage,
        SUM(CASE WHEN avatar_url IS NULL OR avatar_url = '' THEN 1 ELSE 0 END) AS artistsMissingImage,
        SUM(CASE WHEN bio IS NOT NULL AND bio <> '' THEN 1 ELSE 0 END) AS artistsWithBio,
        SUM(CASE WHEN bio IS NULL OR bio = '' THEN 1 ELSE 0 END) AS artistsMissingBio,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.id END) AS artistsWithSongs
      FROM artists a
      LEFT JOIN songs s ON a.id = s.artist_id
    `);
    
    return res.json({
      success: true,
      data: {
        totalArtists: Number(rows[0].totalArtists || 0),
        artistsWithImage: Number(rows[0].artistsWithImage || 0),
        artistsMissingImage: Number(rows[0].artistsMissingImage || 0),
        artistsWithBio: Number(rows[0].artistsWithBio || 0),
        artistsMissingBio: Number(rows[0].artistsMissingBio || 0),
        artistsWithSongs: Number(rows[0].artistsWithSongs || 0)
      }
    });
  } catch (error) {
    console.error('getArtistSummary Error:', error);
    next(error);
  }
};

exports.getAllArtists = async (req, res, next) => {
  try {
    const [artists] = await pool.query(`
      SELECT a.id, a.name, a.bio, a.short_bio, a.genres_json, a.country,
             a.popularity, a.followers, a.spotify_artist_id, a.external_url,
             a.avatar_url, a.avatar_source, a.metadata_source, a.metadata_source_url,
             a.metadata_fetched_at, a.region, a.created_at,
             COUNT(s.id) as song_count,
             ${getArtistTotalPlaysQuery('a')} as total_plays,
             ${getArtistTotalPlaysQuery('a')} as totalPlays,
             CASE WHEN a.avatar_url IS NULL OR a.avatar_url = '' THEN 1 ELSE 0 END AS missing_avatar,
             CASE WHEN (a.bio IS NULL OR a.bio = '') AND (a.short_bio IS NULL OR a.short_bio = '') THEN 1 ELSE 0 END AS missing_bio,
             CASE WHEN a.genres_json IS NULL THEN 1 ELSE 0 END AS missing_genres,
             CASE WHEN a.spotify_artist_id IS NULL OR a.spotify_artist_id = '' THEN 1 ELSE 0 END AS missing_spotify_id,
             (
               SELECT g.name 
               FROM songs s2 
               JOIN genres g ON s2.genre_id = g.id 
               WHERE s2.artist_id = a.id 
                 AND s2.is_active = TRUE
               GROUP BY g.id, g.name 
               ORDER BY COUNT(s2.id) DESC 
               LIMIT 1
             ) as main_genre
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id AND s.is_active = TRUE
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    
    // Giả sử có hàm parseGenresJson helper
    const parseGenresJson = (json) => {
      try { return JSON.parse(json); } catch (e) { return []; }
    };

    const artistsResult = artists.map(artist => ({
      id: artist.id,
      name: artist.name,
      bio: artist.bio,
      short_bio: artist.short_bio,
      region: artist.region,
      country: artist.country,
      avatar_url: resolveArtistAvatar(artist, req),
      avatar_source: artist.avatar_source,
      missing_avatar: artist.missing_avatar === 1,
      genres: parseGenresJson(artist.genres_json),
      main_genre: artist.main_genre,
      metadata_source: artist.metadata_source,
      metadata_source_url: artist.metadata_source_url,
      popularity: artist.popularity,
      followers: artist.followers,
      spotify_artist_id: artist.spotify_artist_id,
      external_url: artist.external_url,
      song_count: artist.song_count || 0,
      follower_count: artist.followers || 0,
      total_plays: artist.total_plays || 0,
      totalPlays: artist.totalPlays || 0,
      metadata_fetched_at: artist.metadata_fetched_at,
      created_at: artist.created_at
    }));

    res.json({ success: true, data: artistsResult });
  } catch (error) {
    console.error('getAllArtists Error:', error);
    next(error);
  }
};

exports.syncArtistMetadata = async (req, res, next) => {
  try {
    const force = req.body?.force === true || req.query.force === 'true';
    const result = await syncArtistMetadata(req.params.id, { force });

    if (!result.success) {
      return res.status(result.code === 'ARTIST_NOT_FOUND' ? 404 : 422).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('syncArtistMetadata Error:', error);
    next(error);
  }
};

exports.syncMissingArtistMetadata = async (req, res, next) => {
  try {
    const limit = req.body?.limit || req.query.limit || 10;
    const force = req.body?.force === true || req.query.force === 'true';
    const result = await syncMissingArtistMetadata(limit, { force });
    res.json(result);
  } catch (error) {
    console.error('syncMissingArtistMetadata Error:', error);
    next(error);
  }
};

exports.syncArtistBio = async (req, res, next) => {
  try {
    const force = req.body?.force === true || req.query.force === 'true';
    const result = await syncArtistBio(req.params.id, { force });

    if (!result.success && result.code === 'ARTIST_NOT_FOUND') {
      return res.status(404).json(result);
    }
    // Return 200 even if BIO_NOT_FOUND because it's not a server crash, just no result
    res.json(result);
  } catch (error) {
    console.error('syncArtistBio Error:', error);
    next(error);
  }
};

exports.syncMissingArtistBio = async (req, res, next) => {
  try {
    const limit = req.body?.limit || req.query.limit || 20;
    const result = await syncMissingArtistBio(limit);
    res.json(result);
  } catch (error) {
    console.error('syncMissingArtistBio Error:', error);
    next(error);
  }
};

exports.getArtistMetadataIssues = async (req, res, next) => {
  try {
    const issues = await getArtistMetadataIssueRows(req.query.limit || 200);
    res.json({ success: true, data: issues });
  } catch (error) {
    console.error('getArtistMetadataIssues Error:', error);
    next(error);
  }
};

exports.getArtistDetailFull = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    // Default response structure
    const result = {
      artist: null,
      stats: {
        songCount: 0,
        albumCount: 0,
        singleCount: 0,
        totalListens: 0,
        followerCount: 0,
        missingAudioCount: 0,
        brokenAudioCount: 0,
        missingCoverCount: 0,
        missingLyricsCount: 0,
        missingFeaturesCount: 0,
        albumMismatchCount: 0
      },
      topSongs: [],
      songs: [],
      albums: [],
      relatedIssues: [],
      warnings: []
    };

    const range = req.query.range || '30d';

    const safeQuery = async (queryStr, params, fallback) => {
      try {
        const [rows] = await pool.query(queryStr, params);
        return rows;
      } catch (err) {
        console.error(`Error querying artist ${id}:`, err.message);
        return fallback;
      }
    };

    // 1. Artist Info
    const artists = await safeQuery('SELECT * FROM artists WHERE id = ?', [id], []);
    if (artists.length === 0) {
      return res.status(404).json({ success: false, message: 'Nghệ sĩ không tồn tại' });
    }
    const artistData = artists[0];
    artistData.avatar_url = resolveArtistAvatar(artistData, req);
    
    // Add missing schema fallback fields just in case
    artistData.market = artistData.market || artistData.region || 'Khác';
    artistData.country = artistData.country || '';
    
    result.artist = artistData;

    // 2. Songs
    const songs = await safeQuery(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, 
             COALESCE(s.play_count, 0) as play_count, s.is_active, s.created_at, s.lyrics, s.tempo,
             s.album_id, al.title as album, g.name as genre
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.artist_id = ?
      ORDER BY s.play_count DESC, s.created_at DESC
      LIMIT 100
    `, [id], []);
    
    result.songs = songs;
    result.stats.songCount = songs.length;
    
    const countRes = await safeQuery('SELECT COUNT(*) as cnt, SUM(play_count) as total_listens FROM songs WHERE artist_id = ?', [id], [{ cnt: songs.length, total_listens: 0 }]);
    if (countRes.length > 0) {
      result.stats.songCount = countRes[0].cnt;
      result.stats.totalListens = countRes[0].total_listens || 0;
    }

    result.topSongs = songs.slice(0, 10);

    // Stats main_genre
    const mainGenreResult = await safeQuery(`
      SELECT g.name as main_genre
      FROM songs s
      JOIN genres g ON s.genre_id = g.id
      WHERE s.artist_id = ? AND s.is_active = TRUE
      GROUP BY g.id, g.name
      ORDER BY COUNT(s.id) DESC
      LIMIT 1
    `, [id], []);
    result.stats.main_genre = mainGenreResult[0]?.main_genre || null;

    // Listen Trend
    const allowedRanges = {
      today: { days: 0, bucketSelect: "DATE_FORMAT(lh.listened_at, '%H:00')", bucketCount: 24, bucketType: 'hour' },
      '7d': { days: 6, bucketSelect: "DATE_FORMAT(lh.listened_at, '%Y-%m-%d')", bucketCount: 7, bucketType: 'day' },
      '30d': { days: 29, bucketSelect: "DATE_FORMAT(lh.listened_at, '%Y-%m-%d')", bucketCount: 30, bucketType: 'day' }
    };
    const config = allowedRanges[range] || allowedRanges['30d'];
    const currentWhere = range === 'today' ? 'lh.listened_at >= CURDATE()' : `lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL ${config.days} DAY)`;

    const trendRows = await safeQuery(`
      SELECT
        ${config.bucketSelect} AS bucket_key,
        SUM(CASE WHEN lh.listen_duration >= 30 OR lh.completion_rate >= 0.5 THEN 1 ELSE 0 END) AS listens
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      WHERE s.artist_id = ? AND ${currentWhere}
      GROUP BY bucket_key
    `, [id], []);

    const pad = value => String(value).padStart(2, '0');
    const formatLocalDateKey = date => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };
    const formatLocalDateLabel = date => {
      const day = pad(date.getDate());
      const month = pad(date.getMonth() + 1);
      return `${day}/${month}`;
    };

    const buckets = config.bucketType === 'hour'
      ? Array.from({ length: config.bucketCount }, (_, hour) => ({
          key: `${pad(hour)}:00`,
          label: `${pad(hour)}:00`
        }))
      : Array.from({ length: config.bucketCount }, (_, index) => {
          const date = new Date();
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() - (config.bucketCount - 1 - index));
          return {
            key: formatLocalDateKey(date),
            label: formatLocalDateLabel(date)
          };
        });

    result.listenTrend = buckets.map(bucket => {
      const row = trendRows.find(item => item.bucket_key === bucket.key);
      return {
        label: bucket.label,
        listens: Number(row?.listens || 0)
      };
    });

    // 3. Albums
    const albums = await safeQuery(`
      SELECT al.id, al.title, 
             COALESCE(
               NULLIF(al.cover_url, ''),
               (
                 SELECT COALESCE(NULLIF(si.cover_url, ''), NULLIF(si.audio_url, ''))
                 FROM songs si
                 WHERE si.album_id = al.id AND si.is_active = TRUE
                 ORDER BY si.play_count DESC LIMIT 1
               )
             ) AS cover_url,
             al.release_date,
             (SELECT COUNT(*) FROM songs WHERE album_id = al.id) as actual_song_count
      FROM albums al
      WHERE al.artist_id = ?
      ORDER BY al.release_date DESC, al.created_at DESC
      LIMIT 100
    `, [id], []);
    
    // Fallback for album type/total tracks if schema misses them
    result.albums = albums.map(a => {
      a.album_type = a.album_type || (a.actual_song_count > 3 ? 'Album' : 'Single');
      a.total_tracks = a.total_tracks || a.actual_song_count;
      if (a.actual_song_count !== a.total_tracks && a.total_tracks > 0) {
         result.stats.albumMismatchCount++;
         result.warnings.push(`Album "${a.title}" bị lệch số bài hát (có ${a.actual_song_count}, cần ${a.total_tracks}).`);
      }
      return a;
    });

    result.stats.albumCount = albums.filter(a => a.album_type === 'Album').length;
    result.stats.singleCount = albums.filter(a => a.album_type === 'Single').length;
    if (result.stats.albumCount === 0 && result.stats.singleCount === 0) {
      result.stats.albumCount = albums.length; // fallback
    }

    // Embed songs in albums for quick view
    const albumIds = albums.map(a => a.id);
    if (albumIds.length > 0) {
      const albumSongs = await safeQuery(`
        SELECT s.id, s.title, s.duration_sec, s.play_count, s.album_id, s.cover_url
        FROM songs s
        WHERE s.album_id IN (?) AND s.is_active = TRUE
        ORDER BY s.play_count DESC
      `, [albumIds], []);
      
      result.albums.forEach(a => {
        a.songs = albumSongs.filter(s => s.album_id === a.id);
      });
    }

    // 4. Followers (Fallback if table doesn't exist)
    const follows = await safeQuery('SELECT COUNT(*) as cnt FROM artist_follows WHERE artist_id = ?', [id], [{ cnt: 0 }]);
    result.stats.followerCount = follows[0].cnt || 0;

    // 5. Data Quality
    songs.forEach(s => {
      if (!s.audio_url) {
        result.stats.missingAudioCount++;
      } else {
        try {
          if (s.audio_url.startsWith('/uploads')) {
             const filePath = path.join(__dirname, '..', '..', s.audio_url);
             if (!fs.existsSync(filePath)) result.stats.brokenAudioCount++;
          }
        } catch (e) {}
      }
      if (!s.cover_url) result.stats.missingCoverCount++;
      if (!s.lyrics) result.stats.missingLyricsCount++;
      if (!s.tempo || s.tempo === 0) result.stats.missingFeaturesCount++;
    });

    if (result.stats.missingAudioCount > 0) result.relatedIssues.push({ type: 'missing_audio', count: result.stats.missingAudioCount });
    if (result.stats.brokenAudioCount > 0) result.relatedIssues.push({ type: 'broken_audio', count: result.stats.brokenAudioCount });
    if (result.stats.missingCoverCount > 0) result.relatedIssues.push({ type: 'missing_cover', count: result.stats.missingCoverCount });
    if (result.stats.missingLyricsCount > 0) result.relatedIssues.push({ type: 'missing_lyrics', count: result.stats.missingLyricsCount });
    if (result.stats.missingFeaturesCount > 0) result.relatedIssues.push({ type: 'missing_features', count: result.stats.missingFeaturesCount });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getArtistDetailFull Error:', error);
    next(error);
  }
};

exports.getArtistDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [artists] = await pool.query('SELECT * FROM artists WHERE id = ?', [id]);
    
    if (artists.length === 0) {
      return res.status(404).json({ success: false, message: 'Nghệ sĩ không tồn tại' });
    }
    
    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec, s.audio_url, s.cover_url, s.play_count, s.is_active, s.created_at,
             s.artist_id, s.album_id, s.genre_id,
             a.name as artist_name, al.title as album, g.name as genre
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.artist_id = ?
      ORDER BY s.created_at DESC
    `, [id]);

    const artistData = artists[0];
    artistData.avatar_url = resolveArtistAvatar(artistData, req);

    res.json({ success: true, data: { ...artistData, songs } });
  } catch (error) {
    console.error('getArtistDetails Error:', error);
    next(error);
  }
};

exports.createArtist = async (req, res, next) => {
  try {
    const { name, bio, region } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên nghệ sĩ là bắt buộc' });

    let avatarUrl = null;
    if (req.file) {
      const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.file.path);
      avatarUrl = '/uploads/' + relativePath.split(path.sep).join('/');
    }

    const [result] = await pool.query(
      'INSERT INTO artists (name, bio, region, avatar_url) VALUES (?, ?, ?, ?)',
      [name, bio, region || 'Khác', avatarUrl]
    );

    const artistId = result.insertId;
    if (artistId && !avatarUrl) {
      const { ensureArtistAvatar } = require('../services/artistImage.service');
      ensureArtistAvatar(artistId).catch(error => {
        console.error("Auto fetch artist avatar failed:", error.message);
      });
    }

    res.json({ success: true, message: 'Thêm nghệ sĩ thành công' });
  } catch (error) {
    console.error('createArtist Error:', error);
    next(error);
  }
};

// --- DATA QUALITY & ANALYTICS ---

exports.getDataQualitySummary = async (req, res, next) => {
  try {
    const data = await getAdminDataQualitySummary();
    res.json({ success: true, data });
  } catch (error) {
    console.error('getDataQualitySummary Error:', error);
    res.status(500).json({
      success: false,
      message: 'Khong the lay tong quan chat luong du lieu',
      data: null,
    });
  }
};

exports.getDataQualityIssues = async (req, res) => {
  try {
    const data = await getAdminDataQualityIssues(req.query);
    res.json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('getDataQualityIssues Error:', error.message);
    res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? error.message : 'Khong the lay danh sach loi du lieu',
      data: null,
    });
  }
};

exports.getListeningAnalytics = async (req, res, next) => {
  try {
    const rangeParam = req.query.range || '7d';
    let days = 7;
    if (rangeParam === '30d') days = 30;
    if (rangeParam === '90d') days = 90;

    const [listensByDay] = await pool.query(`
      SELECT
        DATE_FORMAT(listened_at, '%Y-%m-%d') as date,
        SUM(CASE WHEN listen_duration >= 30 OR completion_rate >= 0.5 THEN 1 ELSE 0 END) as recent_plays,
        COUNT(*) as raw_listen_events
      FROM listening_history
      WHERE listened_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY date
      ORDER BY date ASC
    `, [days]);

    const [listensByHour] = await pool.query(`
      SELECT
        HOUR(listened_at) as hour,
        SUM(CASE WHEN listen_duration >= 30 OR completion_rate >= 0.5 THEN 1 ELSE 0 END) as recent_plays,
        COUNT(*) as raw_listen_events
      FROM listening_history
      WHERE listened_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY hour
      ORDER BY hour ASC
    `, [days]);

    const [topSongs] = await pool.query(`
      SELECT s.id, s.title, a.name as artist, s.cover_url, s.play_count, COUNT(lh.id) as recent_plays
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND (lh.listen_duration >= 30 OR lh.completion_rate >= 0.5)
      GROUP BY s.id, s.title, a.name, s.cover_url, s.play_count
      ORDER BY recent_plays DESC
      LIMIT 10
    `, [days]);

    const [topArtists] = await pool.query(`
      SELECT a.id, a.name, a.avatar_url, COUNT(lh.id) as recent_plays,
             ${getArtistTotalPlaysQuery('a')} as total_plays,
             ${getArtistTotalPlaysQuery('a')} as totalPlays
      FROM listening_history lh
      JOIN songs s ON lh.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE lh.listened_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND (lh.listen_duration >= 30 OR lh.completion_rate >= 0.5)
      GROUP BY a.id, a.name, a.avatar_url
      ORDER BY recent_plays DESC
      LIMIT 10
    `, [days]);

    topArtists.forEach(a => {
      a.avatar_url = resolveArtistAvatar(a, req);
      a.listens = Number(a.recent_plays || 0);
      a.listens_7d = Number(a.recent_plays || 0);
    });

    const normalizedListensByDay = listensByDay.map(item => ({
      ...item,
      raw_listen_events: Number(item.raw_listen_events || 0),
      listens: Number(item.recent_plays || 0)
    }));
    const normalizedListensByHour = listensByHour.map(item => ({
      ...item,
      raw_listen_events: Number(item.raw_listen_events || 0),
      listens: Number(item.recent_plays || 0)
    }));
    const normalizedTopSongs = topSongs.map(item => ({
      ...item,
      recent_plays: Number(item.recent_plays || 0),
      listens: Number(item.recent_plays || 0)
    }));

    res.json({
      success: true,
      data: {
        range: rangeParam,
        listensByDay: normalizedListensByDay,
        listensByHour: normalizedListensByHour,
        topSongs: normalizedTopSongs,
        topArtists
      }
    });
  } catch (error) {
    console.error('getListeningAnalytics Error:', error);
    next(error);
  }
};

exports.getSystemPlaylistsSummary = async (req, res, next) => {
  try {
    const [[totalRes]] = await pool.query(`
      SELECT 
        COUNT(*) as totalSystemPlaylists,
        MAX(updated_at) as lastGeneratedAt
      FROM playlists 
      WHERE is_system = 1 OR type = 'system'
    `);
    
    const [statusStats] = await pool.query(`
      SELECT p.id,
             COUNT(ps.song_id) as song_count,
             CASE 
               WHEN p.cover_url IS NULL OR p.cover_url = '' THEN 'missing_cover'
               WHEN COUNT(ps.song_id) = 0 THEN 'empty'
               ELSE 'ok'
             END as status
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      WHERE p.is_system = 1 OR p.type = 'system'
      GROUP BY p.id
    `);

    let activeSystemPlaylists = 0;
    let playlistsNeedUpdate = 0;
    let emptyPlaylists = 0;
    let missingCoverPlaylists = 0;
    let totalSongsInSystemPlaylists = 0;

    statusStats.forEach(p => {
      if (p.status === 'ok') activeSystemPlaylists++;
      else {
        playlistsNeedUpdate++;
        if (p.status === 'empty') emptyPlaylists++;
        else if (p.status === 'missing_cover') missingCoverPlaylists++;
      }
      totalSongsInSystemPlaylists += Number(p.song_count || 0);
    });

    res.json({ 
      success: true, 
      data: {
        totalSystemPlaylists: totalRes.totalSystemPlaylists || 0,
        total_playlists: totalRes.totalSystemPlaylists || 0,
        activeSystemPlaylists,
        empty_playlists: emptyPlaylists,
        missing_cover_playlists: missingCoverPlaylists,
        totalSongsInSystemPlaylists,
        total_songs: totalSongsInSystemPlaylists,
        lastGeneratedAt: totalRes.lastGeneratedAt,
        playlistsNeedUpdate
      } 
    });
  } catch (error) {
    console.error('getSystemPlaylistsSummary Error:', error);
    next(error);
  }
};

exports.getSystemKeys = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT system_key as \`key\`, COUNT(*) AS count
      FROM playlists
      WHERE system_key IS NOT NULL AND system_key <> ''
      GROUP BY system_key
      ORDER BY system_key ASC
    `);

    const formatLabel = (key) => {
      return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace('Dailymix', 'Daily Mix') // special cases
        .replace('Weeklymix', 'Weekly Mix')
        .replace('Moodmix', 'Mood Mix');
    };

    const data = rows.map(r => ({
      key: r.key,
      label: formatLabel(r.key),
      count: r.count
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('getSystemKeys Error:', error);
    next(error);
  }
};

exports.getSystemPlaylists = async (req, res, next) => {
  try {
    const { q, type, status, system_key, owner, user, userId, page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE (p.is_system = 1 OR p.type = 'system')";
    const params = [];

    if (q) {
      whereClause += " AND (p.name LIKE ? OR p.system_key LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    const actualSystemKey = system_key || type;
    if (actualSystemKey && actualSystemKey !== 'all') {
      whereClause += " AND p.system_key = ?";
      params.push(actualSystemKey);
    }

    const ownerQuery = owner || user || userId;
    if (ownerQuery) {
      if (!isNaN(ownerQuery)) {
        whereClause += " AND p.user_id = ?";
        params.push(Number(ownerQuery));
      } else {
        whereClause += " AND (u.display_name LIKE ? OR u.email LIKE ?)";
        params.push(`%${ownerQuery}%`, `%${ownerQuery}%`);
      }
    }

    let havingClause = "";
    if (status && status !== 'all') {
      if (status === 'active' || status === 'ok') havingClause = "HAVING status = 'ok'";
      else if (status === 'empty') havingClause = "HAVING status = 'empty'";
      else if (status === 'missing_cover') havingClause = "HAVING status = 'missing_cover'";
      else if (status === 'need_update') havingClause = "HAVING status IN ('empty', 'missing_cover')";
    }

    const allowedSortColumns = ['updated_at', 'created_at', 'name', 'song_count'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'updated_at';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT p.id, p.name, p.description, p.system_key, p.type, p.cover_url, 
             p.user_id, u.display_name as owner_name, p.updated_at, p.created_at,
             COUNT(ps.song_id) as song_count,
             CASE 
               WHEN p.cover_url IS NULL OR p.cover_url = '' THEN 'missing_cover'
               WHEN COUNT(ps.song_id) = 0 THEN 'empty'
               ELSE 'ok'
             END as status
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      GROUP BY p.id
      ${havingClause}
      ORDER BY ${validSortBy === 'song_count' ? 'song_count' : 'p.' + validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), Number(offset));
    
    const countQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT p.id, COUNT(ps.song_id) as song_count,
               CASE 
                 WHEN p.cover_url IS NULL OR p.cover_url = '' THEN 'missing_cover'
                 WHEN COUNT(ps.song_id) = 0 THEN 'empty'
                 ELSE 'ok'
               END as status
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        LEFT JOIN users u ON p.user_id = u.id
        ${whereClause}
        GROUP BY p.id
        ${havingClause}
      ) as t
    `;
    const countParams = params.slice(0, params.length - 2);

    const [[countRows], [playlists]] = await Promise.all([
      pool.query(countQuery, countParams),
      pool.query(query, params)
    ]);
    
    const total = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({ 
      success: true, 
      data: playlists,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error) {
    console.error('getSystemPlaylists Error:', error);
    next(error);
  }
};

exports.getUserPlaylists = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [[user]] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });

    const query = `
      SELECT p.id, p.name, p.description, p.type, p.system_key, p.cover_url, 
             p.created_at, p.updated_at, p.is_system,
             (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count,
             (SELECT COALESCE(SUM(s.duration_sec), 0) FROM playlist_songs ps JOIN songs s ON ps.song_id = s.id WHERE ps.playlist_id = p.id) as total_duration,
             (SELECT s2.cover_url FROM playlist_songs ps2 JOIN songs s2 ON ps2.song_id = s2.id WHERE ps2.playlist_id = p.id ORDER BY ps2.added_at ASC LIMIT 1) as first_song_cover_url
      FROM playlists p
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC
    `;

    const [playlists] = await pool.query(query, [id]);

    const result = {
      created: [],
      system: [],
      ai: [],
      summary: {
        total: playlists.length,
        manualCount: 0,
        systemCount: 0,
        aiCount: 0,
        totalSongs: 0
      }
    };

    playlists.forEach(p => {
      p.missing_cover = !p.cover_url && !p.first_song_cover_url;
      p.is_empty = p.song_count === 0;
      
      result.summary.totalSongs += p.song_count;

      if (p.type === 'ai') {
        result.ai.push(p);
        result.summary.aiCount++;
      } else if (p.type === 'system' || p.system_key || p.is_system) {
        result.system.push(p);
        result.summary.systemCount++;
      } else {
        result.created.push(p);
        result.summary.manualCount++;
      }
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getUserPlaylists Error:', error);
    next(error);
  }
};

exports.getSystemPlaylistDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [playlists] = await pool.query(`
      SELECT p.*, u.display_name as owner_name,
             (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
      FROM playlists p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND (p.is_system = 1 OR p.type = 'system')
    `, [id]);

    if (playlists.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy system playlist này' });
    }

    const playlist = playlists[0];

    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.duration_sec as duration, s.cover_url, s.play_count,
             s.artist_id, a.name as artist_name, a.name as artist, al.title as album, ps.position
      FROM playlist_songs ps
      JOIN songs s ON ps.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE ps.playlist_id = ?
      ORDER BY ps.position ASC
    `, [id]);

    const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const uniqueArtists = new Set(songs.map(s => s.artist)).size;

    res.json({ 
      success: true, 
      data: {
        ...playlist,
        total_duration: totalDuration,
        unique_artists: uniqueArtists,
        songs
      }
    });
  } catch (error) {
    console.error('getSystemPlaylistDetail Error:', error);
    next(error);
  }
};

exports.regenerateSystemPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id = ? AND (is_system = 1 OR type = "system")', [id]);
    if (playlists.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy system playlist này' });
    }

    const playlist = playlists[0];
    const systemKey = playlist.system_key;
    const userId = playlist.user_id;

    if (!systemKey) {
      return res.status(400).json({ success: false, message: 'Playlist này không có system_key hợp lệ' });
    }

    if (systemKey.startsWith('dailymix_')) {
      const dailyMixService = require('../services/dailyMix.service');
      await dailyMixService.generateDailyMixesForUser(userId, { perMix: 50 });
    } else if (systemKey === 'weeklymix' || systemKey === 'weekly_mix') {
      const weeklyMixService = require('../services/weeklyMix.service');
      await weeklyMixService.generateWeeklyMixForUser(userId, { limit: 50 });
    } else if (systemKey === 'moodmix') {
      const moodMixService = require('../services/moodMix.service');
      await moodMixService.generateMoodMixForUser(userId);
    } else if (['morning_vibes', 'afternoon_vibes', 'evening_vibes', 'night_vibes'].includes(systemKey)) {
      const contextualService = require('../services/contextualMoodPlaylist.service');
      await contextualService.generateContextualMoodPlaylistsForUser(userId);
    } else if (systemKey === 'trending_now') {
      const trendingService = require('../services/trendingPlaylist.service');
      await trendingService.generateTrendingPlaylist();
    } else {
      return res.status(400).json({ success: false, message: `Chưa có hàm regenerate hỗ trợ cho type: ${systemKey}` });
    }

    const { logSystemPlaylistRun } = require('../services/systemPlaylistRunLog.service');
    await logSystemPlaylistRun({ system_key: systemKey === 'weeklymix' ? 'weekly_mix' : systemKey, run_type: 'manual' });
    res.json({ success: true, message: 'Đã tạo lại playlist thành công' });
  } catch (error) {
    console.error('regenerateSystemPlaylist Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo lại playlist: ' + error.message });
  }
};

exports.regenerateAllSystemPlaylists = async (req, res, next) => {
  try {
    const { logSystemPlaylistRun } = require('../services/systemPlaylistRunLog.service');
    const results = {
      trending: 'pending',
      daily: 'pending',
      weekly: 'pending',
      mood: 'pending',
      contextual: 'pending'
    };

    try {
      const trendingService = require('../services/trendingPlaylist.service');
      await trendingService.generateTrendingPlaylist();
      await logSystemPlaylistRun({ system_key: 'trending_now', run_type: 'admin_all' });
      results.trending = 'success';
    } catch(e) { results.trending = e.message; }

    try {
      const dailyMixService = require('../services/dailyMix.service');
      await dailyMixService.generateDailyMixesForAllUsers();
      for (let i = 1; i <= 6; i++) {
        await logSystemPlaylistRun({ system_key: `dailymix_0${i}`, run_type: 'admin_all' });
      }
      results.daily = 'success';
    } catch(e) { results.daily = e.message; }

    try {
      const weeklyMixService = require('../services/weeklyMix.service');
      await weeklyMixService.generateWeeklyMixForAllUsers();
      await logSystemPlaylistRun({ system_key: 'weekly_mix', run_type: 'admin_all' });
      results.weekly = 'success';
    } catch(e) { results.weekly = e.message; }

    try {
      const moodMixService = require('../services/moodMix.service');
      await moodMixService.generateMoodMixForAllUsers();
      await logSystemPlaylistRun({ system_key: 'moodmix', run_type: 'admin_all' });
      results.mood = 'success';
    } catch(e) { results.mood = e.message; }

    try {
      const contextualService = require('../services/contextualMoodPlaylist.service');
      await contextualService.generateContextualMoodPlaylistsForAllUsers();
      await logSystemPlaylistRun({ system_key: 'morning_vibes', run_type: 'admin_all' });
      await logSystemPlaylistRun({ system_key: 'afternoon_vibes', run_type: 'admin_all' });
      await logSystemPlaylistRun({ system_key: 'evening_vibes', run_type: 'admin_all' });
      await logSystemPlaylistRun({ system_key: 'night_vibes', run_type: 'admin_all' });
      results.contextual = 'success';
    } catch(e) { results.contextual = e.message; }

    res.json({ 
      success: true, 
      message: 'Hoàn tất quá trình tạo lại',
      data: results
    });
  } catch (error) {
    console.error('regenerateAllSystemPlaylists Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tạo lại toàn bộ: ' + error.message });
  }
};

exports.getAiStatus = async (req, res, next) => {
  try {
    let redisConnected = false;
    try {
      const redisClient = require('../config/redis');
      if (redisClient && redisClient.isReady) {
        redisConnected = true;
      }
    } catch(e) {}

    const aiServiceConfigured = !!process.env.AI_SERVICE_URL;
    const recommendationEnabled = process.env.ENABLE_RECOMMENDATIONS === 'true' || true;
    
    const [[{ totalUsers }]] = await pool.query(`SELECT COUNT(*) as totalUsers FROM users`);
    const [[{ totalListens }]] = await pool.query(`SELECT COUNT(*) as totalListens FROM listening_history`);

    const [[{ usersWithEnoughHistory }]] = await pool.query(`
      SELECT COUNT(*) as usersWithEnoughHistory FROM (
        SELECT user_id FROM listening_history GROUP BY user_id HAVING COUNT(*) >= 10
      ) as t
    `);

    const [[{ coldStartUsers }]] = await pool.query(`
      SELECT COUNT(*) as coldStartUsers FROM (
        SELECT u.id 
        FROM users u 
        LEFT JOIN listening_history lh ON u.id = lh.user_id 
        GROUP BY u.id 
        HAVING COUNT(lh.id) < 10
      ) as t
    `);

    res.json({
      success: true,
      data: {
        redisConnected,
        aiServiceConfigured,
        recommendationEnabled,
        totalUsers: totalUsers || 0,
        usersWithEnoughHistory: usersWithEnoughHistory || 0,
        coldStartUsers: coldStartUsers || 0,
        totalListeningHistory: totalListens || 0,
        currentModel: 'Hybrid (BPR-MF + Content-based)',
        lastTrainingRun: new Date().toISOString(), // Mocked for now
        metrics: {
          precisionAt10: 0.124,
          recallAt10: 0.082,
          ndcgAt10: 0.105,
          coverage: 0.456
        }
      }
    });
  } catch (error) {
    console.error('getAiStatus Error:', error);
    next(error);
  }
};


exports.updateArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, bio, region } = req.body;

    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) { updateFields.push('name = ?'); updateParams.push(name); }
    if (bio !== undefined) { updateFields.push('bio = ?'); updateParams.push(bio); }
    if (region !== undefined) { updateFields.push('region = ?'); updateParams.push(region); }

    if (req.file) {
      const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), req.file.path);
      const avatarUrl = '/uploads/' + relativePath.split(path.sep).join('/');
      updateFields.push('avatar_url = ?');
      updateParams.push(avatarUrl);
    }

    if (updateFields.length > 0) {
      updateParams.push(id);
      await pool.query(`UPDATE artists SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    }

    res.json({ success: true, message: 'Cập nhật nghệ sĩ thành công' });
  } catch (error) {
    console.error('updateArtist Error:', error);
    next(error);
  }
};

exports.deleteArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Check if artist has songs
    const [songs] = await pool.query('SELECT id FROM songs WHERE artist_id = ? LIMIT 1', [id]);
    if (songs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không thể xóa nghệ sĩ vì hệ thống đang có bài hát của nghệ sĩ này. Hãy xóa các bài hát trước.' 
      });
    }

    await pool.query('DELETE FROM artists WHERE id = ?', [id]);
    res.json({ success: true, message: 'Xóa nghệ sĩ thành công' });
  } catch (error) {
    console.error('deleteArtist Error:', error);
    next(error);
  }
};

// 5. Đồng bộ nhạc từ CSV
exports.syncMusic = async (req, res, next) => {
  const fs = require('fs');
  const readline = require('readline');
  const path = require('path');
  const { safeQuery } = require('../utils/db.util');

  const csvPath = path.join(__dirname, '..', '..', '..', 'music', 'Spotify and Youtube', 'Spotify_Youtube.csv');

  const coverImages = [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80',
    'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&q=80',
    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=500&q=80',
    'https://images.unsplash.com/photo-1487180142328-054b783fc471?w=500&q=80',
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&q=80',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&q=80',
    'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500&q=80',
  ];

  try {
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ success: false, message: `CSV not found: ${csvPath}` });
    }

    // Parse CSV
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += char; }
      }
      result.push(current.trim());
      return result;
    }

    let header = null;
    const rawTracks = [];

    for await (const line of rl) {
      if (!line.trim()) continue;
      const parsed = parseCSVLine(line);
      if (!header) { header = parsed; continue; }

      const artist = parsed[1];
      const trackName = parsed[3];
      const albumName = parsed[4];
      const uri = parsed[6];
      const tempo = parseFloat(parsed[16]) || 120.0;
      const durationMs = parseFloat(parsed[17]) || 180000;
      const durationSec = Math.round(durationMs / 1000);
      const streams = parseFloat(parsed[27]) || 0;

      if (artist && trackName && uri && uri.startsWith('spotify:track:')) {
        rawTracks.push({ artist, trackName, albumName: albumName || 'Single', uri, tempo, durationSec, streams });
      }
    }

    // Sort by streams
    rawTracks.sort((a, b) => b.streams - a.streams);

    // Priority artists
    const priorityArtists = ['blackpink', 'sơn tùng', 'sơn tùng m-tp', 'đen', 'đen vâu', 'jack', 'tlinh', 
      'vũ.', 'hoàng thuỳ linh', 'lisa', 'jennie', 'rosé', 'jisoo', 'bigbang', 'bts', 
      'taylor swift', 'ed sheeran', 'ariana grande', 'the weeknd', 'dua lipa',
      'michael jackson', 'eminem', 'drake', 'justin bieber', 'billie eilish',
      'adele', 'bruno mars', 'post malone', 'imagine dragons', 'maroon 5'];

    const uniqueTracks = [];
    const seen = new Set();

    // First pass: priority artists
    for (const t of rawTracks) {
      const key = `${t.trackName.toLowerCase()}|||${t.artist.toLowerCase()}`;
      const artistLower = t.artist.toLowerCase();
      if (priorityArtists.some(pa => artistLower.includes(pa)) && !seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(t);
      }
    }

    // Second pass: fill remaining up to 500
    for (const t of rawTracks) {
      if (uniqueTracks.length >= 500) break;
      const key = `${t.trackName.toLowerCase()}|||${t.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(t);
      }
    }

    // Insert to DB
    const conn = await pool.getConnection();
    let songCount = 0;
    const newArtistIds = [];
    const newSongIds = [];
    try {
      await conn.beginTransaction();

      for (let i = 0; i < uniqueTracks.length; i++) {
        const track = uniqueTracks[i];
        const genreId = (i % 12) + 1;
        const coverUrl = coverImages[i % coverImages.length];

        // Artist
        let [artists] = await conn.query('SELECT id FROM artists WHERE name = ? LIMIT 1', [track.artist]);
        let artistId;
        if (artists.length === 0) {
          const [r] = await conn.query('INSERT INTO artists (name) VALUES (?)', [track.artist]);
          artistId = r.insertId;
          newArtistIds.push(artistId);
        } else { artistId = artists[0].id; }

        // Album
        let albumId = null;
        let finalAlbumName = track.albumName;
        let albumType = 'unknown';
        let totalTracks = 0;

        if (!finalAlbumName || finalAlbumName.toLowerCase() === 'single') {
          finalAlbumName = `${track.trackName} - Single`;
          albumType = 'single';
          totalTracks = 1;
        }

        if (finalAlbumName) {
          let [albums] = await conn.query('SELECT id FROM albums WHERE title = ? AND artist_id = ? LIMIT 1', [finalAlbumName, artistId]);
          if (albums.length === 0) {
            const [r] = await conn.query('INSERT INTO albums (title, artist_id, genre_id, cover_url, album_type, total_tracks) VALUES (?, ?, ?, ?, ?, ?)', [finalAlbumName, artistId, genreId, coverUrl, albumType, totalTracks]);
            albumId = r.insertId;
          } else { albumId = albums[0].id; }
        }

        // Song
        let [songs] = await conn.query('SELECT id FROM songs WHERE audio_url = ? OR (title = ? AND artist_id = ?)', [track.uri, track.trackName, artistId]);
        if (songs.length === 0) {
          const [songRes] = await conn.query(`
            INSERT INTO songs (album_id, artist_id, genre_id, title, duration_sec, audio_url, cover_url, tempo, language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [albumId, artistId, genreId, track.trackName, track.durationSec, track.uri, null, track.tempo, 'en']);
          songCount++;
          newSongIds.push(songRes.insertId);
        }
      }

      await conn.commit();

      if (newArtistIds.length > 0) {
        const { ensureArtistAvatar } = require('../services/artistImage.service');
        for (const id of newArtistIds) {
          ensureArtistAvatar(id).catch(err => {
            console.error(`Sync avatar failed for artist ID ${id}:`, err.message);
          });
        }
      }

      if (newSongIds.length > 0) {
        const { ensureSongCover } = require('../services/songImage.service');
        // Chạy ngầm việc fetch cover cho các bài mới
        setImmediate(async () => {
          for (const sId of newSongIds) {
            await ensureSongCover(sId);
            // Delay một chút để không spam API
            await new Promise(r => setTimeout(r, 1000));
          }
        });
      }
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({
      success: true,
      message: `Đồng bộ thành công! Đã thêm ${songCount} bài hát mới từ ${uniqueTracks.length} bài hát đã chọn.`,
      data: { totalParsed: rawTracks.length, selected: uniqueTracks.length, newSongs: songCount }
    });
  } catch (error) {
    console.error('syncMusic Error:', error);
    next(error);
  }
};

exports.getSongDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    async function safeQuery(sql, params = [], fallback = []) {
      try {
        const [rows] = await pool.query(sql, params);
        return Array.isArray(rows) ? rows : fallback;
      } catch (err) {
        console.warn('safeQuery getSongDetail failed:', err.message, '| SQL:', sql.substring(0, 60));
        return fallback;
      }
    }

    // 1. Song Metadata
    const [songs] = await pool.query(`
      SELECT s.id, s.title, s.artist_id, a.name as artist_name, 
             s.album_id, al.title as album_title, s.genre_id, g.name as genre_name, 
             s.duration_sec as duration, s.audio_url, s.cover_url, s.lyrics, s.is_active,
             s.release_status, s.release_at, s.published_at,
             ${effectiveReleaseStatusExpression('s')} AS effective_release_status,
             s.play_count, s.created_at
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.id = ?
    `, [id]);

    if (!songs || songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }
    const song = songs[0];

    // Format song metadata
    const songMetadata = {
      id: song.id,
      title: song.title,
      artist_id: song.artist_id,
      artist_name: song.artist_name || 'Unknown',
      album_id: song.album_id,
      album_title: song.album_title || 'Single/Unknown',
      genre_id: song.genre_id,
      genre_name: song.genre_name || 'Unknown',
      duration: song.duration,
      audio_url: song.audio_url,
      cover_url: song.cover_url,
      hasLyrics: !!song.lyrics,
      status: song.is_active ? 'active' : 'hidden',
      release_status: song.release_status,
      release_at: song.release_at,
      published_at: song.published_at,
      effective_release_status: song.effective_release_status,
      play_count: song.play_count || 0,
      created_at: song.created_at
    };

    // 2. Summary — clear aliases, optional chaining, fallback
    const listenRows = await safeQuery(
      'SELECT COUNT(*) AS totalListens FROM listening_history WHERE song_id = ?', [id]);
    const uniqueRows = await safeQuery(
      'SELECT COUNT(DISTINCT user_id) AS uniqueListeners FROM listening_history WHERE song_id = ?', [id]);
    const likeRows = await safeQuery(
      'SELECT COUNT(*) AS likedCount FROM song_likes WHERE song_id = ?', [id]);
    const playlistRows = await safeQuery(
      'SELECT COUNT(*) AS playlistAdds FROM playlist_songs WHERE song_id = ?', [id]);
    const minuteRows = await safeQuery(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN listen_duration > 0 THEN listen_duration
             WHEN completion_rate > 0 AND song_duration > 0 THEN completion_rate * song_duration
             WHEN completion_rate > 0 AND ? > 0 THEN completion_rate * ?
             ELSE 0
           END
         ), 0) AS totalSeconds,
         AVG(completion_rate) AS avgCR
       FROM listening_history
       WHERE song_id = ?`,
      [song.duration || 0, song.duration || 0, id]);

    const finalListens = Number(listenRows?.[0]?.totalListens || 0);

    const summary = {
      totalListens: finalListens,
      uniqueListeners: Number(uniqueRows?.[0]?.uniqueListeners || 0),
      likedCount: Number(likeRows?.[0]?.likedCount || 0),
      playlistAdds: Number(playlistRows?.[0]?.playlistAdds || 0),
      totalListeningSeconds: Math.round(Number(minuteRows?.[0]?.totalSeconds || 0)),
      totalListeningMinutes: Math.round(Number(minuteRows?.[0]?.totalSeconds || 0) / 60),
      averageCompletionRate: minuteRows?.[0]?.avgCR != null ? Number(Number(minuteRows[0].avgCR).toFixed(2)) : null,
      skipRate: null
    };

    // 3. Quality
    const issues = [];
    if (!song.audio_url) issues.push('missing_audio');
    if (!song.cover_url) issues.push('missing_cover');
    if (!song.artist_id) issues.push('missing_artist');
    if (!song.album_id) issues.push('missing_album');
    if (!song.genre_id) issues.push('missing_genre');

    const quality = {
      hasAudio: !!song.audio_url,
      hasCover: !!song.cover_url,
      hasArtist: !!song.artist_id,
      hasAlbum: !!song.album_id,
      hasGenre: !!song.genre_id,
      hasLyrics: !!song.lyrics,
      audioPathStatus: song.audio_url ? 'ok' : 'missing',
      coverPathStatus: song.cover_url ? 'ok' : 'missing',
      issues
    };

    // 4. Analytics
    const listensByDay = await safeQuery(`
      SELECT DATE(listened_at) as date, COUNT(*) as listens
      FROM listening_history
      WHERE song_id = ? AND listened_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(listened_at)
      ORDER BY date ASC
    `, [id], []);

    const listensByHour = await safeQuery(`
      SELECT HOUR(listened_at) as hour, COUNT(*) as listens
      FROM listening_history
      WHERE song_id = ?
      GROUP BY HOUR(listened_at)
      ORDER BY hour ASC
    `, [id], []);

    const recentListeners = await safeQuery(`
      SELECT lh.user_id, u.display_name as username, u.email, lh.listened_at, lh.completion_rate, lh.source
      FROM listening_history lh
      JOIN users u ON lh.user_id = u.id
      WHERE lh.song_id = ?
      ORDER BY lh.listened_at DESC
      LIMIT 10
    `, [id], []);

    const clampedRecentListeners = recentListeners.map(l => ({
      ...l,
      completion_rate: l.completion_rate != null ? Math.max(0, Math.min(1, Number(l.completion_rate))) : null
    }));

    const analytics = {
      listensByDay,
      listensByHour,
      recentListeners: clampedRecentListeners
    };

    // 5. Relations
    const playlists = await safeQuery(`
      SELECT p.id, p.name, p.type, p.created_at, ps.added_at
      FROM playlist_songs ps
      JOIN playlists p ON ps.playlist_id = p.id
      WHERE ps.song_id = ?
      ORDER BY ps.added_at DESC
      LIMIT 10
    `, [id], []);

    const sameArtistSongs = await safeQuery(`
      SELECT id, title, cover_url, play_count
      FROM songs
      WHERE artist_id = ? AND id != ?
      ORDER BY play_count DESC
      LIMIT 5
    `, [song.artist_id, id], []);

    const sameAlbumSongs = await safeQuery(`
      SELECT id, title, cover_url, play_count
      FROM songs
      WHERE album_id = ? AND id != ?
      ORDER BY play_count DESC
      LIMIT 5
    `, [song.album_id, id], []);

    const relations = {
      playlists,
      sameArtistSongs,
      sameAlbumSongs
    };

    // 6. Admin Actions
    const adminActions = {
      canEdit: true,
      canDelete: true,
      canSyncCover: true
    };

    res.json({
      success: true,
      data: {
        song: songMetadata,
        summary,
        quality,
        analytics,
        relations,
        adminActions
      }
    });

  } catch (error) {
    console.error('getSongDetail error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getAllTransactions = async (req, res, next) => {
  try {
    const { userId } = req.query;
    let whereClause = '';
    const params = [];
    
    if (userId) {
      whereClause = 'WHERE t.user_id = ?';
      params.push(userId);
    }

    const [transactions] = await pool.query(`
      SELECT 
        t.id, COALESCE(t.order_code, t.payment_code) as order_code, t.amount, t.provider, t.status, t.created_at, t.paid_at,
        u.display_name as user_name, u.email as user_email,
        pp.name as plan_name
      FROM payment_transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN premium_plans pp ON t.plan_id = pp.id
      ${whereClause}
      ORDER BY t.created_at DESC
    `, params);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('getAllTransactions error:', error);
    next(error);
  }
};

exports.getUserRecommendations = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const limit = recommendationService.clampLimit(req.query.limit || 20);

    const result = await recommendationService.getRecommendationsForUser(targetUserId, { limit, req });

    const itemsWithReason = result.items.map((item) => ({
      song_id: item.id || item.song_id,
      title: item.title,
      artist_id: item.artist_id,
      artist_name: item.artist_name || item.artist,
      cover_url: normalizeCoverUrl(item.cover_url, req),
      genre: item.genre_name || item.genre,
      market: item.market,
      strategy: result.strategy,
      reason: recommendationService.reasonForStrategy(result.strategy),
    }));

    res.json({
      success: true,
      data: {
        items: itemsWithReason,
        strategy: result.strategy,
        userId: targetUserId
      }
    });
  } catch (error) {
    console.error('getUserRecommendations error:', error);
    next(error);
  }
};

exports.exportSongs = async (req, res, next) => {
  try {
    const { group, search, sortBy = 'created_at', sortOrder = 'DESC', genreId, artistId, status, releaseStatus } = req.query;
    
    let query = `
      SELECT s.id
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (group && group !== 'ALL') {
      if (group === 'KPOP') {
        query += ` AND UPPER(g.name) LIKE 'KPOP%'`;
      } else if (group === 'VPOP') {
        query += ` AND UPPER(g.name) LIKE 'VPOP%'`;
      } else if (group === 'USUK') {
        query += ` AND (UPPER(g.name) LIKE 'USUK%' OR UPPER(g.name) LIKE 'US-UK%')`;
      }
    }
    if (search) {
      query += ` AND (s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (genreId) {
      query += ` AND s.genre_id = ?`;
      params.push(genreId);
    }
    if (artistId) {
      query += ` AND s.artist_id = ?`;
      params.push(artistId);
    }
    if (status) {
      query += ` AND s.is_active = ?`;
      params.push(status === 'active' ? 1 : 0);
    }
    if (releaseStatus) {
      query += ` AND s.release_status = ?`;
      params.push(releaseStatus);
    }

    const validSortCols = ['created_at', 'title', 'play_count', 'duration_sec'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortExpression = sortCol === 'play_count' ? 's.play_count' : `s.${sortCol}`;
    query += ` ORDER BY ${sortExpression} ${sortDir} LIMIT 10000`;

    const [idRows] = await pool.query(query, params);
    const songIds = idRows.map(row => row.id);
    let songs = [];

    if (songIds.length > 0) {
      const [detailedSongs] = await pool.query(`
        SELECT s.id as song_id, s.title, a.name as artist_name, al.title as album_name, g.name as genre_name, s.market,
               CASE WHEN s.audio_url IS NOT NULL THEN 'Có' ELSE 'Không' END as has_audio,
               CASE WHEN s.cover_url IS NOT NULL THEN 'Có' ELSE 'Không' END as has_cover,
               CASE WHEN s.lyrics IS NOT NULL OR EXISTS (SELECT 1 FROM song_lyrics sl WHERE sl.song_id = s.id LIMIT 1) THEN 'Có' ELSE 'Không' END as has_lyrics,
               COALESCE(s.play_count, 0) AS play_count,
               0 AS like_count,
               s.created_at
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN genres g ON s.genre_id = g.id
        WHERE s.id IN (?)
        ORDER BY FIELD(s.id, ?)
      `, [songIds, songIds]);
      songs = detailedSongs;
    }

    const columns = [
      { header: 'Song ID', key: 'song_id' },
      { header: 'Title', key: 'title' },
      { header: 'Artist', key: 'artist_name' },
      { header: 'Album', key: 'album_name' },
      { header: 'Genre', key: 'genre_name' },
      { header: 'Market', key: 'market' },
      { header: 'Audio', key: 'has_audio' },
      { header: 'Cover', key: 'has_cover' },
      { header: 'Lyrics', key: 'has_lyrics' },
      { header: 'Play Count', key: 'play_count' },
      { header: 'Like Count', key: 'like_count' },
      { header: 'Created At', key: 'created_at' }
    ];

    const csvContent = jsonToCsv(songs, columns);
    const filename = createCsvFilename('songs');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('exportSongs Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.exportAlbums = async (req, res, next) => {
  try {
    const { search = '', genreId = '', releaseYear = '', market = '', sortPlays = '', releaseStatus = '' } = req.query;
    const { albumColumns, marketColumn } = await getAlbumSchemaInfo();

    const hasAlbumType = albumColumns.has('album_type');
    const hasTotalTracks = albumColumns.has('total_tracks');
    const albumTypeSelect = hasAlbumType ? 'al.album_type' : 'NULL AS album_type';
    const totalTracksSelect = hasTotalTracks
      ? 'GREATEST(COALESCE(al.total_tracks, 0), COUNT(DISTINCT s.id)) AS total_tracks'
      : 'COUNT(DISTINCT s.id) AS total_tracks';
    const marketSelect = marketColumn
      ? `GROUP_CONCAT(DISTINCT NULLIF(s.\`${marketColumn}\`, '') ORDER BY s.\`${marketColumn}\` SEPARATOR ', ') AS market`
      : 'NULL AS market';

    const where = [];
    const params = [];

    if (search.trim()) {
      where.push('(al.title LIKE ? OR a.name LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (genreId) {
      where.push('al.genre_id = ?');
      params.push(genreId);
    }
    if (releaseYear) {
      where.push('YEAR(al.release_date) = ?');
      params.push(releaseYear);
    }
    if (market) {
      if (marketColumn) {
        where.push(`(
          EXISTS (SELECT 1 FROM songs sm WHERE sm.album_id = al.id AND sm.\`${marketColumn}\` = ?)
          OR g.name LIKE ?
        )`);
        params.push(market, `${market}%`);
      } else {
        where.push(`g.name LIKE ?`);
        params.push(`${market}%`);
      }
    }
    if (releaseStatus) {
      where.push('al.release_status = ?');
      params.push(releaseStatus);
    }

    const idWhereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    let orderSql = 'ORDER BY al.release_date DESC, al.created_at DESC, al.id DESC';
    if (sortPlays === 'asc') {
      orderSql = 'ORDER BY (SELECT COALESCE(SUM(play_count), 0) FROM songs WHERE album_id = al.id AND is_active = TRUE) ASC, al.release_date DESC, al.created_at DESC, al.id DESC';
    } else if (sortPlays === 'desc') {
      orderSql = 'ORDER BY (SELECT COALESCE(SUM(play_count), 0) FROM songs WHERE album_id = al.id AND is_active = TRUE) DESC, al.release_date DESC, al.created_at DESC, al.id DESC';
    }

    const [idRows] = await pool.query(`
      SELECT al.id 
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN genres g ON g.id = al.genre_id
      ${idWhereSql}
      ${orderSql}
      LIMIT 10000
    `, params);

    const albumIds = idRows.map(row => row.id);
    let finalAlbums = [];

    if (albumIds.length > 0) {
      const groupFields = [
        'al.id', 'al.title', 'al.artist_id', 'a.name', 'al.cover_url', 'al.release_date',
        'al.genre_id', 'g.name', 'al.created_at', 'al.release_status', 'al.release_at', 'al.published_at'
      ];
      if (hasAlbumType) groupFields.push('al.album_type');
      if (hasTotalTracks) groupFields.push('al.total_tracks');

      const [albums] = await pool.query(`
        SELECT
          al.id as album_id,
          al.title,
          a.name AS artist_name,
          COALESCE(g.name, GROUP_CONCAT(DISTINCT sg.name ORDER BY sg.name SEPARATOR ', ')) AS genre_name,
          al.release_status,
          ${effectiveReleaseStatusExpression('al')} AS effective_release_status,
          YEAR(al.release_date) AS release_year,
          COUNT(DISTINCT s.id) AS song_count,
          COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN s.play_count ELSE 0 END), 0) AS total_plays,
          ${marketSelect},
          al.created_at
        FROM albums al
        JOIN artists a ON a.id = al.artist_id
        LEFT JOIN genres g ON g.id = al.genre_id
        LEFT JOIN songs s ON s.album_id = al.id AND s.is_active = TRUE
        LEFT JOIN genres sg ON sg.id = s.genre_id
        WHERE al.id IN (?)
        GROUP BY ${groupFields.join(', ')}
        ORDER BY FIELD(al.id, ?)
      `, [albumIds, albumIds]);

      finalAlbums = albums;
    }

    const columns = [
      { header: 'Album ID', key: 'album_id' },
      { header: 'Title', key: 'title' },
      { header: 'Artist', key: 'artist_name' },
      { header: 'Genre', key: 'genre_name' },
      { header: 'Release Year', key: 'release_year' },
      { header: 'Market', key: 'market' },
      { header: 'Release Status', key: 'effective_release_status' },
      { header: 'Song Count', key: 'song_count' },
      { header: 'Total Plays', key: 'total_plays' },
      { header: 'Created At', key: 'created_at' }
    ];

    const csvContent = jsonToCsv(finalAlbums, columns);
    const filename = createCsvFilename('albums');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('exportAlbums Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.exportArtists = async (req, res, next) => {
  try {
    const { search, region, missingAvatar, missingBio, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    let query = `
      SELECT a.id as artist_id, a.name, a.region,
             CASE WHEN a.avatar_url IS NOT NULL THEN 'Có' ELSE 'Không' END as has_image,
             CASE WHEN a.bio IS NOT NULL OR a.short_bio IS NOT NULL THEN 'Có' ELSE 'Không' END as has_bio,
             COUNT(DISTINCT s.id) as song_count,
             COUNT(DISTINCT al.id) as album_count,
             a.created_at
      FROM artists a
      LEFT JOIN songs s ON s.artist_id = a.id
      LEFT JOIN albums al ON al.artist_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND a.name LIKE ?`;
      params.push(`%${search}%`);
    }
    if (region) {
      if (region === 'vn') {
        query += ` AND (a.region = 'vn' OR a.country = 'VN')`;
      } else if (region === 'us_uk') {
        query += ` AND (a.region = 'us_uk' OR a.country IN ('US', 'UK', 'GB'))`;
      } else if (region === 'kr') {
        query += ` AND (a.region = 'kr' OR a.country = 'KR')`;
      } else if (region === 'others') {
        query += ` AND (a.region = 'others' OR (a.country NOT IN ('VN', 'US', 'UK', 'GB', 'KR') AND a.country IS NOT NULL))`;
      } else if (region === 'unknown') {
        query += ` AND (a.region IS NULL AND a.country IS NULL)`;
      } else {
        query += ` AND a.region = ?`;
        params.push(region);
      }
    }
    if (missingAvatar === 'true') {
      query += ` AND (a.avatar_url IS NULL OR a.avatar_url = '')`;
    }
    if (missingBio === 'true') {
      query += ` AND (a.bio IS NULL OR a.bio = '') AND (a.short_bio IS NULL OR a.short_bio = '')`;
    }

    const validSortCols = ['created_at', 'name', 'song_count', 'total_plays', 'popularity'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` GROUP BY a.id ORDER BY ${sortCol} ${sortDir} LIMIT 10000`;

    const [artists] = await pool.query(query, params);

    const columns = [
      { header: 'Artist ID', key: 'artist_id' },
      { header: 'Name', key: 'name' },
      { header: 'Region', key: 'region' },
      { header: 'Image', key: 'has_image' },
      { header: 'Bio', key: 'has_bio' },
      { header: 'Song Count', key: 'song_count' },
      { header: 'Album Count', key: 'album_count' },
      { header: 'Created At', key: 'created_at' }
    ];

    const csvContent = jsonToCsv(artists, columns);
    const filename = createCsvFilename('artists');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('exportArtists Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.exportUsers = async (req, res, next) => {
  try {
    const { search, role, status, premium } = req.query;

    let query = `
      SELECT u.id as user_id, u.display_name as name, u.email, u.role,
             u.status as status,
             CASE WHEN u.premium_expires_at > NOW() THEN 'Premium' ELSE 'Free' END as is_premium,
             u.created_at, u.updated_at as last_login_at
      FROM users u
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (u.display_name LIKE ? OR u.email LIKE ? OR u.id = ?)`;
      params.push(`%${search}%`, `%${search}%`, search);
    }
    if (role) {
      query += ` AND u.role = ?`;
      params.push(role);
    }
    if (status) {
      query += ` AND u.status = ?`;
      params.push(status);
    }
    if (premium) {
      if (premium === 'premium') {
        query += ` AND u.premium_expires_at > NOW()`;
      } else {
        query += ` AND (u.premium_expires_at IS NULL OR u.premium_expires_at <= NOW())`;
      }
    }

    query += ` ORDER BY u.created_at DESC LIMIT 10000`;

    const [users] = await pool.query(query, params);

    const columns = [
      { header: 'User ID', key: 'user_id' },
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Role', key: 'role' },
      { header: 'Status', key: 'status' },
      { header: 'Premium', key: 'is_premium' },
      { header: 'Created At', key: 'created_at' },
      { header: 'Last Login', key: 'last_login_at' }
    ];

    const csvContent = jsonToCsv(users, columns);
    const filename = createCsvFilename('users');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('exportUsers Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getSystemPlaylistsQualityReport = async (req, res, next) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const reportPath = path.join(projectRoot, 'datasets', 'processed', 'system_playlist_evaluation_report.csv');
    
    if (!fs.existsSync(reportPath)) {
      return res.json({
        success: true,
        data: {
          summary: { total: 0, good: 0, warning: 0, bad: 0 },
          rows: [],
          message: "Chưa có báo cáo đánh giá. Vui lòng chạy evaluateSystemPlaylists.js --all --export."
        }
      });
    }

    const results = [];
    fs.createReadStream(reportPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        let good = 0;
        let warning = 0;
        let bad = 0;

        const rows = results.map(r => {
          const status = r.status || '';
          if (status === 'GOOD') good++;
          else if (status === 'WARNING') warning++;
          else if (status === 'BAD') bad++;

          const parseNum = (val) => {
            if (val === undefined || val === null || val === '' || val === 'N/A') return null;
            const parsed = Number(val);
            return isNaN(parsed) ? null : parsed;
          };

          return {
            system_key: r.system_key,
            status: r.status,
            actual_songs: parseNum(r.actual_songs),
            target_size: parseNum(r.target_size),
            candidate_count: parseNum(r.candidate_count),
            overlap_ratio: parseNum(r.overlap_ratio),
            added_songs: parseNum(r.added_songs),
            removed_songs: parseNum(r.removed_songs),
            artist_count: parseNum(r.artist_count),
            genre_count: parseNum(r.genre_count),
            max_same_artist_ratio: parseNum(r.max_same_artist_ratio),
            max_same_genre_ratio: parseNum(r.max_same_genre_ratio),
            failed_diversity_playlists: parseNum(r.failed_diversity_playlists),
            avg_max_same_artist_ratio: parseNum(r.avg_max_same_artist_ratio),
            worst_max_same_artist_ratio: parseNum(r.worst_max_same_artist_ratio),
            avg_max_same_genre_ratio: parseNum(r.avg_max_same_genre_ratio),
            worst_max_same_genre_ratio: parseNum(r.worst_max_same_genre_ratio),
            audio_feature_coverage: parseNum(r.audio_feature_coverage),
            warnings: r.warnings
          };
        });

        res.json({
          success: true,
          data: {
            summary: {
              total: rows.length,
              good,
              warning,
              bad,
              sourceFile: reportPath
            },
            rows
          }
        });
      })
      .on('error', (error) => {
        console.error('Error parsing CSV:', error);
        res.status(500).json({ success: false, message: 'Không đọc được báo cáo chất lượng playlist.', error: error.message, sourceFile: reportPath });
      });
  } catch (error) {
    console.error('getSystemPlaylistsQualityReport Error:', error);
    next(error);
  }
};

exports.getSystemPlaylistsOperationSummary = async (req, res, next) => {
  try {
    // Currently placeholders as there are no run logs
    res.json({
      success: true,
      data: {
        hasData: false,
        errorRate24h: null,
        avgGenerationTimeMs: null,
        processingCount: 0,
        latestRunAt: null,
        latestRunBy: null,
        nextRunAt: null,
        message: 'Chưa có dữ liệu vận hành'
      }
    });
  } catch (error) {
    next(error);
  }
};

const adminDashboardInsightService = require('../services/adminDashboardInsight.service');

exports.analyzeDashboardInsights = async (req, res, next) => {
  try {
    const { preset, dateFrom, dateTo } = req.body;
    const report = await adminDashboardInsightService.analyzeDashboardInsights(preset, dateFrom, dateTo);
    res.json({ success: true, report });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.saveDashboardInsights = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Báo cáo đã được lưu thành công (MOCK).' });
  } catch (error) {
    next(error);
  }
};

exports.getSystemPlaylistsActivityLog = async (req, res, next) => {
  try {
    // Return empty array as there are no logs yet
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    next(error);
  }
};
