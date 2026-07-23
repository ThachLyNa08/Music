const { pool } = require('../config/database');
const songImageService = require('../services/songImage.service');
const audioFeatureService = require('../services/audioFeature.service');

const getStatusCondition = (statusParam, field) => {
  if (statusParam === 'missing') return `${field} IS NULL OR ${field} = ''`;
  if (statusParam === 'has') return `${field} IS NOT NULL AND ${field} != ''`;
  return null; // all
};

const getBoolFieldCondition = (statusParam, field) => {
  if (statusParam === 'missing') return `${field} IS NULL`;
  if (statusParam === 'has') return `${field} IS NOT NULL`;
  return null;
}

const APPROVED_CATALOG_WHERE = `COALESCE(s.review_status, 'approved') = 'approved' AND (s.is_active = 1 OR s.is_active IS NULL)`;

exports.getSummary = async (req, res, next) => {
  try {
    const [[{ totalSongs }]] = await pool.query(`SELECT COUNT(*) AS totalSongs FROM songs s WHERE ${APPROVED_CATALOG_WHERE}`);
    const [[{ coverCount }]] = await pool.query(`SELECT COUNT(*) AS coverCount FROM songs s WHERE ${APPROVED_CATALOG_WHERE} AND cover_url IS NOT NULL AND cover_url != ''`);
    const [[{ lyricsCount }]] = await pool.query(`SELECT COUNT(*) AS lyricsCount FROM songs s JOIN song_lyrics sl ON s.id = sl.song_id WHERE ${APPROVED_CATALOG_WHERE}`);
    const [[{ featureCount }]] = await pool.query(`SELECT COUNT(*) AS featureCount FROM songs s JOIN song_audio_features saf ON s.id = saf.song_id WHERE ${APPROVED_CATALOG_WHERE}`);

    const healthQuery = `
      SELECT
        SUM(IF(health_score = 3, 1, 0)) AS excellent,
        SUM(IF(health_score = 2, 1, 0)) AS good,
        SUM(IF(health_score = 1, 1, 0)) AS fair,
        SUM(IF(health_score = 0, 1, 0)) AS poor
      FROM (
        SELECT
          (IF(s.cover_url IS NOT NULL AND s.cover_url != '', 1, 0) +
           IF(sl.song_id IS NOT NULL, 1, 0) +
           IF(saf.song_id IS NOT NULL, 1, 0)) AS health_score
        FROM songs s
        LEFT JOIN song_lyrics sl ON s.id = sl.song_id
        LEFT JOIN song_audio_features saf ON s.id = saf.song_id
        WHERE ${APPROVED_CATALOG_WHERE}
      ) t
    `;
    const [[healthDist]] = await pool.query(healthQuery);

    res.json({
      success: true,
      data: {
        totalSongs: parseInt(totalSongs, 10) || 0,
        cover: { has: parseInt(coverCount, 10) || 0, total: parseInt(totalSongs, 10) || 0 },
        lyrics: { has: parseInt(lyricsCount, 10) || 0, total: parseInt(totalSongs, 10) || 0 },
        audioFeatures: { has: parseInt(featureCount, 10) || 0, total: parseInt(totalSongs, 10) || 0 },
        healthDistribution: {
          excellent: parseInt(healthDist.excellent, 10) || 0,
          good: parseInt(healthDist.good, 10) || 0,
          fair: parseInt(healthDist.fair, 10) || 0,
          poor: parseInt(healthDist.poor, 10) || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, cover, lyrics, features } = req.query;

    let whereClauses = [
      `COALESCE(s.review_status, 'approved') = 'approved'`,
      `(s.is_active = 1 OR s.is_active IS NULL)`
    ];
    let params = [];

    if (search) {
      whereClauses.push('(s.title LIKE ? OR a.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (cover === 'missing') {
      whereClauses.push("(s.cover_url IS NULL OR s.cover_url = '')");
    } else if (cover === 'has') {
      whereClauses.push("(s.cover_url IS NOT NULL AND s.cover_url != '')");
    }

    if (lyrics === 'missing') {
      whereClauses.push('sl.song_id IS NULL');
    } else if (lyrics === 'has') {
      whereClauses.push('sl.song_id IS NOT NULL');
    }

    if (features === 'missing') {
      whereClauses.push('saf.song_id IS NULL');
    } else if (features === 'has') {
      whereClauses.push('saf.song_id IS NOT NULL');
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countQuery = `
      SELECT COUNT(s.id) AS total
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      LEFT JOIN song_audio_features saf ON s.id = saf.song_id
      ${whereSql}
    `;

    const [[{ total }]] = await pool.query(countQuery, params);

    const dataQuery = `
      SELECT
        s.id, s.title, s.cover_url, s.created_at AS updated_at,
        a.name AS artist_name,
        al.title AS album_title,
        IF(s.cover_url IS NOT NULL AND s.cover_url != '', 1, 0) AS has_cover,
        IF(sl.song_id IS NOT NULL, 1, 0) AS has_lyrics,
        IF(saf.song_id IS NOT NULL, 1, 0) AS has_features
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      LEFT JOIN song_audio_features saf ON s.id = saf.song_id
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

    const formattedRows = rows.map(row => {
      let health = 'OK';
      let missingList = [];
      if (!row.has_cover) missingList.push('Cover');
      if (!row.has_lyrics) missingList.push('Lyrics');
      if (!row.has_features) missingList.push('Audio Features');

      if (missingList.length === 3) health = 'Thiếu nhiều dữ liệu';
      else if (missingList.length > 0) health = `Thiếu ${missingList.join(', ')}`;

      return {
        id: row.id,
        title: row.title,
        artist_name: row.artist_name,
        album_title: row.album_title,
        cover_url: row.cover_url,
        updated_at: row.updated_at,
        has_cover: !!row.has_cover,
        has_lyrics: !!row.has_lyrics,
        has_features: !!row.has_features,
        health
      };
    });

    res.json({
      success: true,
      data: formattedRows,
      pagination: {
        total: parseInt(total, 10),
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT
        s.id, s.title, s.cover_url, s.audio_url, s.duration_sec AS duration,
        a.name AS artist_name,
        al.title AS album_title,
        g.name AS genre_name,
        IF(s.cover_url IS NOT NULL AND s.cover_url != '', 1, 0) AS has_cover,
        IF(sl.song_id IS NOT NULL, 1, 0) AS has_lyrics,
        IF(saf.song_id IS NOT NULL, 1, 0) AS has_features,
        saf.*,
        sl.plain_lyrics, sl.sync_type,
        s.id
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      LEFT JOIN song_audio_features saf ON s.id = saf.song_id
      WHERE s.id = ?
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.fetchCover = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await songImageService.ensureSongCover(id);
    if (!result) {
      return res.status(400).json({ success: false, message: 'Could not fetch cover. Not found or error.' });
    }
    res.json({ success: true, message: 'Cover fetched successfully', cover_url: result });
  } catch (error) {
    next(error);
  }
};

exports.analyzeFeatures = async (req, res, next) => {
  try {
    const { id } = req.params;
    // We need audio_url to call analyzeAndSave
    const [[song]] = await pool.query('SELECT audio_url FROM songs WHERE id = ?', [id]);
    if (!song || !song.audio_url) {
      return res.status(400).json({ success: false, message: 'Song audio not found' });
    }

    const result = await audioFeatureService.analyzeAndSave(id, song.audio_url);
    res.json({ success: true, message: 'Audio features analyzed successfully', data: result.features });
  } catch (error) {
    next(error);
  }
};

exports.bulkFetchCover = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid ids array' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const result = await songImageService.ensureSongCover(id);
        if (result) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    }

    res.json({ success: true, message: `Completed bulk fetch cover`, data: { successCount, failCount } });
  } catch (error) {
    next(error);
  }
};

exports.bulkAnalyzeFeatures = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid ids array' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const [[song]] = await pool.query('SELECT audio_url FROM songs WHERE id = ?', [id]);
        if (song && song.audio_url) {
          await audioFeatureService.analyzeAndSave(id, song.audio_url);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    res.json({ success: true, message: `Completed bulk analyze features`, data: { successCount, failCount } });
  } catch (error) {
    next(error);
  }
};

exports.exportLyricsBacklog = async (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');

    function escapeCSV(field) {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    function getFailedTitle(item) {
      return item.title
        || item.song_title
        || item.songTitle
        || item.track_title
        || item.trackTitle
        || item.track_name
        || item.trackName
        || item.name
        || item.query_title
        || item.queryTitle
        || item.rawTitle
        || item.cleanTitle
        || item.input?.title
        || item.song?.title
        || item.csv?.Title
        || '';
    }

    function getFailedArtist(item) {
      return item.artist_name
        || item.artistName
        || item.artist
        || item.artist_names
        || item.artistNames
        || item.primary_artist
        || item.primaryArtist
        || item.query_artist
        || item.queryArtist
        || item.rawArtist
        || item.input?.artist
        || item.song?.artist_name
        || item.song?.artist
        || item.csv?.Main_Artist
        || item.csv?.Original_Artist
        || '';
    }

    function getFailedReason(item) {
      return item.reason
        || item.error
        || item.error_message
        || item.errorMessage
        || item.status
        || item.message
        || item.result
        || item.failed_reason
        || item.lrclib_error
        || 'lrclib_failed';
    }

    function normalizeTitleStr(str) {
      if (!str) return '';
      let s = str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      s = s.replace(/\(feat\.[^)]*\)/g, '');
      s = s.replace(/\[feat\.[^\]]*\]/g, '');
      s = s.replace(/\(ft\.[^)]*\)/g, '');
      s = s.replace(/ft\..+$/g, '');
      s = s.replace(/feat\..+$/g, '');
      s = s.replace(/remix/g, '');
      s = s.replace(/official/g, '');
      s = s.replace(/mv/g, '');
      s = s.replace(/[^a-z0-9]/g, '');
      return s;
    }

    function normalizeArtistStr(str) {
      if (!str) return '';
      let s = str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      s = s.replace(/[^a-z0-9]/g, '');
      if (['girlsgeneration', 'snsd'].includes(s)) return 'snsd';
      return s;
    }

    function getMarket(songMarket, genreName) {
      if (songMarket && songMarket.trim() !== '' && songMarket.toUpperCase() !== 'OTHER') {
        return songMarket.toLowerCase();
      }
      if (!genreName) return 'unknown';
      const genre = genreName.toLowerCase();
      if (genre.includes('k-pop') || genre.includes('kpop')) return 'kpop';
      if (genre.includes('v-pop') || genre.includes('vpop') || genre.includes('việt')) return 'vpop';
      if (genre.includes('us-uk') || genre.includes('usuk')) return 'usuk';
      return 'unknown';
    }

    const [missingSongs] = await pool.query(`
      SELECT
        s.id AS song_id,
        s.title,
        s.market,
        a.name AS artist_name,
        al.title AS album_name,
        g.name AS genre_name
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      WHERE (sl.song_id IS NULL OR TRIM(sl.plain_lyrics) = '' OR sl.plain_lyrics IS NULL)
        AND COALESCE(s.review_status, 'approved') = 'approved'
        AND (s.is_active = 1 OR s.is_active IS NULL)
    `);

    const FAILED_LYRICS_DIRS = [
      'datasets/raw/lyrics/failed/kpop',
      'datasets/raw/lyrics/failed/usuk',
      'datasets/raw/lyrics/failed/vpop',
      'datasets/raw/lyrics/failed/unknown'
    ];

    const failedItems = [];
    for (const dir of FAILED_LYRICS_DIRS) {
      const fullPath = path.join(__dirname, '../../../../', dir, 'failed-lyrics.json');
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(content);
          const market = dir.split('/').pop();
          for (const item of data) {
            item._market = market;
            item._source_file = `${dir}/failed-lyrics.json`;
            item._reason = getFailedReason(item);
            item._norm_title = normalizeTitleStr(getFailedTitle(item));
            item._norm_artist = normalizeArtistStr(getFailedArtist(item));
            failedItems.push(item);
          }
        } catch (e) {
          console.warn(`[WARNING] Failed to parse JSON ${fullPath}: ${e.message}`);
        }
      }
    }

    const csvLines = [];
    csvLines.push('song_id,title,artist_name,album_name,market,lyrics_status,synced_lyrics_status,lrclib_failed_reason,source_failed_file');

    for (const song of missingSongs) {
      const sTitleNorm = normalizeTitleStr(song.title);
      const sArtistNorm = normalizeArtistStr(song.artist_name);

      let matchedItem = failedItems.find(f => (f.id || f.song_id || f.songId) == song.song_id);
      if (!matchedItem) {
        matchedItem = failedItems.find(f => f._norm_title === sTitleNorm && f._norm_artist === sArtistNorm);
      }

      let market = getMarket(song.market, song.genre_name);
      let reason = 'missing_in_db_not_found_in_lrclib_failed_log';
      let sourceFile = 'none';

      if (matchedItem) {
        reason = matchedItem._reason;
        sourceFile = matchedItem._source_file;
      }

      const row = [
        song.song_id,
        song.title,
        song.artist_name,
        song.album_name,
        market,
        'missing',
        'missing',
        reason,
        sourceFile
      ];
      csvLines.push(row.map(escapeCSV).join(','));
    }

    const csvContent = '\uFEFF' + csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="missing-lyrics-backlog.csv"');
    return res.send(csvContent);

  } catch (error) {
    next(error);
  }
};
