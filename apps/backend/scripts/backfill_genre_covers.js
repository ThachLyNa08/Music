require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const uploadsDir = path.join(__dirname, '../uploads/img/genre');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'musicflow',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Đã kết nối DB. Bắt đầu quét thư mục:', uploadsDir);
    
    // Đọc danh sách file trong thư mục
    if (!fs.existsSync(uploadsDir)) {
      console.log('Thư mục không tồn tại:', uploadsDir);
      return;
    }
    
    const files = fs.readdirSync(uploadsDir);
    console.log(`Tìm thấy ${files.length} file trong thư mục.`);

    // Đọc danh sách thể loại
    const [genres] = await connection.execute('SELECT id, slug, name FROM genres');
    console.log(`Có ${genres.length} thể loại trong database.`);

    let updatedCount = 0;

    for (const genre of genres) {
      if (!genre.slug) continue;
      
      // Tìm file có tên bắt đầu bằng slug (tính cả extension)
      const matchedFile = files.find(f => {
        const ext = path.extname(f);
        const basename = path.basename(f, ext);
        return basename.toLowerCase() === genre.slug.toLowerCase();
      });

      if (matchedFile) {
        const coverUrl = `/uploads/img/genre/${matchedFile}`;
        await connection.execute(
          'UPDATE genres SET cover_url = ? WHERE id = ?',
          [coverUrl, genre.id]
        );
        console.log(`✅ [${genre.name}] -> Cập nhật thành công: ${coverUrl}`);
        updatedCount++;
      } else {
        console.log(`⚠️ [${genre.name}] -> Không tìm thấy file ảnh cho slug "${genre.slug}"`);
      }
    }

    console.log(`\nHoàn tất! Đã cập nhật ${updatedCount} thể loại.`);

  } catch (error) {
    console.error('Lỗi khi chạy script:', error);
  } finally {
    await connection.end();
  }
}

run();
