const { pool: db } = require('../config/database');
const stemService = require('../services/stem.service');
const { jsonToCsv, createCsvFilename, sendCsv } = require('../utils/csv.util');

const fileExists = stemService.publicStemUrlExists;

exports.getSummary = async (req, res) => {
  try {
    await stemService.ensureStemSchema();
    await stemService.recoverStaleStemJobs();
    const [counts] = await db.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'stale' THEN 1 ELSE 0 END) as stale,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        MAX(CASE WHEN status = 'completed' THEN processed_at ELSE NULL END) as lastCompletedAt,
        MAX(CASE WHEN status IN ('failed','stale') THEN updated_at ELSE NULL END) as lastFailedAt
      FROM song_stems
    `);

    const stats = counts[0] || {};
    let missingFiles = null;
    if (Number(stats.completed) > 0 && Number(stats.completed) < 5000) {
      const [completedRows] = await db.execute(`
        SELECT vocals_url, instrumental_url FROM song_stems WHERE status = 'completed'
      `);
      missingFiles = completedRows.filter((row) => !fileExists(row.vocals_url) || !fileExists(row.instrumental_url)).length;
    }

    res.json({
      success: true,
      data: {
        total: Number(stats.total) || 0,
        pending: Number(stats.pending) || 0,
        processing: Number(stats.processing) || 0,
        completed: Number(stats.completed) || 0,
        failed: Number(stats.failed) || 0,
        stale: Number(stats.stale) || 0,
        cancelled: Number(stats.cancelled) || 0,
        missingFiles,
        lastCompletedAt: stats.lastCompletedAt,
        lastFailedAt: stats.lastFailedAt,
        timeoutMinutes: stemService.getStemTimeoutMinutes(),
      },
    });
  } catch (error) {
    console.error('[AdminStemJobs] summary failed:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

exports.getJobs = async (req, res) => {
  try {
    await stemService.ensureStemSchema();
    await stemService.recoverStaleStemJobs();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 100));
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const q = req.query.q || '';

    const whereConditions = [];
    const queryParams = [];
    if (status && status !== 'all') {
      whereConditions.push('ss.status = ?');
      queryParams.push(status);
    }
    if (q) {
      whereConditions.push('(s.title LIKE ? OR a.name LIKE ?)');
      queryParams.push(`%${q}%`, `%${q}%`);
    }
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total
       FROM song_stems ss
       JOIN songs s ON ss.song_id = s.id
       JOIN artists a ON s.artist_id = a.id
       ${whereClause}`,
      queryParams
    );
    const total = Number(countResult[0]?.total) || 0;

    const [items] = await db.execute(
      `SELECT
        ss.id as stem_id,
        ss.song_id,
        s.title,
        s.cover_url,
        a.name as artist_name,
        ss.status,
        ss.error_message,
        ss.job_id,
        ss.locked_by,
        ss.started_at,
        ss.heartbeat_at,
        ss.completed_at,
        ss.failed_at,
        ss.retry_count,
        ss.created_at,
        ss.updated_at,
        ss.processed_at,
        COALESCE(ss.completed_at, ss.processed_at) as completed_at,
        ss.vocals_url,
        ss.instrumental_url
      FROM song_stems ss
      JOIN songs s ON ss.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      ${whereClause}
      ORDER BY ss.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
      queryParams
    );

    const processedItems = items.map((item) => ({
      ...item,
      has_vocals_file: fileExists(item.vocals_url),
      has_instrumental_file: fileExists(item.instrumental_url),
      is_stale_candidate: stemService.isStemJobTimedOut(item),
    }));

    res.json({
      success: true,
      data: {
        items: processedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[AdminStemJobs] list failed:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

exports.retryJob = async (req, res) => {
  try {
    await stemService.ensureStemSchema();
    await stemService.retryStem(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Da gui lai job tach stems. Vui long theo doi trang thai processing.',
    });
  } catch (error) {
    console.error('[AdminStemJobs] retry failed:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Loi server' });
  }
};

exports.resetJob = async (req, res) => {
  try {
    await stemService.ensureStemSchema();
    const job = await stemService.resetStemStatus(req.params.id);
    res.json({
      success: true,
      message: 'Da dat lai stem job ve pending.',
      data: job,
    });
  } catch (error) {
    console.error('[AdminStemJobs] reset failed:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Loi server' });
  }
};

exports.exportReport = async (req, res) => {
  try {
    await stemService.ensureStemSchema();
    await stemService.recoverStaleStemJobs();
    const status = req.query.status || '';
    const q = req.query.q || '';
    const whereConditions = [];
    const queryParams = [];

    if (status && status !== 'all') {
      whereConditions.push('ss.status = ?');
      queryParams.push(status);
    }
    if (q) {
      whereConditions.push('(s.title LIKE ? OR a.name LIKE ?)');
      queryParams.push(`%${q}%`, `%${q}%`);
    }
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [items] = await db.execute(
      `SELECT
        ss.id as stem_id,
        ss.song_id,
        s.title,
        a.name as artist_name,
        ss.status,
        ss.error_message,
        ss.created_at,
        ss.updated_at,
        COALESCE(ss.completed_at, ss.processed_at) as completed_at,
        ss.vocals_url,
        ss.instrumental_url
      FROM song_stems ss
      JOIN songs s ON ss.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      ${whereClause}
      ORDER BY ss.updated_at DESC
      LIMIT 10000`,
      queryParams
    );

    const processedItems = items.map((item) => ({
      stem_id: item.stem_id,
      song_id: item.song_id,
      song_title: item.title,
      artist_name: item.artist_name,
      status: item.status,
      vocals_file: item.vocals_url ? (fileExists(item.vocals_url) ? 'Yes' : 'Missing') : 'No',
      instrumental_file: item.instrumental_url ? (fileExists(item.instrumental_url) ? 'Yes' : 'Missing') : 'No',
      error_message: item.error_message || '',
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    const columns = [
      { header: 'Stem ID', key: 'stem_id' },
      { header: 'Song ID', key: 'song_id' },
      { header: 'Song Title', key: 'song_title' },
      { header: 'Artist', key: 'artist_name' },
      { header: 'Status', key: 'status' },
      { header: 'Vocals File', key: 'vocals_file' },
      { header: 'Instrumental File', key: 'instrumental_file' },
      { header: 'Error Message', key: 'error_message' },
      { header: 'Created At', key: 'created_at' },
      { header: 'Updated At', key: 'updated_at' },
    ];

    return sendCsv(res, createCsvFilename('stem_jobs'), jsonToCsv(processedItems, columns));
  } catch (error) {
    console.error('[AdminStemJobs] export failed:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};
