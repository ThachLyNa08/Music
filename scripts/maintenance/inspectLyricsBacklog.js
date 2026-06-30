const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.resolve(__dirname, '../../apps/backend/package.json'));
backendRequire('dotenv').config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const { pool } = require('../../apps/backend/src/config/database');

const FAILED_LYRICS_DIRS = [
  'datasets/raw/lyrics/failed/kpop',
  'datasets/raw/lyrics/failed/usuk',
  'datasets/raw/lyrics/failed/vpop',
  'datasets/raw/lyrics/failed/unknown'
];

async function inspectBacklog() {
  try {
    console.log('--- 1. Kiểm tra Database ---');
    const [rows] = await pool.query(`
      SELECT COUNT(s.id) as total_missing
      FROM songs s
      LEFT JOIN song_lyrics sl ON s.id = sl.song_id
      WHERE sl.song_id IS NULL OR TRIM(sl.plain_lyrics) = '' OR sl.plain_lyrics IS NULL
    `);
    const totalMissing = rows[0].total_missing;
    console.log(`- Tổng số bài hát chưa có lyrics trong DB: ${totalMissing}`);

    console.log('\n--- 2. Kiểm tra File Failed ---');
    let totalFailed = 0;
    const failedByMarket = {};
    const reasonCounts = {};
    const samples = [];

    for (const dir of FAILED_LYRICS_DIRS) {
      const fullPath = path.join(__dirname, '../../', dir, 'failed-lyrics.json');
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(content);
          const market = dir.split('/').pop();
          
          failedByMarket[market] = data.length;
          totalFailed += data.length;

          for (const item of data) {
            const reason = item.reason || item.failed_reason || item.lrclib_error || 'Unknown';
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
            
            if (samples.length < 5) {
              samples.push({
                market,
                id: item.id || item.song_id,
                title: item.title,
                artist: item.artist_name || item.artist,
                reason
              });
            }
          }
        } catch (e) {
          console.warn(`[WARNING] Lỗi khi đọc file JSON ${fullPath}: ${e.message}`);
        }
      }
    }

    console.log(`- Tổng số failed records trong các file: ${totalFailed}`);
    console.log('- Thống kê theo market:');
    for (const [market, count] of Object.entries(failedByMarket)) {
      console.log(`  + ${market.toUpperCase()}: ${count}`);
    }

    console.log('- Thống kê lý do thất bại (Top reasons):');
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [reason, count] of sortedReasons) {
      console.log(`  + ${reason}: ${count}`);
    }

    console.log('\n--- 3. Mẫu dữ liệu Failed (Sample 5 items) ---');
    console.table(samples);

  } catch (err) {
    console.error('Lỗi trong quá trình kiểm tra:', err);
  } finally {
    await pool.end();
  }
}

inspectBacklog();
