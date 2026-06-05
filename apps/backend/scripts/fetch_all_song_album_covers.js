require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { scanAndFetchMissingSongCovers, scanAndFetchMissingAlbumCovers } = require('../src/services/songImage.service');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('--- Bắt đầu script tải TOÀN BỘ cover ---');
  try {
    const maxBatches = 20;

    // 1. Quét song covers
    console.log('\\n=== Quét Bài Hát ===');
    for (let i = 1; i <= maxBatches; i++) {
      console.log(`[Batch ${i}/${maxBatches}]`);
      const stats = await scanAndFetchMissingSongCovers(100);
      console.log(`Kết quả batch:`, stats);

      // Nếu tổng số bài hát tìm thấy ít hơn 50, tức là đã hết bài hát cần quét
      if (!stats.total || stats.total < 100) {
        console.log('Đã hết bài hát cần tải cover.');
        break;
      }
      await sleep(3000); // Nghỉ 3s giữa các batch
    }

    // 2. Quét album covers
    console.log('\\n=== Quét Album ===');
    for (let i = 1; i <= maxBatches; i++) {
      console.log(`[Batch ${i}/${maxBatches}]`);
      const stats = await scanAndFetchMissingAlbumCovers(100);
      console.log(`Kết quả batch:`, stats);

      if (!stats.total || stats.total < 100) {
        console.log('Đã hết album cần tải cover.');
        break;
      }
      await sleep(3000);
    }

    console.log('\\nHoàn tất tải toàn bộ.');
  } catch (error) {
    console.error('Lỗi khi chạy script:', error);
  } finally {
    process.exit(0);
  }
}

run();
