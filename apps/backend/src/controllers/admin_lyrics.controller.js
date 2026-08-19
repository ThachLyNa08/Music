const { pool } = require('../config/database');
const { jsonToCsv, createCsvFilename, sendCsv } = require('../utils/csv.util');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');

const LYRIC_STATUSES = ['missing', 'has_lyrics', 'synced', 'plain'];
const SYNC_TYPES = ['NONE', 'PLAIN_TEXT', 'LINE_SYNCED'];
const MAX_LYRICS_LENGTH = 50000;

function normalizePositiveInt(value, { defaultValue, max } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || (max && number > max)) return null;
  return number;
}

function normalizeSearchText(value, max = 100) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  return text.length <= max ? text : null;
}

function normalizeFilterValue(value, max = 50) {
  const text = normalizeSearchText(value, max);
  if (text === null) return null;
  if (!text || text.toLowerCase() === 'all') return '';
  return text;
}

function normalizeOptionalLyrics(value, field) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > MAX_LYRICS_LENGTH) {
    const error = new Error(`${field} không được vượt quá ${MAX_LYRICS_LENGTH} ký tự`);
    error.statusCode = 400;
    throw error;
  }
  return text || null;
}

function applyLyricsFilters({ q, status, provider }, whereConditions, queryParams) {
  const search = normalizeSearchText(q);
  if (search === null) {
    const error = new Error('Từ khóa tìm kiếm không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  if (search) {
    whereConditions.push(`(s.title LIKE ? OR a.name LIKE ?)`);
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  const normalizedStatus = normalizeFilterValue(status, 50);
  if (normalizedStatus === null) {
    const error = new Error('Trạng thái lyrics không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  if (normalizedStatus) {
    if (!LYRIC_STATUSES.includes(normalizedStatus)) {
      const error = new Error('Trạng thái lyrics không hợp lệ');
      error.statusCode = 400;
      throw error;
    }
    if (normalizedStatus === 'missing') {
      whereConditions.push(`NOT ${HAS_ANY_LYRICS_SQL}`);
    } else if (normalizedStatus === 'has_lyrics') {
      whereConditions.push(HAS_ANY_LYRICS_SQL);
    } else if (normalizedStatus === 'synced') {
      whereConditions.push(HAS_SYNCED_LYRICS_SQL);
    } else if (normalizedStatus === 'plain') {
      whereConditions.push(`${HAS_PLAIN_LYRICS_SQL} AND NOT ${HAS_SYNCED_LYRICS_SQL}`);
    }
  }

  const normalizedProvider = normalizeFilterValue(provider, 50);
  if (normalizedProvider === null) {
    const error = new Error('Provider không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  if (normalizedProvider) {
    whereConditions.push(`UPPER(${EFFECTIVE_PROVIDER_SQL}) = UPPER(?)`);
    queryParams.push(normalizedProvider);
  }
}

const APPROVED_CATALOG_WHERE = `
  COALESCE(s.review_status, 'approved') = 'approved'
  AND (s.is_active = 1 OR s.is_active IS NULL)
  AND (s.release_at IS NULL OR s.release_at <= NOW())
  AND (
    s.release_status IS NULL
    OR s.release_status = 'published'
    OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW())
  )
`;
const HAS_LEGACY_LYRICS_SQL = `NULLIF(TRIM(COALESCE(s.lyrics, '')), '') IS NOT NULL`;
const HAS_PLAIN_LYRICS_SQL = `(NULLIF(TRIM(COALESCE(sl.plain_lyrics, '')), '') IS NOT NULL OR ${HAS_LEGACY_LYRICS_SQL})`;
const HAS_SYNCED_LYRICS_SQL = `NULLIF(TRIM(COALESCE(sl.synced_lyrics, '')), '') IS NOT NULL`;
const HAS_ANY_LYRICS_SQL = `(${HAS_PLAIN_LYRICS_SQL} OR ${HAS_SYNCED_LYRICS_SQL})`;
const EFFECTIVE_PROVIDER_SQL = `COALESCE(NULLIF(sl.provider, ''), CASE WHEN ${HAS_LEGACY_LYRICS_SQL} THEN 'MANUAL' ELSE NULL END)`;

function hasValidSyncedLyrics(text) {
  if (!text || !text.trim()) return false;
  return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*\S/.test(text);
}

exports.getSummary = async (req, res, next) => {
  try {
    const [[{ totalSongs }]] = await pool.query(`SELECT COUNT(*) AS totalSongs FROM songs s WHERE ${APPROVED_CATALOG_WHERE}`);

    const [[lyricsStats]] = await pool.query(`
      SELECT
        SUM(CASE WHEN ${HAS_ANY_LYRICS_SQL} THEN 1 ELSE 0 END) as songsWithLyrics,
        SUM(CASE WHEN ${HAS_SYNCED_LYRICS_SQL} THEN 1 ELSE 0 END) as syncedLyricsCount,
        SUM(CASE WHEN ${HAS_PLAIN_LYRICS_SQL} AND NOT ${HAS_SYNCED_LYRICS_SQL} THEN 1 ELSE 0 END) as plainLyricsCount,
        SUM(CASE WHEN UPPER(${EFFECTIVE_PROVIDER_SQL}) = 'LRCLIB' THEN 1 ELSE 0 END) as lrclibCount,
        SUM(CASE WHEN UPPER(${EFFECTIVE_PROVIDER_SQL}) = 'MANUAL' THEN 1 ELSE 0 END) as manualCount
      FROM songs s
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      WHERE ${APPROVED_CATALOG_WHERE}
    `);

    res.json({
      success: true,
      data: {
        totalSongs: parseInt(totalSongs) || 0,
        songsWithLyrics: parseInt(lyricsStats.songsWithLyrics) || 0,
        songsMissingLyrics: (parseInt(totalSongs) || 0) - (parseInt(lyricsStats.songsWithLyrics) || 0),
        syncedLyricsCount: parseInt(lyricsStats.syncedLyricsCount) || 0,
        plainLyricsCount: parseInt(lyricsStats.plainLyricsCount) || 0,
        lrclibCount: parseInt(lyricsStats.lrclibCount) || 0,
        manualCount: parseInt(lyricsStats.manualCount) || 0,
        updatedToday: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getList = async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, { defaultValue: 1 });
    const limit = normalizePositiveInt(req.query.limit, { defaultValue: 20, max: 100 });
    if (page === null || limit === null) {
      return res.status(400).json({ success: false, message: 'Phân trang không hợp lệ' });
    }
    const offset = (page - 1) * limit;

    let whereConditions = [
      APPROVED_CATALOG_WHERE
    ];
    let queryParams = [];

    applyLyricsFilters(req.query, whereConditions, queryParams);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(s.id) as total
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      ${whereClause}
    `;
    const [[{ total }]] = await pool.query(countQuery, queryParams);

    const dataQuery = `
      SELECT
        s.id as song_id, s.title, a.name as artist_name, al.title as album_name,
        COALESCE(NULLIF(s.cover_url, ''), al.cover_url) AS cover_url,
        sl.sync_type, ${EFFECTIVE_PROVIDER_SQL} AS provider, sl.provider_lyric_id,
        sl.updated_at,
        COALESCE(NULLIF(sl.plain_lyrics, ''), NULLIF(s.lyrics, '')) AS plain_lyrics,
        sl.synced_lyrics,
        IF(${HAS_PLAIN_LYRICS_SQL}, 1, 0) as has_plain_lyrics,
        IF(${HAS_SYNCED_LYRICS_SQL}, 1, 0) as has_synced_lyrics,
        LENGTH(COALESCE(NULLIF(sl.plain_lyrics, ''), NULLIF(s.lyrics, ''))) as plain_length,
        LENGTH(sl.synced_lyrics) as synced_length
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

    const mappedRows = rows.map(row => {
      let effective_sync_type = 'NONE';
      let lyrics_status = 'missing';

      if (hasValidSyncedLyrics(row.synced_lyrics)) {
        effective_sync_type = 'LINE_SYNCED';
        lyrics_status = 'synced';
      } else if (row.has_plain_lyrics) {
        effective_sync_type = 'PLAIN_TEXT';
        lyrics_status = 'plain';
      }

      const { plain_lyrics, synced_lyrics, ...rest } = row;

      return {
        ...rest,
        cover_url: normalizeCoverUrl(rest.cover_url),
        effective_sync_type,
        lyrics_status
      };
    });

    res.json({
      success: true,
      data: mappedRows,
      pagination: {
        total: parseInt(total),
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
    const songId = normalizePositiveInt(req.params.songId);
    if (!songId) return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });

    const [[song]] = await pool.query(`
      SELECT s.id as song_id, s.title, a.name as artist_name, al.title as album_name,
             COALESCE(NULLIF(s.cover_url, ''), al.cover_url) AS cover_url,
             s.duration_sec as duration, s.lyrics AS legacy_lyrics,
             s.lyrics_provider, s.lyrics_provider_id, s.lyrics_sync_type, s.lyrics_updated_at
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.id = ?
        AND COALESCE(s.review_status, 'approved') = 'approved'
        AND (s.is_active = 1 OR s.is_active IS NULL)
        AND (s.release_at IS NULL OR s.release_at <= NOW())
        AND (
          s.release_status IS NULL
          OR s.release_status = 'published'
          OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW())
        )
    `, [songId]);

    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    const [[lyrics]] = await pool.query(`
      SELECT plain_lyrics, synced_lyrics, provider, provider_lyric_id, sync_type, source_url, confidence_score, fetched_at, updated_at
      FROM song_lyrics WHERE song_id = ?
    `, [songId]);

    if (lyrics) {
      if (hasValidSyncedLyrics(lyrics.synced_lyrics)) {
        lyrics.effective_sync_type = 'LINE_SYNCED';
        lyrics.lyrics_status = 'synced';
      } else if (lyrics.plain_lyrics && lyrics.plain_lyrics.trim() !== '') {
        lyrics.effective_sync_type = 'PLAIN_TEXT';
        lyrics.lyrics_status = 'plain';
      } else {
        lyrics.effective_sync_type = 'NONE';
        lyrics.lyrics_status = 'missing';
      }
    } else if (song.legacy_lyrics && song.legacy_lyrics.trim() !== '') {
      const legacyLooksSynced = hasValidSyncedLyrics(song.legacy_lyrics);
      song.lyrics = {
        plain_lyrics: legacyLooksSynced ? null : song.legacy_lyrics,
        synced_lyrics: legacyLooksSynced ? song.legacy_lyrics : null,
        provider: song.lyrics_provider || 'MANUAL',
        provider_lyric_id: song.lyrics_provider_id || null,
        sync_type: legacyLooksSynced ? 'LINE_SYNCED' : (song.lyrics_sync_type || 'PLAIN_TEXT'),
        source_url: null,
        confidence_score: null,
        fetched_at: null,
        updated_at: song.lyrics_updated_at || null,
        effective_sync_type: legacyLooksSynced ? 'LINE_SYNCED' : 'PLAIN_TEXT',
        lyrics_status: legacyLooksSynced ? 'synced' : 'plain'
      };
    }

    if (lyrics) song.lyrics = lyrics;
    if (!song.lyrics) song.lyrics = null;
    delete song.legacy_lyrics;
    delete song.lyrics_provider;
    delete song.lyrics_provider_id;
    delete song.lyrics_sync_type;
    delete song.lyrics_updated_at;
    song.cover_url = normalizeCoverUrl(song.cover_url);

    res.json({ success: true, data: song });
  } catch (error) {
    next(error);
  }
};

exports.updateLyrics = async (req, res, next) => {
  try {
    const songId = normalizePositiveInt(req.params.songId);
    if (!songId) return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    const plain_lyrics = normalizeOptionalLyrics(req.body.plain_lyrics, 'Lyrics thường');
    const synced_lyrics = normalizeOptionalLyrics(req.body.synced_lyrics, 'Lyrics đồng bộ');
    const sync_type = req.body.sync_type === undefined || req.body.sync_type === null || req.body.sync_type === ''
      ? undefined
      : String(req.body.sync_type).trim();
    if (sync_type && !SYNC_TYPES.includes(sync_type)) {
      return res.status(400).json({ success: false, message: 'Sync type không hợp lệ' });
    }

    // Check if song exists and is approved catalog song
    const [[song]] = await pool.query(`
      SELECT id FROM songs
      WHERE id = ?
        AND COALESCE(review_status, 'approved') = 'approved'
        AND (is_active = 1 OR is_active IS NULL)
        AND (release_at IS NULL OR release_at <= NOW())
        AND (
          release_status IS NULL
          OR release_status = 'published'
          OR (release_status = 'scheduled' AND release_at IS NOT NULL AND release_at <= NOW())
        )
    `, [songId]);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    let finalSyncType = sync_type;
    if (hasValidSyncedLyrics(synced_lyrics)) {
      finalSyncType = 'LINE_SYNCED';
    } else if (plain_lyrics && plain_lyrics.trim() !== '') {
      finalSyncType = 'PLAIN_TEXT';
    } else {
      finalSyncType = 'NONE';
    }

    // Check if lyrics record exists
    const [[existingLyrics]] = await pool.query(`SELECT song_id FROM song_lyrics WHERE song_id = ?`, [songId]);

    if (existingLyrics) {
      await pool.query(`
        UPDATE song_lyrics
        SET
          plain_lyrics = ?,
          synced_lyrics = ?,
          sync_type = ?,
          provider = 'MANUAL'
        WHERE song_id = ?
      `, [plain_lyrics || null, synced_lyrics || null, finalSyncType, songId]);
    } else {
      await pool.query(`
        INSERT INTO song_lyrics (song_id, plain_lyrics, synced_lyrics, sync_type, provider)
        VALUES (?, ?, ?, ?, 'MANUAL')
      `, [songId, plain_lyrics || null, synced_lyrics || null, finalSyncType]);
    }

    res.json({ success: true, message: 'Lyrics updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.exportBacklog = async (req, res, next) => {
  const adminMusicDataToolsController = require('./admin_music_data_tools.controller');
  return adminMusicDataToolsController.exportLyricsBacklog(req, res, next);
};

exports.exportAudit = async (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../../../../datasets/processed/lyrics/low-quality-lyrics-report.csv');

    if (fs.existsSync(reportPath)) {
      res.download(reportPath, 'low-quality-lyrics-report.csv');
    } else {
      res.status(404).json({ success: false, message: 'Audit report not found' });
    }
  } catch (error) {
    next(error);
  }
};

exports.exportLyrics = async (req, res, next) => {
  try {
    let whereConditions = [
      APPROVED_CATALOG_WHERE
    ];
    let queryParams = [];

    applyLyricsFilters(req.query, whereConditions, queryParams);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        s.id as song_id, s.title, a.name as artist_name,
        ${EFFECTIVE_PROVIDER_SQL} AS provider, sl.sync_type, sl.updated_at,
        IF(${HAS_PLAIN_LYRICS_SQL}, 1, 0) as has_plain_lyrics,
        IF(${HAS_SYNCED_LYRICS_SQL}, 1, 0) as has_synced_lyrics,
        LENGTH(COALESCE(NULLIF(sl.plain_lyrics, ''), NULLIF(s.lyrics, ''))) as plain_lyrics_length,
        LENGTH(sl.synced_lyrics) as synced_lyrics_length
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT 10000
    `;

    const [rows] = await pool.query(dataQuery, queryParams);

    const formattedRows = rows.map(row => {
      let effectiveSyncType = 'NONE';
      if (row.has_synced_lyrics && row.sync_type === 'LINE_SYNCED') {
        effectiveSyncType = 'LINE_SYNCED';
      } else if (row.has_plain_lyrics) {
        effectiveSyncType = 'PLAIN_TEXT';
      }

      let lyricsStatus = 'Chưa có lyrics';
      if (effectiveSyncType === 'LINE_SYNCED') lyricsStatus = 'Lyrics đồng bộ';
      else if (effectiveSyncType === 'PLAIN_TEXT') lyricsStatus = 'Lyrics thường';

      return {
        ...row,
        provider: row.provider ? row.provider.toUpperCase() : '',
        effective_sync_type: effectiveSyncType,
        lyrics_status: lyricsStatus,
        has_plain_lyrics: row.has_plain_lyrics === 1 ? 'Có' : 'Không',
        has_synced_lyrics: row.has_synced_lyrics === 1 ? 'Có' : 'Không'
      };
    });

    const columns = [
      { header: 'Song ID', key: 'song_id' },
      { header: 'Title', key: 'title' },
      { header: 'Artist', key: 'artist_name' },
      { header: 'Provider', key: 'provider' },
      { header: 'Sync Type (DB)', key: 'sync_type' },
      { header: 'Effective Sync Type', key: 'effective_sync_type' },
      { header: 'Lyrics Status', key: 'lyrics_status' },
      { header: 'Has Plain Lyrics', key: 'has_plain_lyrics' },
      { header: 'Has Synced Lyrics', key: 'has_synced_lyrics' },
      { header: 'Plain Lyrics Length', key: 'plain_lyrics_length' },
      { header: 'Synced Lyrics Length', key: 'synced_lyrics_length' },
      { header: 'Updated At', key: 'updated_at' }
    ];

    const csvContent = jsonToCsv(formattedRows, columns);
    const filename = createCsvFilename('lyrics');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('exportLyrics Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
