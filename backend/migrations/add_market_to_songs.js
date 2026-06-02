const { pool } = require('../src/config/database');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log('--- Bắt đầu migration: Thêm cột market vào bảng songs ---');

    // 1. Kiểm tra xem cột market đã tồn tại chưa
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'songs' AND COLUMN_NAME = 'market'
    `);

    if (columns.length === 0) {
      // 2. Thêm cột market
      console.log('Đang thêm cột market...');
      await conn.query(`
        ALTER TABLE songs 
        ADD COLUMN market ENUM('VPOP', 'KPOP', 'USUK', 'OTHER') NOT NULL DEFAULT 'OTHER'
      `);
      console.log('Đã thêm cột market thành công.');
    } else {
      console.log('Cột market đã tồn tại, bỏ qua bước thêm cột.');
    }

    // 3. Logic cập nhật dữ liệu tự động
    console.log('Đang tự động phân loại market cho các bài hát cũ...');
    
    // Logic: 
    // - Lấy tất cả bài hát cùng với artist.region và genre.name
    // - Update từng batch để tránh quá tải
    const [songs] = await conn.query(`
      SELECT s.id, a.region, g.name as genre_name 
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN genres g ON s.genre_id = g.id
    `);

    let vpopCount = 0;
    let kpopCount = 0;
    let usukCount = 0;
    let otherCount = 0;

    for (const song of songs) {
      let market = 'OTHER';
      
      const region = song.region ? song.region.toLowerCase() : '';
      const genre = song.genre_name ? song.genre_name.toLowerCase() : '';

      // Ưu tiên artists.region
      if (region.includes('việt nam') || region.includes('vietnam') || region.includes('vpop')) {
        market = 'VPOP';
      } else if (region.includes('hàn quốc') || region.includes('korea') || region.includes('kpop')) {
        market = 'KPOP';
      } else if (region.includes('us-uk') || region.includes('usuk') || region.includes('quốc tế') || region.includes('english')) {
        market = 'USUK';
      } 
      // Nếu không, dựa vào genres.name
      else if (genre.includes('v-pop') || genre.includes('vpop') || genre.includes('nhạc việt') || genre.includes('việt nam')) {
        market = 'VPOP';
      } else if (genre.includes('k-pop') || genre.includes('kpop') || genre.includes('hàn quốc')) {
        market = 'KPOP';
      } else if (genre.includes('us-uk') || genre.includes('usuk') || genre.includes('âu mỹ')) {
        market = 'USUK';
      }

      // Update vào DB
      if (market !== 'OTHER') {
        await conn.query('UPDATE songs SET market = ? WHERE id = ?', [market, song.id]);
        if (market === 'VPOP') vpopCount++;
        else if (market === 'KPOP') kpopCount++;
        else if (market === 'USUK') usukCount++;
      } else {
        otherCount++;
      }
    }

    console.log(`Đã phân loại: ${vpopCount} VPOP, ${kpopCount} KPOP, ${usukCount} USUK, ${otherCount} OTHER (mặc định).`);

    await conn.commit();
    console.log('--- Migration thành công ---');
  } catch (error) {
    await conn.rollback();
    console.error('Lỗi migration, đã rollback:', error);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
