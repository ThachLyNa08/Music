const { pool: db } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { jsonToCsv, createCsvFilename, sendCsv } = require('../utils/csv.util');

// Helper function to check if file exists
const fileExists = (filePath) => {
  if (!filePath) return false;
  try {
    const fullPath = path.join(__dirname, '../../', filePath);
    return fs.existsSync(fullPath);
  } catch (err) {
    return false;
  }
};

exports.getSummary = async (req, res) => {
  try {
    // 1. Get counts by status
    const [counts] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MAX(CASE WHEN status = 'completed' THEN processed_at ELSE NULL END) as lastCompletedAt,
        MAX(CASE WHEN status = 'failed' THEN updated_at ELSE NULL END) as lastFailedAt
      FROM song_stems
    `);

    let missingFiles = null;

    // Optional: Calculate missing files for completed jobs if total completed is not too huge
    const stats = counts[0];
    
    if (stats.completed > 0 && stats.completed < 5000) {
      const [completedRows] = await db.execute(`
        SELECT vocals_url, instrumental_url FROM song_stems WHERE status = 'completed'
      `);
      
      let missingCount = 0;
      for (const row of completedRows) {
        if (!fileExists(row.vocals_url) || !fileExists(row.instrumental_url)) {
          missingCount++;
        }
      }
      missingFiles = missingCount;
    }

    res.json({
      success: true,
      data: {
        total: parseInt(stats.total || 0),
        pending: parseInt(stats.pending || 0),
        processing: parseInt(stats.processing || 0),
        completed: parseInt(stats.completed || 0),
        failed: parseInt(stats.failed || 0),
        missingFiles: missingFiles,
        lastCompletedAt: stats.lastCompletedAt,
        lastFailedAt: stats.lastFailedAt
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy summary stem jobs:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const q = req.query.q || '';

    let whereConditions = [];
    let queryParams = [];

    if (status && status !== 'all') {
      whereConditions.push('ss.status = ?');
      queryParams.push(status);
    }

    if (q) {
      whereConditions.push('(s.title LIKE ? OR a.name LIKE ?)');
      queryParams.push(`%${q}%`, `%${q}%`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM song_stems ss
      JOIN songs s ON ss.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      ${whereClause}
    `;
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get items
    const dataQuery = `
      SELECT 
        ss.id as stem_id,
        ss.song_id,
        s.title,
        s.cover_url,
        a.name as artist_name,
        ss.status,
        ss.error_message,
        ss.created_at,
        ss.updated_at,
        ss.processed_at as completed_at,
        ss.vocals_url,
        ss.instrumental_url
      FROM song_stems ss
      JOIN songs s ON ss.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      ${whereClause}
      ORDER BY ss.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [items] = await db.execute(dataQuery, queryParams);

    // Process items to check file existence
    const processedItems = items.map(item => {
      let has_vocals_file = false;
      let has_instrumental_file = false;

      // Only check if they actually have a URL path string
      if (item.vocals_url) {
        has_vocals_file = fileExists(item.vocals_url);
      }
      if (item.instrumental_url) {
        has_instrumental_file = fileExists(item.instrumental_url);
      }

      return {
        ...item,
        has_vocals_file,
        has_instrumental_file
      };
    });

    res.json({
      success: true,
      data: {
        items: processedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách stem jobs:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.retryJob = async (req, res) => {
  try {
    const { id } = req.params;

    // Check current status
    const [rows] = await db.execute('SELECT id, status, song_id FROM song_stems WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy job' });
    }

    const job = rows[0];

    if (job.status !== 'failed' && job.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể retry các job bị lỗi hoặc pending' });
    }

    // We want to force a retry. requestSeparation ignores if status is pending/processing.
    // So we temporarily set it to failed to force a new job creation.
    await db.execute('UPDATE song_stems SET status = ? WHERE id = ?', ['failed', id]);

    // Call stemService to handle the rest!
    const stemService = require('../services/stem.service');
    // We need a user to pass to requestSeparation. req.user should be available for admin endpoints.
    // Ensure we await the response so the job is actually created and triggered
    await stemService.requestSeparation(req.user, job.song_id);

    res.json({
      success: true,
      message: 'Đã đặt lại trạng thái job thành chờ xử lý (pending)'
    });

  } catch (error) {
    console.error('Lỗi khi retry stem job:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const status = req.query.status || '';
    const q = req.query.q || '';

    let whereConditions = [];
    let queryParams = [];

    if (status && status !== 'all') {
      whereConditions.push('ss.status = ?');
      queryParams.push(status);
    }

    if (q) {
      whereConditions.push('(s.title LIKE ? OR a.name LIKE ?)');
      queryParams.push(`%${q}%`, `%${q}%`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const dataQuery = `
      SELECT 
        ss.id as stem_id,
        ss.song_id,
        s.title,
        a.name as artist_name,
        ss.status,
        ss.error_message,
        ss.created_at,
        ss.updated_at,
        ss.processed_at as completed_at,
        ss.vocals_url,
        ss.instrumental_url
      FROM song_stems ss
      JOIN songs s ON ss.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      ${whereClause}
      ORDER BY ss.updated_at DESC
      LIMIT 10000
    `;
    
    const [items] = await db.execute(dataQuery, queryParams);

    const processedItems = items.map(item => {
      let has_vocals_file = 'No';
      let has_instrumental_file = 'No';

      if (item.vocals_url) {
        has_vocals_file = fileExists(item.vocals_url) ? 'Yes' : 'Missing';
      }
      if (item.instrumental_url) {
        has_instrumental_file = fileExists(item.instrumental_url) ? 'Yes' : 'Missing';
      }

      return {
        stem_id: item.stem_id,
        song_title: item.title,
        artist_name: item.artist_name,
        status: item.status,
        vocals_file: has_vocals_file,
        instrumental_file: has_instrumental_file,
        error_message: item.error_message || '',
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    });

    const columns = [
      { header: 'Job ID', key: 'stem_id' },
      { header: 'Song Title', key: 'song_title' },
      { header: 'Artist', key: 'artist_name' },
      { header: 'Status', key: 'status' },
      { header: 'Vocals File', key: 'vocals_file' },
      { header: 'Instrumental File', key: 'instrumental_file' },
      { header: 'Error Message', key: 'error_message' },
      { header: 'Created At', key: 'created_at' },
      { header: 'Updated At', key: 'updated_at' }
    ];

    const csvContent = jsonToCsv(processedItems, columns);
    const filename = createCsvFilename('stem_jobs');
    return sendCsv(res, filename, csvContent);
  } catch (error) {
    console.error('Lỗi khi export stem jobs:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
