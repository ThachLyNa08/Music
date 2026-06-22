const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'];

// Helper normalize string để match chính xác
function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\b(m\/v|mv|official mv|official music video|music video|audio|lyrics|lyric video)\b/g, '')
    .replace(/[\[\]\(\)\{\}]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAudioFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAudioFiles(fullPath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (AUDIO_EXTS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function urlToFilePath(audioUrl) {
  if (!audioUrl) return null;
  let clean = audioUrl.replace(/^https?:\/\/[^/]+/i, '');
  if (clean.startsWith('/uploads/')) {
    return path.join(UPLOADS_DIR, clean.replace('/uploads/', ''));
  }
  return path.join(UPLOADS_DIR, clean.replace(/^\/+/, ''));
}

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  console.log(`🚀 Bắt đầu REPAIR MODE: ${isApply ? 'APPLY' : 'DRY-RUN'}`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '261999',
      database: process.env.DB_NAME || 'musicflow',
      port: process.env.DB_PORT || 3306,
    });

    const [songs] = await connection.query(`
      SELECT s.id, s.title, a.name as artist_name, s.audio_url 
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      ORDER BY s.id DESC
    `);

    // Quét file
    console.log('📂 Đang quét toàn bộ file audio trong /uploads...');
    const allAudioFiles = getAudioFiles(UPLOADS_DIR);
    console.log(`📊 Tìm thấy ${allAudioFiles.length} file âm thanh.`);

    const missingSongs = [];
    for (const song of songs) {
      const filePath = urlToFilePath(song.audio_url);
      if (!filePath || !fs.existsSync(filePath)) {
        missingSongs.push(song);
      }
    }

    console.log(`🔍 Có ${missingSongs.length} bài hát bị missing audio path.\n`);

    const manualReview = [];
    const candidatesToUpdate = [];

    for (const song of missingSongs) {
      const titleNorm = normalizeName(song.title);
      const artistNorm = normalizeName(song.artist_name);
      
      let bestMatches = [];
      let highestScore = 0;

      for (const file of allAudioFiles) {
        const basename = path.basename(file, path.extname(file));
        const filenameNorm = normalizeName(basename);
        
        // Match logic (đơn giản, an toàn)
        let score = 0;
        if (filenameNorm === titleNorm) score += 50;
        else if (filenameNorm.includes(titleNorm) || titleNorm.includes(filenameNorm)) score += 30;

        if (score > 0 && artistNorm.length >= 2 && filenameNorm.includes(artistNorm)) {
          score += 20; // có tên ca sĩ
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatches = [file];
        } else if (score === highestScore && score > 0) {
          bestMatches.push(file);
        }
      }

      if (highestScore >= 30 && bestMatches.length === 1) {
        const newPathAbsolute = bestMatches[0];
        const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), newPathAbsolute);
        const newAudioUrl = '/uploads/' + relativePath.split(path.sep).join('/');
        
        candidatesToUpdate.push({
          id: song.id,
          title: song.title,
          artist: song.artist_name,
          old_url: song.audio_url,
          new_url: newAudioUrl,
          score: highestScore
        });
      } else {
        manualReview.push({
          id: song.id,
          title: song.title,
          artist: song.artist_name,
          matches: bestMatches.length,
          score: highestScore
        });
      }
    }

    console.log(`✅ Tìm thấy match chắc chắn cho ${candidatesToUpdate.length} bài hát.`);
    if (candidatesToUpdate.length > 0) {
      console.table(candidatesToUpdate);
    }

    console.log(`⚠️ Có ${manualReview.length} bài hát cần manual review (nhiều kết quả trùng điểm hoặc không có kết quả):`);
    if (manualReview.length > 0) {
      console.table(manualReview);
    }

    if (isApply && candidatesToUpdate.length > 0) {
      // Backup before applying
      const backupPath = path.join(__dirname, `backup_audio_repair_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(candidatesToUpdate, null, 2), 'utf-8');
      console.log(`\n💾 Đã tạo backup JSON: ${backupPath}`);

      console.log('🔄 Đang cập nhật database...');
      for (const update of candidatesToUpdate) {
        await connection.query('UPDATE songs SET audio_url = ? WHERE id = ?', [update.new_url, update.id]);
      }
      console.log('🎉 Cập nhật database thành công!');
    } else if (!isApply && candidatesToUpdate.length > 0) {
      console.log('\n💡 Chạy với cờ --apply để cập nhật database (ví dụ: node repairSongAudioPaths.js --apply).');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run().catch(console.error);
