const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'music', 'final_songs');

function getMp3Files(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getMp3Files(fullPath, fileList);
    } else if (file.toLowerCase().endsWith('.mp3')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// 💡 Chuyển chuỗi về dạng alphanumeric liền nhau (loại bỏ mọi dấu cách, ký tự đặc biệt)
function toAlphaNum(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Bỏ sạch mọi thứ không phải chữ và số
}

// Dọn dẹp các đuôi thừa (Official Video, Remix trong ngoặc...)
function cleanTitle(str) {
  if (!str) return '';
  let cleaned = str.toLowerCase();
  cleaned = cleaned.replace(/\(.*?\)/g, ''); // Xóa (Remix), (Acoustic)...
  cleaned = cleaned.replace(/\[.*?\]/g, ''); // Xóa [Official Video]...
  cleaned = cleaned.replace(/(official video|official music video|music video|dance practice|audio|lyrics|live|performance|m\/v|mv|moving ver)/g, '');
  return cleaned;
}

function cleanArtist(str) {
  if (!str) return '';
  let cleaned = str.toLowerCase();
  cleaned = cleaned.replace(/\(.*?\)/g, '');
  cleaned = cleaned.replace(/\[.*?\]/g, '');
  return cleaned;
}

async function syncMusic() {
  console.log('🔄 Bắt đầu đồng bộ nhạc (Phiên bản AlphaNum Tối Thượng)...');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '261999',
      database: process.env.DB_NAME || 'musicflow',
      port: process.env.DB_PORT || 3306,
    });

    const [songs] = await connection.execute(`
      SELECT s.id, s.title, a.name as artist_name 
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
    `);

    const mp3Files = getMp3Files(UPLOADS_DIR);
    let updatedCount = 0;
    let missingSongs = [];

    for (const song of songs) {
      const rawTitle = cleanTitle(song.title);
      const titleNorm = toAlphaNum(rawTitle); // Dạng liền: noinaycoanh

      const rawArtist = cleanArtist(song.artist_name);
      const artistNorm = toAlphaNum(rawArtist); // Dạng liền: sontungmtp

      let bestMatch = null;
      let highestScore = 0;

      for (const file of mp3Files) {
        const fileNameOriginal = path.basename(file, '.mp3');
        const rawFileName = cleanTitle(fileNameOriginal);
        const fileNameNorm = toAlphaNum(rawFileName); // Dạng liền: noinaycoanh

        const relativePathToUploads = path.relative(UPLOADS_DIR, file);
        const pathNorm = toAlphaNum(relativePathToUploads); 

        let score = 0;
        let isArtistMatch = false;

        // Quét ca sĩ (chính xác 100% không bị ảnh hưởng bởi dấu cách/gạch nối, dùng relative path để tránh lỗi trùng lặp thư mục gốc)
        if (artistNorm.length > 1 && pathNorm.includes(artistNorm)) {
          isArtistMatch = true;
        }

        // LUẬT CHẤM ĐIỂM
        if (fileNameNorm === titleNorm) {
          if (isArtistMatch) {
            score += 50; // Trùng bài + ca sĩ -> ĐẬU
          } else {
            score += 5;  // Trùng bài KHÁC ca sĩ -> RỚT
          }
        }
        else if (titleNorm.length > 3 && (fileNameNorm.includes(titleNorm) || titleNorm.includes(fileNameNorm))) {
          if (isArtistMatch) {
            score += 30; // Trùng một phần bài + Đúng ca sĩ -> ĐẬU
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = file;
        }
      }

      if (bestMatch && highestScore >= 30) {
        const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), bestMatch);
        const audioUrl = '/uploads/' + relativePath.split(path.sep).join('/');

        await connection.execute('UPDATE songs SET audio_url = ? WHERE id = ?', [audioUrl, song.id]);
        updatedCount++;
        process.stdout.write(`\r✅ Đang cập nhật thành công... ${updatedCount}`);
      } else {
        missingSongs.push(`- ${song.title} (Ca sĩ: ${song.artist_name})`);
      }
    }

    console.log(`\n🎉 Hoàn tất! Đã cập nhật thành công ${updatedCount}/${songs.length} bài hát.`);

    if (missingSongs.length > 0) {
      const outputPath = path.join(__dirname, '..', 'reports', 'missing_songs_final.txt');
      fs.writeFileSync(outputPath, missingSongs.join('\n'), 'utf-8');
      console.log(`📄 Còn lại ${missingSongs.length} bài không khớp. Đã xuất ra file: ${outputPath}`);
    }

  } catch (error) {
    console.error('\n❌ Lỗi:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

syncMusic();
