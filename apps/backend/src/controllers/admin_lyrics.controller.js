const { pool } = require('../config/database');

function hasValidSyncedLyrics(text) {
  if (!text || !text.trim()) return false;
  return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*\S/.test(text);
}

exports.getSummary = async (req, res, next) => {
  try {
    const [[{ totalSongs }]] = await pool.query(`SELECT COUNT(*) AS totalSongs FROM songs`);
    
    const [[lyricsStats]] = await pool.query(`
      SELECT 
        COUNT(*) as songsWithLyrics,
        SUM(CASE WHEN sync_type = 'LINE_SYNCED' THEN 1 ELSE 0 END) as syncedLyricsCount,
        SUM(CASE WHEN sync_type = 'PLAIN_TEXT' THEN 1 ELSE 0 END) as plainLyricsCount,
        SUM(CASE WHEN provider = 'lrclib' OR provider = 'LRCLIB' THEN 1 ELSE 0 END) as lrclibCount,
        SUM(CASE WHEN provider = 'MANUAL' THEN 1 ELSE 0 END) as manualCount
      FROM song_lyrics
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
    const { q, status, provider } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    if (q) {
      whereConditions.push(`(s.title LIKE ? OR a.name LIKE ?)`);
      queryParams.push(`%${q}%`, `%${q}%`);
    }

    if (status) {
      if (status === 'missing') {
        whereConditions.push(`(sl.song_id IS NULL OR sl.sync_type = 'NONE' OR (TRIM(sl.plain_lyrics) = '' AND TRIM(sl.synced_lyrics) = ''))`);
      } else if (status === 'has_lyrics') {
        whereConditions.push(`sl.song_id IS NOT NULL`);
      } else if (status === 'synced') {
        whereConditions.push(`sl.sync_type = 'LINE_SYNCED'`);
      } else if (status === 'plain') {
        whereConditions.push(`sl.sync_type = 'PLAIN_TEXT'`);
      }
    }

    if (provider && provider !== 'all') {
      whereConditions.push(`UPPER(sl.provider) = UPPER(?)`);
      queryParams.push(provider);
    }

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
        s.id as song_id, s.title, a.name as artist_name, al.title as album_name, s.cover_url,
        sl.sync_type, sl.provider, sl.provider_lyric_id, 
        sl.updated_at, sl.plain_lyrics, sl.synced_lyrics,
        IF(sl.plain_lyrics IS NOT NULL AND TRIM(sl.plain_lyrics) != '', 1, 0) as has_plain_lyrics,
        IF(sl.synced_lyrics IS NOT NULL AND TRIM(sl.synced_lyrics) != '', 1, 0) as has_synced_lyrics,
        LENGTH(sl.plain_lyrics) as plain_length,
        LENGTH(sl.synced_lyrics) as synced_length
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await pool.query(dataQuery, [...queryParams, parseInt(limit), parseInt(offset)]);

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
        effective_sync_type,
        lyrics_status
      };
    });

    res.json({
      success: true,
      data: mappedRows,
      pagination: {
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getDetail = async (req, res, next) => {
  try {
    const { songId } = req.params;
    
    const [[song]] = await pool.query(`
      SELECT s.id as song_id, s.title, a.name as artist_name, al.title as album_name, s.cover_url, s.duration_sec as duration
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.id = ?
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
    }

    song.lyrics = lyrics || null;

    res.json({ success: true, data: song });
  } catch (error) {
    next(error);
  }
};

exports.updateLyrics = async (req, res, next) => {
  try {
    const { songId } = req.params;
    const { plain_lyrics, synced_lyrics, sync_type } = req.body;

    // Check if song exists
    const [[song]] = await pool.query(`SELECT id FROM songs WHERE id = ?`, [songId]);
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
